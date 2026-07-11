"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import {
  createAISearchCustomPaper,
  generateCustomPaper,
  importJsonCustomPaper,
  loadPublicCustomPapers,
  lookupCustomPaper,
  previewAISearchCustomPaper,
  updateCustomPaperMetadata
} from "@/lib/cloudSync";
import { MAX_PRACTICE_SOURCE_YEAR, MIN_PRACTICE_SOURCE_YEAR, PRACTICE_YEAR_OPTIONS } from "@/lib/practiceYears";
import { buildNewQuizHref } from "@/lib/startSettingsUrl";
import { loadCompletedSessions, saveQuizSettings } from "@/lib/storage";
import { getOrCreateVisitorId } from "@/lib/visitor";
import type {
  CustomPaperDetail,
  CustomPaperDifficulty,
  CustomPaperSearchPreview,
  CustomPaperSummary,
  QuizSettings,
  SubjectName
} from "@/types/quiz";

const IMPORT_JSON_TEMPLATE = `你是醫學題庫整理助手。請嚴格只輸出 JSON 陣列，不要加 Markdown、不要加任何前後說明。

[
  {
    "subject": "解剖學",
    "chapter": "例如：臂神經叢",
    "section": "例如：上肢／周邊神經",
    "question": "題幹全文",
    "options": {
      "A": "選項 A",
      "B": "選項 B",
      "C": "選項 C",
      "D": "選項 D",
      "E": ""
    },
    "answer": "A",
    "accepted_answers": ["A"],
    "answer_credit_type": "standard",
    "tested_concept": "這題在考什麼核心概念",
    "explanation": "完整詳解",
    "option_analysis": {
      "A": "A 選項解析",
      "B": "B 選項解析",
      "C": "C 選項解析",
      "D": "D 選項解析",
      "E": ""
    },
    "memory_tip": "一句快速記憶法"
  }
]

規則：
1. answer 只能是 A/B/C/D/E 其中之一。
2. 單選題 accepted_answers 請和 answer 一樣，例如 ["A"]。
3. 如果有複數給分，accepted_answers 可寫多個答案，例如 ["B","D"]，並把 answer_credit_type 寫成 "multiple_accepted"。
4. 如果本題一律給分，answer_credit_type 請寫成 "all_credit"。
5. 沒有 E 選項時，E 可以留空字串。
6. 所有欄位都請保留，不要省略 key。`;

const med1Subjects: Array<{ subject: SubjectName; label: string }> = [
  { subject: "解剖學", label: "解剖學" },
  { subject: "組織學", label: "組織學" },
  { subject: "胚胎學", label: "胚胎學" },
  { subject: "生理學", label: "生理學" },
  { subject: "生物化學", label: "生物化學" }
];

const med2Subjects: Array<{ subject: SubjectName; label: string }> = [
  { subject: "微生物免疫學", label: "微生物免疫學" },
  { subject: "寄生蟲學", label: "寄生蟲學" },
  { subject: "公共衛生學", label: "公共衛生學" },
  { subject: "藥理學", label: "藥理學" },
  { subject: "病理學", label: "病理學" }
];

const selectableSubjects = [...med1Subjects, ...med2Subjects];
const allSourceYears = PRACTICE_YEAR_OPTIONS;
const MIN_SOURCE_YEAR = MIN_PRACTICE_SOURCE_YEAR;
const MAX_SOURCE_YEAR = MAX_PRACTICE_SOURCE_YEAR;

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

const customPaperTabs = [
  { id: "public", label: "公開題卷" },
  { id: "generate", label: "快速組卷" },
  { id: "ai_search", label: "智慧搜題" },
  { id: "import", label: "匯入題目" },
  { id: "lookup", label: "輸入代碼" }
] as const;

type CustomPaperTab = (typeof customPaperTabs)[number]["id"];

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

function formatDifficultyLabel(difficulty: CustomPaperDifficulty) {
  return difficultyMeta[difficulty]?.label ?? "自訂";
}

export default function CustomPapersPage() {
  const router = useRouter();
  const { session } = useAuth();
  const [tab, setTab] = useState<CustomPaperTab>("public");
  const [selectedSubjects, setSelectedSubjects] = useState<SubjectName[]>([]);
  const [aiSelectedSubjects, setAiSelectedSubjects] = useState<SubjectName[]>([]);
  const [difficulty, setDifficulty] = useState<CustomPaperDifficulty>("hard");
  const [paperName, setPaperName] = useState("");
  const [aiPaperName, setAiPaperName] = useState("");
  const [importPaperName, setImportPaperName] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [aiQuery, setAiQuery] = useState("");
  const [yearFrom, setYearFrom] = useState(MIN_SOURCE_YEAR);
  const [yearTo, setYearTo] = useState(MAX_SOURCE_YEAR);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");
  const [aiSearchPreview, setAiSearchPreview] = useState<CustomPaperSearchPreview | null>(null);
  const [selectedSearchQuestionIds, setSelectedSearchQuestionIds] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);
  const [creatingSearchPaper, setCreatingSearchPaper] = useState(false);
  const [aiSearchError, setAiSearchError] = useState("");
  const [paperCodeInput, setPaperCodeInput] = useState("");
  const [importJsonText, setImportJsonText] = useState("");
  const [importingJson, setImportingJson] = useState(false);
  const [importJsonError, setImportJsonError] = useState("");
  const [importTemplateMessage, setImportTemplateMessage] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const [selectedPaper, setSelectedPaper] = useState<CustomPaperDetail | null>(null);
  const [editingPaperName, setEditingPaperName] = useState("");
  const [editingPaperPublic, setEditingPaperPublic] = useState(false);
  const [updatingPaper, setUpdatingPaper] = useState(false);
  const [updatePaperMessage, setUpdatePaperMessage] = useState("");
  const [updatePaperError, setUpdatePaperError] = useState("");
  const [publicPapers, setPublicPapers] = useState<CustomPaperSummary[]>([]);
  const [publicPaperQuery, setPublicPaperQuery] = useState("");
  const [publicLoading, setPublicLoading] = useState(true);
  const [publicError, setPublicError] = useState("");
  const aiSearchRequestIdRef = useRef(0);
  const aiSearchEligible = useMemo(() => {
    const createdAt = session?.user?.created_at;
    if (!createdAt) return false;
    const createdAtMs = new Date(createdAt).getTime();
    if (Number.isNaN(createdAtMs)) return false;
    return Date.now() - createdAtMs >= 7 * 24 * 60 * 60 * 1000;
  }, [session?.user?.created_at]);

  async function refreshPublicPapers() {
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

  useEffect(() => {
    void refreshPublicPapers();
    // Initial public paper load only; manual retries use the button below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setEditingPaperName(selectedPaper?.name ?? "");
    setEditingPaperPublic(selectedPaper?.isPublic ?? false);
    setUpdatePaperMessage("");
    setUpdatePaperError("");
  }, [selectedPaper?.paperCode, selectedPaper?.name, selectedPaper?.isPublic]);

  const visiblePublicPapers = useMemo(() => {
    const query = publicPaperQuery.trim().toLocaleLowerCase();
    if (!query) return publicPapers;

    return publicPapers.filter((paper) =>
      [paper.paperCode, paper.name ?? "", paper.createdByLabel ?? "", ...paper.subjectLabels]
        .join(" ")
        .toLocaleLowerCase()
        .includes(query)
    );
  }, [publicPaperQuery, publicPapers]);

  function toggleSubject(subject: SubjectName) {
    setSelectedSubjects((current) =>
      current.includes(subject)
        ? current.filter((item) => item !== subject)
        : [...current, subject]
    );
  }

  function toggleAISearchSubject(subject: SubjectName) {
    clearAISearchPreview();
    setAiSelectedSubjects((current) =>
      current.includes(subject)
        ? current.filter((item) => item !== subject)
        : [...current, subject]
    );
  }

  function setAISearchSubjectScope(subjects: SubjectName[]) {
    clearAISearchPreview();
    setAiSelectedSubjects(subjects);
  }

  function handleStartPaper(paper: CustomPaperDetail) {
    const subjectFilters = paper.subjectLabels.filter(Boolean) as SubjectName[];
    const subjectFilter =
      subjectFilters.length === 1 ? subjectFilters[0] : ("全部" as const);

    const settings: QuizSettings = {
      mode: "custom_paper",
      questionCount: paper.questionIds.length,
      excludeAiGenerated: true,
      excludePreviouslyAnswered: false,
      enableConfidenceCalibration: false,
      feedbackMode: "full",
      paperMode: "random_set",
      subjectFilter,
      subjectFilters,
      customQuestionIds: paper.questionIds,
      customQuestionPayload: paper.questions,
      customPoolLabel: `自訂卷：${paper.name || paper.paperCode}`,
      strictCustomQuestionPool: true,
      preserveCustomQuestionOrder: true,
      customPaperCode: paper.paperCode,
      customPaperName: paper.name,
      customPaperDifficulty: paper.difficulty,
      customPaperIsPublic: paper.isPublic
    };

    saveQuizSettings(settings);
    router.push(buildNewQuizHref(settings));
  }

  async function handleGenerate() {
    if (selectedSubjects.length === 0) return;

    try {
      setGenerating(true);
      setGenerateError("");
      const doneQuestionIds = Array.from(
        new Set(
          loadCompletedSessions()
            .filter((sessionItem) => sessionItem.settings?.mode === "custom_paper")
            .flatMap((sessionItem) => sessionItem.attempts.map((attempt) => attempt.questionId))
        )
      );
      const paper = await generateCustomPaper({
        accessToken: session?.access_token ?? null,
        visitorId: getOrCreateVisitorId() ?? "",
        selectedSubjects,
        difficulty,
        name: paperName,
        isPublic,
        doneQuestionIds
      });
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

  function clearAISearchPreview() {
    aiSearchRequestIdRef.current += 1;
    setSearching(false);
    setAiSearchPreview(null);
    setSelectedSearchQuestionIds([]);
    setAiSearchError("");
    setAiPaperName("");
  }

  async function handlePreviewAISearch() {
    if (!aiQuery.trim()) return;
    if (!session?.access_token) {
      setAiSearchError("請先登入帳號，才能使用 AI 智慧檢索。");
      return;
    }
    if (!aiSearchEligible) {
      setAiSearchError("AI 智慧檢索目前只開放給註冊滿 7 天的帳號使用。");
      return;
    }

    const requestId = aiSearchRequestIdRef.current + 1;
    aiSearchRequestIdRef.current = requestId;
    try {
      setSearching(true);
      setAiSearchError("");
      const preview = await previewAISearchCustomPaper({
        accessToken: session?.access_token ?? null,
        visitorId: getOrCreateVisitorId() ?? "",
        selectedSubjects: aiSelectedSubjects,
        query: aiQuery,
        yearFrom,
        yearTo
      });
      if (requestId !== aiSearchRequestIdRef.current) return;
      setAiSearchPreview(preview);
      setSelectedSearchQuestionIds(preview.questions.map((question) => question.id));
      if (!aiPaperName.trim()) {
        setAiPaperName(preview.title);
      }
    } catch (error) {
      if (aiSearchRequestIdRef.current !== requestId) return;
      setAiSearchError(error instanceof Error ? error.message : "AI 搜題預覽失敗");
    } finally {
      if (aiSearchRequestIdRef.current === requestId) {
        setSearching(false);
      }
    }
  }

  async function handleCreateAISearchPaper() {
    if (!aiSearchPreview || selectedSearchQuestionIds.length === 0) return;

    try {
      setCreatingSearchPaper(true);
      setAiSearchError("");
      const paper = await createAISearchCustomPaper({
        accessToken: session?.access_token ?? null,
        visitorId: getOrCreateVisitorId() ?? "",
        questionIds: selectedSearchQuestionIds,
        query: aiSearchPreview.query,
        name: aiPaperName,
        isPublic
      });
      setSelectedPaper(paper);
      setTab("lookup");
      if (paper.isPublic) {
        setPublicPapers((current) => [paper, ...current].slice(0, 30));
      }
    } catch (error) {
      setAiSearchError(error instanceof Error ? error.message : "AI 搜題建卷失敗");
    } finally {
      setCreatingSearchPaper(false);
    }
  }

  async function handleImportJsonPaper() {
    if (!importJsonText.trim()) return;

    try {
      setImportingJson(true);
      setImportJsonError("");
      const paper = await importJsonCustomPaper({
        accessToken: session?.access_token ?? null,
        visitorId: getOrCreateVisitorId() ?? "",
        rawJson: importJsonText,
        name: importPaperName,
        isPublic
      });
      setSelectedPaper(paper);
      setTab("lookup");
      if (paper.isPublic) {
        setPublicPapers((current) => [paper, ...current].slice(0, 30));
      }
    } catch (error) {
      setImportJsonError(error instanceof Error ? error.message : "JSON 自訂卷匯入失敗");
    } finally {
      setImportingJson(false);
    }
  }

  async function handleLookupPaper(code: string) {
    const normalizedCode = code.trim().toUpperCase();
    if (!normalizedCode) return;

    try {
      setLookupLoading(true);
      setLookupError("");
      const paper = await lookupCustomPaper(
        normalizedCode,
        session?.access_token ?? null,
        getOrCreateVisitorId()
      );
      setSelectedPaper(paper);
      setPaperCodeInput(normalizedCode);
      setTab("lookup");
    } catch (error) {
      setLookupError(error instanceof Error ? error.message : "找不到這份自訂卷");
    } finally {
      setLookupLoading(false);
    }
  }

  async function handleCopyImportTemplate() {
    try {
      await navigator.clipboard.writeText(IMPORT_JSON_TEMPLATE);
      setImportTemplateMessage("模板已複製，可以貼給自己的 AI。");
      window.setTimeout(() => setImportTemplateMessage(""), 2200);
    } catch {
      setImportTemplateMessage("目前無法自動複製，請直接手動複製下面模板。");
      window.setTimeout(() => setImportTemplateMessage(""), 2600);
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
      <div>
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {subjects.map((subject) => {
            const active = selectedSubjects.includes(subject.subject);
            return (
              <button
                key={subject.subject}
                type="button"
                onClick={() => toggleSubject(subject.subject)}
                aria-pressed={active}
                className={`min-h-11 rounded-lg border px-3 py-2 text-left transition ${
                  active
                    ? "border-brand-500 bg-brand-50 text-brand-900"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 text-sm font-semibold">
                    {subject.label}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  function renderAISearchSubjectGroup(
    title: string,
    subjects: typeof selectableSubjects
  ) {
    return (
      <div>
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {subjects.map((subject) => {
            const active = aiSelectedSubjects.includes(subject.subject);
            return (
              <button
                key={subject.subject}
                type="button"
                onClick={() => toggleAISearchSubject(subject.subject)}
                aria-pressed={active}
                className={`min-h-11 rounded-lg border px-3 py-2 text-left text-sm font-semibold transition ${
                  active
                    ? "border-brand-500 bg-brand-50 text-brand-900"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                }`}
              >
                {subject.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <main className="shell">
      <section className="surface-card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Custom Papers</p>
            <h1 className="mt-1 text-3xl font-semibold text-ink sm:text-4xl">自訂卷</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/custom-papers/review"
              className="inline-flex min-h-10 items-center justify-center rounded-lg bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-900 transition hover:bg-amber-200"
            >
              錯題庫
            </Link>
            <Link
              href="/"
              className="inline-flex min-h-10 items-center justify-center rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
            >
              返回首頁
            </Link>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 sm:grid-cols-5">
          {customPaperTabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              aria-pressed={tab === item.id}
              className={`min-h-11 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                tab === item.id
                  ? "bg-white text-brand-800 shadow-sm ring-1 ring-slate-200"
                  : "text-slate-600 hover:bg-white/70 hover:text-slate-900"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      {tab === "generate" ? (
        <section className="mt-6 overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-slate-100">
          <div className="border-b border-slate-200 p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">1</span>
                <div>
                  <h2 className="text-lg font-semibold text-ink">選擇科目</h2>
                  <p className="text-sm text-slate-500">已選 {selectedSubjects.length} 科</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setSelectedSubjects(selectableSubjects.map((item) => item.subject))} className="min-h-9 rounded-lg bg-slate-100 px-3 text-xs font-semibold text-slate-700">全選</button>
                <button type="button" onClick={() => setSelectedSubjects(med1Subjects.map((item) => item.subject))} className="min-h-9 rounded-lg bg-slate-100 px-3 text-xs font-semibold text-slate-700">醫學（一）</button>
                <button type="button" onClick={() => setSelectedSubjects(med2Subjects.map((item) => item.subject))} className="min-h-9 rounded-lg bg-slate-100 px-3 text-xs font-semibold text-slate-700">醫學（二）</button>
                <button type="button" onClick={() => setSelectedSubjects([])} className="min-h-9 rounded-lg bg-slate-100 px-3 text-xs font-semibold text-slate-700">清除</button>
              </div>
            </div>
            <div className="mt-5 grid gap-5">
              {renderSubjectGroup("醫學（一）", med1Subjects)}
              {renderSubjectGroup("醫學（二）", med2Subjects)}
            </div>
          </div>

          <div className="grid border-b border-slate-200 lg:grid-cols-[0.8fr_1.2fr]">
            <div className="p-5 sm:p-6 lg:border-r lg:border-slate-200">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">2</span>
                <h2 className="text-lg font-semibold text-ink">選擇難度</h2>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-slate-100 p-1">
                {(["easy", "medium", "hard"] as CustomPaperDifficulty[]).map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setDifficulty(level)}
                    aria-pressed={difficulty === level}
                    className={`min-h-11 rounded-lg text-sm font-semibold transition ${difficulty === level ? "bg-white text-brand-800 shadow-sm" : "text-slate-600"}`}
                  >
                    {difficultyMeta[level].label}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">{difficultyMeta[difficulty].description}</p>
            </div>

            <div className="p-5 sm:p-6">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">3</span>
                <h2 className="text-lg font-semibold text-ink">考卷設定</h2>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
                <label className="text-sm font-semibold text-ink">
                  卷名（可不填）
                  <input value={paperName} onChange={(event) => setPaperName(event.target.value.slice(0, 60))} placeholder="例如：生理衝刺卷" className="mt-2 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-brand-400" />
                </label>
                <button type="button" onClick={() => setIsPublic((current) => !current)} aria-pressed={isPublic} className={`self-end min-h-11 rounded-lg px-4 text-sm font-semibold ${isPublic ? "bg-emerald-100 text-emerald-900" : "bg-slate-100 text-slate-700"}`}>
                  {isPublic ? "公開：開" : "公開：關"}
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 p-5 sm:p-6">
            <p className="text-sm text-slate-600">10 題・{selectedSubjects.length > 0 ? formatSubjectLabels(selectedSubjects) : "尚未選科目"}・優先避開自訂卷已做題</p>
            <button type="button" onClick={() => void handleGenerate()} disabled={generating || selectedSubjects.length === 0} className="min-h-11 rounded-lg bg-brand-600 px-5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300">
              {generating ? "產卷中..." : "建立 10 題自訂卷"}
            </button>
            {generateError ? <div className="w-full rounded-lg bg-rose-50 p-4 text-sm text-rose-900">{generateError}</div> : null}
          </div>
        </section>
      ) : tab === "ai_search" ? (
        <section className="mt-6 rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100 sm:p-8">
          <div className="grid gap-6">
            <div className="rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-100">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-ink">搜尋題目</h2>
                  <p className="mt-2 text-sm text-slate-600">輸入章節、疾病、機轉或關鍵字。</p>
                </div>
                <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                  {aiSelectedSubjects.length > 0 ? `${aiSelectedSubjects.length} 科` : "全部科目"}・{yearFrom}–{yearTo}
                </span>
              </div>
              <textarea
                value={aiQuery}
                onChange={(event) => {
                  setAiQuery(event.target.value.slice(0, 200));
                  clearAISearchPreview();
                }}
                placeholder="例如：腎小管酸鹼平衡、brachial plexus、類固醇生成、血液氣體運輸"
                className="mt-4 min-h-24 w-full rounded-xl border border-slate-200 bg-white p-4 text-sm leading-7 text-slate-800 outline-none focus:border-brand-400"
              />
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-slate-500">需登入且帳號註冊滿 7 天。</p>
                <button
                  type="button"
                  onClick={() => void handlePreviewAISearch()}
                  disabled={searching || !aiQuery.trim() || !session?.access_token || !aiSearchEligible}
                  className="min-h-11 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {searching ? "搜尋中..." : aiSearchPreview ? "重新搜尋" : "預覽搜尋結果"}
                </button>
              </div>
            </div>

            <div className="rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-100">
              <div className="grid gap-4 lg:grid-cols-[auto_1fr] lg:items-end">
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-sm font-semibold text-ink">
                    起始年份
                    <select
                      value={yearFrom}
                      onChange={(event) => {
                        const next = Number(event.target.value);
                        setYearFrom(next);
                        if (next > yearTo) setYearTo(next);
                        clearAISearchPreview();
                      }}
                      className="mt-2 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none"
                    >
                      {allSourceYears.map((year) => <option key={year} value={year}>{year}</option>)}
                    </select>
                  </label>
                  <label className="text-sm font-semibold text-ink">
                    結束年份
                    <select
                      value={yearTo}
                      onChange={(event) => {
                        const next = Number(event.target.value);
                        setYearTo(next);
                        if (next < yearFrom) setYearFrom(next);
                        clearAISearchPreview();
                      }}
                      className="mt-2 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none"
                    >
                      {allSourceYears.map((year) => <option key={year} value={year}>{year}</option>)}
                    </select>
                  </label>
                </div>
                <div className="flex flex-wrap gap-2 lg:justify-end">
                  <button
                    type="button"
                    onClick={() => setAISearchSubjectScope([])}
                    className={`min-h-11 rounded-lg px-4 text-sm font-semibold ${aiSelectedSubjects.length === 0 ? "bg-slate-900 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"}`}
                  >
                    全部科目
                  </button>
                  <button
                    type="button"
                    onClick={() => setAISearchSubjectScope(med1Subjects.map((item) => item.subject))}
                    className="min-h-11 rounded-lg bg-white px-4 text-sm font-semibold text-slate-700 ring-1 ring-slate-200"
                  >
                    醫學（一）
                  </button>
                  <button
                    type="button"
                    onClick={() => setAISearchSubjectScope(med2Subjects.map((item) => item.subject))}
                    className="min-h-11 rounded-lg bg-white px-4 text-sm font-semibold text-slate-700 ring-1 ring-slate-200"
                  >
                    醫學（二）
                  </button>
                </div>
              </div>
              <div className="mt-5 grid gap-5">
                {renderAISearchSubjectGroup("醫學（一）", med1Subjects)}
                {renderAISearchSubjectGroup("醫學（二）", med2Subjects)}
              </div>
            </div>

            {aiSearchPreview ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-ink">{aiSearchPreview.title}</h2>
                    {aiSearchPreview.reason ? <p className="mt-1 text-sm text-slate-600">{aiSearchPreview.reason}</p> : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-700">已選 {selectedSearchQuestionIds.length} / {aiSearchPreview.questions.length} 題</span>
                    <button type="button" onClick={() => setSelectedSearchQuestionIds(aiSearchPreview.questions.map((question) => question.id))} className="min-h-9 rounded-lg bg-slate-100 px-3 text-xs font-semibold text-slate-700">全選</button>
                    <button type="button" onClick={() => setSelectedSearchQuestionIds([])} className="min-h-9 rounded-lg bg-slate-100 px-3 text-xs font-semibold text-slate-700">清除</button>
                  </div>
                </div>

                <div className="mt-4 max-h-[34rem] overflow-y-auto border-y border-slate-200">
                  {aiSearchPreview.questions.map((question) => {
                    const active = selectedSearchQuestionIds.includes(question.id);
                    return (
                      <button
                        key={question.id}
                        type="button"
                        onClick={() => setSelectedSearchQuestionIds((current) => active ? current.filter((id) => id !== question.id) : [...current, question.id])}
                        aria-pressed={active}
                        className="flex w-full items-start gap-3 border-b border-slate-100 px-1 py-4 text-left last:border-b-0"
                      >
                        <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs font-bold ${active ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300 bg-white text-transparent"}`}>✓</span>
                        <span className="min-w-0">
                          <span className="block text-xs font-semibold text-slate-500">
                            {question.subject}・{question.chapter || question.section || "未分類"}
                            {question.sourceYear ? `・${question.sourceYear} 第${question.sourceRound ?? 1}次 Q${question.originalQuestionNumber ?? ""}` : ""}
                          </span>
                          <span className="mt-1 block text-sm leading-6 text-ink">{question.stem}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_auto_auto] lg:items-end">
                  <label className="text-sm font-semibold text-ink">
                    卷名
                    <input value={aiPaperName} onChange={(event) => setAiPaperName(event.target.value.slice(0, 60))} className="mt-2 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none" />
                  </label>
                  <button type="button" onClick={() => setIsPublic((current) => !current)} className={`min-h-11 rounded-lg px-4 text-sm font-semibold ${isPublic ? "bg-emerald-100 text-emerald-900" : "bg-slate-100 text-slate-700"}`}>
                    {isPublic ? "公開：開" : "公開：關"}
                  </button>
                  <button type="button" onClick={() => void handleCreateAISearchPaper()} disabled={creatingSearchPaper || selectedSearchQuestionIds.length === 0} className="min-h-11 rounded-lg bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300">
                    {creatingSearchPaper ? "建卷中..." : `建立 ${selectedSearchQuestionIds.length} 題自訂卷`}
                  </button>
                </div>
              </div>
            ) : null}

            {aiSearchError ? <div className="rounded-xl bg-rose-50 p-4 text-sm text-rose-900">{aiSearchError}</div> : null}
          </div>
        </section>
      ) : tab === "import" ? (
        <section className="mt-6 rounded-2xl bg-white p-5 shadow-card ring-1 ring-slate-100 sm:p-6">
          <div className="grid gap-6">
            <div>
              <div className="mb-5">
                <h2 className="text-lg font-semibold text-ink">匯入 JSON 題目</h2>
                <p className="mt-1 text-sm text-slate-600">貼上完整 JSON，確認卷名與公開設定後建立考卷。</p>
              </div>
              <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                <div>
                  <label className="text-sm font-semibold text-ink">這份卷的名稱（可不填）</label>
                  <input
                    value={importPaperName}
                    onChange={(event) => setImportPaperName(event.target.value.slice(0, 60))}
                    placeholder="例如：剛學完 brachial plexus 的整理卷"
                    className="mt-2 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-brand-400"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => setIsPublic((current) => !current)}
                    className={`min-h-11 w-full rounded-lg px-4 text-sm font-semibold transition ${
                      isPublic
                        ? "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-300"
                        : "bg-white text-slate-800 ring-1 ring-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {isPublic ? "公開這份卷：開" : "公開這份卷：關"}
                  </button>
                </div>
              </div>

              <label className="mt-4 block text-sm font-semibold text-ink">把 AI 輸出的 JSON 貼在這裡</label>
              <textarea
                value={importJsonText}
                onChange={(event) => setImportJsonText(event.target.value)}
                placeholder='貼上像 [{"subject":"解剖學", ...}] 這種完整 JSON'
                className="mt-2 min-h-[18rem] w-full rounded-lg border border-slate-200 bg-slate-50 p-4 font-mono text-xs leading-6 text-slate-800 outline-none focus:border-brand-400 sm:text-sm"
              />

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-slate-600">
                  匯入後會直接生成一張自訂卷；之後一樣可以分享考卷碼、公開給大家做，或再改卷名與公開設定。
                </p>
                <button
                  type="button"
                  onClick={() => void handleImportJsonPaper()}
                  disabled={importingJson || !importJsonText.trim()}
                  className="min-h-11 rounded-lg bg-brand-600 px-5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {importingJson ? "匯入中..." : "把這段 JSON 變成一張卷"}
                </button>
              </div>

              {importJsonError ? (
                <div className="mt-4 rounded-2xl bg-rose-50 p-4 text-sm text-rose-900">{importJsonError}</div>
              ) : null}
            </div>

            <div className="border-t border-slate-200 pt-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-ink">需要 JSON 模板？</h2>
                  <p className="mt-1 text-sm text-slate-600">複製後貼給你的 AI，再把輸出的 JSON 貼回上方。</p>
                </div>
                <button type="button" onClick={() => void handleCopyImportTemplate()} className="min-h-10 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800">
                  複製給 AI 的模板
                </button>
              </div>
              {importTemplateMessage ? <div className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{importTemplateMessage}</div> : null}
              <details className="mt-4 rounded-lg bg-slate-50 ring-1 ring-slate-200">
                <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-700">查看完整模板</summary>
                <pre className="max-h-[28rem] overflow-auto border-t border-slate-200 p-4 text-xs leading-6 text-slate-700">{IMPORT_JSON_TEMPLATE}</pre>
              </details>
            </div>
          </div>
        </section>
      ) : tab === "lookup" ? (
        <section className="mt-6 rounded-2xl bg-white p-5 shadow-card ring-1 ring-slate-100 sm:p-6">
          <div className="mx-auto max-w-2xl">
            <h2 className="text-xl font-semibold text-ink">輸入題卷代碼</h2>
            <label className="mt-4 block text-sm font-semibold text-ink">五碼代碼</label>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              <input
                value={paperCodeInput}
                onChange={(event) => setPaperCodeInput(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5))}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && paperCodeInput.trim().length === 5 && !lookupLoading) {
                    void handleLookupPaper(paperCodeInput);
                  }
                }}
                placeholder="例如 A7K9Q"
                className="min-h-11 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-4 text-sm font-semibold uppercase tracking-[0.18em] text-slate-800 outline-none focus:border-brand-400"
              />
              <button
                type="button"
                onClick={() => void handleLookupPaper(paperCodeInput)}
                disabled={lookupLoading || paperCodeInput.trim().length !== 5}
                className="min-h-11 rounded-lg bg-brand-600 px-5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
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
        <section className="mt-6 rounded-2xl bg-white p-5 shadow-card ring-1 ring-slate-100 sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-ink">公開題卷</h2>
              <p className="mt-1 text-sm text-slate-500">最新 {publicPapers.length} 份</p>
            </div>
            <label className="w-full sm:w-72">
              <span className="sr-only">搜尋公開題卷</span>
              <input value={publicPaperQuery} onChange={(event) => setPublicPaperQuery(event.target.value.slice(0, 60))} placeholder="搜尋卷名、代碼或科目" className="min-h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-brand-400" />
            </label>
          </div>

          <div className="mt-4 grid gap-3">
            {publicLoading ? (
              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">正在載入公開卷...</div>
            ) : publicError ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-rose-50 p-4 text-sm text-rose-900">
                <span>{publicError}</span>
                <button type="button" onClick={() => void refreshPublicPapers()} className="min-h-9 rounded-lg bg-white px-3 text-xs font-semibold text-rose-900 ring-1 ring-rose-200">
                  重新載入
                </button>
              </div>
            ) : visiblePublicPapers.length === 0 ? (
              <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">{publicPaperQuery.trim() ? "找不到符合的公開卷。" : "目前還沒有公開卷。"}</div>
            ) : (
              visiblePublicPapers.map((paper) => (
                <button
                  key={paper.paperCode}
                  type="button"
                  onClick={() => void handleLookupPaper(paper.paperCode)}
                  className="rounded-lg border border-slate-200 bg-white p-4 text-left transition hover:border-brand-300 hover:bg-brand-50/30"
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
                        {formatSubjectLabels(paper.subjectLabels)} ・ {formatDifficultyLabel(paper.difficulty)} ・ {paper.questionCount} 題
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

      {tab === "lookup" && selectedPaper ? (
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
                {formatSubjectLabels(selectedPaper.subjectLabels)} ・ {formatDifficultyLabel(selectedPaper.difficulty)} ・ {selectedPaper.questionCount} 題
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
              className="min-h-11 rounded-lg bg-brand-600 px-5 text-sm font-semibold text-white transition hover:bg-brand-700"
            >
              開始寫這份 {selectedPaper.questionCount} 題自訂卷
            </button>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(selectedPaper.paperCode)}
              className="min-h-11 rounded-lg bg-slate-100 px-5 text-sm font-semibold text-slate-800 transition hover:bg-slate-200"
            >
              複製考卷碼
            </button>
          </div>

          {selectedPaper.canEdit ? <div className="mt-6 rounded-xl bg-slate-50 p-5 ring-1 ring-slate-100">
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
          </div> : null}

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

    </main>
  );
}
