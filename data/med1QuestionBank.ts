import { anatomyOutline, anatomyQuestions } from "@/data/anatomyQuestions";
import { moexMed1Missing22QuestionsDetailedV5 } from "@/data/sources/moex_med1_missing_22_questions_detailed_v5";
import { moexMed1Requested71QuestionsDetailedPatchV5 } from "@/data/sources/moex_med1_requested_71_questions_detailed_patch_v5";
import moexMed1MissingBatch1 from "@/data/sources/moex_med1_missing_batch1_100030_1101_detailed.json";
import moexMed1MissingBatch2 from "@/data/sources/moex_med1_missing_batch2_109020_1301_detailed.json";
import moexMed1MissingBatch3 from "@/data/sources/moex_med1_missing_batch3_112020_1301_detailed.json";
import moexMed1RemainingDetailedV4Merged0011827Raw from "@/data/sources/moex_med1_remaining_detailed_v4_merged_001_1827.json";
import moexMed1ReclassifiedV5 from "@/data/sources/moex_med1_100_115_reclassified_v5_compact.json";
import moexMed1Requested149ReclassificationPatch from "@/data/sources/moex_med1_requested_149_reclassification_patch.json";
import moexMedStage2Merged0013100 from "@/data/sources/moex_med_stage2_detailed_merged_001_3100_classified_v3.json";
import questionMediaManifest from "@/data/sources/question_media_manifest.json";
import {
  applyAnalysisPrimaryTagClassification,
  applyClassificationOverrideWithPrimaryTagPriority
} from "@/lib/analysisPrimaryTag";
import type {
  OptionKey,
  Question,
  QuestionClassificationOverride,
  SubjectFilter,
  SubjectName
} from "@/types/quiz";

type RawQuestion = {
  id: string;
  source_type?: string;
  exam_year_gregorian?: number;
  exam_session?: string;
  exam_code?: string;
  paper_code?: string;
  question_no?: number;
  stem: string;
  options: Readonly<Record<string, string>>;
  answer?: string;
  correct_answers?: readonly string[];
  answer_credit_type?: string;
  explanation?: string;
  option_analysis?: Readonly<Record<string, string>>;
  exam_point?: string;
  difficulty?: string;
  classification_v4?: {
    primary_subject?: string;
    topic_section?: string;
  };
  memory_tip?: string;
  clinical_link?: string;
  answer_confidence?: "high" | "medium" | "low";
  needs_human_review?: boolean;
  review_flags?: readonly string[];
  detail_phase?: string;
};

type SubjectOutlineEntry = {
  chapter: string;
  sections: string[];
};

type MissingQuestionRaw = {
  id: string;
  year: number;
  roc_year: number;
  exam_round: string;
  exam_code: string;
  question_no: number;
  stem: string;
  options: Readonly<Record<string, string>>;
  official_answer?: string | readonly string[];
  corrected_answer?: string | readonly string[] | null;
  answer_credit_type?: string;
  classification_v5?: {
    primary_subject?: string;
    subtopic?: string;
  };
  explanation?: string;
  option_analysis?: Readonly<Record<string, string>>;
  exam_point?: string;
  memory_tip?: string;
  clinical_link?: string;
  review_flags?: readonly string[];
};

type RequestedPatchQuestionRaw = {
  id: string;
  exam_code: string;
  paper_code: string;
  exam_year_gregorian: number;
  exam_session: string;
  question_no: number;
  stem: string;
  options: Readonly<Record<string, string>>;
  official_answer_raw?: string;
  correct_answers?: readonly string[];
  answer_credit_type?: string;
  classification_v5?: {
    primary_subject_exact?: string;
    topic_section?: string;
    subtopic?: string;
    five_subject_bucket_if_app_requires?: string | null;
  };
  explanation?: string;
  option_analysis?: Readonly<Record<string, string>>;
  exam_point?: string;
  memory_tip?: string;
  clinical_link?: string;
  review_flags?: readonly string[];
};

type Stage2QuestionRaw = {
  id: string;
  year: number;
  roc_year: number;
  exam_round: string;
  exam_code: string;
  subject_group?: string;
  question_no: number;
  stem: string;
  options: Readonly<Record<string, string>>;
  official_answer_raw?: string;
  correct_answers?: readonly string[];
  corrected_answer?: string | readonly string[] | null;
  answer_credit_type?: string;
  classification_v1?: {
    primary_subject_exact?: string;
    subtopic?: string;
  };
  explanation?: string;
  option_analysis?: Readonly<Record<string, string>>;
  exam_point?: string;
  memory_tip?: string;
  clinical_link?: string;
  review_flags?: readonly string[];
  source_pdf?: string;
  answer_pdf?: string;
};

type ReclassifiedQuestionRaw = {
  id: string;
  classification_v5?: {
    primary_subject?: string;
    med1_current_five_subject?: string;
    subtopic?: string;
    is_current_five_subject_applicable?: boolean;
  };
};

type DetailedMissingBatchQuestionRaw = RawQuestion & {
  classification_v5?: {
    primary_subject?: string;
    primary_subject_exact?: string;
    med1_current_five_subject?: string;
    subtopic?: string;
  };
  subject_group_coarse?: string;
  subject_group_keyword?: string;
};

type DetailedQuestionSource = {
  questions: readonly RawQuestion[];
};

type QuestionMediaEntry = {
  stemImage?: string;
  optionImages?: Partial<Record<OptionKey, string>>;
};

type QuestionTextOverride = {
  stem?: string;
  options?: Partial<Question["options"]>;
  answer?: OptionKey;
  acceptedAnswers?: OptionKey[];
  answerCreditType?: Question["answerCreditType"];
  explanation?: string;
  optionAnalysis?: Partial<Record<OptionKey, string>>;
  memoryTip?: string;
  testedConcept?: string;
};

type Batch3QuestionRaw = {
  id: string;
  year: number;
  roc_year: number;
  exam_round: string;
  exam_code: string;
  question_no: number;
  stem: string;
  options: Readonly<Record<string, string>>;
  official_answer?: string | readonly string[];
  corrected_answer?: string | readonly string[] | null;
  answer_credit_type?: string;
  classification_v5?: {
    primary_subject?: string;
    primary_subject_exact?: string;
    med1_current_five_subject?: string;
    subtopic?: string;
  };
  primary_subject_exact?: string;
  subtopic?: string;
  explanation?: string;
  option_analysis?: Readonly<Record<string, string>>;
  exam_point?: string;
  memory_tip?: string;
  clinical_link?: string;
  review_flags?: readonly string[];
};

const anatomyChapterKeywords = [
  "神經解剖",
  "頭頸部",
  "胸腔",
  "腹部",
  "骨盆與會陰",
  "上肢",
  "下肢"
] as const;

function isOptionKey(value: string): value is OptionKey {
  return ["A", "B", "C", "D", "E"].includes(value);
}

function normalizeSubject(rawSubject?: string): SubjectName {
  const subject = rawSubject?.trim() ?? "";

  if (!subject) return "其他醫學一";
  if (subject.includes("解剖")) return "解剖學";
  if (subject.includes("組織")) return "組織學";
  if (subject.includes("胚胎") || subject.includes("發育生物")) return "胚胎學";
  if (subject.includes("生理")) return "生理學";
  if (subject.includes("藥理")) return "藥理學";
  if (subject.includes("病理")) return "病理學";
  if (
    subject.includes("生物化學") ||
    subject.includes("分子生物") ||
    subject.includes("細胞生物")
  ) {
    return "生物化學";
  }
  if (subject.includes("寄生蟲")) return "寄生蟲學";
  if (subject.includes("公共衛生")) return "公共衛生學";
  if (subject.includes("微生物") || subject.includes("免疫")) return "微生物免疫學";

  return "其他醫學一";
}

function resolvePlacement(primarySubjectRaw?: string, topicSectionRaw?: string) {
  const primarySubject = normalizeSubject(primarySubjectRaw);
  const topicSection = topicSectionRaw?.replaceAll("｜", "／").trim();
  const anatomyPlacement =
    primarySubject === "解剖學" ? normalizeAnatomyChapter(topicSection) : null;
  const chapter = anatomyPlacement?.chapter ?? primarySubject;
  const section = anatomyPlacement?.section ?? toSectionLabel(topicSection, primarySubject);

  return {
    primarySubject,
    topicSection,
    chapter,
    section
  };
}

function normalizeDifficulty(value?: string) {
  switch (value) {
    case "易":
    case "簡單":
    case "低":
      return "easy" as const;
    case "中":
    case "普通":
      return "medium" as const;
    case "難":
    case "高":
      return "hard" as const;
    default:
      return undefined;
  }
}

function normalizeAnatomyChapter(topicSection?: string) {
  const source = topicSection?.trim() ?? "";
  const matched = anatomyChapterKeywords.find((keyword) => source.includes(keyword));
  if (matched) {
    const section = source.split("／").pop()?.trim() || source;
    return { chapter: matched, section };
  }

  if (source.includes("頭頸")) return { chapter: "頭頸部", section: source };
  if (source.includes("胸")) return { chapter: "胸腔", section: source };
  if (source.includes("腹")) return { chapter: "腹部", section: source };
  if (source.includes("骨盆") || source.includes("會陰")) {
    return { chapter: "骨盆與會陰", section: source };
  }
  if (source.includes("上肢") || source.includes("肩") || source.includes("手")) {
    return { chapter: "上肢", section: source };
  }
  if (source.includes("下肢") || source.includes("足") || source.includes("臀")) {
    return { chapter: "下肢", section: source };
  }

  return { chapter: "解剖學", section: source || "其他解剖" };
}

function toSectionLabel(topicSection?: string, fallback = "其他") {
  const source = topicSection?.trim() ?? "";
  return source || fallback;
}

const DUPLICATED_OCR_CJK_PAIR_PATTERN = /([\u3400-\u9fff])\1/g;
const DUPLICATED_OCR_ASCII_TOKEN_PATTERN = /[A-Za-z0-9][A-Za-z0-9'./:+-]{3,}/g;
const DUPLICATED_OCR_PUNCTUATION_PATTERN = /([,.:;'\]\)）])\1/g;

function collapseDuplicatedOcrToken(token: string) {
  if (token.length < 4) return token;

  let collapsed = "";
  let pairCount = 0;
  let duplicatedPairCount = 0;
  for (let index = 0; index < token.length; index += 2) {
    const first = token[index];
    const second = token[index + 1];
    if (!second) {
      collapsed += first;
      continue;
    }

    pairCount += 1;
    if (first === second) {
      duplicatedPairCount += 1;
      collapsed += first;
    } else {
      collapsed += first + second;
    }
  }

  return pairCount > 0 && duplicatedPairCount / pairCount >= 0.7 ? collapsed : token;
}

function looksLikeDuplicatedOcrText(value: string) {
  const cjkPairCount = value.match(DUPLICATED_OCR_CJK_PAIR_PATTERN)?.length ?? 0;
  const duplicatedAsciiTokenCount =
    value
      .match(DUPLICATED_OCR_ASCII_TOKEN_PATTERN)
      ?.filter((token) => collapseDuplicatedOcrToken(token) !== token).length ?? 0;

  return cjkPairCount >= 2 || duplicatedAsciiTokenCount >= 2;
}

function collapseDuplicatedOcrText(value: string) {
  if (!looksLikeDuplicatedOcrText(value)) return value;

  return value
    .replace(DUPLICATED_OCR_CJK_PAIR_PATTERN, "$1")
    .replace(DUPLICATED_OCR_ASCII_TOKEN_PATTERN, (token) => collapseDuplicatedOcrToken(token))
    .replace(DUPLICATED_OCR_PUNCTUATION_PATTERN, "$1");
}

function sanitizeImportedText(value?: string) {
  if (!value) return "";

  return collapseDuplicatedOcrText(value)
    .replace(/\s*代號：\d+\s*頁次：[0-9A-Za-z－—–-]+/g, "")
    .replace(/([\u3400-\u9fff])\s+([\u3400-\u9fff])/g, "$1$2")
    .replace(/([\u3400-\u9fff])\s+([（〔［【「『《])/g, "$1$2")
    .replace(/([）〕］】」』》])\s+([\u3400-\u9fff])/g, "$1$2")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function sanitizeQuestionText(question: Question): Question {
  return {
    ...question,
    stem: sanitizeImportedText(question.stem),
    explanation: sanitizeImportedText(question.explanation),
    testedConcept: sanitizeImportedText(question.testedConcept),
    memoryTip: question.memoryTip ? sanitizeImportedText(question.memoryTip) : question.memoryTip,
    clinicalLink: question.clinicalLink
      ? sanitizeImportedText(question.clinicalLink)
      : question.clinicalLink,
    options: Object.fromEntries(
      Object.entries(question.options).map(([key, value]) => [key, sanitizeImportedText(value)])
    ) as Question["options"],
    optionAnalysis: question.optionAnalysis
      ? (Object.fromEntries(
          Object.entries(question.optionAnalysis).map(([key, value]) => [
            key,
            sanitizeImportedText(value)
          ])
        ) as Partial<Record<OptionKey, string>>)
      : question.optionAnalysis
  };
}

function toPartialOptionAnalysis(
  source?: Readonly<Record<string, string>>
): Partial<Record<OptionKey, string>> | undefined {
  if (!source) return undefined;

  const nextEntries = Object.entries(source)
    .filter(([key]) => isOptionKey(key))
    .map(([key, value]) => [key, sanitizeImportedText(value)] as const)
    .filter(([, value]) => Boolean(value));
  if (nextEntries.length === 0) return undefined;

  return Object.fromEntries(nextEntries) as Partial<Record<OptionKey, string>>;
}

function sanitizeOptions(options: Readonly<Record<string, string>>) {
  return {
    A: sanitizeImportedText(options.A ?? ""),
    B: sanitizeImportedText(options.B ?? ""),
    C: sanitizeImportedText(options.C ?? ""),
    D: sanitizeImportedText(options.D ?? ""),
    ...(options.E ? { E: sanitizeImportedText(options.E) } : {})
  };
}

function normalizeAnswerCreditType(
  value?: string
): Question["answerCreditType"] | undefined {
  if (!value) return "standard";
  if (value === "all_credit") return "all_credit";
  if (value === "multiple_accepted" || value === "multiple") return "multiple_accepted";
  if (value === "multiple_answers") return "multiple_answers";
  if (value === "single" || value === "standard") return "standard";
  return "standard";
}

function toAnswerText(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) {
    const firstString = value.find((item) => typeof item === "string");
    return typeof firstString === "string" ? firstString.trim() : "";
  }
  return "";
}

function toOptionKeyArray(value: unknown) {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return values
    .map((item) => toAnswerText(item))
    .filter(isOptionKey);
}

function getAvailableOptionKeys(options: Readonly<Record<string, string>>) {
  return (["A", "B", "C", "D", "E"] as const).filter((key) => {
    const value = options[key];
    return typeof value === "string" && value.trim().length > 0;
  });
}

function dedupeOptionKeys(values: OptionKey[]) {
  return Array.from(new Set(values));
}

const importedAnswerOverrideMap: Record<
  string,
  {
    answer: OptionKey;
    acceptedAnswers?: OptionKey[];
    answerCreditType?: Question["answerCreditType"];
  }
> = {
  "MOEX-100030-2101-Q073": {
    answer: "A",
    acceptedAnswers: ["A", "B"],
    answerCreditType: "multiple_accepted"
  },
  "MOEX-113090-2301-Q034": {
    answer: "D",
    acceptedAnswers: ["B", "D"],
    answerCreditType: "multiple_accepted"
  },
  "MOEX-113090-2301-Q083": {
    answer: "B",
    acceptedAnswers: ["B", "C", "D"],
    answerCreditType: "multiple_accepted"
  },
  "MOEX-111100-1301-Q062": {
    answer: "A",
    answerCreditType: "all_credit"
  },
  "MOEX-111100-1301-Q065": {
    answer: "A",
    answerCreditType: "all_credit"
  },
  "MOEX-114090-1301-Q049": {
    answer: "C",
    acceptedAnswers: ["A", "C"],
    answerCreditType: "multiple_accepted"
  },
  "MOEX-114090-1301-Q094": {
    answer: "C",
    acceptedAnswers: ["C", "D"],
    answerCreditType: "multiple_accepted"
  }
};

function resolveImportedAnswerForQuestion(
  questionId: string,
  options: Readonly<Record<string, string>>,
  answerCreditType: Question["answerCreditType"] | undefined,
  answerCandidates: OptionKey[]
) {
  const resolved = resolveImportedAnswer(options, answerCreditType, answerCandidates);
  if (resolved) return resolved;

  const override = importedAnswerOverrideMap[questionId];
  if (!override) return null;

  const availableOptionKeys = getAvailableOptionKeys(options);
  if (!availableOptionKeys.includes(override.answer)) {
    return null;
  }

  const acceptedAnswers = override.acceptedAnswers?.filter((value) =>
    availableOptionKeys.includes(value)
  );

  return {
    answer: override.answer,
    acceptedAnswers: acceptedAnswers?.length ? acceptedAnswers : undefined,
    answerCreditType: override.answerCreditType ?? answerCreditType
  };
}

function resolveImportedAnswer(
  options: Readonly<Record<string, string>>,
  answerCreditType: Question["answerCreditType"] | undefined,
  answerCandidates: OptionKey[]
): {
  answer: OptionKey;
  acceptedAnswers?: OptionKey[];
  answerCreditType?: Question["answerCreditType"];
} | null {
  const primaryAnswer = answerCandidates[0];
  if (primaryAnswer && isOptionKey(primaryAnswer)) {
    const acceptedAnswers = dedupeOptionKeys(answerCandidates);
    return {
      answer: primaryAnswer,
      acceptedAnswers: acceptedAnswers.length > 0 ? acceptedAnswers : undefined,
      answerCreditType
    };
  }

  if (answerCreditType === "all_credit") {
    const availableOptionKeys = getAvailableOptionKeys(options);
    const fallbackAnswer = availableOptionKeys[0] ?? "A";
    return {
      answer: fallbackAnswer,
      acceptedAnswers: availableOptionKeys.length > 0 ? availableOptionKeys : undefined,
      answerCreditType
    };
  }

  return null;
}

function parseMoexQuestionId(id: string) {
  const match = id.match(/^MOEX-(\d+)[_-](\d+)-Q(\d+)$/i);
  if (!match) return null;

  const [, examCode, paperCode, questionNumber] = match;
  return {
    examCode,
    paperCode,
    questionNumber: Number.parseInt(questionNumber, 10)
  };
}

function toQuestion(raw: RawQuestion): Question | null {
  const answerCreditType = normalizeAnswerCreditType(raw.answer_credit_type);
  const acceptedAnswers = toOptionKeyArray(raw.correct_answers);
  const fallbackAnswer = toAnswerText(raw.answer);
  const resolvedAnswer = resolveImportedAnswerForQuestion(
    raw.id,
    raw.options,
    answerCreditType,
    [
      ...(fallbackAnswer && isOptionKey(fallbackAnswer) ? [fallbackAnswer] : []),
      ...acceptedAnswers
    ]
  );
  if (!resolvedAnswer) return null;

  const { primarySubject, topicSection, chapter, section } = resolvePlacement(
    raw.classification_v4?.primary_subject,
    raw.classification_v4?.topic_section
  );

  return {
    id: raw.id,
    subject: primarySubject,
    chapter,
    section,
    stem: sanitizeImportedText(raw.stem),
    options: sanitizeOptions(raw.options),
    answer: resolvedAnswer.answer,
    acceptedAnswers: resolvedAnswer.acceptedAnswers,
    answerCreditType: resolvedAnswer.answerCreditType ?? answerCreditType,
    explanation: sanitizeImportedText(raw.explanation ?? ""),
    testedConcept: sanitizeImportedText(raw.exam_point ?? topicSection ?? section),
    optionAnalysis: toPartialOptionAnalysis(raw.option_analysis),
    memoryTip: raw.memory_tip,
    clinicalLink: raw.clinical_link,
    answerConfidence: raw.answer_confidence,
    needsHumanReview: raw.needs_human_review,
    reviewFlags: raw.review_flags ? [...raw.review_flags] : undefined,
    detailVersion: raw.detail_phase,
    sourceType: raw.source_type === "MOEX_PAST_EXAM" ? "MOEX_PAST_EXAM" : "AI_GENERATED",
    sourceCitation: `考選部 ${raw.exam_year_gregorian ?? ""} ${raw.exam_session ?? ""} 醫學（一） ${raw.paper_code ?? ""}`.trim(),
    sourceYear: raw.exam_year_gregorian,
    sourceRound: raw.exam_session?.includes("第二") ? 2 : 1,
    originalQuestionNumber: raw.question_no,
    examCode: raw.exam_code,
    paperCode: raw.paper_code,
    examSessionLabel: raw.exam_session,
    difficulty: normalizeDifficulty(raw.difficulty)
  };
}

function toMissingQuestion(raw: MissingQuestionRaw): Question | null {
  const answerCreditType = normalizeAnswerCreditType(raw.answer_credit_type);
  const answerValues = [raw.corrected_answer, raw.official_answer]
    .flatMap((value) => (Array.isArray(value) ? value : value ? [value] : []))
    .map((value) => toAnswerText(value))
    .filter(isOptionKey);
  const resolvedAnswer = resolveImportedAnswerForQuestion(
    raw.id,
    raw.options,
    answerCreditType,
    answerValues
  );
  if (!resolvedAnswer) return null;

  const [examCode, paperCode] = raw.exam_code.split("-");
  const { primarySubject, topicSection, chapter, section } = resolvePlacement(
    raw.classification_v5?.primary_subject,
    raw.classification_v5?.subtopic
  );

  return {
    id: raw.id,
    subject: primarySubject,
    chapter,
    section,
    stem: sanitizeImportedText(raw.stem),
    options: sanitizeOptions(raw.options),
    answer: resolvedAnswer.answer,
    acceptedAnswers: resolvedAnswer.acceptedAnswers,
    answerCreditType: resolvedAnswer.answerCreditType ?? answerCreditType,
    explanation: sanitizeImportedText(raw.explanation ?? ""),
    testedConcept: sanitizeImportedText(raw.exam_point ?? topicSection ?? section),
    optionAnalysis: toPartialOptionAnalysis(raw.option_analysis),
    memoryTip: raw.memory_tip,
    clinicalLink: raw.clinical_link,
    needsHumanReview: raw.review_flags?.includes("needs_human_review") ?? false,
    reviewFlags: raw.review_flags ? [...raw.review_flags] : undefined,
    sourceType: "MOEX_PAST_EXAM",
    sourceCitation: `考選部 ${raw.year} ${raw.exam_round} 醫學（一） ${paperCode ?? ""}`.trim(),
    sourceYear: raw.year,
    sourceRound: raw.exam_round.includes("第二") ? 2 : 1,
    originalQuestionNumber: raw.question_no,
    examCode,
    paperCode,
    examSessionLabel: raw.exam_round
  };
}

function toRequestedPatchQuestion(raw: RequestedPatchQuestionRaw): Question | null {
  const answerCreditType = normalizeAnswerCreditType(raw.answer_credit_type);
  const answerValues = toOptionKeyArray(raw.correct_answers);
  const fallbackAnswer = toAnswerText(raw.official_answer_raw);
  const resolvedAnswer = resolveImportedAnswerForQuestion(
    raw.id,
    raw.options,
    answerCreditType,
    [
      ...answerValues,
      ...(fallbackAnswer && isOptionKey(fallbackAnswer) ? [fallbackAnswer] : [])
    ]
  );
  if (!resolvedAnswer) return null;

  const explicitSubject =
    raw.classification_v5?.five_subject_bucket_if_app_requires ||
    raw.classification_v5?.primary_subject_exact;
  const { primarySubject, topicSection, chapter, section } = resolvePlacement(
    explicitSubject ?? undefined,
    raw.classification_v5?.subtopic || raw.classification_v5?.topic_section
  );

  return {
    id: raw.id,
    subject: primarySubject,
    chapter,
    section,
    stem: sanitizeImportedText(raw.stem),
    options: sanitizeOptions(raw.options),
    answer: resolvedAnswer.answer,
    acceptedAnswers: resolvedAnswer.acceptedAnswers,
    answerCreditType: resolvedAnswer.answerCreditType ?? answerCreditType,
    explanation: sanitizeImportedText(raw.explanation ?? ""),
    testedConcept: sanitizeImportedText(raw.exam_point ?? topicSection ?? section),
    optionAnalysis: toPartialOptionAnalysis(raw.option_analysis),
    memoryTip: raw.memory_tip,
    clinicalLink: raw.clinical_link,
    needsHumanReview: raw.review_flags?.includes("needs_human_review") ?? false,
    reviewFlags: raw.review_flags ? [...raw.review_flags] : undefined,
    sourceType: "MOEX_PAST_EXAM",
    sourceCitation: `考選部 ${raw.exam_year_gregorian} ${raw.exam_session} 醫學（一） ${raw.paper_code}`.trim(),
    sourceYear: raw.exam_year_gregorian,
    sourceRound: raw.exam_session.includes("第二") ? 2 : 1,
    originalQuestionNumber: raw.question_no,
    examCode: raw.exam_code,
    paperCode: raw.paper_code,
    examSessionLabel: raw.exam_session
  };
}

function toDetailedMissingBatchQuestion(raw: DetailedMissingBatchQuestionRaw): Question | null {
  const answerCreditType = normalizeAnswerCreditType(raw.answer_credit_type);
  const acceptedAnswers = toOptionKeyArray(raw.correct_answers);
  const fallbackAnswer = toAnswerText(raw.answer);
  const resolvedAnswer = resolveImportedAnswerForQuestion(
    raw.id,
    raw.options,
    answerCreditType,
    [
      ...(fallbackAnswer && isOptionKey(fallbackAnswer) ? [fallbackAnswer] : []),
      ...acceptedAnswers
    ]
  );
  if (!resolvedAnswer) return null;

  const explicitSubject =
    raw.classification_v5?.med1_current_five_subject ||
    raw.classification_v5?.primary_subject_exact ||
    raw.classification_v5?.primary_subject ||
    raw.subject_group_coarse;
  const explicitSection =
    raw.classification_v5?.subtopic ||
    raw.subject_group_keyword;
  const { primarySubject, topicSection, chapter, section } = resolvePlacement(
    explicitSubject,
    explicitSection
  );

  return {
    id: raw.id,
    subject: primarySubject,
    chapter,
    section,
    stem: sanitizeImportedText(raw.stem),
    options: sanitizeOptions(raw.options),
    answer: resolvedAnswer.answer,
    acceptedAnswers: resolvedAnswer.acceptedAnswers,
    answerCreditType: resolvedAnswer.answerCreditType ?? answerCreditType,
    explanation: sanitizeImportedText(raw.explanation ?? ""),
    testedConcept: sanitizeImportedText(raw.exam_point ?? topicSection ?? section),
    optionAnalysis: toPartialOptionAnalysis(raw.option_analysis),
    memoryTip: raw.memory_tip,
    clinicalLink: raw.clinical_link,
    answerConfidence: raw.answer_confidence,
    needsHumanReview: raw.needs_human_review,
    reviewFlags: raw.review_flags ? [...raw.review_flags] : undefined,
    detailVersion: raw.detail_phase,
    sourceType: raw.source_type === "MOEX_PAST_EXAM" ? "MOEX_PAST_EXAM" : "AI_GENERATED",
    sourceCitation: `考選部 ${raw.exam_year_gregorian ?? ""} ${raw.exam_session ?? ""} 醫學（一） ${raw.paper_code ?? ""}`.trim(),
    sourceYear: raw.exam_year_gregorian,
    sourceRound: raw.exam_session?.includes("第二") ? 2 : 1,
    originalQuestionNumber: raw.question_no,
    examCode: raw.exam_code,
    paperCode: raw.paper_code,
    examSessionLabel: raw.exam_session,
    difficulty: normalizeDifficulty(raw.difficulty)
  };
}

function toBatch3Question(raw: Batch3QuestionRaw): Question | null {
  const [examCode, paperCode] = raw.exam_code.split("-");
  const normalized: MissingQuestionRaw = {
    id: raw.id,
    year: raw.year,
    roc_year: raw.roc_year,
    exam_round: raw.exam_round,
    exam_code: raw.exam_code,
    question_no: raw.question_no,
    stem: raw.stem,
    options: raw.options,
    official_answer: raw.official_answer,
    corrected_answer: raw.corrected_answer,
    answer_credit_type:
      raw.answer_credit_type === "single" ? "standard" : raw.answer_credit_type,
    classification_v5: {
      primary_subject:
        raw.classification_v5?.med1_current_five_subject ||
        raw.classification_v5?.primary_subject_exact ||
        raw.classification_v5?.primary_subject ||
        raw.primary_subject_exact,
      subtopic: raw.classification_v5?.subtopic || raw.subtopic
    },
    explanation: raw.explanation,
    option_analysis: raw.option_analysis,
    exam_point: raw.exam_point,
    memory_tip: raw.memory_tip,
    clinical_link: raw.clinical_link,
    review_flags: raw.review_flags
  };

  const question = toMissingQuestion(normalized);
  if (!question) return null;

  return {
    ...question,
    examCode: question.examCode ?? examCode,
    paperCode: question.paperCode ?? paperCode
  };
}

function toStage2Question(raw: Stage2QuestionRaw): Question | null {
  const answerCreditType = normalizeAnswerCreditType(raw.answer_credit_type);
  const answerValues = [raw.corrected_answer, raw.official_answer_raw, raw.correct_answers]
    .flatMap((value) => {
      if (Array.isArray(value)) return value;
      return value ? [value] : [];
    })
    .map((value) => toAnswerText(value))
    .filter(isOptionKey);
  const resolvedAnswer = resolveImportedAnswerForQuestion(
    raw.id,
    raw.options,
    answerCreditType,
    answerValues
  );
  if (!resolvedAnswer) return null;

  const { primarySubject, topicSection, chapter, section } = resolvePlacement(
    raw.classification_v1?.primary_subject_exact,
    raw.classification_v1?.subtopic
  );

  const parsedId = parseMoexQuestionId(raw.id);

  return {
    id: raw.id,
    subject: primarySubject,
    chapter,
    section,
    stem: sanitizeImportedText(raw.stem),
    options: sanitizeOptions(raw.options),
    answer: resolvedAnswer.answer,
    acceptedAnswers: resolvedAnswer.acceptedAnswers,
    answerCreditType: resolvedAnswer.answerCreditType ?? answerCreditType,
    explanation: sanitizeImportedText(raw.explanation ?? ""),
    testedConcept: sanitizeImportedText(raw.exam_point ?? topicSection ?? section),
    optionAnalysis: toPartialOptionAnalysis(raw.option_analysis),
    memoryTip: raw.memory_tip,
    clinicalLink: raw.clinical_link,
    needsHumanReview: raw.review_flags?.includes("needs_human_review") ?? false,
    reviewFlags: raw.review_flags ? [...raw.review_flags] : undefined,
    sourceType: "MOEX_PAST_EXAM",
    sourceCitation: `考選部 ${raw.year} ${raw.exam_round} 醫學（二） ${raw.exam_code}`.trim(),
    sourceYear: raw.year,
    sourceRound: raw.exam_round.includes("第二") ? 2 : 1,
    originalQuestionNumber: raw.question_no,
    examCode: parsedId?.examCode,
    paperCode: parsedId?.paperCode,
    examSessionLabel: raw.exam_round
  };
}

type ClassificationOverride = {
  subject: SubjectName;
  topicSection?: string;
};

type SimpleReclassificationPatchEntry = {
  id: string;
  primary_subject_exact: string;
  subtopic?: string;
};

const med1ReclassifiedQuestionsRaw =
  (moexMed1ReclassifiedV5 as { questions: ReclassifiedQuestionRaw[] }).questions ?? [];

const med1Requested149ReclassificationPatchRaw =
  moexMed1Requested149ReclassificationPatch as readonly SimpleReclassificationPatchEntry[];

type ClassificationOverrideEntry = readonly [string, ClassificationOverride];

const med1ClassificationOverrideMap = new Map<string, ClassificationOverride>(
  [
    ...med1ReclassifiedQuestionsRaw.flatMap((raw) => {
      const explicitSubject =
        raw.classification_v5?.is_current_five_subject_applicable
          ? raw.classification_v5?.med1_current_five_subject || raw.classification_v5?.primary_subject
          : raw.classification_v5?.primary_subject;
      if (!explicitSubject) return [];
      return [[
        raw.id,
        {
          subject: normalizeSubject(explicitSubject),
          topicSection: raw.classification_v5?.subtopic?.trim()
        }
      ] as const satisfies ClassificationOverrideEntry];
    }),
    ...med1Requested149ReclassificationPatchRaw.flatMap((raw) => {
      if (!raw.primary_subject_exact?.trim()) return [];
      return [[
        raw.id,
        {
          subject: normalizeSubject(raw.primary_subject_exact),
          topicSection: raw.subtopic?.trim()
        }
      ] as const satisfies ClassificationOverrideEntry];
    })
  ]
);

med1ClassificationOverrideMap.set("MOEX-103100-1101-Q085", {
  subject: "公共衛生學",
  topicSection: "中央極限定理"
});
med1ClassificationOverrideMap.set("MOEX-111100-1301-Q040", {
  subject: "組織學",
  topicSection: "內耳組織／特殊感覺"
});
med1ClassificationOverrideMap.set("MOEX-111100-1301-Q062", {
  subject: "生理學",
  topicSection: "呼吸生理／血液氣體運輸"
});
med1ClassificationOverrideMap.set("MOEX-111100-1301-Q065", {
  subject: "生理學",
  topicSection: "腎臟生理／酸鹼平衡"
});
med1ClassificationOverrideMap.set("MOEX-114090-1301-Q049", {
  subject: "生理學",
  topicSection: "神經生理／語言功能"
});
med1ClassificationOverrideMap.set("MOEX-114090-1301-Q094", {
  subject: "生物化學",
  topicSection: "電子傳遞鏈與氧化磷酸化"
});
med1ClassificationOverrideMap.set("MOEX-115020-1301-Q066", {
  subject: "生理學",
  topicSection: "腎臟生理／氨排泄與尿素循環"
});
med1ClassificationOverrideMap.set("MOEX-115020-1301-Q075", {
  subject: "生物化學",
  topicSection: "酵素動力學／Michaelis-Menten 與 kcat 計算"
});
med1ClassificationOverrideMap.set("MOEX-100140-1101-Q016", {
  subject: "解剖學",
  topicSection: "男性生殖／儲精囊關係"
});
med1ClassificationOverrideMap.set("MOEX-105020-6301-Q072", {
  subject: "藥理學",
  topicSection: "中樞神經藥理／酒精藥理"
});
med1ClassificationOverrideMap.set("MOEX-107020-5301-Q077", {
  subject: "生物化學",
  topicSection: "葉酸與一碳代謝"
});
med1ClassificationOverrideMap.set("MOEX-100030-2101-Q073", {
  subject: "藥理學",
  topicSection: "抗生素"
});
med1ClassificationOverrideMap.set("MOEX-106100-1301-Q083", {
  subject: "生物化學",
  topicSection: "分子生物學／lac operon"
});
med1ClassificationOverrideMap.set("MOEX-100140-2101-Q045", {
  subject: "生物化學",
  topicSection: "氨基酸代謝／苯丙酮尿症"
});

function applyClassificationOverride(question: Question): Question {
  const override = med1ClassificationOverrideMap.get(question.id);
  if (!override) return question;

  const { primarySubject, topicSection, chapter, section } = resolvePlacement(
    override.subject,
    override.topicSection ?? question.section
  );

  return {
    ...question,
    subject: primarySubject,
    chapter,
    section,
    testedConcept: question.testedConcept || topicSection || section
  };
}

function applyQuestionMedia(question: Question): Question {
  const media = (questionMediaManifest as Record<string, QuestionMediaEntry>)[question.id];
  if (!media) return question;

  return {
    ...question,
    stemImage: media.stemImage ?? question.stemImage,
    optionImages: media.optionImages
      ? {
          ...(question.optionImages ?? {}),
          ...media.optionImages
        }
      : question.optionImages
  };
}

const questionTextOverrides: Record<string, QuestionTextOverride> = {
  "MOEX-107100-2301-Q041": {
    stem:
      "某研究收集30人的收縮壓（mmHg）及年齡的隨機樣本資料，計算皮爾森氏相關係數（Pearson’s correlation coefficient）得0.7。假若同樣的資料，以血壓當依變項（Y；dependent variable），以年齡當自變項（X；independent variable），可得到直線迴歸線 Y = a + bX。下列何者正確？"
  },
  "MOEX-114090-1301-Q085": {
    stem:
      "原核生物中，調控基因表現的操縱組（operon）其中操作子（operator）序列主要是由下列何種分子進行結合？",
    options: {
      A: "suppressor tRNA",
      B: "miRNA",
      C: "inducer",
      D: "repressor"
    }
  },
  "MOEX-114090-1301-Q088": {
    stem:
      "下列何者為結構型多醣（structural polysaccharide）而非儲存型多醣（storage polysaccharide）？",
    options: {
      A: "cellulose",
      B: "amylose",
      C: "amylopectin",
      D: "glycogen"
    }
  },
  "MOEX-114090-1301-Q097": {
    stem:
      "Phosphoinositide 3-kinase（PI3K）主要以磷酸化細胞膜上的哪一個分子來傳遞訊息？",
    options: {
      A: "Ras",
      B: "PKC",
      C: "PIP2",
      D: "PKB"
    }
  },
  "MOEX-109100-2301-Q021": {
    stem:
      "抗體多變區（variable domain）基因 V、D、J 片段重組（recombination）是產生多樣性抗體的主要機制，下列哪一種酵素沒有參與這一部分抗體基因重組的過程？",
    options: {
      A: "activation-induced cytidine deaminase（AID）",
      B: "DNA-dependent protein kinase（DNA-PK）",
      C: "recombination-activating gene（RAG）",
      D: "DNA ligase IV"
    }
  },
  "MOEX-113090-2301-Q034": {
    answer: "D",
    acceptedAnswers: ["B", "D"],
    answerCreditType: "multiple_accepted",
    explanation:
      "本題官方開放 B、D 給分。Cryptosporidium 主要以 oocyst 經糞口／水源傳播，寄生於腸道上皮刷狀緣附近；腹瀉糞便中典型診斷重點是 oocyst，不是大量活動體（trophozoites）。因此 D 明確可採計；B 的「僅存在於」表述過度絕對，官方也開放給分。",
    optionAnalysis: {
      A: "不選。C. hominis 與 C. parvum 是人類感染常見種。",
      B: "開放給分。Cryptosporidium 與腸道上皮刷狀緣相關，但「僅存在於」表述過度絕對。",
      C: "不選。水源傳播是 cryptosporidiosis 的重要傳播方式。",
      D: "開放給分。診斷重點是 oocyst；把腹瀉糞便中大量 trophozoites 當作特徵不適當。"
    }
  },
  "MOEX-113090-2301-Q083": {
    answer: "B",
    acceptedAnswers: ["B", "C", "D"],
    answerCreditType: "multiple_accepted",
    explanation:
      "本題官方開放 B、C、D 給分。Microscopic polyangiitis 是小血管壞死性血管炎，典型為非肉芽腫性發炎；Kawasaki disease 與 Buerger disease 也不是以顯微鏡下肉芽腫性發炎為主要典型表現。故依官方疑義採計 B、C、D。",
    optionAnalysis: {
      A: "不選。Churg-Strauss syndrome（eosinophilic granulomatosis with polyangiitis）可見肉芽腫性發炎，較不符合「最少出現」。",
      B: "開放給分。Microscopic polyangiitis 典型為非肉芽腫性小血管炎。",
      C: "開放給分。Kawasaki disease 不是以肉芽腫性發炎為典型病理。",
      D: "開放給分。Buerger disease 主要為節段性血栓性血管炎，非典型肉芽腫性血管炎。"
    }
  },
  "MOEX-100030-1101-Q099": {
    stem:
      "某種疾病的篩選方法研究結果如下表，則下列那一個是假陽性率（false positivity）？\n\n疾病狀態\n篩檢結果｜有病｜無病\n陽性｜a｜c\n陰性｜b｜d",
    options: {
      A: "a/(a+b)",
      B: "a/(a+c)",
      C: "d/(b+d)",
      D: "c/(c+d)"
    },
    testedConcept: "假陽性率為沒有病者中篩檢陽性的比例，即 c/(c+d)。"
  },
  "MOEX-100030-1101-Q073": {
    stem:
      "某些人類白血球抗原（Human Leukocyte Antigens, HLA）基因在某自體免疫疾病患者中的存在有較為增高現象，是為有較高的「相較性的危險值」（relative risk），引起自體免疫致病性。有關 HLA-B27 與疾病之相關性，下列那一項敘述正確？",
    options: {
      A: "對於第一型糖尿病（type 1 diabetes mellitus）",
      B: "對於葛瑞夫氏症（Graves' disease）",
      C: "對於尋常天疱瘡（pemphigus vulgaris）",
      D: "對於僵直性脊椎炎（ankylosing spondylitis）"
    }
  },
  "MOEX-101030-1101-Q100": {
    stem:
      "依下表數據計算下列各指標，下列何者錯誤？\n\n疾病真實狀況\n診斷結果｜有｜無｜Total\n有｜68｜6｜74\n無｜12｜114｜126\nTotal｜80｜120｜200",
    options: {
      A: "敏感度為 85%",
      B: "特異度為 95%",
      C: "陽性預測值為 85%",
      D: "陰性預測值為 90.5%"
    }
  },
  "MOEX-103100-1101-Q039": {
    options: {
      C: "腦下垂體前葉內，分泌激乳素（prolactin）或生長激素（growth hormone）的細胞是嗜酸性細胞（acidophil）",
      D: "嬰兒吸吮母親乳頭會刺激催產素（oxytocin）之釋放"
    }
  },
  "MOEX-103100-1101-Q052": {
    options: {
      A: "Tat 與運送病毒 RNA 到細胞質有關",
      B: "Vif 可以拮抗細胞中 APOBEC-3G 的作用",
      C: "Vpu 可以降低細胞上 CD4 的表現",
      D: "gp41 幫助病毒與細胞膜的融合"
    }
  },
  "MOEX-103100-2101-Q042": {
    options: {
      A: "細胞中合成膽固醇的前驅物為乙醯輔酶（acetyl-CoA）",
      B: "運送由食物攝取之三酸甘油酯（triacylglycerol）的主要脂蛋白（lipoprotein），為超低密度脂蛋白（VLDL, very low density lipoprotein）",
      C: "低密度脂蛋白（LDL, low density lipoprotein）主要功能是將膽固醇送到周邊組織，易增加膽固醇在血管內壁堆積的風險，因此被稱為壞膽固醇（bad cholesterol）",
      D: "高密度脂蛋白（HDL, high density lipoprotein）主要功能是將膽固醇從周邊組織運回肝臟代謝，因此被稱為好膽固醇（good cholesterol）"
    }
  },
  "MOEX-105020-5301-Q043": {
    options: {
      D: "引發感染需要超過 10⁸ 的菌量"
    }
  },
  "MOEX-107100-1301-Q058": {
    options: {
      A: "活化小動脈血管平滑肌 β1 腎上腺素型受器（β1 adrenergic receptors）",
      B: "開啟小動脈血管平滑肌細胞上鈣離子通道（calcium channel）",
      C: "增加小動脈一氧化氮（NO）的量",
      D: "活化血管張力素轉換酶（angiotensin-converting enzyme）"
    }
  },
  "MOEX-110101-1301-Q028": {
    options: {
      C: "屈拇長肌（flexor hallucis longus）與屈趾長肌（flexor digitorum longus）",
      D: "屈拇短肌（flexor hallucis brevis）與屈趾短肌（flexor digitorum brevis）"
    },
    explanation:
      "足底內側的交叉常稱 Henry 結，為屈拇長肌（flexor hallucis longus, FHL）與屈趾長肌（flexor digitorum longus, FDL）肌腱交叉處。",
    optionAnalysis: {
      C: "正確／官方採計。足底內側的交叉常稱 Henry 結，為屈拇長肌（flexor hallucis longus, FHL）與屈趾長肌（flexor digitorum longus, FDL）肌腱交叉處。",
      D: "不選。屈拇短肌（flexor hallucis brevis）與屈趾短肌（flexor digitorum brevis）不是本題最符合的答案；本題重點是 Knot of Henry：FHL crosses FDL in medial plantar foot。"
    }
  },
  "MOEX-107020-5301-Q095": {
    stem: "粒線體氧化磷酸化的過程所產生 H2O2，可由下列哪一種酵素去除？",
    explanation:
      "Glutathione peroxidase 利用還原型 glutathione 將 H2O2 還原為水；glutathione reductase 則再生 GSH。"
  },
  "MOEX-110020-1301-Q057": {
    options: {
      A: "胎兒與母體的血紅素皆為 α2β2 chain，因此氧氣量相同",
      B: "母體的血紅素為 α2β2 chain，胎兒的血紅素為 ε2ζ2 chain，因此母體血紅素較易接合氧氣",
      C: "母體的血紅素為 α2β2 chain，胎兒的血紅素為 α4 chain，因此胎兒血紅素較易接合氧氣",
      D: "母體的血紅素為 α2β2 chain，胎兒的血紅素為 α2γ2 chain，因此胎兒血紅素較易接合氧氣"
    }
  },
  "MOEX-115020-1301-Q062": {
    options: {
      A: "此區域的肺泡內二氧化碳分壓（PACO2）升高，進入此區域肺泡之通氣量（ventilation, V）增加",
      B: "此區域的肺泡內二氧化碳分壓（PACO2）升高，進入此區域肺泡之通氣量（ventilation, V）減少",
      C: "此區域的肺泡內二氧化碳分壓（PACO2）降低，進入此區域肺泡之通氣量（ventilation, V）增加",
      D: "此區域的肺泡內二氧化碳分壓（PACO2）降低，進入此區域肺泡之通氣量（ventilation, V）減少"
    }
  },
  "MOEX-115020-1301-Q077": {
    stem: "有關 vitamin D3 代謝和功能，下列敘述何者最適切？",
    options: {
      A: "1α,25-二羥基維生素 D3（1α,25-dihydroxyvitamin D3）可經由陽光紫外線在皮膚中形成膽鈣化醇（cholecalciferol）",
      B: "1α,25-二羥基維生素 D3（1α,25-dihydroxyvitamin D3）與特定核受體蛋白相互作用來調節基因表現",
      C: "7-脫氫膽固醇（7-dehydrocholesterol）調節腸道鈣吸收",
      D: "calcitriol 在肝和腎臟中形成 vitamin D3"
    }
  },
  "MOEX-106100-2301-Q023": {
    options: {
      A: "第一型輔助性 T 細胞（Th1）",
      B: "第一型調節性 T 細胞（Tr1）",
      C: "第十七型輔助性 T 細胞（Th17）",
      D: "CD4+ CD25+ T 細胞"
    }
  },
  "MOEX-111100-1301-Q066": {
    stem:
      "計算純水清除率（clearance of free-water, C_H2O）的公式是 C_H2O = V（urine flow rate）- C_osm（clearance of osmoles）。而 C_osm 之定義為：V x (U_osm/P_osm)，其中 U_osm 與 P_osm 分別為尿液與血漿之 osmolality。下列何種生理狀態，最可能使純水清除率（C_H2O）成為負值？",
    options: {
      A: "飲用大量純水之後",
      B: "腎小球濾過率（glomerular filtration rate）增加",
      C: "血中抗利尿荷爾蒙（antidiuretic hormone）增加",
      D: "溶質清除率（C_osm）減少"
    }
  },
  "MOEX-103100-1101-Q070": {
    options: {
      A: "Common variable immunodeficiency",
      B: "X-linked agammaglobulinemia",
      D: "Selective IgA deficiency"
    },
    optionAnalysis: {
      A: "不選。Common variable immunodeficiency 是 IVIG 的常見適應症之一。",
      B: "不選。X-linked agammaglobulinemia 是抗體缺乏症，常需免疫球蛋白補充。",
      C: "不選。Mu heavy chain 突變造成的 agammaglobulinemia 屬於抗體產生缺陷，可考慮免疫球蛋白補充。",
      D: "正確。Selective IgA deficiency 通常不是 IVIG 的常規適應症，且部分病人可能因 anti-IgA antibody 產生輸注反應。"
    }
  },
  "MOEX-103100-1101-Q072": {
    options: {
      A: "TNF-α",
      B: "IL-10",
      C: "IL-1",
      D: "IFN-γ"
    },
    optionAnalysis: {
      A: "不選。TNF-α 是促發炎 cytokine，不是本題問的抗發炎調節重點。",
      B: "正確。IL-10 是重要抗發炎 cytokine，缺乏時可能造成腸道免疫調節失衡並引起 inflammatory bowel disease。",
      C: "不選。IL-1 偏促發炎，不是本題最佳答案。",
      D: "不選。IFN-γ 偏 Th1 免疫反應，不是本題最佳答案。"
    }
  },
  "MOEX-103100-1101-Q077": {
    stem:
      "下列寄生蟲與其中間宿主之配對，共有幾項正確？\n①中華肝吸蟲（Clonorchis sinensis）--淡水魚\n②衛氏肺吸蟲（Paragonimus westermani）--毛蟹\n③薑片蟲（Fasciolopsis buski）--菱角\n④槍狀肝吸蟲（Dicrocoelium dendriticum）--螞蟻",
    options: {
      A: "1項",
      B: "2項",
      C: "3項",
      D: "4項"
    },
    optionAnalysis: {
      A: "不選。正確配對不只 1 項。",
      B: "不選。中華肝吸蟲、衛氏肺吸蟲、薑片蟲與槍狀肝吸蟲的配對皆可成立。",
      C: "不選。題目列出的 4 組配對皆可成立。",
      D: "正確。中華肝吸蟲配淡水魚、衛氏肺吸蟲配蟹類、薑片蟲配水生植物、槍狀肝吸蟲配螞蟻，4 項皆正確。"
    }
  },
  "MOEX-105020-5301-Q042": {
    options: {
      B: "可導致細胞內 cAMP 濃度增高"
    }
  },
  "MOEX-106020-6301-Q052": {
    explanation:
      "Sirolimus（rapamycin）會先結合 FK506-binding protein（FKBP-12），但此複合體抑制的是 mTOR，阻斷 IL-2 訊號後的 T 細胞增生與蛋白質合成。Tacrolimus 雖然也結合 FKBP，卻是抑制 calcineurin，降低 IL-2 轉錄；sirolimus 不抑制 calcineurin。因此 B 把 sirolimus 說成和 tacrolimus 一樣抑制 calcineurin，是錯誤敘述。",
    optionAnalysis: {
      A: "不選。Sirolimus 會結合 FKBP-12，這點正確。",
      B: "正確。Sirolimus-FKBP 複合體抑制 mTOR，不像 tacrolimus-FKBP 複合體抑制 calcineurin。",
      C: "不選。Sirolimus 一般較少造成 cyclosporine 典型的腎毒性。",
      D: "不選。Sirolimus 抑制 mTOR，進而抑制細胞週期進展與蛋白質合成相關訊號。"
    },
    testedConcept: "免疫抑制劑／sirolimus 抑制 mTOR，不抑制 calcineurin"
  },
  "MOEX-110101-1301-Q075": {
    options: {
      A: "1 / kcat",
      B: "Km",
      C: "kcat / Km",
      D: "Km / kcat"
    }
  },
  "MOEX-103100-1101-Q086": {
    options: {
      D: "Spearman 等級相關係數（Spearman correlation coefficient）"
    },
    optionAnalysis: {
      D: "正確。乳癌分期為有序類別，年齡又呈右偏分布，應使用非參數的 Spearman rank correlation，而非 Pearson。"
    }
  },
  "MOEX-103100-1101-Q094": {
    options: {
      D: "B 型行為人格"
    },
    optionAnalysis: {
      D: "正確。超時工作與急性循環系統疾病常和睡眠剝奪、工作特點、心理困擾等交互作用；B 型行為人格不是題幹所列交互作用因素。"
    }
  },
  "MOEX-111100-1301-Q076": {
    stem:
      "在一個符合 Michaelis-Menten equation 的酵素催化反應中，當受質（substrate）濃度極小於 Michaelis 常數（Km）時，此反應之速率常數應為下列何者？",
    options: {
      A: "Vmax",
      B: "kcat / Km",
      C: "1 / kcat",
      D: "kcat × Km"
    }
  },
  "MOEX-114090-1301-Q006": {
    stem: "下列何者位於大腦額葉？",
    options: {
      A: "angular gyrus",
      B: "Broca's area",
      C: "transverse gyri of Heschl",
      D: "cuneus"
    },
    optionAnalysis: {
      A: "不選。Angular gyrus 位於頂葉，不是額葉。",
      B: "正確／官方採計。Broca's area 位於優勢半球額下回後部，屬於額葉。",
      C: "不選。Transverse gyri of Heschl 位於顳葉。",
      D: "不選。Cuneus 位於枕葉。"
    }
  },
  "MOEX-114020-1301-Q070": {
    stem: "有關甲狀腺荷爾蒙（thyroid hormone）的敘述，下列何者最不適當？",
    options: {
      A: "促甲狀腺荷爾蒙（thyroid-stimulating hormone, TSH）會促進甲狀球蛋白（thyroglobulin）分解而釋放甲狀腺荷爾蒙",
      B: "甲狀腺分泌的甲狀腺荷爾蒙主要是 thyroxine（T4）",
      C: "在血液中 thyroxine（T4）主要會與血漿蛋白結合，triiodothyronine（T3）則以游離型（free-form）居多",
      D: "在目標細胞內與甲狀腺荷爾蒙受器（thyroid hormone receptor）結合的分子主要為 triiodothyronine（T3）"
    },
    explanation:
      "本題問甲狀腺荷爾蒙敘述何者最不適當。甲狀腺分泌的主要形式是 T4，而在周邊組織與目標細胞中，真正和甲狀腺荷爾蒙受器結合、作用力較強的是 T3。血中甲狀腺荷爾蒙大多與血漿蛋白結合，游離型比例很低；其中 T4 和 T3 都是如此，不是只有 T4 結合、T3 反而以游離型居多。因此 C 的敘述錯在把 T3 說成主要以游離型存在，這是最不適當的選項。",
    optionAnalysis: {
      A: "不選。TSH 會促進甲狀腺濾泡細胞攝碘、合成與釋放甲狀腺荷爾蒙，方向正確。",
      B: "不選。甲狀腺分泌的主要荷爾蒙形式是 T4。",
      C: "正確。T4 與 T3 在血中大多都與血漿蛋白結合，游離型比例都很低；T3 不是以游離型居多。",
      D: "不選。目標細胞內主要與受器結合並發揮較強生物作用的是 T3。"
    },
    testedConcept: "甲狀腺荷爾蒙／T4、T3 與血漿蛋白結合"
  },
  "MOEX-102030-2101-Q050": {
    explanation:
      "cDNA microarray 是用核酸探針偵測樣本中 mRNA/cDNA 的相對表現量，可同時比較大量基因表現；晶片上的 DNA 探針可用 PCR 產物點樣，也可用 photolithography 在晶片上合成。它測的是核酸層級的基因表現，不是直接偵測蛋白質表現，因此 D 為錯誤敘述。",
    optionAnalysis: {
      A: "正確敘述。cDNA microarray 可平行分析大量基因的相對表現量。",
      B: "正確敘述。傳統 spotted microarray 可將 PCR 產物或合成 DNA 固定在玻片上。",
      C: "正確敘述。寡核苷酸晶片可用 photolithography 等方式在晶片上合成探針。",
      D: "錯誤敘述，為本題答案。cDNA microarray 主要偵測 mRNA/cDNA，蛋白質表現需用 Western blot、ELISA、protein array 或質譜等方法。"
    },
    testedConcept: "生物化學／分子生物學／cDNA microarray"
  },
  "MOEX-107020-5301-Q077": {
    options: {
      C: "四氫葉酸（H₄ folate）為一種具有生物活性的葉酸型式",
      D: "四氫葉酸（H₄ folate）是由6-methylpterin、p-aminobenzoate與glutamate所組成"
    },
    explanation:
      "葉酸以四氫葉酸（tetrahydrofolate, H₄ folate）形式攜帶一碳單位，參與 dTMP 與嘌呤合成；輔酶 A 則由 pantothenic acid、ADP 與 cysteamine 等結構組成，葉酸不是構成輔酶 A 的基本元素。因此 B 為錯誤敘述。",
    optionAnalysis: {
      A: "正確敘述。葉酸一碳代謝參與 dTMP 合成。",
      B: "錯誤敘述，為本題答案。輔酶 A 的核心來源是 pantothenic acid，不是葉酸。",
      C: "正確敘述。H₄ folate 是葉酸的活性還原型。",
      D: "不選。題目要抓的是輔酶 A 組成錯誤；H₄ folate 與 pteridine/PABA/glutamate 骨架相關。"
    },
    testedConcept: "生物化學／葉酸與一碳代謝"
  },
  "MOEX-100030-1101-Q050": {
    stem:
      "承上題：一名 60 歲患有糖尿病的農夫在夏季豪雨過後下田整理農地，三天後出現發燒和倦怠，送醫發現輕微肺炎症狀；血液檢體分離出革蘭氏陰性、不發酵糖類桿菌，最可能為類鼻疽（melioidosis）。此人所感染的致病菌在生理特徵和致病性方面與下列那種細菌最相近？",
    explanation:
      "前題病例指向類鼻疽菌 Burkholderia pseudomallei。B. pseudomallei 是革蘭陰性、不發酵桿菌，生物學特徵與 Pseudomonas 類群相近，因此最接近綠膿桿菌（Pseudomonas aeruginosa）。",
    optionAnalysis: {
      A: "不選。Haemophilus influenzae 是需 X/V factor 的小型革蘭陰性球桿菌，和類鼻疽菌的非發酵桿菌特徵不相近。",
      B: "不選。Corynebacterium diphtheriae 是革蘭陽性桿菌，和本題病原差異很大。",
      C: "正確。Burkholderia pseudomallei 與 Pseudomonas aeruginosa 同屬革蘭陰性、非發酵桿菌這類考點。",
      D: "不選。Legionella pneumophila 雖可造成肺炎，但不是和類鼻疽菌最相近的非發酵桿菌代表。"
    },
    testedConcept: "微生物免疫學／細菌學／類鼻疽菌與非發酵革蘭陰性桿菌"
  },
  "MOEX-100140-2101-Q045": {
    stem:
      "一名 3 個月大男嬰的血清中，苯丙胺酸（phenylalanine）與苯丙酮酸（phenylpyruvate）的濃度較高。若是苯酮尿症（phenylketonuria, PKU），最可能會再出現下列那個檢驗數據？",
    options: {
      C: "血清中的維生素 B12 濃度偏低",
      D: "血清中的維生素 B6 濃度偏低"
    },
    explanation:
      "典型苯酮尿症是 phenylalanine hydroxylase（PAH）活性降低，導致 phenylalanine 不能有效轉成 tyrosine，phenylalanine 及 phenylpyruvate 上升。Homogentisic acid 上升是 alkaptonuria 的考點，不是 PKU。",
    optionAnalysis: {
      A: "正確。PAH 活性降低是典型 PKU 的核心機轉。",
      B: "不選。Homogentisic acid 濃度偏高較符合 alkaptonuria（homogentisate oxidase 缺陷）。",
      C: "不選。維生素 B12 偏低主要聯想到巨幼紅血球性貧血或 methylmalonic acid 上升，和典型 PKU 不符。",
      D: "不選。維生素 B6 偏低不是典型 PKU 的主要檢驗特徵。"
    },
    testedConcept: "生物化學／氨基酸代謝／苯丙酮尿症"
  },
  "MOEX-106100-1301-Q083": {
    stem:
      "大腸桿菌的乳糖操縱子（lac operon）上含有 β-半乳糖苷酶（β-galactosidase）、透性酶（permease）、乙醯基轉移酶（transacetylase）基因。此外在該操縱子的上游有一調控基因 I（I gene）。請配對下列各基因（a～c）之功能：\na. 基因 I\nb. β-半乳糖苷酶\nc. 透性酶\nI. 具分解乳糖的酵素活性\nII. 為一轉送蛋白質\nIII. 基因產物可調控乳糖操縱子（lac operon）",
    explanation:
      "lacI（I gene）產生 repressor，可調控 lac operon，故 a 對 III；β-galactosidase 分解乳糖，故 b 對 I；permease 是乳糖進入細胞的轉運蛋白，故 c 對 II。配對為 a-III, b-I, c-II。",
    optionAnalysis: {
      A: "不選。I gene 不是分解乳糖的酵素；β-galactosidase 才具分解乳糖活性。",
      B: "不選。I gene 應對調控功能 III，permease 應對轉運功能 II。",
      C: "不選。β-galactosidase 應對分解乳糖活性 I，不是轉運蛋白。",
      D: "正確。a-I gene 對 III，b-β-galactosidase 對 I，c-permease 對 II。"
    },
    testedConcept: "生物化學／分子生物學／lac operon"
  },
  "MOEX-105020-6301-Q072": {
    explanation:
      "本題問錯誤敘述。酒精可由胃腸道吸收，代謝在常見濃度下近似零級反應，且乙醛（acetaldehyde）是乙醇經 alcohol dehydrogenase 代謝後的初級產物。官方答案採 B，重點是女性血中酒精濃度較高的常考差異主要來自口服吸收、胃部 first-pass metabolism 與體水分比例等因素；題幹改成靜脈投與時，不能直接用胃腸吸收／胃部代謝差異解釋，因此 B 為最不適當敘述。",
    optionAnalysis: {
      A: "正確敘述。酒精可經胃腸道快速且幾乎完全吸收。",
      B: "錯誤敘述，為本題答案。依官方題意，靜脈投與繞過胃腸吸收與胃部 first-pass metabolism，不能直接套用口服酒精的性別差異敘述。",
      C: "正確敘述。酒精代謝酵素容易飽和，常以零級動力學考。",
      D: "正確敘述。乙醇先代謝成 acetaldehyde，再轉為 acetate。"
    },
    testedConcept: "藥理學／酒精藥理／吸收與代謝"
  },
  "MOEX-105020-6301-Q075": {
    explanation:
      "承上題病童有短暫凝視與 3-Hz spike-and-wave，典型指向 absence seizure。Absence seizure 常用 ethosuximide、valproic acid 或 lamotrigine；phenytoin 對 absence seizure 沒有效，且可能使 absence 發作惡化。因此 C 為會增加發作風險的選項。",
    optionAnalysis: {
      A: "不選。Valproic acid 可用於 absence seizure，尤其合併其他癲癇型態時常被使用。",
      B: "不選。Lamotrigine 可作為 absence seizure 的治療選項之一。",
      C: "正確。Phenytoin 主要作用於 voltage-gated Na+ channel，對 absence seizure 不適合，可能加重發作。",
      D: "不選。Ethosuximide 是典型 absence seizure 的第一線藥物，抑制 thalamic T-type Ca2+ channel。"
    },
    testedConcept: "藥理學／中樞神經藥理／absence seizure 與抗癲癇藥"
  },
  "MOEX-115020-1301-Q031": {
    stem: "下列何者的肌腱，不會通過跗骨隧道（tarsal tunnel）？",
    options: {
      C: "拇趾長屈肌（flexor hallucis longus）",
      D: "屈趾長肌（flexor digitorum longus）"
    },
    explanation:
      "跗骨隧道位於內踝後方，通過內容物可用 Tom, Dick, And Very Nervous Harry 記：tibialis posterior、flexor digitorum longus、posterior tibial artery/vein、tibial nerve、flexor hallucis longus。脛前肌腱走在踝前方，不通過跗骨隧道。",
    optionAnalysis: {
      A: "正確。脛前肌（tibialis anterior）位於踝前方，不通過跗骨隧道。",
      B: "不選。脛後肌（tibialis posterior）會通過跗骨隧道。",
      C: "不選。拇趾長屈肌（flexor hallucis longus）會通過跗骨隧道。",
      D: "不選。屈趾長肌（flexor digitorum longus）會通過跗骨隧道。"
    },
    testedConcept: "解剖學／下肢／跗骨隧道內容物"
  },
  "MOEX-113090-1301-Q076": {
    stem:
      "將 Michaelis-Menten equation 轉型作成的雙倒數圖（double reciprocal plot），稱為 Lineweaver-Burk plot，其方程式：1/V₀ = Kₘ/(Vmax[S]) + 1/Vmax。由此雙倒數圖要如何求得 Kₘ？",
    options: {
      A: "X 軸的截距為其 Kₘ",
      B: "X 軸截距的倒數為其 Kₘ",
      C: "X 軸截距的倒數乘以 -1 為其 Kₘ",
      D: "Y 軸截距的倒數乘以 -1 為其 Kₘ"
    },
    explanation:
      "Lineweaver-Burk plot 中 x 軸截距為 -1/Kₘ，y 軸截距為 1/Vmax。因此 Kₘ 等於 x 軸截距取倒數後再乘以 -1。",
    optionAnalysis: {
      A: "不選。X 軸截距是 -1/Kₘ，不是 Kₘ 本身。",
      B: "不選。X 軸截距的倒數是 -Kₘ，還要再乘以 -1。",
      C: "正確。X 軸截距 = -1/Kₘ，所以其倒數乘以 -1 即為 Kₘ。",
      D: "不選。Y 軸截距是 1/Vmax，和 Kₘ 的求法不同。"
    },
    testedConcept: "生物化學／酵素動力學／Lineweaver-Burk plot"
  },
  "MOEX-102110-2101-Q058": {
    explanation:
      "本題問免疫抑制劑與不良作用配對何者錯誤。Cyclosporine 的代表副作用是腎毒性、高血壓、牙齦增生與多毛；重度骨髓抑制較常聯想到 azathioprine、mycophenolate 或 sirolimus 類考點，因此 C 配對錯誤。",
    optionAnalysis: {
      A: "配對正確，不選。Anti-CD3 monoclonal antibody 可造成類感冒症狀、cytokine release 相關反應。",
      B: "配對正確，不選。Corticosteroids 可造成代謝與電解質相關副作用，例如水鈉滯留、低血鉀等。",
      C: "配對錯誤，為本題答案。Cyclosporine 典型副作用是腎毒性、高血壓、牙齦增生、多毛，不是重度骨髓抑制。",
      D: "配對正確，不選。Azathioprine 可造成骨髓抑制。"
    },
    testedConcept: "藥理學／免疫藥理／免疫抑制劑副作用"
  },
  "MOEX-103100-1101-Q055": {
    stem:
      "孕婦在懷孕期間感染下列那些病毒後，容易造成嬰兒先天性缺陷？①Cytomegalovirus ②Influenza virus ③Rubella virus ④Adenovirus",
    options: {
      A: "①②",
      B: "①③",
      C: "②③",
      D: "③④"
    },
    explanation:
      "容易造成嬰兒先天性缺陷的典型病毒包含 cytomegalovirus（CMV）與 rubella virus。Influenza virus 與 adenovirus 不是本題所問的典型先天性缺陷組合，因此正確組合為 ①③。",
    optionAnalysis: {
      A: "不選。① CMV 是典型先天感染病原，但 ② influenza virus 不是造成先天性缺陷的典型答案。",
      B: "正確。① CMV 與 ③ rubella virus 都是容易造成先天性缺陷的典型病毒。",
      C: "不選。③ rubella virus 正確，但 ② influenza virus 不是本題典型先天性缺陷病原。",
      D: "不選。③ rubella virus 正確，但 ④ adenovirus 不是本題典型先天性缺陷病原。"
    },
    testedConcept: "微生物免疫學／病毒學／先天性感染：CMV 與 Rubella"
  },
  "MOEX-104030-1101-Q077": {
    options: {
      A: "僅①②",
      B: "僅①③",
      C: "僅②③",
      D: "①②③"
    },
    optionAnalysis: {
      A: "不選。犬複殖器絛蟲主要是誤食帶囊尾幼蟲的跳蚤而感染，②不是錯誤途徑。",
      B: "正確。①誤食蟲卵與③誤食生殖節片不是人體典型感染途徑；②誤食帶蟲跳蚤才是感染途徑。",
      C: "不選。②是正確感染途徑，不應列為錯誤。",
      D: "不選。三者不全錯，②是典型感染途徑。"
    }
  },
  "MOEX-104030-1101-Q078": {
    options: {
      A: "僅①②",
      B: "僅①③",
      C: "僅②③",
      D: "①②③"
    },
    optionAnalysis: {
      A: "正確。埃及血吸蟲典型表現包含血尿，尿液中也可見嗜酸性白血球。",
      B: "不選。慢性感染與膀胱癌風險增加有關，但題幹第③寫成因成蟲刺激，表述不如①②符合本題官方答案。",
      C: "不選。第③不是本題官方採用的正確敘述組合。",
      D: "不選。官方答案只採 ①②。"
    }
  },
  "MOEX-104030-1101-Q092": {
    options: {
      A: "①②③",
      B: "①③②",
      C: "②①③",
      D: "③②①"
    },
    explanation:
      "站立工作檯高度通常依工作精細度調整：精密工作需要較高檯面以接近視線並減少彎腰；輕工作約在中間；較重工作需要較低檯面，方便肩臂與軀幹出力。因此由高到低為精密工作、輕工作、較重工作，即 ①②③。",
    optionAnalysis: {
      A: "正確。精密工作最高，輕工作次之，較重工作最低。",
      B: "不選。較重工作不應高於輕工作，否則不利出力。",
      C: "不選。精密工作通常需要最高檯面，不應排在輕工作後。",
      D: "不選。較重工作通常需要最低檯面，不應排最高。"
    },
    testedConcept: "公共衛生學／人因工程／站立工作檯高度"
  },
  "MOEX-113090-2301-Q021": {
    options: {
      A: "免疫球蛋白基因的V-D-J重組，先從重鏈（heavy chain）開始",
      B: "μ重鏈（μ heavy chain）與VpreB及λ5組成的pre-BCR，對pre-B細胞繼續發育是必要的",
      C: "Bruton's tyrosine kinase（Btk）是pre-BCR或BCR下游訊息傳遞的必要蛋白，缺乏Btk會造成X-linked agammaglobulinemia（XLA）",
      D: "表現IgM的immature B細胞如果辨識到抗原，就會開始細胞分裂（clonal expansion）"
    },
    answer: "D",
    explanation:
      "B細胞發育中，重鏈 V-D-J 重組先發生，pre-BCR 由 μ 重鏈搭配 surrogate light chain（VpreB、λ5）形成，Btk 也是 pre-BCR/BCR 訊息傳遞的重要蛋白。Immature B 細胞若辨識到自身抗原，通常進入 receptor editing、clonal deletion 或 anergy，不會直接進行 clonal expansion，因此 D 最不適當。",
    optionAnalysis: {
      A: "適當。免疫球蛋白基因重組通常先從重鏈 V-D-J 重組開始。",
      B: "適當。μ heavy chain 與 VpreB、λ5 形成 pre-BCR，對 pre-B 細胞繼續發育很重要。",
      C: "適當。Btk 是 pre-BCR/BCR 下游訊息傳遞所需蛋白，缺乏會造成 X-linked agammaglobulinemia。",
      D: "不適當。Immature B 細胞辨識自身抗原時會被耐受機制處理，而不是開始 clonal expansion。"
    },
    testedConcept: "微生物免疫學／免疫學／B細胞發育"
  },
  "MOEX-113020-2301-Q029": {
    stem:
      "寄生蟲感染人體所造成之症狀，下列敘述何者正確？\n1犬蛔蟲（Toxocara canis）可造成眼部幼蟲移行症（ocular larva migrans）\n2班氏絲蟲（Wuchereria bancrofti）的慢性感染可造成下肢象皮病（elephantiasis）\n3免疫低下之病患受到鞭蟲（Trichuris trichiura）感染必造成死亡\n4蛔蟲（Ascaris lumbricoides）感染可能出現異位寄生（ectopic parasitism）",
    options: {
      A: "僅13",
      B: "僅24",
      C: "僅124",
      D: "1234"
    }
  },
  "MOEX-113020-2301-Q032": {
    stem:
      "水生植物可當何種寄生蟲之中間宿主？\n1牛羊肝吸蟲（Fasciola hepatica）\n2薑片蟲（Fasciolopsis buski）\n3中華肝吸蟲（Clonorchis sinensis）\n4槍狀肝吸蟲（Dicrocoelium dendriticum）",
    options: {
      A: "12",
      B: "34",
      C: "13",
      D: "24"
    }
  },
  "MOEX-113020-2301-Q079": {
    stem:
      "下列疾病中，何者一般被認為大部分是與 TH2 細胞的作用或反應有關？\n1蠕蟲類寄生蟲感染\n2外因性過敏性鼻炎（allergic rhinitis）\n3肉芽腫性發炎（granulomatous inflammation）",
    options: {
      A: "123",
      B: "僅12",
      C: "僅23",
      D: "僅13"
    }
  },
  "MOEX-100030-2101-Q073": {
    answer: "A",
    acceptedAnswers: ["A", "B"],
    answerCreditType: "multiple_accepted",
    explanation:
      "四環黴素類常見副作用包括腸胃不適、牙齒與骨骼沉積、肝毒性、腎毒性，以及光敏感反應。光敏感最常被考到的是 demeclocycline，但 doxycycline 也可能造成 photosensitivity，因此官方給 A 或 B 都可接受。",
    optionAnalysis: {
      A: "Demeclocycline 可造成明顯光敏感，是傳統最常考答案。",
      B: "Doxycycline 也可造成光敏感，所以官方也給分。",
      C: "Oxytetracycline 不是光敏感最典型代表。",
      D: "Minocycline 比較常考前庭毒性、頭暈、皮膚色素沉著，不是本題最佳答案。"
    },
    testedConcept: "四環黴素副作用／抗生素"
  },
  "MOEX-111100-1301-Q040": {
    answer: "B",
    acceptedAnswers: ["B", "C"],
    answerCreditType: "multiple_accepted",
    explanation:
      "本題官方採計 B、C 皆可給分。B 的錯誤在於 cupula 本身沒有耳石；耳石（otolith／otoconia）位於橢圓囊與球囊的耳石膜，用來感受直線加速度與頭部位置變化。C 敘述在概念上通常視為正確，但因官方疑義採計，作答時 B 或 C 都算對。",
    optionAnalysis: {
      A: "正確。壺腹嵴感受旋轉造成的角加速度。",
      B: "可採計。cupula 沒有耳石；耳石在 utricle 與 saccule 的 macula 上。",
      C: "可採計。scala vestibuli 和 scala tympani 在 helicotrema 相通，原句因官方疑義也給分。",
      D: "正確。cochlear duct 又稱 scala media，內含 endolymph。"
    },
    testedConcept: "內耳組織／特殊感覺"
  },
  "MOEX-112100-1301-Q056": {
    stem: "下列何者與二氧化碳（CO₂）在血液運送的機制最無關？",
    options: {
      A: "CO₂ 溶解於血漿（plasma）中",
      B: "CO₂ 經碳酸酐酶（carbonic anhydrase）轉化成 H₂CO₃",
      C: "紅血球醣解作用產物 2,3-bisphosphoglycerate（2,3-BPG）減少，可增加 CO₂ 與 Fe²⁺ 結合",
      D: "紅血球之血紅素（hemoglobin）可結合 CO₂"
    }
  },
  "MOEX-113090-1301-Q094": {
    stem:
      "下列何種胺基酸可代謝產生丙酮酸（pyruvate）及硫化氫（hydrogen sulfide, H₂S）？"
  },
  "MOEX-103030-2101-Q035": {
    stem:
      "請在下列各原核細胞 RNA 聚合酶（RNA polymerase）次單元（subunit）中配對出其專一的功能？\n\n次單元｜功能\n a. α｜I. 具啟動子序列的專一辨識能力\n b. β｜II. 生合成的延伸（elongation）作用，並能與調控蛋白互動（interaction）\n c. σ｜III. 負責生合成的起始（initiation）與延伸（elongation）作用"
  },
  "MOEX-111100-1301-Q028": {
    options: {
      A: "屈拇長肌（flexor hallucis longus）",
      C: "屈拇短肌（flexor hallucis brevis）"
    }
  },
  "MOEX-113090-1301-Q078": {
    options: {
      A: "vitamin D₃ 作為類固醇激素，經代謝後可調節鈣和磷的體內平衡",
      B: "vitamin D₃ 可經由陽光照射皮膚中的 7-dehydrocholesterol 來生成",
      D: "vitamin K 參與血液凝結及 K⁺ 結合"
    }
  },
  "MOEX-113090-2301-Q014": {
    options: {
      B: "遺傳基因為正股（+）RNA"
    }
  },
  "MOEX-114020-1301-Q054": {
    stem:
      "因釋放正腎上腺素（norepinephrine），而與白天的清醒程度最有關之神經細胞，其細胞體主要位於腦內何處？",
    options: {
      A: "reticular activating system",
      B: "hypothalamus",
      C: "amygdala",
      D: "medial prefrontal cortex"
    },
    optionAnalysis: {
      A: "正確。與清醒程度和 norepinephrine 釋放密切相關的是腦幹網狀活化系統，尤其藍斑核投射。"
    }
  },
  "MOEX-114020-1301-Q062": {
    stem: "下列何種刺激最可能會造成支氣管收縮（bronchoconstriction）？",
    options: {
      A: "鄰近的肺小動脈（pulmonary arteriole）被阻塞",
      B: "肺泡（alveolus）內二氧化碳分壓（PCO₂）上升",
      C: "吸氣（inspiration）",
      D: "支氣管平滑肌（smooth muscle）的 β₂ 腎上腺素受器（adrenergic receptor）被刺激"
    },
    optionAnalysis: {
      A: "正確。肺小動脈阻塞時該區通氣沒有灌流，局部 CO₂ 下降會造成支氣管收縮，以降低無效通氣。",
      B: "不選。肺泡 CO₂ 上升通常造成支氣管擴張。",
      D: "不選。β₂ 腎上腺素受器被刺激通常造成支氣管擴張。"
    }
  },
  "MOEX-111100-1301-Q062": {
    answer: "A",
    answerCreditType: "all_credit",
    explanation:
      "在周邊組織，CO₂ 進入紅血球後經 carbonic anhydrase 轉為 HCO₃⁻ 和 H⁺。HCO₃⁻ 會離開紅血球，Cl⁻ 進入紅血球，稱為 chloride shift，因此周邊組織紅血球內 Cl⁻ 較高、pH 較低。到了肺泡微血管則反向進行：HCO₃⁻ 回到紅血球，轉回 CO₂ 後排出。因為題目問的是細胞內濃度、但沒有明確指定時間點，容易產生爭議，因此本題以疑義題處理。",
    optionAnalysis: {
      A: "不適合當標準答案。紅血球膜電位不是這題核心判斷點。",
      B: "有爭議。肺部 HCO₃⁻ 會進入紅血球，但很快轉成 CO₂ 排出，若問穩態濃度並不清楚。",
      C: "通常錯。周邊組織因 chloride shift，紅血球內 Cl⁻ 應較高，不是較低。",
      D: "錯。周邊組織 CO₂ 產生 H⁺，紅血球內 pH 較低，不是較高。"
    },
    testedConcept: "呼吸生理／血液氣體運輸"
  },
  "MOEX-111100-1301-Q065": {
    answer: "A",
    answerCreditType: "all_credit",
    explanation:
      "近端腎小管會大量再吸收濾過的 HCO₃⁻，但這個過程需要管腔側分泌 H⁺ 配合。遠端腎小管與集尿管的 α-intercalated cells 也會分泌 H⁺，並產生新的 HCO₃⁻ 回到血液。因此若題目問正確，多個選項都有部分正確，官方疑義合理，本題以疑義題處理。",
    optionAnalysis: {
      A: "部分正確。近端再吸收 HCO₃⁻，遠端分泌 H⁺，但近端也會分泌 H⁺。",
      B: "部分正確但不完整。近端分泌 H⁺ 正確，遠端也參與 HCO₃⁻ 處理。",
      C: "部分正確。近端與遠端都可參與 HCO₃⁻ 再吸收或生成。",
      D: "部分正確。近端與遠端都可分泌 H⁺。"
    },
    testedConcept: "腎臟生理／酸鹼平衡"
  },
  "MOEX-114090-1301-Q049": {
    stem: "某一病人罹患中風後講話流利，但卻出現閱讀上的困難，下列何者最有可能是發生病變的位置？",
    options: {
      A: "Wernicke's area",
      B: "Broca's area",
      C: "angular gyrus",
      D: "arcuate fasciculus"
    },
    answer: "C",
    acceptedAnswers: ["A", "C"],
    answerCreditType: "multiple_accepted",
    explanation:
      "本題官方開放 A、C 給分。若依典型神經定位判斷，題幹重點是講話流利但閱讀困難；Broca 區病灶通常造成非流利失語，不合題幹。Wernicke 區病灶可造成流利但理解差的失語，angular gyrus 則參與視覺文字與語言理解的整合；官方疑義因此開放 A、C。",
    optionAnalysis: {
      A: "開放給分。Wernicke 區病灶可造成流利但理解差的失語，若題目把閱讀困難納入理解障礙判讀，A 可被採計。",
      B: "Broca 區：非流利失語，與講話流利不合。",
      C: "開放給分。Angular gyrus 與閱讀、書寫、語言整合有關，是閱讀困難最直接的典型定位。",
      D: "Arcuate fasciculus：傳導性失語，特徵是複誦困難。"
    },
    testedConcept: "神經生理／語言功能"
  },
  "MOEX-114090-1301-Q052": {
    stem: "神經傳導物質（neurotransmitter）與其相對應的代謝型受體（metabotropic receptor）之配對，何者正確？",
    options: {
      A: "norepinephrine → α1 receptor",
      B: "histamine → 5-HT1 receptor",
      C: "acetylcholine → nicotinic receptor",
      D: "glutamate → AMPA receptor"
    }
  },
  "MOEX-114090-1301-Q094": {
    answer: "C",
    acceptedAnswers: ["C", "D"],
    answerCreditType: "multiple_accepted",
    explanation:
      "本題官方開放 C、D 給分。電子傳遞鏈中，complex I、III、IV 會將 H⁺ 從 matrix 泵到 intermembrane space，建立質子梯度。常見記法是每 2 個電子經過：complex I 泵 4H⁺、complex III 泵 4H⁺、complex IV 泵 2H⁺；C 最符合標準記法，但官方疑義開放 D。",
    optionAnalysis: {
      A: "錯。complex I 是把 H⁺ 從 matrix 泵到膜間腔，不是到 matrix。",
      B: "錯。complex III 也是把 H⁺ 泵到膜間腔，不是到 matrix。",
      C: "開放給分。complex III 約將 4H⁺ 移至 intermembrane space。",
      D: "開放給分。complex IV 泵氫方向為往膜間腔；雖然常見每 2 電子泵 2H⁺，官方疑義仍採計 D。"
    },
    testedConcept: "電子傳遞鏈與氧化磷酸化"
  },
  "MOEX-115020-1301-Q066": {
    answer: "D",
    acceptedAnswers: ["A", "D"],
    answerCreditType: "multiple_accepted",
    explanation:
      "本題開放 A、D 給分。D 不適當在於尿素再吸收主要透過尿素轉運蛋白，例如 UT-A 類轉運，屬於 facilitated diffusion，並受到 ADH／vasopressin 影響，並不是初級主動運輸。A 也可被採計，因為氨的跨器官處理與 glutamine 來源、腎臟代謝排酸的表述過度簡化，容易造成「兩者都是腎臟排出體外」的判讀爭議。代謝性酸中毒時，腎臟會增加 glutamine 代謝，產生 NH₄⁺ 排酸並生成新的 HCO₃⁻。",
    optionAnalysis: {
      A: "開放給分。尿素確實主要經腎臟排出，但 glutamine 的產生與腎臟代謝排酸較複雜，原句把兩者都描述成由肝臟轉成且都是腎臟直接排出，表述過度簡化。",
      B: "有爭議但方向可理解。ADH 增加內髓集合管尿素通透性，促進尿素再吸收與髓質高滲梯度，因此尿素排出可能下降。",
      C: "正確。代謝性酸中毒時，腎臟 glutamine 代謝增加，以產生 NH₄⁺ 排酸。",
      D: "開放給分。尿素再吸收不是初級主動運輸，而是經尿素轉運蛋白進行 facilitated diffusion。"
    },
    testedConcept: "腎臟生理／氨排泄與尿素循環"
  },
  "MOEX-115020-1301-Q075": {
    stem:
      "某酵素催化反應的 kcat = 600（單位 1/s），Km = 10 μM。當受質濃度是 50 μM，酵素濃度是 20 nM，此時測得之反應初速度（V0）約為多少 μM/s？",
    explanation:
      "本題先用 Michaelis-Menten 公式計算初速度：V0 = Vmax[S]/(Km + [S])。又 Vmax = kcat[E]total，酵素濃度 20 nM = 0.02 μM，所以 Vmax = 600 × 0.02 = 12 μM/s。代入 [S] = 50 μM、Km = 10 μM：V0 = 12 × 50 / (10 + 50) = 10 μM/s，因此答案為 B。",
    optionAnalysis: {
      A: "錯。1 μM/s 通常是單位換算或受質分率少算造成的低估。",
      B: "正確。20 nM 先換成 0.02 μM，再代入 Michaelis-Menten 公式得到 10 μM/s。",
      C: "錯。60 μM/s 超過本題 Vmax = 12 μM/s，不可能是初速度。",
      D: "錯。500 μM/s 遠高於 Vmax，量級明顯不合。"
    },
    testedConcept: "生物化學／酵素動力學／Michaelis-Menten 與 kcat 計算"
  },
  "MOEX-115020-1301-Q060": {
    stem: "有關腦部循環與血流調控之敘述，何者最為適當？",
    options: {
      A: "腦部之流量自動控制（flow autoregulation）機制較肝臟顯著，腦部動脈血中二氧化碳濃度升高時會引起血管擴張",
      B: "肝臟之流量自動控制（flow autoregulation）機制較腦部顯著，腦部動脈血中二氧化碳濃度升高時會引起血管擴張",
      C: "腦部之流量自動控制（flow autoregulation）機制較肝臟顯著，腦部動脈血中二氧化碳濃度升高時會引起血管收縮",
      D: "肝臟之流量自動控制（flow autoregulation）機制較腦部顯著，腦部動脈血中二氧化碳濃度升高時會引起血管收縮"
    }
  }
};

function applyQuestionTextOverride(question: Question): Question {
  const override = questionTextOverrides[question.id];
  if (!override) return question;

  return {
    ...question,
    stem: override.stem ?? question.stem,
    options: {
      ...question.options,
      ...(override.options ?? {})
    },
    answer: override.answer ?? question.answer,
    acceptedAnswers: override.acceptedAnswers ?? question.acceptedAnswers,
    answerCreditType: override.answerCreditType ?? question.answerCreditType,
    explanation: override.explanation ?? question.explanation,
    optionAnalysis: override.optionAnalysis
      ? {
          ...(question.optionAnalysis ?? {}),
          ...override.optionAnalysis
        }
      : question.optionAnalysis,
    memoryTip: override.memoryTip ?? question.memoryTip,
    testedConcept: override.testedConcept ?? question.testedConcept
  };
}

function finalizeQuestion(question: Question) {
  return applyQuestionMedia(
    applyQuestionTextOverride(
      applyClassificationOverride(sanitizeQuestionText(question))
    )
  );
}

const remainingQuestionsRaw = (
  moexMed1RemainingDetailedV4Merged0011827Raw as DetailedQuestionSource
).questions;
export const med1RemainingQuestions: Question[] = remainingQuestionsRaw
  .map(toQuestion)
  .filter((question): question is Question => Boolean(question))
  .map(finalizeQuestion);

const missingQuestionsRaw =
  moexMed1Missing22QuestionsDetailedV5 as readonly MissingQuestionRaw[];
export const med1MissingQuestions: Question[] = missingQuestionsRaw
  .map(toMissingQuestion)
  .filter((question): question is Question => Boolean(question))
  .map(finalizeQuestion);

const missingBatch1Raw =
  (moexMed1MissingBatch1 as { questions: DetailedMissingBatchQuestionRaw[] })
    .questions as readonly DetailedMissingBatchQuestionRaw[];
export const med1MissingBatch1Questions: Question[] = missingBatch1Raw
  .map(toDetailedMissingBatchQuestion)
  .filter((question): question is Question => Boolean(question))
  .map(finalizeQuestion);

const missingBatch2Raw =
  (moexMed1MissingBatch2 as { questions: DetailedMissingBatchQuestionRaw[] })
    .questions as readonly DetailedMissingBatchQuestionRaw[];
export const med1MissingBatch2Questions: Question[] = missingBatch2Raw
  .map(toDetailedMissingBatchQuestion)
  .filter((question): question is Question => Boolean(question))
  .map(finalizeQuestion);

const missingBatch3Raw = moexMed1MissingBatch3 as readonly Batch3QuestionRaw[];
export const med1MissingBatch3Questions: Question[] = missingBatch3Raw
  .map(toBatch3Question)
  .filter((question): question is Question => Boolean(question))
  .map(finalizeQuestion);

const requestedPatchQuestionsRaw =
  moexMed1Requested71QuestionsDetailedPatchV5.questions as readonly RequestedPatchQuestionRaw[];
export const med1RequestedPatchQuestions: Question[] = requestedPatchQuestionsRaw
  .map(toRequestedPatchQuestion)
  .filter((question): question is Question => Boolean(question))
  .map(finalizeQuestion);

const stage2QuestionsRaw =
  moexMedStage2Merged0013100.questions as readonly Stage2QuestionRaw[];
export const medStage2Questions: Question[] = stage2QuestionsRaw
  .map(toStage2Question)
  .filter((question): question is Question => Boolean(question))
  .map(finalizeQuestion);

const anatomyQuestionsWithOverrides: Question[] = anatomyQuestions
  .map(finalizeQuestion);

const MED1_CANONICAL_SUBJECTS = new Set<SubjectName>([
  "解剖學",
  "組織學",
  "胚胎學",
  "生理學",
  "生物化學",
  "細胞生物學",
  "分子生物學",
  "其他醫學一"
]);

const MED2_CANONICAL_SUBJECTS = new Set<SubjectName>([
  "藥理學",
  "病理學",
  "微生物免疫學",
  "寄生蟲學",
  "公共衛生學"
]);

const SIMULATION_EXAM_DISTRIBUTIONS: Partial<Record<SubjectFilter, Partial<Record<SubjectName, number>>>> = {
  "醫學（一）": {
    "解剖學": 31,
    "生理學": 27,
    "生物化學": 27,
    "組織學": 10,
    "胚胎學": 5
  },
  "醫學（二）": {
    "微生物免疫學": 28,
    "藥理學": 25,
    "病理學": 25,
    "公共衛生學": 15,
    "寄生蟲學": 7
  }
};

const manualInjectedQuestions: Question[] = [
  {
    id: "MOEX-111100-1301-Q040",
    subject: "組織學",
    chapter: "組織學",
    section: "內耳組織／特殊感覺",
    stem: "下列有關膜性迷路（membranous labyrinth）的敘述，何者錯誤？",
    options: {
      A: "壺腹嵴（crista ampullaris）是頭部角加速運動（angular acceleration）的感覺受器",
      B: "頂帽（cupula）的耳石（otolith）是頭部直線加速運動（linear acceleration）的感覺受器",
      C: "前庭階（scala vestibule）與鼓室階（scala tympani）於蝸孔（helicotrema）彼此相通",
      D: "耳蝸導管（cochlear duct）內，流動的液體為內淋巴液（endolymph）"
    },
    answer: "B",
    acceptedAnswers: ["B", "C"],
    answerCreditType: "multiple_accepted",
    explanation:
      "本題官方採計 B、C 皆可給分。B 的錯誤在於 cupula 本身沒有耳石；耳石（otolith／otoconia）位於橢圓囊與球囊的耳石膜，用來感受直線加速度與頭部位置變化。C 敘述在概念上通常視為正確，但因官方疑義採計，作答時 B 或 C 都算對。",
    testedConcept: "內耳組織／特殊感覺",
    optionAnalysis: {
      A: "正確。壺腹嵴感受旋轉造成的角加速度。",
      B: "可採計。cupula 沒有耳石；耳石在 utricle 與 saccule 的 macula 上。",
      C: "可採計。scala vestibuli 和 scala tympani 在 helicotrema 相通，原句因官方疑義也給分。",
      D: "正確。cochlear duct 又稱 scala media，內含 endolymph。"
    },
    sourceType: "MOEX_PAST_EXAM",
    sourceCitation: "考選部 2022 第二次 醫學（一） 1301",
    sourceYear: 2022,
    sourceRound: 2,
    originalQuestionNumber: 40,
    examCode: "111100",
    paperCode: "1301",
    examSessionLabel: "第二次"
  },
  {
    id: "MOEX-115020-1301-Q066",
    subject: "生理學",
    chapter: "生理學",
    section: "腎臟生理／氨排泄與尿素循環",
    stem: "關於氨的排泄，下列敘述何者最不適當？",
    options: {
      A: "肝臟會將有毒的氨轉變為尿素（urea）或麩醯胺酸（glutamine），兩者都是腎臟排出體外",
      B: "尿素（urea）從尿液的排出會受血管加壓素（vasopressin）的表現而下降",
      C: "麩醯胺酸（glutamine）在腎臟中的代謝量，會因為代謝性酸中毒而增加",
      D: "尿素（urea）的再吸收是初級主動運輸通道表現上升，促使尿素的再吸收"
    },
    answer: "D",
    acceptedAnswers: ["A", "D"],
    answerCreditType: "multiple_accepted",
    explanation:
      "本題開放 A、D 給分。D 不適當在於尿素再吸收主要透過尿素轉運蛋白，例如 UT-A 類轉運，屬於 facilitated diffusion，並受到 ADH／vasopressin 影響，並不是初級主動運輸。A 也可被採計，因為氨的跨器官處理與 glutamine 來源、腎臟代謝排酸的表述過度簡化，容易造成「兩者都是腎臟排出體外」的判讀爭議。代謝性酸中毒時，腎臟會增加 glutamine 代謝，產生 NH₄⁺ 排酸並生成新的 HCO₃⁻。",
    testedConcept: "腎臟生理／氨排泄與尿素循環",
    optionAnalysis: {
      A: "開放給分。尿素確實主要經腎臟排出，但 glutamine 的產生與腎臟代謝排酸較複雜，原句把兩者都描述成由肝臟轉成且都是腎臟直接排出，表述過度簡化。",
      B: "有爭議但方向可理解。ADH 增加內髓集合管尿素通透性，促進尿素再吸收與髓質高滲梯度，因此尿素排出可能下降。",
      C: "正確。代謝性酸中毒時，腎臟 glutamine 代謝增加，以產生 NH₄⁺ 排酸。",
      D: "開放給分。尿素再吸收不是初級主動運輸，而是經尿素轉運蛋白進行 facilitated diffusion。"
    },
    sourceType: "MOEX_PAST_EXAM",
    sourceCitation: "考選部 2026 第一次 醫學（一） 1301",
    sourceYear: 2026,
    sourceRound: 1,
    originalQuestionNumber: 66,
    examCode: "115020",
    paperCode: "1301",
    examSessionLabel: "第一次"
  }
];

export const canonicalQuestionBank: Question[] = dedupeQuestionBank([
  ...anatomyQuestionsWithOverrides,
  ...med1RemainingQuestions,
  ...med1MissingQuestions,
  ...med1MissingBatch1Questions,
  ...med1MissingBatch2Questions,
  ...med1MissingBatch3Questions,
  ...med1RequestedPatchQuestions,
  ...medStage2Questions,
  ...manualInjectedQuestions
]).map(applyAnalysisPrimaryTagClassification);

const QUESTION_BANK_SUBJECTS: SubjectName[] = [
  "醫學（一）",
  "醫學（二）",
  "解剖學",
  "生理學",
  "生物化學",
  "藥理學",
  "病理學",
  "微生物免疫學",
  "胚胎學",
  "組織學",
  "寄生蟲學",
  "公共衛生學",
  "細胞生物學",
  "分子生物學",
  "其他醫學一"
];

function buildQuestionsBySubject(questionBank: Question[]) {
  const questionMap = Object.fromEntries(
    QUESTION_BANK_SUBJECTS.map((subject) => [subject, [] as Question[]])
  ) as Record<SubjectName, Question[]>;

  for (const question of questionBank) {
    if (MED1_CANONICAL_SUBJECTS.has(question.subject)) {
      questionMap["醫學（一）"].push(question);
    }
    if (MED2_CANONICAL_SUBJECTS.has(question.subject)) {
      questionMap["醫學（二）"].push(question);
    }
    if (question.subject !== "醫學（一）" && question.subject !== "醫學（二）") {
      questionMap[question.subject]?.push(question);
    }
  }

  return questionMap;
}

export const med1QuestionsBySubject = buildQuestionsBySubject(canonicalQuestionBank);
export const allAnatomyQuestions = med1QuestionsBySubject["解剖學"];

function buildOutline(questions: Question[]): SubjectOutlineEntry[] {
  const chapterMap = new Map<string, Set<string>>();

  questions.forEach((question) => {
    const sections = chapterMap.get(question.chapter) ?? new Set<string>();
    sections.add(question.section);
    chapterMap.set(question.chapter, sections);
  });

  return Array.from(chapterMap.entries())
    .map(([chapter, sections]) => ({
      chapter,
      sections: Array.from(sections).sort((a, b) => a.localeCompare(b, "zh-Hant"))
    }))
    .sort((a, b) => a.chapter.localeCompare(b.chapter, "zh-Hant"));
}

const outlineCache = new Map<SubjectName, SubjectOutlineEntry[]>();
export const med1OutlinesBySubject = {} as Record<SubjectName, SubjectOutlineEntry[]>;

for (const subject of QUESTION_BANK_SUBJECTS) {
  Object.defineProperty(med1OutlinesBySubject, subject, {
    configurable: false,
    enumerable: true,
    get() {
      const cached = outlineCache.get(subject);
      if (cached) return cached;

      const outline =
        subject === "解剖學"
          ? anatomyOutline.map((item) => ({
              chapter: item.chapter,
              sections: [...item.sections]
            }))
          : buildOutline(med1QuestionsBySubject[subject]);
      outlineCache.set(subject, outline);
      return outline;
    }
  });
}

export type PastPaperOption = {
  key: string;
  label: string;
  subject: SubjectFilter;
  questionCount: number;
  missingNumbers?: number[];
  isComplete?: boolean;
  sourceYear?: number;
  sourceRound?: 1 | 2;
};

function shuffle<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

function uniqueById(questions: Question[]) {
  const seenIds = new Set<string>();
  return questions.filter((question) => {
    if (seenIds.has(question.id)) return false;
    seenIds.add(question.id);
    return true;
  });
}

function dedupeQuestionBank(questions: Question[]) {
  const nonMoex = uniqueById(questions.filter((question) => question.sourceType !== "MOEX_PAST_EXAM"));
  const moexBuckets = new Map<string, Question[]>();

  questions
    .filter((question) => question.sourceType === "MOEX_PAST_EXAM")
    .map(fillPastPaperMetadata)
    .forEach((question) => {
      const slotKey =
        question.examCode && question.paperCode && question.originalQuestionNumber
          ? `${question.examCode}-${question.paperCode}-${question.originalQuestionNumber}`
          : question.id;
      const bucket = moexBuckets.get(slotKey) ?? [];
      bucket.push(question);
      moexBuckets.set(slotKey, bucket);
    });

  return [
    ...nonMoex,
    ...Array.from(moexBuckets.values()).map(selectBestQuestionVariant)
  ];
}

function fillPastPaperMetadata(question: Question): Question {
  if (question.examCode && question.paperCode && question.originalQuestionNumber) {
    return question;
  }

  const parsedId = parseMoexQuestionId(question.id);
  if (!parsedId) {
    return question;
  }

  return {
    ...question,
    examCode: question.examCode ?? parsedId.examCode,
    paperCode: question.paperCode ?? parsedId.paperCode,
    originalQuestionNumber: question.originalQuestionNumber ?? parsedId.questionNumber
  };
}

function getQuestionRichnessScore(question: Question) {
  return (
    (question.sourceType === "MOEX_PAST_EXAM" ? 200 : 0) +
    (question.reviewFlags?.includes("requested_supplement_patch") ? 140 : 0) +
    (question.reviewFlags?.includes("missing_question_filled_v5") ? 80 : 0) +
    (question.answerCreditType === "all_credit" ? 25 : 0) +
    (question.answerCreditType === "multiple_accepted" ||
    question.answerCreditType === "multiple_answers"
      ? 20
      : 0) +
    (question.needsHumanReview ? 10 : 0) +
    Math.min(question.explanation.length, 400) +
    Object.keys(question.optionAnalysis ?? {}).length * 25 +
    (question.memoryTip ? 15 : 0) +
    (question.clinicalLink ? 12 : 0)
  );
}

function selectBestQuestionVariant(candidates: Question[]) {
  return [...candidates].sort((left, right) => {
    return getQuestionRichnessScore(right) - getQuestionRichnessScore(left);
  })[0];
}

function buildWholePastPaperBankFromBank(questionBank: Question[]) {
  const allMoexQuestions = questionBank
    .filter((question) => question.sourceType === "MOEX_PAST_EXAM")
    .map(fillPastPaperMetadata);
  const grouped = new Map<string, Question[]>();

  allMoexQuestions.forEach((question) => {
    if (!question.examCode || !question.paperCode || !question.originalQuestionNumber) return;
    const key = `${question.examCode}-${question.paperCode}-${question.originalQuestionNumber}`;
    const bucket = grouped.get(key) ?? [];
    bucket.push(question);
    grouped.set(key, bucket);
  });

  return Array.from(grouped.values())
    .map(selectBestQuestionVariant)
    .sort((a, b) => {
      const leftKey = `${a.examCode}-${a.paperCode}`;
      const rightKey = `${b.examCode}-${b.paperCode}`;
      if (leftKey !== rightKey) return leftKey.localeCompare(rightKey);
      return (a.originalQuestionNumber ?? 0) - (b.originalQuestionNumber ?? 0);
    });
}

let wholePastPaperBankCache: Question[] | null = null;

export function applyQuestionClassificationOverride(
  question: Question,
  override?: QuestionClassificationOverride | null
) {
  return applyClassificationOverrideWithPrimaryTagPriority(question, override);
}

export function applyQuestionClassificationOverrides(
  questions: Question[],
  overrides: Record<string, QuestionClassificationOverride> = {}
) {
  if (Object.keys(overrides).length === 0) return questions;

  return questions.map((question) =>
    applyQuestionClassificationOverride(question, overrides[question.id])
  );
}

function buildRuntimeQuestionMap(questionBank: Question[]): Record<SubjectName, Question[]> {
  return {
    "醫學（一）": questionBank.filter((question) => question.sourceCitation?.includes("醫學（一）")),
    "醫學（二）": questionBank.filter((question) => question.sourceCitation?.includes("醫學（二）")),
    "解剖學": questionBank.filter((question) => question.subject === "解剖學"),
    "生理學": questionBank.filter((question) => question.subject === "生理學"),
    "生物化學": questionBank.filter((question) => question.subject === "生物化學"),
    "藥理學": questionBank.filter((question) => question.subject === "藥理學"),
    "病理學": questionBank.filter((question) => question.subject === "病理學"),
    "微生物免疫學": questionBank.filter((question) => question.subject === "微生物免疫學"),
    "胚胎學": questionBank.filter((question) => question.subject === "胚胎學"),
    "組織學": questionBank.filter((question) => question.subject === "組織學"),
    "寄生蟲學": questionBank.filter((question) => question.subject === "寄生蟲學"),
    "公共衛生學": questionBank.filter((question) => question.subject === "公共衛生學"),
    "細胞生物學": questionBank.filter((question) => question.subject === "細胞生物學"),
    "分子生物學": questionBank.filter((question) => question.subject === "分子生物學"),
    "其他醫學一": questionBank.filter((question) => question.subject === "其他醫學一")
  };
}

export function getCanonicalQuestionBank(
  overrides: Record<string, QuestionClassificationOverride> = {}
) {
  if (Object.keys(overrides).length === 0) return canonicalQuestionBank;

  return dedupeQuestionBank(applyQuestionClassificationOverrides(canonicalQuestionBank, overrides));
}

export { getImportedCustomPaperQuestionsByIds } from "@/data/importedCustomPaperQuestions";
export {
  getAISimulationPaperLabel,
  getAISimulationPaperOptions,
  getQuestionsForAISimulationPaper
} from "@/data/aiSimulationPapers";
export type { AISimulationPaperOption } from "@/data/aiSimulationPapers";

function getWholePastPaperBank(
  overrides: Record<string, QuestionClassificationOverride> = {}
) {
  if (Object.keys(overrides).length === 0) {
    wholePastPaperBankCache ??= buildWholePastPaperBankFromBank(canonicalQuestionBank);
    return wholePastPaperBankCache;
  }

  return buildWholePastPaperBankFromBank(getCanonicalQuestionBank(overrides));
}

function getBucketKey(question: Question, subjectFilter: SubjectFilter) {
  if (subjectFilter === "全部") {
    return question.subject;
  }

  if (subjectFilter === "解剖學") {
    return question.chapter;
  }

  return question.chapter || question.section || question.subject;
}

function scaleDistribution(
  counts: Map<string, number>,
  targetCount: number
) {
  const total = Array.from(counts.values()).reduce((sum, value) => sum + value, 0);
  if (total <= 0 || targetCount <= 0) return new Map<string, number>();

  const scaledEntries = Array.from(counts.entries()).map(([key, value]) => {
    const exact = (value / total) * targetCount;
    const floored = Math.floor(exact);
    return {
      key,
      exact,
      count: floored,
      remainder: exact - floored
    };
  });

  let assigned = scaledEntries.reduce((sum, item) => sum + item.count, 0);
  scaledEntries
    .sort((a, b) => b.remainder - a.remainder)
    .forEach((item) => {
      if (assigned >= targetCount) return;
      item.count += 1;
      assigned += 1;
    });

  return new Map(scaledEntries.map((item) => [item.key, item.count]));
}

function buildTemplateDistribution(
  questions: Question[],
  subjectFilter: SubjectFilter
) {
  const counts = new Map<string, number>();
  questions.forEach((question) => {
    const key = getBucketKey(question, subjectFilter);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return counts;
}

export function getQuestionBankBySubjectFilter(
  subjectFilter: SubjectFilter = "解剖學",
  overrides: Record<string, QuestionClassificationOverride> = {}
) {
  const questionMap =
    Object.keys(overrides).length === 0
      ? med1QuestionsBySubject
      : buildRuntimeQuestionMap(getCanonicalQuestionBank(overrides));

  if (subjectFilter === "全部") {
    return dedupeQuestionBank([
      ...questionMap["醫學（一）"],
      ...questionMap["醫學（二）"]
    ]);
  }

  return questionMap[subjectFilter] ?? [];
}

export function getQuestionBankBySubjects(
  subjects: SubjectName[] = [],
  overrides: Record<string, QuestionClassificationOverride> = {}
) {
  if (subjects.length === 0) return [];

  const questionMap =
    Object.keys(overrides).length === 0
      ? med1QuestionsBySubject
      : buildRuntimeQuestionMap(getCanonicalQuestionBank(overrides));

  const uniqueIds = new Set<string>();
  const merged: Question[] = [];

  subjects.forEach((subject) => {
    (questionMap[subject] ?? []).forEach((question) => {
      if (uniqueIds.has(question.id)) return;
      uniqueIds.add(question.id);
      merged.push(question);
    });
  });

  return merged;
}

const SEASONAL_REPRO_KEYWORDS = [
  "生殖",
  "泌尿生殖",
  "排卵",
  "月經",
  "妊娠",
  "胎兒",
  "胎盤",
  "子宮",
  "卵巢",
  "睪丸",
  "陰道",
  "陰莖",
  "攝護腺",
  "前列腺",
  "精囊",
  "精子",
  "卵子",
  "受精",
  "著床",
  "泌乳",
  "乳房",
  "性腺",
  "生殖股神經",
  "生殖內分泌",
  "GnRH",
  "FSH",
  "LH",
  "雌激素",
  "黃體素",
  "睪固酮",
  "ovary",
  "ovarian",
  "testis",
  "testicular",
  "uterus",
  "uterine",
  "placenta",
  "placental",
  "pregnan",
  "menstrual",
  "ovulation",
  "spermat",
  "reproduct"
];

export function getSeasonalLimitedQuestions(
  overrides: Record<string, QuestionClassificationOverride> = {}
) {
  const bank = getQuestionBankBySubjects(["生理學"], overrides);

  return dedupeQuestionBank(
    bank.filter((question) => {
      const haystack = [
        question.subject,
        question.chapter,
        question.section,
        question.stem,
        question.testedConcept,
        question.explanation,
        question.memoryTip,
        question.clinicalLink,
        ...Object.values(question.options)
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return SEASONAL_REPRO_KEYWORDS.some((keyword) =>
        haystack.includes(keyword.toLowerCase())
      );
    })
  );
}

export function getPastPaperOptions(
  subjectFilter: SubjectFilter = "全部",
  overrides: Record<string, QuestionClassificationOverride> = {}
): PastPaperOption[] {
  const bank = getWholePastPaperBank(overrides);
  const paperMap = new Map<string, PastPaperOption>();

  bank.forEach((question) => {
    if (!question.examCode || !question.paperCode) return;
    const examLabel = question.sourceCitation?.includes("醫學（二）") ? "醫學（二）" : "醫學（一）";
    if (
      subjectFilter === "醫學（一）" ||
      subjectFilter === "醫學（二）"
    ) {
      if (examLabel !== subjectFilter) return;
    }

    const key = `${question.examCode}-${question.paperCode}`;
    const current = paperMap.get(key);
    if (current) {
      current.questionCount += 1;
      return;
    }

    paperMap.set(key, {
      key,
      label: `${question.sourceYear ?? ""} 第${question.sourceRound ?? (question.examSessionLabel?.includes("第二") ? 2 : 1)}次 ${examLabel} ${question.paperCode}`,
      subject: examLabel as SubjectFilter,
      questionCount: 1,
      sourceYear: question.sourceYear,
      sourceRound: question.sourceRound ?? (question.examSessionLabel?.includes("第二") ? 2 : 1)
    });
  });

  return Array.from(paperMap.values())
    .map((paper) => {
      const presentNumbers = new Set(
        bank
          .filter((question) => `${question.examCode}-${question.paperCode}` === paper.key)
          .map((question) => question.originalQuestionNumber)
          .filter((value): value is number => typeof value === "number")
      );
      const missingNumbers = Array.from({ length: 100 }, (_, index) => index + 1).filter(
        (number) => !presentNumbers.has(number)
      );

      return {
        ...paper,
        missingNumbers,
        isComplete: missingNumbers.length === 0,
        questionCount: presentNumbers.size
      };
    })
    .sort((a, b) => {
      const yearDiff = (a.sourceYear ?? 0) - (b.sourceYear ?? 0);
      if (yearDiff !== 0) return yearDiff;
      const roundDiff = (a.sourceRound ?? 1) - (b.sourceRound ?? 1);
      if (roundDiff !== 0) return roundDiff;
      return a.key.localeCompare(b.key);
    });
}

export function getQuestionsForPastPaper(
  paperKey: string,
  subjectFilter: SubjectFilter = "全部",
  overrides: Record<string, QuestionClassificationOverride> = {}
) {
  return getWholePastPaperBank(overrides)
    .filter((question) => {
      if (`${question.examCode}-${question.paperCode}` !== paperKey) return false;
      if (
        subjectFilter === "醫學（一）" ||
        subjectFilter === "醫學（二）"
      ) {
        const examLabel = question.sourceCitation?.includes("醫學（二）") ? "醫學（二）" : "醫學（一）";
        return examLabel === subjectFilter;
      }
      return true;
    })
    .sort((a, b) => (a.originalQuestionNumber ?? 0) - (b.originalQuestionNumber ?? 0));
}

function buildDistributionRandomSet(
  bank: Question[],
  distribution: Partial<Record<SubjectName, number>>,
  targetCount: number
) {
  const selected: Question[] = [];
  const seenIds = new Set<string>();

  Object.entries(distribution).forEach(([subject, requestedCount]) => {
    const count = Math.max(0, Math.floor(requestedCount ?? 0));
    const bucket = shuffle(bank.filter((question) => question.subject === subject));
    bucket.slice(0, count).forEach((question) => {
      if (seenIds.has(question.id)) return;
      seenIds.add(question.id);
      selected.push(question);
    });
  });

  if (selected.length < targetCount) {
    const remaining = shuffle(bank.filter((question) => !seenIds.has(question.id)));
    remaining.slice(0, targetCount - selected.length).forEach((question) => {
      seenIds.add(question.id);
      selected.push(question);
    });
  }

  return shuffle(selected).slice(0, targetCount);
}

export function buildExamLikeRandomSet(
  subjectFilter: SubjectFilter = "全部",
  questionCount = 50,
  overrides: Record<string, QuestionClassificationOverride> = {}
) {
  const bank = getQuestionBankBySubjectFilter(subjectFilter, overrides);
  if (bank.length === 0) return [];

  const targetCount = Math.max(1, Math.min(questionCount, bank.length));
  const fixedDistribution = SIMULATION_EXAM_DISTRIBUTIONS[subjectFilter];
  if (fixedDistribution) {
    return buildDistributionRandomSet(bank, fixedDistribution, Math.min(100, targetCount));
  }

  const papers = getPastPaperOptions(subjectFilter, overrides);

  if (papers.length === 0) {
    return shuffle(bank).slice(0, targetCount);
  }

  const templatePaper = papers[Math.floor(Math.random() * papers.length)];
  const templateQuestions = getQuestionsForPastPaper(templatePaper.key, subjectFilter, overrides);
  if (templateQuestions.length === 0) {
    return shuffle(bank).slice(0, targetCount);
  }

  const scaledDistribution = scaleDistribution(
    buildTemplateDistribution(templateQuestions, subjectFilter),
    targetCount
  );

  const bankBuckets = new Map<string, Question[]>();
  bank.forEach((question) => {
    const key = getBucketKey(question, subjectFilter);
    const bucket = bankBuckets.get(key) ?? [];
    bucket.push(question);
    bankBuckets.set(key, bucket);
  });

  const selected: Question[] = [];
  const seenIds = new Set<string>();

  scaledDistribution.forEach((count, key) => {
    const bucket = shuffle(bankBuckets.get(key) ?? []);
    bucket.slice(0, count).forEach((question) => {
      if (seenIds.has(question.id)) return;
      seenIds.add(question.id);
      selected.push(question);
    });
  });

  if (selected.length < targetCount) {
    const remaining = shuffle(bank.filter((question) => !seenIds.has(question.id)));
    remaining.slice(0, targetCount - selected.length).forEach((question) => {
      seenIds.add(question.id);
      selected.push(question);
    });
  }

  return shuffle(selected).slice(0, targetCount);
}
