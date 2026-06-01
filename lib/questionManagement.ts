import type { Question, QuestionClassificationOverride } from "@/types/quiz";
import { getCanonicalQuestionBank } from "@/data/med1QuestionBank";

export type QuestionManagementSuggestionType =
  | "tag"
  | "relation"
  | "classification"
  | "tested_concept"
  | "keywords";

export type QuestionManagementTagType =
  | "concept"
  | "disease"
  | "drug"
  | "mechanism"
  | "anatomy"
  | "symptom"
  | "lab"
  | "treatment"
  | "exam_skill"
  | "keyword"
  | "misc";

export type QuestionManagementRelationType =
  | "same_concept"
  | "same_disease"
  | "same_drug"
  | "same_mechanism"
  | "same_anatomy"
  | "same_treatment"
  | "easy_to_confuse"
  | "follow_up_concept"
  | "prerequisite"
  | "related";

export type QuestionManagementTagSuggestion = {
  tag: string;
  tagType: QuestionManagementTagType;
  confidence?: number;
};

export type QuestionManagementRelationSuggestion = {
  targetQuestionId: string;
  relationType: QuestionManagementRelationType;
  confidence?: number;
  reason?: string;
};

export type QuestionManagementSuggestionBundle = {
  questionId: string;
  tags: QuestionManagementTagSuggestion[];
  relations: QuestionManagementRelationSuggestion[];
};

const CHINESE_STOP_WORDS = new Set([
  "下列",
  "何者",
  "最",
  "正確",
  "錯誤",
  "有關",
  "下列何者",
  "最有可能",
  "病人",
  "患者",
  "神經",
  "解剖",
  "題目",
  "關於"
]);

const NEURO_SECTIONS = [
  "腦神經",
  "腦幹核區",
  "視覺路徑",
  "丘腦與基底核",
  "內囊與白質路徑",
  "腦血管與中風定位"
] as const;

function normalizeText(value?: string | null) {
  return (value ?? "")
    .replace(/[A-Za-z0-9]+/g, (match) => match.toLowerCase())
    .replace(/[（(][^)）]{0,80}[）)]/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .toLowerCase();
}

function getChineseBigrams(text: string) {
  const compact = text.replace(/\s+/g, "");
  const grams = new Set<string>();

  for (let index = 0; index < compact.length - 1; index += 1) {
    const gram = compact.slice(index, index + 2);
    if (gram.length === 2 && !CHINESE_STOP_WORDS.has(gram)) {
      grams.add(gram);
    }
  }

  return grams;
}

function tokenizeMedicalText(...parts: Array<string | undefined | null>) {
  const joined = normalizeText(parts.filter(Boolean).join(" "));
  const tokens = new Set<string>();

  for (const token of joined.split(/\s+/)) {
    if (!token || token.length < 2) continue;
    if (CHINESE_STOP_WORDS.has(token)) continue;
    tokens.add(token);
  }

  for (const gram of getChineseBigrams(joined)) {
    tokens.add(gram);
  }

  return tokens;
}

function getQuestionTokenSet(question: Question) {
  return tokenizeMedicalText(
    question.chapter,
    question.section,
    question.testedConcept,
    question.stem,
    question.explanation,
    question.clinicalLink,
    question.memoryTip
  );
}

function overlapCount(left: Set<string>, right: Set<string>) {
  let count = 0;
  for (const item of left) {
    if (right.has(item)) count += 1;
  }
  return count;
}

function classifyNeuroSection(question: Question) {
  const haystack = `${question.section} ${question.chapter} ${question.testedConcept} ${question.stem}`;
  const matched =
    NEURO_SECTIONS.find((section) => haystack.includes(section)) ??
    (question.section.includes("內囊") || question.section.includes("白質")
      ? "內囊與白質路徑"
      : question.section.includes("腦血管") || question.stem.includes("MCA")
        ? "腦血管與中風定位"
        : "");

  return matched || question.section;
}

function scoreCandidate(mainQuestion: Question, candidate: Question, mainTokens: Set<string>) {
  const candidateTokens = getQuestionTokenSet(candidate);
  const overlap = overlapCount(mainTokens, candidateTokens);

  let score = overlap;
  if (candidate.section === mainQuestion.section) score += 6;
  if (classifyNeuroSection(candidate) === classifyNeuroSection(mainQuestion)) score += 5;
  if (
    mainQuestion.testedConcept &&
    candidate.testedConcept &&
    (mainQuestion.testedConcept.includes(candidate.testedConcept) ||
      candidate.testedConcept.includes(mainQuestion.testedConcept))
  ) {
    score += 7;
  }

  if (
    mainQuestion.clinicalLink &&
    candidate.clinicalLink &&
    (mainQuestion.clinicalLink.includes(candidate.clinicalLink) ||
      candidate.clinicalLink.includes(mainQuestion.clinicalLink))
  ) {
    score += 4;
  }

  if (mainQuestion.sourceYear && candidate.sourceYear === mainQuestion.sourceYear) score += 1;

  return score;
}

export function getNeuroAnatomyQuestionBank(
  overrides: Record<string, QuestionClassificationOverride> = {}
) {
  return getCanonicalQuestionBank(overrides).filter(
    (question) =>
      question.subject === "解剖學" &&
      (question.chapter.includes("神經解剖") ||
        question.section.includes("腦神經") ||
        question.section.includes("腦幹") ||
        question.section.includes("視覺路徑") ||
        question.section.includes("丘腦") ||
        question.section.includes("基底核") ||
        question.section.includes("內囊") ||
        question.section.includes("白質") ||
        question.testedConcept.includes("MCA") ||
        question.testedConcept.includes("腦神經"))
  );
}

export function buildNeuroCandidateQuestions(mainQuestion: Question, bank: Question[], limit = 20) {
  const mainTokens = getQuestionTokenSet(mainQuestion);

  return bank
    .filter((candidate) => candidate.id !== mainQuestion.id)
    .map((candidate) => ({
      question: candidate,
      score: scoreCandidate(mainQuestion, candidate, mainTokens)
    }))
    .filter((item) => item.score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.question.sourceYear! - left.question.sourceYear! ||
        left.question.id.localeCompare(right.question.id)
    )
    .slice(0, limit)
    .map((item) => item.question);
}

export function buildNeuroSuggestionPrompt(mainQuestion: Question, candidateQuestions: Question[]) {
  const payload = {
    main_question: {
      id: mainQuestion.id,
      subject: mainQuestion.subject,
      chapter: mainQuestion.chapter,
      section: mainQuestion.section,
      stem: mainQuestion.stem,
      testedConcept: mainQuestion.testedConcept,
      explanation: mainQuestion.explanation,
      clinicalLink: mainQuestion.clinicalLink ?? "",
      sourceYear: mainQuestion.sourceYear ?? null,
      examCode: mainQuestion.examCode ?? null,
      questionNumber: mainQuestion.originalQuestionNumber ?? null
    },
    candidate_questions: candidateQuestions.map((question) => ({
      id: question.id,
      chapter: question.chapter,
      section: question.section,
      stem: question.stem,
      testedConcept: question.testedConcept,
      clinicalLink: question.clinicalLink ?? "",
      sourceYear: question.sourceYear ?? null,
      examCode: question.examCode ?? null,
      questionNumber: question.originalQuestionNumber ?? null
    }))
  };

  return `你是醫學國考題目知識連結助手，專門處理神經解剖題目。

任務：
1. 為主題目產生少量高品質 tags。
2. 從候選題中找出真正值得建立連結的題目。
3. 嚴格輸出 JSON，不要輸出任何說明文字。
4. 如果不確定，寧可少標、少連，不要亂補。

限制：
- tags 只允許 tag_type: concept, anatomy, disease, mechanism
- relations 只允許 relation_type: same_concept, same_disease
- 每題 tags 最多 4 個
- 每題 relations 最多 5 個
- confidence 用 0 到 1 的小數表示
- 不要輸出「神經解剖、解剖學、國考、題目」這種低價值 tag
- 關聯必須能用一句醫學理由說清楚

relation_type 定義：
- same_concept：同一條神經路徑、定位概念、病灶定位或功能單位
- same_disease：同一 syndrome、同一典型病灶或同一臨床表現

輸出格式：
{
  "question_id": "...",
  "tags": [
    {
      "tag": "...",
      "tag_type": "concept|anatomy|disease|mechanism",
      "confidence": 0.0
    }
  ],
  "relations": [
    {
      "target_question_id": "...",
      "relation_type": "same_concept|same_disease",
      "confidence": 0.0,
      "reason": "..."
    }
  ]
}

題目資料：
${JSON.stringify(payload, null, 2)}

請只輸出合法 JSON。`;
}

export function parseNeuroSuggestionResponse(raw: string): QuestionManagementSuggestionBundle | null {
  const normalized = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .replace(/[“”]/g, '"')
    .trim();

  const candidates = [normalized];
  const start = normalized.indexOf("{");
  const end = normalized.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    candidates.push(normalized.slice(start, end + 1));
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as {
        question_id?: string;
        tags?: Array<{ tag?: string; tag_type?: string; confidence?: number }>;
        relations?: Array<{
          target_question_id?: string;
          relation_type?: string;
          confidence?: number;
          reason?: string;
        }>;
      };

      if (!parsed.question_id) continue;

      return {
        questionId: parsed.question_id,
        tags: (parsed.tags ?? [])
          .filter((item) => item.tag && item.tag_type)
          .map((item) => ({
            tag: item.tag!.trim(),
            tagType: item.tag_type!.trim() as QuestionManagementTagType,
            confidence: typeof item.confidence === "number" ? item.confidence : undefined
          })),
        relations: (parsed.relations ?? [])
          .filter((item) => item.target_question_id && item.relation_type)
          .map((item) => ({
            targetQuestionId: item.target_question_id!.trim(),
            relationType: item.relation_type!.trim() as QuestionManagementRelationType,
            confidence: typeof item.confidence === "number" ? item.confidence : undefined,
            reason: item.reason?.trim()
          }))
      };
    } catch {
      // ignore and try next candidate
    }
  }

  return null;
}
