import type { QuizSession } from "@/types/quiz";

export type QuizSessionNavigationIntent = {
  forceNew: boolean;
  resumeRequested: boolean;
  resumeSessionId?: string;
};

export type RequestedResumeStatus =
  | "not-requested"
  | "ready"
  | "missing"
  | "mismatch"
  | "unusable";

const CONSUMED_QUIZ_LAUNCH_PARAMS = [
  "new",
  "startSettings",
  "startSettingsToken",
  "startSettingsError"
] as const;

function canonicalSessionId(sessionId: string) {
  return sessionId.replace(/^user-[^:]+:/, "");
}

export function getQuizSessionNavigationIntent(
  params?: Pick<URLSearchParams, "get"> | null
): QuizSessionNavigationIntent {
  const forceNew = params?.get("new") === "1";
  const resumeRequested = !forceNew && params?.get("resume") === "1";
  const requestedId = params?.get("sessionId")?.trim();

  return {
    forceNew,
    resumeRequested,
    resumeSessionId: resumeRequested && requestedId ? canonicalSessionId(requestedId) : undefined
  };
}

export function shouldPreserveSelectedQuizSession(
  intent: QuizSessionNavigationIntent
) {
  return intent.forceNew || intent.resumeRequested;
}

export function getQuizUrlAfterConsumingLaunchIntent(input: string, resumeSessionId?: string) {
  const url = new URL(input, "https://quiz.local");
  for (const key of CONSUMED_QUIZ_LAUNCH_PARAMS) url.searchParams.delete(key);
  if (resumeSessionId) {
    url.searchParams.set("resume", "1");
    url.searchParams.set("sessionId", canonicalSessionId(resumeSessionId));
  }
  const query = url.searchParams.toString();
  return `${url.pathname}${query ? `?${query}` : ""}${url.hash}`;
}

export function getRequestedResumeStatus(input: {
  intent: QuizSessionNavigationIntent;
  session?: QuizSession | null;
  reusable: boolean;
}): RequestedResumeStatus {
  const { intent, session, reusable } = input;
  if (!intent.resumeRequested) return "not-requested";
  if (!session) return "missing";
  if (
    intent.resumeSessionId &&
    canonicalSessionId(session.id) !== intent.resumeSessionId
  ) {
    return "mismatch";
  }
  return reusable ? "ready" : "unusable";
}
