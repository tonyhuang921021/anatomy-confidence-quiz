export type ResultReviewNavigationSection = {
  label: string;
  detailKeys: string[];
};

export type ResultReviewNavigationItem = {
  detailKey: string;
  sectionLabel: string;
  sectionIndex: number;
  sectionTotal: number;
};

export function buildResultReviewNavigation(
  sections: ResultReviewNavigationSection[]
): ResultReviewNavigationItem[] {
  return sections.flatMap(({ label, detailKeys }) =>
    detailKeys.map((detailKey, index) => ({
      detailKey,
      sectionLabel: label,
      sectionIndex: index,
      sectionTotal: detailKeys.length
    }))
  );
}

export function getResultReviewNavigationTargetIndex(
  total: number,
  activeIndex: number,
  direction: -1 | 1
) {
  if (total <= 0) return -1;
  if (activeIndex < 0) return direction > 0 ? 0 : total - 1;
  return Math.min(total - 1, Math.max(0, activeIndex + direction));
}

export type ResultReviewFilter = "wrong" | "low-confidence" | "all";

type ReviewedResult = {
  attempt: { questionId: string; isCorrect: boolean; confidence: number };
  questionNumber: number;
};

export function filterResultReviewItems<T extends ReviewedResult>(
  items: T[],
  filter: ResultReviewFilter
): T[] {
  if (filter === "wrong") return items.filter(({ attempt }) => !attempt.isCorrect);
  if (filter === "low-confidence") {
    return items.filter(({ attempt }) => attempt.isCorrect && attempt.confidence <= 3);
  }
  return items;
}

export function getDefaultResultReviewFilter(
  items: ReviewedResult[],
  confidenceTrackingEnabled: boolean
): ResultReviewFilter {
  if (items.some(({ attempt }) => !attempt.isCorrect)) return "wrong";
  if (confidenceTrackingEnabled && items.some(({ attempt }) => attempt.confidence <= 3)) {
    return "low-confidence";
  }
  return "all";
}

// A question keeps the same key when reached from a filter, calibration, or the map.
export function getResultReviewDetailKey(item: ReviewedResult) {
  return `all-${item.attempt.questionId}-${item.questionNumber}`;
}

export function getResultReviewHref(settings?: { mode?: string; customPoolLabel?: string } | null) {
  if (settings?.mode === "simulation" || settings?.customPoolLabel === "模擬考錯題庫") {
    return "/simulation-review";
  }
  if (settings?.mode === "custom_paper" || settings?.customPoolLabel === "自訂卷錯題庫") {
    return "/custom-papers/review";
  }
  return "/review";
}
