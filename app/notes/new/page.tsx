"use client";

import { useDeferredValue, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { getCanonicalQuestionBank } from "@/data/med1QuestionBank";
import { MED1_SUBJECTS, MED2_SUBJECTS, subjectRegistry } from "@/data/subjectRegistry";
import { DEFAULT_QUIZ_SETTINGS } from "@/lib/quizAnalysis";
import { saveQuizSettings } from "@/lib/storage";
import { createStudyNote, parseStudyNoteMetadata } from "@/lib/studyNotes";
import type { Question, StudyNoteQuestionLink, StudyNoteTag, SubjectName } from "@/types/quiz";

const SUBJECT_OPTIONS = [...MED1_SUBJECTS, ...MED2_SUBJECTS].map((subjectName) => subjectRegistry[subjectName]);

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

function parseManualTags(value: string): StudyNoteTag[] {
  return value
    .split(/[,，\n]/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => ({ tag, tagType: "misc" as const, source: "manual" as const }));
}

function mergeUniqueTags(left: StudyNoteTag[], right: StudyNoteTag[]) {
  return Array.from(new Map([...left, ...right].map((item) => [`${item.tagType}:${item.tag}`, item] as const)).values());
}

function mergeUniqueLinks(left: StudyNoteQuestionLink[], right: StudyNoteQuestionLink[]) {
  return Array.from(
    new Map([...left, ...right].map((item) => [`${item.questionId}:${item.relationType}`, item] as const)).values()
  );
}

export default function NewStudyNotePage() {
  const router = useRouter();
  const { configured, session, user } = useAuth();
  const [title, setTitle] = useState("");
  const [rawMarkdown, setRawMarkdown] = useState("");
  const [summary, setSummary] = useState("");
  const [subject, setSubject] = useState<SubjectName | "">("");
  const [chapter, setChapter] = useState("");
  const [section, setSection] = useState("");
  const [collectionName, setCollectionName] = useState("");
  const [manualTags, setManualTags] = useState("");
  const [metadataJson, setMetadataJson] = useState("");
  const [metadataTags, setMetadataTags] = useState<StudyNoteTag[]>([]);
  const [questionSearch, setQuestionSearch] = useState("");
  const [questionLinks, setQuestionLinks] = useState<StudyNoteQuestionLink[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const deferredQuestionSearch = useDeferredValue(questionSearch);

  const selectedSubjectItem = subject ? subjectRegistry[subject] : null;
  const chapterOptions = selectedSubjectItem?.chapters ?? [];
  const sectionOptions = chapterOptions.find((item) => item.chapter === chapter)?.sections ?? [];

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

  const selectedQuestions = useMemo(() => {
    const map = new Map(allQuestions.map((question) => [question.id, question] as const));
    return questionLinks
      .map((link) => map.get(link.questionId))
      .filter((question): question is Question => Boolean(question));
  }, [allQuestions, questionLinks]);

  const questionResults = useMemo(() => {
    const keyword = deferredQuestionSearch.trim().toLowerCase();
    if (keyword.length < 2) return [];

    return allQuestions
      .filter((question) => {
        if (subject && question.subject !== subject) return false;
        return buildQuestionSearchText(question).includes(keyword);
      })
      .slice(0, 12);
  }, [allQuestions, deferredQuestionSearch, subject]);

  function applyMetadata() {
    const parsed = parseStudyNoteMetadata(metadataJson);
    if (!parsed) {
      setError("metadata JSON 解析失敗，請確認是不是完整 JSON 或 json code block。");
      setMessage("");
      return;
    }

    if (parsed.summary) setSummary(parsed.summary);
    if (parsed.subject) {
      setSubject(parsed.subject);
      setChapter("");
      setSection("");
    }
    if (parsed.chapter) setChapter(parsed.chapter);
    if (parsed.section) setSection(parsed.section);
    if (parsed.collectionName) setCollectionName(parsed.collectionName);
    setMetadataTags((current) => mergeUniqueTags(current, parsed.tags ?? []));
    setQuestionLinks((current) => mergeUniqueLinks(current, parsed.questionLinks ?? []));
    setError("");
    setMessage("已套用 metadata JSON。");
  }

  function addQuestionLink(question: Question) {
    setQuestionLinks((current) =>
      mergeUniqueLinks(current, [
        {
          questionId: question.id,
          relationType: "related"
        }
      ])
    );
  }

  function removeQuestionLink(questionId: string) {
    setQuestionLinks((current) => current.filter((item) => item.questionId !== questionId));
  }

  function startLinkedQuiz() {
    if (questionLinks.length === 0) return;
    saveQuizSettings({
      ...DEFAULT_QUIZ_SETTINGS,
      mode: "custom_paper",
      questionCount: questionLinks.length,
      subjectFilter: subject || "全部",
      subjectFilters: subject ? [subject] : undefined,
      customQuestionIds: questionLinks.map((item) => item.questionId),
      customPoolLabel: title ? `筆記：${title}` : "學習筆記相關題",
      customPaperName: title || "學習筆記相關題"
    });
    router.push("/quiz?new=1");
  }

  function handleSave() {
    if (!session?.access_token) {
      setError("請先登入再儲存筆記。");
      return;
    }
    setError("");
    setMessage("");

    startTransition(async () => {
      try {
        const note = await createStudyNote({
          accessToken: session.access_token,
          title,
          rawMarkdown,
          summary,
          subject,
          chapter,
          section,
          collectionName,
          tags: mergeUniqueTags(parseManualTags(manualTags), metadataTags),
          questionLinks
        });
        router.push(`/notes/${note.id}`);
      } catch (rawError) {
        setError(rawError instanceof Error ? rawError.message : "學習筆記建立失敗");
      }
    });
  }

  return (
    <main className="shell">
      <section className="surface-card p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow">New Study Note</p>
            <h1 className="display-title mt-3 text-4xl sm:text-5xl">新增學習筆記</h1>
            <p className="body-soft mt-4 max-w-2xl leading-7">
              貼上學習資料全文，網站會保留 Markdown 排版；分類、tag 和相關題可以先手動補。
            </p>
          </div>
          <Link href="/notes" className="secondary-pill">
            回筆記庫
          </Link>
        </div>
      </section>

      <section className="surface-card mt-6 p-5 sm:p-6">
        {!configured ? (
          <p className="body-soft">Supabase 尚未設定，學習筆記需要雲端儲存才能使用。</p>
        ) : !user ? (
          <p className="body-soft">請先在首頁登入，登入後就能新增私人筆記。</p>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_420px]">
            <div className="grid gap-4">
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                標題
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="例如 視覺路徑定位總整理"
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-teal-500"
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Markdown 全文
                <textarea
                  value={rawMarkdown}
                  onChange={(event) => setRawMarkdown(event.target.value)}
                  placeholder="把學習資料、整理筆記或複習重點貼在這裡..."
                  rows={18}
                  className="min-h-[420px] rounded-3xl border border-slate-200 bg-white px-4 py-3 font-mono text-sm leading-6 outline-none focus:border-teal-500"
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                摘要
                <textarea
                  value={summary}
                  onChange={(event) => setSummary(event.target.value)}
                  placeholder="可選：寫一小段這篇在講什麼"
                  rows={3}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-teal-500"
                />
              </label>
            </div>

            <aside className="grid content-start gap-4">
              <div className="rounded-3xl border border-slate-200 bg-white p-4">
                <h2 className="text-lg font-bold text-slate-950">分類</h2>
                <div className="mt-4 grid gap-3">
                  <label className="grid gap-2 text-sm font-semibold text-slate-700">
                    資料夾
                    <input
                      value={collectionName}
                      onChange={(event) => setCollectionName(event.target.value)}
                      placeholder="例如 神經解剖定位"
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-teal-500"
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-semibold text-slate-700">
                    科目
                    <select
                      value={subject}
                      onChange={(event) => {
                        setSubject(event.target.value as SubjectName | "");
                        setChapter("");
                        setSection("");
                      }}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-teal-500"
                    >
                      <option value="">未分類</option>
                      {SUBJECT_OPTIONS.map((item) => (
                        <option key={item.subject} value={item.subject}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-2 text-sm font-semibold text-slate-700">
                    章節
                    <select
                      value={chapter}
                      onChange={(event) => {
                        setChapter(event.target.value);
                        setSection("");
                      }}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-teal-500"
                    >
                      <option value="">未選章節</option>
                      {chapterOptions.map((item) => (
                        <option key={item.chapter} value={item.chapter}>
                          {item.chapter}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-2 text-sm font-semibold text-slate-700">
                    小節
                    <select
                      value={section}
                      onChange={(event) => setSection(event.target.value)}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-teal-500"
                    >
                      <option value="">未選小節</option>
                      {sectionOptions.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-2 text-sm font-semibold text-slate-700">
                    手動 tags
                    <textarea
                      value={manualTags}
                      onChange={(event) => setManualTags(event.target.value)}
                      placeholder="用逗號或換行分隔，例如 視交叉, 雙顳側偏盲"
                      rows={3}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-teal-500"
                    />
                  </label>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-bold text-slate-950">metadata JSON</h2>
                  <button type="button" onClick={applyMetadata} className="secondary-pill px-4 py-2 text-sm">
                    套用
                  </button>
                </div>
                <textarea
                  value={metadataJson}
                  onChange={(event) => setMetadataJson(event.target.value)}
                  placeholder='可貼整理好的 metadata JSON，例如 {"summary":"...","tags":[{"tag":"視交叉","tag_type":"anatomy"}]}'
                  rows={7}
                  className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-mono text-xs leading-5 outline-none focus:border-teal-500"
                />
                {metadataTags.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {metadataTags.map((item) => (
                      <span key={`${item.tagType}-${item.tag}`} className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800">
                        #{item.tag}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-4">
                <h2 className="text-lg font-bold text-slate-950">相關題目</h2>
                <input
                  value={questionSearch}
                  onChange={(event) => setQuestionSearch(event.target.value)}
                  placeholder="搜尋題號、概念、題幹或章節"
                  className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-teal-500"
                />
                <div className="mt-3 grid gap-2">
                  {questionResults.map((question) => {
                    const selected = questionLinks.some((item) => item.questionId === question.id);
                    return (
                      <button
                        key={question.id}
                        type="button"
                        onClick={() => addQuestionLink(question)}
                        disabled={selected}
                        className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs leading-5 text-slate-700 disabled:opacity-60"
                      >
                        <span className="font-bold text-slate-950">{selected ? "已加入 · " : ""}{question.id}</span>
                        <span className="block">{question.subject} / {question.chapter} / {question.section}</span>
                        <span className="block line-clamp-2">{question.stem}</span>
                      </button>
                    );
                  })}
                </div>
                {selectedQuestions.length > 0 ? (
                  <div className="mt-4 grid gap-2">
                    {selectedQuestions.map((question) => (
                      <div key={question.id} className="rounded-2xl bg-teal-50 px-3 py-2 text-xs text-teal-900">
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-bold">{question.id}</span>
                          <button type="button" onClick={() => removeQuestionLink(question.id)} className="font-semibold text-rose-700">
                            移除
                          </button>
                        </div>
                        <p className="mt-1 line-clamp-2">{question.stem}</p>
                      </div>
                    ))}
                    <button type="button" onClick={startLinkedQuiz} className="secondary-pill justify-center px-4 py-2 text-sm">
                      先用這些題目試做自訂卷
                    </button>
                  </div>
                ) : null}
              </div>

              {error ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p> : null}
              {message ? <p className="rounded-2xl bg-teal-50 px-4 py-3 text-sm font-semibold text-teal-800">{message}</p> : null}
              <button
                type="button"
                onClick={handleSave}
                disabled={isPending}
                className="primary-pill justify-center disabled:opacity-60"
              >
                {isPending ? "儲存中..." : "儲存筆記"}
              </button>
            </aside>
          </div>
        )}
      </section>
    </main>
  );
}
