"use client";

import { useDeferredValue, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { getCanonicalQuestionBank } from "@/data/med1QuestionBank";
import { MED1_SUBJECTS, MED2_SUBJECTS, subjectRegistry } from "@/data/subjectRegistry";
import { resolveStudyNoteQuestionLinks } from "@/lib/questionLinkResolver";
import { buildStudyNoteFormatPrompt, buildStudyNoteQuestionLinkPrompt } from "@/lib/studyNotePrompt";
import {
  createStudyNote,
  inferStudyNoteTitle,
  normalizeStudyNoteMarkdown,
  parseStudyNoteQuestionLinkText,
  parseStudyNoteMetadata,
  stripStudyNoteMetadataBlock
} from "@/lib/studyNotes";
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
    question.explanation,
    question.memoryTip,
    Object.values(question.options).join(" "),
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

function findQuestionLinksByKeywords(
  keywords: string[] | undefined,
  questions: Question[],
  subject: SubjectName | ""
): StudyNoteQuestionLink[] {
  const normalizedKeywords = Array.from(
    new Set(
      (keywords ?? [])
        .map((keyword) => keyword.trim().toLowerCase())
        .filter((keyword) => keyword.length >= 2)
    )
  );
  if (normalizedKeywords.length === 0) return [];

  return questions
    .filter((question) => {
      if (subject && question.subject !== subject) return false;
      const haystack = buildQuestionSearchText(question);
      return normalizedKeywords.some((keyword) => haystack.includes(keyword));
    })
    .map((question) => ({
      questionId: question.id,
      relationType: "related" as const,
      reason: `由搜尋詞自動加入：${normalizedKeywords.join(", ")}`
    }));
}

function getQuestionLabel(question: Question) {
  if (question.sourceYear && question.sourceRound && question.originalQuestionNumber) {
    return `${question.sourceYear} 第 ${question.sourceRound} 次第 ${question.originalQuestionNumber} 題`;
  }
  return question.examSessionLabel ?? question.paperCode ?? question.examCode;
}

export default function NewStudyNotePage() {
  const router = useRouter();
  const { configured, session, user } = useAuth();
  const [title, setTitle] = useState("");
  const [rawMarkdown, setRawMarkdown] = useState("");
  const [summary, setSummary] = useState("");
  const [subject, setSubject] = useState<SubjectName | "">("");
  const [collectionName, setCollectionName] = useState("");
  const [manualTags, setManualTags] = useState("");
  const [metadataTags, setMetadataTags] = useState<StudyNoteTag[]>([]);
  const [questionSearch, setQuestionSearch] = useState("");
  const [questionCodeText, setQuestionCodeText] = useState("");
  const [questionLinks, setQuestionLinks] = useState<StudyNoteQuestionLink[]>([]);
  const [promptExamQuestionCount, setPromptExamQuestionCount] = useState(6);
  const [promptDetailLevel, setPromptDetailLevel] = useState<"concise" | "detailed">("detailed");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const deferredQuestionSearch = useDeferredValue(questionSearch);

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

  const promptText = useMemo(
    () => buildStudyNoteFormatPrompt([], { examQuestionCount: promptExamQuestionCount, detailLevel: promptDetailLevel }),
    [promptDetailLevel, promptExamQuestionCount]
  );
  const questionLinkPromptText = useMemo(
    () => buildStudyNoteQuestionLinkPrompt(promptExamQuestionCount),
    [promptExamQuestionCount]
  );

  function applyMetadataFromMarkdown(markdown: string) {
    const parsed = parseStudyNoteMetadata(markdown);
    if (!parsed) return;

    if (parsed.title) setTitle(parsed.title);
    if (parsed.summary) setSummary(parsed.summary);
    if (parsed.subject) setSubject(parsed.subject);
    if (parsed.collectionName) setCollectionName(parsed.collectionName);
    setMetadataTags((current) => mergeUniqueTags(current, parsed.tags ?? []));
    setQuestionLinks((current) =>
      mergeUniqueLinks(
        current,
        mergeUniqueLinks(
          resolveStudyNoteQuestionLinks(parsed.questionLinks ?? [], allQuestions, { subject: parsed.subject ?? subject }),
          findQuestionLinksByKeywords(parsed.searchKeywords, allQuestions, parsed.subject ?? subject)
        )
      )
    );
  }

  function handleMarkdownChange(value: string) {
    setRawMarkdown(value);
    applyMetadataFromMarkdown(value);
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

  function addQuestionLinksFromText() {
    const parsedMetadata = parseStudyNoteMetadata(questionCodeText);
    const resolvedLinks = resolveStudyNoteQuestionLinks(parseStudyNoteQuestionLinkText(questionCodeText), allQuestions, {
      subject
    });
    const keywordLinks = findQuestionLinksByKeywords(parsedMetadata?.searchKeywords, allQuestions, subject);
    const nextLinks = mergeUniqueLinks(resolvedLinks, keywordLinks);
    if (nextLinks.length === 0) {
      setError("沒有找到可對應的題目。請確認題號格式，或貼 searchKeywords: 咽弓, 咽囊 這種搜尋詞。");
      setMessage("");
      return;
    }
    setQuestionLinks((current) => mergeUniqueLinks(current, nextLinks));
    setQuestionCodeText("");
    setMessage(`已加入 ${nextLinks.length} 題相關題目。`);
    setError("");
  }

  async function copyFormatPrompt() {
    try {
      await navigator.clipboard.writeText(promptText);
      setMessage(`已複製${promptDetailLevel === "concise" ? "精簡" : "詳細"}版固定格式提示，可貼給 ChatGPT、Gemini 或 Claude；目標回填 ${promptExamQuestionCount} 題考古題。`);
      setError("");
    } catch {
      setError("複製失敗，可以手動複製右側格式提示。");
      setMessage("");
    }
  }

  async function copyQuestionLinkPrompt() {
    try {
      await navigator.clipboard.writeText(questionLinkPromptText);
      setMessage(`已複製專門補題號提示，目標 ${promptExamQuestionCount} 題。`);
      setError("");
    } catch {
      setError("複製失敗，可以手動複製右側題號提示。");
      setMessage("");
    }
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
        const cleanedMarkdown = normalizeStudyNoteMarkdown(stripStudyNoteMetadataBlock(rawMarkdown));
        const inferredTitle = title || inferStudyNoteTitle(rawMarkdown);
        const note = await createStudyNote({
          accessToken: session.access_token,
          title: inferredTitle,
          rawMarkdown: cleanedMarkdown,
          summary,
          subject,
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
              貼上 ChatGPT、Gemini、Claude 或其他 AI 產出的 Markdown，網站會自動讀取開頭的 note-meta 來建立標題、科目、分類與摘要。
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
          <p className="body-soft">請先在首頁登入，登入後就能新增自己的學習筆記。</p>
        ) : (
          <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(280px,380px)]">
            <div className="grid min-w-0 gap-4">
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Markdown 全文
                <textarea
                  value={rawMarkdown}
                  onChange={(event) => handleMarkdownChange(event.target.value)}
                  placeholder="把學習資料、整理筆記或複習重點貼在這裡..."
                  rows={18}
                  className="min-h-[420px] rounded-3xl border border-slate-200 bg-white px-4 py-3 font-mono text-sm leading-6 outline-none focus:border-teal-500"
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                自動讀取結果
                <div className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-700">
                  <p><span className="font-bold text-slate-950">標題：</span>{title || inferStudyNoteTitle(rawMarkdown)}</p>
                  <p><span className="font-bold text-slate-950">科目：</span>{subject || "尚未讀取"}</p>
                  <p><span className="font-bold text-slate-950">分類：</span>{collectionName || "尚未讀取"}</p>
                  <p><span className="font-bold text-slate-950">摘要：</span>{summary || "尚未讀取"}</p>
                </div>
              </label>
            </div>

            <aside className="grid min-w-0 content-start gap-4">
              <div className="min-w-0 rounded-3xl border border-teal-100 bg-teal-50/70 p-4">
                <label className="mb-4 grid gap-2 text-sm font-semibold text-slate-700">
                  要請 AI 找幾題考古題
                  <input
                    value={promptExamQuestionCount}
                    onChange={(event) => {
                      const nextValue = Number(event.target.value);
                      if (!Number.isFinite(nextValue)) return;
                      setPromptExamQuestionCount(Math.min(8, Math.max(0, Math.floor(nextValue))));
                    }}
                    type="number"
                    min={0}
                    max={8}
                    className="rounded-2xl border border-teal-200 bg-white px-4 py-3 text-sm outline-none focus:border-teal-500"
                  />
                  <span className="text-xs font-medium leading-5 text-slate-500">
                    最多 8 題；如果找不到足夠的可確認題號，AI 只需要放能確認的題。
                  </span>
                </label>
                <div className="mb-4 grid gap-2 text-sm font-semibold text-slate-700">
                  筆記輸出密度
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPromptDetailLevel("concise")}
                      className={`rounded-2xl px-4 py-3 text-sm font-bold transition ${
                        promptDetailLevel === "concise"
                          ? "bg-slate-950 text-white"
                          : "bg-white text-slate-700 ring-1 ring-teal-100 hover:bg-teal-50"
                      }`}
                    >
                      精簡
                    </button>
                    <button
                      type="button"
                      onClick={() => setPromptDetailLevel("detailed")}
                      className={`rounded-2xl px-4 py-3 text-sm font-bold transition ${
                        promptDetailLevel === "detailed"
                          ? "bg-slate-950 text-white"
                          : "bg-white text-slate-700 ring-1 ring-teal-100 hover:bg-teal-50"
                      }`}
                    >
                      詳細
                    </button>
                  </div>
                  <span className="text-xs font-medium leading-5 text-slate-500">
                    精簡適合考前速讀；詳細會保留推理、易混淆點與必要補充。
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-bold text-slate-950">Markdown 還原提示</h2>
                  <button type="button" onClick={copyFormatPrompt} className="secondary-pill px-4 py-2 text-sm">
                    複製
                  </button>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  先把這段貼給 ChatGPT、Gemini、Claude 或其他 AI，再貼你的資料。它會在最上方加入 note-meta，網站貼上後會自動建立標題、科目、分類和摘要。
                  如果要自動補相關考古題，請貼到有開啟網路搜尋的模型；不能上網也沒關係，題號留空，筆記正文仍可儲存。
                </p>
                <p className="mt-2 rounded-2xl bg-white/70 px-3 py-2 text-xs font-semibold text-teal-900">
                  不需要先給候選題；能上網的模型才補題號。建議回傳 2022-1-1301-Q025 這種格式，貼回來後會自動轉成本地題庫題目。
                </p>
                <pre className="mt-3 max-h-56 max-w-full overflow-auto whitespace-pre-wrap break-words rounded-2xl bg-slate-950 p-3 text-xs leading-5 text-white">
                  {promptText}
                </pre>
              </div>

              <div className="min-w-0 rounded-3xl border border-slate-200 bg-white p-4">
                <h2 className="text-lg font-bold text-slate-950">自動分類</h2>
                <div className="mt-4 grid gap-3">
                  <label className="grid gap-2 text-sm font-semibold text-slate-700">
                    科目
                    <select
                      value={subject}
                      onChange={(event) => {
                        setSubject(event.target.value as SubjectName | "");
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
                    分類
                    <input
                      value={collectionName}
                      onChange={(event) => setCollectionName(event.target.value)}
                      placeholder="例如 神經解剖定位"
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-teal-500"
                    />
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

              <div className="min-w-0 rounded-3xl border border-slate-200 bg-white p-4">
                <h2 className="text-lg font-bold text-slate-950">相關題目</h2>
                <div className="mt-3 rounded-2xl border border-amber-100 bg-amber-50/70 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold text-slate-950">專門補題號 Prompt</p>
                      <p className="mt-1 text-xs leading-5 text-slate-600">
                        只請 AI 回傳 questionLinks，不要把來源或題幹塞進筆記。
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
                <label className="mt-3 grid gap-2 text-sm font-semibold text-slate-700">
                  貼上題目代碼
                  <textarea
                    value={questionCodeText}
                    onChange={(event) => setQuestionCodeText(event.target.value)}
                    placeholder={"questionLinks: 2022-1-1301-Q025, 2020-2-1301-Q021\nsearchKeywords: 咽弓, 咽囊, pharyngeal arch"}
                    rows={3}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-teal-500"
                  />
                  <span className="text-xs font-medium leading-5 text-slate-500">
                    建議用年份-次別-卷碼-Q題號；也可以貼 searchKeywords，網站會用搜尋詞自動拉本地題庫題目。
                  </span>
                </label>
                <button type="button" onClick={addQuestionLinksFromText} className="secondary-pill mt-3 justify-center px-4 py-2 text-sm">
                  用題目代碼加入
                </button>
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
                        className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs leading-5 text-slate-700 disabled:opacity-60"
                      >
                        <span className="block break-words font-bold text-slate-950">{selected ? "已加入 · " : ""}{question.id}</span>
                        <span className="block break-words">{question.subject} / {question.chapter} / {question.section}</span>
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
