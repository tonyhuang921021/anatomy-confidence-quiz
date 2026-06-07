import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type YangmingModeRequestBody = {
  accessToken?: string | null;
  visitorId?: string | null;
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
  const supabase = getServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, message: "Supabase 尚未設定。" }, { status: 503 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as YangmingModeRequestBody;
    const visitorId = body.visitorId?.trim() || null;
    let userId: string | null = null;
    let userEmail: string | null = null;

    if (!body.accessToken) {
      return NextResponse.json({ ok: false, message: "請先登入。" }, { status: 401 });
    }

    const { data, error: authError } = await supabase.auth.getUser(body.accessToken);
    if (authError || !data.user) {
      return NextResponse.json({ ok: false, message: "登入驗證失敗。" }, { status: 401 });
    }
    userId = data.user.id;
    userEmail = data.user.email ?? null;

    const userAgent = request.headers.get("user-agent")?.slice(0, 500) ?? null;
    const { error } = await supabase.from("yangming_mode_activations").insert({
      user_id: userId,
      user_email: userEmail,
      visitor_id: visitorId,
      user_agent: userAgent
    });

    if (error) {
      throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "啟用紀錄寫入失敗";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
