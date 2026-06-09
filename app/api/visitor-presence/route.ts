import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isSupabaseRecoveryMode } from "@/lib/supabase/recoveryMode";

type VisitorPresenceBody = {
  visitorId?: string | null;
  userId?: string | null;
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

    const { error } = await supabase.from("site_visitors").upsert(
      {
        visitor_id: visitorId,
        user_id: body?.userId?.trim() || null,
        last_seen_at: new Date().toISOString()
      },
      { onConflict: "visitor_id" }
    );

    if (error) throw error;

    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "visitor-presence-failed";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
