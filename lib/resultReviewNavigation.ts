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
