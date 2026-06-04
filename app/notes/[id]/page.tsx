"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState, useTransition } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { StudyNoteMarkdown } from "@/components/StudyNoteMarkdown";
import { getCanonicalQuestionBank } from "@/data/med1QuestionBank";
import { resolveStudyNoteQuestionLinks } from "@/lib/questionLinkResolver";
import { DEFAULT_QUIZ_SETTINGS } from "@/lib/quizAnalysis";
import { saveQuizSettings } from "@/lib/storage";
import { buildStudyNoteQuestionLinkPrompt } from "@/lib/studyNotePrompt";
import { deleteStudyNote, loadStudyNote, parseStudyNoteQuestionLinkText, updateStudyNote } from "@/lib/studyNotes";
import type { Question, StudyNoteDetail, StudyNoteQuestionLink } from "@/types/quiz";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-Hant", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function buildQuestionSearchText(question: Question) {
  return [
    question.id,
    question.subject,
    question.chapter,
    question.section,
    question.testedConcept,
    question.stem,
    question.examCode,
    question.paperCode,
    question.sourceYear ? String(question.sourceYear) : ""
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function mergeUniqueLinks(left: StudyNoteQuestionLink[], right: StudyNoteQuestionLink[]) {
  return Array.from(
    new Map([...left, ...right].map((item) => [`${item.questionId}:${item.relationType}`, item] as const)).values()
  );
}

export default function StudyNoteDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { configured, session, user } = useAuth();
  const [note, setNote] = useState<StudyNoteDetail | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftSummary, setDraftSummary] = useState("");
  const [draftMarkdown, setDraftMarkdown] = useState("");
  const [draftQuestionLinks, setDraftQuestionLinks] = useState<StudyNoteQuestionLink[]>([]);
  const [questionSearch, setQuestionSearch] = useState("");
  const [draftQuestionCodeText, setDraftQuestionCodeText] = useState("");
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const deferredQuestionSearch = useDeferredValue(questionSearch);
  const questionLinkPromptText = useMemo(() => buildStudyNoteQuestionLinkPrompt(8), []);

  useEffect(() => {
    if (!configured || !session?.access_token || !params.id) {
      setNote(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError("");
    loadStudyNote(params.id, session.access_token)
      .then((nextNote) => {
        if (!cancelled) {
          setNote(nextNote);
          setDraftTitle(nextNote.title);
          setDraftSummary(nextNote.summary ?? "");
          setDraftMarkdown(nextNote.rawMarkdown);
          setDraftQuestionLinks(nextNote.questionLinks);
        }
      })
      .catch((rawError) => {
        if (!cancelled) {
          setError(rawError instanceof Error ? rawError.message : "筆記載入失敗");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [configured, params.id, session?.access_token]);

  const allQuestions = useMemo(
    () =>
      Array.from(
        new Map(
          getCanonicalQuestionBank()
            .filter((question) => question.sourceType !== "AI_GENERATED")
            .map((question) => [question.id, question] as const)
        ).values()
      ),
    []
  );

  const questionMap = useMemo(
    () => new Map(allQuestions.map((question) => [question.id, question] as const)),
    [allQuestions]
  );

  const selectedDraftQuestions = useMemo(
    () =>
      draftQuestionLinks
        .map((link) => ({
          link,
          question: questionMap.get(link.questionId)
        }))
        .filter((item): item is { link: StudyNoteQuestionLink; question: Question } => Boolean(item.question)),
    [draftQuestionLinks, questionMap]
  );

  const questionResults = useMemo(() => {
    const keyword = deferredQuestionSearch.trim().toLowerCase();
    if (keyword.length < 2) return [];

    return allQuestions
      .filter((question) => buildQuestionSearchText(question).includes(keyword))
      .slice(0, 12);
  }, [allQuestions, deferredQuestionSearch]);

  const relatedQuestions = useMemo(() => {
    if (!note) return [];
    return note.questionLinks
      .map((link) => ({
        link,
        question: questionMap.get(link.questionId)
      }))
      .filter((item): item is { link: typeof item.link; question: Question } => Boolean(item.question));
  }, [note, questionMap]);

  function startLinkedQuiz() {
    if (!note || relatedQuestions.length === 0) return;
    const questionIds = relatedQuestions.map((item) => item.question.id);
    saveQuizSettings({
      ...DEFAULT_QUIZ_SETTINGS,
      mode: "custom_paper",
      questionCount: questionIds.length,
      subjectFilter: note.subject ?? "全部",
      subjectFilters: note.subject ? [note.subject] : undefined,
      customQuestionIds: questionIds,
      customPoolLabel: `筆記：${note.title}`,
      customPaperName: note.title
    });
    router.push("/quiz?new=1");
  }

  function resetDraftsFromNote(nextNote = note) {
    if (!nextNote) return;
    setDraftTitle(nextNote.title);
    setDraftSummary(nextNote.summary ?? "");
    setDraftMarkdown(nextNote.rawMarkdown);
    setDraftQuestionLinks(nextNote.questionLinks);
    setQuestionSearch("");
    setDraftQuestionCodeText("");
  }

  function toggleEditing() {
    if (editing) {
      resetDraftsFromNote();
      setEditing(false);
      return;
    }

    resetDraftsFromNote();
    setEditing(true);
  }

  function addQuestionLink(question: Question) {
    setDraftQuestionLinks((current) =>
      mergeUniqueLinks(current, [
        {
          questionId: question.id,
          relationType: "related"
        }
      ])
    );
  }

  function removeQuestionLink(questionId: string) {
    setDraftQuestionLinks((current) => current.filter((item) => item.questionId !== questionId));
  }

  function addQuestionLinksFromText() {
    const resolvedLinks = resolveStudyNoteQuestionLinks(parseStudyNoteQuestionLinkText(draftQuestionCodeText), allQuestions, {
      subject: note?.subject
    });
    if (resolvedLinks.length === 0) {
      setError("沒有找到可對應的題目。請確認題號有年份、第幾次、卷碼與 Q 題號，例如 2022-1-1301-Q025。");
      setMessage("");
      return;
    }
    setDraftQuestionLinks((current) => mergeUniqueLinks(current, resolvedLinks));
    setDraftQuestionCodeText("");
    setMessage(`已加入 ${resolvedLinks.length} 題相關題目。`);
    setError("");
  }

  async function copyQuestionLinkPrompt() {
    try {
      await navigator.clipboard.writeText(questionLinkPromptText);
      setMessage("已複製專門補題號提示。");
      setError("");
    } catch {
      setError("複製失敗，可以手動複製題號提示。");
      setMessage("");
    }
  }

  function handleSaveEdit() {
    if (!note || !session?.access_token) return;
    setError("");
    setMessage("");
    startTransition(async () => {
      try {
        const updated = await updateStudyNote({
          id: note.id,
          accessToken: session.access_token,
          title: draftTitle,
          rawMarkdown: draftMarkdown,
          summary: draftSummary,
          subject: note.subject ?? "",
          chapter: note.chapter,
          section: note.section,
          collectionName: note.collectionName,
          tags: note.tags,
          questionLinks: resolveStudyNoteQuestionLinks(draftQuestionLinks, allQuestions, { subject: note.subject })
        });
        setNote(updated);
        resetDraftsFromNote(updated);
        setEditing(false);
        setMessage("筆記已更新。");
      } catch (rawError) {
        setError(rawError instanceof Error ? rawError.message : "筆記更新失敗");
      }
    });
  }

  function handleDeleteNote() {
    if (!note || !session?.access_token) return;
    const confirmed = window.confirm(`確定要刪除「${note.title}」嗎？這個動作不能復原。`);
    if (!confirmed) return;

    setError("");
    setMessage("");
    startTransition(async () => {
      try {
        await deleteStudyNote(note.id, session.access_token);
        router.push(note.subject ? `/notes/subject/${encodeURIComponent(note.subject)}` : "/notes");
      } catch (rawError) {
        setError(rawError instanceof Error ? rawError.message : "筆記刪除失敗");
      }
    });
  }

  return (
    <main className="shell">
      <section className="surface-card p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Study Note</p>
            {editing ? (
              <input
                value={draftTitle}
                onChange={(event) => setDraftTitle(event.target.value)}
                className="mt-3 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-3xl font-black text-slate-950 outline-none focus:border-teal-500 sm:text-5xl"
              />
            ) : (
              <h1 className="display-title mt-3 text-4xl sm:text-5xl">
                {note?.title ?? "學習筆記"}
              </h1>
            )}
            {note?.summary ? <p className="body-soft mt-4 max-w-3xl leading-7">{note.summary}</p> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {note ? (
              <button type="button" onClick={toggleEditing} className="secondary-pill">
                {editing ? "取消編輯" : "編輯筆記"}
              </button>
            ) : null}
            {note ? (
              <button
                type="button"
                onClick={handleDeleteNote}
                disabled={isPending}
                className="secondary-pill border-rose-200 bg-rose-50 text-rose-700 disabled:opacity-60"
              >
                刪除筆記
              </button>
            ) : null}
            <Link href={note?.subject ? `/notes/subject/${encodeURIComponent(note.subject)}` : "/notes"} className="secondary-pill">
              回筆記庫
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <article className="surface-card min-w-0 p-5 sm:p-8 lg:p-10">
          {!configured ? <p className="body-soft">Supabase 尚未設定，學習筆記需要雲端儲存才能使用。</p> : null}
          {configured && !user ? <p className="body-soft">請先登入，才能讀取自己的學習筆記。</p> : null}
          {loading ? <p className="body-soft">正在載入筆記...</p> : null}
          {error ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p> : null}
          {message ? <p className="rounded-2xl bg-teal-50 px-4 py-3 text-sm font-semibold text-teal-800">{message}</p> : null}
          {note && editing ? (
            <div className="grid gap-4">
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                摘要
                <textarea
                  value={draftSummary}
                  onChange={(event) => setDraftSummary(event.target.value)}
                  rows={3}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-teal-500"
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Markdown 內容
                <textarea
                  value={draftMarkdown}
                  onChange={(event) => setDraftMarkdown(event.target.value)}
                  rows={24}
                  className="min-h-[620px] rounded-3xl border border-slate-200 bg-white px-4 py-3 font-mono text-sm leading-6 outline-none focus:border-teal-500"
                />
              </label>
              <div className="rounded-3xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-slate-950">相關題目</h2>
                    <p className="mt-1 text-sm font-normal leading-6 text-slate-500">
                      編輯時也可以搜尋題號、概念、題幹或章節，把題目連到這篇筆記。
                    </p>
                  </div>
                  <span className="stat-chip">{selectedDraftQuestions.length} 題</span>
                </div>
                <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50/70 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold text-slate-950">專門補題號 Prompt</p>
                      <p className="mt-1 text-xs leading-5 text-slate-600">
                        貼給 ChatGPT 後，再把它回傳的 questionLinks 貼到下面欄位。
                      </p>
                    </div>
                    <button type="button" onClick={copyQuestionLinkPrompt} className="secondary-pill px-4 py-2 text-sm">
                      複製
                    </button>
                  </div>
                  <pre className="mt-3 max-h-36 max-w-full overflow-auto whitespace-pre-wrap break-words rounded-2xl bg-slate-950 p-3 text-xs leading-5 text-white">
                    {questionLinkPromptText}
                  </pre>
                </div>
                <label className="mt-4 grid gap-2 text-sm font-semibold text-slate-700">
                  貼上題目代碼
                  <textarea
                    value={draftQuestionCodeText}
                    onChange={(event) => setDraftQuestionCodeText(event.target.value)}
                    placeholder="questionLinks: 2022-1-1301-Q025, 2020-2-1301-Q021"
                    rows={3}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-teal-500"
                  />
                  <span className="text-xs font-medium leading-5 text-slate-500">
                    建議包含卷碼；像 2019-2-Q008 若撞到多題，網站會先跳過避免連錯。
                  </span>
                </label>
                <button type="button" onClick={addQuestionLinksFromText} className="secondary-pill mt-3 justify-center px-4 py-2 text-sm">
                  用題目代碼加入
                </button>
                <input
                  value={questionSearch}
                  onChange={(event) => setQuestionSearch(event.target.value)}
                  placeholder="搜尋題號、概念、題幹或章節"
                  className="mt-4 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-teal-500"
                />
                <div className="mt-3 grid gap-2">
                  {questionResults.map((question) => {
                    const selected = draftQuestionLinks.some((item) => item.questionId === question.id);
                    return (
                      <button
                        key={question.id}
                        type="button"
                        onClick={() => addQuestionLink(question)}
                        disabled={selected}
                        className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs leading-5 text-slate-700 transition hover:border-teal-200 hover:bg-teal-50 disabled:opacity-60"
                      >
                        <span className="block break-words font-bold text-slate-950">
                          {selected ? "已加入 · " : ""}
                          {question.id}
                        </span>
                        <span className="block break-words">{question.subject} / {question.chapter} / {question.section}</span>
                        <span className="block line-clamp-2">{question.stem}</span>
                      </button>
                    );
                  })}
                </div>
                {selectedDraftQuestions.length > 0 ? (
                  <div className="mt-4 grid gap-2">
                    {selectedDraftQuestions.map(({ link, question }) => (
                      <div key={`${question.id}-${link.relationType}`} className="rounded-2xl bg-teal-50 px-3 py-2 text-xs text-teal-900">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-bold">{question.id}</p>
                            <p className="mt-1 text-teal-800">{question.subject} / {question.chapter} / {question.section}</p>
                          </div>
                          <button type="button" onClick={() => removeQuestionLink(question.id)} className="shrink-0 font-semibold text-rose-700">
                            移除
                          </button>
                        </div>
                        <p className="mt-1 line-clamp-2">{question.stem}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="body-soft mt-3 text-sm">目前還沒有加入題目。</p>
                )}
              </div>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={isPending}
                className="primary-pill justify-center disabled:opacity-60"
              >
                {isPending ? "儲存中..." : "儲存修改"}
              </button>
            </div>
          ) : note ? (
            <StudyNoteMarkdown
              markdown={note.rawMarkdown}
              questionMap={questionMap}
              questionLinks={note.questionLinks}
            />
          ) : null}
        </article>

        <aside className="grid content-start gap-4">
          {note ? (
            <>
              <div className="surface-card p-5">
                <h2 className="text-lg font-bold text-slate-950">分類狀態</h2>
                <div className="mt-4 flex flex-wrap gap-2">
                  {note.collectionName ? <span className="stat-chip">{note.collectionName}</span> : null}
                  {note.subject ? <span className="stat-chip">{note.subject}</span> : null}
                  {note.chapter ? <span className="stat-chip">{note.chapter}</span> : null}
                  {note.section ? <span className="stat-chip">{note.section}</span> : null}
                  <span className="stat-chip">更新 {formatDate(note.updatedAt)}</span>
                </div>
              </div>

              <div className="surface-card p-5">
                <h2 className="text-lg font-bold text-slate-950">Tags</h2>
                {note.tags.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {note.tags.map((item) => (
                      <span key={`${item.tagType}-${item.tag}`} className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800">
                        #{item.tag}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="body-soft mt-3 text-sm">這篇還沒有 tags。</p>
                )}
              </div>

              <div className="surface-card p-5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-bold text-slate-950">相關題目</h2>
                  <span className="stat-chip">{relatedQuestions.length} 題</span>
                </div>
                {relatedQuestions.length > 0 ? (
                  <div className="mt-4 grid gap-3">
                    {relatedQuestions.map(({ link, question }) => (
                      <div key={`${question.id}-${link.relationType}`} className="rounded-2xl border border-slate-200 bg-white p-3 text-sm">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-slate-950">{question.id}</span>
                          <span className="stat-chip">{link.relationType}</span>
                          {typeof link.confidence === "number" ? <span className="stat-chip">{Math.round(link.confidence * 100)}%</span> : null}
                        </div>
                        <p className="mt-2 text-xs font-semibold text-slate-500">
                          {question.subject} / {question.chapter} / {question.section}
                        </p>
                        <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-700">{question.stem}</p>
                        {link.reason ? <p className="mt-2 rounded-2xl bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">{link.reason}</p> : null}
                        <Link
                          href={`/search?query=${encodeURIComponent(question.id)}`}
                          className="mt-3 inline-flex text-xs font-bold text-teal-700"
                        >
                          到題目搜尋查看
                        </Link>
                      </div>
                    ))}
                    <button type="button" onClick={startLinkedQuiz} className="primary-pill justify-center">
                      用相關題目建立自訂卷
                    </button>
                  </div>
                ) : (
                  <p className="body-soft mt-3 text-sm">這篇還沒有連到題目。之後可以用 metadata JSON 或新增頁先勾選。</p>
                )}
              </div>
            </>
          ) : null}
        </aside>
      </section>
    </main>
  );
}
