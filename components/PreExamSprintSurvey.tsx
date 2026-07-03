"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/components/AuthProvider";
import { loadCompletedSessions } from "@/lib/storage";
import { getOrCreateVisitorId } from "@/lib/visitor";
import type { QuizSession } from "@/types/quiz";

type SurveyOption = {
  value: string;
  label: string;
  description?: string;
  needsText?: boolean;
  exclusive?: boolean;
};

type BaseQuestion = {
  id: string;
  title: string;
  hint?: string;
  required?: boolean;
};

type SingleQuestion = BaseQuestion & {
  type: "single";
  options: SurveyOption[];
  variant?: "buttons" | "select";
};

type MultipleQuestion = BaseQuestion & {
  type: "multiple";
  options: SurveyOption[];
  maxSelections?: number;
};

type RatingQuestion = BaseQuestion & {
  type: "rating";
  lowLabel: string;
  highLabel: string;
  scaleLabels?: [string, string, string, string, string];
};

type TextQuestion = BaseQuestion & {
  type: "text";
  placeholder: string;
  maxLength: number;
};

type SurveyQuestion = SingleQuestion | MultipleQuestion | RatingQuestion | TextQuestion;

type SurveyAnswerValue = string | string[] | number;

type SurveySection = {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  questionIds: string[];
};

type SerializedAnswer = {
  questionId: string;
  questionTitle: string;
  type: SurveyQuestion["type"];
  value: SurveyAnswerValue | null;
  labels?: string[];
  otherText?: string;
};

type CommunityPoint = {
  date: string;
  attempts: number;
  devices?: number;
  correctRate: number;
};

type CommunityStatsPayload = {
  points?: CommunityPoint[];
  activeUsers14d?: number | null;
};

type UsageDailyPoint = {
  date: string;
  attempts: number;
  correctRate: number;
};

type UsageReviewMetrics = {
  totalAttempts: number;
  uniqueQuestionsAnswered: number;
  activeDays: number;
  correctAttempts: number;
  wrongAttempts: number;
  accuracy: number | null;
  confidenceMarkedCount: number;
  lowConfidenceQuestionCount: number;
  wrongQuestionCount: number;
  mockExamCount: number;
  fullLengthSessionCount?: number;
  customExamCount: number;
  dailyPoints?: UsageDailyPoint[];
  savedQuestionCount?: number | null;
  noteCount?: number | null;
  explanationViewCount?: number | null;
  mostPracticedSubject?: string | null;
  weakestSubject?: string | null;
  mostActiveHour?: number | null;
  firstAnsweredAt?: string | null;
  lastAnsweredAt?: string | null;
};

type UsageReviewResponse = {
  ok?: boolean;
  loggedIn: boolean;
  hasEnoughData: boolean;
  userDisplayName?: string | null;
  metrics?: UsageReviewMetrics | null;
  source?: "cloud" | "local" | "fallback";
  message?: string;
};

type UsageReviewSnapshot = {
  loggedIn: boolean;
  hasEnoughData: boolean;
  totalAttemptsBucket: string;
  activeDaysBucket: string;
  usagePersona: string;
  reviewStyle: string;
  mostPracticedSubject?: string | null;
};

const SURVEY_ID = "med_exam_qbank_pre_exam_feedback_2026";
const SURVEY_PREVIEW_EMAILS = new Set(["tonyhuang921021@gmail.com"]);
const DISMISS_STORAGE_KEY = `acq-survey-dismissed-until:${SURVEY_ID}`;
const SUBMITTED_STORAGE_KEY = `acq-survey-submitted:${SURVEY_ID}`;
const PENDING_STORAGE_KEY = `acq-survey-pending:${SURVEY_ID}`;
const STATS_CACHE_KEY = `acq-survey-stats-cache:v5:${SURVEY_ID}`;
const DISMISS_MS = 6 * 60 * 60 * 1000;
const STATS_CACHE_MS = 6 * 60 * 60 * 1000;
const INTRO_SLIDE_COUNT = 4;

const SURVEY_QUESTIONS: SurveyQuestion[] = [
  {
    id: "school",
    type: "single",
    variant: "select",
    title: "你目前主要就讀的學校是？",
    hint: "只用來看題庫使用分布，不會公開個人資料。",
    required: true,
    options: [
      { value: "ntu", label: "國立臺灣大學醫學系" },
      { value: "nycu", label: "國立陽明交通大學醫學系" },
      { value: "ncku", label: "國立成功大學醫學系" },
      { value: "ndmc", label: "國防醫學大學醫學系" },
      { value: "tmu", label: "臺北醫學大學醫學系" },
      { value: "cgu", label: "長庚大學醫學系" },
      { value: "cmu", label: "中國醫藥大學醫學系" },
      { value: "csmu", label: "中山醫學大學醫學系" },
      { value: "kmu", label: "高雄醫學大學醫學系" },
      { value: "fju", label: "輔仁大學醫學系" },
      { value: "tcu", label: "慈濟大學醫學系" },
      { value: "mmc", label: "馬偕醫學大學醫學系" },
      { value: "isu", label: "義守大學醫學系" },
      { value: "other", label: "其他（可自行填寫）", needsText: true }
    ]
  },
  {
    id: "awareness_source",
    type: "single",
    title: "你一開始是從哪裡知道這個網站的？",
    required: true,
    options: [
      { value: "classmate", label: "同學推薦" },
      { value: "school_group", label: "系級或學校群組" },
      { value: "social_media", label: "社群平台" },
      { value: "search", label: "搜尋找到" },
      { value: "already_using", label: "之前就有在用" },
      { value: "other", label: "其他（可自行填寫）", needsText: true }
    ]
  },
  {
    id: "usage_frequency",
    type: "single",
    title: "最近一週大概多常打開刷題？",
    required: true,
    options: [
      { value: "daily", label: "幾乎每天" },
      { value: "several_times", label: "一週 3 到 5 次" },
      { value: "weekly", label: "一週 1 到 2 次" },
      { value: "just_started", label: "剛開始用" },
      { value: "rarely", label: "偶爾想到才開" }
    ]
  },
  {
    id: "primary_device",
    type: "single",
    title: "你最常用哪種裝置刷題？",
    required: true,
    options: [
      { value: "phone", label: "手機" },
      { value: "tablet", label: "iPad / 平板" },
      { value: "desktop", label: "電腦" },
      { value: "mixed", label: "手機、平板、電腦都會用" },
      { value: "other", label: "其他（可自行填寫）", needsText: true }
    ]
  },
  {
    id: "primary_browser",
    type: "single",
    title: "你最常用哪個瀏覽器？",
    hint: "這題會幫我排 Safari、手機和平板的修正優先順序。",
    required: true,
    options: [
      { value: "safari", label: "Safari" },
      { value: "chrome", label: "Chrome" },
      { value: "line_in_app", label: "LINE 內建瀏覽器" },
      { value: "edge", label: "Edge" },
      { value: "other", label: "其他（可自行填寫）", needsText: true }
    ]
  },
  {
    id: "most_used_features",
    type: "multiple",
    title: "你最常打開哪些功能？",
    hint: "最多選 3 個。這題是看你平常真的會用哪裡。",
    required: true,
    maxSelections: 3,
    options: [
      { value: "random_quiz", label: "刷題" },
      { value: "simulation", label: "模擬考 / 考古題" },
      { value: "review", label: "錯題複習" },
      { value: "search", label: "題目搜尋" },
      { value: "saved_questions", label: "收藏題目" },
      { value: "pharmacology", label: "藥理字卡" },
      { value: "progress", label: "進度瀏覽" },
      { value: "other", label: "其他（可自行填寫）", needsText: true }
    ]
  },
  {
    id: "most_helpful_features",
    type: "multiple",
    title: "目前最有幫助你的功能是哪些？",
    hint: "最多選 3 個，幫我判斷考前要守住哪幾條主線。",
    required: true,
    maxSelections: 3,
    options: [
      { value: "random_quiz", label: "刷題" },
      { value: "simulation", label: "模擬考 / 考古題" },
      { value: "review", label: "錯題複習" },
      { value: "yangming_explanations", label: "陽明詳解" },
      { value: "ai_explanations", label: "AI 詳解" },
      { value: "peer_supplements", label: "同學補充 / 同學筆記" },
      { value: "personal_notes", label: "自己的筆記" },
      { value: "search", label: "題目搜尋" },
      { value: "confidence", label: "信心度總覽" },
      { value: "saved_questions", label: "收藏題目" },
      { value: "pharmacology", label: "藥理字卡" },
      { value: "progress", label: "進度瀏覽" },
      { value: "other", label: "其他（可自行填寫）", needsText: true }
    ]
  },
  {
    id: "comparative_value",
    type: "multiple",
    title: "跟其他準備方式比，這個網站最有價值的地方是？",
    hint: "最多選 3 個。",
    required: true,
    maxSelections: 3,
    options: [
      { value: "explanation_stack", label: "同一題能看陽明、AI、同學補充和自己的筆記" },
      { value: "readable_ai", label: "AI 詳解比較像能讀的講義" },
      { value: "review_loop", label: "錯題、沒信心題、儲存題目會被帶回來複習" },
      { value: "exam_feedback", label: "模擬考後能看到信心度和補弱方向" },
      { value: "pharmacology_cards", label: "藥理字卡可以拿來快速複習" },
      { value: "community_memory", label: "同學補充讓題目不是只有一份冷冰冰答案" },
      { value: "personal_system", label: "可以把搜尋、筆記、儲存題目整理成自己的系統" },
      { value: "cross_device", label: "手機、平板、電腦可以接著讀" },
      { value: "faster_start", label: "比翻檔案更容易直接開始做題" },
      { value: "other", label: "其他（可自行填寫）", needsText: true },
      { value: "no_clear_advantage", label: "目前沒有特別明顯", exclusive: true }
    ]
  },
  {
    id: "disappearance_impact",
    type: "rating",
    title: "如果考前這個網站突然不能用，影響會多大？",
    required: true,
    lowLabel: "幾乎沒影響",
    highLabel: "考前會慌",
    scaleLabels: ["幾乎沒影響", "有點可惜", "可以用其他網站替代", "會少一個重要工具", "考前會慌"]
  },
  {
    id: "recommendation_intent",
    type: "rating",
    title: "你會把這個網站推薦給其他人或之後的學弟妹嗎？",
    required: true,
    lowLabel: "不太會",
    highLabel: "很願意",
    scaleLabels: ["不太會", "可能不會", "看情況", "會推薦", "很願意推薦"]
  },
  {
    id: "practice_review_smoothness",
    type: "rating",
    title: "整體刷題與看詳解的順暢度",
    required: true,
    lowLabel: "很卡",
    highLabel: "很順",
    scaleLabels: ["很卡", "偏卡", "普通", "大致順", "很順"]
  },
  {
    id: "sync_confidence",
    type: "rating",
    title: "你對作答紀錄與跨裝置同步的安心程度",
    required: true,
    lowLabel: "不太安心",
    highLabel: "很安心",
    scaleLabels: ["不太安心", "偶爾擔心", "普通", "大致放心", "很安心"]
  },
  {
    id: "unacceptable_issues",
    type: "multiple",
    title: "考前你最希望網站守住哪些地方？",
    hint: "最多選 3 個。這題會直接影響考前維護優先順序。",
    required: true,
    maxSelections: 3,
    options: [
      { value: "lost_records", label: "作答紀錄要穩定保留" },
      { value: "login_drop", label: "手機登入狀態要延續" },
      { value: "wrong_progress", label: "剩餘題數與進度要準" },
      { value: "slow_simulation", label: "模擬考要順" },
      { value: "bad_explanation", label: "詳解要清楚可靠" },
      { value: "mobile_layout", label: "手機閱讀要好讀" },
      { value: "other", label: "其他（可自行填寫）", needsText: true }
    ]
  },
  {
    id: "open_feedback",
    type: "text",
    title: "最後一句話就好：最想稱讚、吐槽、或希望立刻改善的一件事？",
    placeholder: "例如：某頁很卡、某功能最有用、某種題目很需要補強...",
    maxLength: 420
  }
];

const SURVEY_SECTIONS: SurveySection[] = [
  {
    id: "context",
    eyebrow: "01 / 來源",
    title: "先了解你從哪裡來。",
    description: "只用來看大家的使用分布，不會公開個人資料。",
    questionIds: ["school", "awareness_source"]
  },
  {
    id: "environment",
    eyebrow: "02 / 使用環境",
    title: "你都在哪裡刷題？",
    description: "這會幫我排 Safari、手機和平板的修正優先順序。",
    questionIds: ["primary_device", "primary_browser"]
  },
  {
    id: "usage",
    eyebrow: "03 / 使用習慣",
    title: "哪些功能真的有被用到？",
    description: "不用選看起來最完整的，選你考前真的會打開的地方就好。",
    questionIds: ["usage_frequency", "most_used_features"]
  },
  {
    id: "helpful",
    eyebrow: "04 / 真的有幫助",
    title: "哪幾個地方值得留下來？",
    description: "這題會幫我分清楚哪些功能只是有趣，哪些真的能幫上考前複習。",
    questionIds: ["most_helpful_features", "comparative_value"]
  },
  {
    id: "value",
    eyebrow: "05 / 存在必要性",
    title: "如果沒有這個網站，差別大嗎？",
    description: "這一頁想知道本站跟其他刷題方式相比，到底有沒有留下來的理由。",
    questionIds: ["disappearance_impact", "recommendation_intent"]
  },
  {
    id: "stability",
    eyebrow: "06 / 考前穩定度",
    title: "考前最怕的不是功能少，是東西不穩。",
    description: "這幾題會直接影響接下來優先修同步、手機、詳解或模擬考。",
    questionIds: ["practice_review_smoothness", "sync_confidence"]
  },
  {
    id: "feedback",
    eyebrow: "07 / 考前優先",
    title: "考前最需要先守住什麼？",
    description: "這題會直接影響接下來先修同步、手機、詳解或模擬考。",
    questionIds: ["unacceptable_issues"]
  },
  {
    id: "open-feedback",
    eyebrow: "08 / 自由回饋",
    title: "最後想聽你多說一點。",
    description: "可以稱讚、吐槽、或直接說哪裡最需要先修。越具體，我越能照著排優先順序。",
    questionIds: ["open_feedback"]
  }
];

const QUESTION_BY_ID = new Map(SURVEY_QUESTIONS.map((question) => [question.id, question]));
const TOTAL_SLIDE_COUNT = INTRO_SLIDE_COUNT + SURVEY_SECTIONS.length;

function safeGetStorage(key: string) {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function normalizeEmail(value?: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

function safeSetStorage(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage failures; the survey can still be filled in this tab.
  }
}

function safeRemoveStorage(key: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage failures.
  }
}

function getSelectedLabels(question: SurveyQuestion, value: SurveyAnswerValue | null) {
  if (question.type === "rating" || question.type === "text" || value == null) return undefined;
  const values = Array.isArray(value) ? value : [String(value)];
  const labels = question.options
    .filter((option) => values.includes(option.value))
    .map((option) => option.label);
  return labels.length > 0 ? labels : undefined;
}

function getSelectedOptions(question: SurveyQuestion, value: SurveyAnswerValue | null) {
  if (question.type === "rating" || question.type === "text" || value == null) return [];
  const values = Array.isArray(value) ? value : [String(value)];
  return question.options.filter((option) => values.includes(option.value));
}

function isAnswered(question: SurveyQuestion, value: SurveyAnswerValue | undefined, otherText?: string) {
  if (!question.required) return true;
  if (question.type === "rating") return typeof value === "number" && value >= 1 && value <= 5;
  if (question.type === "text") return typeof value === "string" && value.trim().length > 0;
  if (question.type === "single") {
    if (typeof value !== "string" || value.length === 0) return false;
    const option = question.options.find((item) => item.value === value);
    return !option?.needsText || Boolean(otherText?.trim());
  }
  if (!Array.isArray(value) || value.length === 0) return false;
  const needsText = question.options.some((option) => option.needsText && value.includes(option.value));
  return !needsText || Boolean(otherText?.trim());
}

function formatDateLabel(dateKey: string) {
  const [, month, date] = dateKey.split("-");
  return month && date ? `${Number(month)}/${Number(date)}` : dateKey;
}

function formatBarCountLabel(value: number) {
  const count = Math.max(0, Math.round(Number(value || 0)));
  return count.toLocaleString("zh-TW");
}

function formatCompactBarCountLabel(value: number) {
  const count = Math.max(0, Math.round(Number(value || 0)));
  if (count >= 10_000) return `${Math.round(count / 1000)}k`;
  if (count >= 1000) return `${(count / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return count.toLocaleString("zh-TW");
}

function getStatsSummary(points: CommunityPoint[]) {
  const attempts = points.reduce((sum, point) => sum + Number(point.attempts || 0), 0);
  const participantDays = points.reduce((sum, point) => sum + Number(point.devices || 0), 0);
  const peak = [...points].sort((left, right) => Number(right.attempts || 0) - Number(left.attempts || 0))[0];
  const weightedCorrect = points.reduce(
    (sum, point) => sum + Number(point.attempts || 0) * Number(point.correctRate || 0),
    0
  );
  return {
    attempts,
    participantDays,
    peakAttempts: peak?.attempts ?? 0,
    peakLabel: peak ? formatDateLabel(peak.date) : "最近兩週",
    correctRate: attempts > 0 ? Math.round((weightedCorrect / attempts) * 10) / 10 : null
  };
}

function getTrendPolylinePoints(
  points: Array<{ attempts: number; correctRate: number }>,
  valueGetter: (point: { attempts: number; correctRate: number }) => number,
  maxValue: number
) {
  if (points.length === 0) return "";
  const denominator = Math.max(1, maxValue);
  return points
    .map((point, index) => {
      const x = points.length === 1 ? 50 : (index / (points.length - 1)) * 100;
      const value = Math.max(0, Math.min(denominator, valueGetter(point)));
      const y = 88 - (value / denominator) * 72;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

function sumAttempts(points: Array<{ attempts: number }>) {
  return points.reduce((sum, point) => sum + Number(point.attempts || 0), 0);
}

function getWeightedCorrectRate(points: Array<{ attempts: number; correctRate: number }>) {
  const attempts = sumAttempts(points);
  if (attempts <= 0) return null;
  const weightedCorrect = points.reduce(
    (sum, point) => sum + Number(point.attempts || 0) * Number(point.correctRate || 0),
    0
  );
  return Number((weightedCorrect / attempts).toFixed(1));
}

function getTrendTakeaway(points: CommunityPoint[]) {
  const activePoints = points.filter((point) => Number(point.attempts || 0) > 0);
  if (activePoints.length === 0) {
    return "趨勢正在整理中；等資料累積後，這裡會顯示最近兩週大家刷題的起伏。";
  }

  const peak = [...activePoints].sort((left, right) => Number(right.attempts || 0) - Number(left.attempts || 0))[0];
  const latest = activePoints[activePoints.length - 1];
  const peakLabel = formatDateLabel(peak.date);
  const latestLabel = formatDateLabel(latest.date);

  if (peak.date === latest.date) {
    return `${latestLabel} 是最近兩週的刷題高點，考前節奏正在往上推。`;
  }

  return `最近高點在 ${peakLabel}，${latestLabel} 仍有 ${Number(latest.attempts || 0).toLocaleString("zh-TW")} 題作答。`;
}

function getDisplayNameFromEmail(email?: string | null) {
  const name = email?.split("@")[0]?.trim();
  if (!name) return null;
  return name.length > 18 ? `${name.slice(0, 18)}...` : name;
}

function getTaipeiDateKey(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function getRecentTaipeiDayKeys(days: number) {
  const today = new Date();
  const keys: string[] = [];

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const current = new Date(today);
    current.setDate(today.getDate() - offset);
    keys.push(getTaipeiDateKey(current.toISOString()) ?? current.toISOString().slice(0, 10));
  }

  return keys;
}

function buildUsageDailyPoints(
  attempts: Array<{ answeredAt?: string | null; isCorrect?: boolean | null }>,
  days = 30
): UsageDailyPoint[] {
  const dayKeys = getRecentTaipeiDayKeys(days);
  const grouped = new Map<string, { attempts: number; correctAttempts: number }>();

  dayKeys.forEach((dayKey) => grouped.set(dayKey, { attempts: 0, correctAttempts: 0 }));

  attempts.forEach((attempt) => {
    const dayKey = getTaipeiDateKey(attempt.answeredAt);
    if (!dayKey || !grouped.has(dayKey)) return;
    const stats = grouped.get(dayKey) ?? { attempts: 0, correctAttempts: 0 };
    stats.attempts += 1;
    if (attempt.isCorrect) stats.correctAttempts += 1;
    grouped.set(dayKey, stats);
  });

  return dayKeys.map((date) => {
    const stats = grouped.get(date) ?? { attempts: 0, correctAttempts: 0 };
    return {
      date,
      attempts: stats.attempts,
      correctRate: stats.attempts > 0 ? Number(((stats.correctAttempts / stats.attempts) * 100).toFixed(1)) : 0
    };
  });
}

function getTaipeiHour(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const hourText = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Taipei",
    hour: "2-digit",
    hourCycle: "h23"
  }).format(date);
  const hour = Number(hourText);
  return Number.isFinite(hour) ? hour : null;
}

function formatShortDate(value?: string | null) {
  const key = getTaipeiDateKey(value);
  if (!key) return "還沒留下紀錄";
  return formatDateLabel(key);
}

function bucketNumber(value: number, buckets: Array<[number, string]>, fallback: string) {
  for (const [threshold, label] of buckets) {
    if (value <= threshold) return label;
  }
  return fallback;
}

function getReviewStyle(metrics?: UsageReviewMetrics | null) {
  if (!metrics || metrics.totalAttempts < 5) {
    return {
      id: "starting",
      title: "剛開始建立節奏",
      body: "目前紀錄還不多，所以先不用被數字定義。問卷會讓我知道新同學一進來最需要哪裡順一點。"
    };
  }

  const lowConfidenceRate =
    metrics.uniqueQuestionsAnswered > 0
      ? metrics.lowConfidenceQuestionCount / metrics.uniqueQuestionsAnswered
      : 0;
  const savedOrNotes = Number(metrics.savedQuestionCount ?? 0) + Number(metrics.noteCount ?? 0);

  if (metrics.mockExamCount >= 3) {
    return {
      id: "exam-mode",
      title: "偏模擬考節奏",
      body: "你比較常用整回合來抓考感，所以結果頁、補強建議和詳解會是你考後整理的主要入口。"
    };
  }

  if (savedOrNotes >= 10) {
    return {
      id: "collector",
      title: "會整理的人",
      body: "你不只是刷過去，也會把值得回頭看的題目留下來。筆記、儲存題目和搜尋會慢慢變成你的個人索引。"
    };
  }

  if (lowConfidenceRate >= 0.25) {
    return {
      id: "calibrator",
      title: "很在意不確定感",
      body: "你留下不少低信心訊號，代表你不是只看對錯，也會標記自己當下的把握程度。"
    };
  }

  if ((metrics.accuracy ?? 0) >= 75 && metrics.totalAttempts >= 80) {
    return {
      id: "steady",
      title: "穩定推進型",
      body: "你的紀錄看起來已經有固定節奏。考前維持這個節奏，比一次塞進很多新功能更重要。"
    };
  }

  return {
    id: "builder",
    title: "一題一題補起來",
    body: "你的使用方式比較像把題目慢慢接起來。題目、詳解和回顧之間的切換，就是這條路徑的節奏。"
  };
}

function getPersona(metrics?: UsageReviewMetrics | null) {
  if (!metrics || metrics.totalAttempts < 5) {
    return {
      id: "newcomer",
      title: "剛上線的備考者",
      body: "現在最重要的是第一輪使用夠直覺，讓你可以很快從首頁進到題目。"
    };
  }

  if (metrics.mockExamCount >= Math.max(2, metrics.customExamCount)) {
    return {
      id: "simulation",
      title: "模擬考派",
      body: "你的路徑常從考卷開始，再回到結果頁和補強建議整理剛剛那一回。"
    };
  }

  if (Number(metrics.savedQuestionCount ?? 0) >= 8 || Number(metrics.noteCount ?? 0) >= 3) {
    return {
      id: "curator",
      title: "整理派",
      body: "你會把題目慢慢變成自己的資料庫，儲存題目、筆記和補充會在之後一起派上用場。"
    };
  }

  if (metrics.wrongQuestionCount >= Math.max(8, metrics.uniqueQuestionsAnswered * 0.18)) {
    return {
      id: "review",
      title: "訂正派",
      body: "你的紀錄很適合用錯題複習和詳解重新整理，讓每次答錯都能留下可回頭看的線索。"
    };
  }

  return {
    id: "daily",
    title: "穩穩刷題派",
    body: "你的使用節奏偏向快速開始、做完一段、再回來接著讀。這種日常感很值得被保留下來。"
  };
}

function buildLocalUsageReview(email?: string | null): UsageReviewResponse {
  let sessions: QuizSession[] = [];
  try {
    sessions = loadCompletedSessions();
  } catch {
    sessions = [];
  }

  const uniqueQuestions = new Set<string>();
  const wrongQuestions = new Set<string>();
  const lowConfidenceQuestions = new Set<string>();
  const activeDays = new Set<string>();
  const subjectCounts = new Map<string, number>();
  const subjectCorrectCounts = new Map<string, number>();
  const hourCounts = new Map<number, number>();
  let totalAttempts = 0;
  let correctAttempts = 0;
  let confidenceMarkedCount = 0;
  let firstAnsweredAt: string | null = null;
  let lastAnsweredAt: string | null = null;
  let mockExamCount = 0;
  let fullLengthSessionCount = 0;
  let customExamCount = 0;
  const localAttemptsForTrend: Array<{ answeredAt?: string | null; isCorrect?: boolean | null }> = [];

  for (const session of sessions) {
    if (session.settings?.mode === "simulation") mockExamCount += 1;
    if ((session.generatedQuestions?.length ?? session.attempts?.length ?? 0) >= 80) fullLengthSessionCount += 1;
    if (session.settings?.mode === "custom_paper") customExamCount += 1;
    const questionById = new Map((session.generatedQuestions ?? []).map((question) => [question.id, question]));

    for (const attempt of session.attempts ?? []) {
      totalAttempts += 1;
      localAttemptsForTrend.push({ answeredAt: attempt.answeredAt, isCorrect: attempt.isCorrect });
      if (attempt.isCorrect) correctAttempts += 1;
      if (attempt.questionId) uniqueQuestions.add(attempt.questionId);
      if (!attempt.isCorrect && attempt.questionId) wrongQuestions.add(attempt.questionId);
      if (attempt.confidence) confidenceMarkedCount += 1;
      if (attempt.confidence <= 2 && attempt.questionId) lowConfidenceQuestions.add(attempt.questionId);

      const dateKey = getTaipeiDateKey(attempt.answeredAt);
      if (dateKey) activeDays.add(dateKey);
      const hour = getTaipeiHour(attempt.answeredAt);
      if (hour !== null) hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1);
      if (!firstAnsweredAt || attempt.answeredAt < firstAnsweredAt) firstAnsweredAt = attempt.answeredAt;
      if (!lastAnsweredAt || attempt.answeredAt > lastAnsweredAt) lastAnsweredAt = attempt.answeredAt;

      const question = questionById.get(attempt.questionId);
      const subject = question?.subject ?? session.subject;
      if (subject) {
        subjectCounts.set(subject, (subjectCounts.get(subject) ?? 0) + 1);
        if (attempt.isCorrect) subjectCorrectCounts.set(subject, (subjectCorrectCounts.get(subject) ?? 0) + 1);
      }
    }
  }

  const mostPracticedSubject =
    [...subjectCounts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? null;
  const weakestSubject =
    [...subjectCounts.entries()]
      .filter(([, count]) => count >= 5)
      .map(([subject, count]) => ({
        subject,
        accuracy: ((subjectCorrectCounts.get(subject) ?? 0) / count) * 100
      }))
      .sort((left, right) => left.accuracy - right.accuracy)[0]?.subject ?? null;
  const mostActiveHour =
    [...hourCounts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? null;
  const metrics: UsageReviewMetrics = {
    totalAttempts,
    uniqueQuestionsAnswered: uniqueQuestions.size,
    activeDays: activeDays.size,
    correctAttempts,
    wrongAttempts: Math.max(0, totalAttempts - correctAttempts),
    accuracy: totalAttempts > 0 ? Number(((correctAttempts / totalAttempts) * 100).toFixed(1)) : null,
    confidenceMarkedCount,
    lowConfidenceQuestionCount: lowConfidenceQuestions.size,
    wrongQuestionCount: wrongQuestions.size,
    mockExamCount,
    fullLengthSessionCount,
    customExamCount,
    dailyPoints: buildUsageDailyPoints(localAttemptsForTrend),
    mostPracticedSubject,
    weakestSubject,
    mostActiveHour,
    firstAnsweredAt,
    lastAnsweredAt
  };

  return {
    ok: true,
    loggedIn: Boolean(email),
    hasEnoughData: totalAttempts >= 5,
    userDisplayName: getDisplayNameFromEmail(email),
    metrics,
    source: "local"
  };
}

function chooseUsageReview(cloud: UsageReviewResponse | null, local: UsageReviewResponse) {
  const cloudAttempts = cloud?.metrics?.totalAttempts ?? 0;
  const localAttempts = local.metrics?.totalAttempts ?? 0;
  if (cloud?.ok && (cloud.hasEnoughData || cloudAttempts >= localAttempts)) return cloud;
  if (localAttempts > 0 || !cloud) return local;
  return cloud;
}

function buildUsageSnapshot(review: UsageReviewResponse | null): UsageReviewSnapshot {
  const metrics = review?.metrics ?? null;
  const persona = getPersona(metrics);
  const reviewStyle = getReviewStyle(metrics);
  return {
    loggedIn: Boolean(review?.loggedIn),
    hasEnoughData: Boolean(review?.hasEnoughData),
    totalAttemptsBucket: bucketNumber(
      metrics?.totalAttempts ?? 0,
      [
        [0, "0"],
        [20, "1-20"],
        [100, "21-100"],
        [300, "101-300"],
        [800, "301-800"]
      ],
      "801+"
    ),
    activeDaysBucket: bucketNumber(
      metrics?.activeDays ?? 0,
      [
        [0, "0"],
        [3, "1-3"],
        [7, "4-7"],
        [14, "8-14"],
        [30, "15-30"]
      ],
      "31+"
    ),
    usagePersona: persona.id,
    reviewStyle: reviewStyle.id,
    mostPracticedSubject: metrics?.mostPracticedSubject ?? null
  };
}

export function PreExamSprintSurvey() {
  const { session, loading } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [surveyStep, setSurveyStep] = useState<"intro" | "form">("intro");
  const [answers, setAnswers] = useState<Record<string, SurveyAnswerValue>>({});
  const [otherTexts, setOtherTexts] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [communityPoints, setCommunityPoints] = useState<CommunityPoint[]>([]);
  const [communityActiveUsers, setCommunityActiveUsers] = useState<number | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [usageReview, setUsageReview] = useState<UsageReviewResponse | null>(null);
  const [usageReviewLoading, setUsageReviewLoading] = useState(false);
  const [submitState, setSubmitState] = useState<"idle" | "sending" | "sent" | "saved-local">("idle");
  const [submitMessage, setSubmitMessage] = useState("");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [introSlideIndex, setIntroSlideIndex] = useState(0);
  const [formPageIndex, setFormPageIndex] = useState(0);
  const [localPreviewAllowed, setLocalPreviewAllowed] = useState(false);
  const isPreviewAllowed = SURVEY_PREVIEW_EMAILS.has(normalizeEmail(session?.user?.email));

  const requiredQuestions = useMemo(
    () => SURVEY_QUESTIONS.filter((question) => question.required),
    []
  );
  const completedRequiredCount = useMemo(
    () =>
      requiredQuestions.filter((question) =>
        isAnswered(question, answers[question.id], otherTexts[question.id])
      ).length,
    [answers, otherTexts, requiredQuestions]
  );
  const statsSummary = useMemo(
    () => getStatsSummary(communityPoints),
    [communityPoints]
  );
  const usageMetrics = usageReview?.metrics ?? null;
  const maxAttempts = Math.max(...communityPoints.map((point) => Number(point.attempts || 0)), 1);
  const hasCommunityStats = communityPoints.some((point) => Number(point.attempts || 0) > 0);
  const currentSection = SURVEY_SECTIONS[formPageIndex] ?? SURVEY_SECTIONS[0];
  const currentSectionQuestions = useMemo(
    () =>
      currentSection.questionIds
        .map((questionId) => QUESTION_BY_ID.get(questionId))
        .filter((question): question is SurveyQuestion => Boolean(question)),
    [currentSection]
  );
  const surveyProgressPercent =
    surveyStep === "intro"
      ? ((introSlideIndex + 1) / TOTAL_SLIDE_COUNT) * 100
      : ((INTRO_SLIDE_COUNT + formPageIndex + 1) / TOTAL_SLIDE_COUNT) * 100;

  const loadStats = useCallback(async () => {
    const cachedRaw = safeGetStorage(STATS_CACHE_KEY);
    if (cachedRaw) {
      try {
        const cached = JSON.parse(cachedRaw) as {
          expiresAt?: number;
          points?: CommunityPoint[];
          activeUsers14d?: number | null;
        };
        if (cached.expiresAt && cached.expiresAt > Date.now()) {
          setCommunityPoints(Array.isArray(cached.points) ? cached.points : []);
          setCommunityActiveUsers(
            typeof cached.activeUsers14d === "number" ? cached.activeUsers14d : null
          );
          return;
        }
      } catch {
        safeRemoveStorage(STATS_CACHE_KEY);
      }
    }

    setStatsLoading(true);
    try {
      const communityResponse = await fetch("/api/community-stats?days=14&metric=active-users-v1", {
        cache: "no-store"
      });
      const communityData = (await communityResponse.json().catch(() => null)) as CommunityStatsPayload | null;
      const points = Array.isArray(communityData?.points) ? communityData.points : [];
      const activeUsers14d =
        typeof communityData?.activeUsers14d === "number" ? communityData.activeUsers14d : null;
      setCommunityPoints(points);
      setCommunityActiveUsers(activeUsers14d);
      safeSetStorage(
        STATS_CACHE_KEY,
        JSON.stringify({
          expiresAt: Date.now() + STATS_CACHE_MS,
          points,
          activeUsers14d
        })
      );
    } catch {
      setCommunityPoints([]);
      setCommunityActiveUsers(null);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const loadUsageReview = useCallback(async () => {
    setUsageReviewLoading(true);
    const localReview = buildLocalUsageReview(session?.user?.email ?? null);
    try {
      const response = await fetch("/api/pre-exam-survey?usageReview=1", {
        cache: "no-store",
        headers: session?.access_token
          ? {
              Authorization: `Bearer ${session.access_token}`
            }
          : undefined
      });
      const cloudReview = (await response.json().catch(() => null)) as UsageReviewResponse | null;
      setUsageReview(chooseUsageReview(cloudReview, localReview));
    } catch {
      setUsageReview(localReview);
    } finally {
      setUsageReviewLoading(false);
    }
  }, [session?.access_token, session?.user?.email]);

  useEffect(() => {
    setMounted(true);
    setHasSubmitted(Boolean(safeGetStorage(SUBMITTED_STORAGE_KEY)));
    if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
      setLocalPreviewAllowed(new URLSearchParams(window.location.search).get("preExamSurvey") === "1");
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (loading || (!isPreviewAllowed && !localPreviewAllowed)) return;
    if (safeGetStorage(SUBMITTED_STORAGE_KEY)) return;
    const dismissedUntil = Number(safeGetStorage(DISMISS_STORAGE_KEY) ?? 0);
    if (Number.isFinite(dismissedUntil) && dismissedUntil > Date.now()) return;

    const timer = window.setTimeout(() => {
      setSurveyStep("intro");
      setIntroSlideIndex(0);
      setIsOpen(true);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [isPreviewAllowed, loading, localPreviewAllowed, mounted]);

  useEffect(() => {
    if (!isOpen) return;
    void loadStats();
    void loadUsageReview();
  }, [isOpen, loadStats, loadUsageReview]);

  useEffect(() => {
    if (!isOpen || typeof document === "undefined") return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || typeof document === "undefined") return;
    window.requestAnimationFrame(() => {
      document.querySelector(".pre-exam-survey-slide")?.scrollTo({ top: 0 });
      document.querySelector(".pre-exam-survey-form-stage")?.scrollTo({ top: 0 });
    });
  }, [formPageIndex, introSlideIndex, isOpen, surveyStep]);

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      handleDismiss();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  const serializedAnswers = useCallback((): SerializedAnswer[] => {
    return SURVEY_QUESTIONS.map((question) => {
      const value = answers[question.id] ?? null;
      const otherText = otherTexts[question.id]?.trim();
      return {
        questionId: question.id,
        questionTitle: question.title,
        type: question.type,
        value,
        labels: getSelectedLabels(question, value),
        ...(otherText ? { otherText: otherText.slice(0, 220) } : {})
      };
    });
  }, [answers, otherTexts]);

  function openSurveyManually() {
    setSurveyStep("intro");
    setIntroSlideIndex(0);
    setIsOpen(true);
    setSubmitMessage("");
  }

  function startSurvey() {
    setSurveyStep("form");
    setFormPageIndex(0);
    setStartedAt((current) => current ?? Date.now());
    setSubmitMessage("");
  }

  function goToPreviousIntroSlide() {
    setIntroSlideIndex((current) => Math.max(0, current - 1));
  }

  function goToNextIntroSlide() {
    if (introSlideIndex >= INTRO_SLIDE_COUNT - 1) {
      startSurvey();
      return;
    }
    setIntroSlideIndex((current) => Math.min(INTRO_SLIDE_COUNT - 1, current + 1));
  }

  function handleDismiss() {
    safeSetStorage(DISMISS_STORAGE_KEY, String(Date.now() + DISMISS_MS));
    setIsOpen(false);
  }

  function handleSingleChange(question: SingleQuestion, value: string) {
    setAnswers((current) => ({ ...current, [question.id]: value }));
    setErrors((current) => ({ ...current, [question.id]: "" }));
  }

  function handleMultipleChange(question: MultipleQuestion, value: string) {
    const option = question.options.find((item) => item.value === value);
    const existing = Array.isArray(answers[question.id]) ? (answers[question.id] as string[]) : [];
    const nextWithoutExclusive = existing.filter(
      (item) => !question.options.find((candidate) => candidate.value === item)?.exclusive
    );
    const wouldHitLimit =
      !existing.includes(value) &&
      !option?.exclusive &&
      Boolean(question.maxSelections) &&
      nextWithoutExclusive.length >= Number(question.maxSelections);

    if (wouldHitLimit) {
      setErrors((current) => ({ ...current, [question.id]: `最多選 ${question.maxSelections} 個。` }));
      return;
    }

    setAnswers((current) => {
      const currentValue = Array.isArray(current[question.id]) ? (current[question.id] as string[]) : [];
      let next: string[];
      if (currentValue.includes(value)) {
        next = currentValue.filter((item) => item !== value);
      } else if (option?.exclusive) {
        next = [value];
      } else {
        next = currentValue.filter((item) => !question.options.find((candidate) => candidate.value === item)?.exclusive);
        if (!question.maxSelections || next.length < question.maxSelections) {
          next = [...next, value];
        }
      }
      return { ...current, [question.id]: next };
    });
    setErrors((current) => ({ ...current, [question.id]: "" }));
  }

  function validateSurvey() {
    const nextErrors: Record<string, string> = {};
    for (const question of SURVEY_QUESTIONS) {
      const value = answers[question.id];
      const otherText = otherTexts[question.id];
      if (!isAnswered(question, value, otherText)) {
        nextErrors[question.id] = "這題先幫我選一下。";
        continue;
      }
      if (question.type === "multiple" && Array.isArray(value) && question.maxSelections && value.length > question.maxSelections) {
        nextErrors[question.id] = `最多選 ${question.maxSelections} 個。`;
      }
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function validateSection(sectionQuestions: SurveyQuestion[]) {
    const nextErrors: Record<string, string> = {};
    for (const question of sectionQuestions) {
      const value = answers[question.id];
      const otherText = otherTexts[question.id];
      if (!isAnswered(question, value, otherText)) {
        nextErrors[question.id] = question.required ? "這題先幫我選一下。" : "";
        continue;
      }
      if (question.type === "multiple" && Array.isArray(value) && question.maxSelections && value.length > question.maxSelections) {
        nextErrors[question.id] = `最多選 ${question.maxSelections} 個。`;
      }
    }

    const filteredErrors = Object.fromEntries(
      Object.entries(nextErrors).filter(([, message]) => Boolean(message))
    );
    if (Object.keys(filteredErrors).length > 0) {
      setErrors((current) => ({ ...current, ...filteredErrors }));
      setSubmitMessage("這一頁還有題目需要先補一下。");
      return false;
    }

    setErrors((current) => {
      const next = { ...current };
      sectionQuestions.forEach((question) => {
        delete next[question.id];
      });
      return next;
    });
    setSubmitMessage("");
    return true;
  }

  function goToPreviousFormPage() {
    setSubmitMessage("");
    setFormPageIndex((current) => Math.max(0, current - 1));
  }

  function goToNextFormPage() {
    if (!validateSection(currentSectionQuestions)) return;
    if (formPageIndex >= SURVEY_SECTIONS.length - 1) {
      void handleSubmit();
      return;
    }
    setFormPageIndex((current) => Math.min(SURVEY_SECTIONS.length - 1, current + 1));
  }

  async function handleSubmit() {
    if (submitState === "sending") return;
    if (!validateSurvey()) {
      setSubmitMessage("還有幾題需要先補一下。");
      return;
    }

    const payload = {
      surveyId: SURVEY_ID,
      visitorId: getOrCreateVisitorId(),
      accessToken: session?.access_token ?? null,
      answers: serializedAnswers(),
      clientMeta: {
        pagePath: typeof window === "undefined" ? "/" : window.location.pathname,
        userAgent: typeof navigator === "undefined" ? "" : navigator.userAgent.slice(0, 320),
        viewport:
          typeof window === "undefined"
            ? null
            : {
                width: window.innerWidth,
                height: window.innerHeight
              },
        timeToCompleteMs: startedAt ? Date.now() - startedAt : null,
        usageSnapshot: buildUsageSnapshot(usageReview)
      }
    };

    setSubmitState("sending");
    setSubmitMessage("送出中...");
    try {
      const response = await fetch("/api/pre-exam-survey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = (await response.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
      if (!response.ok || data?.ok === false) {
        throw new Error(data?.message ?? "問卷送出失敗");
      }
      safeSetStorage(SUBMITTED_STORAGE_KEY, new Date().toISOString());
      safeRemoveStorage(PENDING_STORAGE_KEY);
      setHasSubmitted(true);
      setSubmitState("sent");
      setSubmitMessage("已送出，謝謝你幫這個網站一起長大。");
    } catch (error) {
      safeSetStorage(PENDING_STORAGE_KEY, JSON.stringify({ ...payload, savedAt: new Date().toISOString() }));
      setSubmitState("saved-local");
      setSubmitMessage(
        error instanceof Error && error.message
          ? `雲端暫時沒收成功，已先存在這台裝置：${error.message}`
          : "雲端暫時沒收成功，已先存在這台裝置。"
      );
    }
  }

  function renderOtherText(question: SingleQuestion | MultipleQuestion) {
    const value = answers[question.id] ?? null;
    const selectedOptions = getSelectedOptions(question, value);
    if (!selectedOptions.some((option) => option.needsText)) return null;
    return (
      <input
        className="pre-exam-survey-other-input"
        value={otherTexts[question.id] ?? ""}
        maxLength={120}
        placeholder="可以簡短補充一下"
        onChange={(event) => {
          setOtherTexts((current) => ({ ...current, [question.id]: event.target.value }));
          setErrors((current) => ({ ...current, [question.id]: "" }));
        }}
      />
    );
  }

  function renderQuestion(question: SurveyQuestion, index: number) {
    const value = answers[question.id];
    const error = errors[question.id];
    return (
      <section key={question.id} className="pre-exam-survey-question">
        <div className="flex items-start gap-3">
          <span className="pre-exam-survey-question-index">{index + 1}</span>
          <div className="min-w-0 flex-1">
            <h3>{question.title}</h3>
            {question.hint ? <p>{question.hint}</p> : null}
          </div>
        </div>

        {question.type === "single" && question.variant === "select" ? (
          <div className="pre-exam-survey-select-block">
            <select
              className="pre-exam-survey-select"
              value={typeof value === "string" ? value : ""}
              onChange={(event) => handleSingleChange(question, event.target.value)}
              aria-label={question.title}
            >
              <option value="" disabled>
                請選擇學校
              </option>
              {question.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {renderOtherText(question)}
          </div>
        ) : null}

        {question.type === "single" && question.variant !== "select" ? (
          <div className="pre-exam-survey-options">
            {question.options.map((option) => {
              const selected = value === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  className="pre-exam-survey-option"
                  aria-pressed={selected}
                  data-selected={selected ? "true" : "false"}
                  onClick={() => handleSingleChange(question, option.value)}
                >
                  <span>{option.label}</span>
                  {option.description ? <small>{option.description}</small> : null}
                </button>
              );
            })}
            {renderOtherText(question)}
          </div>
        ) : null}

        {question.type === "multiple" ? (
          <div className="pre-exam-survey-options">
            {question.options.map((option) => {
              const selected = Array.isArray(value) && value.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  className="pre-exam-survey-option"
                  aria-pressed={selected}
                  data-selected={selected ? "true" : "false"}
                  onClick={() => handleMultipleChange(question, option.value)}
                >
                  <span>{option.label}</span>
                  {option.description ? <small>{option.description}</small> : null}
                </button>
              );
            })}
            {renderOtherText(question)}
          </div>
        ) : null}

        {question.type === "rating" ? (
          <div className="pre-exam-survey-rating">
            {(question.scaleLabels ?? [question.lowLabel, "2", "3", "4", question.highLabel]).map((label, ratingIndex) => {
              const rating = ratingIndex + 1;
              const selected = value === rating;
              return (
                <button
                  key={label}
                  type="button"
                  className="pre-exam-survey-rating-choice"
                  data-selected={selected ? "true" : "false"}
                  aria-pressed={selected}
                  onClick={() => {
                    setAnswers((current) => ({ ...current, [question.id]: rating }));
                    setErrors((current) => ({ ...current, [question.id]: "" }));
                  }}
                >
                  <b>{rating}</b>
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        ) : null}

        {question.type === "text" ? (
          <textarea
            className="pre-exam-survey-textarea"
            value={typeof value === "string" ? value : ""}
            maxLength={question.maxLength}
            placeholder={question.placeholder}
            onChange={(event) => {
              setAnswers((current) => ({ ...current, [question.id]: event.target.value }));
              setErrors((current) => ({ ...current, [question.id]: "" }));
            }}
          />
        ) : null}

        {error ? <div className="pre-exam-survey-error">{error}</div> : null}
      </section>
    );
  }

  function renderIntroSlide() {
    const totalAttempts = usageMetrics?.totalAttempts ?? 0;
    const hasUsageAttempts = totalAttempts > 0;
    const wrongQuestionCount = Number(usageMetrics?.wrongQuestionCount ?? 0);
    const lowConfidenceQuestionCount = Number(usageMetrics?.lowConfidenceQuestionCount ?? 0);
    const mockExamCount = Number(usageMetrics?.mockExamCount ?? 0);
    const savedQuestionCount = Number(usageMetrics?.savedQuestionCount ?? 0);
    const noteCount = Number(usageMetrics?.noteCount ?? 0);
    const reviewableCount = wrongQuestionCount + lowConfidenceQuestionCount + mockExamCount + savedQuestionCount;
    const hasReviewSignals =
      wrongQuestionCount > 0 ||
      lowConfidenceQuestionCount > 0 ||
      mockExamCount > 0 ||
      savedQuestionCount > 0 ||
      noteCount > 0;
    const trendPoints =
      communityPoints.length > 0
        ? communityPoints
        : Array.from({ length: 14 }, (_, index) => ({
            date: `day-${index + 1}`,
            attempts: 0,
            devices: 0,
            correctRate: 0
          }));
    const attemptPolylinePoints = getTrendPolylinePoints(
      trendPoints,
      (point) => Number(point.attempts || 0),
      maxAttempts
    );
    const trendTakeaway = getTrendTakeaway(communityPoints);
    const communityActivePoints = communityPoints.filter((point) => Number(point.attempts || 0) > 0);
    const communityPeakPoint =
      [...communityActivePoints].sort((left, right) => Number(right.attempts || 0) - Number(left.attempts || 0))[0] ??
      null;
    const communityLatestPoint = communityActivePoints[communityActivePoints.length - 1] ?? null;
    const personalTrendPoints =
      usageMetrics?.dailyPoints && usageMetrics.dailyPoints.length > 0
        ? usageMetrics.dailyPoints.slice(-14)
        : Array.from({ length: 14 }, (_, index) => ({
            date: `day-${index + 1}`,
            attempts: 0,
            correctRate: 0
          }));
    const maxPersonalAttempts = Math.max(...personalTrendPoints.map((point) => Number(point.attempts || 0)), 1);
    const personalAttemptPolylinePoints = getTrendPolylinePoints(
      personalTrendPoints,
      (point) => Number(point.attempts || 0),
      maxPersonalAttempts
    );
    const recentPersonalAttempts = sumAttempts(personalTrendPoints);
    const personalRecentRate = getWeightedCorrectRate(personalTrendPoints);
    const personalActivePoints = personalTrendPoints.filter((point) => Number(point.attempts || 0) > 0);
    const personalPeakPoint =
      [...personalActivePoints].sort((left, right) => Number(right.attempts || 0) - Number(left.attempts || 0))[0] ??
      null;
    const personalLatestPoint = personalActivePoints[personalActivePoints.length - 1] ?? null;
    const displayName = usageReview?.userDisplayName;
    const reviewCards = [
      wrongQuestionCount > 0
        ? {
            title: "答錯過的題",
            value: `${wrongQuestionCount.toLocaleString("zh-TW")} 題`,
            text: "最適合最後回頭確認，因為你曾經真的被它卡住。"
          }
        : null,
      lowConfidenceQuestionCount > 0
        ? {
            title: "低信心題",
            value: `${lowConfidenceQuestionCount.toLocaleString("zh-TW")} 題`,
            text: "有些題目就算答對，心裡其實還是不穩，值得再看一次。"
          }
        : null,
      mockExamCount > 0
        ? {
            title: "模擬考紀錄",
            value: `${mockExamCount.toLocaleString("zh-TW")} 回`,
            text: "可以回顧整份考卷的節奏，而不是只看單題。"
          }
        : null,
      savedQuestionCount > 0
        ? {
            title: "收藏題目",
            value: `${savedQuestionCount.toLocaleString("zh-TW")} 題`,
            text: "你自己標起來的題目，通常最知道為什麼重要。"
          }
        : null
    ].filter((card): card is { title: string; value: string; text: string } => Boolean(card));

    const isCommunityHighlight = (point: CommunityPoint) =>
      Boolean(
        hasCommunityStats &&
          (point.date === communityPeakPoint?.date || point.date === communityLatestPoint?.date)
      );
    const isPersonalHighlight = (point: UsageDailyPoint) =>
      Boolean(hasUsageAttempts && (point.date === personalPeakPoint?.date || point.date === personalLatestPoint?.date));

    if (introSlideIndex === 0) {
      return (
        <section key="global" className="pre-exam-survey-slide pre-exam-survey-slide-hero">
          <div className="pre-exam-survey-slide-copy">
            <span>01 / 大家的衝刺近況</span>
            <h3>這兩週，大家都還在往前刷。</h3>
            <p>考前最後一段路，你不是一個人在準備。</p>
          </div>

          <div className="pre-exam-survey-trend-card">
            <div className="pre-exam-survey-trend-header">
              <div>
                <span>近 14 天，全站一起完成</span>
                <strong>
                  {(statsLoading || !hasCommunityStats) && statsSummary.attempts === 0
                    ? "資料整理中"
                    : `${statsSummary.attempts.toLocaleString("zh-TW")} 題`}
                </strong>
              </div>
              <p>{trendTakeaway}</p>
            </div>

            <div className="pre-exam-survey-trend-visual" aria-label="最近十四天全站刷題趨勢圖">
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                <polyline className="pre-exam-survey-trend-attempts" points={attemptPolylinePoints} />
              </svg>
              <div className="pre-exam-survey-trend-bars" aria-hidden="true">
                {trendPoints.map((point, index) => {
                  const highlighted = isCommunityHighlight(point);
                  return (
                    <span
                      key={`${point.date}-${index}`}
                      data-highlight={highlighted ? "true" : "false"}
                      style={
                        {
                          "--survey-bar-height": `${Math.max(7, Math.round((Number(point.attempts || 0) / maxAttempts) * 100))}%`
                        } as CSSProperties
                      }
                    >
                      {highlighted ? (
                        <b>
                          <span className="pre-exam-survey-bar-label-full">
                            {formatBarCountLabel(Number(point.attempts || 0))}
                          </span>
                          <span className="pre-exam-survey-bar-label-compact">
                            {formatCompactBarCountLabel(Number(point.attempts || 0))}
                          </span>
                        </b>
                      ) : null}
                      <i>{highlighted ? formatDateLabel(point.date) : ""}</i>
                    </span>
                  );
                })}
              </div>
            </div>

            <div className="pre-exam-survey-mini-stats">
              <span>
                <b>{communityActiveUsers == null ? "—" : communityActiveUsers.toLocaleString("zh-TW")}</b>
                位同學有回來刷題
              </span>
              <span>
                <b>{hasCommunityStats ? statsSummary.peakAttempts.toLocaleString("zh-TW") : "—"}</b>
                最高單日題數
              </span>
              <span>
                <b>{communityLatestPoint ? Number(communityLatestPoint.attempts || 0).toLocaleString("zh-TW") : "—"}</b>
                最近一天題數
              </span>
            </div>
            <p className="pre-exam-survey-gentle-note">
              這不是排名，只是想讓你知道：這段時間還有很多人跟你一樣在撐。
            </p>
          </div>
        </section>
      );
    }

    if (introSlideIndex === 1) {
      return (
        <section key="personal" className="pre-exam-survey-slide pre-exam-survey-slide-personal">
          <div className="pre-exam-survey-slide-copy">
            <span>02 / 你的刷題足跡</span>
            <h3>
              {usageReviewLoading
                ? "正在整理你的刷題足跡"
                : usageReview?.hasEnoughData
                  ? "這是你這段時間留下的刷題足跡。"
                  : "先用一份小回顧開始"}
            </h3>
            <p>
              {usageReview?.hasEnoughData
                ? `${displayName ? `${displayName}，` : ""}你不是只有打開一下而已，這些都是你真的碰過的題目。`
                : usageReview?.loggedIn
                  ? "目前抓到的紀錄還不多，所以先顯示輕量版回顧。新使用者的感受同樣重要。"
                  : "目前抓不到完整跨裝置紀錄，先用這台裝置與全站狀態做簡短回顧。"}
            </p>
          </div>

          <div className="pre-exam-survey-trend-card pre-exam-survey-personal-trend">
            <div className="pre-exam-survey-trend-header">
              <div>
                <span>你的近 14 天作答</span>
                <strong>{hasUsageAttempts ? `${recentPersonalAttempts.toLocaleString("zh-TW")} 題` : "正在累積"}</strong>
              </div>
              <p>{hasUsageAttempts ? "有些題目你答過一次，有些題目你回來看了很多次。這些都算數。" : "等紀錄多一點，這裡會顯示你自己的作答趨勢。"}</p>
            </div>

            <div className="pre-exam-survey-trend-visual" aria-label="你的近十四天作答趨勢圖">
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                <polyline className="pre-exam-survey-trend-attempts" points={personalAttemptPolylinePoints} />
              </svg>
              <div className="pre-exam-survey-trend-bars" aria-hidden="true">
                {personalTrendPoints.map((point, index) => {
                  const highlighted = isPersonalHighlight(point);
                  return (
                    <span
                      key={`${point.date}-${index}`}
                      data-highlight={highlighted ? "true" : "false"}
                      style={
                        {
                          "--survey-bar-height": `${Math.max(7, Math.round((Number(point.attempts || 0) / maxPersonalAttempts) * 100))}%`
                        } as CSSProperties
                      }
                    >
                      {highlighted ? (
                        <b>
                          <span className="pre-exam-survey-bar-label-full">
                            {formatBarCountLabel(Number(point.attempts || 0))}
                          </span>
                          <span className="pre-exam-survey-bar-label-compact">
                            {formatCompactBarCountLabel(Number(point.attempts || 0))}
                          </span>
                        </b>
                      ) : null}
                      <i>{highlighted ? formatDateLabel(point.date) : ""}</i>
                    </span>
                  );
                })}
              </div>
            </div>

            <div className="pre-exam-survey-mini-stats">
              <span>
                <b>{hasUsageAttempts ? totalAttempts.toLocaleString("zh-TW") : "—"}</b>
                總作答
              </span>
              <span>
                <b>{hasUsageAttempts ? (usageMetrics?.uniqueQuestionsAnswered ?? 0).toLocaleString("zh-TW") : "—"}</b>
                碰過的題目
              </span>
              <span>
                <b>{hasUsageAttempts ? `${(usageMetrics?.activeDays ?? 0).toLocaleString("zh-TW")} 天` : "—"}</b>
                回來刷題
              </span>
              <span>
                <b>{personalRecentRate == null ? "—" : `${personalRecentRate}%`}</b>
                近14天答對率
              </span>
            </div>
          </div>
        </section>
      );
    }

    if (introSlideIndex === 2) {
      return (
        <section key="signals" className="pre-exam-survey-slide pre-exam-survey-slide-signals">
          <div className="pre-exam-survey-slide-copy">
            <span>03 / 考前可以再撿回來的題</span>
            <h3>這些不是壓力，是最後可以回頭看的線索。</h3>
            <p>錯題、低信心、模擬考紀錄，都是考前最值得被整理的地方。</p>
          </div>

          <div className="pre-exam-survey-review-board">
            <div className="pre-exam-survey-review-board-header">
              <div>
                <span>目前留下的複習線索</span>
                <strong>{hasReviewSignals ? `${reviewableCount.toLocaleString("zh-TW")} 個` : "正在累積"}</strong>
              </div>
              <p>{hasReviewSignals ? "最後幾天不用全部重來，先把最有機會補起來的地方抓回來。" : "目前留下的複習線索還不多，沒關係，這份問卷照現在感覺填就好。"}</p>
            </div>

            <div className="pre-exam-survey-review-deck pre-exam-survey-review-deck-grid">
              {reviewCards.length > 0 ? (
                reviewCards.map((card) => (
                  <article key={card.title} className="pre-exam-survey-review-card">
                    <span>{card.title}</span>
                    <h4>{card.value}</h4>
                    <p>{card.text}</p>
                  </article>
                ))
              ) : (
                <article className="pre-exam-survey-review-card pre-exam-survey-review-card-hero">
                  <span>剛開始也沒關係</span>
                  <h4>線索會慢慢留下來</h4>
                  <p>等你多做幾回，錯題、低信心題、收藏題目和模擬考紀錄會在這裡整理成考前清單。</p>
                </article>
              )}
            </div>
            {noteCount > 0 ? <p className="pre-exam-survey-gentle-note">另外還有 {noteCount.toLocaleString("zh-TW")} 則筆記，之後也會一起成為你的考前索引。</p> : null}
          </div>
        </section>
      );
    }

    return (
      <section key="next" className="pre-exam-survey-slide pre-exam-survey-slide-final">
        <div className="pre-exam-survey-slide-copy pre-exam-survey-slide-copy-center">
          <span>04 / 為什麼想問你</span>
          <h3>最後，想請你幫我們判斷一件事。</h3>
          <p>
            現在已經有很多刷題網站了。我們想知道，這個網站到底有沒有提供其他地方沒有的價值。
          </p>
        </div>

        <div className="pre-exam-survey-reflection">
          <div className="pre-exam-survey-reflection-line" aria-hidden="true" />
          <div className="pre-exam-survey-reflection-item">
            <span>01</span>
            <div>
              <h4>哪些功能真的有幫你</h4>
              <p>不是看起來很酷，而是考前真的會打開來用。</p>
            </div>
          </div>
          <div className="pre-exam-survey-reflection-item">
            <span>02</span>
            <div>
              <h4>哪些地方一定要穩住</h4>
              <p>例如作答紀錄、錯題庫、同步、詳解和手機版。</p>
            </div>
          </div>
          <div className="pre-exam-survey-reflection-item">
            <span>03</span>
            <div>
              <h4>值不值得推薦給下一屆</h4>
              <p>如果你願意推薦，代表這個網站真的有留下來的理由。</p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (!mounted || loading || (!isPreviewAllowed && !localPreviewAllowed)) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        className="pre-exam-survey-trigger"
        onClick={openSurveyManually}
        aria-label="打開考前快速問卷"
      >
        <span className="pre-exam-survey-trigger-mark" aria-hidden="true">
          問
        </span>
        <span className="hidden sm:inline">{hasSubmitted ? "已填問卷" : "考前問卷"}</span>
      </button>

      {isOpen && typeof document !== "undefined" ? createPortal(
        <div className="pre-exam-survey-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) handleDismiss();
        }}>
          <div className="pre-exam-survey-dialog" role="dialog" aria-modal="true" aria-labelledby="pre-exam-survey-title">
            <header className="pre-exam-survey-header">
              <div>
                <p className="eyebrow text-[10px]">Pre-exam Check-in</p>
                <h2 id="pre-exam-survey-title">考前衝刺快速問卷</h2>
                <p>先看一段全站與自己的小回顧，再用幾題告訴我你現在最常怎麼使用這個網站。</p>
              </div>
              <button type="button" className="pre-exam-survey-close" onClick={handleDismiss} aria-label="關閉問卷">
                ×
              </button>
            </header>
            <div className="pre-exam-survey-progress" aria-hidden="true">
              <span style={{ "--survey-progress": `${surveyProgressPercent}%` } as CSSProperties} />
            </div>

            <div className={surveyStep === "intro" ? "pre-exam-survey-body pre-exam-survey-body-intro" : "pre-exam-survey-body"}>
              {surveyStep === "intro" ? (
                <main className="pre-exam-survey-intro" aria-live="polite">
                  {renderIntroSlide()}
                  <nav className="pre-exam-survey-slide-controls" aria-label="回顧投影片導覽">
                    <button
                      type="button"
                      className="pre-exam-survey-secondary"
                      onClick={goToPreviousIntroSlide}
                      disabled={introSlideIndex === 0}
                    >
                      上一頁
                    </button>
                    <div className="pre-exam-survey-slide-dots" aria-hidden="true">
                      {Array.from({ length: INTRO_SLIDE_COUNT }, (_, index) => (
                        <span key={index} data-active={index === introSlideIndex ? "true" : "false"} />
                      ))}
                    </div>
                    <div className="pre-exam-survey-slide-actions">
                      <button type="button" className="pre-exam-survey-secondary" onClick={handleDismiss}>
                        晚點再說
                      </button>
                      <button type="button" className="pre-exam-survey-submit" onClick={goToNextIntroSlide}>
                        {introSlideIndex === INTRO_SLIDE_COUNT - 1 ? "開始問卷" : "下一頁"}
                      </button>
                    </div>
                  </nav>
                </main>
              ) : (
              <main className="pre-exam-survey-form">
                {submitState === "sent" ? (
                  <div className="pre-exam-survey-success">
                    <span aria-hidden="true">完成</span>
                    <h3>收到，謝謝你。</h3>
                    <p>這份回饋會放進考前維護清單。接下來先讓你回去刷題，網站的事我繼續顧。</p>
                    <button type="button" className="pre-exam-survey-submit" onClick={() => setIsOpen(false)}>
                      回到首頁
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="pre-exam-survey-form-stage">
                      <div className="pre-exam-survey-form-kicker">
                        <span>{currentSection.eyebrow}</span>
                        <b>{currentSectionQuestions.some((question) => question.required) ? "有必填題" : "選填"}</b>
                      </div>
                      <div className="pre-exam-survey-section-heading">
                        <h3>{currentSection.title}</h3>
                        <p>{currentSection.description}</p>
                      </div>
                      <div className="pre-exam-survey-question-stack">
                        {currentSectionQuestions.map((question, index) => renderQuestion(question, index))}
                      </div>
                    </div>
                    <div className="pre-exam-survey-footer">
                      <div>
                        <strong>{formPageIndex >= SURVEY_SECTIONS.length - 1 ? "最後一頁" : "照現在的感覺選就好"}</strong>
                        <span>
                          {formPageIndex >= SURVEY_SECTIONS.length - 1
                            ? "這題選填，但寫得越具體，越能直接進到考前修正清單。"
                            : completedRequiredCount === requiredQuestions.length
                            ? "必填題都完成了，可以送出。"
                            : `這頁有 ${currentSectionQuestions.length} 題，選最接近你現在使用狀態的答案。`}
                        </span>
                        {submitMessage ? <p>{submitMessage}</p> : null}
                      </div>
                      <div className="pre-exam-survey-form-actions">
                        <button
                          type="button"
                          className="pre-exam-survey-secondary"
                          onClick={goToPreviousFormPage}
                          disabled={formPageIndex === 0 || submitState === "sending"}
                        >
                          上一頁
                        </button>
                        <button
                          type="button"
                          className="pre-exam-survey-submit"
                          data-state={submitState}
                          disabled={submitState === "sending"}
                          onClick={goToNextFormPage}
                        >
                          {submitState === "sending"
                            ? "送出中"
                            : formPageIndex >= SURVEY_SECTIONS.length - 1
                              ? submitState === "saved-local"
                                ? "再送一次"
                                : "送出問卷"
                              : "下一頁"}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </main>
              )}
            </div>
          </div>
        </div>
      , document.body) : null}
    </>
  );
}
