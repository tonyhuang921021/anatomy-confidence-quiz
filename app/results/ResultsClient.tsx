"use client";

import Link from "next/link";
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useCloudHistoryHydration } from "@/components/useCloudHistoryHydration";
import { CopyQuestionPromptButton } from "@/components/CopyQuestionPromptButton";
import { QuestionAiMetadataBadges } from "@/components/QuestionAiMetadataBadges";
import { QuestionOptionBlock, QuestionStemBlock } from "@/components/QuestionMediaBlock";
import { QuestionPrimaryTagBadge } from "@/components/QuestionPrimaryTagBadge";
import { QuestionExplanationTabs } from "@/components/QuestionExplanationTabs";
import { QuestionReportButton } from "@/components/QuestionIssueReportButton";
import { RelatedQuestionsPanel } from "@/components/RelatedQuestionsPanel";
import { ResultSummary } from "@/components/ResultSummary";
import { SavedQuestionButton } from "@/components/SavedQuestionButton";
import {
  StructuredExplanationText,
  hasCollapsibleStructuredExplanation,
  isDefaultInlineExplanationSectionTitle
} from "@/components/StructuredExplanationText";
import { WeaknessRanking } from "@/components/WeaknessRanking";
import {
  loadQuestionCommunityStats,
  loadConfirmedQuestionClassificationOverrides,
  loadCompletedSessionFromSupabase,
  clearQuestionExplanationBackgroundCache,
  loadSharedQuestionExplanationOverrides,
  pushCompletedSessionToSupabase,
  syncSharedQuestionExplanationOverrides
} from "@/lib/cloudSync";
import {
  applyQuestionClassificationOverride,
  getCanonicalQuestionBank,
  getAISimulationPaperLabel,
  getQuestionsForAISimulationPaper,
  getPastPaperOptions
} from "@/data/med1QuestionBank";
import { anatomyQuestions } from "@/data/anatomyQuestions";
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
  loadCurrentSession,
  clearCurrentSession,
  getPendingQuestionExplanationOverrideSync,
  getCanonicalSessionId,
  loadCompletedSessions,
  loadRecentCompletedSessionHandoffForUser,
  loadQuestionExplanationOverrides,
  mergeQuestionExplanationOverrides,
  saveCompletedSession,
  saveQuestionExplanationOverride,
  saveQuestionExplanationOverrides,
  saveQuizSettings,
  loadSimulationConfidenceCalibration
} from "@/lib/storage";
import { getSimulationConfidenceCalibrationPreference } from "@/lib/accountPreferences";
import { buildNewQuizHref } from "@/lib/startSettingsUrl";
import {
  Attempt,
  OptionKey,
  Question,
  QuestionClassificationOverride,
  QuestionCommunityStats,
  QuestionExplanationOverride,
  QuizSettings,
  QuizSession,
  SectionCompletionStats,
  SectionStats,
  SummaryStats
} from "@/types/quiz";
import { getOrCreateVisitorId } from "@/lib/visitor";
import {
  buildRelatedQuestionContext,
  findPreviousQuestionForContinuation
} from "@/lib/questionContext";
import {
  buildQuestionExplanationRequestQuestion,
  findQuestionSource
} from "@/lib/questionExplanationRequest";
import {
  analyzeMastery,
  getMasteryCategoryLabelForAnswer,
  type MasteryCategoryKey
} from "@/lib/masteryAnalysis";
import {
  getQuestionPrimaryTag,
  primaryTagIncludesSubject
} from "@/lib/analysisPrimaryTag";
import { isSavedQuestionReviewSettings } from "@/lib/savedQuestionReview";
import {
  buildWeaknessPracticeSettings,
  buildWeaknessQuestionOrder
} from "@/lib/weaknessAnalysis";
import {
  buildResultReviewNavigation,
  getResultReviewNavigationTargetIndex
} from "@/lib/resultReviewNavigation";

const allQuestions = getCanonicalQuestionBank();

const optionKeys: OptionKey[] = ["A", "B", "C", "D", "E"];
const MAX_OPEN_REVIEW_DETAILS = 2;

function getQuestionMap(
  session: QuizSession,
  classificationOverrides: Record<string, QuestionClassificationOverride>,
  explanationOverrides: Record<string, QuestionExplanationOverride>
) {
  const requiredQuestionIds = new Set(session.attempts.map((attempt) => attempt.questionId));

  return new Map(
    getResultQuestionSources(session)
      .filter(
        (question): question is Question =>
          Boolean(question?.id) && requiredQuestionIds.has(question.id)
      )
      .map((question) => {
        const classifiedQuestion = applyQuestionClassificationOverride(
          question,
          classificationOverrides[question.id]
        );
        const storedQuestion = applyQuestionExplanationOverride(classifiedQuestion);
        const override = explanationOverrides[question.id];

        return [
          question.id,
          override
            ? {
                ...storedQuestion,
                explanation: override.explanation || storedQuestion.explanation,
                optionAnalysis: override.optionAnalysis ?? storedQuestion.optionAnalysis,
                memoryTip: override.memoryTip || storedQuestion.memoryTip
              }
            : storedQuestion
        ] as const;
      })
  );
}

function getAISimulationQuestionsForSession(session: QuizSession) {
  const paperKey = getPastPaperKeyFromSession(session);
  if (!paperKey?.startsWith("AI-")) return [];

  return getQuestionsForAISimulationPaper(
    paperKey,
    session.settings?.subjectFilter ?? "全部"
  );
}

function getResultQuestionSources(session: QuizSession) {
  return Array.from(
    new Map(
      [
        ...allQuestions,
        ...getAISimulationQuestionsForSession(session),
        ...(session.generatedQuestions ?? [])
      ].map((question) => [question.id, question] as const)
    ).values()
  );
}

function getAvailableOptionKeys(question: Question) {
  return optionKeys.filter((key) => typeof question.options[key] === "string");
}

function normalizeResultEliminatedOptions(options?: OptionKey[]) {
  return Array.from(new Set((options ?? []).filter((key): key is OptionKey => optionKeys.includes(key))));
}

function getResultSessionEliminationMap(session: QuizSession | null | undefined) {
  if (!session) return undefined;

  const eliminationMap: NonNullable<QuizSession["optionEliminationMap"]> = {
    ...(session.optionEliminationMap ?? {})
  };

  for (const attempt of session.attempts) {
    const normalizedOptions = normalizeResultEliminatedOptions(attempt.eliminatedOptions);
    if (normalizedOptions.length > 0) {
      eliminationMap[attempt.questionId] = normalizeResultEliminatedOptions([
        ...(eliminationMap[attempt.questionId] ?? []),
        ...normalizedOptions
      ]);
    }
  }

  const normalizedEntries = Object.entries(eliminationMap)
    .map(([questionId, options]) => {
      const normalizedOptions = normalizeResultEliminatedOptions(options);
      return normalizedOptions.length > 0 ? [questionId, normalizedOptions] as const : null;
    })
    .filter((entry): entry is readonly [string, OptionKey[]] => Boolean(entry));

  return normalizedEntries.length > 0 ? Object.fromEntries(normalizedEntries) : undefined;
}

function getResultSessionEliminatedOptionCount(session: QuizSession | null | undefined) {
  const eliminationMap = getResultSessionEliminationMap(session);
  if (!eliminationMap) return 0;
  return Object.values(eliminationMap).reduce((sum, options) => sum + normalizeResultEliminatedOptions(options).length, 0);
}

function mergeResultOptionEliminationMap(
  primary: QuizSession | null | undefined,
  secondary: QuizSession | null | undefined
) {
  const primaryMap = getResultSessionEliminationMap(primary);
  const secondaryMap = getResultSessionEliminationMap(secondary);
  const questionIds = new Set([
    ...Object.keys(primaryMap ?? {}),
    ...Object.keys(secondaryMap ?? {})
  ]);

  const merged: NonNullable<QuizSession["optionEliminationMap"]> = {};
  for (const questionId of questionIds) {
    const normalizedOptions = normalizeResultEliminatedOptions([
      ...(secondaryMap?.[questionId] ?? []),
      ...(primaryMap?.[questionId] ?? [])
    ]);
    if (normalizedOptions.length > 0) {
      merged[questionId] = normalizedOptions;
    }
  }

  return Object.keys(merged).length > 0 ? merged : undefined;
}

function mergeResultAttemptEliminations(
  primaryAttempts: Attempt[],
  secondaryAttempts: Attempt[],
  eliminationMap?: QuizSession["optionEliminationMap"]
) {
  const secondaryByQuestionId = new Map(
    secondaryAttempts.map((attempt) => [attempt.questionId, attempt] as const)
  );

  return primaryAttempts.map((attempt, index) => {
    const secondaryAttempt = secondaryByQuestionId.get(attempt.questionId) ?? secondaryAttempts[index];
    const normalizedOptions = normalizeResultEliminatedOptions([
      ...(secondaryAttempt?.eliminatedOptions ?? []),
      ...(attempt.eliminatedOptions ?? []),
      ...(eliminationMap?.[attempt.questionId] ?? [])
    ]);

    return {
      ...attempt,
      eliminatedOptions: normalizedOptions.length > 0 ? normalizedOptions : undefined
    };
  });
}

function mergeResultSessionMetadata(primary: QuizSession, secondary: QuizSession | null | undefined): QuizSession {
  if (!secondary) return primary;

  const eliminationMap = mergeResultOptionEliminationMap(primary, secondary);
  const primaryHasMoreAttempts = primary.attempts.length >= secondary.attempts.length;
  const attemptBase = primaryHasMoreAttempts ? primary.attempts : secondary.attempts;
  const attemptFallback = primaryHasMoreAttempts ? secondary.attempts : primary.attempts;
  const settings =
    primary.settings || secondary.settings
      ? ({
          ...(secondary.settings ?? {}),
          ...(primary.settings ?? {})
        } as QuizSession["settings"])
      : undefined;

  return {
    ...secondary,
    ...primary,
    settings,
    questionOrder:
      (primary.questionOrder?.length ?? 0) >= (secondary.questionOrder?.length ?? 0)
        ? primary.questionOrder
        : secondary.questionOrder,
    generatedQuestions:
      (primary.generatedQuestions?.length ?? 0) >= (secondary.generatedQuestions?.length ?? 0)
        ? primary.generatedQuestions
        : secondary.generatedQuestions,
    optionEliminationMap: eliminationMap,
    simulationElapsedSeconds:
      normalizeResultTimerSeconds(primary.simulationElapsedSeconds) > 0
        ? primary.simulationElapsedSeconds
        : secondary.simulationElapsedSeconds,
    simulationTimerDurationSeconds:
      normalizeResultTimerSeconds(primary.simulationTimerDurationSeconds) > 0
        ? primary.simulationTimerDurationSeconds
        : secondary.simulationTimerDurationSeconds,
    attempts: mergeResultAttemptEliminations(attemptBase, attemptFallback, eliminationMap)
  } satisfies QuizSession;
}

function getResultAttemptEliminatedOptions(session: QuizSession, attempt: Attempt) {
  return normalizeResultEliminatedOptions([
    ...(attempt.eliminatedOptions ?? []),
    ...(session.optionEliminationMap?.[attempt.questionId] ?? [])
  ]);
}

function getAcceptedAnswerSet(question: Question, fallbackAnswer: OptionKey) {
  if (question.answerCreditType === "all_credit") {
    return new Set(getAvailableOptionKeys(question));
  }

  if (
    (question.answerCreditType === "multiple_accepted" ||
      question.answerCreditType === "multiple_answers") &&
    question.acceptedAnswers?.length
  ) {
    return new Set(question.acceptedAnswers);
  }

  return new Set<OptionKey>([fallbackAnswer]);
}

function getResultOptionState(question: Question, attempt: Attempt, optionKey: OptionKey) {
  const acceptedAnswers = getAcceptedAnswerSet(question, attempt.correctAnswer);
  const isSelected = attempt.selectedAnswer === optionKey;
  const isCorrectOption = acceptedAnswers.has(optionKey);
  const isAllCreditSelected = question.answerCreditType === "all_credit" && isSelected;
  const isCorrectSelected = isSelected && (attempt.isCorrect || isCorrectOption);
  const isWrongSelected =
    isSelected &&
    !attempt.isCorrect &&
    !isCorrectOption &&
    question.answerCreditType !== "all_credit";

  if (isWrongSelected) {
    return {
      wrapperClassName: "rounded-2xl border border-rose-300 bg-rose-50 p-4 ring-2 ring-rose-100",
      labelClassName:
        "mt-0.5 inline-flex min-w-8 justify-center rounded-full bg-rose-600 px-2 py-1 text-xs font-semibold text-white",
      badge: "你的答案",
      badgeClassName: "bg-rose-100 text-rose-800"
    };
  }

  if (isCorrectOption || isCorrectSelected || isAllCreditSelected) {
    return {
      wrapperClassName: "rounded-2xl border border-emerald-300 bg-emerald-50 p-4 ring-2 ring-emerald-100",
      labelClassName:
        "mt-0.5 inline-flex min-w-8 justify-center rounded-full bg-emerald-600 px-2 py-1 text-xs font-semibold text-white",
      badge:
        isSelected && (isCorrectOption || attempt.isCorrect)
          ? question.answerCreditType === "all_credit"
            ? "你的答案"
            : "你的答案 / 正解"
          : "正解",
      badgeClassName: "bg-emerald-100 text-emerald-800"
    };
  }

  return {
    wrapperClassName: "rounded-2xl bg-white p-4",
    labelClassName:
      "mt-0.5 inline-flex min-w-8 justify-center rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200",
    badge: "",
    badgeClassName: ""
  };
}

type ResultState = {
  session: QuizSession | null;
  sessions: QuizSession[];
  summary: SummaryStats | null;
  sectionStats: SectionStats[];
  promptTexts: Record<"concise" | "detailed", string>;
  lowCompletion: SectionCompletionStats[];
  unstableSections: SectionCompletionStats[];
  completionStats: ReturnType<typeof calculateCompletionStats> | null;
};

const EMPTY_PROMPT_TEXTS: ResultState["promptTexts"] = {
  concise: "",
  detailed: ""
};

function getSessionModeLabel(session: QuizSession) {
  if (isSavedQuestionReviewSettings(session.settings)) return "儲存題目複習";
  return session.settings?.mode === "simulation"
    ? "模擬考"
    : session.settings?.mode === "custom_paper"
      ? "自訂卷"
    : session.settings?.mode === "review"
      ? "錯題複習"
      : session.settings?.mode === "weakness"
        ? "弱點補強"
        : "隨機刷題";
}

function isSimulationSession(session: QuizSession) {
  return session.settings?.mode === "simulation";
}

function isGenericSimulationSessionName(name?: string | null) {
  const normalized = name?.trim();
  if (!normalized) return true;
  return (
    normalized === "模擬考" ||
    normalized === "模擬考試卷" ||
    /^\d{4}\s*年第\s*[12]\s*次試卷$/.test(normalized)
  );
}

function getStoredQuestionCount(session: QuizSession) {
  return Math.max(
    session.questionOrder?.length ?? 0,
    session.generatedQuestions?.length ?? 0
  );
}

function isMoreCompleteResultSession(candidate: QuizSession, current: QuizSession | null) {
  if (!candidate.completedAt || candidate.attempts.length === 0) return false;
  if (!current?.completedAt) return true;
  if (candidate.attempts.length !== current.attempts.length) {
    return candidate.attempts.length > current.attempts.length;
  }
  const candidateEliminationCount = getResultSessionEliminatedOptionCount(candidate);
  const currentEliminationCount = getResultSessionEliminatedOptionCount(current);
  if (candidateEliminationCount !== currentEliminationCount) {
    return candidateEliminationCount > currentEliminationCount;
  }
  return (candidate.completedAt ?? candidate.startedAt).localeCompare(current.completedAt ?? current.startedAt) >= 0;
}

function shouldRefreshPossiblyTruncatedCloudSession(session: QuizSession | null) {
  if (!session?.completedAt) return false;
  if (!isSimulationSession(session) && session.settings?.mode !== "custom_paper") return false;

  const storedQuestionCount = getStoredQuestionCount(session);
  return storedQuestionCount > 0 && session.attempts.length > 0 && session.attempts.length < storedQuestionCount;
}

function getPastPaperKeyFromSession(session: QuizSession) {
  if (session.settings?.selectedPaperKey) return session.settings.selectedPaperKey;
  const firstQuestion = session.generatedQuestions?.find((question) => question.examCode && question.paperCode);
  if (firstQuestion?.examCode && firstQuestion.paperCode) {
    return `${firstQuestion.examCode}-${firstQuestion.paperCode}`;
  }
  const questionIds = [
    ...(session.questionOrder ?? []),
    ...session.attempts.map((attempt) => attempt.questionId)
  ];
  const paperKeys = new Set<string>();
  for (const questionId of questionIds) {
    const match = questionId.match(/^MOEX-([^-]+)-([^-]+)-Q\d+/);
    if (match) paperKeys.add(`${match[1]}-${match[2]}`);

    const aiMatch = questionId.match(/^(AI-[A-Z0-9-]+)-Q\d+$/);
    if (aiMatch) paperKeys.add(aiMatch[1]);
  }
  return paperKeys.size === 1 ? Array.from(paperKeys)[0] : undefined;
}

function getPaperModeFromPaperKey(paperKey?: string | null) {
  if (!paperKey) return undefined;
  return paperKey.startsWith("AI-") ? "ai_paper" : "past_paper";
}

function getDefaultSimulationSessionName(session: QuizSession) {
  if (!isSimulationSession(session)) return null;
  const paperKey = getPastPaperKeyFromSession(session);
  const paperLabel =
    paperKey && paperKey.startsWith("AI-")
      ? getAISimulationPaperLabel(paperKey, session.settings?.subjectFilter ?? "全部") ??
        getAISimulationPaperLabel(paperKey, "全部")
      : paperKey
        ? getPastPaperOptions(session.settings?.subjectFilter ?? "全部").find((paper) => paper.key === paperKey)?.label ??
          getPastPaperOptions("全部").find((paper) => paper.key === paperKey)?.label
        : undefined;
  if (paperLabel) return paperLabel;

  const firstQuestion = session.generatedQuestions?.find(
    (question) => typeof question.sourceYear === "number"
  );
  if (!firstQuestion?.sourceYear) return "模擬考試卷";
  const subjectLabel =
    firstQuestion.sourceCitation?.includes("醫學（二）") || session.settings?.subjectFilter === "醫學（二）"
      ? "醫學（二）"
      : firstQuestion.paperCode?.startsWith("2")
        ? "醫學（二）"
        : "醫學（一）";
  return `${firstQuestion.sourceYear} 第${firstQuestion.sourceRound ?? 1}次 ${subjectLabel} ${firstQuestion.paperCode ?? ""}`.trim();
}

function getSessionDisplayName(session: QuizSession) {
  if (isSimulationSession(session)) {
    const savedName = session.settings?.sessionName?.trim();
    return !isGenericSimulationSessionName(savedName)
      ? savedName ?? "模擬考試卷"
      : getDefaultSimulationSessionName(session) || "模擬考試卷";
  }

  return `${session.subject} ${getSessionModeLabel(session)}`;
}

function getSessionSubjectLabel(
  session: QuizSession,
  reviewedAttempts: Array<{ question: Question }>
) {
  if (isSimulationSession(session)) {
    return `${getSessionDisplayName(session)}結果分析`;
  }

  if (session.settings?.customPoolLabel?.startsWith("考前弱點：")) {
    const primaryTag = session.settings.sessionName?.trim();
    return primaryTag ? `${primaryTag}複習結果` : "觀念群複習結果";
  }

  const subjects = Array.from(new Set(reviewedAttempts.map((item) => item.question.subject).filter(Boolean)));
  const subject = subjects.length === 1 ? subjects[0] : session.subject;
  return `本輪${subject}結果分析`;
}

function getSessionResultsHref(session: QuizSession) {
  const basePath = isSimulationSession(session) ? "/simulation-results" : "/results";
  return `${basePath}?sessionId=${encodeURIComponent(session.id)}`;
}

function isSameSessionId(left?: string | null, right?: string | null) {
  if (!left || !right) return false;
  return getCanonicalSessionId(left) === getCanonicalSessionId(right);
}

function getResultSessionFreshness(session: QuizSession) {
  return session.completedAt || session.attempts.at(-1)?.answeredAt || session.startedAt || "";
}

function mergeResultSessionSources(...sources: QuizSession[][]) {
  const merged = new Map<string, QuizSession>();

  for (const session of sources.flat()) {
    if (!session?.completedAt) continue;
    const key = getCanonicalSessionId(session.id);
    const current = merged.get(key);
    if (!current) {
      merged.set(key, session);
      continue;
    }

    const sessionEliminationCount = getResultSessionEliminatedOptionCount(session);
    const currentEliminationCount = getResultSessionEliminatedOptionCount(current);
    const nextIsBetter =
      session.attempts.length > current.attempts.length ||
      (session.attempts.length === current.attempts.length &&
        (sessionEliminationCount > currentEliminationCount ||
          (sessionEliminationCount === currentEliminationCount &&
            getResultSessionFreshness(session) >= getResultSessionFreshness(current))));

    if (nextIsBetter) {
      merged.set(key, mergeResultSessionMetadata(session, current));
    } else {
      merged.set(key, mergeResultSessionMetadata(current, session));
    }
  }

  return Array.from(merged.values()).sort((left, right) =>
    getResultSessionFreshness(right).localeCompare(getResultSessionFreshness(left))
  );
}

function getAccuracyTone(correctRate: number) {
  if (correctRate < 30) return "bg-rose-100 text-rose-800";
  if (correctRate <= 60) return "bg-amber-100 text-amber-800";
  return "bg-emerald-100 text-emerald-800";
}

function getQuestionSourceBadgeLabel(question: Question) {
  if (question.sourceYear && question.sourceRound && question.originalQuestionNumber) {
    return `${question.sourceYear} 第${question.sourceRound}次 Q${question.originalQuestionNumber}`;
  }
  if (question.sourceYear && question.originalQuestionNumber) {
    return `${question.sourceYear} Q${question.originalQuestionNumber}`;
  }
  if (question.originalQuestionNumber) {
    return `Q${question.originalQuestionNumber}`;
  }
  if (question.sourceType === "AI_GENERATED") return "AI 題";
  return "";
}

function getConfidenceTileClass(confidence: number) {
  if (confidence <= 1) return "border-rose-200 bg-rose-500 text-white shadow-rose-100";
  if (confidence === 2) return "border-orange-200 bg-orange-400 text-white shadow-orange-100";
  if (confidence === 3) return "border-yellow-200 bg-yellow-300 text-slate-950 shadow-yellow-100";
  return "border-emerald-200 bg-emerald-100 text-emerald-950 shadow-emerald-100";
}

function getConfidenceOverviewLabel(confidence: number) {
  return `信心 ${Math.min(Math.max(Math.round(confidence), 1), 4)}`;
}

type ConfidenceOverviewExportItem = {
  questionNumber: number;
  confidence: number;
  isCorrect: boolean;
};

function getConfidenceOverviewExportTone(confidence: number) {
  if (confidence <= 1) {
    return { fill: "#f43f5e", stroke: "#fecdd3", text: "#ffffff", shadow: "#fecdd3" };
  }
  if (confidence === 2) {
    return { fill: "#fb923c", stroke: "#fed7aa", text: "#ffffff", shadow: "#fed7aa" };
  }
  if (confidence === 3) {
    return { fill: "#fde047", stroke: "#fde68a", text: "#0f172a", shadow: "#fde68a" };
  }
  return { fill: "#dcfce7", stroke: "#a7f3d0", text: "#052e2b", shadow: "#a7f3d0" };
}

function drawRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.arcTo(x + width, y, x + width, y + height, safeRadius);
  context.arcTo(x + width, y + height, x, y + height, safeRadius);
  context.arcTo(x, y + height, x, y, safeRadius);
  context.arcTo(x, y, x + width, y, safeRadius);
  context.closePath();
}

function drawTextEllipsis(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number
) {
  if (context.measureText(text).width <= maxWidth) {
    context.fillText(text, x, y);
    return;
  }

  let nextText = text;
  while (nextText.length > 0 && context.measureText(`${nextText}...`).width > maxWidth) {
    nextText = nextText.slice(0, -1);
  }
  context.fillText(`${nextText}...`, x, y);
}

function triggerPngDownload(canvas: HTMLCanvasElement, filename: string) {
  const pngUrl = canvas.toDataURL("image/png");
  const link = document.createElement("a");
  link.href = pngUrl;
  link.download = filename;
  link.target = "_blank";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function getConfidenceOverviewExportWidth() {
  return 720;
}

function downloadConfidenceOverviewAsPng({
  width,
  filename,
  sessionName,
  correctCount,
  totalCount,
  items
}: {
  width: number;
  filename: string;
  sessionName: string;
  correctCount: number;
  totalCount: number;
  items: ConfidenceOverviewExportItem[];
}) {
  const logicalWidth = Math.max(320, Math.min(720, Math.ceil(width || 420)));
  const padding = logicalWidth < 420 ? 22 : 28;
  const contentWidth = logicalWidth - padding * 2;
  const columnCount = 10;
  const gridGap = 8;
  const tileSize = Math.floor((contentWidth - gridGap * (columnCount - 1)) / columnCount);
  const rowCount = Math.max(1, Math.ceil(items.length / columnCount));
  const gridTop = padding + 138;
  const logicalHeight = gridTop + rowCount * tileSize + Math.max(0, rowCount - 1) * gridGap + padding;
  const scale = 2;

  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(logicalWidth * scale);
  canvas.height = Math.ceil(logicalHeight * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("瀏覽器不支援圖片輸出");
  context.scale(scale, scale);

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, logicalWidth, logicalHeight);
  context.save();
  context.shadowColor = "rgba(15, 23, 42, 0.08)";
  context.shadowBlur = 18;
  context.shadowOffsetY = 8;
  drawRoundedRect(context, 0, 0, logicalWidth, logicalHeight, 32);
  context.fillStyle = "#ffffff";
  context.fill();
  context.restore();

  context.font = "900 11px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  context.fillStyle = "#64748b";
  drawTextEllipsis(context, sessionName, padding, padding + 10, contentWidth - 86);

  context.font = "800 28px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  context.fillStyle = "#062c22";
  context.fillText("信心度總覽", padding, padding + 46);

  const countPillWidth = 74;
  drawRoundedRect(context, logicalWidth - padding - countPillWidth, padding + 18, countPillWidth, 32, 16);
  context.fillStyle = "#f1f5f9";
  context.fill();
  context.font = "800 14px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  context.fillStyle = "#334155";
  context.textAlign = "center";
  context.fillText(`${totalCount} 題`, logicalWidth - padding - countPillWidth / 2, padding + 39);
  context.textAlign = "left";

  context.font = "700 15px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  context.fillStyle = "#64748b";
  context.fillText("依正式題號排列，色塊代表信心 1-4。", padding, padding + 76);

  const legendTop = padding + 98;
  [1, 2, 3, 4].forEach((confidence, index) => {
    const tone = getConfidenceOverviewExportTone(confidence);
    const x = padding + index * 36;
    context.save();
    context.shadowColor = tone.shadow;
    context.shadowBlur = 5;
    drawRoundedRect(context, x, legendTop, 28, 28, 8);
    context.fillStyle = tone.fill;
    context.fill();
    context.strokeStyle = tone.stroke;
    context.lineWidth = 2;
    context.stroke();
    context.restore();

    context.font = "900 13px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    context.fillStyle = tone.text;
    context.textAlign = "center";
    context.fillText(String(confidence), x + 14, legendTop + 19);
    context.textAlign = "left";
  });

  const scoreText = `答對 ${correctCount}/${totalCount || 100}`;
  context.font = "900 13px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  const scoreWidth = Math.ceil(context.measureText(scoreText).width) + 28;
  const scoreX = logicalWidth - padding - scoreWidth;
  drawRoundedRect(context, scoreX, legendTop - 2, scoreWidth, 32, 16);
  context.fillStyle = "#f1f5f9";
  context.fill();
  context.strokeStyle = "#e2e8f0";
  context.lineWidth = 1;
  context.stroke();
  context.fillStyle = "#1e293b";
  context.fillText(scoreText, scoreX + 14, legendTop + 19);

  items.forEach((item, index) => {
    const row = Math.floor(index / columnCount);
    const column = index % columnCount;
    const x = padding + column * (tileSize + gridGap);
    const y = gridTop + row * (tileSize + gridGap);
    const tone = getConfidenceOverviewExportTone(item.confidence);

    context.save();
    context.shadowColor = tone.shadow;
    context.shadowBlur = 5;
    context.shadowOffsetY = 2;
    drawRoundedRect(context, x, y, tileSize, tileSize, Math.max(14, tileSize * 0.2));
    context.fillStyle = tone.fill;
    context.fill();
    context.strokeStyle = tone.stroke;
    context.lineWidth = Math.max(2, tileSize * 0.04);
    context.stroke();
    context.restore();

    const badgeText = item.isCorrect ? "對" : "錯";
    const badgeWidth = Math.max(25, tileSize * 0.34);
    const badgeHeight = Math.max(18, tileSize * 0.23);
    const badgeX = x + tileSize - badgeWidth - 8;
    const badgeY = y + 7;
    drawRoundedRect(context, badgeX, badgeY, badgeWidth, badgeHeight, badgeHeight / 2);
    context.fillStyle = "rgba(255, 255, 255, 0.9)";
    context.fill();
    context.font = `900 ${Math.max(11, Math.floor(tileSize * 0.16))}px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
    context.fillStyle = item.isCorrect ? "#047857" : "#be123c";
    context.textAlign = "center";
    context.fillText(badgeText, badgeX + badgeWidth / 2, badgeY + badgeHeight * 0.7);

    context.font = `900 ${Math.max(18, Math.floor(tileSize * 0.33))}px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
    context.fillStyle = tone.text;
    context.fillText(String(item.questionNumber), x + tileSize / 2, y + tileSize * 0.64);
    context.textAlign = "left";
  });

  triggerPngDownload(canvas, filename);
}

function getMasteryToneClass(tone: string) {
  if (tone === "emerald") return "border-emerald-200 bg-emerald-50 text-emerald-950";
  if (tone === "sky") return "border-sky-200 bg-sky-50 text-sky-950";
  if (tone === "yellow") return "border-yellow-200 bg-yellow-50 text-yellow-950";
  if (tone === "rose") return "border-rose-200 bg-rose-50 text-rose-950";
  if (tone === "orange") return "border-orange-200 bg-orange-50 text-orange-950";
  return "border-slate-200 bg-slate-50 text-slate-900";
}

function getMasteryAccentClass(tone: string) {
  if (tone === "emerald") return "bg-emerald-500";
  if (tone === "sky") return "bg-sky-500";
  if (tone === "yellow") return "bg-yellow-400";
  if (tone === "rose") return "bg-rose-500";
  if (tone === "orange") return "bg-orange-400";
  return "bg-slate-400";
}

function getMasteryBadgeClass(label: string) {
  if (label === "錯誤自信") return "bg-rose-100 text-rose-800 ring-rose-200";
  if (label === "概念不穩") return "bg-orange-100 text-orange-800 ring-orange-200";
  if (label === "基礎缺口") return "bg-slate-100 text-slate-700 ring-slate-200";
  if (label === "猜對風險") return "bg-yellow-100 text-yellow-900 ring-yellow-200";
  if (label === "接近掌握") return "bg-sky-100 text-sky-800 ring-sky-200";
  if (label === "穩定掌握") return "bg-emerald-100 text-emerald-800 ring-emerald-200";
  return "bg-slate-100 text-slate-700 ring-slate-200";
}

function formatNullablePercent(value: number | null) {
  return value === null ? "—" : `${value}%`;
}

function formatExamScore(value: number) {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

function normalizeResultTimerSeconds(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function formatResultDurationClock(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

function getSimulationResultElapsedSeconds(session: QuizSession) {
  if (!isSimulationSession(session)) return null;

  const storedElapsedSeconds = normalizeResultTimerSeconds(session.simulationElapsedSeconds);
  if (storedElapsedSeconds > 0) return storedElapsedSeconds;

  const startedAt = Date.parse(session.startedAt);
  const completedAt = Date.parse(session.completedAt ?? "");
  if (!Number.isFinite(startedAt) || !Number.isFinite(completedAt) || completedAt <= startedAt) {
    return null;
  }

  return Math.floor((completedAt - startedAt) / 1000);
}

function normalizeSummaryStem(stem: string) {
  return stem.replace(/\s+/g, " ").trim();
}

function getSubjectStatOrder(subject: string) {
  const med1Order = ["解剖學", "組織學", "胚胎學", "生理學", "生物化學"];
  const med2Order = ["微生物免疫學", "寄生蟲學", "公共衛生學", "藥理學", "病理學"];
  const med1Index = med1Order.indexOf(subject);
  if (med1Index >= 0) return med1Index;
  const med2Index = med2Order.indexOf(subject);
  if (med2Index >= 0) return med2Index;
  return 999;
}

const RESULTS_HISTORY_PAGE_SIZE = 30;

function loadResultCompletedSessions() {
  return loadCompletedSessions({ includeFullLocalHistory: true });
}

function ResultsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, syncVersion, session } = useAuth();
  const forceSimulationHistoryHydration = searchParams.get("scope") === "simulation";
  useCloudHistoryHydration(true, {
    force: forceSimulationHistoryHydration,
    readRemoteOnly: forceSimulationHistoryHydration,
    historyMode: forceSimulationHistoryHydration ? "simulation" : undefined
  });
  const [mounted, setMounted] = useState(false);
  const [requestedSessionId, setRequestedSessionId] = useState<string | null>(null);
  const [explanationOverrides, setExplanationOverrides] = useState<Record<string, QuestionExplanationOverride>>({});
  const [explanationLoadingMap, setExplanationLoadingMap] = useState<Record<string, boolean>>({});
  const [explanationErrorMap, setExplanationErrorMap] = useState<Record<string, string>>({});
  const [classificationReportLoadingMap, setClassificationReportLoadingMap] = useState<Record<string, boolean>>({});
  const [classificationReportMessageMap, setClassificationReportMessageMap] = useState<Record<string, string>>({});
  const [classificationOverrides, setClassificationOverrides] = useState<Record<string, QuestionClassificationOverride>>({});
  const [communityStatsMap, setCommunityStatsMap] = useState<Record<string, QuestionCommunityStats>>({});
  const [copyPromptNotice, setCopyPromptNotice] = useState(false);
  const [confidenceOverviewDownloadNotice, setConfidenceOverviewDownloadNotice] = useState(false);
  const [aiPromptDetailLevel, setAiPromptDetailLevel] = useState<"concise" | "detailed">("detailed");
  const [isFullscreenReview, setIsFullscreenReview] = useState(false);
  const [isFullscreenReviewVisible, setIsFullscreenReviewVisible] = useState(false);
  const [openReviewDetailKeys, setOpenReviewDetailKeys] = useState<Set<string>>(() => new Set());
  const [activeReviewDetailKey, setActiveReviewDetailKey] = useState<string | null>(null);
  const reviewDetailElementMapRef = useRef<Record<string, HTMLDetailsElement | null>>({});
  const reviewSectionRef = useRef<HTMLElement | null>(null);
  const pendingReviewScrollAnchorRef = useRef<{ key: string; top: number } | null>(null);
  const pendingReviewScrollTargetRef = useRef<string | null>(null);
  const resultCloudHandoffSessionKeysRef = useRef(new Set<string>());
  const [isConfidenceCalibrationOpen, setIsConfidenceCalibrationOpen] = useState(false);
  const [isReviewNavigatorVisible, setIsReviewNavigatorVisible] = useState(false);
  const [isStudyRecommendationsOpen, setIsStudyRecommendationsOpen] = useState(false);
  const [isConfidenceOverviewOpen, setIsConfidenceOverviewOpen] = useState(false);
  const [simulationConfidenceCalibration, setSimulationConfidenceCalibration] = useState(() =>
    loadSimulationConfidenceCalibration(true)
  );
  const [visibleHistoryCount, setVisibleHistoryCount] = useState(RESULTS_HISTORY_PAGE_SIZE);
  const [resultsScope, setResultsScope] = useState<"default" | "simulation">("default");
  const [localHistoryVersion, setLocalHistoryVersion] = useState(0);
  const [editableSessionName, setEditableSessionName] = useState("");
  const [sessionNameNotice, setSessionNameNotice] = useState("");
  const [resultRecordNotice, setResultRecordNotice] = useState("");
  const [isSavingSessionName, setIsSavingSessionName] = useState(false);
  const [state, setState] = useState<ResultState>({
    session: null,
    sessions: [],
    summary: null,
    sectionStats: [],
    promptTexts: EMPTY_PROMPT_TEXTS,
    lowCompletion: [],
    unstableSections: [],
    completionStats: null
  });

  function queueResultCloudHandoff(resultSession: QuizSession) {
    if (!resultSession.completedAt || resultSession.attempts.length === 0) return;

    const handoffKey = [
      getCanonicalSessionId(resultSession.id),
      resultSession.completedAt,
      resultSession.attempts.length
    ].join(":");

    if (resultCloudHandoffSessionKeysRef.current.has(handoffKey)) return;
    resultCloudHandoffSessionKeysRef.current.add(handoffKey);

    void pushCompletedSessionToSupabase(resultSession).catch((error) => {
      console.error("Result session cloud handoff skipped; pending queue kept local copy:", error);
    });
  }

  useEffect(() => {
    const nextSimulationConfidenceCalibration = user
      ? getSimulationConfidenceCalibrationPreference(user.user_metadata, true)
      : loadSimulationConfidenceCalibration(true);
    setSimulationConfidenceCalibration(nextSimulationConfidenceCalibration);
  }, [user?.id, user?.user_metadata]);

  useEffect(() => {
    function handleSimulationConfidenceCalibrationChange(event: Event) {
      const detail = (event as CustomEvent<boolean>).detail;
      if (typeof detail === "boolean") {
        setSimulationConfidenceCalibration(detail);
      }
    }

    window.addEventListener(
      "simulation-confidence-calibration-change",
      handleSimulationConfidenceCalibrationChange
    );
    return () => {
      window.removeEventListener(
        "simulation-confidence-calibration-change",
        handleSimulationConfidenceCalibrationChange
      );
    };
  }, []);

  useLayoutEffect(() => {
    const targetKey = pendingReviewScrollTargetRef.current;
    if (targetKey && typeof window !== "undefined") {
      pendingReviewScrollTargetRef.current = null;
      pendingReviewScrollAnchorRef.current = null;

      let secondFrameId = 0;
      const firstFrameId = window.requestAnimationFrame(() => {
        secondFrameId = window.requestAnimationFrame(() => {
          const element =
            reviewDetailElementMapRef.current[targetKey] ??
            document.getElementById(`review-${targetKey}`);
          const summary = element?.querySelector(":scope > summary") ?? element;
          if (!summary) return;

          const readingTop = window.innerWidth >= 640 ? 112 : 84;
          const targetTop = window.scrollY + summary.getBoundingClientRect().top - readingTop;
          window.scrollTo({ top: Math.max(0, targetTop), left: 0, behavior: "smooth" });
        });
      });

      return () => {
        window.cancelAnimationFrame(firstFrameId);
        if (secondFrameId) window.cancelAnimationFrame(secondFrameId);
      };
    }

    const anchor = pendingReviewScrollAnchorRef.current;
    if (!anchor || typeof window === "undefined") return;
    pendingReviewScrollAnchorRef.current = null;

    const keepAnchorInPlace = () => {
      const element =
        reviewDetailElementMapRef.current[anchor.key] ??
        document.getElementById(`review-${anchor.key}`);
      const summary = element?.querySelector(":scope > summary") ?? element;
      if (!summary) return;

      const offset = summary.getBoundingClientRect().top - anchor.top;
      if (Math.abs(offset) > 1) {
        window.scrollBy({ top: offset, left: 0, behavior: "auto" });
      }
    };

    keepAnchorInPlace();
    const frameId = window.requestAnimationFrame(keepAnchorInPlace);
    return () => window.cancelAnimationFrame(frameId);
  }, [openReviewDetailKeys]);

  useEffect(() => {
    const element = reviewSectionRef.current;
    setIsReviewNavigatorVisible(false);
    if (!element || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsReviewNavigatorVisible(entry?.isIntersecting ?? false),
      { rootMargin: "120px 0px 120px" }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [state.session?.id]);

  async function handleCopyAIPrompt() {
    const promptText = state.promptTexts[aiPromptDetailLevel];
    if (!promptText) return;

    try {
      await navigator.clipboard.writeText(promptText);
      setCopyPromptNotice(true);
      window.setTimeout(() => setCopyPromptNotice(false), 1800);
    } catch {
      setCopyPromptNotice(false);
    }
  }

  function handleDownloadConfidenceOverview() {
    if (!state.session || confidenceOverviewItems.length === 0) return;

    try {
      downloadConfidenceOverviewAsPng({
        width: getConfidenceOverviewExportWidth(),
        filename: `confidence-overview-${getCanonicalSessionId(state.session.id)}.png`,
        sessionName: getSessionDisplayName(state.session),
        correctCount:
          state.summary?.correct ??
          confidenceOverviewItems.filter(({ attempt }) => attempt.isCorrect).length,
        totalCount: confidenceOverviewItems.length || 100,
        items: confidenceOverviewItems.map(({ attempt, questionNumber }) => ({
          questionNumber,
          confidence: Number.isFinite(attempt.confidence) ? attempt.confidence : 4,
          isCorrect: attempt.isCorrect
        }))
      });
      setConfidenceOverviewDownloadNotice(true);
      window.setTimeout(() => setConfidenceOverviewDownloadNotice(false), 1800);
    } catch {
      setConfidenceOverviewDownloadNotice(false);
    }
  }

  async function handleReportClassification(question: Question) {
    if (!session?.access_token) {
      setClassificationReportMessageMap((current) => ({
        ...current,
        [question.id]: "請先登入帳號，才能回報此題分類錯誤。"
      }));
      return;
    }
    setClassificationReportLoadingMap((current) => ({ ...current, [question.id]: true }));
    setClassificationReportMessageMap((current) => ({ ...current, [question.id]: "" }));

    try {
      const response = await fetch("/api/question-classification-report", {
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
            primaryTag: getQuestionPrimaryTag(question),
            stem: question.stem,
            options: question.options,
            explanation: question.explanation,
            testedConcept: question.testedConcept
          }
        })
      });

      const rawText = await response.text();
      const payload = (rawText ? JSON.parse(rawText) : null) as {
        ok: boolean;
        suggestedSubject?: string | null;
        suggestedChapter?: string | null;
        suggestedSection?: string | null;
        reason?: string | null;
        message?: string;
      } | null;

      if (!response.ok || !payload?.ok) {
        if (response.status === 429 && payload?.message && typeof window !== "undefined") {
          window.alert(payload.message);
        }
        setClassificationReportMessageMap((current) => ({
          ...current,
          [question.id]: payload?.message || rawText || "分類回報失敗。"
        }));
        return;
      }

      const suggestedPath = [
        payload.suggestedSubject,
        payload.suggestedChapter,
        payload.suggestedSection
      ].filter(Boolean).join(" / ");

      setClassificationReportMessageMap((current) => ({
        ...current,
        [question.id]:
          payload.message ||
          (suggestedPath
            ? `已回報並自動套用到 ${suggestedPath}。`
            : "已回報並依 AI 建議自動套用分類。")
      }));
    } catch {
      setClassificationReportMessageMap((current) => ({
        ...current,
        [question.id]: "無法連線到分類回報 API。"
      }));
    } finally {
      setClassificationReportLoadingMap((current) => ({ ...current, [question.id]: false }));
    }
  }

  useEffect(() => {
    const refreshLocalHistory = () => setLocalHistoryVersion((version) => version + 1);
    window.addEventListener("completed-sessions-change", refreshLocalHistory);
    window.addEventListener("completed-question-history-change", refreshLocalHistory);
    return () => {
      window.removeEventListener("completed-sessions-change", refreshLocalHistory);
      window.removeEventListener("completed-question-history-change", refreshLocalHistory);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function resolveResultSession() {
      try {
      const targetSessionId = searchParams.get("sessionId");
      const nextScope = searchParams.get("scope") === "simulation" ? "simulation" : "default";
      if (!cancelled) {
        setResultsScope(nextScope);
        setRequestedSessionId(targetSessionId);
        setResultRecordNotice("");
      }

      const handoffSessions = mergeResultSessionSources(
        session?.user?.id ? loadRecentCompletedSessionHandoffForUser(session.user.id) : [],
        loadRecentCompletedSessionHandoffForUser()
      );
      let completedSessions = mergeResultSessionSources(loadResultCompletedSessions(), handoffSessions);
      let scopedSessions = completedSessions.filter((sessionItem) =>
        nextScope === "simulation" ? isSimulationSession(sessionItem) : !isSimulationSession(sessionItem)
      );
      const currentSession = loadCurrentSession();
      const fallbackCurrentSession =
        targetSessionId &&
        isSameSessionId(currentSession?.id, targetSessionId) &&
        currentSession?.completedAt
          ? currentSession
          : null;
      const targetSession =
        targetSessionId
          ? completedSessions.find((item) => isSameSessionId(item.id, targetSessionId)) ??
            handoffSessions.find((item) => isSameSessionId(item.id, targetSessionId)) ??
            fallbackCurrentSession ??
            null
          : null;
      let resolvedTargetSession = targetSession;

      const shouldHydrateTargetFromCloud =
        targetSessionId &&
        session?.user?.id &&
        (!resolvedTargetSession?.completedAt ||
          resolvedTargetSession.attempts.length === 0 ||
          shouldRefreshPossiblyTruncatedCloudSession(resolvedTargetSession) ||
          (resolvedTargetSession?.completedAt &&
            isSimulationSession(resolvedTargetSession) &&
            getResultSessionEliminatedOptionCount(resolvedTargetSession) === 0));

      if (shouldHydrateTargetFromCloud) {
        let cloudSession = await loadCompletedSessionFromSupabase(targetSessionId);
        if (!cloudSession?.completedAt || cloudSession.attempts.length === 0) {
          await new Promise((resolve) => window.setTimeout(resolve, 900));
          if (!cancelled) {
            cloudSession = await loadCompletedSessionFromSupabase(targetSessionId);
          }
        }
        const mergedCloudSession =
          cloudSession?.completedAt && resolvedTargetSession?.completedAt
            ? mergeResultSessionMetadata(cloudSession, resolvedTargetSession)
            : cloudSession;
        if (mergedCloudSession?.completedAt && isMoreCompleteResultSession(mergedCloudSession, resolvedTargetSession)) {
          saveCompletedSession(mergedCloudSession);
          completedSessions = mergeResultSessionSources(loadResultCompletedSessions(), handoffSessions, [mergedCloudSession]);
          scopedSessions = completedSessions.filter((sessionItem) =>
            nextScope === "simulation" ? isSimulationSession(sessionItem) : !isSimulationSession(sessionItem)
          );
          resolvedTargetSession = mergedCloudSession;
        } else if (cloudSession?.completedAt && cloudSession.attempts.length === 0 && !resolvedTargetSession?.attempts.length) {
          setResultRecordNotice("這筆紀錄的題目明細還在整理中，先不顯示 0 題結果。請稍後重新整理或回作答紀錄。");
        } else if (mergedCloudSession?.completedAt && resolvedTargetSession?.completedAt) {
          const mergedTargetSession = mergeResultSessionMetadata(resolvedTargetSession, mergedCloudSession);
          if (getResultSessionEliminatedOptionCount(mergedTargetSession) > getResultSessionEliminatedOptionCount(resolvedTargetSession)) {
            saveCompletedSession(mergedTargetSession);
            completedSessions = mergeResultSessionSources(loadResultCompletedSessions(), handoffSessions, [mergedTargetSession]);
            scopedSessions = completedSessions.filter((sessionItem) =>
              nextScope === "simulation" ? isSimulationSession(sessionItem) : !isSimulationSession(sessionItem)
            );
            resolvedTargetSession = mergedTargetSession;
          }
        }
      }

      if (cancelled) return;

      if (targetSessionId && resolvedTargetSession?.completedAt) {
        const shouldUseSimulationScope = isSimulationSession(resolvedTargetSession);
        if (shouldUseSimulationScope && nextScope !== "simulation") {
          router.replace(`/simulation-results?sessionId=${encodeURIComponent(resolvedTargetSession.id)}`);
          return;
        }
        if (!shouldUseSimulationScope && nextScope === "simulation") {
          router.replace(`/results?sessionId=${encodeURIComponent(resolvedTargetSession.id)}`);
          return;
        }
      }

      if (
        fallbackCurrentSession &&
        !completedSessions.some((item) => isSameSessionId(item.id, fallbackCurrentSession.id))
      ) {
        saveCompletedSession(fallbackCurrentSession);
        completedSessions = mergeResultSessionSources(loadResultCompletedSessions(), handoffSessions, [fallbackCurrentSession]);
        scopedSessions = completedSessions.filter((sessionItem) =>
          nextScope === "simulation" ? isSimulationSession(sessionItem) : !isSimulationSession(sessionItem)
        );
      }

      if (resolvedTargetSession?.completedAt && resolvedTargetSession.attempts.length === 0) {
        setResultRecordNotice("這筆紀錄的題目明細還在整理中，先不顯示 0 題結果。請稍後重新整理或回作答紀錄。");
        setState((current) => ({
          ...current,
          session: null,
          sessions: scopedSessions,
          summary: null,
          sectionStats: [],
          promptTexts: EMPTY_PROMPT_TEXTS,
          lowCompletion: [],
          unstableSections: [],
          completionStats: null
        }));
        setMounted(true);
        return;
      }

      if (resolvedTargetSession?.completedAt) {
        queueResultCloudHandoff(resolvedTargetSession);
      }

      if (!resolvedTargetSession?.completedAt) {
        setState((current) => ({
          ...current,
          session: null,
          sessions: scopedSessions,
          summary: null,
          sectionStats: [],
          promptTexts: EMPTY_PROMPT_TEXTS,
          lowCompletion: [],
          unstableSections: [],
          completionStats: null
        }));
        setMounted(true);
        return;
      }

      const aiSimulationQuestions = getAISimulationQuestionsForSession(resolvedTargetSession);
      const currentQuestions =
        resolvedTargetSession.generatedQuestions && resolvedTargetSession.generatedQuestions.length > 0
          ? resolvedTargetSession.generatedQuestions
          : aiSimulationQuestions.length > 0
            ? aiSimulationQuestions
            : anatomyQuestions;
      const promptQuestions = Array.from(
        new Map(
          [
            ...allQuestions,
            ...aiSimulationQuestions,
            ...currentQuestions,
            ...(resolvedTargetSession.generatedQuestions ?? [])
          ].map((question) => [question.id, question] as const)
        ).values()
      );
      const promptQuestionMap = new Map(promptQuestions.map((question) => [question.id, question] as const));
      const currentQuestionIds = new Set(currentQuestions.map((question) => question.id));
      const hasAllAttemptQuestions = resolvedTargetSession.attempts.every((attempt) =>
        currentQuestionIds.has(attempt.questionId)
      );
      const analysisQuestions = hasAllAttemptQuestions
        ? currentQuestions
        : resolvedTargetSession.attempts
            .map((attempt) => promptQuestionMap.get(attempt.questionId))
            .filter((question): question is Question => Boolean(question));
      const resolvedAnalysisQuestions = analysisQuestions.length > 0 ? analysisQuestions : promptQuestions;
      const progressQuestions = anatomyQuestions.filter((question) => question.sourceType !== "AI_GENERATED");
      const completionStats = calculateCompletionStats(progressQuestions, completedSessions);
      const sessionSectionStats = calculateSectionStats(
        resolvedTargetSession.attempts,
        resolvedAnalysisQuestions
      );

      setState({
        session: resolvedTargetSession,
        sessions: scopedSessions,
        summary: calculateSummary(resolvedTargetSession.attempts, resolvedAnalysisQuestions),
        sectionStats: sessionSectionStats,
        promptTexts: {
          concise: generateAIPrompt(
            resolvedTargetSession.attempts,
            resolvedAnalysisQuestions,
            completedSessions,
            promptQuestions,
            { detailLevel: "concise" }
          ),
          detailed: generateAIPrompt(
            resolvedTargetSession.attempts,
            resolvedAnalysisQuestions,
            completedSessions,
            promptQuestions,
            { detailLevel: "detailed" }
          )
        },
        lowCompletion: getLowCompletionSections(completionStats.sections, 5),
        unstableSections: getUnstableCompletedSections(completionStats.sections, 5),
        completionStats
      });
      setMounted(true);
      } catch {
        if (cancelled) return;
        const fallbackSessions = loadResultCompletedSessions();
        const fallbackScope = searchParams.get("scope") === "simulation" ? "simulation" : "default";
        const fallbackScopedSessions = fallbackSessions.filter((sessionItem) =>
          fallbackScope === "simulation" ? isSimulationSession(sessionItem) : !isSimulationSession(sessionItem)
        );
        setState({
          session: null,
          sessions: fallbackScopedSessions,
          summary: null,
          sectionStats: [],
          promptTexts: EMPTY_PROMPT_TEXTS,
          lowCompletion: [],
          unstableSections: [],
          completionStats: null
        });
        setMounted(true);
      }
    }

    void resolveResultSession();

    return () => {
      cancelled = true;
    };
  }, [router, searchParams, session?.user?.id, syncVersion, localHistoryVersion]);

  useEffect(() => {
    setVisibleHistoryCount(RESULTS_HISTORY_PAGE_SIZE);
  }, [syncVersion, localHistoryVersion, requestedSessionId]);

  useEffect(() => {
    setOpenReviewDetailKeys(new Set());
    setActiveReviewDetailKey(null);
  }, [requestedSessionId]);

  useEffect(() => {
    setIsConfidenceCalibrationOpen(false);
    setIsStudyRecommendationsOpen(false);
    setIsConfidenceOverviewOpen(false);
  }, [requestedSessionId]);

  useEffect(() => {
    if (!state.session) {
      setEditableSessionName("");
      setSessionNameNotice("");
      return;
    }

    setEditableSessionName(getSessionDisplayName(state.session));
    setSessionNameNotice("");
  }, [state.session]);

  useEffect(() => {
    setExplanationOverrides((current) =>
      mergeQuestionExplanationOverrides(current, loadQuestionExplanationOverrides())
    );
  }, [syncVersion]);

  useEffect(() => {
    if (!state.session?.attempts.length) return;

    void loadConfirmedQuestionClassificationOverrides(
      state.session.attempts.map((attempt) => attempt.questionId)
    )
      .then((overrides) => setClassificationOverrides(overrides))
      .catch(() => {
        // keep static classification if override fetch fails
      });
  }, [state.session]);

  useEffect(() => {
    async function fetchCommunityStats() {
      if (!state.session?.attempts.length) return;

      try {
        const stats = await loadQuestionCommunityStats(
          state.session.attempts.map((attempt) => attempt.questionId)
        );
        setCommunityStatsMap(
          Object.fromEntries(stats.map((item) => [item.questionId, item] as const))
        );
      } catch {
        // keep UI quiet if community stats table is temporarily unavailable
      }
    }

    void fetchCommunityStats();
  }, [state.session]);

  useEffect(() => {
    if (typeof document === "undefined") return;

    if (isFullscreenReview) {
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = previousOverflow;
      };
    }
  }, [isFullscreenReview]);

  useEffect(() => {
    async function fetchSharedExplanationOverrides() {
      if (!state.session?.attempts.length) return;

      try {
        const questionIds = state.session.attempts.map((attempt) => attempt.questionId);
        const sharedOverrides = await loadSharedQuestionExplanationOverrides(
          questionIds
        );
        if (Object.keys(sharedOverrides).length > 0) {
          saveQuestionExplanationOverrides(sharedOverrides);
          setExplanationOverrides((current) =>
            mergeQuestionExplanationOverrides(current, sharedOverrides)
          );
        }

        if (session?.access_token) {
          const pendingOverrides = getPendingQuestionExplanationOverrideSync(
            questionIds,
            sharedOverrides
          );
          if (pendingOverrides.length > 0) {
            await syncSharedQuestionExplanationOverrides(pendingOverrides, session.access_token);
          }
        }
      } catch {
        // keep local overrides only
      }
    }

    void fetchSharedExplanationOverrides();
  }, [state.session]);

  const recentCompletedSessions = useMemo(
    () =>
      [...state.sessions]
        .filter((sessionItem) => Boolean(sessionItem.completedAt))
        .sort((a, b) =>
          (b.completedAt ?? b.startedAt).localeCompare(a.completedAt ?? a.startedAt)
        ),
    [state.sessions]
  );
  const visibleCompletedSessions = useMemo(
    () => recentCompletedSessions.slice(0, visibleHistoryCount),
    [recentCompletedSessions, visibleHistoryCount]
  );
  const activeSession = state.session;
  const confidenceTrackingEnabled =
    activeSession !== null &&
    (!isSimulationSession(activeSession) || (activeSession.settings?.enableConfidenceCalibration ?? true));
  const confidenceCalibrationEnabled =
    activeSession !== null &&
    isSimulationSession(activeSession) &&
    simulationConfidenceCalibration &&
    (activeSession?.settings?.enableConfidenceCalibration ?? true);
  const questionMap = useMemo(
    () =>
      activeSession
        ? getQuestionMap(activeSession, classificationOverrides, explanationOverrides)
        : new Map<string, Question>(),
    [activeSession, classificationOverrides, explanationOverrides]
  );
  const reviewedAttempts = useMemo(
    () =>
      (activeSession?.attempts ?? [])
        .map((attempt) => ({
          attempt,
          question: questionMap.get(attempt.questionId)
        }))
        .filter((item): item is { attempt: Attempt; question: Question } => Boolean(item.question)),
    [activeSession?.attempts, questionMap]
  );
  const questionNumberMap = useMemo(() => {
    const orderedQuestionIds =
      activeSession?.questionOrder && activeSession.questionOrder.length > 0
        ? activeSession.questionOrder
        : activeSession?.attempts.map((attempt) => attempt.questionId) ?? [];

    return new Map(orderedQuestionIds.map((questionId, index) => [questionId, index + 1] as const));
  }, [activeSession?.attempts, activeSession?.questionOrder]);
  const orderedReviewedAttempts = useMemo(
    () =>
      [...reviewedAttempts].sort((left, right) => {
        const leftNumber = questionNumberMap.get(left.attempt.questionId) ?? Number.MAX_SAFE_INTEGER;
        const rightNumber = questionNumberMap.get(right.attempt.questionId) ?? Number.MAX_SAFE_INTEGER;
        return leftNumber - rightNumber;
      }),
    [questionNumberMap, reviewedAttempts]
  );
  const confidenceOverviewItems = useMemo(
    () =>
      orderedReviewedAttempts.map((item, index) => ({
        ...item,
        questionNumber: questionNumberMap.get(item.attempt.questionId) ?? index + 1
      })),
    [orderedReviewedAttempts, questionNumberMap]
  );
  const masteryAnalysis = useMemo(
    () =>
      analyzeMastery(
        confidenceOverviewItems.map(({ attempt, question, questionNumber }) => ({
          questionId: attempt.questionId,
          isCorrect: attempt.isCorrect,
          confidence: attempt.confidence,
          questionNumber,
          question: {
            ...question,
            primaryTag: getQuestionPrimaryTag(question) ?? undefined
          }
        }))
      ),
    [confidenceOverviewItems]
  );
  const masteryReviewItemMap = useMemo(
    () => new Map(masteryAnalysis.reviewItems.map((item) => [item.questionId, item] as const)),
    [masteryAnalysis.reviewItems]
  );
  const wrongAttempts = useMemo(
    () => orderedReviewedAttempts.filter((item) => !item.attempt.isCorrect),
    [orderedReviewedAttempts]
  );
  const derivedSectionStats = useMemo(
    () =>
      activeSession
        ? calculateSectionStats(
            activeSession.attempts,
            reviewedAttempts.map(({ question }) => {
              const primaryTag = getQuestionPrimaryTag(question);
              return primaryTag
                ? { ...question, chapter: question.subject, section: primaryTag }
                : question;
            })
          )
        : [],
    [activeSession, reviewedAttempts]
  );
  const topWeakSections = useMemo(() => getTopWeakSections(derivedSectionStats, 3), [derivedSectionStats]);
  const lowConfidenceAttempts = useMemo(() => {
    const wrongAttemptIds = new Set(wrongAttempts.map((item) => item.attempt.questionId));
    return orderedReviewedAttempts.filter(
      (item) => item.attempt.confidence <= 3 && !wrongAttemptIds.has(item.attempt.questionId)
    );
  }, [orderedReviewedAttempts, wrongAttempts]);
  const reviewNavigationItems = useMemo(() => {
    return buildResultReviewNavigation([
      {
        label: "錯題",
        detailKeys: wrongAttempts.map(
          ({ attempt }, index) => `wrong-${attempt.questionId}-${index}`
        )
      },
      ...(confidenceTrackingEnabled
        ? [
            {
              label: "沒信心",
              detailKeys: lowConfidenceAttempts.map(
                ({ attempt }, index) => `low-confidence-${attempt.questionId}-${index}`
              )
            }
          ]
        : []),
      {
        label: "全部",
        detailKeys: confidenceOverviewItems.map(
          ({ attempt, questionNumber }) => `all-${attempt.questionId}-${questionNumber}`
        )
      }
    ]);
  }, [confidenceOverviewItems, confidenceTrackingEnabled, lowConfidenceAttempts, wrongAttempts]);
  const reviewNavigationIndexMap = useMemo(
    () =>
      new Map(reviewNavigationItems.map((item, index) => [item.detailKey, index] as const)),
    [reviewNavigationItems]
  );
  const activeReviewQuestionIndex = activeReviewDetailKey
    ? reviewNavigationIndexMap.get(activeReviewDetailKey) ?? -1
    : -1;
  const activeReviewNavigationItem =
    activeReviewQuestionIndex >= 0 ? reviewNavigationItems[activeReviewQuestionIndex] : null;
  const simulationSubjectScores = useMemo(() => {
    if (activeSession?.settings?.mode !== "simulation") return [];

    const bucket = new Map<string, { subject: string; correct: number; total: number }>();
    for (const { attempt, question } of reviewedAttempts) {
      const subject = question.subject;
      const current = bucket.get(subject) ?? { subject, correct: 0, total: 0 };
      current.total += 1;
      if (attempt.isCorrect) current.correct += 1;
      bucket.set(subject, current);
    }

    return Array.from(bucket.values()).sort((left, right) => {
      const orderDiff = getSubjectStatOrder(left.subject) - getSubjectStatOrder(right.subject);
      if (orderDiff !== 0) return orderDiff;
      return left.subject.localeCompare(right.subject);
    });
  }, [activeSession?.settings?.mode, reviewedAttempts]);
  const weaknessPracticeFeedback = useMemo(() => {
    if (!activeSession?.settings?.customPoolLabel?.startsWith("考前弱點：")) return null;
    const total = reviewedAttempts.length;
    const correct = reviewedAttempts.filter((item) => item.attempt.isCorrect).length;
    const wrong = total - correct;
    const certainWrong = reviewedAttempts.filter(
      (item) => !item.attempt.isCorrect && item.attempt.confidence === 5
    ).length;
    const uncertainCorrect = reviewedAttempts.filter(
      (item) => item.attempt.isCorrect && item.attempt.confidence <= 3
    ).length;

    return {
      primaryTag: activeSession.settings.sessionName?.trim() || "本觀念群",
      total,
      wrong,
      correctRate: total === 0 ? 0 : Math.round((correct / total) * 100),
      certainWrong,
      uncertainCorrect,
      unresolved: wrong + uncertainCorrect
    };
  }, [activeSession?.settings?.customPoolLabel, activeSession?.settings?.sessionName, reviewedAttempts]);

  function handleRestart() {
    const nextSettings: QuizSettings = {
      ...DEFAULT_QUIZ_SETTINGS,
      ...(activeSession?.settings ?? state.session?.settings ?? {}),
      sessionName: undefined
    };
    clearCurrentSession();
    saveQuizSettings(nextSettings);
    router.push(buildNewQuizHref(nextSettings));
  }

  function handleStartWeaknessReview(section: SectionStats) {
    const sourceQuestion = allQuestions.find(
      (question) =>
        question.subject === section.chapter &&
        getQuestionPrimaryTag(question) === section.section
    );
    if (!sourceQuestion) return;

    const questionOrder = buildWeaknessQuestionOrder({
      questions: allQuestions,
      sessions: state.sessions,
      subject: sourceQuestion.subject,
      primaryTag: section.section
    });
    if (questionOrder.length === 0) return;

    router.push(
      buildNewQuizHref(
        buildWeaknessPracticeSettings({
          subject: sourceQuestion.subject,
          primaryTag: section.section,
          questionOrder
        })
      )
    );
  }

  async function handleSaveSimulationSessionName() {
    if (!state.session || !isSimulationSession(state.session)) return;

    const nextName =
      editableSessionName.trim() || getDefaultSimulationSessionName(state.session) || "模擬考試卷";
    const nextSession: QuizSession = {
      ...state.session,
      settings: {
        ...(state.session.settings ?? DEFAULT_QUIZ_SETTINGS),
        mode: "simulation",
        sessionName: nextName,
        paperMode:
          state.session.settings?.paperMode ??
          getPaperModeFromPaperKey(getPastPaperKeyFromSession(state.session)),
        selectedPaperKey: state.session.settings?.selectedPaperKey ?? getPastPaperKeyFromSession(state.session)
      }
    };

    setIsSavingSessionName(true);
    setSessionNameNotice("");

    saveCompletedSession(nextSession);
    setState((current) => ({
      ...current,
      session: nextSession,
      sessions: current.sessions.map((sessionItem) =>
        sessionItem.id === nextSession.id ? nextSession : sessionItem
      )
    }));

    try {
      await pushCompletedSessionToSupabase(nextSession);
      setSessionNameNotice("已更新試卷名稱。");
    } catch {
      setSessionNameNotice("已更新本機名稱，雲端同步稍後再試。");
    } finally {
      setIsSavingSessionName(false);
    }
  }

  function handleOpenFullscreenReview() {
    setIsFullscreenReview(true);
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => setIsFullscreenReviewVisible(true));
    } else {
      setIsFullscreenReviewVisible(true);
    }
  }

  function handleCloseFullscreenReview() {
    setIsFullscreenReviewVisible(false);
    if (typeof window !== "undefined") {
      window.setTimeout(() => setIsFullscreenReview(false), 260);
    } else {
      setIsFullscreenReview(false);
    }
  }

  function trimDistantReviewDetails(next: Set<string>, anchorKey: string) {
    const anchorIndex = reviewNavigationIndexMap.get(anchorKey);
    while (next.size > MAX_OPEN_REVIEW_DETAILS) {
      const candidates = Array.from(next).filter((candidateKey) => candidateKey !== anchorKey);
      const farthestKey = candidates.reduce<string | null>((selectedKey, candidateKey) => {
        if (!selectedKey) return candidateKey;
        if (anchorIndex === undefined) return selectedKey;
        const selectedIndex = reviewNavigationIndexMap.get(selectedKey);
        const candidateIndex = reviewNavigationIndexMap.get(candidateKey);
        const selectedDistance =
          selectedIndex === undefined ? -1 : Math.abs(selectedIndex - anchorIndex);
        const candidateDistance =
          candidateIndex === undefined ? -1 : Math.abs(candidateIndex - anchorIndex);
        return candidateDistance > selectedDistance ? candidateKey : selectedKey;
      }, null);
      if (!farthestKey) break;
      next.delete(farthestKey);
    }
    return next;
  }

  function setReviewDetailOpen(key: string, isOpen: boolean) {
    setOpenReviewDetailKeys((current) => {
      const next = new Set(current);
      if (isOpen) {
        next.delete(key);
        next.add(key);
        trimDistantReviewDetails(next, key);
      } else {
        next.delete(key);
      }
      return next;
    });
  }

  function rememberReviewScrollAnchor(key: string) {
    if (typeof window === "undefined") return;

    const element =
      reviewDetailElementMapRef.current[key] ?? document.getElementById(`review-${key}`);
    const summary = element?.querySelector(":scope > summary") ?? element;
    if (!summary) return;

    pendingReviewScrollAnchorRef.current = {
      key,
      top: summary.getBoundingClientRect().top
    };
  }

  function toggleReviewDetailOpen(key: string) {
    rememberReviewScrollAnchor(key);
    setActiveReviewDetailKey(key);
    setOpenReviewDetailKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
        return next;
      }

      next.add(key);
      trimDistantReviewDetails(next, key);
      return next;
    });
  }

  function openQuestionReviewDetail(detailKey: string) {
    pendingReviewScrollTargetRef.current = detailKey;
    setActiveReviewDetailKey(detailKey);
    setReviewDetailOpen(detailKey, true);
  }

  function navigateReviewQuestion(direction: -1 | 1) {
    if (reviewNavigationItems.length === 0) return;

    const targetIndex = getResultReviewNavigationTargetIndex(
      reviewNavigationItems.length,
      activeReviewQuestionIndex,
      direction
    );
    const target = reviewNavigationItems[targetIndex];
    if (!target) return;

    pendingReviewScrollTargetRef.current = target.detailKey;
    setActiveReviewDetailKey(target.detailKey);
    setOpenReviewDetailKeys(new Set([target.detailKey]));
  }

  function openMasteryQuestion(questionId: string) {
    const item = confidenceOverviewItems.find(({ attempt }) => attempt.questionId === questionId);
    if (!item) return;
    openQuestionReviewDetail(`all-${item.attempt.questionId}-${item.questionNumber}`);
  }

  function openMasteryCategory(categoryKey: MasteryCategoryKey) {
    const category = masteryAnalysis.categories.find((item) => item.key === categoryKey);
    if (!category || category.questionIds.length === 0) return;
    const questionIds = new Set(category.questionIds);
    const detailKeys = confidenceOverviewItems
      .filter(({ attempt }) => questionIds.has(attempt.questionId))
      .map(({ attempt, questionNumber }) => `all-${attempt.questionId}-${questionNumber}`);
    const firstDetailKey = detailKeys[0];
    if (!firstDetailKey) return;

    pendingReviewScrollTargetRef.current = firstDetailKey;
    setOpenReviewDetailKeys(new Set(detailKeys.slice(0, MAX_OPEN_REVIEW_DETAILS)));
    setActiveReviewDetailKey(firstDetailKey);
  }

  async function handleGenerateQuestionExplanation(
    question: Question,
    attempt: Attempt,
    previousOverride?: QuestionExplanationOverride
  ) {
    if (!session?.access_token) {
      setExplanationErrorMap((current) => ({
        ...current,
        [question.id]: "請先登入帳號，才能使用 AI 補詳解。"
      }));
      return;
    }

    setExplanationLoadingMap((current) => ({ ...current, [question.id]: true }));
    setExplanationErrorMap((current) => ({ ...current, [question.id]: "" }));

    const previousQuestion = findPreviousQuestionForContinuation(
      question,
      Array.from(questionMap.values())
    );
    const sourceQuestion = findQuestionSource(question, [
      ...allQuestions,
      ...(activeSession ? getAISimulationQuestionsForSession(activeSession) : []),
      ...(activeSession?.generatedQuestions ?? [])
    ]);

    try {
      const response = await fetch("/api/question-explanation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          visitorId: getOrCreateVisitorId(),
          accessToken: session?.access_token ?? null,
          question: buildQuestionExplanationRequestQuestion(question, sourceQuestion),
          previousQuestion: previousQuestion ? buildRelatedQuestionContext(previousQuestion) : undefined,
          previousOverride,
          attempt: {
            selectedAnswer: attempt.selectedAnswer,
            confidence: attempt.confidence,
            isCorrect: attempt.isCorrect
          }
        })
      });

      const payload = (await response.json()) as {
        ok: boolean;
        sharedSaved?: boolean;
        explanation?: string;
        optionAnalysis?: Partial<Record<OptionKey, string>>;
        memoryTip?: string;
        model?: string;
        message?: string;
      };

      if (!response.ok || !payload.ok || !payload.explanation) {
        if (response.status === 429 && payload.message && typeof window !== "undefined") {
          window.alert(payload.message);
        }
        setExplanationErrorMap((current) => ({
          ...current,
          [question.id]: payload.message || "AI 詳解產生失敗。"
        }));
        return;
      }

      const override: QuestionExplanationOverride = {
        explanation: payload.explanation ?? "",
        optionAnalysis: payload.optionAnalysis ?? {},
        memoryTip: payload.memoryTip ?? "",
        model: payload.model ?? "gpt-5.4-mini",
        updatedAt: new Date().toISOString()
      };

      clearQuestionExplanationBackgroundCache(question.id);
      saveQuestionExplanationOverride(question.id, override);
      setExplanationOverrides((current) =>
        mergeQuestionExplanationOverrides(current, { [question.id]: override })
      );
    } catch {
      setExplanationErrorMap((current) => ({
        ...current,
        [question.id]: "無法連線到 AI 詳解 API。"
      }));
    } finally {
      setExplanationLoadingMap((current) => ({ ...current, [question.id]: false }));
    }
  }

  if (!mounted) {
    return (
      <main className="shell">
        <div className="rounded-[2rem] bg-white p-4 shadow-card ring-1 ring-slate-100 sm:p-6">載入中...</div>
      </main>
    );
  }

  if (!requestedSessionId) {
    return (
      <main className="shell">
        <section className="rounded-[2rem] bg-white p-5 text-center shadow-card ring-1 ring-slate-100 sm:p-8">
          <h1 className="text-2xl font-semibold text-ink">
            {resultsScope === "simulation" ? "模擬考作答紀錄" : "每次作答紀錄"}
          </h1>
          <p className="mt-3 text-slate-500">
            {resultsScope === "simulation"
              ? "這裡只顯示整份模擬考的結果，不會和平常散題刷題混在一起。"
              : "先選一筆紀錄，再進去看那一次的完整結果頁。"}
          </p>

          <div className="mt-6 grid gap-3 text-left">
            {recentCompletedSessions.length === 0 ? (
              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                目前還沒有已完成的作答紀錄。
              </div>
            ) : (
              visibleCompletedSessions.map((sessionItem, index) => {
                const completedAt = sessionItem.completedAt ?? sessionItem.startedAt;
                const correctCount = sessionItem.attempts.filter((attempt) => attempt.isCorrect).length;
                const totalCount = sessionItem.attempts.length;
                const correctRate = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;

                return (
                  <Link
                    key={sessionItem.id}
                    href={getSessionResultsHref(sessionItem)}
                    className="rounded-3xl border border-slate-200 bg-slate-50 p-4 transition hover:border-brand-200 hover:bg-white"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-ink">
                          {resultsScope === "simulation"
                            ? getSessionDisplayName(sessionItem)
                            : `第 ${recentCompletedSessions.length - index} 筆・${sessionItem.subject}`}
                        </p>
                        <p className="mt-2 text-sm text-slate-500">
                          {getSessionModeLabel(sessionItem)} ・{" "}
                          {new Date(completedAt).toLocaleString("zh-TW", {
                            month: "2-digit",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit"
                          })}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs font-semibold">
                        <span className="rounded-full bg-slate-200 px-3 py-1 text-slate-700">{totalCount} 題</span>
                        <span className={`rounded-full px-3 py-1 ${getAccuracyTone(correctRate)}`}>
                          答對率 {correctRate}%
                        </span>
                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-800">
                          {correctCount} / {totalCount} 答對
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })
            )}
          </div>

          {visibleCompletedSessions.length < recentCompletedSessions.length ? (
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={() => setVisibleHistoryCount((current) => current + RESULTS_HISTORY_PAGE_SIZE)}
                className="min-h-12 rounded-2xl bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-200"
              >
                載入更多
              </button>
            </div>
          ) : null}

          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href={resultsScope === "simulation" ? "/simulation" : "/"}
              className="min-h-12 rounded-2xl bg-slate-100 px-5 py-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-200"
            >
              {resultsScope === "simulation" ? "返回模擬考專區" : "返回首頁"}
            </Link>
            <Link
              href={resultsScope === "simulation" ? "/simulation" : "/quiz"}
              className="min-h-12 rounded-2xl bg-brand-600 px-5 py-4 text-sm font-semibold text-white transition hover:bg-brand-700"
            >
              {resultsScope === "simulation" ? "前往模擬考專區" : "開始測驗"}
            </Link>
          </div>
        </section>
      </main>
    );
  }

  if (!state.session || !state.summary || !state.completionStats) {
    return (
      <main className="shell">
        <section className="rounded-[2rem] bg-white p-5 text-center shadow-card ring-1 ring-slate-100 sm:p-8">
          <h1 className="text-2xl font-semibold text-ink">找不到這次作答紀錄</h1>
          <p className="mt-3 text-slate-500">
            {resultRecordNotice || "這筆結果可能已被清除，或尚未完成作答。"}
          </p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href={resultsScope === "simulation" ? "/simulation-results" : "/results"}
              className="min-h-12 rounded-2xl bg-slate-100 px-5 py-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-200"
            >
              {resultsScope === "simulation" ? "回到模擬考作答紀錄" : "回到作答紀錄"}
            </Link>
            <Link
              href={resultsScope === "simulation" ? "/simulation" : "/quiz"}
              className="min-h-12 rounded-2xl bg-brand-600 px-5 py-4 text-sm font-semibold text-white transition hover:bg-brand-700"
            >
              {resultsScope === "simulation" ? "前往模擬考專區" : "開始測驗"}
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const resultSession = state.session;
  const simulationElapsedSeconds = getSimulationResultElapsedSeconds(resultSession);

  function renderQuestionExplanationControls(question: Question, attempt: Attempt) {
    const generated = explanationOverrides[question.id];
    const loading = explanationLoadingMap[question.id];
    const error = explanationErrorMap[question.id];
    const reportLoading = classificationReportLoadingMap[question.id];
    const reportMessage = classificationReportMessageMap[question.id];

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
              {loading ? "AI 生成中..." : "用 AI 補詳解"}
            </button>
          ) : null}
          {generated ? (
            <>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                已替換詳解・{generated.model ?? "gpt-5.4-mini"}
              </span>
              <button
                type="button"
                onClick={() => void handleGenerateQuestionExplanation(question, attempt, generated)}
                disabled={loading}
                className="min-h-10 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-wait disabled:opacity-60"
              >
                {loading ? "重新生成中..." : "重新替換詳解"}
              </button>
            </>
          ) : null}
          <QuestionReportButton
            question={question}
            disabled={reportLoading}
            classificationLoading={reportLoading}
            classificationMessage={reportMessage}
            onReportClassification={() => void handleReportClassification(question)}
          />
        </div>
        {error ? <p className="text-sm font-medium text-rose-700">{error}</p> : null}
      </div>
    );
  }

  function renderOptionAnalysis(question: Question) {
    if (!question.optionAnalysis || Object.keys(question.optionAnalysis).length === 0) return null;

    return (
      <div className="space-y-2.5">
        {getAvailableOptionKeys(question).map((key) => {
          const text = question.optionAnalysis?.[key];
          if (!text) return null;

          return (
            <div
              key={`${question.id}-option-analysis-${key}`}
              className="rounded-2xl border border-slate-200 bg-slate-50/90 px-3 py-3 sm:px-4"
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex min-w-8 justify-center rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                  {key}
                </span>
                <p className="min-w-0 flex-1 text-sm leading-6 text-slate-700 sm:text-[15px] sm:leading-7">
                  {text}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  function renderExplanationFooter(question: Question, attempt: Attempt) {
    return (
      <div className="space-y-3">
        {renderQuestionExplanationControls(question, attempt)}
      </div>
    );
  }

  function renderQuestionCommunityBadge(questionId: string) {
    const communityStats = communityStatsMap[questionId];
    if (!communityStats || communityStats.totalAttempts <= 0) return null;

    return (
      <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-800 ring-1 ring-sky-200">
        全站 {communityStats.correctRate}%・{communityStats.totalAttempts} 人
      </span>
    );
  }

  function renderQuestionSummaryLine({
    prefix,
    question,
    isCorrect,
    suffix
  }: {
    prefix: string;
    question: Question;
    isCorrect: boolean;
    suffix?: string;
  }) {
    const sourceBadge = getQuestionSourceBadgeLabel(question);
    const primaryTag = getQuestionPrimaryTag(question);
    const trimmedPrefix = prefix.trim();
    const shouldShowPrefix = trimmedPrefix.length > 0;
    const shouldShowLeadingSlash = shouldShowPrefix && !trimmedPrefix.endsWith("：");
    const triangleClass = isCorrect
      ? "text-emerald-600 group-open:text-emerald-700"
      : "text-rose-500 group-open:text-rose-600";
    return (
      <span className="flex max-w-full min-w-0 items-center gap-2 align-top">
        <span
          aria-hidden="true"
          className={`inline-flex h-5 w-5 shrink-0 items-center justify-center transition duration-150 group-open:rotate-90 ${triangleClass}`}
        >
          <span className="block h-0 w-0 border-y-[6px] border-l-[9px] border-y-transparent border-l-current" />
        </span>
        <span className="min-w-0 flex-1 overflow-hidden">
          <span className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-1">
            {shouldShowPrefix ? <span className="shrink-0">{prefix}</span> : null}
            {shouldShowLeadingSlash ? <span className="shrink-0 text-slate-400">/</span> : null}
            {!primaryTag || !primaryTagIncludesSubject(primaryTag, question.subject) ? (
              <span className="shrink-0">{question.subject}</span>
            ) : null}
            {primaryTag ? (
              <>
                {!primaryTagIncludesSubject(primaryTag, question.subject) ? (
                  <span className="shrink-0 text-slate-400">/</span>
                ) : null}
                <span className="max-w-[12rem] truncate text-xs font-semibold text-sky-700">
                  {primaryTag}
                </span>
              </>
            ) : null}
            <span className="shrink-0 text-slate-400">/</span>
            <span className="min-w-[8rem] flex-1 truncate font-semibold">
              {normalizeSummaryStem(question.stem)}
            </span>
            {suffix ? <span className="shrink-0 text-xs font-semibold text-slate-500">{suffix}</span> : null}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1.5">
          <span className="flex items-center gap-1.5">
            {sourceBadge ? (
              <span className="rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-bold text-slate-600 ring-1 ring-slate-200">
                {sourceBadge}
              </span>
            ) : null}
            {renderQuestionCommunityBadge(question.id)}
          </span>
        </span>
      </span>
    );
  }

  function renderAttemptReviewDetails({
    attempt,
    question,
    resultSession,
    optionKeySuffix
  }: {
    attempt: Attempt;
    question: Question;
    resultSession: QuizSession;
    optionKeySuffix: string;
  }) {
    const masteryLabel =
      masteryReviewItemMap.get(attempt.questionId)?.categoryLabel ??
      getMasteryCategoryLabelForAnswer(attempt);
    const shouldCollapseAiExplanation = hasCollapsibleStructuredExplanation(question.explanation);
    const aiExplanationContent = shouldCollapseAiExplanation ? (
      <StructuredExplanationText
        text={question.explanation}
        label=""
        compact
        sectionFilter={(section) => !isDefaultInlineExplanationSectionTitle(section.title)}
        fallbackToFullText={false}
      />
    ) : undefined;
    const displayEliminatedOptions = getResultAttemptEliminatedOptions(resultSession, attempt);

    return (
      <div className="mt-2 min-w-0 space-y-3 overflow-hidden text-sm leading-7 text-slate-700 [overflow-wrap:anywhere]">
        <div className="flex flex-wrap gap-2 text-xs font-semibold">
          <QuestionPrimaryTagBadge question={question} />
        </div>
        <div className="flex min-w-0 items-start gap-3">
          <QuestionStemBlock question={question} className="flex-1" />
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <SavedQuestionButton questionId={question.id} source="results" />
            <CopyQuestionPromptButton
              question={question}
              selectedAnswer={attempt.selectedAnswer}
              correctAnswer={attempt.correctAnswer}
              eliminatedOptions={displayEliminatedOptions}
              className="px-0"
            />
          </div>
        </div>
        <div className="grid gap-3">
          {getAvailableOptionKeys(question).map((key) => {
            const optionState = getResultOptionState(question, attempt, key);
            const isEliminated = displayEliminatedOptions.includes(key);

            return (
              <div key={`${question.id}-${optionKeySuffix}-${key}`} className={optionState.wrapperClassName}>
                <QuestionOptionBlock
                  question={question}
                  optionKey={key}
                  labelClassName={optionState.labelClassName}
                  trailingContent={
                    optionState.badge || isEliminated ? (
                      <>
                        {isEliminated ? (
                          <span
                            aria-label="作答時排除"
                            title="作答時排除"
                            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose-50 text-[13px] font-black leading-none text-rose-700 ring-1 ring-rose-200"
                          >
                            ×
                          </span>
                        ) : null}
                        {optionState.badge ? (
                          <span
                            className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold leading-5 ${optionState.badgeClassName}`}
                          >
                            {optionState.badge}
                          </span>
                        ) : null}
                      </>
                    ) : null
                  }
                />
              </div>
            );
          })}
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white/70 px-3 py-3 shadow-sm sm:px-4">
          <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-2">
              <p className="min-w-0 text-sm font-semibold text-slate-800 sm:text-[15px]">
                我的答案：<span className="font-black text-ink">{attempt.selectedAnswer}</span>
              </p>
              <p className="min-w-0 text-sm font-semibold text-slate-800 sm:text-[15px]">
                正確答案：
                <span className="font-black text-ink">
                  {question.acceptedAnswers?.length &&
                  (question.answerCreditType === "multiple_accepted" ||
                    question.answerCreditType === "multiple_answers")
                    ? `${question.acceptedAnswers.join("/")} 皆可`
                    : question.answerCreditType === "all_credit"
                      ? "本題一律給分"
                      : attempt.correctAnswer}
                </span>
              </p>
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-2 lg:justify-end">
              {confidenceCalibrationEnabled ? (
                <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-black text-slate-700 ring-1 ring-slate-200">
                  <span className="shrink-0 text-slate-500">本題狀態</span>
                  <span className={`rounded-full px-2 py-0.5 ring-1 ${getMasteryBadgeClass(masteryLabel)}`}>
                    {masteryLabel}
                  </span>
                </span>
              ) : null}
              {confidenceTrackingEnabled ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-black text-slate-700 ring-1 ring-slate-200">
                  <span className="text-slate-500">信心</span>
                  <span className="text-ink">{getConfidenceOverviewLabel(attempt.confidence).replace("信心 ", "")}</span>
                </span>
              ) : null}
            </div>
          </div>
          {attempt.errorType || displayEliminatedOptions.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {attempt.errorType ? (
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                  錯因：{attempt.errorType}
                </span>
              ) : null}
              {displayEliminatedOptions.length ? (
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                  作答時排除：{displayEliminatedOptions.join("、")}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
        <QuestionAiMetadataBadges question={question} className="mb-3" />
        <StructuredExplanationText
          text={question.explanation}
          label="詳解"
          compact
          sectionFilter={
            shouldCollapseAiExplanation
              ? (section) => isDefaultInlineExplanationSectionTitle(section.title)
              : undefined
          }
        />
        {renderOptionAnalysis(question)}
        <QuestionExplanationTabs
          question={question}
          compact
          className="mt-3"
          aiExplanationContent={aiExplanationContent}
          relatedQuestionsContent={() => (
            <RelatedQuestionsPanel
              question={question}
              relatedQuestions={allQuestions}
              savedQuestionSource="results"
            />
          )}
        />
        {renderExplanationFooter(question, attempt)}
      </div>
    );
  }

  function renderConfidenceCalibrationSection() {
    if (!confidenceCalibrationEnabled) return null;
    if (masteryAnalysis.total === 0) return null;
    const priorityItems = masteryAnalysis.reviewItems.filter((item) => item.priority > 0).slice(0, 5);
    const visibleTopicStats = masteryAnalysis.topicStats.slice(0, 3);
    const overconfidenceCategory = masteryAnalysis.categories.find(
      (category) => category.key === "overconfidence_error"
    );
    const examEstimate = masteryAnalysis.examPassEstimate;
    const examBadgeLabel = examEstimate.sampleWarning ?? examEstimate.passBadgeLabel;

    return (
      <section className="mt-4 rounded-[2rem] bg-white p-4 shadow-card ring-1 ring-slate-100 sm:p-5">
        <button
          type="button"
          onClick={() => setIsConfidenceCalibrationOpen((current) => !current)}
          aria-expanded={isConfidenceCalibrationOpen}
          className="flex w-full flex-wrap items-center justify-between gap-3 text-left"
        >
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">信心校準</p>
            <p className="mt-1 text-sm text-slate-500">
              {masteryAnalysis.masteryLevel.label}・正式考 60 分機率 {examEstimate.predictivePassProbabilityPercent}%
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-100">
              {examBadgeLabel}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              建議先回顧 {masteryAnalysis.reviewCount} 題
            </span>
            <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white transition">
              {isConfidenceCalibrationOpen ? "收起" : "展開"}
            </span>
          </div>
        </button>

        <div
          className={`grid transition-[grid-template-rows,opacity] duration-500 ease-out ${
            isConfidenceCalibrationOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
          }`}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="mt-4 space-y-4">
              <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
                <div className="space-y-3">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-black text-ink">本輪判讀</p>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600 ring-1 ring-slate-200">
                        信心校準：{masteryAnalysis.calibrationLabel}
                      </span>
                    </div>
                    <div className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                      {masteryAnalysis.summarySentences.map((sentence) => (
                        <p key={sentence}>{sentence}</p>
                      ))}
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {examEstimate.currentMockScore !== null ? (
                        <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-200">
                          <p className="text-[11px] font-black text-slate-500">本次模擬考分數</p>
                          <p className="mt-1 text-xl font-black text-ink">
                            {examEstimate.currentMockScore} / 100
                          </p>
                          <p className="mt-1 text-xs font-semibold text-slate-500">
                            {examEstimate.currentMockPassed ? "本次已達 60 分及格線" : "本次尚未達 60 分及格線"}
                          </p>
                        </div>
                      ) : null}
                      <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-200">
                        <p className="text-[11px] font-black text-slate-500">正式考 60 分及格機率估計</p>
                        <p className="mt-1 text-xl font-black text-ink">
                          {examEstimate.predictivePassProbabilityPercent}%
                        </p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">
                          假設正式考卷與本次練習的範圍、難度、題型相近
                        </p>
                      </div>
                      <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-200">
                        <p className="text-[11px] font-black text-slate-500">預估正式考分數</p>
                        <p className="mt-1 text-xl font-black text-ink">
                          {formatExamScore(examEstimate.expectedExamScore)} / 100
                        </p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">
                          80% 可能範圍：{examEstimate.scoreRange80[0]}–{examEstimate.scoreRange80[1]} 分
                        </p>
                      </div>
                      <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-200">
                        <p className="text-[11px] font-black text-slate-500">能力超過 60% 的機率</p>
                        <p className="mt-1 text-xl font-black text-ink">
                          {examEstimate.abilityAbovePassProbabilityPercent}%
                        </p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">
                          根據目前題目估計真實答對能力是否已超過及格線
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 rounded-2xl bg-white px-4 py-3 text-xs font-semibold leading-5 text-slate-600 ring-1 ring-slate-200">
                      {masteryAnalysis.sampleMessage}
                      {masteryAnalysis.hasMissingConfidence ? (
                        <span className="mt-1 block text-amber-700">
                          有 {masteryAnalysis.missingConfidenceCount} 題缺少 1-4 信心資料，掌握度僅供參考。
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {overconfidenceCategory && overconfidenceCategory.count > 0 ? (
                    <button
                      type="button"
                      onClick={() => openMasteryCategory("overconfidence_error")}
                      className="w-full rounded-2xl border border-rose-200 bg-rose-50 p-4 text-left text-sm font-semibold leading-6 text-rose-950 transition hover:-translate-y-0.5 hover:shadow-sm"
                    >
                      優先處理信心 4 但答錯的題目，這類題最容易在正式考試中穩定失分。
                      <span className="mt-2 block text-xs font-black">打開 {overconfidenceCategory.count} 題錯誤自信</span>
                    </button>
                  ) : null}

                  <div className="rounded-2xl border border-slate-200 bg-white p-3">
                    <div className="flex items-center justify-between gap-3 px-1">
                      <p className="text-sm font-black text-ink">優先回顧</p>
                      <p className="text-[11px] font-semibold text-slate-500">點一下打開題目</p>
                    </div>
                    <div className="mt-3 space-y-2">
                      {priorityItems.length === 0 ? (
                        <div className="rounded-2xl bg-emerald-50 px-3 py-3 text-sm font-semibold text-emerald-900">
                          這輪沒有需要優先處理的高風險題。
                        </div>
                      ) : (
                        priorityItems.map((item, index) => (
                          <button
                            key={`${item.questionId}-${item.priority}`}
                            type="button"
                            onClick={() => openMasteryQuestion(item.questionId)}
                            className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${getMasteryToneClass(
                              masteryAnalysis.categories.find((category) => category.key === item.categoryKey)?.tone ?? "slate"
                            )}`}
                          >
                            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/75 text-sm font-black shadow-sm">
                              {index + 1}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-black">{item.categoryLabel}</span>
                              <span className="block truncate text-xs font-semibold opacity-75">
                                第 {item.questionNumber ?? "—"} 題・信心 {item.confidence}
                              </span>
                            </span>
                            <span className="shrink-0 text-xs font-black">優先 {item.priority}</span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "穩定掌握率", value: formatNullablePercent(masteryAnalysis.stableMasteryPercent) },
                      { label: "基礎缺口", value: formatNullablePercent(masteryAnalysis.basicGapPercent) },
                      { label: "概念不穩", value: formatNullablePercent(masteryAnalysis.shakyConceptPercent) },
                      { label: "不穩答對", value: formatNullablePercent(masteryAnalysis.unstableCorrectPercent) }
                    ].map((item) => (
                      <div key={item.label} className="rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200">
                        <p className="text-[11px] font-bold text-slate-500">{item.label}</p>
                        <p className="mt-1 text-2xl font-black text-ink">{item.value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-2xl bg-slate-50 p-3">
                    <div className="flex flex-wrap items-end justify-between gap-2 px-1 pb-3">
                      <div>
                        <p className="text-sm font-black text-ink">六分類地圖</p>
                        <p className="mt-1 text-xs font-medium text-slate-500">
                          每類都可以點開對應題目。
                        </p>
                      </div>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {masteryAnalysis.categories.map((category, index) => (
                        <button
                          key={category.key}
                          type="button"
                          onClick={() => openMasteryCategory(category.key)}
                          disabled={category.count === 0}
                          className={`relative overflow-hidden rounded-2xl border p-3 text-left transition hover:-translate-y-0.5 hover:shadow-sm disabled:cursor-default disabled:opacity-55 disabled:hover:translate-y-0 disabled:hover:shadow-none ${getMasteryToneClass(category.tone)}`}
                          style={{
                            transitionDelay: isConfidenceCalibrationOpen ? `${index * 35}ms` : "0ms"
                          }}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-black">{category.label}</p>
                              <p className="mt-1 line-clamp-2 text-[11px] font-semibold leading-4 opacity-75">
                                {category.action}
                              </p>
                            </div>
                            <span className="shrink-0 rounded-full bg-white/80 px-2.5 py-1 text-sm font-black shadow-sm">
                              {category.count}
                            </span>
                          </div>
                          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/70">
                            <span
                              className={`block h-full rounded-full ${getMasteryAccentClass(category.tone)} transition-transform duration-700`}
                              style={{
                                transform: isConfidenceCalibrationOpen ? "scaleX(1)" : "scaleX(0)",
                                transformOrigin: "left"
                              }}
                            />
                          </div>
                          <p className="mt-2 text-[11px] font-bold opacity-75">
                            佔可校準題 {formatNullablePercent(category.percent)}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-end justify-between gap-2">
                    <div>
                      <p className="text-sm font-black text-ink">信心分層</p>
                      <p className="mt-1 text-xs font-medium text-slate-500">
                        信心越高，答對率理論上應該越高。
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                      {masteryAnalysis.biasLabel}
                    </span>
                  </div>
                  <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200">
                    {masteryAnalysis.confidenceLayers.map((layer) => (
                      <div
                        key={layer.confidence}
                        className="grid grid-cols-[4.5rem_1fr] gap-3 border-b border-slate-100 px-3 py-3 last:border-b-0 sm:grid-cols-[5rem_1fr_5rem_5rem_6rem]"
                      >
                        <p className="text-sm font-black text-ink">信心 {layer.confidence}</p>
                        <p className="text-xs font-semibold text-slate-500">
                          {layer.total === 0
                            ? "目前沒有此類題目"
                            : `${layer.total} 題・答對 ${layer.correct}・答錯 ${layer.wrong}`}
                        </p>
                        <p className="hidden text-sm font-black text-ink sm:block">
                          {formatNullablePercent(layer.observedAccuracyPercent)}
                        </p>
                        <p className="hidden text-xs font-semibold text-slate-500 sm:block">
                          預期 {Math.round(layer.expectedProbability * 100)}%
                        </p>
                        <p className="text-xs font-black text-slate-600 sm:text-right">{layer.status}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {visibleTopicStats.length > 0 ? (
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-sm font-black text-ink">最需要補強的單元</p>
                    <div className="mt-3 space-y-2">
                      {visibleTopicStats.map((topic) => (
                        <div key={topic.key} className="rounded-2xl bg-slate-50 px-3 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-black text-ink">{topic.label}</p>
                              <p className="mt-1 text-xs font-semibold text-slate-500">
                                {topic.subject}・{topic.total} 題
                              </p>
                            </div>
                            <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-black text-slate-700 ring-1 ring-slate-200">
                              掌握 {formatNullablePercent(topic.calibratedMasteryPercent)}
                            </span>
                          </div>
                          <p className="mt-2 text-xs font-semibold text-slate-500">
                            錯誤自信 {topic.overconfidenceCount} 題・猜對風險 {topic.guessingRiskCount} 題
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  function renderConfidenceOverviewSection() {
    return (
      <section className="min-w-0 rounded-[2rem] bg-white p-4 shadow-card ring-1 ring-slate-100 sm:p-5">
        <button
          type="button"
          onClick={() => {
            setIsConfidenceOverviewOpen((current) => !current);
            setIsStudyRecommendationsOpen(false);
          }}
          aria-expanded={isConfidenceOverviewOpen}
          className="flex w-full items-center justify-between gap-4 text-left"
        >
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-ink">信心度總覽</h2>
            <p className="mt-1 truncate text-sm text-slate-500">
              {confidenceOverviewItems.length} 題・答錯 {wrongAttempts.length} 題・依正式題號排列
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="hidden items-center gap-1 sm:flex" aria-hidden="true">
              {[1, 2, 3, 4].map((confidenceValue) => (
                <span
                  key={confidenceValue}
                  className={`h-5 w-5 rounded-md border ${getConfidenceTileClass(confidenceValue)}`}
                />
              ))}
            </div>
            <span className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white">
              {isConfidenceOverviewOpen ? "收起" : "展開"}
            </span>
          </div>
        </button>

        {isConfidenceOverviewOpen ? (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-2 text-[11px] font-bold">
                {[
                  { label: "1", value: 1 },
                  { label: "2", value: 2 },
                  { label: "3", value: 3 },
                  { label: "4", value: 4 }
                ].map((confidenceValue) => (
                  <span
                    key={confidenceValue.label}
                    className={`inline-flex h-7 min-w-7 items-center justify-center rounded-lg border px-2 shadow-sm ${getConfidenceTileClass(confidenceValue.value)}`}
                  >
                    {confidenceValue.label}
                  </span>
                ))}
              </div>
              <button
                type="button"
                onClick={() => void handleDownloadConfidenceOverview()}
                className="inline-flex min-h-9 items-center justify-center rounded-full bg-slate-900 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-400"
              >
                截圖
              </button>
            </div>

            <div className="mt-4 grid grid-cols-5 gap-2 sm:grid-cols-10">
              {confidenceOverviewItems.map(({ attempt, questionNumber }) => {
                const detailKey = `all-${attempt.questionId}-${questionNumber}`;
                return (
                  <button
                    key={detailKey}
                    type="button"
                    onClick={() => openQuestionReviewDetail(detailKey)}
                    title={`第 ${questionNumber} 題・${attempt.isCorrect ? "答對" : "答錯"}・${getConfidenceOverviewLabel(attempt.confidence)}`}
                    aria-label={`第 ${questionNumber} 題，${attempt.isCorrect ? "答對" : "答錯"}，${getConfidenceOverviewLabel(attempt.confidence)}`}
                    className={`relative aspect-square min-h-10 rounded-xl border-2 text-center text-sm font-black shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 ${getConfidenceTileClass(attempt.confidence)}`}
                  >
                    <span
                      className={`absolute right-1.5 top-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-black leading-none ${
                        attempt.isCorrect
                          ? "bg-white/85 text-emerald-700"
                          : "bg-white/90 text-rose-700"
                      }`}
                    >
                      {attempt.isCorrect ? "對" : "錯"}
                    </span>
                    <span className="flex h-full items-center justify-center pt-1">
                      {questionNumber}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </section>
    );
  }

  function renderReviewSection(fullscreenMobile = false) {
    return (
      <section
        ref={fullscreenMobile ? undefined : reviewSectionRef}
        className={
          fullscreenMobile
            ? "bg-transparent p-0 shadow-none ring-0"
            : "rounded-[2rem] bg-white p-4 shadow-card ring-1 ring-slate-100 sm:p-6"
        }
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-ink">題目回顧</h2>
            <p className="mt-2 text-sm text-slate-500">先看錯題，再往下展開全部題目做完整複盤。</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            {!fullscreenMobile ? (
              <button
                type="button"
                onClick={handleOpenFullscreenReview}
                className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-200 sm:hidden"
                aria-label="開啟滿版題目回顧"
                title="開啟滿版題目回顧"
              >
                ⛶ 滿版模式
              </button>
            ) : null}
            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">最多展開 2 題</span>
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
                wrongAttempts.map(({ attempt, question }, index) => {
                  const detailKey = `wrong-${attempt.questionId}-${index}`;
                  const isOpen = openReviewDetailKeys.has(detailKey);
                  const masteryLabel =
                    masteryReviewItemMap.get(attempt.questionId)?.categoryLabel ??
                    getMasteryCategoryLabelForAnswer(attempt);

                  return (
                    <details
                      key={detailKey}
                      id={`review-${detailKey}`}
                      ref={(node) => {
                        reviewDetailElementMapRef.current[detailKey] = node;
                      }}
                      open={isOpen}
                      className="group overflow-hidden rounded-2xl bg-rose-50 p-3.5 sm:p-4"
                    >
                      <summary
                        onClick={(event) => {
                          event.preventDefault();
                          toggleReviewDetailOpen(detailKey);
                        }}
                        className="cursor-pointer overflow-hidden text-sm font-semibold text-rose-950 list-none [&::-webkit-details-marker]:hidden"
                      >
                        {renderQuestionSummaryLine({
                          prefix: `錯題 ${index + 1}：`,
                          question,
                          isCorrect: attempt.isCorrect,
                          suffix: confidenceCalibrationEnabled ? masteryLabel : undefined
                        })}
                      </summary>
                      {isOpen
                        ? renderAttemptReviewDetails({
                            attempt,
                            question,
                            resultSession,
                            optionKeySuffix: "wrong"
                          })
                        : null}
                    </details>
                  );
                })
              )}
            </div>
          </div>

          {confidenceTrackingEnabled ? (
            <div>
              <h3 className="text-base font-semibold text-ink">沒信心題目回顧</h3>
              <div className="mt-3 grid gap-3">
                {lowConfidenceAttempts.length === 0 ? (
                  <div className="rounded-2xl bg-sky-50 p-4 text-sm text-sky-900">
                    這輪沒有標記為低信心的題目。
                  </div>
                ) : (
                  lowConfidenceAttempts.map(({ attempt, question }, index) => {
                    const detailKey = `low-confidence-${attempt.questionId}-${index}`;
                    const isOpen = openReviewDetailKeys.has(detailKey);
                    const questionNumber = questionNumberMap.get(attempt.questionId) ?? index + 1;
                    const masteryLabel =
                      masteryReviewItemMap.get(attempt.questionId)?.categoryLabel ??
                      getMasteryCategoryLabelForAnswer(attempt);

                    return (
                      <details
                        key={detailKey}
                        id={`review-${detailKey}`}
                        ref={(node) => {
                          reviewDetailElementMapRef.current[detailKey] = node;
                        }}
                        open={isOpen}
                        className="group overflow-hidden rounded-2xl bg-amber-50 p-3.5 sm:p-4"
                      >
                        <summary
                          onClick={(event) => {
                            event.preventDefault();
                            toggleReviewDetailOpen(detailKey);
                          }}
                          className="cursor-pointer overflow-hidden text-sm font-semibold text-amber-950 list-none [&::-webkit-details-marker]:hidden"
                        >
                          {renderQuestionSummaryLine({
                            prefix: `第 ${questionNumber} 題：`,
                            question,
                            isCorrect: attempt.isCorrect,
                            suffix: confidenceCalibrationEnabled ? masteryLabel : undefined
                          })}
                        </summary>
                        {isOpen
                          ? renderAttemptReviewDetails({
                              attempt,
                              question,
                              resultSession,
                              optionKeySuffix: "low"
                            })
                          : null}
                      </details>
                    );
                  })
                )}
              </div>
            </div>
          ) : null}

          <div>
            <h3 className="text-base font-semibold text-ink">全部題目回顧</h3>
            <div className="mt-3 grid gap-3">
              {confidenceOverviewItems.map(({ attempt, question, questionNumber }) => {
                const detailKey = `all-${attempt.questionId}-${questionNumber}`;
                const isOpen = openReviewDetailKeys.has(detailKey);
                const masteryLabel =
                  masteryReviewItemMap.get(attempt.questionId)?.categoryLabel ??
                  getMasteryCategoryLabelForAnswer(attempt);

                return (
                  <details
                    key={detailKey}
                    id={`review-${detailKey}`}
                    ref={(node) => {
                      reviewDetailElementMapRef.current[detailKey] = node;
                    }}
                    open={isOpen}
                    className="group overflow-hidden rounded-2xl bg-slate-50 p-3.5 sm:p-4"
                  >
                    <summary
                      onClick={(event) => {
                        event.preventDefault();
                        toggleReviewDetailOpen(detailKey);
                      }}
                      className="cursor-pointer overflow-hidden text-sm font-semibold text-ink list-none [&::-webkit-details-marker]:hidden"
                    >
                      {renderQuestionSummaryLine({
                        prefix: `第 ${questionNumber} 題：`,
                        question,
                        isCorrect: attempt.isCorrect,
                        suffix: confidenceCalibrationEnabled
                          ? `${masteryLabel}・${getConfidenceOverviewLabel(attempt.confidence)}`
                          : undefined
                      })}
                    </summary>
                    {isOpen
                      ? renderAttemptReviewDetails({
                          attempt,
                          question,
                          resultSession,
                          optionKeySuffix: "all"
                        })
                      : null}
                  </details>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <main className="shell">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">Results</p>
          <h1 className="mt-2 text-3xl font-bold text-ink sm:text-4xl">
            {getSessionSubjectLabel(state.session, reviewedAttempts)}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            本輪模式：{getSessionModeLabel(state.session)}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            完成時間：
            {new Date(state.session.completedAt ?? state.session.startedAt).toLocaleString("zh-TW", {
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit"
            })}
          </p>
          {simulationElapsedSeconds !== null ? (
            <p className="mt-1 text-sm text-slate-500">
              作答時間：
              <span className="font-mono font-semibold tabular-nums text-slate-700">
                {formatResultDurationClock(simulationElapsedSeconds)}
              </span>
            </p>
          ) : null}
          {isSimulationSession(state.session) ? (
            <div className="mt-4 flex flex-col gap-3 sm:max-w-xl sm:flex-row sm:items-center">
              <input
                value={editableSessionName}
                onChange={(event) => setEditableSessionName(event.target.value)}
                className="min-h-12 flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none"
                placeholder="替這份模擬考命名"
              />
              <button
                type="button"
                onClick={handleSaveSimulationSessionName}
                disabled={isSavingSessionName}
                className="min-h-12 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSavingSessionName ? "儲存中..." : "儲存名稱"}
              </button>
            </div>
          ) : null}
          {sessionNameNotice ? (
            <p className="mt-2 text-sm text-emerald-700">{sessionNameNotice}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href={resultsScope === "simulation" ? "/simulation-results" : "/results"}
            className="min-h-12 rounded-2xl bg-slate-100 px-5 py-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-200"
          >
            {resultsScope === "simulation" ? "回到模擬考作答紀錄" : "回到作答紀錄"}
          </Link>
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
        <ResultSummary
          summary={state.summary}
          masteryAnalysis={confidenceCalibrationEnabled ? masteryAnalysis : undefined}
        />
        {weaknessPracticeFeedback ? (
          <section className="mt-4 border-y border-slate-200 py-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-500">觀念群複習</p>
                <h2 className="mt-1 break-words text-xl font-semibold text-ink">
                  {weaknessPracticeFeedback.primaryTag}
                </h2>
              </div>
              <Link
                href="/progress/weakness"
                className="min-h-12 rounded-2xl bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-200"
              >
                返回弱點分析
              </Link>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <p className="text-sm text-slate-500">本輪</p>
                <p className="mt-1 text-lg font-semibold text-ink">{weaknessPracticeFeedback.total} 題</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">答對率</p>
                <p className="mt-1 text-lg font-semibold text-ink">{weaknessPracticeFeedback.correctRate}%</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">答錯</p>
                <p className="mt-1 text-lg font-semibold text-ink">{weaknessPracticeFeedback.wrong} 題</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">仍需查看</p>
                <p className="mt-1 text-lg font-semibold text-ink">{weaknessPracticeFeedback.unresolved} 題</p>
              </div>
            </div>
            {weaknessPracticeFeedback.certainWrong > 0 || weaknessPracticeFeedback.uncertainCorrect > 0 ? (
              <p className="mt-4 text-sm text-slate-500">
                {weaknessPracticeFeedback.certainWrong > 0
                  ? `很確定但答錯 ${weaknessPracticeFeedback.certainWrong} 題`
                  : ""}
                {weaknessPracticeFeedback.certainWrong > 0 && weaknessPracticeFeedback.uncertainCorrect > 0
                  ? " ・ "
                  : ""}
                {weaknessPracticeFeedback.uncertainCorrect > 0
                  ? `不確定但答對 ${weaknessPracticeFeedback.uncertainCorrect} 題`
                  : ""}
              </p>
            ) : null}
          </section>
        ) : null}
        {renderConfidenceCalibrationSection()}
        {simulationSubjectScores.length > 0 ? (
          <section className="mt-4 rounded-[2rem] bg-white p-4 shadow-card ring-1 ring-slate-100 sm:p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-ink">模擬考分科得分</h2>
                <p className="mt-1 text-sm text-slate-500">本次各科答對題數 / 該科總題數。</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                總分 {state.summary.correct} / {state.summary.total}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-5">
              {simulationSubjectScores.map((item) => (
                <article key={item.subject} className="rounded-2xl bg-slate-50 px-3 py-3 ring-1 ring-slate-200 last:col-span-2 lg:last:col-span-1">
                  <p className="text-sm font-medium text-slate-500">{item.subject}</p>
                  <p className="mt-1 text-xl font-bold text-ink">
                    {item.correct}
                    <span className="ml-1 text-base font-semibold text-slate-500">/ {item.total}</span>
                  </p>
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </div>

      <div className="mt-8 space-y-6">
        <div
          className={`grid gap-3 ${
            confidenceCalibrationEnabled &&
            isSimulationSession(state.session) &&
            confidenceOverviewItems.length > 0 &&
            !isStudyRecommendationsOpen &&
            !isConfidenceOverviewOpen
              ? "xl:grid-cols-2"
              : ""
          }`}
        >
          <section className="min-w-0 rounded-[2rem] bg-white p-4 shadow-card ring-1 ring-slate-100 sm:p-5">
            <button
              type="button"
              onClick={() => {
                setIsStudyRecommendationsOpen((current) => !current);
                setIsConfidenceOverviewOpen(false);
              }}
              aria-expanded={isStudyRecommendationsOpen}
              className="flex w-full items-center justify-between gap-4 text-left"
            >
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-ink">補強建議</h2>
                <p className="mt-1 truncate text-sm text-slate-500">
                  優先補強：{topWeakSections[0]?.section ?? state.lowCompletion[0]?.section ?? "目前無資料"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="hidden rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-800 sm:inline-flex">
                  {topWeakSections.length > 0 ? `${topWeakSections.length} 個弱項` : "摘要"}
                </span>
                <span className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white">
                  {isStudyRecommendationsOpen ? "收起" : "展開"}
                </span>
              </div>
            </button>

            {isStudyRecommendationsOpen ? (
              <div className="mt-4 border-t border-slate-100 pt-4">
                <div className="grid gap-3 lg:grid-cols-3">
              <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-900">
                最需要補弱的小節：{topWeakSections.map((section) => section.section).join("、") || "目前無資料"}
              </div>
              <div className="rounded-2xl bg-sky-50 px-4 py-3 text-sm leading-6 text-sky-900">
                最需要補進度：{state.lowCompletion.map((section) => section.section).join("、") || "目前無資料"}
              </div>
              <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
                已完成但不穩：{state.unstableSections.map((section) => section.section).join("、") || "目前無資料"}
              </div>
                </div>
                <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
              {isSavedQuestionReviewSettings(state.session.settings) ? (
                <Link
                  href="/saved-questions"
                  className="min-h-11 rounded-2xl bg-brand-600 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-brand-700"
                >
                  回儲存題目繼續
                </Link>
              ) : (
                <>
                  <Link
                    href={buildNewQuizHref({
                      ...DEFAULT_QUIZ_SETTINGS,
                      ...(activeSession?.settings ?? state.session?.settings ?? {}),
                      sessionName: undefined
                    })}
                    onClick={() =>
                      saveQuizSettings({
                        ...DEFAULT_QUIZ_SETTINGS,
                        ...(activeSession?.settings ?? state.session?.settings ?? {}),
                        sessionName: undefined
                      })
                    }
                    className="min-h-11 rounded-2xl bg-brand-600 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-brand-700"
                  >
                    用同一設定再刷一次
                  </Link>
                  <Link
                    href="/review"
                    className="min-h-11 rounded-2xl bg-slate-100 px-4 py-3 text-center text-sm font-semibold text-slate-800 transition hover:bg-slate-200"
                  >
                    先看錯題複習頁
                  </Link>
                </>
              )}
              <div className="grid grid-cols-2 gap-2" role="group" aria-label="AI 補弱 Prompt 版本">
                <button
                  type="button"
                  aria-pressed={aiPromptDetailLevel === "concise"}
                  onClick={() => setAiPromptDetailLevel("concise")}
                  className={`min-h-11 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                    aiPromptDetailLevel === "concise"
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  簡略
                </button>
                <button
                  type="button"
                  aria-pressed={aiPromptDetailLevel === "detailed"}
                  onClick={() => setAiPromptDetailLevel("detailed")}
                  className={`min-h-11 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                    aiPromptDetailLevel === "detailed"
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  詳細
                </button>
              </div>
              <button
                type="button"
                onClick={() => void handleCopyAIPrompt()}
                disabled={!state.promptTexts[aiPromptDetailLevel]}
                className="min-h-11 rounded-2xl bg-slate-900 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                複製{aiPromptDetailLevel === "detailed" ? "詳細" : "簡略"}版 AI 補弱 Prompt
              </button>
                </div>
              </div>
            ) : null}
          </section>
          {confidenceCalibrationEnabled && isSimulationSession(state.session) && confidenceOverviewItems.length > 0
            ? renderConfidenceOverviewSection()
            : null}
        </div>

        {renderReviewSection()}
        <WeaknessRanking
          sections={topWeakSections}
          onStartReview={handleStartWeaknessReview}
        />
      </div>
      {confidenceOverviewItems.length > 0 && !isFullscreenReview && isReviewNavigatorVisible ? (
        <nav
          aria-label="題目回顧快速導覽"
          className="fixed bottom-[calc(env(safe-area-inset-bottom)+1rem)] right-4 z-40 flex w-14 flex-col items-center gap-1.5 rounded-2xl bg-white p-1.5 shadow-2xl ring-1 ring-slate-200 sm:right-6"
        >
          <button
            type="button"
            onClick={() => navigateReviewQuestion(-1)}
            disabled={activeReviewQuestionIndex === 0}
            aria-label="展開上一題"
            title="展開上一題"
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-xl font-black text-slate-800 transition hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-35"
          >
            ↑
          </button>
          <span
            aria-live="polite"
            className="flex max-w-full flex-col items-center px-0.5 text-center font-black leading-tight text-slate-500"
          >
            <span className="max-w-full truncate text-[9px]">
              {activeReviewNavigationItem?.sectionLabel ?? "題目"}
            </span>
            <span className="text-[10px] tabular-nums">
              {activeReviewNavigationItem
                ? `${activeReviewNavigationItem.sectionIndex + 1}/${activeReviewNavigationItem.sectionTotal}`
                : "—"}
            </span>
          </span>
          <button
            type="button"
            onClick={() => navigateReviewQuestion(1)}
            disabled={activeReviewQuestionIndex === reviewNavigationItems.length - 1}
            aria-label="展開下一題"
            title="展開下一題"
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-xl font-black text-white transition hover:bg-black focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-35"
          >
            ↓
          </button>
        </nav>
      ) : null}
      {copyPromptNotice ? (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center px-6">
          <div className="rounded-2xl bg-slate-950 px-5 py-3 text-base font-semibold text-white shadow-2xl ring-1 ring-white/10">
            已經複製，可以貼進自己的 AI
          </div>
        </div>
      ) : null}
      {confidenceOverviewDownloadNotice ? (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center px-6">
          <div className="rounded-2xl bg-slate-950 px-5 py-3 text-base font-semibold text-white shadow-2xl ring-1 ring-white/10">
            已下載信心度總覽
          </div>
        </div>
      ) : null}
      {isFullscreenReview ? (
        <div
          className={`fixed inset-0 z-50 bg-[color:var(--bg-base)] transition-opacity duration-300 ease-out overscroll-none sm:hidden ${
            isFullscreenReviewVisible ? "opacity-100" : "opacity-0"
          }`}
        >
          <div
            className={`flex h-full flex-col transition-transform duration-300 ease-out ${
              isFullscreenReviewVisible ? "translate-y-0" : "translate-y-full"
            }`}
          >
            <div className="flex items-center justify-between gap-3 border-b px-4 py-3 shadow-sm border-[color:var(--line-soft)] bg-[color:var(--surface)] backdrop-blur">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">Fullscreen Review</p>
                <h2 className="text-lg font-bold text-ink">題目回顧</h2>
              </div>
              <button
                type="button"
                onClick={handleCloseFullscreenReview}
                className="min-h-11 rounded-2xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-200"
              >
                返回頁面
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-0 py-0">
              {renderReviewSection(true)}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

export default function ResultsPage() {
  return (
    <Suspense
      fallback={
        <main className="shell">
          <div className="rounded-[2rem] bg-white p-4 shadow-card ring-1 ring-slate-100 sm:p-6">
            載入中...
          </div>
        </main>
      }
    >
      <ResultsPageContent />
    </Suspense>
  );
}
