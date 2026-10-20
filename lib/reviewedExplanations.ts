import index from "@/data/reviewedExplanationIndex.json";

/** Only source-verified, accepted editions are listed here. Never infer from a year/range. */
export function hasReviewedExplanation(questionId: string) {
  return Object.prototype.hasOwnProperty.call(index, questionId);
}
