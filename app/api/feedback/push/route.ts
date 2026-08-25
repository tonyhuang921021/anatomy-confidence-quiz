import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  getFeedbackWebPushConfig,
  normalizeFeedbackPushEndpoint,
  parseFeedbackPushSubscription
} from "@/lib/feedbackPush";
import { hashFeedbackPushEndpoint } from "@/lib/feedbackPushServer";
import { withServerTimeout } from "@/lib/serverTimeout";

export const runtime = "nodejs";

const PUSH_CACHE_HEADER = "private, no-store";
const USER_AUTH_TIMEOUT_MS = 4000;
const MAX_SUBSCRIPTIONS_PER_USER = 5;

function response(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": PUSH_CACHE_HEADER }
  });
}

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
  return authorization.toLowerCase().startsWith("bearer ")
    ? authorization.slice(7).trim()
    : "";
}

function isSameOriginRequest(request: NextRequest) {
  const origin = request.headers.get("origin");
  return !origin || origin === request.nextUrl.origin;
}

async function getVerifiedUser(supabase: any, accessToken: string) {
  const { data, error } = (await withServerTimeout(
    supabase.auth.getUser(accessToken),
    USER_AUTH_TIMEOUT_MS,
    "手機推播登入驗證逾時"
  )) as {
    data?: { user?: { id?: string } | null };
    error?: unknown;
  };
  const userId = data?.user?.id;
  if (error || !userId) return null;
  return { id: userId };
}

async function authorizeUser(request: NextRequest) {
  const supabase = getServiceSupabaseClient();
  if (!supabase) return { error: response({ ok: false, message: "手機推播尚未設定。" }, 503) };
  const accessToken = getBearerToken(request);
  if (!accessToken) return { error: response({ ok: false, message: "請先登入。" }, 401) };
  const user = await getVerifiedUser(supabase, accessToken);
  if (!user) return { error: response({ ok: false, message: "登入狀態已失效，請重新登入。" }, 401) };
  return { supabase, user };
}

export async function GET(request: NextRequest) {
  try {
    const authorization = await authorizeUser(request);
    if (authorization.error) return authorization.error;
    const config = getFeedbackWebPushConfig(process.env);
    if (!config) {
      return response({ ok: false, configured: false, message: "手機推播金鑰尚未設定。" }, 503);
    }
    return response({ ok: true, configured: true, publicKey: config.publicKey });
  } catch {
    return response({ ok: false, message: "手機推播暫時無法使用。" }, 503);
  }
}

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return response({ ok: false, message: "手機推播來源驗證失敗。" }, 403);
  }

  try {
    const authorization = await authorizeUser(request);
    if (authorization.error || !authorization.supabase || !authorization.user) {
      return authorization.error;
    }
    if (!getFeedbackWebPushConfig(process.env)) {
      return response({ ok: false, configured: false, message: "手機推播金鑰尚未設定。" }, 503);
    }

    const body = (await request.json().catch(() => null)) as { subscription?: unknown } | null;
    const subscription = parseFeedbackPushSubscription(body?.subscription);
    if (!subscription) {
      return response({ ok: false, message: "手機推播訂閱格式錯誤。" }, 400);
    }

    const endpointHash = hashFeedbackPushEndpoint(subscription.endpoint);
    const existing = await withServerTimeout(
      authorization.supabase
        .from("feedback_push_subscriptions")
        .select("id, user_id, endpoint, p256dh, auth")
        .eq("endpoint_hash", endpointHash)
        .maybeSingle(),
      1200,
      "手機推播訂閱確認逾時"
    );
    if (existing.error) throw existing.error;
    const existingRow = existing.data as {
      user_id?: string;
      endpoint?: string;
      p256dh?: string;
      auth?: string;
    } | null;
    const unchanged =
      existingRow?.user_id === authorization.user.id &&
      existingRow.endpoint === subscription.endpoint &&
      existingRow.p256dh === subscription.keys.p256dh &&
      existingRow.auth === subscription.keys.auth;

    if (!unchanged) {
      const upsert = await withServerTimeout(
        authorization.supabase
          .from("feedback_push_subscriptions")
          .upsert(
            {
              user_id: authorization.user.id,
              endpoint_hash: endpointHash,
              endpoint: subscription.endpoint,
              p256dh: subscription.keys.p256dh,
              auth: subscription.keys.auth,
              updated_at: new Date().toISOString()
            },
            { onConflict: "endpoint_hash" }
          ),
        1600,
        "手機推播訂閱儲存逾時"
      );
      if (upsert.error) throw upsert.error;
    }

    const stale = await withServerTimeout(
      authorization.supabase
        .from("feedback_push_subscriptions")
        .select("id")
        .eq("user_id", authorization.user.id)
        .order("updated_at", { ascending: false })
        .range(MAX_SUBSCRIPTIONS_PER_USER, 49),
      1200,
      "手機推播舊裝置整理逾時"
    );
    if (stale.error) throw stale.error;
    const staleIds = ((stale.data ?? []) as Array<{ id: string | number }>).map((row) => row.id);
    if (staleIds.length > 0) {
      const cleanup = await withServerTimeout(
        authorization.supabase
          .from("feedback_push_subscriptions")
          .delete()
          .in("id", staleIds),
        1200,
        "手機推播舊裝置清理逾時"
      );
      if (cleanup.error) throw cleanup.error;
    }

    return response({ ok: true, subscribed: true, unchanged });
  } catch {
    return response({ ok: false, message: "手機推播訂閱失敗，請稍後再試。" }, 503);
  }
}

export async function DELETE(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return response({ ok: false, message: "手機推播來源驗證失敗。" }, 403);
  }

  try {
    const authorization = await authorizeUser(request);
    if (authorization.error || !authorization.supabase || !authorization.user) {
      return authorization.error;
    }
    const body = (await request.json().catch(() => null)) as { endpoint?: unknown } | null;
    const endpoint = normalizeFeedbackPushEndpoint(body?.endpoint);
    if (!endpoint) return response({ ok: false, message: "手機推播訂閱格式錯誤。" }, 400);

    const deletion = await withServerTimeout(
      authorization.supabase
        .from("feedback_push_subscriptions")
        .delete()
        .eq("user_id", authorization.user.id)
        .eq("endpoint_hash", hashFeedbackPushEndpoint(endpoint)),
      1200,
      "手機推播取消逾時"
    );
    if (deletion.error) throw deletion.error;
    return response({ ok: true, subscribed: false });
  } catch {
    return response({ ok: false, message: "手機推播取消失敗，請稍後再試。" }, 503);
  }
}
