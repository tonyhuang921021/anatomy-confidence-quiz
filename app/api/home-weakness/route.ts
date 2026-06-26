import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getHomeWeakSectionInsight, type HomeWeakSectionInsight } from "@/lib/homeWeakness";
import { isSupabaseRecoveryMode } from "@/lib/supabase/recoveryMode";
import { withServerTimeout } from "@/lib/serverTimeout";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const HOME_WEAKNESS_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const ACTIVE_USER_WINDOW_MS = 12 * 60 * 60 * 1000;
const HOME_WEAKNESS_CACHE_CONTROL = "private, max-age=1800, stale-while-revalidate=3600";

type WeaknessSnapshot = {
  totalAttempts: number;
  insights: HomeWeakSectionInsight[];
  generatedAt: string;
};

type AttemptRow = {
  question_id: string;
  is_correct: boolean;
  confidence?: number | null;
  answered_at: string;
};

const weaknessCache = new Map<string, WeaknessSnapshot>();

function getServiceSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) return null;

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

function getBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization") ?? "";
  return authorization.toLowerCase().startsWith("bearer ") ? authorization.slice(7).trim() : "";
}

function isFresh(snapshot?: WeaknessSnapshot) {
  if (!snapshot) return false;
  return Date.now() - new Date(snapshot.generatedAt).getTime() < HOME_WEAKNESS_CACHE_TTL_MS;
}

function isRecentlyActive(lastSignInAt?: string | null, latestAttemptAt?: string | null) {
  const cutoff = Date.now() - ACTIVE_USER_WINDOW_MS;
  const signInTime = lastSignInAt ? new Date(lastSignInAt).getTime() : 0;
  const attemptTime = latestAttemptAt ? new Date(latestAttemptAt).getTime() : 0;
  return Math.max(signInTime, attemptTime) >= cutoff;
}

function responseHeaders(cacheControl = HOME_WEAKNESS_CACHE_CONTROL) {
  return {
    "Cache-Control": cacheControl
  };
}

export async function GET(request: NextRequest) {
  if (isSupabaseRecoveryMode()) {
    return NextResponse.json(
      { ok: true, degraded: true, inactive: true, message: "雲端弱點維護中，先用本機紀錄。" },
      { headers: responseHeaders("no-store") }
    );
  }

  const supabase = getServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, message: "SUPABASE_SERVICE_ROLE_KEY 尚未設定，暫時無法載入雲端弱點。" },
      { status: 503, headers: responseHeaders("no-store") }
    );
  }

  const accessToken = getBearerToken(request);
  if (!accessToken) {
    return NextResponse.json(
      { ok: true, inactive: true, message: "尚未登入，先用本機紀錄判讀。" },
      { headers: responseHeaders("no-store") }
    );
  }

  let verifiedUserId = "";

  try {
    const { data: authData, error: authError } = await withServerTimeout(
      supabase.auth.getUser(accessToken),
      1800,
      "雲端弱點登入驗證逾時"
    );
    const user = authData?.user;
    if (authError || !user?.id) {
      return NextResponse.json(
        { ok: true, inactive: true, message: "登入狀態暫時讀不到，先用本機紀錄。" },
        { headers: responseHeaders("no-store") }
      );
    }
    verifiedUserId = user.id;

    const cached = weaknessCache.get(verifiedUserId);
    if (isFresh(cached)) {
      return NextResponse.json(
        { ok: true, cached: true, ...cached },
        { headers: responseHeaders() }
      );
    }

    const { data, error } = await withServerTimeout(
      supabase
        .from("quiz_session_attempts")
        .select("question_id, is_correct, confidence, answered_at")
        .eq("user_id", verifiedUserId)
        .order("answered_at", { ascending: false })
        .limit(500),
      3200,
      "雲端弱點作答紀錄讀取逾時"
    );
    if (error) throw error;

    const rows = (data ?? []) as AttemptRow[];
    const latestAttemptAt = rows[0]?.answered_at ?? null;
    if (!isRecentlyActive(user.last_sign_in_at, latestAttemptAt)) {
      return NextResponse.json(
        { ok: true, inactive: true, message: "最近 12 小時沒有登入或同步，先不重算雲端弱點。" },
        { headers: responseHeaders("no-store") }
      );
    }

    const snapshot: WeaknessSnapshot = {
      ...getHomeWeakSectionInsight(
        rows.map((row) => ({
          questionId: row.question_id,
          isCorrect: row.is_correct,
          confidence: row.confidence
        }))
      ),
      generatedAt: new Date().toISOString()
    };
    weaknessCache.set(verifiedUserId, snapshot);

    return NextResponse.json(
      { ok: true, ...snapshot },
      { headers: responseHeaders() }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "雲端弱點載入失敗";
    const stale = verifiedUserId ? weaknessCache.get(verifiedUserId) : null;
    if (stale) {
      return NextResponse.json(
        { ok: true, degraded: true, message, ...stale },
        { headers: responseHeaders("no-store") }
      );
    }

    return NextResponse.json(
      { ok: true, degraded: true, inactive: true, message },
      { headers: responseHeaders("no-store") }
    );
  }
}
