import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  POST_EXAM_CUTOFF_AT,
  POST_EXAM_SNAPSHOT_VERSION,
  buildPostExamPersonalSnapshot,
  getPostExamTotalAttempts,
  isPostExamSnapshotEligible,
  mergePostExamSnapshotWithLocal,
  normalizePostExamPersonalSnapshot,
  type PostExamPersonalSnapshot
} from "@/lib/postExamReflection";
import { withServerTimeout } from "@/lib/serverTimeout";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type VerifiedPostExamUser = {
  id: string;
  email: string;
};

type SnapshotRow = {
  snapshot?: unknown;
};

type RollupRow = {
  session_id: string;
  mode: string | null;
  attempts: number | null;
  correct_attempts: number | null;
  completed_at: string | null;
};

const ROLLUP_PAGE_SIZE = 1000;
const MAX_ROLLUP_PAGES = 20;
const MAX_LOCAL_SESSION_ROWS = 2500;
const NO_STORE_HEADERS = { "Cache-Control": "private, no-store, max-age=0" };

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
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? "";
}

async function verifySignedInUser(supabase: any, request: NextRequest) {
  const accessToken = getBearerToken(request);
  if (!accessToken) return null;
  const { data, error } = (await withServerTimeout(
    supabase.auth.getUser(accessToken),
    1800,
    "登入狀態驗證逾時"
  )) as {
    data?: { user?: { id?: string; email?: string | null } | null };
    error?: unknown;
  };
  const email = data?.user?.email?.trim().toLowerCase() ?? "";
  if (error || !data?.user?.id || !email) {
    return null;
  }
  return { id: data.user.id, email } satisfies VerifiedPostExamUser;
}

async function readStoredSnapshot(supabase: any, userId: string) {
  const { data, error } = (await withServerTimeout(
    supabase
      .from("post_exam_recap_snapshots")
      .select("snapshot")
      .eq("user_id", userId)
      .eq("snapshot_version", POST_EXAM_SNAPSHOT_VERSION)
      .maybeSingle(),
    1800,
    "考後快照讀取逾時"
  )) as { data?: SnapshotRow | null; error?: unknown };
  if (error) throw error;
  return normalizePostExamPersonalSnapshot(data?.snapshot);
}

async function fetchRollups(supabase: any, userId: string) {
  const rows: RollupRow[] = [];
  for (let pageIndex = 0; pageIndex < MAX_ROLLUP_PAGES; pageIndex += 1) {
    const from = pageIndex * ROLLUP_PAGE_SIZE;
    const { data, error } = (await withServerTimeout(
      supabase
        .from("leaderboard_session_rollups")
        .select("session_id, mode, attempts, correct_attempts, completed_at")
        .eq("user_id", userId)
        .not("completed_at", "is", null)
        .lte("completed_at", POST_EXAM_CUTOFF_AT)
        .order("completed_at", { ascending: true })
        .range(from, from + ROLLUP_PAGE_SIZE - 1),
      3500,
      "個人作答快照讀取逾時"
    )) as { data?: RollupRow[]; error?: unknown };
    if (error) throw error;
    const page = data ?? [];
    rows.push(...page);
    if (page.length < ROLLUP_PAGE_SIZE) return rows;
  }
  throw new Error("個人作答回合超過快照安全上限，請由管理員分批建立。");
}

async function fetchSimulationRows(supabase: any, userId: string) {
  const { data, error } = (await withServerTimeout(
    supabase.rpc("get_post_exam_simulation_rows", {
      p_user_id: userId,
      p_cutoff: POST_EXAM_CUTOFF_AT
    }),
    3500,
    "模擬考快照讀取逾時"
  )) as { data?: unknown[]; error?: unknown };
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

async function persistSnapshot(
  supabase: any,
  userId: string,
  snapshot: PostExamPersonalSnapshot
) {
  const { error } = (await withServerTimeout(
    supabase.from("post_exam_recap_snapshots").upsert(
      {
        user_id: userId,
        snapshot_version: POST_EXAM_SNAPSHOT_VERSION,
        cutoff_at: POST_EXAM_CUTOFF_AT,
        snapshot,
        generated_at: snapshot.generatedAt,
        updated_at: new Date().toISOString()
      },
      { onConflict: "user_id,snapshot_version" }
    ),
    2200,
    "考後快照儲存逾時"
  )) as { error?: unknown };
  if (error) throw error;
}

async function getOrCreateSnapshot(supabase: any, userId: string) {
  const stored = await readStoredSnapshot(supabase, userId);
  if (stored) return { snapshot: stored, source: "stored" as const };

  const sessionRows = await fetchRollups(supabase, userId);
  const simulationRows = await fetchSimulationRows(supabase, userId);
  const snapshot = buildPostExamPersonalSnapshot(sessionRows, simulationRows);
  await persistSnapshot(supabase, userId, snapshot);
  return { snapshot, source: "generated" as const };
}

function errorResponse(error: unknown) {
  console.warn("[post-exam-recap] failed", error);
  const message = error instanceof Error ? error.message : "考後回顧暫時無法載入。";
  const migrationMissing =
    /post_exam_recap_snapshots|get_post_exam_simulation_rows/.test(message) &&
    /does not exist|schema cache|Could not find/i.test(message);
  return NextResponse.json(
    {
      ok: false,
      message: migrationMissing
        ? "考後回顧資料表尚未建立，請先套用考後回顧 migration。"
        : "考後回顧暫時無法載入，本機紀錄沒有被修改。"
    },
    { status: 503, headers: NO_STORE_HEADERS }
  );
}

export async function GET(request: NextRequest) {
  const supabase = getServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, message: "考後回顧後端尚未設定。" },
      { status: 503, headers: NO_STORE_HEADERS }
    );
  }

  try {
    const user = await verifySignedInUser(supabase, request);
    if (!user) {
      return NextResponse.json(
        { ok: false, message: "請先登入後再查看考後回顧。" },
        { status: 401, headers: NO_STORE_HEADERS }
      );
    }
    const result = await getOrCreateSnapshot(supabase, user.id);
    return NextResponse.json(
      {
        ok: true,
        ...result,
        eligible: isPostExamSnapshotEligible(result.snapshot),
        totalAttempts: getPostExamTotalAttempts(result.snapshot.sessions)
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
      { ok: false, message: "考後回顧後端尚未設定。" },
      { status: 503, headers: NO_STORE_HEADERS }
    );
  }

  try {
    const user = await verifySignedInUser(supabase, request);
    if (!user) {
      return NextResponse.json(
        { ok: false, message: "請先登入後再查看考後回顧。" },
        { status: 401, headers: NO_STORE_HEADERS }
      );
    }
    const body = (await request.json().catch(() => ({}))) as {
      sessions?: unknown;
      simulations?: unknown;
    };
    const localSessions = Array.isArray(body.sessions)
      ? body.sessions.slice(0, MAX_LOCAL_SESSION_ROWS)
      : [];
    const localSimulations = Array.isArray(body.simulations)
      ? body.simulations.slice(0, MAX_LOCAL_SESSION_ROWS)
      : [];
    const current = await getOrCreateSnapshot(supabase, user.id);
    const snapshot = mergePostExamSnapshotWithLocal(current.snapshot, {
      sessions: localSessions as PostExamPersonalSnapshot["sessions"],
      simulations: localSimulations as PostExamPersonalSnapshot["simulations"]
    });
    const addedSessions = snapshot.sessions.length - current.snapshot.sessions.length;
    const addedSimulations = snapshot.simulations.length - current.snapshot.simulations.length;
    if (addedSessions > 0 || addedSimulations > 0) {
      await persistSnapshot(supabase, user.id, snapshot);
    }
    return NextResponse.json(
      {
        ok: true,
        snapshot,
        addedSessions,
        addedSimulations,
        eligible: isPostExamSnapshotEligible(snapshot),
        totalAttempts: getPostExamTotalAttempts(snapshot.sessions)
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    return errorResponse(error);
  }
}
