import { anatomyOutline, anatomyQuestions } from "@/data/anatomyQuestions";
import { moexMed1RemainingDetailedV4Merged0011827 } from "@/data/sources/moex_med1_remaining_detailed_v4_merged_001_1827";
import { moexMed1Missing22QuestionsDetailedV5 } from "@/data/sources/moex_med1_missing_22_questions_detailed_v5";
import { moexMed1Requested71QuestionsDetailedPatchV5 } from "@/data/sources/moex_med1_requested_71_questions_detailed_patch_v5";
import moexMed1MissingBatch1 from "@/data/sources/moex_med1_missing_batch1_100030_1101_detailed.json";
import moexMed1MissingBatch2 from "@/data/sources/moex_med1_missing_batch2_109020_1301_detailed.json";
import moexMed1MissingBatch3 from "@/data/sources/moex_med1_missing_batch3_112020_1301_detailed.json";
import moexMed1ReclassifiedV5 from "@/data/sources/moex_med1_100_115_reclassified_v5.json";
import moexMed1Requested149ReclassificationPatch from "@/data/sources/moex_med1_requested_149_reclassification_patch.json";
import moexMedStage2Merged0013100 from "@/data/sources/moex_med_stage2_detailed_merged_001_3100_classified_v3.json";
import questionMediaManifest from "@/data/sources/question_media_manifest.json";
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

function sanitizeImportedText(value?: string) {
  if (!value) return "";

  return value
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
    answerCreditType: "standard"
  },
  "MOEX-114090-1301-Q094": {
    answer: "C",
    answerCreditType: "standard"
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
    return {
      answer: primaryAnswer,
      acceptedAnswers: answerCandidates.length > 0 ? answerCandidates : undefined,
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
med1ClassificationOverrideMap.set("MOEX-100030-2101-Q073", {
  subject: "藥理學",
  topicSection: "抗生素"
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
    explanation:
      "壺腹嵴（crista ampullaris）位於半規管的壺腹，感受角加速度，其上方是 cupula。但 cupula 本身沒有耳石。耳石（otolith／otoconia）位於橢圓囊與球囊的耳石膜，用來感受直線加速度與頭部位置變化。所以 B 把 cupula 和 otolith 混在一起，是最明顯錯誤。",
    optionAnalysis: {
      A: "正確。壺腹嵴感受旋轉造成的角加速度。",
      B: "錯。cupula 沒有耳石；耳石在 utricle 與 saccule 的 macula 上。",
      C: "正確。scala vestibuli 和 scala tympani 在 helicotrema 相通。",
      D: "正確。cochlear duct 又稱 scala media，內含 endolymph。"
    },
    testedConcept: "內耳組織／特殊感覺"
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
    answer: "C",
    explanation:
      "題幹重點是講話流利但閱讀困難。Broca 區病灶通常造成非流利失語，不合題幹。Wernicke 區病灶可造成流利但理解差的失語，但若題目特別強調閱讀困難，較典型與 angular gyrus 有關，因為 angular gyrus 參與視覺文字與語言理解的整合。Arcuate fasciculus 則較典型造成傳導性失語，重點是 repetition impaired。",
    optionAnalysis: {
      A: "Wernicke 區：流利失語、理解差，但不是單純閱讀困難最典型位置。",
      B: "Broca 區：非流利失語，與講話流利不合。",
      C: "Angular gyrus：與閱讀、書寫、語言整合有關，是學理上最合理答案。",
      D: "Arcuate fasciculus：傳導性失語，特徵是複誦困難。"
    },
    testedConcept: "神經生理／語言功能"
  },
  "MOEX-114090-1301-Q094": {
    answer: "C",
    explanation:
      "電子傳遞鏈中，complex I、III、IV 會將 H⁺ 從 matrix 泵到 intermembrane space，建立質子梯度。常見記法是每 2 個電子經過：complex I 泵 4H⁺、complex III 泵 4H⁺、complex IV 泵 2H⁺。所以 C 最符合標準教科書觀念。",
    optionAnalysis: {
      A: "錯。complex I 是把 H⁺ 從 matrix 泵到膜間腔，不是到 matrix。",
      B: "錯。complex III 也是把 H⁺ 泵到膜間腔，不是到 matrix。",
      C: "正確。complex III 約將 4H⁺ 移至 intermembrane space。",
      D: "不精準。complex IV 通常是約 2H⁺ 被泵到膜間腔，不是 4H⁺。"
    },
    testedConcept: "電子傳遞鏈與氧化磷酸化"
  },
  "MOEX-115020-1301-Q066": {
    answer: "D",
    explanation:
      "尿素在腎臟中的再吸收主要透過尿素轉運蛋白，例如 UT-A 類轉運，屬於 facilitated diffusion，並受到 ADH／vasopressin 影響。它不是初級主動運輸。因此 D 最明顯不適當。代謝性酸中毒時，腎臟會增加 glutamine 代謝，產生 NH₄⁺ 排酸並生成新的 HCO₃⁻。",
    optionAnalysis: {
      A: "大致可接受。氨可在肝臟轉成尿素，也可轉成 glutamine 形式運輸，最後由腎臟處理排出。",
      B: "有爭議但方向可理解。ADH 增加內髓集合管尿素通透性，促進尿素再吸收與髓質高滲梯度，因此尿素排出可能下降。",
      C: "正確。代謝性酸中毒時，腎臟 glutamine 代謝增加，以產生 NH₄⁺ 排酸。",
      D: "錯。尿素再吸收不是初級主動運輸，而是經尿素轉運蛋白進行 facilitated diffusion。"
    },
    testedConcept: "腎臟生理／氨排泄與尿素循環"
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

const remainingQuestionsRaw =
  moexMed1RemainingDetailedV4Merged0011827.questions as readonly RawQuestion[];
export const med1RemainingQuestions: Question[] = remainingQuestionsRaw
  .map(toQuestion)
  .filter((question): question is Question => Boolean(question))
  .map(sanitizeQuestionText)
  .map(applyClassificationOverride)
  .map(applyQuestionTextOverride)
  .map(applyQuestionMedia);

const missingQuestionsRaw =
  moexMed1Missing22QuestionsDetailedV5 as readonly MissingQuestionRaw[];
export const med1MissingQuestions: Question[] = missingQuestionsRaw
  .map(toMissingQuestion)
  .filter((question): question is Question => Boolean(question))
  .map(sanitizeQuestionText)
  .map(applyClassificationOverride)
  .map(applyQuestionTextOverride)
  .map(applyQuestionMedia);

const missingBatch1Raw =
  (moexMed1MissingBatch1 as { questions: DetailedMissingBatchQuestionRaw[] })
    .questions as readonly DetailedMissingBatchQuestionRaw[];
export const med1MissingBatch1Questions: Question[] = missingBatch1Raw
  .map(toDetailedMissingBatchQuestion)
  .filter((question): question is Question => Boolean(question))
  .map(sanitizeQuestionText)
  .map(applyClassificationOverride)
  .map(applyQuestionTextOverride)
  .map(applyQuestionMedia);

const missingBatch2Raw =
  (moexMed1MissingBatch2 as { questions: DetailedMissingBatchQuestionRaw[] })
    .questions as readonly DetailedMissingBatchQuestionRaw[];
export const med1MissingBatch2Questions: Question[] = missingBatch2Raw
  .map(toDetailedMissingBatchQuestion)
  .filter((question): question is Question => Boolean(question))
  .map(sanitizeQuestionText)
  .map(applyClassificationOverride)
  .map(applyQuestionTextOverride)
  .map(applyQuestionMedia);

const missingBatch3Raw = moexMed1MissingBatch3 as readonly Batch3QuestionRaw[];
export const med1MissingBatch3Questions: Question[] = missingBatch3Raw
  .map(toBatch3Question)
  .filter((question): question is Question => Boolean(question))
  .map(sanitizeQuestionText)
  .map(applyClassificationOverride)
  .map(applyQuestionTextOverride)
  .map(applyQuestionMedia);

const requestedPatchQuestionsRaw =
  moexMed1Requested71QuestionsDetailedPatchV5.questions as readonly RequestedPatchQuestionRaw[];
export const med1RequestedPatchQuestions: Question[] = requestedPatchQuestionsRaw
  .map(toRequestedPatchQuestion)
  .filter((question): question is Question => Boolean(question))
  .map(sanitizeQuestionText)
  .map(applyClassificationOverride)
  .map(applyQuestionTextOverride)
  .map(applyQuestionMedia);

const stage2QuestionsRaw =
  moexMedStage2Merged0013100.questions as readonly Stage2QuestionRaw[];
export const medStage2Questions: Question[] = stage2QuestionsRaw
  .map(toStage2Question)
  .filter((question): question is Question => Boolean(question))
  .map(sanitizeQuestionText)
  .map(applyQuestionTextOverride)
  .map(applyQuestionMedia);

const anatomyQuestionsWithOverrides: Question[] = anatomyQuestions
  .map(sanitizeQuestionText)
  .map(applyClassificationOverride)
  .map(applyQuestionTextOverride)
  .map(applyQuestionMedia);

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
    answerCreditType: "standard",
    explanation:
      "壺腹嵴（crista ampullaris）位於半規管的壺腹，感受角加速度，其上方是 cupula。但 cupula 本身沒有耳石。耳石（otolith／otoconia）位於橢圓囊與球囊的耳石膜，用來感受直線加速度與頭部位置變化。所以 B 把 cupula 和 otolith 混在一起，是最明顯錯誤。",
    testedConcept: "內耳組織／特殊感覺",
    optionAnalysis: {
      A: "正確。壺腹嵴感受旋轉造成的角加速度。",
      B: "錯。cupula 沒有耳石；耳石在 utricle 與 saccule 的 macula 上。",
      C: "正確。scala vestibuli 和 scala tympani 在 helicotrema 相通。",
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
    answerCreditType: "standard",
    explanation:
      "尿素在腎臟中的再吸收主要透過尿素轉運蛋白，例如 UT-A 類轉運，屬於 facilitated diffusion，並受到 ADH／vasopressin 影響。它不是初級主動運輸。因此 D 最明顯不適當。代謝性酸中毒時，腎臟會增加 glutamine 代謝，產生 NH₄⁺ 排酸並生成新的 HCO₃⁻。",
    testedConcept: "腎臟生理／氨排泄與尿素循環",
    optionAnalysis: {
      A: "大致可接受。氨可在肝臟轉成尿素，也可轉成 glutamine 形式運輸，最後由腎臟處理排出。",
      B: "有爭議但方向可理解。ADH 增加內髓集合管尿素通透性，促進尿素再吸收與髓質高滲梯度，因此尿素排出可能下降。",
      C: "正確。代謝性酸中毒時，腎臟 glutamine 代謝增加，以產生 NH₄⁺ 排酸。",
      D: "錯。尿素再吸收不是初級主動運輸，而是經尿素轉運蛋白進行 facilitated diffusion。"
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
]);

export const allAnatomyQuestions: Question[] = canonicalQuestionBank.filter(
  (question) => question.subject === "解剖學"
);

const med1CoreQuestions: Question[] = canonicalQuestionBank.filter((question) =>
  MED1_CANONICAL_SUBJECTS.has(question.subject)
);

const med2CoreQuestions: Question[] = canonicalQuestionBank.filter((question) =>
  MED2_CANONICAL_SUBJECTS.has(question.subject)
);

export const med1QuestionsBySubject: Record<SubjectName, Question[]> = {
  "醫學（一）": med1CoreQuestions,
  "醫學（二）": med2CoreQuestions,
  "解剖學": allAnatomyQuestions,
  "生理學": canonicalQuestionBank.filter((question) => question.subject === "生理學"),
  "生物化學": canonicalQuestionBank.filter((question) => question.subject === "生物化學"),
  "藥理學": canonicalQuestionBank.filter((question) => question.subject === "藥理學"),
  "病理學": canonicalQuestionBank.filter((question) => question.subject === "病理學"),
  "微生物免疫學": canonicalQuestionBank.filter((question) => question.subject === "微生物免疫學"),
  "胚胎學": canonicalQuestionBank.filter((question) => question.subject === "胚胎學"),
  "組織學": canonicalQuestionBank.filter((question) => question.subject === "組織學"),
  "寄生蟲學": canonicalQuestionBank.filter((question) => question.subject === "寄生蟲學"),
  "公共衛生學": canonicalQuestionBank.filter((question) => question.subject === "公共衛生學"),
  "細胞生物學": canonicalQuestionBank.filter((question) => question.subject === "細胞生物學"),
  "分子生物學": canonicalQuestionBank.filter((question) => question.subject === "分子生物學"),
  "其他醫學一": canonicalQuestionBank.filter((question) => question.subject === "其他醫學一")
};

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

export const med1OutlinesBySubject: Record<SubjectName, SubjectOutlineEntry[]> = {
  "醫學（一）": buildOutline(med1QuestionsBySubject["醫學（一）"]),
  "醫學（二）": buildOutline(med1QuestionsBySubject["醫學（二）"]),
  "解剖學": anatomyOutline.map((item) => ({ chapter: item.chapter, sections: [...item.sections] })),
  "生理學": buildOutline(med1QuestionsBySubject["生理學"]),
  "生物化學": buildOutline(med1QuestionsBySubject["生物化學"]),
  "藥理學": buildOutline(med1QuestionsBySubject["藥理學"]),
  "病理學": buildOutline(med1QuestionsBySubject["病理學"]),
  "微生物免疫學": buildOutline(med1QuestionsBySubject["微生物免疫學"]),
  "胚胎學": buildOutline(med1QuestionsBySubject["胚胎學"]),
  "組織學": buildOutline(med1QuestionsBySubject["組織學"]),
  "寄生蟲學": buildOutline(med1QuestionsBySubject["寄生蟲學"]),
  "公共衛生學": buildOutline(med1QuestionsBySubject["公共衛生學"]),
  "細胞生物學": buildOutline(med1QuestionsBySubject["細胞生物學"]),
  "分子生物學": buildOutline(med1QuestionsBySubject["分子生物學"]),
  "其他醫學一": buildOutline(med1QuestionsBySubject["其他醫學一"])
};

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

const wholePastPaperBank = buildWholePastPaperBankFromBank(canonicalQuestionBank);

export function applyQuestionClassificationOverride(
  question: Question,
  override?: QuestionClassificationOverride | null
) {
  if (!override) return question;

  return {
    ...question,
    subject: override.subject,
    chapter: override.chapter,
    section: override.section
  };
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

function getWholePastPaperBank(
  overrides: Record<string, QuestionClassificationOverride> = {}
) {
  if (Object.keys(overrides).length === 0) return wholePastPaperBank;

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
