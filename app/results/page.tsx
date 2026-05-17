"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AIPromptBox } from "@/components/AIPromptBox";
import { useAuth } from "@/components/AuthProvider";
import { ResultSummary } from "@/components/ResultSummary";
import { WeaknessRanking } from "@/components/WeaknessRanking";
import { loadQuestionCommunityStats } from "@/lib/cloudSync";
import { anatomyQuestions } from "@/data/anatomyQuestions";
import { subjectRegistry } from "@/data/subjectRegistry";
import {
  calculateCompletionStats,
  calculateSectionStats,
  calculateSummary,
  DEFAULT_QUIZ_SETTINGS,
  generateAIPrompt,
  getModeLabel,
  getLowCompletionSections,
  getTopWeakSections,
  getUnstableCompletedSections
} from "@/lib/quizAnalysis";
import {
  applyQuestionExplanationOverride,
  clearCurrentSession,
  loadCompletedSessions,
  loadCurrentSession,
  loadQuestionExplanationOverrides,
  saveQuestionExplanationOverride,
  saveQuizSettings
} from "@/lib/storage";
import {
  Attempt,
  OptionKey,
  Question,
  QuestionCommunityStats,
  QuestionExplanationOverride,
  QuizSession,
  SectionCompletionStats,
  SectionStats,
  SummaryStats
} from "@/types/quiz";
import { getOrCreateVisitorId } from "@/lib/visitor";

const allQuestions = Array.from(
  new Map(
    Object.values(subjectRegistry)
      .filter((subject) => subject.subject !== "醫學（一）" && subject.subject !== "醫學（二）")
      .flatMap((subject) => subject.questions.map((question) => [question.id, question] as const))
  ).values()
);

const optionKeys: OptionKey[] = ["A", "B", "C", "D", "E"];

function getQuestionMap(session: QuizSession) {
  return new Map(
    [...allQuestions, ...(session.generatedQuestions ?? [])].map((question) => [
      question.id,
      applyQuestionExplanationOverride(question)
    ] as const)
  );
}

function getAvailableOptionKeys(question: Question) {
  return optionKeys.filter((key) => typeof question.options[key] === "string");
}

type ResultState = {
  session: QuizSession | null;
  sessions: QuizSession[];
  summary: SummaryStats | null;
  sectionStats: SectionStats[];
  promptText: string;
  lowCompletion: SectionCompletionStats[];
  unstableSections: SectionCompletionStats[];
  completionStats: ReturnType<typeof calculateCompletionStats> | null;
};

export default function ResultsPage() {
  const router = useRouter();
  const { syncVersion, session } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [communityStatsMap, setCommunityStatsMap] = useState<Map<string, QuestionCommunityStats>>(new Map());
  const [explanationOverrides, setExplanationOverrides] = useState<Record<string, QuestionExplanationOverride>>({});
  const [explanationLoadingMap, setExplanationLoadingMap] = useState<Record<string, boolean>>({});
  const [explanationErrorMap, setExplanationErrorMap] = useState<Record<string, string>>({});
  const [showPrompt, setShowPrompt] = useState(false);
  const [state, setState] = useState<ResultState>({
    session: null,
    sessions: [],
    summary: null,
    sectionStats: [],
    promptText: "",
    lowCompletion: [],
    unstableSections: [],
    completionStats: null
  });

  useEffect(() => {
    const currentSession = loadCurrentSession();
    if (!currentSession?.completedAt) {
      setMounted(true);
      return;
    }

    const completedSessions = loadCompletedSessions();
    const currentQuestions =
      currentSession.generatedQuestions && currentSession.generatedQuestions.length > 0
        ? currentSession.generatedQuestions
        : anatomyQuestions;
    const completionStats = calculateCompletionStats(anatomyQuestions, completedSessions);
    const sessionSectionStats = calculateSectionStats(currentSession.attempts, currentQuestions);

    setState({
      session: currentSession,
      sessions: completedSessions,
      summary: calculateSummary(currentSession.attempts, currentQuestions),
      sectionStats: sessionSectionStats,
      promptText: generateAIPrompt(currentSession.attempts, currentQuestions, completedSessions),
      lowCompletion: getLowCompletionSections(completionStats.sections, 5),
      unstableSections: getUnstableCompletedSections(completionStats.sections, 5),
      completionStats
    });
    setMounted(true);
  }, [syncVersion]);

  useEffect(() => {
    setExplanationOverrides(loadQuestionExplanationOverrides());
  }, [syncVersion]);

  useEffect(() => {
    async function fetchCommunityStats() {
      if (!state.session?.attempts.length) {
        setCommunityStatsMap(new Map());
        return;
      }

      try {
        const stats = await loadQuestionCommunityStats(
          state.session.attempts.map((attempt) => attempt.questionId)
        );
        setCommunityStatsMap(new Map(stats.map((item) => [item.questionId, item] as const)));
      } catch {
        setCommunityStatsMap(new Map());
      }
    }

    void fetchCommunityStats();
  }, [state.session]);

  function handleRestart() {
    clearCurrentSession();
    saveQuizSettings(DEFAULT_QUIZ_SETTINGS);
    router.push("/quiz?new=1");
  }

  async function handleGenerateQuestionExplanation(question: Question, attempt: Attempt) {
    setExplanationLoadingMap((current) => ({ ...current, [question.id]: true }));
    setExplanationErrorMap((current) => ({ ...current, [question.id]: "" }));

    try {
      const response = await fetch("/api/question-explanation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          visitorId: getOrCreateVisitorId(),
          accessToken: session?.access_token ?? null,
          question: {
            id: question.id,
            subject: question.subject,
            chapter: question.chapter,
            section: question.section,
            stem: question.stem,
            options: question.options,
            answer: question.answer,
            explanation: question.explanation,
            testedConcept: question.testedConcept
          },
          attempt: {
            selectedAnswer: attempt.selectedAnswer,
            confidence: attempt.confidence,
            isCorrect: attempt.isCorrect
          }
        })
      });

      const payload = (await response.json()) as {
        ok: boolean;
        explanation?: string;
        optionAnalysis?: Partial<Record<OptionKey, string>>;
        memoryTip?: string;
        model?: string;
        message?: string;
      };

      if (!response.ok || !payload.ok || !payload.explanation) {
        setExplanationErrorMap((current) => ({
          ...current,
          [question.id]: payload.message || "GPT-5-mini 詳解產生失敗。"
        }));
        return;
      }

      const override: QuestionExplanationOverride = {
        explanation: payload.explanation ?? "",
        optionAnalysis: payload.optionAnalysis ?? {},
        memoryTip: payload.memoryTip ?? "",
        model: payload.model ?? "gpt-5-mini",
        updatedAt: new Date().toISOString()
      };

      saveQuestionExplanationOverride(question.id, override);
      setExplanationOverrides((current) => ({
        ...current,
        [question.id]: override
      }));
    } catch {
      setExplanationErrorMap((current) => ({
        ...current,
        [question.id]: "無法連線到 GPT-5-mini 詳解 API。"
      }));
    } finally {
      setExplanationLoadingMap((current) => ({ ...current, [question.id]: false }));
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
  const questionMap = getQuestionMap(state.session);
  const reviewedAttempts = state.session.attempts
    .map((attempt) => ({
      attempt,
      question: questionMap.get(attempt.questionId)
    }))
    .filter((item): item is { attempt: Attempt; question: Question } => Boolean(item.question));
  const wrongAttempts = reviewedAttempts.filter((item) => !item.attempt.isCorrect);
  const wrongAttemptIds = new Set(wrongAttempts.map((item) => item.attempt.questionId));
  const lowConfidenceAttempts = reviewedAttempts
    .filter((item) => item.attempt.confidence <= 3 && !wrongAttemptIds.has(item.attempt.questionId))
    .sort((a, b) => {
      if (a.attempt.confidence !== b.attempt.confidence) {
        return a.attempt.confidence - b.attempt.confidence;
      }
      return a.question.chapter.localeCompare(b.question.chapter) || a.question.section.localeCompare(b.question.section);
    });

  function renderCommunityStats(questionId: string) {
    const stats = communityStatsMap.get(questionId);
    if (!stats || stats.totalAttempts === 0) return null;

    return (
      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
        全站答對率 {stats.correctRate}% ・ {stats.totalAttempts} 人作答
      </span>
    );
  }

  function renderQuestionExplanationControls(question: Question, attempt: Attempt) {
    const generated = explanationOverrides[question.id];
    const loading = explanationLoadingMap[question.id];
    const error = explanationErrorMap[question.id];

    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          {!generated ? (
            <button
              type="button"
              onClick={() => void handleGenerateQuestionExplanation(question, attempt)}
              disabled={loading}
              className="min-h-10 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-wait disabled:opacity-60"
            >
              {loading ? "GPT-5-mini 生成中..." : "用 GPT-5-mini 補詳解"}
            </button>
          ) : null}
          {generated ? (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              已替換詳解・{generated.model ?? "gpt-5-mini"}
            </span>
          ) : null}
        </div>
        {error ? <p className="text-sm font-medium text-rose-700">{error}</p> : null}
      </div>
    );
  }

  function renderOptionAnalysis(question: Question) {
    if (!question.optionAnalysis || Object.keys(question.optionAnalysis).length === 0) return null;

    return (
      <div className="grid gap-3">
        {getAvailableOptionKeys(question).map((key) => {
          const text = question.optionAnalysis?.[key];
          if (!text) return null;

          return (
            <div key={`${question.id}-option-analysis-${key}`} className="rounded-2xl bg-white p-4">
              <p className="font-semibold text-slate-900">{key} 選項解析</p>
              <p className="mt-1 leading-7 text-slate-700">{text}</p>
            </div>
          );
        })}
      </div>
    );
  }

  function renderExplanationFooter(question: Question, attempt: Attempt) {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {renderCommunityStats(question.id)}
          {explanationOverrides[question.id] ? (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              已替換詳解・{explanationOverrides[question.id]?.model ?? "gpt-5-mini"}
            </span>
          ) : null}
        </div>
        {renderQuestionExplanationControls(question, attempt)}
      </div>
    );
  }

  return (
    <main className="shell">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">Results</p>
          <h1 className="mt-2 text-3xl font-bold text-ink sm:text-4xl">
            本輪{state.session.subject}結果分析
          </h1>
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
          <section className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-ink">題目回顧</h2>
                <p className="mt-2 text-sm text-slate-500">先看錯題，再往下展開全部題目做完整複盤。</p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs font-semibold">
                <span className="rounded-full bg-rose-100 px-3 py-1 text-rose-900">錯題 {wrongAttempts.length}</span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">全部 {reviewedAttempts.length}</span>
              </div>
            </div>

            <div className="mt-5 space-y-6">
              <div>
                <h3 className="text-base font-semibold text-ink">錯題回顧</h3>
                <div className="mt-3 grid gap-3">
                  {wrongAttempts.length === 0 ? (
                    <div className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900">
                      這輪沒有錯題，可以直接展開下方全部題目回顧。
                    </div>
                  ) : (
                    wrongAttempts.map(({ attempt, question }, index) => (
                      <details key={`wrong-${attempt.questionId}`} className="rounded-2xl bg-rose-50 p-4">
                        <summary className="cursor-pointer text-sm font-semibold text-rose-950">
                          <span>
                            錯題 {index + 1}：{question.chapter} / {question.section} / {question.testedConcept}
                          </span>
                        </summary>
                        <div className="mt-4 space-y-3 text-sm leading-7 text-slate-700">
                          <p className="font-semibold text-slate-900">{question.stem}</p>
                          <div className="grid gap-3">
                            {getAvailableOptionKeys(question).map((key) => (
                              <div key={`${question.id}-${key}`} className="rounded-2xl bg-white p-4">
                                <p className="font-semibold text-slate-900">
                                  {key}. {question.options[key]}
                                </p>
                              </div>
                            ))}
                          </div>
                          <p>
                            <span className="font-semibold">我的答案：</span>
                            {attempt.selectedAnswer}
                          </p>
                          <p>
                            <span className="font-semibold">正確答案：</span>
                            {question.acceptedAnswers?.length && question.answerCreditType === "multiple_accepted"
                              ? question.acceptedAnswers.join(" / ")
                              : attempt.correctAnswer}
                          </p>
                          <p>
                            <span className="font-semibold">信心：</span>
                            {attempt.confidence}
                          </p>
                          {attempt.errorType ? (
                            <p>
                              <span className="font-semibold">錯因：</span>
                              {attempt.errorType}
                            </p>
                          ) : null}
                          <p>
                            <span className="font-semibold">詳解：</span>
                            {question.explanation}
                          </p>
                          {renderOptionAnalysis(question)}
                          {question.memoryTip ? (
                            <p>
                              <span className="font-semibold">快速記憶法：</span>
                              {question.memoryTip}
                            </p>
                          ) : null}
                          {renderExplanationFooter(question, attempt)}
                        </div>
                      </details>
                    ))
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-base font-semibold text-ink">沒信心題目回顧</h3>
                <div className="mt-3 grid gap-3">
                  {lowConfidenceAttempts.length === 0 ? (
                    <div className="rounded-2xl bg-sky-50 p-4 text-sm text-sky-900">
                      這輪沒有標記為低信心的題目。
                    </div>
                  ) : (
                    lowConfidenceAttempts.map(({ attempt, question }, index) => (
                      <details key={`low-confidence-${attempt.questionId}`} className="rounded-2xl bg-amber-50 p-4">
                        <summary className="cursor-pointer text-sm font-semibold text-amber-950">
                          <span>
                            信心 {attempt.confidence}｜{index + 1}：{question.chapter} / {question.section} / {question.testedConcept}
                          </span>
                        </summary>
                        <div className="mt-4 space-y-3 text-sm leading-7 text-slate-700">
                          <p className="font-semibold text-slate-900">{question.stem}</p>
                          <div className="grid gap-3">
                            {getAvailableOptionKeys(question).map((key) => (
                              <div key={`${question.id}-low-${key}`} className="rounded-2xl bg-white p-4">
                                <p className="font-semibold text-slate-900">
                                  {key}. {question.options[key]}
                                </p>
                              </div>
                            ))}
                          </div>
                          <p>
                            <span className="font-semibold">我的答案：</span>
                            {attempt.selectedAnswer}
                          </p>
                          <p>
                            <span className="font-semibold">正確答案：</span>
                            {question.acceptedAnswers?.length && question.answerCreditType === "multiple_accepted"
                              ? question.acceptedAnswers.join(" / ")
                              : attempt.correctAnswer}
                          </p>
                          <p>
                            <span className="font-semibold">是否答對：</span>
                            {attempt.isCorrect ? "答對" : "答錯"}
                          </p>
                          <p>
                            <span className="font-semibold">信心：</span>
                            {attempt.confidence}
                          </p>
                          {attempt.errorType ? (
                            <p>
                              <span className="font-semibold">錯因：</span>
                              {attempt.errorType}
                            </p>
                          ) : null}
                          <p>
                            <span className="font-semibold">詳解：</span>
                            {question.explanation}
                          </p>
                          {renderOptionAnalysis(question)}
                          {question.memoryTip ? (
                            <p>
                              <span className="font-semibold">快速記憶法：</span>
                              {question.memoryTip}
                            </p>
                          ) : null}
                          {renderExplanationFooter(question, attempt)}
                        </div>
                      </details>
                    ))
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-base font-semibold text-ink">全部題目回顧</h3>
                <div className="mt-3 grid gap-3">
                  {reviewedAttempts.map(({ attempt, question }, index) => (
                    <details key={`all-${attempt.questionId}`} className="rounded-2xl bg-slate-50 p-4">
                      <summary className="cursor-pointer text-sm font-semibold text-ink">
                        <span>
                          第 {index + 1} 題：{attempt.isCorrect ? "答對" : "答錯"} / {question.chapter} / {question.section}
                        </span>
                      </summary>
                      <div className="mt-4 space-y-3 text-sm leading-7 text-slate-700">
                        <p className="font-semibold text-slate-900">{question.stem}</p>
                        <div className="grid gap-3">
                          {getAvailableOptionKeys(question).map((key) => (
                            <div key={`${question.id}-all-${key}`} className="rounded-2xl bg-white p-4">
                              <p className="font-semibold text-slate-900">
                                {key}. {question.options[key]}
                              </p>
                            </div>
                          ))}
                        </div>
                        <p>
                          <span className="font-semibold">我的答案：</span>
                          {attempt.selectedAnswer}
                        </p>
                        <p>
                          <span className="font-semibold">正確答案：</span>
                          {question.acceptedAnswers?.length && question.answerCreditType === "multiple_accepted"
                            ? question.acceptedAnswers.join(" / ")
                            : attempt.correctAnswer}
                        </p>
                        <p>
                          <span className="font-semibold">testedConcept：</span>
                          {question.testedConcept}
                        </p>
                        <p>
                          <span className="font-semibold">信心：</span>
                          {attempt.confidence}
                        </p>
                        {attempt.errorType ? (
                          <p>
                            <span className="font-semibold">錯因：</span>
                            {attempt.errorType}
                          </p>
                        ) : null}
                        <p>
                          <span className="font-semibold">詳解：</span>
                          {question.explanation}
                        </p>
                        {renderOptionAnalysis(question)}
                        {question.memoryTip ? (
                          <p>
                            <span className="font-semibold">快速記憶法：</span>
                            {question.memoryTip}
                          </p>
                        ) : null}
                        {renderExplanationFooter(question, attempt)}
                      </div>
                    </details>
                  ))}
                </div>
              </div>
            </div>
          </section>
          {showPrompt ? <AIPromptBox promptText={state.promptText} /> : null}
          <WeaknessRanking sections={topWeakSections} />
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
                href="/quiz?new=1"
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
              <button
                type="button"
                onClick={() => setShowPrompt((current) => !current)}
                className="min-h-12 rounded-2xl bg-slate-900 px-4 py-4 text-center text-sm font-semibold text-white transition hover:bg-black"
              >
                {showPrompt ? "收起 AI 補弱 Prompt" : "顯示 AI 補弱 Prompt"}
              </button>
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}
