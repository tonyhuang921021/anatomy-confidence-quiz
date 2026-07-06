import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { compactQuestionForStorage, compactSessionForStorage, normalizeSessions } from "@/lib/storage";
import { isSupabaseRecoveryMode } from "@/lib/supabase/recoveryMode";
import { Attempt, Question, QuizSession } from "@/types/quiz";

type QuizSessionRow = {
  id: string;
  user_id: string;
  subject: string;
  mode?: string | null;
  session_name?: string | null;
  question_count?: number | null;
  correct_count?: number | null;
  wrong_count?: number | null;
  average_confidence?: number | null;
  started_at: string;
  completed_at: string | null;
  session_payload?: Partial<QuizSession> | null;
  updated_at?: string | null;
};

type QuizSessionAttemptRow = {
  session_id: string;
  user_id: string;
  question_order: number;
  question_id: string;
  selected_answer: string;
  correct_answer: string;
  is_correct: boolean;
  confidence: number | null;
  error_type?: string | null;
  answered_at: string;
  source_mode?: string | null;
  subject_snapshot?: string | null;
  chapter_snapshot?: string | null;
  section_snapshot?: string | null;
};

type QuizSessionSyncRequestBody = {
  sessions?: unknown[];
  activeCheckpoint?: unknown;
};

type ServiceSupabaseClient = any;

const MAX_SYNC_SESSIONS = 80;
const MAX_SYNC_ATTEMPTS = 2000;

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

function getBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization") ?? "";
  return authorization.startsWith("Bearer ") ? authorization.slice("Bearer ".length).trim() : "";
}

function namespaceSessionIdForUser(userId: string, sessionId: string) {
  const prefix = `user-${userId}:`;
  return sessionId.startsWith(prefix) ? sessionId : `${prefix}${sessionId}`;
}

function canonicalizeSessionsForUser(userId: string, sessions: QuizSession[]) {
  return sessions.map((session) => ({
    ...session,
    id: namespaceSessionIdForUser(userId, session.id)
  }));
}

function isCompletedQuizSession(session: QuizSession) {
  return Boolean(session.completedAt);
}

function isCompletedQuizSessionRow(row: Pick<QuizSessionRow, "completed_at" | "session_payload">) {
  return Boolean(row.completed_at || row.session_payload?.completedAt);
}

function sessionUpdatedAtValueForCloud(session: QuizSession) {
  const values = [
    session.startedAt,
    session.completedAt,
    ...session.attempts.map((attempt) => attempt.answeredAt)
  ].filter((value): value is string => Boolean(value));

  return values.sort().at(-1) ?? new Date().toISOString();
}

function calculateAverageConfidence(attempts: Attempt[]) {
  if (attempts.length === 0) return null;
  const average = attempts.reduce((sum, attempt) => sum + attempt.confidence, 0) / attempts.length;
  return Math.round(average * 100) / 100;
}

function compactQuestionForCloud(question: Question): Question {
  return compactQuestionForStorage(question);
}

function buildSessionPayloadForCloud(
  session: QuizSession,
  options: { includeAttempts?: boolean } = {}
): Partial<QuizSession> {
  const compacted = compactSessionForStorage(session);
  const generatedQuestions = (compacted.generatedQuestions ?? []).map(compactQuestionForCloud);
  const includeAttempts = options.includeAttempts ?? true;
  const shouldRetainGeneratedQuestions =
    generatedQuestions.length > 0 &&
    (session.settings?.mode === "custom_paper" ||
      session.settings?.mode === "simulation" ||
      generatedQuestions.some((question) => question.sourceType !== "MOEX_PAST_EXAM"));

  return {
    settings: compacted.settings,
    questionOrder: compacted.questionOrder,
    optionEliminationMap: compacted.optionEliminationMap,
    simulationElapsedSeconds: compacted.simulationElapsedSeconds,
    simulationTimerDurationSeconds: compacted.simulationTimerDurationSeconds,
    generatedQuestions: shouldRetainGeneratedQuestions ? generatedQuestions : undefined,
    currentQuestionIndex: session.completedAt ? undefined : compacted.currentQuestionIndex,
    isReviewingAnswer: session.completedAt ? undefined : compacted.isReviewingAnswer,
    attempts: includeAttempts && compacted.attempts.length > 0 ? compacted.attempts : undefined
  };
}

function buildSessionRowForCloud(
  userId: string,
  session: QuizSession,
  options: { includeAttemptsInPayload?: boolean } = {}
): QuizSessionRow {
  const correctCount = session.attempts.filter((attempt) => attempt.isCorrect).length;
  const wrongCount = session.attempts.length - correctCount;
  const includeAttemptsInPayload =
    options.includeAttemptsInPayload ?? Boolean(session.completedAt);

  return {
    id: session.id,
    user_id: userId,
    subject: session.subject,
    mode: session.settings?.mode ?? null,
    session_name:
      session.settings?.sessionName ??
      session.settings?.customPaperName ??
      session.settings?.customPoolLabel ??
      null,
    question_count: session.questionOrder?.length ?? session.generatedQuestions?.length ?? session.attempts.length,
    correct_count: correctCount,
    wrong_count: wrongCount,
    average_confidence: calculateAverageConfidence(session.attempts),
    started_at: session.startedAt,
    completed_at: session.completedAt ?? null,
    updated_at: sessionUpdatedAtValueForCloud(session),
    session_payload: buildSessionPayloadForCloud(session, {
      includeAttempts: includeAttemptsInPayload
    })
  };
}

function mapAttemptToCloudRow(userId: string, session: QuizSession, attempt: Attempt, index: number): QuizSessionAttemptRow {
  const generatedQuestion =
    session.generatedQuestions?.find((question) => question.id === attempt.questionId) ?? null;

  return {
    session_id: session.id,
    user_id: userId,
    question_order: index,
    question_id: attempt.questionId,
    selected_answer: attempt.selectedAnswer,
    correct_answer: attempt.correctAnswer,
    is_correct: attempt.isCorrect,
    confidence: attempt.confidence,
    error_type: attempt.errorType ?? null,
    answered_at: attempt.answeredAt,
    source_mode: session.settings?.mode ?? null,
    subject_snapshot: generatedQuestion?.subject ?? null,
    chapter_snapshot: generatedQuestion?.chapter ?? null,
    section_snapshot: generatedQuestion?.section ?? null
  };
}

function dedupeSessionRows(rows: QuizSessionRow[]) {
  const deduped = new Map<string, QuizSessionRow>();
  for (const row of rows) deduped.set(row.id, row);
  return Array.from(deduped.values());
}

function dedupeSessionAttemptRows(rows: QuizSessionAttemptRow[]) {
  const deduped = new Map<string, QuizSessionAttemptRow>();
  for (const row of rows) deduped.set(`${row.session_id}::${row.question_order}`, row);
  return Array.from(deduped.values());
}

function getAttemptRowUploadSignature(row: QuizSessionAttemptRow) {
  return [
    row.question_id,
    row.selected_answer,
    row.correct_answer,
    row.is_correct ? "1" : "0",
    row.confidence,
    row.error_type ?? "",
    row.answered_at,
    row.source_mode ?? "",
    row.subject_snapshot ?? "",
    row.chapter_snapshot ?? "",
    row.section_snapshot ?? ""
  ].join("|");
}

async function fetchExistingAttemptSignatureMap(
  supabase: ServiceSupabaseClient,
  userId: string,
  sessionIds: string[]
) {
  if (sessionIds.length === 0) return new Map<string, string>();

  const { data, error } = await supabase
    .from("quiz_session_attempts")
    .select(
      "session_id, question_order, question_id, selected_answer, correct_answer, is_correct, confidence, error_type, answered_at"
    )
    .eq("user_id", userId)
    .in("session_id", sessionIds);

  if (error) throw error;

  return new Map(
    ((data ?? []) as QuizSessionAttemptRow[]).map((row) => [
      `${row.session_id}::${row.question_order}`,
      getAttemptRowUploadSignature(row)
    ])
  );
}

function formatError(error: unknown) {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  const message =
    error instanceof Error && error.message.trim()
      ? error.message.trim()
      : typeof error === "object" && error && "message" in error
        ? String((error as { message?: unknown }).message ?? "")
        : "";

  if (code === "42P01") {
    return "雲端作答紀錄資料表尚未建立完整，請先套用資料庫 migration。";
  }

  return message || "作答紀錄雲端同步失敗。";
}

async function getAuthedUser(request: NextRequest, supabase: ServiceSupabaseClient) {
  const accessToken = getBearerToken(request);
  if (!accessToken) {
    return { userId: "", error: NextResponse.json({ ok: false, message: "請先登入。" }, { status: 401 }) };
  }

  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user?.id) {
    return { userId: "", error: NextResponse.json({ ok: false, message: "登入驗證失敗。" }, { status: 401 }) };
  }

  return { userId: data.user.id, error: null };
}

export async function POST(request: NextRequest) {
  if (isSupabaseRecoveryMode()) {
    return NextResponse.json(
      { ok: false, message: "雲端同步暫時維護中，先保存在本機。" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  const supabase = getServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, message: "Supabase 尚未設定，作答紀錄會先留在本機。" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }

  const { userId, error } = await getAuthedUser(request, supabase);
  if (error) return error;

  try {
    const body = (await request.json().catch(() => null)) as QuizSessionSyncRequestBody | null;
    const inputSessions = Array.isArray(body?.sessions) ? body.sessions.slice(0, MAX_SYNC_SESSIONS) : [];
    const sessions = canonicalizeSessionsForUser(userId, normalizeSessions(inputSessions as QuizSession[]));
    const attemptCount = sessions.reduce((sum, session) => sum + session.attempts.length, 0);

    if (sessions.length === 0) {
      return NextResponse.json(
        { ok: false, message: "沒有可同步的作答紀錄。" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (attemptCount > MAX_SYNC_ATTEMPTS) {
      return NextResponse.json(
        { ok: false, message: "單次同步紀錄過多，會保留在本機分批補傳。" },
        { status: 413, headers: { "Cache-Control": "no-store" } }
      );
    }

    const activeCheckpoint = body?.activeCheckpoint === true;
    const rows = dedupeSessionRows(
      sessions.map((session) =>
        buildSessionRowForCloud(userId, session, {
          includeAttemptsInPayload: !activeCheckpoint || Boolean(session.completedAt)
        })
      )
    );
    const incompleteSessionIds = rows
      .filter((row) => !isCompletedQuizSessionRow(row))
      .map((row) => row.id);
    const protectedCompletedSessionIds = new Set<string>();

    if (incompleteSessionIds.length > 0) {
      const { data, error: existingError } = await supabase
        .from("quiz_sessions")
        .select("id, completed_at, session_payload")
        .eq("user_id", userId)
        .in("id", incompleteSessionIds);

      if (existingError) throw existingError;

      for (const row of (data ?? []) as Pick<QuizSessionRow, "id" | "completed_at" | "session_payload">[]) {
        if (isCompletedQuizSessionRow(row)) {
          protectedCompletedSessionIds.add(row.id);
        }
      }
    }

    const safeSessions = sessions.filter(
      (session) => isCompletedQuizSession(session) || !protectedCompletedSessionIds.has(session.id)
    );
    const safeRows = rows.filter((row) => !protectedCompletedSessionIds.has(row.id));

    if (safeRows.length === 0) {
      return NextResponse.json(
        { ok: true, uploadedSessions: 0, uploadedAttempts: 0 },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const { error: sessionError } = await supabase
      .from("quiz_sessions")
      .upsert(safeRows, { onConflict: "id" });

    if (sessionError) throw sessionError;

    let attemptRows = dedupeSessionAttemptRows(
      safeSessions.flatMap((session) =>
        session.attempts.map((attempt, index) => mapAttemptToCloudRow(userId, session, attempt, index))
      )
    );

    if (attemptRows.length > 0) {
      const existingAttemptSignatures = await fetchExistingAttemptSignatureMap(
        supabase,
        userId,
        Array.from(new Set(attemptRows.map((row) => row.session_id)))
      );
      attemptRows = attemptRows.filter((row) => {
        const existingSignature = existingAttemptSignatures.get(`${row.session_id}::${row.question_order}`);
        return existingSignature !== getAttemptRowUploadSignature(row);
      });
    }

    if (attemptRows.length > 0) {
      const { error: attemptError } = await supabase
        .from("quiz_session_attempts")
        .upsert(attemptRows, { onConflict: "session_id,question_order" });

      if (attemptError) throw attemptError;
    }

    return NextResponse.json(
      { ok: true, uploadedSessions: safeRows.length, uploadedAttempts: attemptRows.length },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (syncError) {
    return NextResponse.json(
      { ok: false, message: formatError(syncError) },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
