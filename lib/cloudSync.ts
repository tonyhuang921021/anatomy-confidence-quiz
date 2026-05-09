import type { QuizSession } from "@/types/quiz";
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
