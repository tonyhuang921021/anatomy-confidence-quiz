import type { QuestionExplanationOverride } from "@/types/quiz";

/** A trusted saved format marker or replacement revision proves the reader contract.
 * Model names and timestamps also exist on legacy AI and cannot version it.
 */
export function usesFullGeneratedReading(
  value: QuestionExplanationOverride | undefined,
  _reviewed: boolean
) {
  return Boolean(value?.replacementRevision || value?.readingFormat === "full-v1");
}
