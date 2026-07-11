import type { QuizSession } from "@/types/quiz";

const COMPLETION_ADVANTAGE_MIN_ATTEMPTS = 3;

function compactText(value?: string | null) {
  return typeof value === "string" ? value.trim() : "";
}

function getQuestionOrderSignature(session: QuizSession) {
  const ids = (session.questionOrder ?? []).filter(Boolean);
  if (ids.length === 0) return "";
  const head = ids.slice(0, 4).join(",");
  const tail = ids.slice(-4).join(",");
  return `${ids.length}:${head}:${tail}`;
}

export function getCurrentSessionWorkKey(session: QuizSession) {
  const mode = compactText(session.settings?.mode);
  const subject = compactText(session.subject);
  const selectedPaperKey = compactText(session.settings?.selectedPaperKey);
  if (selectedPaperKey) return `${mode}:paper:${selectedPaperKey}`;

  const customPaperCode = compactText(session.settings?.customPaperCode);
  if (customPaperCode) return `${mode}:custom-paper:${customPaperCode}`;

  const sessionName = compactText(session.settings?.sessionName);
  if (mode === "simulation" && sessionName) {
    return `${mode}:name:${subject}:${sessionName}`;
  }

  const customPoolLabel = compactText(session.settings?.customPoolLabel);
  if (customPoolLabel) return `${mode}:pool:${subject}:${customPoolLabel}`;

  const orderSignature = getQuestionOrderSignature(session);
  if (orderSignature && (mode === "simulation" || mode === "review" || mode === "custom_paper")) {
    return `${mode}:order:${orderSignature}`;
  }

  return "";
}

function getSessionActivityValue(session: QuizSession) {
  const answeredAtValues = session.attempts
    .map((attempt) => attempt.answeredAt)
    .filter(Boolean)
    .sort();

  return answeredAtValues.at(-1) ?? session.completedAt ?? session.startedAt ?? "";
}

function getCanonicalSessionId(sessionId: string) {
  return sessionId.replace(/^user-[^:]+:/, "");
}

export function isMeaningfullyMoreCompleteProgress(
  candidateAttempts: number,
  currentAttempts: number
) {
  if (candidateAttempts <= currentAttempts) return false;
  if (candidateAttempts - currentAttempts < COMPLETION_ADVANTAGE_MIN_ATTEMPTS) return false;
  if (candidateAttempts >= 10) return true;
  return candidateAttempts >= Math.max(1, currentAttempts * 2);
}

export function chooseMoreCompleteSessionForSameWork(
  current: QuizSession,
  candidates: QuizSession[]
) {
  const currentKey = getCurrentSessionWorkKey(current);
  if (!currentKey) return null;
  const currentId = getCanonicalSessionId(current.id);

  const matchingCandidates = candidates
    .filter((candidate) => getCanonicalSessionId(candidate.id) !== currentId)
    .filter((candidate) => !candidate.completedAt)
    .filter((candidate) => getCurrentSessionWorkKey(candidate) === currentKey)
    .filter((candidate) =>
      isMeaningfullyMoreCompleteProgress(candidate.attempts.length, current.attempts.length)
    )
    .sort((left, right) => {
      if (right.attempts.length !== left.attempts.length) {
        return right.attempts.length - left.attempts.length;
      }
      return getSessionActivityValue(right).localeCompare(getSessionActivityValue(left));
    });

  return matchingCandidates[0] ?? null;
}
