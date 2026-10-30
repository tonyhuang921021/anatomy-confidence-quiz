// Design draft only; not compiled, integrated, or validated in a full checkout.
// Only server-owned checked-in sources; never accept user-created DB/session payloads.
import "server-only";
import { getCanonicalQuestionBank } from "@/data/med1QuestionBank";
import { importedCustomPaperQuestions } from "@/data/importedCustomPaperQuestions";
import { getAISimulationPaperOptions, getQuestionsForAISimulationPaper } from "@/data/aiSimulationPapers";
import { isContinuationQuestionStem } from "@/lib/questionContext";
import type { Question } from "@/types/quiz";
import { findTrustedRelatedQuestions } from "@/lib/trustedRelatedContext";

type Resolution =
  | { ok: true; question: Question; sharedContext: string | null; requiresContext: boolean }
  | { ok: false; code: "invalid_id" | "unknown_id" | "conflicting_id" | "continuation_unresolved" };

// Compare fields that affect prompt/scoring; fail closed on conflicting IDs.
// This does not construct, change, or infer an officialPaperIdentity. Preserve
// that field, when added upstream, on the returned original Question object.
function identityPayload(q: Question) {
  return JSON.stringify({
    stem: q.stem, options: [q.options.A, q.options.B, q.options.C, q.options.D, q.options.E ?? null],
    answer: q.answer, acceptedAnswers: [...(q.acceptedAnswers ?? [])].sort(),
    answerCreditType: q.answerCreditType ?? "standard", sharedContext: q.sharedContext ?? null,
    stemImage: q.stemImage ?? null, optionImages: q.optionImages ?? null,
    examCode: q.examCode ?? null, paperCode: q.paperCode ?? null,
    originalQuestionNumber: q.originalQuestionNumber ?? null,
    officialPaperIdentity: (q as Question & { officialPaperIdentity?: unknown }).officialPaperIdentity ?? null
  });
}
function buildIndex() {
  const index = new Map<string, Question>();
  const conflicting = new Set<string>();
  function add(q: Question) {
    if (!q.id || q.id !== q.id.trim()) throw new Error("invalid curated question ID");
    const old = index.get(q.id);
    if (old && identityPayload(old) !== identityPayload(q)) { conflicting.add(q.id); return; }
    if (!old) index.set(q.id, q);
  }
  for (const q of getCanonicalQuestionBank()) add(q);
  for (const q of importedCustomPaperQuestions) add(q);
  for (const paper of getAISimulationPaperOptions("全部")) {
    for (const q of getQuestionsForAISimulationPaper(paper.key, "全部")) add(q);
  }
  return { index, conflicting, corpus: [...index.values()] };
}
let cachedIndex: ReturnType<typeof buildIndex> | undefined;

export function resolveTrustedExplanationQuestion(id: unknown): Resolution {
  if (typeof id !== "string" || !id || id !== id.trim() || id.length > 200) return { ok: false, code: "invalid_id" };
  const { index, conflicting } = cachedIndex ??= buildIndex();
  if (conflicting.has(id)) return { ok: false, code: "conflicting_id" };
  const q = index.get(id);
  if (!q) return { ok: false, code: "unknown_id" };
  // Context must be explicit on the authoritative question. Do not infer it
  // from preceding number, matching exam/paper, or any browser previousQuestion.
  const sharedContext = q.sharedContext?.stem?.trim() || null;
  const requiresContext = isContinuationQuestionStem(q.stem);
  return { ok: true, question: q, sharedContext, requiresContext };
}

/** Related content is resolved from the same conflict-checked, server-owned corpus. */
export function resolveTrustedRelatedQuestions(id: string): Question[] {
  const source = resolveTrustedExplanationQuestion(id);
  if (!source.ok) return [];
  const {corpus,conflicting} = cachedIndex!;
  return findTrustedRelatedQuestions(source.question, corpus, conflicting);
}
