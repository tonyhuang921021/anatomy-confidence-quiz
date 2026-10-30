export type GenerationSignal = {
  questionId: string;
  loading?: boolean;
  error?: string | null;
  resultVersion?: string | null;
};

export type GenerationStatus = {
  questionId: string;
  phase: "idle" | "loading" | "complete";
  baseline: string | null;
  resultVersion: string | null;
};

export const INITIAL_GENERATION_STATUS: GenerationStatus = {
  questionId: "", phase: "idle", baseline: null, resultVersion: null
};

// A fresh result is evidence of completion; a stopped/failed request isn't.
export function advanceGenerationStatus(state: GenerationStatus, signal: GenerationSignal): GenerationStatus {
  const version = signal.resultVersion ?? null;
  const current = state.questionId === signal.questionId
    ? state
    : { ...INITIAL_GENERATION_STATUS, questionId: signal.questionId };
  if (signal.error) return { ...current, phase: "idle", resultVersion: null };
  if (signal.loading) {
    return current.phase === "loading"
      ? current
      : { ...current, phase: "loading", baseline: version, resultVersion: null };
  }
  if (current.phase === "loading") {
    return version !== null && version !== current.baseline
      ? { ...current, phase: "complete", resultVersion: version }
      : { ...current, phase: "idle", resultVersion: null };
  }
  if (current.phase === "complete" && current.resultVersion !== version) {
    return { ...current, phase: "idle", resultVersion: null };
  }
  return current;
}
