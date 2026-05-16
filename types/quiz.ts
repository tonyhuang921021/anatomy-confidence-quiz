export type OptionKey = "A" | "B" | "C" | "D" | "E";
export type DifficultyLevel = "basic" | "easy" | "medium" | "hard";
export type QuestionSourceType = "MOEX_PAST_EXAM" | "AI_GENERATED";
export type AnswerCreditType =
  | "standard"
  | "multiple_accepted"
  | "all_credit"
  | "multiple_answers";
export type SubjectName =
  | "醫學（一）"
  | "醫學（二）"
  | "解剖學"
  | "生理學"
  | "生物化學"
  | "藥理學"
  | "病理學"
  | "微生物免疫學"
  | "胚胎學"
  | "組織學"
  | "寄生蟲學"
  | "公共衛生學"
  | "細胞生物學"
  | "分子生物學"
  | "其他醫學一";

export type Question = {
  id: string;
  subject: SubjectName;
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
  acceptedAnswers?: OptionKey[];
  answerCreditType?: AnswerCreditType;
  explanation: string;
  testedConcept: string;
  optionAnalysis?: Partial<Record<OptionKey, string>>;
  memoryTip?: string;
  clinicalLink?: string;
  answerConfidence?: "high" | "medium" | "low";
  needsHumanReview?: boolean;
  reviewFlags?: string[];
  detailVersion?: string;
  source?: "local" | "ai-generated" | "past-exam-inspired";
  sourceType?: QuestionSourceType;
  sourceCitation?: string;
  sourceYear?: number;
  sourceRound?: 1 | 2;
  originalQuestionNumber?: number;
  examCode?: string;
  paperCode?: string;
  examSessionLabel?: string;
  difficulty?: DifficultyLevel;
};

export type ConfidenceLevel = 1 | 2 | 3 | 4 | 5;

export type ErrorType =
  | "完全沒印象"
  | "背錯"
  | "看錯題目 / 粗心"
  | "兩選項猶豫"
  | "忘記了";

export type Attempt = {
  questionId: string;
  selectedAnswer: OptionKey;
  correctAnswer: OptionKey;
  isCorrect: boolean;
  confidence: ConfidenceLevel;
  errorType?: ErrorType;
  answeredAt: string;
};

export type QuizMode = "random" | "weakness" | "review" | "ai_fresh" | "simulation";

export type SubjectFilter = SubjectName | "全部";
export type SimulationFeedbackMode = "full" | "answer_only" | "none";
export type SimulationPaperMode = "random_set" | "past_paper" | "random_past_paper";

export type QuizSettings = {
  mode: QuizMode;
  questionCount: number;
  subjectFilter?: SubjectFilter;
  subjectFilters?: SubjectName[];
  excludeAiGenerated?: boolean;
  customQuestionIds?: string[];
  customPoolLabel?: string;
  chapter?: string;
  section?: string;
  usePastExamStyle?: boolean;
  feedbackMode?: SimulationFeedbackMode;
  paperMode?: SimulationPaperMode;
  selectedPaperKey?: string;
};

export type QuizSession = {
  id: string;
  subject: SubjectName;
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

export type LeaderboardEntry = {
  userId: string;
  displayName: string;
  totalAttempts: number;
  correctAttempts: number;
  correctRate: number;
  totalSessions: number;
  updatedAt?: string;
};

export type VisitorStats = {
  totalVisitors: number;
  onlineVisitors: number;
  updatedAt: string;
};

export type QuestionCommunityStats = {
  questionId: string;
  totalAttempts: number;
  correctAttempts: number;
  correctRate: number;
  updatedAt?: string;
};

export type AdminDashboardStats = {
  totalVisitors: number;
  onlineVisitors: number;
  totalSyncedUsers: number;
  todayAttempts: number;
  updatedAt: string;
};
