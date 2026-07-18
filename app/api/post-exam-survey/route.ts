import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  POST_EXAM_PREVIEW_EMAIL,
  POST_EXAM_SURVEY_ID,
  hasPostExamSurveyErrors,
  validatePostExamSurveyAnswers
} from "@/lib/postExamReflection";
import { withServerTimeout } from "@/lib/serverTimeout";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store, max-age=0" };
const SURVEY_SELECT_FIELDS =
  "public_alias, med1_score, med2_score, share_scores, study_reflection, encouragement, submitted_at, updated_at";

function getServiceSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

function getBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization") ?? "";
  return authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ?? "";
}

async function verifyPreviewUser(supabase: any, request: NextRequest) {
  const token = getBearerToken(request);
  if (!token) return null;
  const { data, error } = (await withServerTimeout(
    supabase.auth.getUser(token),
    1800,
    "登入狀態驗證逾時"
  )) as {
    data?: { user?: { id?: string; email?: string | null } | null };
    error?: unknown;
  };
  const email = data?.user?.email?.trim().toLowerCase() ?? "";
  if (error || !data?.user?.id || email !== POST_EXAM_PREVIEW_EMAIL.toLowerCase()) {
    return null;
  }
  return { id: data.user.id };
}

function sanitizeClientMeta(input: unknown) {
  const meta = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const viewport =
    meta.viewport && typeof meta.viewport === "object"
      ? (meta.viewport as Record<string, unknown>)
      : {};
  const width = Number(viewport.width);
  const height = Number(viewport.height);
  return {
    previewVersion: "post-exam-2026-v1",
    pagePath: "/post-exam-preview",
    viewport:
      Number.isFinite(width) && Number.isFinite(height)
        ? {
            width: Math.max(0, Math.min(Math.round(width), 10000)),
            height: Math.max(0, Math.min(Math.round(height), 10000))
          }
        : null
  };
}

function mapRowToAnswers(row: Record<string, unknown>) {
  return {
    publicAlias: typeof row.public_alias === "string" ? row.public_alias : "",
    med1Score: typeof row.med1_score === "number" ? row.med1_score : null,
    med2Score: typeof row.med2_score === "number" ? row.med2_score : null,
    shareScores: row.share_scores !== false,
    studyReflection: typeof row.study_reflection === "string" ? row.study_reflection : "",
    encouragement: typeof row.encouragement === "string" ? row.encouragement : ""
  };
}

function errorResponse(error: unknown) {
  console.warn("[post-exam-survey] failed", error);
  const message = error instanceof Error ? error.message : "";
  const missingTable =
    message.includes("post_exam_survey_responses") &&
    /does not exist|schema cache|Could not find/i.test(message);
  return NextResponse.json(
    {
      ok: false,
      message: missingTable
        ? "考後問卷資料表尚未建立，內容會先保留在本機。"
        : "問卷暫時無法連線，內容已保留在本機。"
    },
    { status: 503, headers: NO_STORE_HEADERS }
  );
}

function isUniqueViolation(error: unknown) {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: unknown }).code === "23505"
  );
}

export async function GET(request: NextRequest) {
  const supabase = getServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, message: "考後問卷後端尚未設定。" },
      { status: 503, headers: NO_STORE_HEADERS }
    );
  }

  try {
    const user = await verifyPreviewUser(supabase, request);
    if (!user) {
      return NextResponse.json(
        { ok: false, message: "此預覽目前只開放指定管理員帳號。" },
        { status: 403, headers: NO_STORE_HEADERS }
      );
    }
    const { data, error } = (await withServerTimeout(
      supabase
        .from("post_exam_survey_responses")
        .select(SURVEY_SELECT_FIELDS)
        .eq("survey_id", POST_EXAM_SURVEY_ID)
        .eq("user_id", user.id)
        .maybeSingle(),
      1800,
      "考後問卷讀取逾時"
    )) as { data?: Record<string, unknown> | null; error?: unknown };
    if (error) throw error;
    return NextResponse.json(
      {
        ok: true,
        submitted: Boolean(data),
        answers: data ? mapRowToAnswers(data) : null,
        submittedAt: data?.submitted_at ?? null,
        updatedAt: data?.updated_at ?? null
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  const supabase = getServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, message: "考後問卷後端尚未設定。" },
      { status: 503, headers: NO_STORE_HEADERS }
    );
  }

  try {
    const user = await verifyPreviewUser(supabase, request);
    if (!user) {
      return NextResponse.json(
        { ok: false, message: "此預覽目前只開放指定管理員帳號。" },
        { status: 403, headers: NO_STORE_HEADERS }
      );
    }
    const body = (await request.json().catch(() => ({}))) as {
      answers?: unknown;
      clientMeta?: unknown;
    };
    const validation = validatePostExamSurveyAnswers(body.answers);
    if (hasPostExamSurveyErrors(validation)) {
      return NextResponse.json(
        { ok: false, message: "請先修正問卷欄位。", errors: validation.errors },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const now = new Date().toISOString();
    const answers = validation.data;
    const submission = {
      survey_id: POST_EXAM_SURVEY_ID,
      user_id: user.id,
      public_alias: answers.publicAlias,
      disclose_scores: true,
      med1_score: answers.med1Score,
      med2_score: answers.med2Score,
      share_scores: answers.shareScores,
      study_reflection: answers.studyReflection,
      encouragement: answers.encouragement,
      client_meta: sanitizeClientMeta(body.clientMeta),
      submitted_at: now,
      updated_at: now
    };
    const { data, error } = (await withServerTimeout(
      supabase
        .from("post_exam_survey_responses")
        .insert(submission)
        .select(SURVEY_SELECT_FIELDS)
        .single(),
      2200,
      "考後問卷儲存逾時"
    )) as { data?: Record<string, unknown> | null; error?: unknown };
    if (error && !isUniqueViolation(error)) throw error;

    if (isUniqueViolation(error)) {
      const { data: existing, error: existingError } = (await withServerTimeout(
        supabase
          .from("post_exam_survey_responses")
          .select(SURVEY_SELECT_FIELDS)
          .eq("survey_id", POST_EXAM_SURVEY_ID)
          .eq("user_id", user.id)
          .single(),
        1800,
        "既有考後問卷讀取逾時"
      )) as { data?: Record<string, unknown> | null; error?: unknown };
      if (existingError || !existing) throw existingError ?? new Error("找不到既有問卷回覆");
      return NextResponse.json(
        {
          ok: true,
          submitted: true,
          alreadySubmitted: true,
          answers: mapRowToAnswers(existing),
          submittedAt: existing.submitted_at ?? null,
          updatedAt: existing.updated_at ?? null
        },
        { headers: NO_STORE_HEADERS }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        submitted: true,
        alreadySubmitted: false,
        answers: data ? mapRowToAnswers(data) : answers,
        submittedAt: data?.submitted_at ?? now,
        updatedAt: data?.updated_at ?? now
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    return errorResponse(error);
  }
}
