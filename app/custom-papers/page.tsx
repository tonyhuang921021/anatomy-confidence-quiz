"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { enabledSubjects, MED1_SUBJECTS, MED2_SUBJECTS } from "@/data/subjectRegistry";
import {
  generateAISearchCustomPaper,
  generateCustomPaper,
  loadPublicCustomPapers,
  lookupCustomPaper,
  updateCustomPaperMetadata
} from "@/lib/cloudSync";
import { DEFAULT_QUIZ_SETTINGS } from "@/lib/quizAnalysis";
import { loadCompletedSessions, saveQuizSettings } from "@/lib/storage";
import { getOrCreateVisitorId } from "@/lib/visitor";
import type {
  CustomPaperDetail,
  CustomPaperDifficulty,
  CustomPaperSummary,
  SubjectName
} from "@/types/quiz";

const selectableSubjects = enabledSubjects.filter(
  (item) =>
    item.subject !== "醫學（一）" &&
    item.subject !== "醫學（二）" &&
    (MED1_SUBJECTS.includes(item.subject) || MED2_SUBJECTS.includes(item.subject))
);

const difficultyMeta: Record<CustomPaperDifficulty, { label: string; description: string }> = {
  easy: {
    label: "易",
    description: "優先抽答對率較高、較多人做對的題目。"
  },
  medium: {
    label: "中",
    description: "優先抽答對率落在中間區間的題目。"
  },
  hard: {
    label: "難",
    description: "只抽至少 1 人做過且全站答對率不超過三分之一的題目，並從最難的開始取。"
  },
  ai_search: {
    label: "AI 檢索",
    description: "打關鍵字後由 AI 幫你找出同一區塊的相關題目。"
  }
};

function formatPaperTime(value: string) {
  return new Date(value).toLocaleString("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatSubjectLabels(labels: string[]) {
  return labels.length > 0 ? labels.join("・") : "全部科目";
}

export default function CustomPapersPage() {
  const router = useRouter();
  const { session } = useAuth();
  const med1Subjects = selectableSubjects.filter((item) => MED1_SUBJECTS.includes(item.subject));
  const med2Subjects = selectableSubjects.filter((item) => MED2_SUBJECTS.includes(item.subject));
  const [tab, setTab] = useState<"generate" | "ai_search" | "public" | "lookup">("generate");
  const [selectedSubjects, setSelectedSubjects] = useState<SubjectName[]>([]);
  const [difficulty, setDifficulty] = useState<CustomPaperDifficulty>("hard");
  const [paperName, setPaperName] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [aiQuery, setAiQuery] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");
  const [generatedPaper, setGeneratedPaper] = useState<CustomPaperDetail | null>(null);
  const [paperCodeInput, setPaperCodeInput] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const [selectedPaper, setSelectedPaper] = useState<CustomPaperDetail | null>(null);
  const [editingPaperName, setEditingPaperName] = useState("");
  const [editingPaperPublic, setEditingPaperPublic] = useState(false);
  const [updatingPaper, setUpdatingPaper] = useState(false);
  const [updatePaperMessage, setUpdatePaperMessage] = useState("");
  const [updatePaperError, setUpdatePaperError] = useState("");
  const [publicPapers, setPublicPapers] = useState<CustomPaperSummary[]>([]);
  const [publicLoading, setPublicLoading] = useState(true);
  const [publicError, setPublicError] = useState("");

  useEffect(() => {
    async function fetchPublicPapers() {
      try {
        setPublicError("");
        setPublicLoading(true);
        setPublicPapers(await loadPublicCustomPapers());
      } catch (error) {
        setPublicError(error instanceof Error ? error.message : "公開卷載入失敗");
      } finally {
        setPublicLoading(false);
      }
    }

    void fetchPublicPapers();
  }, []);

  useEffect(() => {
    setEditingPaperName(selectedPaper?.name ?? "");
    setEditingPaperPublic(selectedPaper?.isPublic ?? false);
    setUpdatePaperMessage("");
    setUpdatePaperError("");
  }, [selectedPaper?.paperCode, selectedPaper?.name, selectedPaper?.isPublic]);

  const doneQuestionIds = useMemo(() => {
    const sessions = loadCompletedSessions();
    return Array.from(
      new Set(
        sessions
          .filter((sessionItem) => sessionItem.settings?.mode === "custom_paper")
          .flatMap((sessionItem) => sessionItem.attempts.map((attempt) => attempt.questionId))
      )
    );
  }, []);

  function toggleSubject(subject: SubjectName) {
    setSelectedSubjects((current) =>
      current.includes(subject)
        ? current.filter((item) => item !== subject)
        : [...current, subject]
    );
  }

  function handleStartPaper(paper: CustomPaperDetail) {
    const subjectFilters = paper.subjectLabels.filter(Boolean) as SubjectName[];
    const subjectFilter =
      subjectFilters.length === 1 ? subjectFilters[0] : ("全部" as const);

    saveQuizSettings({
      ...DEFAULT_QUIZ_SETTINGS,
      mode: "custom_paper",
      questionCount: paper.questionIds.length,
      subjectFilter,
      subjectFilters,
      customQuestionIds: paper.questionIds,
      customPoolLabel: `自訂卷：${paper.name || paper.paperCode}`,
      customPaperCode: paper.paperCode,
      customPaperName: paper.name,
      customPaperDifficulty: paper.difficulty,
      customPaperIsPublic: paper.isPublic
    });

    router.push("/quiz?new=1");
  }

  async function handleGenerate() {
    if (selectedSubjects.length === 0) return;

    try {
      setGenerating(true);
      setGenerateError("");
      const paper = await generateCustomPaper({
        accessToken: session?.access_token ?? null,
        visitorId: getOrCreateVisitorId() ?? "",
        selectedSubjects,
        difficulty,
        name: paperName,
        isPublic,
        doneQuestionIds
      });
      setGeneratedPaper(paper);
      setSelectedPaper(paper);
      setTab("lookup");
      if (paper.isPublic) {
        setPublicPapers((current) => [paper, ...current].slice(0, 30));
      }
    } catch (error) {
      setGenerateError(error instanceof Error ? error.message : "自訂卷產生失敗");
    } finally {
      setGenerating(false);
    }
  }

  async function handleGenerateAISearch() {
    if (!aiQuery.trim()) return;

    try {
      setGenerating(true);
      setGenerateError("");
      const paper = await generateAISearchCustomPaper({
        accessToken: session?.access_token ?? null,
        visitorId: getOrCreateVisitorId() ?? "",
        selectedSubjects,
        query: aiQuery,
        name: paperName,
        isPublic
      });
      setGeneratedPaper(paper);
      setSelectedPaper(paper);
      setTab("lookup");
      if (paper.isPublic) {
        setPublicPapers((current) => [paper, ...current].slice(0, 30));
      }
    } catch (error) {
      setGenerateError(error instanceof Error ? error.message : "AI 智慧檢索自訂卷產生失敗");
    } finally {
      setGenerating(false);
    }
  }

  async function handleLookupPaper(code: string) {
    const normalizedCode = code.trim().toUpperCase();
    if (!normalizedCode) return;

    try {
      setLookupLoading(true);
      setLookupError("");
      const paper = await lookupCustomPaper(normalizedCode);
      setSelectedPaper(paper);
      setPaperCodeInput(normalizedCode);
    } catch (error) {
      setLookupError(error instanceof Error ? error.message : "找不到這份自訂卷");
    } finally {
      setLookupLoading(false);
    }
  }

  async function handleUpdateSelectedPaper() {
    if (!selectedPaper) return;

    try {
      setUpdatingPaper(true);
      setUpdatePaperError("");
      setUpdatePaperMessage("");
      const updated = await updateCustomPaperMetadata({
        accessToken: session?.access_token ?? null,
        visitorId: getOrCreateVisitorId() ?? "",
        paperCode: selectedPaper.paperCode,
        name: editingPaperName,
        isPublic: editingPaperPublic
      });
      setSelectedPaper(updated);
      setGeneratedPaper((current) => (current?.paperCode === updated.paperCode ? updated : current));
      setPublicPapers((current) => {
        const next = current.filter((item) => item.paperCode !== updated.paperCode);
        if (updated.isPublic) {
          return [updated, ...next].slice(0, 30);
        }
        return next;
      });
      setUpdatePaperMessage("這份卷的名稱與公開設定已更新。");
    } catch (error) {
      setUpdatePaperError(error instanceof Error ? error.message : "更新自訂卷失敗");
    } finally {
      setUpdatingPaper(false);
    }
  }

  function renderSubjectGroup(
    title: string,
    subjects: typeof selectableSubjects
  ) {
    return (
      <section className="rounded-[2rem] bg-slate-50 p-5 ring-1 ring-slate-100">
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {subjects.map((subject) => {
            const active = selectedSubjects.includes(subject.subject);
            return (
              <button
                key={subject.subject}
                type="button"
                onClick={() => toggleSubject(subject.subject)}
                className={`rounded-3xl border p-4 text-left transition ${
                  active
                    ? "border-brand-500 bg-brand-50 ring-2 ring-brand-200"
                    : "border-slate-200 bg-white hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-ink sm:text-base">
                    {subject.label}
                  </span>
                  <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">
                    {subject.questions.length}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    );
  }

  return (
    <main className="shell">
      <section className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">
              Custom Papers
            </p>
            <h1 className="mt-2 text-3xl font-bold text-ink sm:text-4xl">自訂卷模式</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
              你可以自己產一份 10 題自訂卷，拿五碼考卷碼分享給別人，也可以直接輸入考卷碼去寫同一份卷。
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/custom-papers/review"
              className="min-h-12 rounded-2xl bg-amber-100 px-5 py-4 text-sm font-semibold text-amber-900 transition hover:bg-amber-200"
            >
              自訂卷錯題庫
            </Link>
            <Link
              href="/"
              className="min-h-12 rounded-2xl bg-slate-100 px-5 py-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-200"
            >
              返回首頁
            </Link>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setTab("generate")}
            className={`min-h-12 rounded-2xl px-5 py-3 text-sm font-semibold transition ${
              tab === "generate"
                ? "bg-brand-600 text-white"
                : "bg-slate-100 text-slate-800 hover:bg-slate-200"
            }`}
          >
            產生題目
          </button>
          <button
            type="button"
            onClick={() => setTab("ai_search")}
            className={`min-h-12 rounded-2xl px-5 py-3 text-sm font-semibold transition ${
              tab === "ai_search"
                ? "bg-brand-600 text-white"
                : "bg-slate-100 text-slate-800 hover:bg-slate-200"
            }`}
          >
            AI 智慧檢索
          </button>
          <button
            type="button"
            onClick={() => setTab("public")}
            className={`min-h-12 rounded-2xl px-5 py-3 text-sm font-semibold transition ${
              tab === "public"
                ? "bg-brand-600 text-white"
                : "bg-slate-100 text-slate-800 hover:bg-slate-200"
            }`}
          >
            可以直接做的公開卷
          </button>
          <button
            type="button"
            onClick={() => setTab("lookup")}
            className={`min-h-12 rounded-2xl px-5 py-3 text-sm font-semibold transition ${
              tab === "lookup"
                ? "bg-brand-600 text-white"
                : "bg-slate-100 text-slate-800 hover:bg-slate-200"
            }`}
          >
            輸入題目卷代碼
          </button>
        </div>
      </section>

      {tab === "generate" ? (
        <section className="mt-6 rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100 sm:p-8">
          <div className="grid gap-6">
            {renderSubjectGroup("醫學（一）科目", med1Subjects)}
            {renderSubjectGroup("醫學（二）科目", med2Subjects)}

            <div className="rounded-[2rem] bg-slate-50 p-5 ring-1 ring-slate-100">
              <h2 className="text-lg font-semibold text-ink">難度</h2>
              <div className="mt-4 grid gap-3 lg:grid-cols-3">
                {(["easy", "medium", "hard"] as CustomPaperDifficulty[]).map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setDifficulty(level)}
                    className={`rounded-3xl border p-4 text-left transition ${
                      difficulty === level
                        ? "border-brand-500 bg-brand-50 ring-2 ring-brand-200"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <p className="text-base font-semibold text-ink">{difficultyMeta[level].label}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {difficultyMeta[level].description}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-[2rem] bg-slate-50 p-5 ring-1 ring-slate-100">
              <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                <div>
                  <label className="text-sm font-semibold text-ink">這份卷的名稱（可不填）</label>
                  <input
                    value={paperName}
                    onChange={(event) => setPaperName(event.target.value.slice(0, 60))}
                    placeholder="例如：期中前生理衝刺卷"
                    className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => setIsPublic((current) => !current)}
                    className={`min-h-12 w-full rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                      isPublic
                        ? "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-300"
                        : "bg-white text-slate-800 ring-1 ring-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {isPublic ? "公開這份卷：開" : "公開這份卷：關"}
                  </button>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-slate-600">
                  這個模式做過的題和其他模式不共用；產卷時會優先避開你在自訂卷模式已做過的題。
                </p>
                <button
                  type="button"
                  onClick={() => void handleGenerate()}
                  disabled={generating || selectedSubjects.length === 0}
                  className="min-h-12 rounded-2xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {generating ? "產卷中..." : "產生 10 題自訂卷"}
                </button>
              </div>

              {generateError ? (
                <div className="mt-4 rounded-2xl bg-rose-50 p-4 text-sm text-rose-900">{generateError}</div>
              ) : null}
            </div>
          </div>
        </section>
      ) : tab === "ai_search" ? (
        <section className="mt-6 rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100 sm:p-8">
          <div className="grid gap-6">
            <div className="rounded-[2rem] bg-slate-50 p-5 ring-1 ring-slate-100">
              <h2 className="text-lg font-semibold text-ink">AI 智慧檢索題目</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                打你剛學完的區塊、章節或關鍵字，AI 會幫你找出同一區塊的相關題目，整包做成一份卷。這份卷不只 10 題，會把找到的相關題都放進去。
              </p>
              <textarea
                value={aiQuery}
                onChange={(event) => setAiQuery(event.target.value.slice(0, 200))}
                placeholder="例如：腎小管酸鹼平衡、brachial plexus、類固醇生成、血液氣體運輸"
                className="mt-4 min-h-28 w-full rounded-3xl border border-slate-200 bg-white p-4 text-sm leading-7 text-slate-800 outline-none"
              />
              <p className="mt-2 text-xs text-slate-500">
                可不選科目；如果有先勾科目，AI 就只會在那些科目裡找題。
              </p>
            </div>

            {renderSubjectGroup("醫學（一）科目篩選（可不選）", med1Subjects)}
            {renderSubjectGroup("醫學（二）科目篩選（可不選）", med2Subjects)}

            <div className="rounded-[2rem] bg-slate-50 p-5 ring-1 ring-slate-100">
              <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                <div>
                  <label className="text-sm font-semibold text-ink">這份卷的名稱（可不填）</label>
                  <input
                    value={paperName}
                    onChange={(event) => setPaperName(event.target.value.slice(0, 60))}
                    placeholder="例如：腎臟酸鹼平衡總整理"
                    className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => setIsPublic((current) => !current)}
                    className={`min-h-12 w-full rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                      isPublic
                        ? "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-300"
                        : "bg-white text-slate-800 ring-1 ring-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {isPublic ? "公開這份卷：開" : "公開這份卷：關"}
                  </button>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-slate-600">
                  AI 會先理解你輸入的區塊，再把相關題目整包組成一份卷；這個模式可直接公開給大家一起做。
                </p>
                <button
                  type="button"
                  onClick={() => void handleGenerateAISearch()}
                  disabled={generating || !aiQuery.trim()}
                  className="min-h-12 rounded-2xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {generating ? "AI 檢索中..." : "產生 AI 智慧檢索卷"}
                </button>
              </div>

              {generateError ? (
                <div className="mt-4 rounded-2xl bg-rose-50 p-4 text-sm text-rose-900">{generateError}</div>
              ) : null}
            </div>
          </div>
        </section>
      ) : tab === "lookup" ? (
        <section className="mt-6 rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100 sm:p-8">
          <div className="rounded-[2rem] bg-slate-50 p-5 ring-1 ring-slate-100">
            <label className="text-sm font-semibold text-ink">輸入五碼考卷碼</label>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              <input
                value={paperCodeInput}
                onChange={(event) => setPaperCodeInput(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5))}
                placeholder="例如 A7K9Q"
                className="min-h-12 flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-800 outline-none"
              />
              <button
                type="button"
                onClick={() => void handleLookupPaper(paperCodeInput)}
                disabled={lookupLoading || paperCodeInput.trim().length !== 5}
                className="min-h-12 rounded-2xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {lookupLoading ? "查詢中..." : "查看這份卷"}
              </button>
            </div>
            {lookupError ? (
              <div className="mt-4 rounded-2xl bg-rose-50 p-4 text-sm text-rose-900">{lookupError}</div>
            ) : null}
          </div>

        </section>
      ) : (
        <section className="mt-6 rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100 sm:p-8">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-ink">可以直接做的公開卷</h2>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              最新 {publicPapers.length} 份
            </span>
          </div>

          <div className="mt-4 grid gap-3">
            {publicLoading ? (
              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">正在載入公開卷...</div>
            ) : publicError ? (
              <div className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-900">{publicError}</div>
            ) : publicPapers.length === 0 ? (
              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">目前還沒有公開卷。</div>
            ) : (
              publicPapers.map((paper) => (
                <button
                  key={paper.paperCode}
                  type="button"
                  onClick={() => void handleLookupPaper(paper.paperCode)}
                  className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-brand-200 hover:bg-white"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white">
                          {paper.paperCode}
                        </span>
                        <h3 className="text-base font-semibold text-ink">{paper.name || "未命名自訂卷"}</h3>
                      </div>
                      <p className="mt-2 text-sm text-slate-600">
                        {formatSubjectLabels(paper.subjectLabels)} ・ {difficultyMeta[paper.difficulty].label} ・ {paper.questionCount} 題
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {paper.createdByLabel || "匿名"} ・ {formatPaperTime(paper.createdAt)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs font-semibold">
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-800">
                        平均 {paper.averageAccuracyRate}%
                      </span>
                      <span className="rounded-full bg-slate-200 px-3 py-1 text-slate-700">
                        {paper.participantCount} 人作答
                      </span>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </section>
      )}

      {selectedPaper ? (
        <section className="mt-6 rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                  {selectedPaper.paperCode}
                </span>
                <h2 className="text-2xl font-semibold text-ink">
                  {selectedPaper.name || "未命名自訂卷"}
                </h2>
              </div>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                {formatSubjectLabels(selectedPaper.subjectLabels)} ・ {difficultyMeta[selectedPaper.difficulty].label} ・ {selectedPaper.questionCount} 題
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {selectedPaper.createdByLabel || "匿名"} 建立 ・ {formatPaperTime(selectedPaper.createdAt)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-semibold">
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-800">
                平均答對率 {selectedPaper.averageAccuracyRate}%
              </span>
              <span className="rounded-full bg-slate-200 px-3 py-1 text-slate-700">
                {selectedPaper.participantCount} 人已作答
              </span>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => handleStartPaper(selectedPaper)}
              className="min-h-12 rounded-2xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
            >
              開始寫這份 {selectedPaper.questionCount} 題自訂卷
            </button>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(selectedPaper.paperCode)}
              className="min-h-12 rounded-2xl bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-200"
            >
              複製考卷碼
            </button>
          </div>

          <div className="mt-6 rounded-[2rem] bg-slate-50 p-5 ring-1 ring-slate-100">
            <h3 className="text-lg font-semibold text-ink">建立者可修改這份卷</h3>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              如果你是這份卷的建立者，可以在這裡改卷名，或切換要不要公開。
            </p>
            <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <div>
                <label className="text-sm font-semibold text-ink">卷名</label>
                <input
                  value={editingPaperName}
                  onChange={(event) => setEditingPaperName(event.target.value.slice(0, 60))}
                  placeholder="例如：腎臟酸鹼平衡總整理"
                  className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => setEditingPaperPublic((current) => !current)}
                  className={`min-h-12 w-full rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                    editingPaperPublic
                      ? "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-300"
                      : "bg-white text-slate-800 ring-1 ring-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {editingPaperPublic ? "公開這份卷：開" : "公開這份卷：關"}
                </button>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void handleUpdateSelectedPaper()}
                disabled={updatingPaper}
                className="min-h-12 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {updatingPaper ? "更新中..." : "更新這份卷"}
              </button>
              {updatePaperMessage ? (
                <span className="text-sm text-emerald-700">{updatePaperMessage}</span>
              ) : null}
              {updatePaperError ? (
                <span className="text-sm text-rose-700">{updatePaperError}</span>
              ) : null}
            </div>
          </div>

          <div className="mt-6">
            <h3 className="text-lg font-semibold text-ink">每個人的答對率</h3>
            <div className="mt-3 grid gap-3">
              {selectedPaper.participants.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                  目前還沒有人完成這份卷。
                </div>
              ) : (
                selectedPaper.participants.map((participant) => (
                  <article
                    key={participant.sessionId}
                    className="rounded-3xl bg-slate-50 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-ink">{participant.label}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {formatPaperTime(participant.completedAt)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs font-semibold">
                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-800">
                          {participant.accuracyRate}%
                        </span>
                        <span className="rounded-full bg-slate-200 px-3 py-1 text-slate-700">
                          {participant.correctCount} / {participant.totalCount}
                        </span>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>
        </section>
      ) : null}

      {generatedPaper ? (
        <section className="mt-6 rounded-[2rem] bg-emerald-50 p-6 ring-1 ring-emerald-200 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">
            Generated
          </p>
          <h2 className="mt-2 text-2xl font-bold text-emerald-950">
            已產生 {generatedPaper.questionCount} 題自訂卷
          </h2>
          <p className="mt-3 text-sm leading-7 text-emerald-900">
            考卷碼是 <span className="font-bold">{generatedPaper.paperCode}</span>，可以分享給其他人輸入同一份卷來寫。
          </p>
        </section>
      ) : null}
    </main>
  );
}
