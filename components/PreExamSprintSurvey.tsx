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
const INTRO_SLIDE_COUNT = 5;

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
    id: "primary_environment",
    type: "single",
    title: "你最常在哪個環境使用？",
    hint: "這題會幫我排 Safari、手機和平板的修正優先順序。",
    required: true,
    options: [
      { value: "phone_safari", label: "手機 Safari" },
      { value: "phone_chrome", label: "手機 Chrome" },
      { value: "ipad_safari", label: "iPad Safari" },
      { value: "desktop_chrome", label: "電腦 Chrome" },
      { value: "desktop_safari", label: "電腦 Safari" },
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
      { value: "random_quiz", label: "散題刷題" },
      { value: "simulation", label: "模擬考 / 考古卷" },
      { value: "review", label: "錯題複習" },
      { value: "yangming_explanations", label: "陽明詳解" },
      { value: "formatted_ai_explanations", label: "排版過的 AI 詳解" },
      { value: "ai_weakness_prompt", label: "複製給 AI 的補弱 Prompt" },
      { value: "peer_supplements", label: "同學補充 / 同學筆記" },
      { value: "personal_notes", label: "自己的學習筆記" },
      { value: "search", label: "題目搜尋" },
      { value: "confidence", label: "信心度總覽" },
      { value: "saved_questions", label: "儲存題目" },
      { value: "pharmacology", label: "藥名卡 / 藥理複習" },
      { value: "custom_papers", label: "自訂卷模式" },
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
      { value: "readable_ai", label: "AI 詳解被排版整理後比較像能讀的講義" },
      { value: "review_loop", label: "錯題、沒信心題、儲存題目會被帶回來複習" },
      { value: "exam_feedback", label: "模擬考後能看到信心度和補弱方向" },
      { value: "pharmacology_cards", label: "藥名卡把藥理變成可以滑的複習" },
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
    scaleLabels: ["幾乎沒影響", "有點不方便", "會影響安排", "會很困擾", "考前會慌"]
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
    title: "最後，如果只能留一句話給版主，你會希望我先改什麼？",
    placeholder: "例如：某頁很卡、某功能最有用、某種題目很需要補強...",
    maxLength: 420
  }
];

const TOTAL_SLIDE_COUNT = INTRO_SLIDE_COUNT + SURVEY_QUESTIONS.length;

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

function getOptimisticActivityPercentile(
  totalAttempts: number,
  recentAttempts: number,
  averageActiveAttempts: number | null
) {
  if (totalAttempts <= 0 && recentAttempts <= 0) return null;

  let percentile = 45;
  if (totalAttempts >= 1500) percentile = 91;
  else if (totalAttempts >= 1000) percentile = 88;
  else if (totalAttempts >= 600) percentile = 82;
  else if (totalAttempts >= 300) percentile = 72;
  else if (totalAttempts >= 120) percentile = 62;
  else if (totalAttempts >= 30) percentile = 52;

  if (averageActiveAttempts && averageActiveAttempts > 0) {
    const multiplier = recentAttempts / averageActiveAttempts;
    if (multiplier >= 3) percentile = Math.max(percentile, 94);
    else if (multiplier >= 2) percentile = Math.max(percentile, 89);
    else if (multiplier >= 1.25) percentile = Math.max(percentile, 78);
    else if (multiplier >= 0.75) percentile = Math.max(percentile, 66);
  }

  return Math.min(97, percentile);
}

function formatMultiplier(value: number | null) {
  if (!value || !Number.isFinite(value)) return null;
  return `${value.toFixed(value >= 10 ? 0 : 1).replace(/\.0$/, "")} 倍`;
}

function getPersonalTrendTakeaway(options: {
  totalAttempts: number;
  recentAttempts: number;
  activeDays: number;
  averageActiveAttempts: number | null;
  optimisticPercentile: number | null;
  recentCorrectRate: number | null;
}) {
  const { totalAttempts, recentAttempts, activeDays, averageActiveAttempts, optimisticPercentile, recentCorrectRate } =
    options;
  const multiplier =
    averageActiveAttempts && averageActiveAttempts > 0 ? recentAttempts / averageActiveAttempts : null;
  const multiplierText = formatMultiplier(multiplier);
  const percentileText = optimisticPercentile ? `高於約 ${optimisticPercentile}% 的活躍同學` : "已經很有份量";

  if (totalAttempts >= 1000) {
    return `這已經不是「有打開一下」的程度了；你累積的是扎實題量，樂觀估計${percentileText}。`;
  }

  if (recentCorrectRate != null && recentCorrectRate >= 75 && recentAttempts >= 30) {
    return `近兩週答對率有 ${recentCorrectRate}%，而且不是只做幾題，這種穩定度很值得留下來。`;
  }

  if (recentAttempts > 0 && multiplierText) {
    return `近兩週約是平均活躍同學的 ${multiplierText}，這段衝刺不是感覺而已，有被紀錄下來。`;
  }

  if (activeDays >= 10) {
    return `你有 ${activeDays} 天回來作答，能一再回來接上題目，本身就是很難得的穩定。`;
  }

  return "現在最重要的是讓下一次回來作答更順，紀錄會慢慢累積成你的個人節奏。";
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

function formatHourLabel(hour?: number | null) {
  if (typeof hour !== "number" || !Number.isFinite(hour)) return "還沒有明顯時段";
  const next = (hour + 1) % 24;
  return `${String(hour).padStart(2, "0")}:00-${String(next).padStart(2, "0")}:00`;
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
  const [formQuestionIndex, setFormQuestionIndex] = useState(0);
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
  const usagePersona = useMemo(() => getPersona(usageMetrics), [usageMetrics]);
  const maxAttempts = Math.max(...communityPoints.map((point) => Number(point.attempts || 0)), 1);
  const hasCommunityStats = communityPoints.some((point) => Number(point.attempts || 0) > 0);
  const currentQuestion = SURVEY_QUESTIONS[formQuestionIndex] ?? SURVEY_QUESTIONS[0];
  const currentSlideNumber =
    surveyStep === "intro" ? introSlideIndex + 1 : INTRO_SLIDE_COUNT + formQuestionIndex + 1;
  const surveyProgressPercent =
    surveyStep === "intro"
      ? ((introSlideIndex + 1) / TOTAL_SLIDE_COUNT) * 100
      : ((INTRO_SLIDE_COUNT + formQuestionIndex + 1) / TOTAL_SLIDE_COUNT) * 100;

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
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (loading || !isPreviewAllowed) return;
    if (safeGetStorage(SUBMITTED_STORAGE_KEY)) return;
    const dismissedUntil = Number(safeGetStorage(DISMISS_STORAGE_KEY) ?? 0);
    if (Number.isFinite(dismissedUntil) && dismissedUntil > Date.now()) return;

    const timer = window.setTimeout(() => {
      setSurveyStep("intro");
      setIntroSlideIndex(0);
      setIsOpen(true);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [isPreviewAllowed, loading, mounted]);

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
    setFormQuestionIndex(0);
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

  function validateQuestion(question: SurveyQuestion) {
    const value = answers[question.id];
    const otherText = otherTexts[question.id];
    if (!isAnswered(question, value, otherText)) {
      setErrors((current) => ({ ...current, [question.id]: "這題先幫我選一下。" }));
      setSubmitMessage("這題先補一下再往下。");
      return false;
    }
    if (question.type === "multiple" && Array.isArray(value) && question.maxSelections && value.length > question.maxSelections) {
      setErrors((current) => ({ ...current, [question.id]: `最多選 ${question.maxSelections} 個。` }));
      setSubmitMessage(`這題最多選 ${question.maxSelections} 個。`);
      return false;
    }
    setErrors((current) => ({ ...current, [question.id]: "" }));
    setSubmitMessage("");
    return true;
  }

  function goToPreviousFormQuestion() {
    setSubmitMessage("");
    setFormQuestionIndex((current) => Math.max(0, current - 1));
  }

  function goToNextFormQuestion() {
    if (!validateQuestion(currentQuestion)) return;
    if (formQuestionIndex >= SURVEY_QUESTIONS.length - 1) {
      void handleSubmit();
      return;
    }
    setFormQuestionIndex((current) => Math.min(SURVEY_QUESTIONS.length - 1, current + 1));
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
            <div className="pre-exam-survey-rating-topline">
              <span>{question.lowLabel}</span>
              <strong>
                {typeof value === "number"
                  ? `${value}：${question.scaleLabels?.[value - 1] ?? ""}`
                  : "請拖曳選擇"}
              </strong>
              <span>{question.highLabel}</span>
            </div>
            <div
              className="pre-exam-survey-slider-wrap"
              style={
                {
                  "--survey-slider-progress": `${(((typeof value === "number" ? value : 3) - 1) / 4) * 100}%`
                } as CSSProperties
              }
            >
              <input
                type="range"
                min="1"
                max="5"
                step="1"
                value={typeof value === "number" ? value : 3}
                aria-label={question.title}
                onChange={(event) => {
                  setAnswers((current) => ({ ...current, [question.id]: Number(event.target.value) }));
                  setErrors((current) => ({ ...current, [question.id]: "" }));
                }}
              />
              <div className="pre-exam-survey-slider-scale" aria-hidden="true">
                {[1, 2, 3, 4, 5].map((rating) => (
                  <span key={rating}>{rating}</span>
                ))}
              </div>
            </div>
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
    const fullLengthSessionCount = Number(usageMetrics?.fullLengthSessionCount ?? 0);
    const savedQuestionCount = Number(usageMetrics?.savedQuestionCount ?? 0);
    const noteCount = Number(usageMetrics?.noteCount ?? 0);
    const reviewSignalCount = wrongQuestionCount + lowConfidenceQuestionCount;
    const reviewHeadline =
      reviewSignalCount > 0
        ? `${reviewSignalCount.toLocaleString("zh-TW")} 個線索`
        : fullLengthSessionCount > 0
          ? `${fullLengthSessionCount.toLocaleString("zh-TW")} 回完整紀錄`
          : mockExamCount > 0
            ? `${mockExamCount.toLocaleString("zh-TW")} 回模擬考`
            : savedQuestionCount + noteCount > 0
              ? `${(savedQuestionCount + noteCount).toLocaleString("zh-TW")} 個自留項目`
              : "正在累積";
    const hasReviewSignals =
      wrongQuestionCount > 0 ||
      lowConfidenceQuestionCount > 0 ||
      mockExamCount > 0 ||
      fullLengthSessionCount > 0 ||
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
    const ratePolylinePoints = getTrendPolylinePoints(
      trendPoints,
      (point) => Number(point.correctRate || 0),
      100
    );
    const trendTakeaway = getTrendTakeaway(communityPoints);
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
    const personalRatePolylinePoints = getTrendPolylinePoints(
      personalTrendPoints,
      (point) => Number(point.correctRate || 0),
      100
    );
    const recentPersonalAttempts = sumAttempts(personalTrendPoints);
    const averageActiveAttempts =
      communityActiveUsers && communityActiveUsers > 0 && statsSummary.attempts > 0
        ? statsSummary.attempts / communityActiveUsers
        : null;
    const optimisticPercentile = getOptimisticActivityPercentile(
      totalAttempts,
      recentPersonalAttempts,
      averageActiveAttempts
    );
    const personalRecentRate = getWeightedCorrectRate(personalTrendPoints);
    const personalTrendTakeaway = getPersonalTrendTakeaway({
      totalAttempts,
      recentAttempts: recentPersonalAttempts,
      activeDays: usageMetrics?.activeDays ?? 0,
      averageActiveAttempts,
      optimisticPercentile,
      recentCorrectRate: personalRecentRate
    });
    const averageActiveAttemptsText = averageActiveAttempts
      ? Math.round(averageActiveAttempts).toLocaleString("zh-TW")
      : "—";
    const averageActiveAttemptsClause = averageActiveAttempts
      ? `；全站活躍同學近兩週平均約 ${averageActiveAttemptsText} 題`
      : "";

    if (introSlideIndex === 0) {
      return (
        <section key="global" className="pre-exam-survey-slide pre-exam-survey-slide-hero">
          <div className="pre-exam-survey-slide-copy">
            <span>01 / 全站回顧</span>
            <h3>最近兩週，大家一起把題目往前推。</h3>
            <p>先看整體刷題節奏，再進到你的個人回顧。</p>
          </div>

          <div className="pre-exam-survey-trend-card">
            <div className="pre-exam-survey-trend-header">
              <div>
                <span>最近 14 天</span>
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
                <polyline className="pre-exam-survey-trend-rate" points={ratePolylinePoints} />
                <polyline className="pre-exam-survey-trend-attempts" points={attemptPolylinePoints} />
              </svg>
              <div className="pre-exam-survey-trend-bars" aria-hidden="true">
                {trendPoints.map((point, index) => (
                  <span
                    key={`${point.date}-${index}`}
                    style={
                      {
                        "--survey-bar-height": `${Math.max(7, Math.round((Number(point.attempts || 0) / maxAttempts) * 100))}%`
                      } as CSSProperties
                    }
                  >
                    <b>
                      <span className="pre-exam-survey-bar-label-full">
                        {hasCommunityStats ? formatBarCountLabel(Number(point.attempts || 0)) : "—"}
                      </span>
                      <span className="pre-exam-survey-bar-label-compact">
                        {hasCommunityStats ? formatCompactBarCountLabel(Number(point.attempts || 0)) : "—"}
                      </span>
                    </b>
                    <i>
                      {hasCommunityStats && (index === 0 || index === trendPoints.length - 1 || index % 4 === 3)
                        ? formatDateLabel(point.date)
                        : ""}
                    </i>
                  </span>
                ))}
              </div>
            </div>

            <div className="pre-exam-survey-trend-legend">
              <span data-tone="volume">作答量</span>
              <span data-tone="rate">答對率</span>
              <span>近兩週</span>
            </div>

            <div className="pre-exam-survey-mini-stats">
              <span>
                <b>{hasCommunityStats ? statsSummary.participantDays.toLocaleString("zh-TW") : "—"}</b>
                參與同學人次
              </span>
              <span>
                <b>{communityActiveUsers == null ? "—" : communityActiveUsers.toLocaleString("zh-TW")}</b>
                近14天上線活躍人數
              </span>
              <span>
                <b>{hasCommunityStats ? statsSummary.peakAttempts.toLocaleString("zh-TW") : "—"}</b>
                單日最高題數
              </span>
              <span>
                <b>{statsSummary.correctRate == null ? "—" : `${statsSummary.correctRate}%`}</b>
                平均答對率
              </span>
            </div>
          </div>
        </section>
      );
    }

    if (introSlideIndex === 1) {
      return (
        <section key="personal" className="pre-exam-survey-slide">
          <div className="pre-exam-survey-slide-copy">
            <span>02 / 你的備戰小回顧</span>
            <h3>
              {usageReviewLoading
                ? "正在整理你的刷題足跡"
                : usageReview?.hasEnoughData
                  ? `${usageReview.userDisplayName ? `${usageReview.userDisplayName} 的` : "你的"}作答累積`
                  : "先用一份小回顧開始"}
            </h3>
            <p>
              {usageReview?.hasEnoughData
                ? personalTrendTakeaway
                : usageReview?.loggedIn
                  ? "目前抓到的紀錄還不多，所以先顯示輕量版回顧。新使用者的感受同樣重要。"
                  : "目前抓不到完整跨裝置紀錄，先用這台裝置與全站狀態做簡短回顧。"}
            </p>
          </div>

          <div className="pre-exam-survey-trend-card pre-exam-survey-personal-trend">
            <div className="pre-exam-survey-trend-header">
              <div>
                <span>你的近 14 天</span>
                <strong>{hasUsageAttempts ? `${recentPersonalAttempts.toLocaleString("zh-TW")} 題` : "正在累積"}</strong>
              </div>
              <p>
                {hasUsageAttempts && optimisticPercentile
                  ? `樂觀估計高於約 ${optimisticPercentile}% 的活躍同學${averageActiveAttemptsClause}。`
                  : "等紀錄多一點，這裡會顯示你自己的作答趨勢。"}
              </p>
            </div>

            <div className="pre-exam-survey-trend-visual" aria-label="你的近十四天作答趨勢圖">
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                <polyline className="pre-exam-survey-trend-rate" points={personalRatePolylinePoints} />
                <polyline className="pre-exam-survey-trend-attempts" points={personalAttemptPolylinePoints} />
              </svg>
              <div className="pre-exam-survey-trend-bars" aria-hidden="true">
                {personalTrendPoints.map((point, index) => (
                  <span
                    key={`${point.date}-${index}`}
                    style={
                      {
                        "--survey-bar-height": `${Math.max(7, Math.round((Number(point.attempts || 0) / maxPersonalAttempts) * 100))}%`
                      } as CSSProperties
                    }
                  >
                    <b>
                      <span className="pre-exam-survey-bar-label-full">
                        {hasUsageAttempts ? formatBarCountLabel(Number(point.attempts || 0)) : "—"}
                      </span>
                      <span className="pre-exam-survey-bar-label-compact">
                        {hasUsageAttempts ? formatCompactBarCountLabel(Number(point.attempts || 0)) : "—"}
                      </span>
                    </b>
                    <i>
                      {hasUsageAttempts && (index === 0 || index === personalTrendPoints.length - 1 || index % 4 === 3)
                        ? formatDateLabel(point.date)
                        : ""}
                    </i>
                  </span>
                ))}
              </div>
            </div>

            <div className="pre-exam-survey-mini-stats">
              <span>
                <b>{hasUsageAttempts ? totalAttempts.toLocaleString("zh-TW") : "—"}</b>
                總作答次數
              </span>
              <span>
                <b>{hasUsageAttempts ? (usageMetrics?.uniqueQuestionsAnswered ?? 0).toLocaleString("zh-TW") : "—"}</b>
                不同題目
              </span>
              <span>
                <b>{personalRecentRate == null ? "—" : `${personalRecentRate}%`}</b>
                近14天答對率
              </span>
              <span>
                <b>{optimisticPercentile ? `高於 ${optimisticPercentile}%` : "—"}</b>
                樂觀位置
              </span>
            </div>
          </div>
        </section>
      );
    }

    if (introSlideIndex === 2) {
      return (
        <section key="track" className="pre-exam-survey-slide">
          <div className="pre-exam-survey-slide-copy">
            <span>03 / 題目軌跡</span>
            <h3>你刷題時留下的節奏。</h3>
            <p>這不是成績單，只是把做題、看詳解、回來複習的路徑整理成一張簡短的圖像。</p>
          </div>

          <div className="pre-exam-survey-slide-grid">
            <div className="pre-exam-survey-slide-panel">
              <span>總作答</span>
              <h4>
                {hasUsageAttempts
                  ? totalAttempts.toLocaleString("zh-TW")
                  : "還在累積"}
              </h4>
              <p>
                包含重做與複習。這個數字比較接近你真正投入過的題量，不會再跟「不同題目數」混在一起。
              </p>
            </div>
            <div className="pre-exam-survey-slide-panel">
              <span>不同題目</span>
              <h4>{hasUsageAttempts ? (usageMetrics?.uniqueQuestionsAnswered ?? 0).toLocaleString("zh-TW") : "—"}</h4>
              <p>
                代表你實際碰過的題目範圍。這會慢慢長成你的個人複習地圖，也比單純天數更直觀。
              </p>
            </div>
            <div className="pre-exam-survey-slide-panel">
              <span>回來作答</span>
              <h4>{hasUsageAttempts ? `${(usageMetrics?.activeDays ?? 0).toLocaleString("zh-TW")} 天` : "—"}</h4>
              <p>
                {usageMetrics?.mostPracticedSubject
                  ? `最常練的是 ${usageMetrics.mostPracticedSubject}；常出沒時段大約是 ${formatHourLabel(usageMetrics.mostActiveHour)}。`
                  : "不用每天很多，重點是你有一次次回來把題目接上。"}
              </p>
            </div>
          </div>
        </section>
      );
    }

    if (introSlideIndex === 3) {
      return (
        <section key="signals" className="pre-exam-survey-slide">
          <div className="pre-exam-survey-slide-copy">
            <span>04 / 可回頭複習</span>
            <h3>這些不是壓力，是考前可以再拿回來的分數。</h3>
            <p>網站已經把你做錯、沒把握、整回合作答的地方留下來；接下來要優先修哪裡，就靠這些線索。</p>
          </div>

          <div className="pre-exam-survey-review-board">
            <div className="pre-exam-survey-review-board-header">
              <div>
                <span>目前可用的複習材料</span>
                <strong>{hasReviewSignals ? reviewHeadline : "正在累積"}</strong>
              </div>
              <p>
                {hasReviewSignals
                  ? "如果今天只剩一小段時間，先看錯題，再看低信心題，最後回顧整回合。"
                  : "等你多做幾回，這裡會整理錯題、低信心題和完整測驗紀錄。"}
              </p>
            </div>

            <div className="pre-exam-survey-review-deck pre-exam-survey-review-deck-grid">
              <article className="pre-exam-survey-review-card">
                <span>先拿回分數</span>
                <h4>{wrongQuestionCount > 0 ? `${wrongQuestionCount.toLocaleString("zh-TW")} 題曾答錯` : "錯題正在累積"}</h4>
                <p>
                  {wrongQuestionCount > 0
                    ? "這些題目最適合先訂正，因為每一題都曾經真的扣過分，回頭看通常最有感。"
                    : "等有錯題後，這裡會幫你把最值得先訂正的題目集中起來。"}
                </p>
              </article>

              <article className="pre-exam-survey-review-card">
                <span>抓出心虛</span>
                <h4>
                  {lowConfidenceQuestionCount > 0
                    ? `${lowConfidenceQuestionCount.toLocaleString("zh-TW")} 題低信心`
                    : "低信心題會在這裡"}
                </h4>
                <p>
                  {lowConfidenceQuestionCount > 0
                    ? "有些題目就算答對，當下其實也不穩。這區可以幫你把那些容易飄掉的觀念找回來。"
                    : "之後按下沒信心的題目，會變成考前很實用的回顧清單。"}
                </p>
              </article>

              <article className="pre-exam-survey-review-card pre-exam-survey-review-card-hero">
                <span>看整回合</span>
                <h4>
                  {fullLengthSessionCount > 0
                    ? `${fullLengthSessionCount.toLocaleString("zh-TW")} 回完整回合`
                    : mockExamCount > 0
                      ? `${mockExamCount.toLocaleString("zh-TW")} 回模擬考`
                      : "完整測驗會在這裡"}
                </h4>
                <p>
                  {fullLengthSessionCount > 0 || mockExamCount > 0
                    ? `其中 ${mockExamCount.toLocaleString("zh-TW")} 回是正式模擬考。結果頁可以拿來看整張考卷的錯題、低信心題和補強建議。`
                    : "做完完整回合後，結果頁會幫你把整份考卷整理成可以回頭看的紀錄。"}
                </p>
              </article>
            </div>

            <div className="pre-exam-survey-review-chip-row">
              <em>{savedQuestionCount.toLocaleString("zh-TW")} 題已儲存</em>
              <em>{noteCount.toLocaleString("zh-TW")} 則筆記</em>
              <em>{mockExamCount.toLocaleString("zh-TW")} 回正式模擬考</em>
            </div>
          </div>
        </section>
      );
    }

    return (
      <section key="next" className="pre-exam-survey-slide pre-exam-survey-slide-final">
        <div className="pre-exam-survey-slide-copy pre-exam-survey-slide-copy-center">
          <span>05 / 回顧到這裡</span>
          <h3>每個人的考前用法，其實都不太一樣。</h3>
          <p>
            有人每天先做幾題暖機，有人專心翻詳解，有人把藥名卡當睡前複習。接下來這份小問卷，
            只是想更清楚地理解這些使用方式。
          </p>
        </div>

        <div className="pre-exam-survey-reflection">
          <div className="pre-exam-survey-reflection-line" aria-hidden="true" />
          <div className="pre-exam-survey-reflection-item">
            <span>01</span>
            <div>
              <h4>你最常打開的地方</h4>
              <p>是散題、模擬考、錯題複習、搜尋、詳解，還是藥名卡。</p>
            </div>
          </div>
          <div className="pre-exam-survey-reflection-item">
            <span>02</span>
            <div>
              <h4>你真正覺得有幫助的功能</h4>
              <p>陽明詳解、排版過的 AI 詳解、同學補充、自己的筆記，都可以被選進來。</p>
            </div>
          </div>
          <div className="pre-exam-survey-reflection-item">
            <span>03</span>
            <div>
              <h4>你希望考前保留的節奏</h4>
              <p>不用回答得很正式，只要照你現在的使用感覺選就好。</p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (!mounted || loading || !isPreviewAllowed) {
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
                        <span>{String(currentSlideNumber).padStart(2, "0")} / 快速問卷</span>
                        <b>{currentQuestion.required ? "必填" : "選填"}</b>
                      </div>
                      {renderQuestion(currentQuestion, formQuestionIndex)}
                    </div>
                    <div className="pre-exam-survey-footer">
                      <div>
                        <strong>{formQuestionIndex >= SURVEY_QUESTIONS.length - 1 ? "最後一題" : "照現在的感覺選就好"}</strong>
                        <span>
                          {completedRequiredCount === requiredQuestions.length
                            ? "必填題都完成了，可以送出。"
                            : "不用寫很長，選最接近你現在使用狀態的答案。"}
                        </span>
                        {submitMessage ? <p>{submitMessage}</p> : null}
                      </div>
                      <div className="pre-exam-survey-form-actions">
                        <button
                          type="button"
                          className="pre-exam-survey-secondary"
                          onClick={goToPreviousFormQuestion}
                          disabled={formQuestionIndex === 0 || submitState === "sending"}
                        >
                          上一題
                        </button>
                        <button
                          type="button"
                          className="pre-exam-survey-submit"
                          data-state={submitState}
                          disabled={submitState === "sending"}
                          onClick={goToNextFormQuestion}
                        >
                          {submitState === "sending"
                            ? "送出中"
                            : formQuestionIndex >= SURVEY_QUESTIONS.length - 1
                              ? submitState === "saved-local"
                                ? "再送一次"
                                : "送出問卷"
                              : "下一題"}
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
