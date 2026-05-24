import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { normalizeEmail } from "@/lib/aiAccountBan";

type OwnerAIBanBody = {
  accessToken?: string;
  userEmail?: string;
  action?: "ban_one_hour" | "unban";
};

function getAllowedEmails() {
  return (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function isAllowedEmail(email?: string | null) {
  if (!email) return false;
  return getAllowedEmails().includes(email.trim().toLowerCase());
}

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
    return NextResponse.json(
      { ok: false, message: "SUPABASE_SERVICE_ROLE_KEY 尚未設定，暫時無法管理 AI 冷凍名單。" },
      { status: 503 }
    );
  }

  try {
    const body = (await request.json().catch(() => null)) as OwnerAIBanBody | null;
    if (!body?.accessToken) {
      return NextResponse.json({ ok: false, message: "請先登入。" }, { status: 401 });
    }

    const { data: userData, error: userError } = await supabase.auth.getUser(body.accessToken);
    if (userError || !userData.user?.email) {
      return NextResponse.json({ ok: false, message: "登入驗證失敗。" }, { status: 401 });
    }

    if (!isAllowedEmail(userData.user.email)) {
      return NextResponse.json({ ok: false, message: "你沒有管理 AI 冷凍名單的權限。" }, { status: 403 });
    }

    const userEmail = normalizeEmail(body.userEmail);
    if (!userEmail) {
      return NextResponse.json({ ok: false, message: "缺少要操作的帳號。" }, { status: 400 });
    }

    const action = body.action ?? "ban_one_hour";

    if (action === "unban") {
      const { error } = await supabase.from("ai_account_bans").delete().eq("user_email", userEmail);
      if (error) throw error;

      return NextResponse.json({
        ok: true,
        action,
        userEmail,
        bannedUntil: null
      });
    }

    const bannedUntil = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const { error } = await supabase.from("ai_account_bans").upsert(
      {
        user_email: userEmail,
        banned_until: bannedUntil,
        reason: "owner_cold_ban_one_hour",
        created_by_email: userData.user.email,
        updated_at: new Date().toISOString()
      },
      { onConflict: "user_email" }
    );

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      action,
      userEmail,
      bannedUntil
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI 冷凍操作失敗";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
