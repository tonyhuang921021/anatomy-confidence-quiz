import { anatomyOutline, anatomyQuestions } from "@/data/anatomyQuestions";
import { moexMed1RemainingDetailedV4Merged0011827 } from "@/data/sources/moex_med1_remaining_detailed_v4_merged_001_1827";
import { moexMed1Missing22QuestionsDetailedV5 } from "@/data/sources/moex_med1_missing_22_questions_detailed_v5";
import { moexMed1Requested71QuestionsDetailedPatchV5 } from "@/data/sources/moex_med1_requested_71_questions_detailed_patch_v5";
import moexMed1MissingBatch1 from "@/data/sources/moex_med1_missing_batch1_100030_1101_detailed.json";
import moexMed1MissingBatch2 from "@/data/sources/moex_med1_missing_batch2_109020_1301_detailed.json";
import moexMed1MissingBatch3 from "@/data/sources/moex_med1_missing_batch3_112020_1301_detailed.json";
import moexMed1ReclassifiedV5 from "@/data/sources/moex_med1_100_115_reclassified_v5.json";
import moexMedStage2Merged0013100 from "@/data/sources/moex_med_stage2_detailed_merged_001_3100_classified_v3.json";
import type { OptionKey, Question, SubjectFilter, SubjectName } from "@/types/quiz";

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

function toPartialOptionAnalysis(
  source?: Readonly<Record<string, string>>
): Partial<Record<OptionKey, string>> | undefined {
  if (!source) return undefined;

  const nextEntries = Object.entries(source).filter(([key]) => isOptionKey(key));
  if (nextEntries.length === 0) return undefined;

  return Object.fromEntries(nextEntries) as Partial<Record<OptionKey, string>>;
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
  const acceptedAnswers = (raw.correct_answers ?? [])
    .map((value) => value.trim())
    .filter(isOptionKey);
  const primaryAnswer = raw.answer?.trim() ?? acceptedAnswers[0] ?? "";
  if (!isOptionKey(primaryAnswer)) return null;
  if (raw.answer_credit_type === "multiple_answers") return null;

  const { primarySubject, topicSection, chapter, section } = resolvePlacement(
    raw.classification_v4?.primary_subject,
    raw.classification_v4?.topic_section
  );

  return {
    id: raw.id,
    subject: primarySubject,
    chapter,
    section,
    stem: raw.stem,
    options: {
      A: raw.options.A ?? "",
      B: raw.options.B ?? "",
      C: raw.options.C ?? "",
      D: raw.options.D ?? "",
      ...(raw.options.E ? { E: raw.options.E } : {})
    },
    answer: primaryAnswer,
    acceptedAnswers: acceptedAnswers.length > 0 ? acceptedAnswers : undefined,
    answerCreditType: raw.answer_credit_type as Question["answerCreditType"],
    explanation: raw.explanation ?? "",
    testedConcept: raw.exam_point ?? topicSection ?? section,
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
  const answerValues = [raw.corrected_answer, raw.official_answer]
    .flatMap((value) => (Array.isArray(value) ? value : value ? [value] : []))
    .map((value) => value.trim())
    .filter(isOptionKey);
  const primaryAnswer = answerValues[0] ?? "";
  if (!isOptionKey(primaryAnswer)) return null;

  const [examCode, paperCode] = raw.exam_code.split("-");
  const { primarySubject, topicSection, chapter, section } = resolvePlacement(
    raw.classification_v5?.primary_subject,
    raw.classification_v5?.subtopic
  );
  const answerCreditType = normalizeAnswerCreditType(raw.answer_credit_type);

  return {
    id: raw.id,
    subject: primarySubject,
    chapter,
    section,
    stem: raw.stem,
    options: {
      A: raw.options.A ?? "",
      B: raw.options.B ?? "",
      C: raw.options.C ?? "",
      D: raw.options.D ?? "",
      ...(raw.options.E ? { E: raw.options.E } : {})
    },
    answer: primaryAnswer,
    acceptedAnswers: answerValues.length > 0 ? answerValues : undefined,
    answerCreditType,
    explanation: raw.explanation ?? "",
    testedConcept: raw.exam_point ?? topicSection ?? section,
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
  const answerValues = (raw.correct_answers ?? [])
    .map((value) => value.trim())
    .filter(isOptionKey);
  const fallbackAnswer = raw.official_answer_raw?.trim();
  const primaryAnswer = answerValues[0] ?? (fallbackAnswer && isOptionKey(fallbackAnswer) ? fallbackAnswer : "");
  if (!isOptionKey(primaryAnswer)) return null;

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
    stem: raw.stem,
    options: {
      A: raw.options.A ?? "",
      B: raw.options.B ?? "",
      C: raw.options.C ?? "",
      D: raw.options.D ?? "",
      ...(raw.options.E ? { E: raw.options.E } : {})
    },
    answer: primaryAnswer,
    acceptedAnswers: answerValues.length > 0 ? answerValues : undefined,
    answerCreditType: normalizeAnswerCreditType(raw.answer_credit_type),
    explanation: raw.explanation ?? "",
    testedConcept: raw.exam_point ?? topicSection ?? section,
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
  const acceptedAnswers = (raw.correct_answers ?? [])
    .map((value) => value.trim())
    .filter(isOptionKey);
  const primaryAnswer = raw.answer?.trim() ?? acceptedAnswers[0] ?? "";
  if (!isOptionKey(primaryAnswer)) return null;
  if (raw.answer_credit_type === "multiple_answers") return null;

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
    stem: raw.stem,
    options: {
      A: raw.options.A ?? "",
      B: raw.options.B ?? "",
      C: raw.options.C ?? "",
      D: raw.options.D ?? "",
      ...(raw.options.E ? { E: raw.options.E } : {})
    },
    answer: primaryAnswer,
    acceptedAnswers: acceptedAnswers.length > 0 ? acceptedAnswers : undefined,
    answerCreditType: normalizeAnswerCreditType(raw.answer_credit_type),
    explanation: raw.explanation ?? "",
    testedConcept: raw.exam_point ?? topicSection ?? section,
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
  const answerValues = [raw.corrected_answer, raw.official_answer_raw, raw.correct_answers]
    .flatMap((value) => {
      if (Array.isArray(value)) return value;
      return value ? [value] : [];
    })
    .map((value) => value.trim())
    .filter(isOptionKey);
  const primaryAnswer = answerValues[0] ?? "";
  if (!isOptionKey(primaryAnswer)) return null;
  if (raw.answer_credit_type === "multiple_answers") return null;

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
    stem: raw.stem,
    options: {
      A: raw.options.A ?? "",
      B: raw.options.B ?? "",
      C: raw.options.C ?? "",
      D: raw.options.D ?? "",
      ...(raw.options.E ? { E: raw.options.E } : {})
    },
    answer: primaryAnswer,
    acceptedAnswers: answerValues.length > 0 ? answerValues : undefined,
    answerCreditType: normalizeAnswerCreditType(raw.answer_credit_type),
    explanation: raw.explanation ?? "",
    testedConcept: raw.exam_point ?? topicSection ?? section,
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

const med1ReclassifiedQuestionsRaw =
  (moexMed1ReclassifiedV5 as { questions: ReclassifiedQuestionRaw[] }).questions ?? [];

type ClassificationOverrideEntry = readonly [string, ClassificationOverride];

const med1ClassificationOverrideMap = new Map<string, ClassificationOverride>(
  med1ReclassifiedQuestionsRaw
    .flatMap((raw) => {
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
    })
);

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

const remainingQuestionsRaw =
  moexMed1RemainingDetailedV4Merged0011827.questions as readonly RawQuestion[];
export const med1RemainingQuestions: Question[] = remainingQuestionsRaw
  .map(toQuestion)
  .filter((question): question is Question => Boolean(question))
  .map(applyClassificationOverride);

const missingQuestionsRaw =
  moexMed1Missing22QuestionsDetailedV5 as readonly MissingQuestionRaw[];
export const med1MissingQuestions: Question[] = missingQuestionsRaw
  .map(toMissingQuestion)
  .filter((question): question is Question => Boolean(question))
  .map(applyClassificationOverride);

const missingBatch1Raw =
  (moexMed1MissingBatch1 as { questions: DetailedMissingBatchQuestionRaw[] })
    .questions as readonly DetailedMissingBatchQuestionRaw[];
export const med1MissingBatch1Questions: Question[] = missingBatch1Raw
  .map(toDetailedMissingBatchQuestion)
  .filter((question): question is Question => Boolean(question))
  .map(applyClassificationOverride);

const missingBatch2Raw =
  (moexMed1MissingBatch2 as { questions: DetailedMissingBatchQuestionRaw[] })
    .questions as readonly DetailedMissingBatchQuestionRaw[];
export const med1MissingBatch2Questions: Question[] = missingBatch2Raw
  .map(toDetailedMissingBatchQuestion)
  .filter((question): question is Question => Boolean(question))
  .map(applyClassificationOverride);

const missingBatch3Raw = moexMed1MissingBatch3 as readonly Batch3QuestionRaw[];
export const med1MissingBatch3Questions: Question[] = missingBatch3Raw
  .map(toBatch3Question)
  .filter((question): question is Question => Boolean(question))
  .map(applyClassificationOverride);

const requestedPatchQuestionsRaw =
  moexMed1Requested71QuestionsDetailedPatchV5.questions as readonly RequestedPatchQuestionRaw[];
export const med1RequestedPatchQuestions: Question[] = requestedPatchQuestionsRaw
  .map(toRequestedPatchQuestion)
  .filter((question): question is Question => Boolean(question))
  .map(applyClassificationOverride);

const stage2QuestionsRaw =
  moexMedStage2Merged0013100.questions as readonly Stage2QuestionRaw[];
export const medStage2Questions: Question[] = stage2QuestionsRaw
  .map(toStage2Question)
  .filter((question): question is Question => Boolean(question));

export const allAnatomyQuestions: Question[] = dedupeQuestionBank([
  ...anatomyQuestions,
  ...med1RemainingQuestions.filter((question) => question.subject === "解剖學"),
  ...med1MissingQuestions.filter((question) => question.subject === "解剖學"),
  ...med1MissingBatch1Questions.filter((question) => question.subject === "解剖學"),
  ...med1MissingBatch2Questions.filter((question) => question.subject === "解剖學"),
  ...med1MissingBatch3Questions.filter((question) => question.subject === "解剖學"),
  ...med1RequestedPatchQuestions.filter((question) => question.subject === "解剖學"),
  ...medStage2Questions.filter((question) => question.subject === "解剖學")
]);

const med1CoreQuestions: Question[] = dedupeQuestionBank([
  ...allAnatomyQuestions,
  ...med1RemainingQuestions.filter((question) => question.subject === "組織學"),
  ...med1RemainingQuestions.filter((question) => question.subject === "胚胎學"),
  ...med1RemainingQuestions.filter(
    (question) => question.subject === "生理學" || question.subject === "生物化學"
  ),
  ...medStage2Questions.filter(
    (question) => question.subject === "組織學" || question.subject === "胚胎學"
  ),
  ...medStage2Questions.filter(
    (question) => question.subject === "生理學" || question.subject === "生物化學"
  ),
  ...med1MissingQuestions.filter((question) =>
    ["組織學", "胚胎學", "生理學", "生物化學"].includes(question.subject)
  ),
  ...med1MissingBatch1Questions.filter((question) =>
    ["組織學", "胚胎學", "生理學", "生物化學"].includes(question.subject)
  ),
  ...med1MissingBatch2Questions.filter((question) =>
    ["組織學", "胚胎學", "生理學", "生物化學"].includes(question.subject)
  ),
  ...med1MissingBatch3Questions.filter((question) =>
    ["組織學", "胚胎學", "生理學", "生物化學"].includes(question.subject)
  ),
  ...med1RequestedPatchQuestions.filter((question) =>
    ["組織學", "胚胎學", "生理學", "生物化學"].includes(question.subject)
  )
]);

const med2CoreQuestions: Question[] = dedupeQuestionBank([
  ...medStage2Questions.filter((question) =>
    ["藥理學", "病理學", "微生物免疫學", "寄生蟲學", "公共衛生學"].includes(question.subject)
  ),
  ...med1RemainingQuestions.filter((question) =>
    ["藥理學", "病理學", "微生物免疫學", "寄生蟲學", "公共衛生學"].includes(question.subject)
  ),
  ...med1MissingQuestions.filter((question) =>
    ["藥理學", "病理學", "微生物免疫學", "寄生蟲學", "公共衛生學"].includes(question.subject)
  ),
  ...med1MissingBatch1Questions.filter((question) =>
    ["藥理學", "病理學", "微生物免疫學", "寄生蟲學", "公共衛生學"].includes(question.subject)
  ),
  ...med1MissingBatch2Questions.filter((question) =>
    ["藥理學", "病理學", "微生物免疫學", "寄生蟲學", "公共衛生學"].includes(question.subject)
  ),
  ...med1MissingBatch3Questions.filter((question) =>
    ["藥理學", "病理學", "微生物免疫學", "寄生蟲學", "公共衛生學"].includes(question.subject)
  ),
  ...med1RequestedPatchQuestions.filter((question) =>
    ["藥理學", "病理學", "微生物免疫學", "寄生蟲學", "公共衛生學"].includes(question.subject)
  )
]);

export const med1QuestionsBySubject: Record<SubjectName, Question[]> = {
  "醫學（一）": med1CoreQuestions,
  "醫學（二）": med2CoreQuestions,
  "解剖學": allAnatomyQuestions,
  "生理學": dedupeQuestionBank([
    ...med1RemainingQuestions.filter((question) => question.subject === "生理學"),
    ...med1MissingQuestions.filter((question) => question.subject === "生理學"),
    ...med1MissingBatch1Questions.filter((question) => question.subject === "生理學"),
    ...med1MissingBatch2Questions.filter((question) => question.subject === "生理學"),
    ...med1MissingBatch3Questions.filter((question) => question.subject === "生理學"),
    ...med1RequestedPatchQuestions.filter((question) => question.subject === "生理學"),
    ...medStage2Questions.filter((question) => question.subject === "生理學")
  ]),
  "生物化學": dedupeQuestionBank([
    ...med1RemainingQuestions.filter((question) => question.subject === "生物化學"),
    ...med1MissingQuestions.filter((question) => question.subject === "生物化學"),
    ...med1MissingBatch1Questions.filter((question) => question.subject === "生物化學"),
    ...med1MissingBatch2Questions.filter((question) => question.subject === "生物化學"),
    ...med1MissingBatch3Questions.filter((question) => question.subject === "生物化學"),
    ...med1RequestedPatchQuestions.filter((question) => question.subject === "生物化學"),
    ...medStage2Questions.filter((question) => question.subject === "生物化學")
  ]),
  "藥理學": dedupeQuestionBank([
    ...med1RemainingQuestions.filter((question) => question.subject === "藥理學"),
    ...med1MissingQuestions.filter((question) => question.subject === "藥理學"),
    ...med1MissingBatch1Questions.filter((question) => question.subject === "藥理學"),
    ...med1MissingBatch2Questions.filter((question) => question.subject === "藥理學"),
    ...med1MissingBatch3Questions.filter((question) => question.subject === "藥理學"),
    ...med1RequestedPatchQuestions.filter((question) => question.subject === "藥理學"),
    ...medStage2Questions.filter((question) => question.subject === "藥理學")
  ]),
  "病理學": dedupeQuestionBank([
    ...med1RemainingQuestions.filter((question) => question.subject === "病理學"),
    ...med1MissingQuestions.filter((question) => question.subject === "病理學"),
    ...med1MissingBatch1Questions.filter((question) => question.subject === "病理學"),
    ...med1MissingBatch2Questions.filter((question) => question.subject === "病理學"),
    ...med1MissingBatch3Questions.filter((question) => question.subject === "病理學"),
    ...med1RequestedPatchQuestions.filter((question) => question.subject === "病理學"),
    ...medStage2Questions.filter((question) => question.subject === "病理學")
  ]),
  "微生物免疫學": dedupeQuestionBank([
    ...med1RemainingQuestions.filter((question) => question.subject === "微生物免疫學"),
    ...med1MissingQuestions.filter((question) => question.subject === "微生物免疫學"),
    ...med1MissingBatch1Questions.filter((question) => question.subject === "微生物免疫學"),
    ...med1MissingBatch2Questions.filter((question) => question.subject === "微生物免疫學"),
    ...med1MissingBatch3Questions.filter((question) => question.subject === "微生物免疫學"),
    ...med1RequestedPatchQuestions.filter((question) => question.subject === "微生物免疫學"),
    ...medStage2Questions.filter((question) => question.subject === "微生物免疫學")
  ]),
  "胚胎學": dedupeQuestionBank([
    ...med1RemainingQuestions.filter((question) => question.subject === "胚胎學"),
    ...med1MissingQuestions.filter((question) => question.subject === "胚胎學"),
    ...med1MissingBatch1Questions.filter((question) => question.subject === "胚胎學"),
    ...med1MissingBatch2Questions.filter((question) => question.subject === "胚胎學"),
    ...med1MissingBatch3Questions.filter((question) => question.subject === "胚胎學"),
    ...med1RequestedPatchQuestions.filter((question) => question.subject === "胚胎學"),
    ...medStage2Questions.filter((question) => question.subject === "胚胎學")
  ]),
  "組織學": dedupeQuestionBank([
    ...med1RemainingQuestions.filter((question) => question.subject === "組織學"),
    ...med1MissingQuestions.filter((question) => question.subject === "組織學"),
    ...med1MissingBatch1Questions.filter((question) => question.subject === "組織學"),
    ...med1MissingBatch2Questions.filter((question) => question.subject === "組織學"),
    ...med1MissingBatch3Questions.filter((question) => question.subject === "組織學"),
    ...med1RequestedPatchQuestions.filter((question) => question.subject === "組織學"),
    ...medStage2Questions.filter((question) => question.subject === "組織學")
  ]),
  "寄生蟲學": dedupeQuestionBank([
    ...med1RemainingQuestions.filter((question) => question.subject === "寄生蟲學"),
    ...med1MissingQuestions.filter((question) => question.subject === "寄生蟲學"),
    ...med1MissingBatch1Questions.filter((question) => question.subject === "寄生蟲學"),
    ...med1MissingBatch2Questions.filter((question) => question.subject === "寄生蟲學"),
    ...med1MissingBatch3Questions.filter((question) => question.subject === "寄生蟲學"),
    ...med1RequestedPatchQuestions.filter((question) => question.subject === "寄生蟲學"),
    ...medStage2Questions.filter((question) => question.subject === "寄生蟲學")
  ]),
  "公共衛生學": dedupeQuestionBank([
    ...med1RemainingQuestions.filter((question) => question.subject === "公共衛生學"),
    ...med1MissingQuestions.filter((question) => question.subject === "公共衛生學"),
    ...med1MissingBatch1Questions.filter((question) => question.subject === "公共衛生學"),
    ...med1MissingBatch2Questions.filter((question) => question.subject === "公共衛生學"),
    ...med1MissingBatch3Questions.filter((question) => question.subject === "公共衛生學"),
    ...med1RequestedPatchQuestions.filter((question) => question.subject === "公共衛生學"),
    ...medStage2Questions.filter((question) => question.subject === "公共衛生學")
  ]),
  "細胞生物學": med1RemainingQuestions.filter((question) => question.subject === "細胞生物學"),
  "分子生物學": med1RemainingQuestions.filter((question) => question.subject === "分子生物學"),
  "其他醫學一": med1RemainingQuestions.filter((question) => question.subject === "其他醫學一")
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
    (question.answerCreditType === "multiple_accepted" ? 20 : 0) +
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

function buildWholePastPaperBank() {
  const allMoexQuestions = uniqueById(
    [
      ...allAnatomyQuestions,
      ...med1RemainingQuestions,
      ...med1MissingQuestions,
      ...med1MissingBatch1Questions,
      ...med1MissingBatch2Questions,
      ...med1MissingBatch3Questions,
      ...med2CoreQuestions
    ]
      .filter((question) => question.sourceType === "MOEX_PAST_EXAM")
      .map(fillPastPaperMetadata)
  );
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

const wholePastPaperBank = buildWholePastPaperBank();

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

export function getQuestionBankBySubjectFilter(subjectFilter: SubjectFilter = "解剖學") {
  if (subjectFilter === "全部") {
    return dedupeQuestionBank([
      ...med1QuestionsBySubject["醫學（一）"],
      ...med1QuestionsBySubject["醫學（二）"]
    ]);
  }

  return med1QuestionsBySubject[subjectFilter] ?? [];
}

export function getQuestionBankBySubjects(subjects: SubjectName[] = []) {
  if (subjects.length === 0) return [];

  const uniqueIds = new Set<string>();
  const merged: Question[] = [];

  subjects.forEach((subject) => {
    (med1QuestionsBySubject[subject] ?? []).forEach((question) => {
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

export function getSeasonalLimitedQuestions() {
  const bank = getQuestionBankBySubjects(["生理學"]);

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

export function getPastPaperOptions(subjectFilter: SubjectFilter = "全部"): PastPaperOption[] {
  void subjectFilter;
  const bank = wholePastPaperBank;
  const paperMap = new Map<string, PastPaperOption>();

  bank.forEach((question) => {
    if (!question.examCode || !question.paperCode) return;
    const key = `${question.examCode}-${question.paperCode}`;
    const current = paperMap.get(key);
    if (current) {
      current.questionCount += 1;
      return;
    }

    const examLabel = question.sourceCitation?.includes("醫學（二）") ? "醫學（二）" : "醫學（一）";

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
        questionCount: 100
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
  subjectFilter: SubjectFilter = "全部"
) {
  void subjectFilter;
  return wholePastPaperBank
    .filter((question) => `${question.examCode}-${question.paperCode}` === paperKey)
    .sort((a, b) => (a.originalQuestionNumber ?? 0) - (b.originalQuestionNumber ?? 0));
}

export function buildExamLikeRandomSet(
  subjectFilter: SubjectFilter = "全部",
  questionCount = 50
) {
  const bank = getQuestionBankBySubjectFilter(subjectFilter);
  if (bank.length === 0) return [];

  const targetCount = Math.max(1, Math.min(questionCount, bank.length));
  const papers = getPastPaperOptions(subjectFilter);

  if (papers.length === 0) {
    return shuffle(bank).slice(0, targetCount);
  }

  const templatePaper = papers[Math.floor(Math.random() * papers.length)];
  const templateQuestions = getQuestionsForPastPaper(templatePaper.key, subjectFilter);
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
