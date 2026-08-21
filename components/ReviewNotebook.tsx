"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { CopyQuestionPromptButton } from "@/components/CopyQuestionPromptButton";
import { QuestionAiMetadataBadges } from "@/components/QuestionAiMetadataBadges";
import { getCloudSyncRetryDelayMs } from "@/lib/cloudSyncWriteGuard";
import { QuestionExplanationTabs } from "@/components/QuestionExplanationTabs";
import { QuestionOptionBlock, QuestionStemBlock } from "@/components/QuestionMediaBlock";
import { QuestionPrimaryTagBadge } from "@/components/QuestionPrimaryTagBadge";
import { QuestionReportButton } from "@/components/QuestionIssueReportButton";
import { RelatedQuestionsPanel } from "@/components/RelatedQuestionsPanel";
import { SavedQuestionButton } from "@/components/SavedQuestionButton";
import {
  StructuredExplanationText,
  hasCollapsibleStructuredExplanation,
  isDefaultInlineExplanationSectionTitle
} from "@/components/StructuredExplanationText";
import {
  clearQuestionExplanationBackgroundCache,
  loadConfirmedQuestionClassificationOverrides,
  loadQuestionCommunityStats,
  loadSharedQuestionExplanationOverrides
} from "@/lib/cloudSync";
import { applyQuestionClassificationOverride } from "@/data/med1QuestionBank";
import {
  applyQuestionExplanationOverride,
  loadReviewCompletionThreshold,
  loadQuestionExplanationOverrides,
  mergeQuestionExplanationOverrides,
  type ReviewCompletionThreshold,
  saveQuestionExplanationOverride,
  saveQuestionExplanationOverrides
} from "@/lib/storage";
import { getReviewCompletionThresholdPreference } from "@/lib/accountPreferences";
import { getOrCreateVisitorId } from "@/lib/visitor";
import { getQuestionPrimaryTag, primaryTagIncludesSubject } from "@/lib/analysisPrimaryTag";
import { useAuth } from "@/components/AuthProvider";
import {
  buildRelatedQuestionContext,
  findPreviousQuestionForContinuation
} from "@/lib/questionContext";
import {
  buildQuestionExplanationRequestQuestion,
  findQuestionSource
} from "@/lib/questionExplanationRequest";
import {
  OptionKey,
  Question,
  QuestionClassificationOverride,
  QuestionCommunityStats,
  QuestionExplanationOverride,
  ReviewQuestionItem,
  SubjectName
} from "@/types/quiz";

type RenderedReviewQuestionItem = ReviewQuestionItem & {
  renderedQuestion: Question;
};

export type ManualReviewState = {
  resolvedIds: Set<string>;
  unresolvedIds: Set<string>;
  resolvedAtById: Map<string, string>;
  unresolvedAtById: Map<string, string>;
};

type RemoteManualReviewStateRecord = {
  scope: string;
  questionId: string;
  state: "resolved" | "unresolved";
  updatedAt: string;
};

function createEmptyManualReviewState(): ManualReviewState {
  return {
    resolvedIds: new Set<string>(),
    unresolvedIds: new Set<string>(),
    resolvedAtById: new Map<string, string>(),
    unresolvedAtById: new Map<string, string>()
  };
}

function parseManualReviewState(rawValue: string | null): ManualReviewState {
  if (!rawValue) return createEmptyManualReviewState();

  try {
    const parsed = JSON.parse(rawValue) as {
      resolvedIds?: unknown;
      unresolvedIds?: unknown;
      resolvedAtById?: unknown;
      unresolvedAtById?: unknown;
    };
    const resolvedIds = new Set(
      Array.isArray(parsed.resolvedIds)
        ? parsed.resolvedIds.filter((id): id is string => typeof id === "string")
        : []
    );
    const unresolvedIds = new Set(
      Array.isArray(parsed.unresolvedIds)
        ? parsed.unresolvedIds.filter((id): id is string => typeof id === "string")
        : []
    );
    const parseTimestampMap = (value: unknown, allowedIds: Set<string>) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return new Map<string, string>();
      return new Map(
        Object.entries(value as Record<string, unknown>).filter(
          (entry): entry is [string, string] =>
            allowedIds.has(entry[0]) && typeof entry[1] === "string" && entry[1].trim().length > 0
        )
      );
    };

    return {
      resolvedIds,
      unresolvedIds,
      resolvedAtById: parseTimestampMap(parsed.resolvedAtById, resolvedIds),
      unresolvedAtById: parseTimestampMap(parsed.unresolvedAtById, unresolvedIds)
    };
  } catch {
    return createEmptyManualReviewState();
  }
}

function serializeManualReviewState(state: ManualReviewState) {
  return JSON.stringify({
    resolvedIds: Array.from(state.resolvedIds),
    unresolvedIds: Array.from(state.unresolvedIds),
    resolvedAtById: Object.fromEntries(state.resolvedAtById),
    unresolvedAtById: Object.fromEntries(state.unresolvedAtById),
    updatedAt: new Date().toISOString()
  });
}

export const MANUAL_REVIEW_STATE_CHANGE_EVENT = "manual-review-state-change";

function getManualReviewStorageKey(scope: string, userId?: string | null) {
  const normalizedUserId = userId?.trim() || "guest";
  return `quiz-review-notebook-manual-state:${scope}:${normalizedUserId}`;
}

function getLegacyManualReviewStorageKey(scope: string) {
  return `quiz-review-notebook-manual-state:${scope}`;
}

function safeReadManualReviewStateValues(key: string) {
  if (typeof window === "undefined") return [] as string[];
  const values: string[] = [];

  try {
    const localValue = window.localStorage.getItem(key);
    if (localValue) values.push(localValue);
  } catch {
    // localStorage can fail in private mode or when storage is full.
  }

  try {
    const sessionValue = window.sessionStorage.getItem(key);
    if (sessionValue) values.push(sessionValue);
  } catch {
    // sessionStorage fallback is best-effort.
  }

  return Array.from(new Set(values));
}

function mergeManualReviewStates(states: ManualReviewState[]) {
  type ManualAction = {
    status: "resolved" | "unresolved";
    timestamp: string;
    order: number;
  };

  const actions = new Map<string, ManualAction>();
  let order = 0;

  const shouldReplace = (current: ManualAction | undefined, next: ManualAction) => {
    if (!current) return true;
    if (next.timestamp && current.timestamp && next.timestamp !== current.timestamp) {
      return next.timestamp > current.timestamp;
    }
    if (next.timestamp && !current.timestamp) return true;
    if (!next.timestamp && current.timestamp) return false;
    return next.order >= current.order;
  };

  const consider = (id: string, action: ManualAction) => {
    const current = actions.get(id);
    if (shouldReplace(current, action)) {
      actions.set(id, action);
    }
  };

  for (const state of states) {
    for (const id of state.resolvedIds) {
      consider(id, {
        status: "resolved",
        timestamp: state.resolvedAtById.get(id) ?? "",
        order: order++
      });
    }

    for (const id of state.unresolvedIds) {
      consider(id, {
        status: "unresolved",
        timestamp: state.unresolvedAtById.get(id) ?? "",
        order: order++
      });
    }
  }

  const merged = createEmptyManualReviewState();
  for (const [id, action] of actions) {
    if (action.status === "resolved") {
      merged.resolvedIds.add(id);
      if (action.timestamp) merged.resolvedAtById.set(id, action.timestamp);
    } else {
      merged.unresolvedIds.add(id);
      if (action.timestamp) merged.unresolvedAtById.set(id, action.timestamp);
    }
  }

  return merged;
}

export function readManualReviewStateForScope(scope: string, userId?: string | null) {
  if (typeof window === "undefined") return createEmptyManualReviewState();
  return mergeManualReviewStates([
    ...safeReadManualReviewStateValues(getLegacyManualReviewStorageKey(scope)).map(parseManualReviewState),
    ...safeReadManualReviewStateValues(getManualReviewStorageKey(scope, userId)).map(parseManualReviewState)
  ]);
}

function safeSaveManualReviewState(key: string, state: ManualReviewState) {
  if (typeof window === "undefined") return false;
  const serialized = serializeManualReviewState(state);

  try {
    window.localStorage.setItem(key, serialized);
    try {
      window.sessionStorage.removeItem(key);
    } catch {
      // Ignore cleanup failures.
    }
    return true;
  } catch {
    try {
      window.sessionStorage.setItem(key, serialized);
      return true;
    } catch {
      return false;
    }
  }
}

function dispatchManualReviewStateChange(scope: string, userId: string, state: ManualReviewState) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(MANUAL_REVIEW_STATE_CHANGE_EVENT, {
      detail: {
        scope,
        userId,
        resolvedIds: Array.from(state.resolvedIds),
        unresolvedIds: Array.from(state.unresolvedIds)
      }
    })
  );
}

function manualReviewStateToRemoteRecords(scope: string, state: ManualReviewState) {
  const records: RemoteManualReviewStateRecord[] = [];
  const now = new Date().toISOString();

  for (const questionId of state.resolvedIds) {
    records.push({
      scope,
      questionId,
      state: "resolved",
      updatedAt: state.resolvedAtById.get(questionId) ?? now
    });
  }

  for (const questionId of state.unresolvedIds) {
    records.push({
      scope,
      questionId,
      state: "unresolved",
      updatedAt: state.unresolvedAtById.get(questionId) ?? now
    });
  }

  return records;
}

function remoteRecordsToManualReviewState(records: RemoteManualReviewStateRecord[], scope: string) {
  const state = createEmptyManualReviewState();

  for (const record of records) {
    if (record.scope !== scope || !record.questionId) continue;
    const updatedAt = typeof record.updatedAt === "string" ? record.updatedAt : "";
    if (record.state === "resolved") {
      state.resolvedIds.add(record.questionId);
      if (updatedAt) state.resolvedAtById.set(record.questionId, updatedAt);
      continue;
    }

    if (record.state === "unresolved") {
      state.unresolvedIds.add(record.questionId);
      if (updatedAt) state.unresolvedAtById.set(record.questionId, updatedAt);
    }
  }

  return state;
}

async function syncManualReviewStateWithCloud(
  scope: string,
  accessToken: string,
  state: ManualReviewState
) {
  const response = await fetch("/api/review-question-states", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      action: "sync",
      scope,
      records: manualReviewStateToRemoteRecords(scope, state)
    })
  });

  const payload = (await response.json().catch(() => null)) as {
    ok?: boolean;
    message?: string;
    records?: RemoteManualReviewStateRecord[];
  } | null;

  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.message || "複習完成區雲端同步失敗。");
  }

  return remoteRecordsToManualReviewState(Array.isArray(payload.records) ? payload.records : [], scope);
}

function formatTime(value?: string) {
  if (!value) return "尚未作答";
  return new Date(value).toLocaleString("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function compareByRecent(a: ReviewQuestionItem, b: ReviewQuestionItem) {
  const timeA = a.history.lastAttemptedAt ? new Date(a.history.lastAttemptedAt).getTime() : 0;
  const timeB = b.history.lastAttemptedAt ? new Date(b.history.lastAttemptedAt).getTime() : 0;
  return timeB - timeA || b.riskScore - a.riskScore || b.history.wrong - a.history.wrong;
}

function sortByRecent<T extends ReviewQuestionItem>(items: T[]) {
  return [...items].sort(compareByRecent);
}

export function useReviewCompletionThreshold() {
  const { user } = useAuth();
  const [threshold, setThreshold] = useState<ReviewCompletionThreshold>(() =>
    loadReviewCompletionThreshold(2)
  );

  useEffect(() => {
    const nextThreshold = user
      ? getReviewCompletionThresholdPreference(user.user_metadata, 2)
      : loadReviewCompletionThreshold(2);
    setThreshold(nextThreshold);
  }, [user?.id, user?.user_metadata]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleThresholdChange = (event: Event) => {
      const detail = (event as CustomEvent<ReviewCompletionThreshold>).detail;
      setThreshold(detail === 1 || detail === 2 ? detail : loadReviewCompletionThreshold(2));
    };

    window.addEventListener("review-completion-threshold-change", handleThresholdChange);
    return () => {
      window.removeEventListener("review-completion-threshold-change", handleThresholdChange);
    };
  }, []);

  return threshold;
}

export function isResolvedReviewItem(
  item: ReviewQuestionItem,
  completionThreshold: ReviewCompletionThreshold = 2
) {
  if (item.history.wrong > 0) {
    return item.history.correctStreakAfterLatestWrong >= completionThreshold;
  }

  return item.history.lowConfidence > 0 && item.history.correctStreakAfterLatestRisk >= completionThreshold;
}

export function isReviewItemResolved(
  item: ReviewQuestionItem,
  manualState?: ManualReviewState,
  completionThreshold: ReviewCompletionThreshold = 2
) {
  const questionId = item.question.id;
  if (manualState?.unresolvedIds.has(questionId)) return false;
  if (manualState?.resolvedIds.has(questionId)) return true;
  return isResolvedReviewItem(item, completionThreshold);
}

export function getUnresolvedReviewItems(
  items: ReviewQuestionItem[],
  manualState?: ManualReviewState,
  completionThreshold: ReviewCompletionThreshold = 2
) {
  return items.filter((item) => !isReviewItemResolved(item, manualState, completionThreshold));
}

function sortResolvedItems<T extends ReviewQuestionItem>(items: T[], manualState: ManualReviewState) {
  return [...items].sort((a, b) => {
    const manualResolvedAtA = manualState.resolvedAtById.get(a.question.id) ?? "";
    const manualResolvedAtB = manualState.resolvedAtById.get(b.question.id) ?? "";

    if (manualResolvedAtA || manualResolvedAtB) {
      return manualResolvedAtB.localeCompare(manualResolvedAtA) || compareByRecent(a, b);
    }

    return compareByRecent(a, b);
  });
}

function getMoveBackLabel(item: ReviewQuestionItem) {
  return item.history.wrong > 0 ? "移回錯題庫" : "移回沒信心題";
}

function PencilIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none">
      <path
        d="M4.75 19.25l4.45-1.05 9.65-9.65a2.1 2.1 0 0 0 0-2.98l-.42-.42a2.1 2.1 0 0 0-2.98 0L5.8 14.8l-1.05 4.45Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14.25 6.35l3.4 3.4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none">
      <path
        d="M5 12.5l4.25 4.25L19.5 6.5"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function applyLocalExplanationOverride(
  question: Question,
  override?: QuestionExplanationOverride
) {
  if (!override) return question;
  return {
    ...question,
    explanation: override.explanation || question.explanation,
    optionAnalysis:
      override.optionAnalysis && Object.keys(override.optionAnalysis).length > 0
        ? { ...question.optionAnalysis, ...override.optionAnalysis }
        : question.optionAnalysis,
    memoryTip: override.memoryTip || question.memoryTip
  };
}

function getOptionKeys(item: ReviewQuestionItem) {
  return (["A", "B", "C", "D", "E"] as OptionKey[]).filter(
    (key) => typeof item.question.options[key] === "string"
  );
}

function getOptionKeysFromQuestion(question: Question) {
  return (["A", "B", "C", "D", "E"] as OptionKey[]).filter(
    (key) => typeof question.options[key] === "string"
  );
}

function renderQuestionReview(
  item: ReviewQuestionItem,
  renderedQuestion: Question,
  headerActions: ReactNode,
  footer: ReactNode,
  relatedQuestionsContent?: () => ReactNode
) {
  const primaryTag = getQuestionPrimaryTag(renderedQuestion);
  const shouldCollapseAiExplanation = hasCollapsibleStructuredExplanation(renderedQuestion.explanation);
  const aiExplanationContent = shouldCollapseAiExplanation ? (
    <StructuredExplanationText
      text={renderedQuestion.explanation}
      label=""
      compact
      sectionFilter={(section) => !isDefaultInlineExplanationSectionTitle(section.title)}
      fallbackToFullText={false}
    />
  ) : undefined;

  return (
    <div className="mt-4 space-y-3 leading-7">
      <div className="flex flex-wrap gap-2 text-xs font-semibold">
        {!primaryTag || !primaryTagIncludesSubject(primaryTag, renderedQuestion.subject) ? (
          <span className="rounded-full bg-brand-100 px-3 py-1 text-brand-800">
            {renderedQuestion.subject}
          </span>
        ) : null}
        <QuestionPrimaryTagBadge question={renderedQuestion} />
      </div>
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <QuestionStemBlock question={renderedQuestion} className="min-w-0 flex-1" />
        {headerActions}
      </div>
      <p>
        <span className="font-semibold">最後錯因：</span>
        {item.history.latestErrorType ?? "未填"}
      </p>
      <div className="space-y-2.5">
        {getOptionKeys(item).map((key) => (
          <QuestionOptionBlock
            key={`${item.question.id}-${key}`}
            question={renderedQuestion}
            optionKey={key}
            wrapperClassName="rounded-2xl border border-slate-200 bg-slate-50/90 px-3 py-3 sm:px-4"
          />
        ))}
      </div>
      <p>
        <span className="font-semibold">正確答案：</span>
        {(renderedQuestion.answerCreditType === "multiple_accepted" ||
          renderedQuestion.answerCreditType === "multiple_answers") &&
        renderedQuestion.acceptedAnswers?.length
          ? `${renderedQuestion.acceptedAnswers.join("/")} 皆可`
          : renderedQuestion.answerCreditType === "all_credit"
            ? "本題一律給分"
            : renderedQuestion.answer}
      </p>
      <QuestionAiMetadataBadges question={renderedQuestion} />
      <StructuredExplanationText
        text={renderedQuestion.explanation}
        label="重點解析"
        compact
        sectionFilter={
          shouldCollapseAiExplanation
            ? (section) => isDefaultInlineExplanationSectionTitle(section.title)
            : undefined
        }
      />
      {renderedQuestion.optionAnalysis ? (
        <div className="space-y-2.5">
          {getOptionKeysFromQuestion(renderedQuestion).map((key) => {
            const text = renderedQuestion.optionAnalysis?.[key];
            if (!text) return null;
            return (
              <div
                key={`${renderedQuestion.id}-analysis-${key}`}
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
      ) : null}
      <QuestionExplanationTabs
        question={renderedQuestion}
        compact
        className="mt-3"
        aiExplanationContent={aiExplanationContent}
        relatedQuestionsContent={relatedQuestionsContent}
      />
      {footer}
    </div>
  );
}

type ReviewNotebookProps = {
  items: ReviewQuestionItem[];
  allQuestions: Question[];
  title?: string;
  description?: string;
  startLabel?: string;
  startHref?: string;
  getStartHref?: (items: ReviewQuestionItem[]) => string;
  onStartReview?: (items: ReviewQuestionItem[]) => void;
  fullscreenMobile?: boolean;
  headerAction?: ReactNode;
  manualEditScope?: string;
  completionThreshold?: ReviewCompletionThreshold;
  emptyMessage?: string;
};

export function ReviewNotebook({
  items,
  allQuestions,
  title = "錯題與低信心題筆記",
  description = "先把錯題和沒信心的題目分開看，每區都依最近作答時間排序。",
  startLabel = "開始錯題複習",
  startHref = "/quiz?new=1",
  getStartHref,
  onStartReview,
  fullscreenMobile = false,
  headerAction,
  manualEditScope,
  completionThreshold,
  emptyMessage = "目前還沒有累積錯題或低信心題，先去刷一輪題目吧。"
}: ReviewNotebookProps) {
  const { session, user } = useAuth();
  const accountCompletionThreshold = useReviewCompletionThreshold();
  const effectiveCompletionThreshold = completionThreshold ?? accountCompletionThreshold;
  const [explanationOverrides, setExplanationOverrides] = useState<Record<string, QuestionExplanationOverride>>({});
  const [explanationLoadingMap, setExplanationLoadingMap] = useState<Record<string, boolean>>({});
  const [explanationErrorMap, setExplanationErrorMap] = useState<Record<string, string>>({});
  const [classificationReportLoadingMap, setClassificationReportLoadingMap] = useState<Record<string, boolean>>({});
  const [classificationReportMessageMap, setClassificationReportMessageMap] = useState<Record<string, string>>({});
  const [classificationOverrides, setClassificationOverrides] = useState<Record<string, QuestionClassificationOverride>>({});
  const [communityStatsMap, setCommunityStatsMap] = useState<Record<string, QuestionCommunityStats>>({});
  const [openQuestionIds, setOpenQuestionIds] = useState<Set<string>>(() => new Set());
  const [activeCategory, setActiveCategory] = useState<"wrong" | "lowConfidence" | "resolved">("wrong");
  const [visibleCountByCategory, setVisibleCountByCategory] = useState({
    wrong: 40,
    lowConfidence: 40,
    resolved: 40
  });
  const [selectedSubjects, setSelectedSubjects] = useState<SubjectName[]>([]);
  const [isManualEditMode, setIsManualEditMode] = useState(false);
  const [manualReviewPersistenceError, setManualReviewPersistenceError] = useState("");
  const [manualReviewState, setManualReviewState] = useState<ManualReviewState>(() =>
    createEmptyManualReviewState()
  );
  const manualReviewRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const manualReviewRetryFailureCountRef = useRef(0);
  const manualEditingEnabled = Boolean(manualEditScope);
  const manualReviewUserId = user?.id ?? "guest";
  const manualReviewStorageKey = manualEditScope
    ? getManualReviewStorageKey(manualEditScope, manualReviewUserId)
    : "";
  const questionIdsKey = useMemo(
    () => items.map((item) => item.question.id).join("|"),
    [items]
  );
  const selectedSubjectsKey = useMemo(
    () => selectedSubjects.join("|"),
    [selectedSubjects]
  );
  const renderedAllQuestions = useMemo(
    () =>
      allQuestions.map((question) =>
        applyQuestionClassificationOverride(question, classificationOverrides[question.id])
      ),
    [allQuestions, classificationOverrides]
  );
  const renderedItems = useMemo<RenderedReviewQuestionItem[]>(
    () =>
      items.map((item) => ({
        ...item,
        renderedQuestion: applyQuestionClassificationOverride(
          item.question,
          classificationOverrides[item.question.id]
        )
      })),
    [items, classificationOverrides]
  );
  const availableSubjects = useMemo(
    () =>
      Array.from(new Set(renderedItems.map((item) => item.renderedQuestion.subject))).sort((a, b) =>
        a.localeCompare(b, "zh-Hant")
      ) as SubjectName[],
    [renderedItems]
  );
  const filteredItems = useMemo(
    () =>
      selectedSubjects.length === 0
        ? renderedItems
        : renderedItems.filter((item) => selectedSubjects.includes(item.renderedQuestion.subject)),
    [renderedItems, selectedSubjects]
  );
  const unresolvedItems = useMemo(
    () =>
      filteredItems.filter((item) =>
        !isReviewItemResolved(item, manualReviewState, effectiveCompletionThreshold)
      ),
    [effectiveCompletionThreshold, filteredItems, manualReviewState]
  );
  const resolvedItems = useMemo(
    () =>
      sortResolvedItems(
        filteredItems.filter((item) =>
          isReviewItemResolved(item, manualReviewState, effectiveCompletionThreshold)
        ),
        manualReviewState
      ),
    [effectiveCompletionThreshold, filteredItems, manualReviewState]
  );
  const wrongItems = useMemo(
    () => sortByRecent(unresolvedItems.filter((item) => item.history.wrong > 0)),
    [unresolvedItems]
  );
  const lowConfidenceItems = useMemo(
    () => sortByRecent(unresolvedItems.filter((item) => item.history.lowConfidence > 0)),
    [unresolvedItems]
  );
  const activeItems = useMemo(
    () =>
      activeCategory === "wrong"
        ? wrongItems
        : activeCategory === "lowConfidence"
          ? lowConfidenceItems
          : resolvedItems,
    [activeCategory, lowConfidenceItems, resolvedItems, wrongItems]
  );
  const visibleCount = visibleCountByCategory[activeCategory] ?? 40;
  const visibleItems = useMemo(
    () => activeItems.slice(0, visibleCount),
    [activeItems, visibleCount]
  );
  const visibleQuestionIds = useMemo(
    () => visibleItems.map((item) => item.question.id),
    [visibleItems]
  );
  const visibleQuestionIdsKey = useMemo(() => visibleQuestionIds.join("|"), [visibleQuestionIds]);
  const effectiveStartHref = useMemo(
    () => getStartHref?.(unresolvedItems) ?? startHref,
    [getStartHref, startHref, unresolvedItems]
  );

  useEffect(() => {
    if (activeCategory === "resolved" && resolvedItems.length === 0) {
      if (wrongItems.length > 0) {
        setActiveCategory("wrong");
        return;
      }

      if (lowConfidenceItems.length > 0) {
        setActiveCategory("lowConfidence");
        return;
      }
    }

    if (activeCategory === "wrong" && wrongItems.length === 0 && lowConfidenceItems.length > 0) {
      setActiveCategory("lowConfidence");
      return;
    }

    if (activeCategory === "lowConfidence" && lowConfidenceItems.length === 0 && wrongItems.length > 0) {
      setActiveCategory("wrong");
      return;
    }

    if (
      activeCategory !== "resolved" &&
      wrongItems.length === 0 &&
      lowConfidenceItems.length === 0 &&
      resolvedItems.length > 0
    ) {
      setActiveCategory("resolved");
    }
  }, [activeCategory, lowConfidenceItems.length, resolvedItems.length, wrongItems.length]);

  useEffect(() => {
    setVisibleCountByCategory((current) => {
      if (
        current.wrong === 40 &&
        current.lowConfidence === 40 &&
        current.resolved === 40
      ) {
        return current;
      }

      return {
        wrong: 40,
        lowConfidence: 40,
        resolved: 40
      };
    });
  }, [questionIdsKey, selectedSubjectsKey]);

  useEffect(() => {
    setSelectedSubjects((current) => {
      const next = current.filter((subject) => availableSubjects.includes(subject));
      const unchanged =
        next.length === current.length && next.every((subject, index) => subject === current[index]);
      return unchanged ? current : next;
    });
  }, [availableSubjects]);

  function applyManualReviewCloudState(cloudState: ManualReviewState) {
    if (!manualEditScope || !manualReviewStorageKey) return;
    const latestLocalState = readManualReviewStateForScope(manualEditScope, manualReviewUserId);
    const mergedState = mergeManualReviewStates([latestLocalState, cloudState]);
    safeSaveManualReviewState(manualReviewStorageKey, mergedState);
    setManualReviewState(mergedState);
    dispatchManualReviewStateChange(manualEditScope, manualReviewUserId, mergedState);
    setManualReviewPersistenceError("");
    manualReviewRetryFailureCountRef.current = 0;
  }

  function scheduleManualReviewCloudRetry(accessToken: string) {
    if (!manualEditScope || !manualReviewStorageKey || typeof window === "undefined") return;
    if (manualReviewRetryTimerRef.current) return;

    const retryDelayMs = getCloudSyncRetryDelayMs(
      manualReviewRetryFailureCountRef.current
    );
    manualReviewRetryFailureCountRef.current += 1;

    manualReviewRetryTimerRef.current = setTimeout(() => {
      manualReviewRetryTimerRef.current = null;
      const latestLocalState = readManualReviewStateForScope(manualEditScope, manualReviewUserId);
      void syncManualReviewStateWithCloud(manualEditScope, accessToken, latestLocalState)
        .then(applyManualReviewCloudState)
        .catch((error) => {
          setManualReviewPersistenceError(
            error instanceof Error && error.message.trim()
              ? error.message
              : "完成區已先保存在這台裝置，雲端同步稍後會再試。"
          );
          scheduleManualReviewCloudRetry(accessToken);
        });
    }, retryDelayMs);
  }

  useEffect(() => {
    return () => {
      if (manualReviewRetryTimerRef.current) {
        clearTimeout(manualReviewRetryTimerRef.current);
        manualReviewRetryTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!manualEditScope || !manualReviewStorageKey || typeof window === "undefined") {
      if (manualReviewRetryTimerRef.current) {
        clearTimeout(manualReviewRetryTimerRef.current);
        manualReviewRetryTimerRef.current = null;
      }
      setManualReviewState(createEmptyManualReviewState());
      setManualReviewPersistenceError("");
      manualReviewRetryFailureCountRef.current = 0;
      return;
    }

    if (manualReviewRetryTimerRef.current) {
      clearTimeout(manualReviewRetryTimerRef.current);
      manualReviewRetryTimerRef.current = null;
    }

    const localState = readManualReviewStateForScope(manualEditScope, manualReviewUserId);
    manualReviewRetryFailureCountRef.current = 0;
    setManualReviewState(localState);
    setIsManualEditMode(false);
    setManualReviewPersistenceError("");

    if (!session?.access_token) return;

    let cancelled = false;
    void syncManualReviewStateWithCloud(manualEditScope, session.access_token, localState)
      .then((cloudState) => {
        if (cancelled) return;
        applyManualReviewCloudState(cloudState);
      })
      .catch((error) => {
        if (cancelled) return;
        setManualReviewPersistenceError(
          error instanceof Error && error.message.trim()
            ? error.message
            : "完成區會先保存在這台裝置，稍後再同步雲端。"
        );
        scheduleManualReviewCloudRetry(session.access_token);
      });

    return () => {
      cancelled = true;
      if (manualReviewRetryTimerRef.current) {
        clearTimeout(manualReviewRetryTimerRef.current);
        manualReviewRetryTimerRef.current = null;
      }
    };
  }, [manualEditScope, manualReviewStorageKey, manualReviewUserId, session?.access_token]);

  useEffect(() => {
    if (!manualEditScope || typeof window === "undefined") return;

    const handleManualReviewStateChange = (event: Event) => {
      const detail = (event as CustomEvent<{ scope?: string; userId?: string }>).detail;
      if (detail?.scope && detail.scope !== manualEditScope) return;
      if (detail?.userId && detail.userId !== manualReviewUserId) return;
      setManualReviewState(readManualReviewStateForScope(manualEditScope, manualReviewUserId));
    };

    window.addEventListener(MANUAL_REVIEW_STATE_CHANGE_EVENT, handleManualReviewStateChange);
    return () => {
      window.removeEventListener(MANUAL_REVIEW_STATE_CHANGE_EVENT, handleManualReviewStateChange);
    };
  }, [manualEditScope, manualReviewUserId]);

  function toggleSubject(subject: SubjectName) {
    setSelectedSubjects((current) =>
      current.includes(subject)
        ? current.filter((item) => item !== subject)
        : [...current, subject]
    );
  }

  function clearSubjectFilter() {
    setSelectedSubjects([]);
  }

  function updateManualReviewState(updater: (current: ManualReviewState) => ManualReviewState) {
    if (!manualReviewStorageKey || !manualEditScope) return;
    const accessToken = session?.access_token;

    setManualReviewState((current) => {
      const persisted = readManualReviewStateForScope(manualEditScope, manualReviewUserId);
      const next = updater(mergeManualReviewStates([persisted, current]));
      const savedLocally = safeSaveManualReviewState(manualReviewStorageKey, next);
      setManualReviewPersistenceError(
        savedLocally ? "" : "完成區暫時無法寫入瀏覽器儲存，請先不要關閉這個分頁。"
      );
      dispatchManualReviewStateChange(manualEditScope, manualReviewUserId, next);

      if (accessToken) {
        void syncManualReviewStateWithCloud(manualEditScope, accessToken, next)
          .then(applyManualReviewCloudState)
          .catch((error) => {
            setManualReviewPersistenceError(
              error instanceof Error && error.message.trim()
                ? error.message
                : "完成區已先保存在這台裝置，雲端同步稍後會再試。"
            );
            scheduleManualReviewCloudRetry(accessToken);
          });
      }

      return next;
    });
  }

  function moveReviewItemToResolved(questionId: string) {
    updateManualReviewState((current) => {
      const resolvedIds = new Set(current.resolvedIds);
      const unresolvedIds = new Set(current.unresolvedIds);
      const resolvedAtById = new Map(current.resolvedAtById);
      const unresolvedAtById = new Map(current.unresolvedAtById);
      resolvedIds.add(questionId);
      unresolvedIds.delete(questionId);
      resolvedAtById.set(questionId, new Date().toISOString());
      unresolvedAtById.delete(questionId);
      return { resolvedIds, unresolvedIds, resolvedAtById, unresolvedAtById };
    });
  }

  function moveReviewItemBackToQueue(questionId: string) {
    updateManualReviewState((current) => {
      const resolvedIds = new Set(current.resolvedIds);
      const unresolvedIds = new Set(current.unresolvedIds);
      const resolvedAtById = new Map(current.resolvedAtById);
      const unresolvedAtById = new Map(current.unresolvedAtById);
      resolvedIds.delete(questionId);
      unresolvedIds.add(questionId);
      resolvedAtById.delete(questionId);
      unresolvedAtById.set(questionId, new Date().toISOString());
      return { resolvedIds, unresolvedIds, resolvedAtById, unresolvedAtById };
    });
  }

  function setQuestionDetailsOpen(questionId: string, isOpen: boolean) {
    setOpenQuestionIds((current) => {
      const next = new Set(current);
      if (isOpen) {
        next.add(questionId);
      } else {
        next.delete(questionId);
      }
      return next;
    });
  }

  useEffect(() => {
    async function fetchCommunityStats() {
      if (visibleQuestionIds.length === 0) return;

      const missingQuestionIds = visibleQuestionIds.filter((id) => !communityStatsMap[id]);
      if (missingQuestionIds.length === 0) return;

      try {
        const stats = await loadQuestionCommunityStats(missingQuestionIds);
        setCommunityStatsMap((current) => ({
          ...current,
          ...Object.fromEntries(stats.map((item) => [item.questionId, item] as const))
        }));
      } catch {
        // keep review UI usable without stats
      }
    }

    void fetchCommunityStats();
  }, [visibleQuestionIdsKey]);

  useEffect(() => {
    setExplanationOverrides((current) =>
      mergeQuestionExplanationOverrides(current, loadQuestionExplanationOverrides())
    );
  }, [questionIdsKey]);

  useEffect(() => {
    if (!questionIdsKey) return;
    const questionIds = questionIdsKey.split("|");

    void loadConfirmedQuestionClassificationOverrides(questionIds)
      .then((overrides) => setClassificationOverrides(overrides))
      .catch(() => {
        // keep static classification if override fetch fails
      });
  }, [questionIdsKey]);

  useEffect(() => {
    async function fetchSharedExplanationOverrides() {
      if (visibleQuestionIds.length === 0) return;

      try {
        const sharedOverrides = await loadSharedQuestionExplanationOverrides(visibleQuestionIds);
        if (Object.keys(sharedOverrides).length === 0) return;

        saveQuestionExplanationOverrides(sharedOverrides);
        setExplanationOverrides((current) =>
          mergeQuestionExplanationOverrides(current, sharedOverrides)
        );
      } catch {
        // keep local overrides only
      }
    }

    void fetchSharedExplanationOverrides();
  }, [visibleQuestionIdsKey]);

  async function handleGenerateQuestionExplanation(
    question: Question,
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

    const previousQuestion = findPreviousQuestionForContinuation(question, allQuestions);
    const sourceQuestion = findQuestionSource(question, allQuestions);

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
            selectedAnswer: question.answer,
            confidence: 3,
            isCorrect: false
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

  function renderQuestionTopActions(question: Question) {
    const communityStats = communityStatsMap[question.id];

    return (
      <div className="flex shrink-0 flex-wrap items-center gap-2 sm:max-w-[45%] sm:justify-end">
        <SavedQuestionButton questionId={question.id} source="review" />
        <CopyQuestionPromptButton
          question={question}
          correctAnswer={question.answer}
        />
        {communityStats && communityStats.totalAttempts > 0 ? (
          <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800 ring-1 ring-sky-200">
            全站答對率 {communityStats.correctRate}% ・ {communityStats.totalAttempts} 人作答
          </span>
        ) : null}
      </div>
    );
  }

  function renderExplanationFooter(question: Question) {
    const override = explanationOverrides[question.id];
    const loading = explanationLoadingMap[question.id];
    const error = explanationErrorMap[question.id];
    const reportLoading = classificationReportLoadingMap[question.id];
    const reportMessage = classificationReportMessageMap[question.id];

    return (
      <div className="space-y-2 rounded-2xl bg-white/80 p-3 ring-1 ring-slate-100">
        <div className="flex flex-wrap items-center gap-2">
          {override ? (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              已替換詳解・{override.model ?? "gpt-5.4-mini"}
            </span>
          ) : null}
          {!override ? (
            <button
              type="button"
              onClick={() => void handleGenerateQuestionExplanation(question)}
              disabled={loading}
              className="min-h-10 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-wait disabled:opacity-60"
            >
              {loading ? "AI 生成中..." : "用 AI 補詳解"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleGenerateQuestionExplanation(question, override)}
              disabled={loading}
              className="min-h-10 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-wait disabled:opacity-60"
            >
              {loading ? "重新生成中..." : "重新替換詳解"}
            </button>
          )}
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

  return (
    <section
      className={
        fullscreenMobile
          ? "bg-transparent p-0 shadow-none ring-0"
          : "workspace-section p-4 sm:p-5"
      }
    >
      {manualEditingEnabled && items.length > 0 ? (
        <button
          type="button"
          onClick={() => setIsManualEditMode((current) => !current)}
          className={`fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] right-[calc(1.25rem+env(safe-area-inset-right))] z-[60] inline-flex h-14 w-14 items-center justify-center rounded-full shadow-xl ring-1 transition focus:outline-none focus:ring-4 ${
            isManualEditMode
              ? "bg-emerald-600 text-white ring-emerald-200 hover:bg-emerald-700 focus:ring-emerald-200"
              : "bg-slate-950 text-white ring-slate-300 hover:bg-slate-800 focus:ring-slate-200"
          }`}
          aria-label={isManualEditMode ? "完成編輯待複習題庫" : "編輯待複習題庫"}
          title={isManualEditMode ? "完成" : "編輯"}
        >
          {isManualEditMode ? <CheckIcon /> : <PencilIcon />}
        </button>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className={`${fullscreenMobile ? "text-xl" : "text-2xl"} font-semibold text-ink`}>{title}</h2>
          <p className="mt-2 text-sm text-slate-500">{description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {headerAction}
          <Link
            href={effectiveStartHref}
            onClick={(event) => {
              if (unresolvedItems.length === 0) {
                event.preventDefault();
                return;
              }
              onStartReview?.(unresolvedItems);
            }}
            aria-disabled={unresolvedItems.length === 0}
            className={`min-h-10 rounded-lg px-4 py-2 text-sm font-semibold transition ${
              unresolvedItems.length === 0
                ? "pointer-events-none bg-slate-200 text-slate-500"
                : "bg-brand-600 text-white hover:bg-brand-700"
            }`}
          >
            {startLabel}
          </Link>
        </div>
      </div>

      <div className={`${fullscreenMobile ? "mt-4" : "mt-6"} grid gap-8`}>
        {items.length === 0 ? (
          <div className="workspace-empty-state">
            {emptyMessage}
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-slate-600">科目篩選</span>
                <button
                  type="button"
                  onClick={clearSubjectFilter}
                  className={`min-h-10 rounded-full px-3 py-2 text-xs font-semibold transition ${
                    selectedSubjects.length === 0
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  全部
                </button>
                {availableSubjects.map((subject) => {
                  const active = selectedSubjects.includes(subject);
                  return (
                    <button
                      key={subject}
                      type="button"
                      onClick={() => toggleSubject(subject)}
                      className={`min-h-10 rounded-full px-3 py-2 text-xs font-semibold transition ${
                        active
                          ? "bg-brand-100 text-brand-900 ring-1 ring-brand-300"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      {subject}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-slate-500">
                {selectedSubjects.length === 0
                  ? "目前顯示全部科目的錯題與低信心題。"
                  : `目前只顯示 ${selectedSubjects.join("、")}。`}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setActiveCategory("wrong")}
                className={`min-h-10 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  activeCategory === "wrong"
                    ? "bg-rose-100 text-rose-900 ring-1 ring-rose-300"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                錯題
                <span className="ml-2 rounded-full bg-white/80 px-2 py-0.5 text-xs font-semibold">
                  {wrongItems.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveCategory("lowConfidence")}
                className={`min-h-10 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  activeCategory === "lowConfidence"
                    ? "bg-amber-100 text-amber-900 ring-1 ring-amber-300"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                沒信心題
                <span className="ml-2 rounded-full bg-white/80 px-2 py-0.5 text-xs font-semibold">
                  {lowConfidenceItems.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveCategory("resolved")}
                className={`min-h-10 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  activeCategory === "resolved"
                    ? "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-300"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                完成區
                <span className="ml-2 rounded-full bg-white/80 px-2 py-0.5 text-xs font-semibold">
                  {resolvedItems.length}
                </span>
              </button>
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-xl font-semibold text-ink">
                  {activeCategory === "wrong"
                    ? "錯題區"
                    : activeCategory === "lowConfidence"
                      ? "沒信心題區"
                      : "完成區"}
                </h3>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    activeCategory === "wrong"
                      ? "bg-rose-100 text-rose-900"
                      : activeCategory === "lowConfidence"
                        ? "bg-amber-100 text-amber-900"
                        : "bg-emerald-100 text-emerald-900"
                  }`}
                >
                  {activeItems.length} 題
                </span>
              </div>
              {manualReviewPersistenceError ? (
                <p className="mt-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 ring-1 ring-amber-100">
                  {manualReviewPersistenceError}
                </p>
              ) : null}
              <div className="mt-4 grid gap-3 sm:gap-4">
                {activeItems.length === 0 ? (
                  <div className="workspace-empty-state">
                    {activeCategory === "wrong"
                      ? "目前沒有符合篩選條件的錯題。"
                      : activeCategory === "lowConfidence"
                        ? "目前沒有符合篩選條件的低信心題。"
                        : "目前還沒有移到完成區的題目。"}
                  </div>
                ) : (
                  visibleItems.map((item, index) => (
                    <article
                      key={`${activeCategory}-${item.question.id}`}
                      className={`rounded-[10px] border p-4 ${
                        activeCategory === "wrong"
                          ? "border-rose-200 bg-rose-50/60"
                          : activeCategory === "lowConfidence"
                            ? "border-amber-200 bg-amber-50/70"
                            : "border-emerald-200 bg-emerald-50/70"
                      }`}
                    >
                      {(() => {
                        const renderedQuestion = applyLocalExplanationOverride(
                          applyQuestionExplanationOverride(item.renderedQuestion),
                          explanationOverrides[item.question.id]
                        );
                        const isQuestionOpen = openQuestionIds.has(item.question.id);
                        return (
                          <>
                            <div className="space-y-4">
                              {manualEditingEnabled && isManualEditMode ? (
                                <div className="flex justify-end">
                                  {activeCategory === "resolved" ? (
                                    <button
                                      type="button"
                                      onClick={() => moveReviewItemBackToQueue(item.question.id)}
                                      className="min-h-10 rounded-2xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700"
                                    >
                                      {getMoveBackLabel(item)}
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => moveReviewItemToResolved(item.question.id)}
                                      className="min-h-10 rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                                    >
                                      移去完成區
                                    </button>
                                  )}
                                </div>
                              ) : null}
                              <div className="space-y-3">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex min-w-0 flex-wrap items-center gap-3">
                                    <span
                                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                        activeCategory === "wrong"
                                          ? "bg-rose-100 text-rose-900"
                                          : activeCategory === "lowConfidence"
                                            ? "bg-amber-100 text-amber-900"
                                            : "bg-emerald-100 text-emerald-900"
                                      }`}
                                    >
                                      {activeCategory === "wrong"
                                        ? `錯題 ${index + 1}`
                                        : activeCategory === "lowConfidence"
                                          ? `沒信心 ${index + 1}`
                                          : `完成 ${index + 1}`}
                                    </span>
                                    <QuestionPrimaryTagBadge
                                      question={renderedQuestion}
                                      className="min-w-0 text-sm text-sky-700"
                                    />
                                  </div>
                                  <span className="shrink-0 pt-0.5 text-[11px] font-medium text-slate-400 sm:text-xs">
                                    最近作答 {formatTime(item.history.lastAttemptedAt)}
                                  </span>
                                </div>
                                <h4 className="break-words text-base font-semibold leading-7 text-ink sm:text-lg sm:leading-8">
                                  {renderedQuestion.stem}
                                </h4>
                              </div>

                              <details
                                open={isQuestionOpen}
                                onToggle={(event) => {
                                  if (event.currentTarget !== event.target) return;
                                  setQuestionDetailsOpen(item.question.id, event.currentTarget.open);
                                }}
                                className="rounded-2xl bg-white p-3.5 text-sm text-slate-700 sm:p-4"
                              >
                                <summary className="cursor-pointer font-semibold text-ink">
                                  查看題目、選項與詳解
                                </summary>
                                {isQuestionOpen
                                  ? renderQuestionReview(
                                      item,
                                      renderedQuestion,
                                      renderQuestionTopActions(renderedQuestion),
                                      renderExplanationFooter(renderedQuestion),
                                      () => (
                                        <RelatedQuestionsPanel
                                          question={renderedQuestion}
                                          relatedQuestions={renderedAllQuestions}
                                          savedQuestionSource="review"
                                        />
                                      )
                                    )
                                  : null}
                              </details>
                            </div>
                          </>
                        );
                      })()}
                    </article>
                  ))
                )}
              </div>
              {activeItems.length > visibleItems.length ? (
                <div className="mt-4 flex justify-center">
                  <button
                    type="button"
                    onClick={() =>
                      setVisibleCountByCategory((current) => ({
                        ...current,
                        [activeCategory]: (current[activeCategory] ?? 40) + 40
                      }))
                    }
                    className="min-h-11 rounded-2xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-200"
                  >
                    再顯示下一批
                  </button>
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
