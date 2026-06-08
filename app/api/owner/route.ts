import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type {
  OwnerClassificationReportEntry,
  OwnerDailyPoint,
  OwnerDashboardStats,
  OwnerExplanationUsageEntry,
  OwnerHourlyPoint,
  OwnerRecentAIAccountEntry,
  OwnerYangmingExplanationReportEntry,
  OwnerYangmingModeActivationEntry,
  OwnerTopAttemptVisitorEntry
} from "@/types/quiz";
import { normalizeEmail } from "@/lib/aiAccountBan";

type OwnerRequestBody = {
  accessToken?: string;
};

type QuestionAttemptLogRow = {
  session_id: string;
  question_id: string;
  visitor_id?: string | null;
  answered_at: string;
};

type QuestionAttemptDeviceDailyRow = {
  visitor_id: string;
  activity_date: string;
};

type AIExplanationUsageLogRow = {
  rate_key: string;
  visitor_id?: string | null;
  user_email?: string | null;
  question_id?: string | null;
  input_tokens?: number | null;
  output_tokens?: number | null;
  total_tokens?: number | null;
  used_at: string;
};

const AI_SEARCH_USAGE_PREFIX = "AI_SEARCH:";
const AI_CLASSIFICATION_USAGE_PREFIX = "AI_CLASSIFICATION:";

type AIAccountBanSummaryRow = {
  user_email: string;
  banned_until: string;
};

type ClassificationReportRow = {
  id: string | number;
  question_id: string;
  current_subject: string;
  current_chapter?: string | null;
  current_section?: string | null;
  suggested_subject?: string | null;
  suggested_chapter?: string | null;
  suggested_section?: string | null;
  reason?: string | null;
  model?: string | null;
  reporter_email?: string | null;
  visitor_id?: string | null;
  created_at: string;
  applied_at?: string | null;
  approved_by_email?: string | null;
};

type YangmingModeActivationRow = {
  user_email?: string | null;
  visitor_id?: string | null;
  enabled_at: string;
};

type YangmingExplanationReportRow = {
  id: string | number;
  question_id: string;
  reason: string;
  reporter_email?: string | null;
  visitor_id?: string | null;
  source_label?: string | null;
  source_file?: string | null;
  created_at: string;
};

const SUPABASE_PAGE_SIZE = 1000;
const ONLINE_WINDOW_MS = 2 * 60 * 1000;

function getAllowedEmails() {
  return (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function isAllowedEmail(email?: string | null) {
  if (!email) return false;
  return getAllowedEmails().includes(email.trim().toLowerCase());
}

function getTaipeiDayKey(date: Date) {
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
    keys.push(getTaipeiDayKey(current));
  }

  return keys;
}

function normalizeAttemptSessionId(sessionId: string) {
  return sessionId.replace(/^user-[^:]+:/, "");
}

function dedupeAttemptRows<T extends { session_id: string; question_id: string }>(rows: T[]) {
  const deduped = new Map<string, T>();

  for (const row of rows) {
    const normalizedSessionId = normalizeAttemptSessionId(row.session_id);
    const dedupeKey = `${normalizedSessionId}::${row.question_id}`;
    deduped.set(dedupeKey, {
      ...row,
      session_id: normalizedSessionId
    });
  }

  return Array.from(deduped.values());
}

function formatVisitorLabel(visitorId?: string | null) {
  if (!visitorId) return "未知裝置";
  const trimmed = visitorId.trim();
  if (trimmed.length <= 8) return `裝置 ${trimmed}`;
  return `裝置 ${trimmed.slice(0, 6)}...${trimmed.slice(-4)}`;
}

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

async function fetchAllRows<Row extends Record<string, unknown>>(
  supabase: any,
  table: string,
  selectClause: string,
  orderColumn: string,
  configure?: (query: any) => any
): Promise<Row[]> {
  const rows: Row[] = [];
  let from = 0;

  while (true) {
    let query = supabase
      .from(table)
      .select(selectClause)
      .order(orderColumn, { ascending: true })
      .range(from, from + SUPABASE_PAGE_SIZE - 1);

    if (configure) {
      query = configure(query as never) as typeof query;
    }

    const { data, error } = await query;
    if (error) throw error;

    const page = (data ?? []) as unknown as Row[];
    rows.push(...page);
    if (page.length < SUPABASE_PAGE_SIZE) break;
    from += SUPABASE_PAGE_SIZE;
  }

  return rows;
}

async function fetchOwnerDailySeries(
  supabase: any,
  days = 14
): Promise<OwnerDailyPoint[]> {
  const dayKeys = getRecentTaipeiDayKeys(days);
  const { data, error } = await supabase
    .from("owner_daily_stats")
    .select("activity_date, attempts, devices")
    .in("activity_date", dayKeys);

  if (error) throw error;

  const dayMap = new Map(
    ((data ?? []) as { activity_date: string; attempts: number; devices: number }[]).map((row) => [
      row.activity_date,
      row
    ] as const)
  );

  const recentDayKeys = dayKeys.slice(-2);
  if (recentDayKeys.length > 0) {
    const startDate = recentDayKeys[0];
    const endDate = recentDayKeys[recentDayKeys.length - 1];
    const endDateExclusive = new Date(`${endDate}T00:00:00+08:00`);
    endDateExclusive.setDate(endDateExclusive.getDate() + 1);

    const [attemptRows, deviceRows] = await Promise.all([
      fetchAllRows<Pick<QuestionAttemptLogRow, "session_id" | "question_id" | "answered_at">>(
        supabase,
        "question_attempt_logs",
        "session_id, question_id, answered_at",
        "answered_at",
        (query) =>
          query
            .gte("answered_at", `${startDate}T00:00:00+08:00`)
            .lt("answered_at", endDateExclusive.toISOString())
      ),
      fetchAllRows<Pick<QuestionAttemptDeviceDailyRow, "activity_date" | "visitor_id">>(
        supabase,
        "question_attempt_device_daily",
        "visitor_id, activity_date",
        "activity_date",
        (query) => query.in("activity_date", recentDayKeys)
      )
    ]);

    const recentAttemptMap = new Map<string, number>();
    const recentDeviceMap = new Map<string, Set<string>>();

    for (const row of dedupeAttemptRows(attemptRows)) {
      const key = getTaipeiDayKey(new Date(row.answered_at));
      if (!recentDayKeys.includes(key)) continue;
      recentAttemptMap.set(key, (recentAttemptMap.get(key) ?? 0) + 1);
    }

    for (const row of deviceRows) {
      if (!recentDayKeys.includes(row.activity_date)) continue;
      const visitorId = row.visitor_id?.trim();
      const current = recentDeviceMap.get(row.activity_date) ?? new Set<string>();
      if (visitorId) current.add(visitorId);
      recentDeviceMap.set(row.activity_date, current);
    }

    for (const key of recentDayKeys) {
      dayMap.set(key, {
        activity_date: key,
        attempts: recentAttemptMap.get(key) ?? 0,
        devices: recentDeviceMap.get(key)?.size ?? 0
      });
    }
  }

  return dayKeys.map((date) => ({
    date,
    attempts: dayMap.get(date)?.attempts ?? 0,
    devices: dayMap.get(date)?.devices ?? 0
  }));
}

async function fetchOwnerHourlySeries(
  supabase: any
): Promise<OwnerHourlyPoint[]> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const data = await fetchAllRows<QuestionAttemptLogRow>(
    supabase,
    "question_attempt_logs",
    "session_id, question_id, answered_at, visitor_id",
    "answered_at",
    (query) => query.gte("answered_at", sevenDaysAgo)
  );

  const hourAttemptMap = new Map<number, number>();
  const hourDeviceMap = new Map<number, Set<string>>();

  for (const row of dedupeAttemptRows(data)) {
    const hour = Number(
      new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Taipei",
        hour: "2-digit",
        hourCycle: "h23"
      }).format(new Date(row.answered_at))
    );

    hourAttemptMap.set(hour, (hourAttemptMap.get(hour) ?? 0) + 1);

    const visitorId = row.visitor_id?.trim();
    if (!hourDeviceMap.has(hour)) {
      hourDeviceMap.set(hour, new Set<string>());
    }
    if (visitorId) {
      hourDeviceMap.get(hour)?.add(visitorId);
    }
  }

  return Array.from({ length: 24 }, (_, hour) => ({
    hour,
    attempts: hourAttemptMap.get(hour) ?? 0,
    devices: hourDeviceMap.get(hour)?.size ?? 0
  }));
}

async function fetchOwnerExplanationUsage(
  supabase: any,
  feature: "explanation" | "search"
): Promise<OwnerExplanationUsageEntry[]> {
  const rows = await fetchAllRows<AIExplanationUsageLogRow>(
    supabase,
    "ai_explanation_usage_logs",
    "rate_key, visitor_id, user_email, question_id, input_tokens, output_tokens, total_tokens, used_at",
    "used_at"
  );

  const grouped = new Map<string, OwnerExplanationUsageEntry>();

  for (const row of rows.filter((entry) => {
    const questionId = entry.question_id ?? "";
    if (feature === "search") {
      return questionId.startsWith(AI_SEARCH_USAGE_PREFIX);
    }
    return !questionId.startsWith(AI_SEARCH_USAGE_PREFIX);
  })) {
    const key = row.user_email?.trim().toLowerCase() || row.visitor_id || row.rate_key;
    const current = grouped.get(key) ?? {
      label: row.user_email?.trim() || row.visitor_id || row.rate_key,
      userEmail: row.user_email ?? undefined,
      visitorId: row.visitor_id ?? undefined,
      explanationCount: 0,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      lastUsedAt: row.used_at
    };

    current.explanationCount += 1;
    current.inputTokens += row.input_tokens ?? 0;
    current.outputTokens += row.output_tokens ?? 0;
    current.totalTokens += row.total_tokens ?? (row.input_tokens ?? 0) + (row.output_tokens ?? 0);
    if (!current.lastUsedAt || row.used_at > current.lastUsedAt) {
      current.lastUsedAt = row.used_at;
    }

    grouped.set(key, current);
  }

  return Array.from(grouped.values()).sort((a, b) => {
    if (b.explanationCount !== a.explanationCount) return b.explanationCount - a.explanationCount;
    return b.totalTokens - a.totalTokens;
  });
}

async function fetchRecentAIAccounts(
  supabase: any
): Promise<OwnerRecentAIAccountEntry[]> {
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const rows = await fetchAllRows<AIExplanationUsageLogRow>(
    supabase,
    "ai_explanation_usage_logs",
    "rate_key, visitor_id, user_email, question_id, input_tokens, output_tokens, total_tokens, used_at",
    "used_at",
    (query) => query.gte("used_at", hourAgo)
  );

  const grouped = new Map<string, OwnerRecentAIAccountEntry>();

  for (const row of rows) {
    const userEmail = normalizeEmail(row.user_email);
    if (!userEmail) continue;

    const current = grouped.get(userEmail) ?? {
      label: row.user_email?.trim() || userEmail,
      userEmail,
      requestCountLastHour: 0,
      explanationCountLastHour: 0,
      searchCountLastHour: 0,
      classificationCountLastHour: 0,
      lastUsedAt: row.used_at
    };

    current.requestCountLastHour += 1;
    const questionId = row.question_id ?? "";
    if (questionId.startsWith(AI_SEARCH_USAGE_PREFIX)) {
      current.searchCountLastHour += 1;
    } else if (questionId.startsWith(AI_CLASSIFICATION_USAGE_PREFIX)) {
      current.classificationCountLastHour += 1;
    } else {
      current.explanationCountLastHour += 1;
    }

    if (!current.lastUsedAt || row.used_at > current.lastUsedAt) {
      current.lastUsedAt = row.used_at;
    }

    grouped.set(userEmail, current);
  }

  const { data: banRows, error: banError } = await supabase
    .from("ai_account_bans")
    .select("user_email, banned_until");

  if (banError) {
    const message = String(banError.message ?? "");
    if (!(message.includes("ai_account_bans") && (message.includes("does not exist") || message.includes("Could not find")))) {
      throw banError;
    }
  }

  for (const row of (((banRows ?? []) as AIAccountBanSummaryRow[]) || [])) {
    const userEmail = normalizeEmail(row.user_email);
    if (!userEmail) continue;
    const current = grouped.get(userEmail) ?? {
      label: row.user_email.trim(),
      userEmail,
      requestCountLastHour: 0,
      explanationCountLastHour: 0,
      searchCountLastHour: 0,
      classificationCountLastHour: 0
    };
    current.bannedUntil = row.banned_until;
    grouped.set(userEmail, current);
  }

  return Array.from(grouped.values()).sort((a, b) => {
    const aActiveBan = a.bannedUntil && new Date(a.bannedUntil).getTime() > Date.now() ? 1 : 0;
    const bActiveBan = b.bannedUntil && new Date(b.bannedUntil).getTime() > Date.now() ? 1 : 0;
    if (bActiveBan !== aActiveBan) return bActiveBan - aActiveBan;
    if (b.requestCountLastHour !== a.requestCountLastHour) {
      return b.requestCountLastHour - a.requestCountLastHour;
    }
    return (b.lastUsedAt ?? "").localeCompare(a.lastUsedAt ?? "");
  });
}

async function fetchOwnerTopAttemptVisitors(
  supabase: any,
  limit = 5
): Promise<OwnerTopAttemptVisitorEntry[]> {
  const rows = await fetchAllRows<QuestionAttemptLogRow>(
    supabase,
    "question_attempt_logs",
    "session_id, question_id, visitor_id, answered_at",
    "answered_at",
    (query) => query.not("visitor_id", "is", null)
  );

  const grouped = new Map<string, OwnerTopAttemptVisitorEntry>();

  for (const row of dedupeAttemptRows(rows)) {
    const visitorId = row.visitor_id?.trim();
    if (!visitorId) continue;

    const current = grouped.get(visitorId) ?? {
      label: formatVisitorLabel(visitorId),
      visitorId,
      attempts: 0,
      lastAttemptedAt: row.answered_at
    };

    current.attempts += 1;
    if (!current.lastAttemptedAt || row.answered_at > current.lastAttemptedAt) {
      current.lastAttemptedAt = row.answered_at;
    }
    grouped.set(visitorId, current);
  }

  return Array.from(grouped.values())
    .sort((a, b) => b.attempts - a.attempts || (b.lastAttemptedAt ?? "").localeCompare(a.lastAttemptedAt ?? ""))
    .slice(0, limit);
}

async function fetchOwnerDashboardStats(
  supabase: any,
  dailySeries: OwnerDailyPoint[],
  explanationUsage: OwnerExplanationUsageEntry[],
  searchUsage: OwnerExplanationUsageEntry[]
): Promise<OwnerDashboardStats> {
  const now = new Date();
  const onlineSince = new Date(now.getTime() - ONLINE_WINDOW_MS).toISOString();
  const todayPoint = dailySeries[dailySeries.length - 1];
  const attemptsToday = todayPoint?.attempts ?? 0;
  const attemptDevicesToday = todayPoint?.devices ?? 0;
  const attemptsLast7Days = dailySeries.slice(-7).reduce((sum, row) => sum + row.attempts, 0);

  const [
    totalVisitorsResult,
    totalAttemptDevicesResult,
    allAttemptVisitorRows,
    onlineVisitorsResult,
    totalUsersResult,
    totalAttemptsResult
  ] = await Promise.all([
    supabase.from("site_visitors").select("*", { count: "exact", head: true }),
    supabase.from("question_attempt_devices").select("*", { count: "exact", head: true }),
    fetchAllRows<Pick<QuestionAttemptLogRow, "session_id" | "question_id" | "visitor_id">>(
      supabase,
      "question_attempt_logs",
      "session_id, question_id, visitor_id",
      "answered_at"
    ),
    supabase
      .from("site_visitors")
      .select("*", { count: "exact", head: true })
      .gte("last_seen_at", onlineSince),
    supabase.from("leaderboard_profiles").select("*", { count: "exact", head: true }),
    supabase.from("question_attempt_logs").select("*", { count: "exact", head: true })
  ]);

  const errors = [
    totalVisitorsResult.error,
    totalAttemptDevicesResult.error,
    onlineVisitorsResult.error,
    totalUsersResult.error,
    totalAttemptsResult.error
  ].filter(Boolean);

  if (errors.length > 0) throw errors[0];

  const visitorAttemptCountMap = new Map<string, number>();
  for (const row of dedupeAttemptRows(allAttemptVisitorRows)) {
    const visitorId = row.visitor_id?.trim();
    if (!visitorId) continue;
    visitorAttemptCountMap.set(visitorId, (visitorAttemptCountMap.get(visitorId) ?? 0) + 1);
  }

  const aiExplanationCount = explanationUsage.reduce((sum, row) => sum + row.explanationCount, 0);
  const aiExplanationInputTokens = explanationUsage.reduce((sum, row) => sum + row.inputTokens, 0);
  const aiExplanationOutputTokens = explanationUsage.reduce((sum, row) => sum + row.outputTokens, 0);
  const aiExplanationTotalTokens = explanationUsage.reduce((sum, row) => sum + row.totalTokens, 0);
  const aiSearchCount = searchUsage.reduce((sum, row) => sum + row.explanationCount, 0);
  const aiSearchInputTokens = searchUsage.reduce((sum, row) => sum + row.inputTokens, 0);
  const aiSearchOutputTokens = searchUsage.reduce((sum, row) => sum + row.outputTokens, 0);
  const aiSearchTotalTokens = searchUsage.reduce((sum, row) => sum + row.totalTokens, 0);

  return {
    totalVisitorDevices: totalVisitorsResult.count ?? 0,
    totalAttemptDevices: totalAttemptDevicesResult.count ?? 0,
    attemptDevicesToday,
    attemptVisitorsOverFive: Array.from(visitorAttemptCountMap.values()).filter((count) => count > 5).length,
    onlineVisitors: onlineVisitorsResult.count ?? 0,
    totalSyncedUsers: totalUsersResult.count ?? 0,
    attemptsToday,
    attemptsLast7Days,
    totalAttempts: totalAttemptsResult.count ?? 0,
    aiExplanationCount,
    aiExplanationInputTokens,
    aiExplanationOutputTokens,
    aiExplanationTotalTokens,
    aiSearchCount,
    aiSearchInputTokens,
    aiSearchOutputTokens,
    aiSearchTotalTokens,
    updatedAt: now.toISOString()
  };
}

async function fetchOwnerClassificationReports(
  supabase: any,
  limit = 40
): Promise<OwnerClassificationReportEntry[]> {
  const { data, error } = await supabase
    .from("question_classification_reports")
    .select(
      "id, question_id, current_subject, current_chapter, current_section, suggested_subject, suggested_chapter, suggested_section, reason, model, reporter_email, visitor_id, created_at, applied_at, approved_by_email"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return ((data ?? []) as ClassificationReportRow[]).map((row) => ({
    id: String(row.id),
    questionId: row.question_id,
    currentSubject: row.current_subject,
    currentChapter: row.current_chapter ?? undefined,
    currentSection: row.current_section ?? undefined,
    suggestedSubject: row.suggested_subject ?? undefined,
    suggestedChapter: row.suggested_chapter ?? undefined,
    suggestedSection: row.suggested_section ?? undefined,
    reason: row.reason ?? undefined,
    model: row.model ?? undefined,
    reporterLabel: row.reporter_email?.trim() || formatVisitorLabel(row.visitor_id),
    reporterEmail: row.reporter_email ?? undefined,
    visitorId: row.visitor_id ?? undefined,
    createdAt: row.created_at,
    appliedAt: row.applied_at ?? undefined,
    approvedByEmail: row.approved_by_email ?? undefined
  }));
}

async function fetchOwnerYangmingModeActivations(
  supabase: any,
  limit = 80
): Promise<OwnerYangmingModeActivationEntry[]> {
  const { data, error } = await supabase
    .from("yangming_mode_activations")
    .select("user_email, visitor_id, enabled_at")
    .order("enabled_at", { ascending: false })
    .limit(1000);

  if (error) {
    const message = String(error.message ?? "");
    if (message.includes("yangming_mode_activations") && (message.includes("does not exist") || message.includes("Could not find"))) {
      return [];
    }
    throw error;
  }

  const grouped = new Map<string, OwnerYangmingModeActivationEntry>();
  for (const row of ((data ?? []) as YangmingModeActivationRow[])) {
    const userEmail = row.user_email?.trim().toLowerCase();
    const visitorId = row.visitor_id?.trim();
    const key = userEmail || visitorId || "unknown";
    const current = grouped.get(key) ?? {
      label: userEmail || formatVisitorLabel(visitorId),
      userEmail: userEmail || undefined,
      visitorId: visitorId || undefined,
      activationCount: 0,
      firstEnabledAt: row.enabled_at,
      lastEnabledAt: row.enabled_at
    };

    current.activationCount += 1;
    if (!current.firstEnabledAt || row.enabled_at < current.firstEnabledAt) {
      current.firstEnabledAt = row.enabled_at;
    }
    if (!current.lastEnabledAt || row.enabled_at > current.lastEnabledAt) {
      current.lastEnabledAt = row.enabled_at;
    }
    grouped.set(key, current);
  }

  return Array.from(grouped.values())
    .sort((a, b) => (b.lastEnabledAt ?? "").localeCompare(a.lastEnabledAt ?? ""))
    .slice(0, limit);
}

async function fetchOwnerYangmingExplanationReports(
  supabase: any,
  limit = 80
): Promise<OwnerYangmingExplanationReportEntry[]> {
  const { data, error } = await supabase
    .from("yangming_explanation_reports")
    .select("id, question_id, reason, reporter_email, visitor_id, source_label, source_file, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    const message = String(error.message ?? "");
    if (message.includes("yangming_explanation_reports") && (message.includes("does not exist") || message.includes("Could not find"))) {
      return [];
    }
    throw error;
  }

  return ((data ?? []) as YangmingExplanationReportRow[]).map((row) => ({
    id: String(row.id),
    questionId: row.question_id,
    reason: row.reason,
    reporterLabel: row.reporter_email?.trim() || formatVisitorLabel(row.visitor_id),
    reporterEmail: row.reporter_email ?? undefined,
    visitorId: row.visitor_id ?? undefined,
    sourceLabel: row.source_label ?? undefined,
    sourceFile: row.source_file ?? undefined,
    createdAt: row.created_at
  }));
}

export async function POST(request: NextRequest) {
  const supabase = getServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, message: "SUPABASE_SERVICE_ROLE_KEY 尚未設定，私有數據頁暫時無法使用。" },
      { status: 503 }
    );
  }

  try {
    const body = (await request.json()) as OwnerRequestBody;
    if (!body.accessToken) {
      return NextResponse.json({ ok: false, message: "請先登入。" }, { status: 401 });
    }

    const { data, error } = await supabase.auth.getUser(body.accessToken);
    if (error || !data.user?.email) {
      return NextResponse.json({ ok: false, message: "登入驗證失敗。" }, { status: 401 });
    }

    if (!isAllowedEmail(data.user.email)) {
      return NextResponse.json({ ok: false, message: "你沒有查看私有數據頁的權限。" }, { status: 403 });
    }

    const [
      dailySeries,
      hourlySeries,
      explanationUsage,
      searchUsage,
      topVisitors,
      classificationReports,
      recentAiAccounts,
      yangmingModeActivations,
      yangmingExplanationReports
    ] = await Promise.all([
      fetchOwnerDailySeries(supabase, 14),
      fetchOwnerHourlySeries(supabase),
      fetchOwnerExplanationUsage(supabase, "explanation"),
      fetchOwnerExplanationUsage(supabase, "search"),
      fetchOwnerTopAttemptVisitors(supabase, 5),
      fetchOwnerClassificationReports(supabase, 40),
      fetchRecentAIAccounts(supabase),
      fetchOwnerYangmingModeActivations(supabase, 80),
      fetchOwnerYangmingExplanationReports(supabase, 80)
    ]);
    const stats = await fetchOwnerDashboardStats(supabase, dailySeries, explanationUsage, searchUsage);

    return NextResponse.json({
      ok: true,
      stats,
      dailySeries,
      hourlySeries,
      explanationUsage,
      searchUsage,
      topVisitors,
      classificationReports,
      recentAiAccounts,
      yangmingModeActivations,
      yangmingExplanationReports
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "私有數據載入失敗";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
