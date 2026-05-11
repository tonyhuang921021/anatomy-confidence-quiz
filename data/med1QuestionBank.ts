import { anatomyOutline, anatomyQuestions } from "@/data/anatomyQuestions";
import { moexMed1RemainingDetailedV4Merged0011827 } from "@/data/sources/moex_med1_remaining_detailed_v4_merged_001_1827";
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
  if (
    subject.includes("解剖") ||
    subject.includes("組織") ||
    subject.includes("胚胎") ||
    subject.includes("發育生物")
  ) {
    return "解剖學";
  }
  if (subject.includes("生理")) return "生理學";
  if (
    subject.includes("生物化學") ||
    subject.includes("分子生物") ||
    subject.includes("細胞生物")
  ) {
    return "生物化學";
  }
  if (subject.includes("寄生蟲")) return "微生物免疫學";
  if (subject.includes("公共衛生")) return "公共衛生學";
  if (subject.includes("微生物") || subject.includes("免疫")) return "微生物免疫學";

  return "其他醫學一";
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

function toQuestion(raw: RawQuestion): Question | null {
  const answer = raw.answer?.trim() ?? raw.correct_answers?.[0]?.trim() ?? "";
  if (!isOptionKey(answer)) return null;
  if (raw.answer_credit_type && raw.answer_credit_type !== "standard") return null;

  const primarySubject = normalizeSubject(raw.classification_v4?.primary_subject);
  const topicSection = raw.classification_v4?.topic_section?.trim();
  const anatomyPlacement =
    primarySubject === "解剖學" ? normalizeAnatomyChapter(topicSection) : null;
  const chapter = anatomyPlacement?.chapter ?? primarySubject;
  const section = anatomyPlacement?.section ?? toSectionLabel(topicSection, primarySubject);

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
    answer,
    explanation: raw.explanation ?? "",
    testedConcept: raw.exam_point ?? topicSection ?? section,
    optionAnalysis: raw.option_analysis as Partial<Record<OptionKey, string>> | undefined,
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

const remainingQuestionsRaw =
  moexMed1RemainingDetailedV4Merged0011827.questions as readonly RawQuestion[];
export const med1RemainingQuestions: Question[] = remainingQuestionsRaw
  .map(toQuestion)
  .filter((question): question is Question => Boolean(question));

export const allAnatomyQuestions: Question[] = [
  ...anatomyQuestions,
  ...med1RemainingQuestions.filter((question) => question.subject === "解剖學")
];

export const med1QuestionsBySubject: Record<SubjectName, Question[]> = {
  "醫學（一）": [...allAnatomyQuestions, ...med1RemainingQuestions.filter((question) => question.subject !== "解剖學")],
  "解剖學": allAnatomyQuestions,
  "生理學": med1RemainingQuestions.filter((question) => question.subject === "生理學"),
  "生物化學": med1RemainingQuestions.filter((question) => question.subject === "生物化學"),
  "藥理學": med1RemainingQuestions.filter((question) => question.subject === "藥理學"),
  "病理學": med1RemainingQuestions.filter((question) => question.subject === "病理學"),
  "微生物免疫學": med1RemainingQuestions.filter((question) => question.subject === "微生物免疫學"),
  "胚胎學": med1RemainingQuestions.filter((question) => question.subject === "胚胎學"),
  "組織學": med1RemainingQuestions.filter((question) => question.subject === "組織學"),
  "寄生蟲學": med1RemainingQuestions.filter((question) => question.subject === "寄生蟲學"),
  "公共衛生學": med1RemainingQuestions.filter((question) => question.subject === "公共衛生學"),
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
};

function shuffle<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
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

export function getQuestionBankBySubjectFilter(subjectFilter: SubjectFilter = "解剖學") {
  if (subjectFilter === "全部") {
    return med1QuestionsBySubject["醫學（一）"];
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

export function getPastPaperOptions(subjectFilter: SubjectFilter = "全部"): PastPaperOption[] {
  const bank = getQuestionBankBySubjectFilter(subjectFilter);
  const paperMap = new Map<string, PastPaperOption>();

  bank.forEach((question) => {
    if (!question.examCode || !question.paperCode) return;
    const key = `${question.examCode}-${question.paperCode}`;
    const current = paperMap.get(key);
    if (current) {
      current.questionCount += 1;
      return;
    }

    paperMap.set(key, {
      key,
      label: `${question.sourceYear ?? ""} ${question.examSessionLabel ?? ""} 醫學（一） ${question.paperCode}`,
      subject: subjectFilter,
      questionCount: 1
    });
  });

  return Array.from(paperMap.values()).sort((a, b) => a.key.localeCompare(b.key));
}

export function getQuestionsForPastPaper(
  paperKey: string,
  subjectFilter: SubjectFilter = "全部"
) {
  const bank = getQuestionBankBySubjectFilter(subjectFilter);
  return bank
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
