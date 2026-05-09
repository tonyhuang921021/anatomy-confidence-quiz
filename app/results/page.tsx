"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AIAnalysisPanel } from "@/components/AIAnalysisPanel";
import { AIPromptBox } from "@/components/AIPromptBox";
import { ResultSummary } from "@/components/ResultSummary";
import { WeaknessRanking } from "@/components/WeaknessRanking";
import { anatomyQuestions } from "@/data/anatomyQuestions";
import {
  calculateCompletionStats,
  calculateSectionStats,
  calculateSummary,
  DEFAULT_QUIZ_SETTINGS,
  getModeLabel,
  generateAIPrompt,
  getLowCompletionSections,
  getReviewQuestionItems,
  getTopWeakSections,
  getUnstableCompletedSections
} from "@/lib/quizAnalysis";
import {
  clearCurrentSession,
  loadCompletedSessions,
  loadCurrentSession,
  saveQuizSettings
} from "@/lib/storage";
import { QuizSession, SectionCompletionStats, SectionStats, SummaryStats } from "@/types/quiz";

type ResultState = {
  session: QuizSession | null;
  sessions: QuizSession[];
  summary: SummaryStats | null;
  sectionStats: SectionStats[];
  promptText: string;
  lowCompletion: SectionCompletionStats[];
  unstableSections: SectionCompletionStats[];
  completionStats: ReturnType<typeof calculateCompletionStats> | null;
  newCompletedSections: SectionCompletionStats[];
};

export default function ResultsPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [aiError, setAiError] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiModel, setAiModel] = useState("");
  const [state, setState] = useState<ResultState>({
    session: null,
    sessions: [],
    summary: null,
    sectionStats: [],
    promptText: "",
    lowCompletion: [],
    unstableSections: [],
    completionStats: null,
    newCompletedSections: []
  });

  useEffect(() => {
    const currentSession = loadCurrentSession();
    if (!currentSession?.completedAt) {
      setMounted(true);
      return;
    }

    const completedSessions = loadCompletedSessions();
    const currentQuestions = [
      ...anatomyQuestions,
      ...(currentSession.generatedQuestions ?? [])
    ];
    const completionStats = calculateCompletionStats(anatomyQuestions, completedSessions);
    const sessionSectionStats = calculateSectionStats(currentSession.attempts, currentQuestions);
    const previousSessions = completedSessions.filter((session) => session.id !== currentSession.id);
    const previousCompletion = calculateCompletionStats(anatomyQuestions, previousSessions);
    const newCompletedSections = completionStats.sections.filter((section) => {
      const before = previousCompletion.sections.find(
        (item) => item.chapter === section.chapter && item.section === section.section
      );
      return (before?.completionRate ?? 0) === 0 && section.completionRate > 0;
    });

    setState({
      session: currentSession,
      sessions: completedSessions,
      summary: calculateSummary(currentSession.attempts, currentQuestions),
      sectionStats: sessionSectionStats,
      promptText: generateAIPrompt(currentSession.attempts, currentQuestions, completedSessions),
      lowCompletion: getLowCompletionSections(completionStats.sections, 5),
      unstableSections: getUnstableCompletedSections(completionStats.sections, 5),
      completionStats,
      newCompletedSections
    });
    setMounted(true);
  }, []);

  function handleRestart() {
    clearCurrentSession();
    saveQuizSettings(DEFAULT_QUIZ_SETTINGS);
    router.push("/quiz");
  }

  async function handleGenerateAIAnalysis() {
    if (!state.session) return;
    setAiLoading(true);
    setAiError("");

    try {
      const response = await fetch("/api/ai-analysis", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          attempts: state.session.attempts,
          sessions: state.sessions,
          prompt: state.promptText
        })
      });

      const payload = (await response.json()) as {
        ok: boolean;
        analysis?: string;
        model?: string;
        message?: string;
      };

      if (!response.ok || !payload.ok) {
        setAiError(payload.message || "AI 分析失敗。若未設定 OPENAI_API_KEY，請先使用下方 prompt。");
        setAiAnalysis("");
        setAiModel("");
        return;
      }

      setAiAnalysis(payload.analysis || "");
      setAiModel(payload.model || "");
    } catch {
      setAiError("無法連線到 AI 分析 API。");
      setAiAnalysis("");
      setAiModel("");
    } finally {
      setAiLoading(false);
    }
  }

  if (!mounted) {
    return (
      <main className="shell">
        <div className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100">載入中...</div>
      </main>
    );
  }

  if (!state.session || !state.summary || !state.completionStats) {
    return (
      <main className="shell">
        <section className="rounded-[2rem] bg-white p-8 text-center shadow-card ring-1 ring-slate-100">
          <h1 className="text-2xl font-semibold text-ink">目前沒有可顯示的結果</h1>
          <p className="mt-3 text-slate-500">可能尚未完成本輪測驗，或已清除 current session。</p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/"
              className="min-h-12 rounded-2xl bg-slate-100 px-5 py-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-200"
            >
              返回首頁
            </Link>
            <Link
              href="/quiz"
              className="min-h-12 rounded-2xl bg-brand-600 px-5 py-4 text-sm font-semibold text-white transition hover:bg-brand-700"
            >
              開始測驗
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const topWeakSections = getTopWeakSections(state.sectionStats, 3);

  return (
    <main className="shell">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">Results</p>
          <h1 className="mt-2 text-3xl font-bold text-ink sm:text-4xl">本輪解剖學弱點分析</h1>
          <p className="mt-2 text-sm text-slate-500">
            本輪模式：{getModeLabel(state.session.settings?.mode ?? "weakness")}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/progress"
            className="min-h-12 rounded-2xl bg-slate-100 px-5 py-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-200"
          >
            進度總覽
          </Link>
          <button
            type="button"
            onClick={handleRestart}
            className="min-h-12 rounded-2xl bg-brand-600 px-5 py-4 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            重新開始
          </button>
        </div>
      </div>

      <div className="mt-6">
        <ResultSummary summary={state.summary} />
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <WeaknessRanking sections={topWeakSections} />

          <section className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100">
            <h2 className="text-xl font-semibold text-ink">完成度更新</h2>
            <div className="mt-5 grid gap-6 lg:grid-cols-3">
              <div className="rounded-3xl bg-slate-50 p-5">
                <h3 className="text-base font-semibold text-ink">本輪新增完成的小節</h3>
                <div className="mt-3 grid gap-2 text-sm text-slate-600">
                  {state.newCompletedSections.length === 0 ? (
                    <p>這輪沒有新的 section 從 0 前進到已作答。</p>
                  ) : (
                    state.newCompletedSections.map((section) => (
                      <p key={`${section.chapter}-${section.section}`}>
                        {section.chapter} / {section.section}
                      </p>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-3xl bg-slate-50 p-5">
                <h3 className="text-base font-semibold text-ink">最需要補進度的 section</h3>
                <div className="mt-3 grid gap-3">
                  {state.lowCompletion.map((section) => (
                    <div key={`${section.chapter}-${section.section}`} className="rounded-2xl bg-white p-4 text-sm text-slate-700">
                      <p className="font-semibold">{section.section}</p>
                      <p className="mt-1 text-slate-500">{section.chapter}</p>
                      <p className="mt-2">completionRate {section.completionRate}%</p>
                      <p>masteryScore {section.masteryScore}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl bg-slate-50 p-5">
                <h3 className="text-base font-semibold text-ink">已完成但不穩</h3>
                <div className="mt-3 grid gap-3">
                  {state.unstableSections.length === 0 ? (
                    <p className="text-sm text-slate-600">目前沒有 completionRate 高但 masteryScore 低的小節。</p>
                  ) : (
                    state.unstableSections.map((section) => (
                      <div key={`${section.chapter}-${section.section}`} className="rounded-2xl bg-white p-4 text-sm text-slate-700">
                        <p className="font-semibold">{section.section}</p>
                        <p className="mt-1 text-slate-500">{section.chapter}</p>
                        <p className="mt-2">completionRate {section.completionRate}%</p>
                        <p>masteryScore {section.masteryScore}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </section>

          <AIAnalysisPanel
            analysis={aiAnalysis}
            model={aiModel}
            error={aiError}
            loading={aiLoading}
            onGenerate={handleGenerateAIAnalysis}
          />

          {showPrompt ? <AIPromptBox promptText={state.promptText} /> : null}
        </div>

        <aside className="space-y-6">
          <section className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100">
            <h2 className="text-xl font-semibold text-ink">補強建議</h2>
            <div className="mt-4 grid gap-3">
              <div className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-900">
                最需要補弱的小節：{topWeakSections.map((section) => section.section).join("、") || "目前無資料"}
              </div>
              <div className="rounded-2xl bg-sky-50 p-4 text-sm text-sky-900">
                最需要補進度：{state.lowCompletion.map((section) => section.section).join("、") || "目前無資料"}
              </div>
              <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
                已完成但不穩：{state.unstableSections.map((section) => section.section).join("、") || "目前無資料"}
              </div>
            </div>
            <div className="mt-5 grid gap-3">
              <Link
                href="/quiz"
                onClick={() => saveQuizSettings(DEFAULT_QUIZ_SETTINGS)}
                className="min-h-12 rounded-2xl bg-brand-600 px-4 py-4 text-center text-sm font-semibold text-white transition hover:bg-brand-700"
              >
                再刷本地題庫 10 題
              </Link>
              <Link
                href="/review"
                onClick={() =>
                  saveQuizSettings({ ...DEFAULT_QUIZ_SETTINGS, mode: "review", questionCount: 10 })
                }
                className="min-h-12 rounded-2xl bg-slate-100 px-4 py-4 text-center text-sm font-semibold text-slate-800 transition hover:bg-slate-200"
              >
                先看錯題複習頁
              </Link>
            </div>
            <button
              type="button"
              onClick={() => setShowPrompt(true)}
              className="mt-5 min-h-12 w-full rounded-2xl bg-ink px-4 py-4 text-sm font-semibold text-white transition hover:bg-slate-900"
            >
              產生 AI 補弱 Prompt
            </button>
          </section>

          <section className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100">
            <h2 className="text-xl font-semibold text-ink">歷史完成度摘要</h2>
            <div className="mt-4 grid gap-3">
              <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                整體 completionRate <span className="font-semibold">{state.completionStats.overall.completionRate}%</span>
              </p>
              <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                整體 masteryScore <span className="font-semibold">{state.completionStats.overall.masteryScore}</span>
              </p>
              <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                已作答不重複題數 <span className="font-semibold">{state.completionStats.overall.attemptedQuestions}</span>
              </p>
              <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                錯題複習池 <span className="font-semibold">{getReviewQuestionItems(anatomyQuestions, loadCompletedSessions(), 999).length}</span>
              </p>
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}
