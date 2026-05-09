export type OptionKey = "A" | "B" | "C" | "D" | "E";
export type DifficultyLevel = "basic" | "easy" | "medium" | "hard";
export type QuestionSourceType = "MOEX_PAST_EXAM" | "AI_GENERATED";

export type Question = {
  id: string;
  subject: "解剖學";
  chapter: string;
  section: string;
  stem: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
    E?: string;
  };
  answer: OptionKey;
  explanation: string;
  testedConcept: string;
  source?: "local" | "ai-generated" | "past-exam-inspired";
  sourceType?: QuestionSourceType;
  sourceCitation?: string;
  sourceYear?: number;
  sourceRound?: 1 | 2;
  originalQuestionNumber?: number;
  difficulty?: DifficultyLevel;
};

export type ConfidenceLevel = 1 | 2 | 3 | 4 | 5;

export type ErrorType =
  | "不懂"
  | "背錯"
  | "看錯題幹"
  | "兩選項猶豫"
  | "粗心";

export type Attempt = {
  questionId: string;
  selectedAnswer: OptionKey;
  correctAnswer: OptionKey;
  isCorrect: boolean;
  confidence: ConfidenceLevel;
  errorType?: ErrorType;
  answeredAt: string;
};

export type QuizMode = "random" | "weakness" | "review" | "ai_fresh";

export type QuizSettings = {
  mode: QuizMode;
  questionCount: number;
  chapter?: string;
  section?: string;
  usePastExamStyle?: boolean;
};

export type QuizSession = {
  id: string;
  subject: "解剖學";
  startedAt: string;
  completedAt?: string;
  settings?: QuizSettings;
  questionOrder?: string[];
  generatedQuestions?: Question[];
  currentQuestionIndex?: number;
  isReviewingAnswer?: boolean;
  attempts: Attempt[];
};

export type SectionStats = {
  chapter: string;
  section: string;
  total: number;
  correct: number;
  wrong: number;
  averageConfidence: number;
  lowConfidence: number;
  overconfidence: number;
  guessRisk: number;
  priorityScore: number;
};

export type CompletionStatus =
  | "未開始"
  | "進行中"
  | "已完成但不穩"
  | "已完成且穩定";

export type SectionCompletionStats = {
  chapter: string;
  section: string;
  totalQuestionsInBank: number;
  attemptedQuestions: number;
  completionRate: number;
  correctRate: number;
  averageConfidence: number;
  masteryScore: number;
  status: CompletionStatus;
  lastAttemptedAt?: string;
};

export type ChapterCompletionStats = {
  chapter: string;
  totalQuestionsInBank: number;
  attemptedQuestions: number;
  completionRate: number;
  correctRate: number;
  averageConfidence: number;
  masteryScore: number;
  status: CompletionStatus;
  sections: SectionCompletionStats[];
};

export type OverallCompletionStats = {
  totalQuestionsInBank: number;
  attemptedQuestions: number;
  completionRate: number;
  correctRate: number;
  averageConfidence: number;
  masteryScore: number;
};

export type SummaryStats = {
  total: number;
  correct: number;
  wrong: number;
  correctRate: number;
  averageConfidence: number;
  overconfidenceCount: number;
  guessRiskCount: number;
  priorityWeaknessCount: number;
};

export type CompletionStatsBundle = {
  overall: OverallCompletionStats;
  chapters: ChapterCompletionStats[];
  sections: SectionCompletionStats[];
};

export type QuestionHistoryStats = {
  questionId: string;
  attempts: number;
  wrong: number;
  correct: number;
  lowConfidence: number;
  overconfidence: number;
  lastAttemptedAt?: string;
  latestErrorType?: ErrorType;
};

export type ReviewQuestionItem = {
  question: Question;
  history: QuestionHistoryStats;
  riskScore: number;
};
