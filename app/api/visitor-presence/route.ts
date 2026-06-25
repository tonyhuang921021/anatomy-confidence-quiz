import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isSupabaseRecoveryMode } from "@/lib/supabase/recoveryMode";
import { isServerTimeoutError, withServerTimeout } from "@/lib/serverTimeout";

type VisitorPresenceBody = {
  visitorId?: string | null;
  accessToken?: string | null;
};

const VISITOR_PRESENCE_TIMEOUT_MS = 1200;
const VISITOR_AUTH_TIMEOUT_MS = 1000;

type PresenceUser = {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

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

function getDisplayName(user: PresenceUser) {
  const displayName =
    typeof user.user_metadata?.display_name === "string" ? user.user_metadata.display_name.trim() : "";
  if (displayName) return displayName.slice(0, 24);
  return (user.email?.split("@")[0] || "已登入同學").slice(0, 24);
}

async function upsertVisitorPresence(
  supabase: ReturnType<typeof getServiceSupabaseClient>,
  payload: {
    visitorId: string;
    userId: string;
    displayName: string;
    email?: string | null;
  }
) {
  if (!supabase) throw new Error("visitor-presence-unavailable");

  const rowWithIdentity = {
    visitor_id: payload.visitorId,
    user_id: payload.userId,
    display_name: payload.displayName,
    email: payload.email ?? null,
    last_seen_at: new Date().toISOString()
  };

  const result = await withServerTimeout(
    supabase.from("site_visitors").upsert(rowWithIdentity, { onConflict: "visitor_id" }),
    VISITOR_PRESENCE_TIMEOUT_MS,
    "訪客狀態同步逾時"
  );

  if (!result.error) return;
  const message = result.error.message || "";
  if (!/display_name|email|column|schema cache/i.test(message)) {
    throw result.error;
  }

  const fallbackResult = await withServerTimeout(
    supabase.from("site_visitors").upsert(
      {
        visitor_id: payload.visitorId,
        user_id: payload.userId,
        last_seen_at: new Date().toISOString()
      },
      { onConflict: "visitor_id" }
    ),
    VISITOR_PRESENCE_TIMEOUT_MS,
    "訪客狀態同步逾時"
  );

  if (fallbackResult.error) throw fallbackResult.error;
}

export async function POST(request: NextRequest) {
  if (isSupabaseRecoveryMode()) {
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  }

  const supabase = getServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, message: "visitor-presence-unavailable" }, { status: 503 });
  }

  try {
    const body = (await request.json().catch(() => null)) as VisitorPresenceBody | null;
    const visitorId = body?.visitorId?.trim();

    if (!visitorId) {
      return NextResponse.json({ ok: false, message: "missing-visitor-id" }, { status: 400 });
    }

    const accessToken = body?.accessToken?.trim();
    if (!accessToken) {
      return NextResponse.json({ ok: true, skipped: true }, { headers: { "Cache-Control": "no-store" } });
    }

    const {
      data: { user },
      error: authError
    } = await withServerTimeout(
      supabase.auth.getUser(accessToken),
      VISITOR_AUTH_TIMEOUT_MS,
      "登入狀態驗證逾時"
    );

    if (authError || !user?.id) {
      return NextResponse.json({ ok: true, skipped: true }, { headers: { "Cache-Control": "no-store" } });
    }

    await upsertVisitorPresence(supabase, {
      visitorId,
      userId: user.id,
      displayName: getDisplayName({
        id: user.id,
        email: user.email,
        user_metadata: user.user_metadata
      }),
      email: user.email
    });

    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "visitor-presence-failed";
    if (
      isServerTimeoutError(error) ||
      /timeout|timed out|terminated|connection/i.test(message)
    ) {
      return NextResponse.json(
        { ok: true, degraded: true, message },
        { headers: { "Cache-Control": "no-store" } }
      );
    }
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
