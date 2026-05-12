import type { User } from "@supabase/supabase-js";
import type { LeaderboardEntry, QuizSession, VisitorStats } from "@/types/quiz";
import {
  loadCompletedSessions,
  loadCompletedSessionsForUser,
  saveCompletedSessions
} from "@/lib/storage";
import {
  getSupabaseBrowserClient,
  isSupabaseConfigured
} from "@/lib/supabase/client";

type QuizSessionRow = {
  id: string;
  user_id: string;
  subject: string;
  started_at: string;
  completed_at: string | null;
  session_payload: QuizSession;
  updated_at?: string | null;
};

type LeaderboardRow = {
  user_id: string;
  display_name: string;
  total_attempts: number;
  correct_attempts: number;
  correct_rate: number;
  total_sessions: number;
  updated_at?: string | null;
};

const VISITOR_STORAGE_KEY = "acq-visitor-id";
const ONLINE_WINDOW_MS = 2 * 60 * 1000;

function getVisitorId() {
  if (typeof window === "undefined") return null;

  const existingId = window.localStorage.getItem(VISITOR_STORAGE_KEY);
  if (existingId) return existingId;

  const nextId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `visitor-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  window.localStorage.setItem(VISITOR_STORAGE_KEY, nextId);
  return nextId;
}

function sessionFreshnessValue(session: QuizSession) {
  return session.completedAt || session.startedAt || "";
}

function mergeSessions(localSessions: QuizSession[], remoteSessions: QuizSession[]) {
  const merged = new Map<string, QuizSession>();

  for (const session of [...localSessions, ...remoteSessions]) {
    const current = merged.get(session.id);
    if (!current) {
      merged.set(session.id, session);
      continue;
    }

    const currentFreshness = sessionFreshnessValue(current);
    const nextFreshness = sessionFreshnessValue(session);
    const nextAttempts = session.attempts.length;
    const currentAttempts = current.attempts.length;

    if (
      nextFreshness > currentFreshness ||
      (nextFreshness === currentFreshness && nextAttempts >= currentAttempts)
    ) {
      merged.set(session.id, session);
    }
  }

  return Array.from(merged.values()).sort((a, b) =>
    sessionFreshnessValue(b).localeCompare(sessionFreshnessValue(a))
  );
}

function mapRowToSession(row: QuizSessionRow | null) {
  return row?.session_payload ?? null;
}

function getLeaderboardDisplayName(user: Pick<User, "id" | "email" | "user_metadata">) {
  const displayName =
    typeof user.user_metadata?.display_name === "string" ? user.user_metadata.display_name.trim() : "";

  if (displayName) return displayName.slice(0, 24);

  const emailName = user.email?.split("@")[0]?.trim();
  if (emailName) return emailName.slice(0, 24);

  return `玩家-${user.id.slice(0, 6)}`;
}

function summarizeLeaderboardSessions(sessions: QuizSession[]) {
  const completedSessions = sessions.filter((session) => Boolean(session.completedAt));
  const totalAttempts = completedSessions.reduce((sum, session) => sum + session.attempts.length, 0);
  const correctAttempts = completedSessions.reduce(
    (sum, session) => sum + session.attempts.filter((attempt) => attempt.isCorrect).length,
    0
  );
  const correctRate = totalAttempts === 0 ? 0 : Number(((correctAttempts / totalAttempts) * 100).toFixed(1));

  return {
    totalAttempts,
    correctAttempts,
    correctRate,
    totalSessions: completedSessions.length
  };
}

function mapLeaderboardRow(row: LeaderboardRow): LeaderboardEntry {
  return {
    userId: row.user_id,
    displayName: row.display_name,
    totalAttempts: row.total_attempts,
    correctAttempts: row.correct_attempts,
    correctRate: Number(row.correct_rate ?? 0),
    totalSessions: row.total_sessions,
    updatedAt: row.updated_at ?? undefined
  };
}

async function upsertSessionsForUser(userId: string, sessions: QuizSession[]) {
  if (!isSupabaseConfigured() || sessions.length === 0) return;

  const supabase = getSupabaseBrowserClient();
  const rows: QuizSessionRow[] = sessions.map((session) => ({
    id: session.id,
    user_id: userId,
    subject: session.subject,
    started_at: session.startedAt,
    completed_at: session.completedAt ?? null,
    session_payload: session
  }));

  const { error } = await supabase
    .from("quiz_sessions")
    .upsert(rows, { onConflict: "id" });

  if (error) {
    throw error;
  }
}

export async function syncCompletedSessionsForCurrentUser(userId: string) {
  if (!isSupabaseConfigured()) {
    return loadCompletedSessions();
  }

  const supabase = getSupabaseBrowserClient();
  const localSessions = mergeSessions(
    loadCompletedSessionsForUser("guest"),
    loadCompletedSessions()
  );
  const { data, error } = await supabase
    .from("quiz_sessions")
    .select("id, user_id, subject, started_at, completed_at, session_payload, updated_at")
    .eq("user_id", userId)
    .order("completed_at", { ascending: false, nullsFirst: false });

  if (error) {
    throw error;
  }

  const remoteSessions = (data ?? [])
    .map((row) => mapRowToSession(row as QuizSessionRow))
    .filter((session): session is QuizSession => Boolean(session));
  const mergedSessions = mergeSessions(localSessions, remoteSessions);

  saveCompletedSessions(mergedSessions);
  await upsertSessionsForUser(userId, mergedSessions);

  return mergedSessions;
}

export async function pushCompletedSessionToSupabase(session: QuizSession) {
  if (!isSupabaseConfigured()) return;

  const supabase = getSupabaseBrowserClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return;
  await upsertSessionsForUser(user.id, [session]);
}

export async function syncLeaderboardProfileForCurrentUser(
  user: Pick<User, "id" | "email" | "user_metadata">,
  sessions?: QuizSession[]
) {
  if (!isSupabaseConfigured()) return;

  const supabase = getSupabaseBrowserClient();
  const sourceSessions = sessions ?? loadCompletedSessions();
  const summary = summarizeLeaderboardSessions(sourceSessions);

  const { error } = await supabase.from("leaderboard_profiles").upsert(
    {
      user_id: user.id,
      display_name: getLeaderboardDisplayName(user),
      total_attempts: summary.totalAttempts,
      correct_attempts: summary.correctAttempts,
      correct_rate: summary.correctRate,
      total_sessions: summary.totalSessions,
      updated_at: new Date().toISOString()
    },
    { onConflict: "user_id" }
  );

  if (error) {
    throw error;
  }
}

export async function updateLeaderboardDisplayName(
  user: Pick<User, "id" | "email" | "user_metadata">,
  displayName: string
) {
  if (!isSupabaseConfigured()) return;

  const supabase = getSupabaseBrowserClient();
  const trimmed = displayName.trim().slice(0, 24) || getLeaderboardDisplayName(user);

  const { error } = await supabase.from("leaderboard_profiles").upsert(
    {
      user_id: user.id,
      display_name: trimmed,
      updated_at: new Date().toISOString()
    },
    { onConflict: "user_id" }
  );

  if (error) {
    throw error;
  }
}

export async function loadLeaderboard(limit = 50) {
  if (!isSupabaseConfigured()) {
    return [] as LeaderboardEntry[];
  }

  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("leaderboard_profiles")
    .select("user_id, display_name, total_attempts, correct_attempts, correct_rate, total_sessions, updated_at")
    .order("total_attempts", { ascending: false })
    .order("correct_rate", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => mapLeaderboardRow(row as LeaderboardRow));
}

export async function trackVisitorPresence(userId?: string | null) {
  if (!isSupabaseConfigured()) return;

  const visitorId = getVisitorId();
  if (!visitorId) return;

  const supabase = getSupabaseBrowserClient();
  const now = new Date().toISOString();

  const { error } = await supabase.from("site_visitors").upsert(
    {
      visitor_id: visitorId,
      user_id: userId ?? null,
      last_seen_at: now
    },
    { onConflict: "visitor_id" }
  );

  if (error) {
    throw error;
  }
}

export async function loadVisitorStats(): Promise<VisitorStats> {
  if (!isSupabaseConfigured()) {
    return {
      totalVisitors: 0,
      onlineVisitors: 0,
      updatedAt: new Date().toISOString()
    };
  }

  const supabase = getSupabaseBrowserClient();
  const onlineSince = new Date(Date.now() - ONLINE_WINDOW_MS).toISOString();

  const [{ count: totalVisitors, error: totalError }, { count: onlineVisitors, error: onlineError }] =
    await Promise.all([
      supabase.from("site_visitors").select("*", { count: "exact", head: true }),
      supabase
        .from("site_visitors")
        .select("*", { count: "exact", head: true })
        .gte("last_seen_at", onlineSince)
    ]);

  if (totalError) throw totalError;
  if (onlineError) throw onlineError;

  return {
    totalVisitors: totalVisitors ?? 0,
    onlineVisitors: onlineVisitors ?? 0,
    updatedAt: new Date().toISOString()
  };
}
