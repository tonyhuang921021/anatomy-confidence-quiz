import { readFile } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isSupabaseRecoveryMode } from "@/lib/supabase/recoveryMode";

type BiochemistryReviewRequestBody = {
  accessToken?: string;
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

async function requireAdminAccess(accessToken?: string) {
  if (!accessToken) {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, message: "請先登入。" }, { status: 401 })
    };
  }

  const supabase = getServiceSupabaseClient();
  if (!supabase) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, message: "SUPABASE_SERVICE_ROLE_KEY 尚未設定，無法讀取私有資料。" },
        { status: 503 }
      )
    };
  }

  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user?.email) {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, message: "登入驗證失敗。" }, { status: 401 })
    };
  }

  if (!isAllowedEmail(data.user.email)) {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, message: "你沒有查看私有資料的權限。" }, { status: 403 })
    };
  }

  return { ok: true as const };
}

export async function POST(request: NextRequest) {
  if (isSupabaseRecoveryMode()) {
    return NextResponse.json(
      { ok: false, message: "Supabase recovery mode 開啟中，私有資料暫停讀取。" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  const body = (await request.json().catch(() => null)) as BiochemistryReviewRequestBody | null;
  const access = await requireAdminAccess(body?.accessToken);
  if (!access.ok) {
    return access.response;
  }

  const htmlPath = path.join(
    process.cwd(),
    "data",
    "owner",
    "biochemistry_interactive_master_index_v18.html"
  );
  const html = await readFile(htmlPath, "utf8");

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/html; charset=utf-8"
    }
  });
}
