import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isSupabaseRecoveryMode } from "@/lib/supabase/recoveryMode";
import { withServerTimeout } from "@/lib/serverTimeout";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SurveyAnswerPayload = {
  questionId?: unknown;
  questionTitle?: unknown;
  type?: unknown;
  value?: unknown;
  labels?: unknown;
  otherText?: unknown;
};

type SurveyBody = {
  surveyId?: unknown;
  visitorId?: unknown;
  accessToken?: unknown;
  answers?: unknown;
  clientMeta?: unknown;
};

type VerifiedUser = {
  id: string;
  email?: string | null;
};

type SurveyUsageSnapshot = {
  loggedIn?: unknown;
  hasEnoughData?: unknown;
  totalAttemptsBucket?: unknown;
  activeDaysBucket?: unknown;
  usagePersona?: unknown;
  reviewStyle?: unknown;
  mostPracticedSubject?: unknown;
};

type UsageAttemptRow = {
  question_id: string | null;
  is_correct: boolean | null;
  confidence: number | null;
  answered_at: string | null;
  subject_snapshot: string | null;
};

type UsageSessionRow = {
  mode: string | null;
  question_count: number | null;
  completed_at: string | null;
};

type UsageDailyPoint = {
  date: string;
  attempts: number;
  correctRate: number;
};

const SURVEY_ID = "med_exam_qbank_pre_exam_feedback_2026";
const SURVEY_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const SURVEY_RATE_LIMIT_MAX = 4;
const SURVEY_PREVIEW_EMAILS = new Set(["tonyhuang921021@gmail.com"]);

function getServiceSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return null;
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

function sanitizeString(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function normalizeEmail(value?: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

function isSurveyPreviewAllowed(email?: string | null) {
  return SURVEY_PREVIEW_EMAILS.has(normalizeEmail(email));
}

function sanitizeAnswerValue(value: unknown) {
  if (typeof value === "string") return value.trim().slice(0, 240);
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim().slice(0, 160))
      .filter(Boolean)
      .slice(0, 12);
  }
  if (value === null || typeof value === "undefined") return null;
  return String(value).trim().slice(0, 240);
}

function normalizeAnswers(input: unknown): SurveyAnswerPayload[] {
  if (!Array.isArray(input)) return [];
  return input.slice(0, 24).map((entry) => {
    const item = entry && typeof entry === "object" ? (entry as SurveyAnswerPayload) : {};
    const labels = Array.isArray(item.labels)
      ? item.labels
          .filter((label): label is string => typeof label === "string")
          .map((label) => label.trim().slice(0, 160))
          .filter(Boolean)
          .slice(0, 12)
      : undefined;

    return {
      questionId: sanitizeString(item.questionId, 80),
      questionTitle: sanitizeString(item.questionTitle, 180),
      type: sanitizeString(item.type, 24),
      value: sanitizeAnswerValue(item.value),
      ...(labels && labels.length > 0 ? { labels } : {}),
      ...(sanitizeString(item.otherText, 240) ? { otherText: sanitizeString(item.otherText, 240) } : {})
    };
  });
}

function normalizeClientMeta(input: unknown) {
  const meta = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const viewport = meta.viewport && typeof meta.viewport === "object" ? (meta.viewport as Record<string, unknown>) : null;
  const usageSnapshot =
    meta.usageSnapshot && typeof meta.usageSnapshot === "object"
      ? (meta.usageSnapshot as SurveyUsageSnapshot)
      : null;
  const width = typeof viewport?.width === "number" && Number.isFinite(viewport.width) ? viewport.width : null;
  const height = typeof viewport?.height === "number" && Number.isFinite(viewport.height) ? viewport.height : null;
  const timeToCompleteMs =
    typeof meta.timeToCompleteMs === "number" && Number.isFinite(meta.timeToCompleteMs)
      ? Math.max(0, Math.min(meta.timeToCompleteMs, 60 * 60 * 1000))
      : null;

  return {
    pagePath: sanitizeString(meta.pagePath, 120) || "/",
    userAgent: sanitizeString(meta.userAgent, 360),
    viewport: width && height ? { width, height } : null,
    timeToCompleteMs,
    usageSnapshot: usageSnapshot
      ? {
          loggedIn: Boolean(usageSnapshot.loggedIn),
          hasEnoughData: Boolean(usageSnapshot.hasEnoughData),
          totalAttemptsBucket: sanitizeString(usageSnapshot.totalAttemptsBucket, 24),
          activeDaysBucket: sanitizeString(usageSnapshot.activeDaysBucket, 24),
          usagePersona: sanitizeString(usageSnapshot.usagePersona, 48),
          reviewStyle: sanitizeString(usageSnapshot.reviewStyle, 48),
          mostPracticedSubject: sanitizeString(usageSnapshot.mostPracticedSubject, 48) || null
        }
      : null
  };
}

function buildAnswerSummary(answers: SurveyAnswerPayload[]) {
  const byId = new Map(answers.map((answer) => [String(answer.questionId ?? ""), answer]));
  const getValue = (id: string) => byId.get(id)?.value ?? null;
  return {
    school: getValue("school"),
    awarenessSource: getValue("awareness_source"),
    usageFrequency: getValue("usage_frequency"),
    primaryEnvironment: getValue("primary_environment"),
    mostHelpfulFeatures: getValue("most_helpful_features"),
    comparativeValue: getValue("comparative_value"),
    disappearanceImpact: getValue("disappearance_impact"),
    recommendationIntent: getValue("recommendation_intent"),
    practiceReviewSmoothness: getValue("practice_review_smoothness"),
    syncConfidence: getValue("sync_confidence"),
    unacceptableIssues: getValue("unacceptable_issues")
  };
}

async function getVerifiedUser(supabase: any, accessToken: unknown): Promise<VerifiedUser | null> {
  const token = sanitizeString(accessToken, 4096);
  if (!token) return null;

  try {
    const { data, error } = (await withServerTimeout(
      supabase.auth.getUser(token),
      1200,
      "登入狀態驗證逾時"
    )) as { data?: { user?: { id?: string; email?: string | null } | null }; error?: unknown };
    if (error || !data?.user?.id) return null;
    return {
      id: data.user.id,
      email: data.user.email ?? null
    };
  } catch {
    return null;
  }
}

function isMissingSurveyTable(error: unknown) {
  const message =
    error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : String(error ?? "");
  return message.includes("pre_exam_survey_responses") && message.includes("does not exist");
}

function getBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization") ?? "";
  return authorization.startsWith("Bearer ") ? authorization.slice("Bearer ".length).trim() : "";
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

function buildDailyPoints(attemptRows: UsageAttemptRow[], days = 30): UsageDailyPoint[] {
  const dayKeys = getRecentTaipeiDayKeys(days);
  const grouped = new Map<string, { attempts: number; correctAttempts: number }>();

  for (const dayKey of dayKeys) {
    grouped.set(dayKey, { attempts: 0, correctAttempts: 0 });
  }

  for (const row of attemptRows) {
    const dayKey = getTaipeiDateKey(row.answered_at);
    if (!dayKey || !grouped.has(dayKey)) continue;
    const stats = grouped.get(dayKey) ?? { attempts: 0, correctAttempts: 0 };
    stats.attempts += 1;
    if (row.is_correct) stats.correctAttempts += 1;
    grouped.set(dayKey, stats);
  }

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

async function safeCountByUser(supabase: any, tableName: string, column: string, userId: string) {
  try {
    const result = (await withServerTimeout(
      supabase.from(tableName).select(column, { count: "exact", head: true }).eq("user_id", userId),
      1000,
      `${tableName} count timeout`
    )) as { count?: number | null; error?: unknown };
    if (result.error) return null;
    return result.count ?? 0;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.get("usageReview") !== "1") {
    return NextResponse.json({ ok: false, message: "Unsupported survey GET request." }, { status: 404 });
  }

  if (isSupabaseRecoveryMode()) {
    return NextResponse.json(
      { ok: true, loggedIn: false, hasEnoughData: false, source: "fallback" },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  const supabase = getServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { ok: true, loggedIn: false, hasEnoughData: false, source: "fallback" },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  const verifiedUser = await getVerifiedUser(supabase, getBearerToken(request));
  if (!verifiedUser) {
    return NextResponse.json(
      { ok: true, loggedIn: false, hasEnoughData: false, source: "fallback" },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const [attemptResult, sessionResult, savedQuestionCount, noteCount] = await Promise.all([
      withServerTimeout(
        supabase
          .from("quiz_session_attempts")
          .select("question_id,is_correct,confidence,answered_at,subject_snapshot", { count: "exact" })
          .eq("user_id", verifiedUser.id)
          .order("answered_at", { ascending: false })
          .limit(5000),
        1800,
        "使用回顧作答紀錄讀取逾時"
      ),
      withServerTimeout(
        supabase
          .from("quiz_sessions")
          .select("mode,question_count,completed_at")
          .eq("user_id", verifiedUser.id)
          .not("completed_at", "is", null)
          .order("completed_at", { ascending: false })
          .limit(800),
        1600,
        "使用回顧測驗紀錄讀取逾時"
      ),
      safeCountByUser(supabase, "saved_questions", "question_id", verifiedUser.id),
      safeCountByUser(supabase, "study_notes", "id", verifiedUser.id)
    ]);

    if (attemptResult.error) throw attemptResult.error;
    if (sessionResult.error) throw sessionResult.error;

    const attemptRows = ((attemptResult.data ?? []) as UsageAttemptRow[]).filter((row) => row.answered_at);
    const sessionRows = ((sessionResult.data ?? []) as UsageSessionRow[]).filter((row) => row.completed_at);
    const uniqueQuestions = new Set<string>();
    const wrongQuestions = new Set<string>();
    const lowConfidenceQuestions = new Set<string>();
    const activeDays = new Set<string>();
    const subjectCounts = new Map<string, number>();
    const subjectCorrectCounts = new Map<string, number>();
    const hourCounts = new Map<number, number>();
    let correctAttempts = 0;
    let confidenceMarkedCount = 0;
    let firstAnsweredAt: string | null = null;
    let lastAnsweredAt: string | null = null;

    for (const row of attemptRows) {
      const questionId = row.question_id?.trim();
      if (questionId) uniqueQuestions.add(questionId);
      if (row.is_correct) correctAttempts += 1;
      if (!row.is_correct && questionId) wrongQuestions.add(questionId);
      if (typeof row.confidence === "number") confidenceMarkedCount += 1;
      if (typeof row.confidence === "number" && row.confidence <= 2 && questionId) {
        lowConfidenceQuestions.add(questionId);
      }

      const dayKey = getTaipeiDateKey(row.answered_at);
      if (dayKey) activeDays.add(dayKey);
      const hour = getTaipeiHour(row.answered_at);
      if (hour !== null) hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1);
      if (row.answered_at && (!firstAnsweredAt || row.answered_at < firstAnsweredAt)) {
        firstAnsweredAt = row.answered_at;
      }
      if (row.answered_at && (!lastAnsweredAt || row.answered_at > lastAnsweredAt)) {
        lastAnsweredAt = row.answered_at;
      }

      const subject = row.subject_snapshot?.trim();
      if (subject) {
        subjectCounts.set(subject, (subjectCounts.get(subject) ?? 0) + 1);
        if (row.is_correct) subjectCorrectCounts.set(subject, (subjectCorrectCounts.get(subject) ?? 0) + 1);
      }
    }

    const totalAttempts = attemptResult.count ?? attemptRows.length;
    const dailyPoints = buildDailyPoints(attemptRows);
    const mockExamCount = sessionRows.filter((row) => row.mode === "simulation").length;
    const fullLengthSessionCount = sessionRows.filter((row) => Number(row.question_count ?? 0) >= 80).length;
    const customExamCount = sessionRows.filter((row) => row.mode === "custom_paper").length;
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

    return NextResponse.json(
      {
        ok: true,
        loggedIn: true,
        hasEnoughData: totalAttempts >= 5,
        userDisplayName: getDisplayNameFromEmail(verifiedUser.email),
        source: "cloud",
        metrics: {
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
          dailyPoints,
          savedQuestionCount,
          noteCount,
          mostPracticedSubject,
          weakestSubject,
          mostActiveHour,
          firstAnsweredAt,
          lastAnsweredAt
        }
      },
      { headers: { "Cache-Control": "private, max-age=60" } }
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        loggedIn: true,
        hasEnoughData: false,
        source: "fallback",
        message: error instanceof Error ? error.message : "使用回顧暫時讀取失敗"
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function POST(request: NextRequest) {
  if (isSupabaseRecoveryMode()) {
    return NextResponse.json(
      { ok: false, message: "問卷暫時改成本機暫存，等雲端恢復後再送。" },
      { status: 503 }
    );
  }

  const supabase = getServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, message: "SUPABASE_SERVICE_ROLE_KEY 尚未設定，問卷會先存在本機。" },
      { status: 503 }
    );
  }

  try {
    const body = (await request.json().catch(() => null)) as SurveyBody | null;
    if (sanitizeString(body?.surveyId, 120) !== SURVEY_ID) {
      return NextResponse.json({ ok: false, message: "問卷版本不正確，請重新整理後再試。" }, { status: 400 });
    }

    const answers = normalizeAnswers(body?.answers);
    if (answers.length === 0) {
      return NextResponse.json({ ok: false, message: "問卷內容是空的。" }, { status: 400 });
    }

    const visitorId = sanitizeString(body?.visitorId, 128) || null;
    const verifiedUser = await getVerifiedUser(supabase, body?.accessToken);
    if (!isSurveyPreviewAllowed(verifiedUser?.email)) {
      return NextResponse.json({ ok: false, message: "問卷目前只開放預覽帳號。" }, { status: 403 });
    }

    const actorColumn = verifiedUser?.id ? "user_id" : "visitor_id";
    const actorValue = verifiedUser?.id ?? visitorId;

    if (!actorValue) {
      return NextResponse.json({ ok: false, message: "目前無法識別問卷來源，請稍後再試。" }, { status: 400 });
    }

    const since = new Date(Date.now() - SURVEY_RATE_LIMIT_WINDOW_MS).toISOString();
    const rateLimitResult = await withServerTimeout(
      supabase
        .from("pre_exam_survey_responses")
        .select("id", { count: "exact", head: true })
        .eq("survey_id", SURVEY_ID)
        .eq(actorColumn, actorValue)
        .gte("submitted_at", since),
      1600,
      "問卷頻率檢查逾時"
    );

    if (rateLimitResult.error) throw rateLimitResult.error;
    if ((rateLimitResult.count ?? 0) >= SURVEY_RATE_LIMIT_MAX) {
      return NextResponse.json(
        { ok: false, message: "問卷送出太頻繁，晚點再試就好。" },
        { status: 429 }
      );
    }

    const clientMeta = normalizeClientMeta(body?.clientMeta);
    const insertResult = await withServerTimeout(
      supabase.from("pre_exam_survey_responses").insert({
        survey_id: SURVEY_ID,
        visitor_id: visitorId,
        user_id: verifiedUser?.id ?? null,
        user_email: verifiedUser?.email ?? null,
        answers,
        answer_summary: buildAnswerSummary(answers),
        page_path: clientMeta.pagePath,
        user_agent: clientMeta.userAgent,
        client_meta: clientMeta
      }),
      2500,
      "問卷送出逾時"
    );

    if (insertResult.error) throw insertResult.error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = isMissingSurveyTable(error)
      ? "問卷資料表尚未套用，已先存在這台裝置。"
      : error instanceof Error
        ? error.message
        : "問卷送出失敗";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
