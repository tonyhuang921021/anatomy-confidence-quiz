import { NextRequest, NextResponse } from "next/server";
import {
  getServiceSupabaseClient,
  loadOpenAIBudgetStatus,
  saveOpenAIBudgetUsd
} from "@/lib/openaiBudget";
import { isSupabaseRecoveryMode } from "@/lib/supabase/recoveryMode";

type BudgetRequestBody = {
  accessToken?: string;
  budgetUsd?: number;
  usedUsd?: number;
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

export async function GET(request: NextRequest) {
  try {
    const includeLiveCosts = request.nextUrl.searchParams.get("live") !== "false";
    const budget = await loadOpenAIBudgetStatus({ includeLiveCosts });
    const response = NextResponse.json({ ok: true, budget });
    if (!includeLiveCosts) {
      response.headers.set("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
    }
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI 補強基金狀態讀取失敗";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (isSupabaseRecoveryMode()) {
    return NextResponse.json(
      { ok: false, message: "Supabase recovery mode 開啟中，暫時無法更新 AI 補強基金預算。" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  const supabase = getServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, message: "SUPABASE_SERVICE_ROLE_KEY 尚未設定，無法儲存 AI 補強基金預算。" },
      { status: 503 }
    );
  }

  try {
    const body = (await request.json().catch(() => null)) as BudgetRequestBody | null;
    if (!body?.accessToken) {
      return NextResponse.json({ ok: false, message: "請先登入。" }, { status: 401 });
    }

    const { data, error } = await supabase.auth.getUser(body.accessToken);
    if (error || !data.user?.email) {
      return NextResponse.json({ ok: false, message: "登入驗證失敗。" }, { status: 401 });
    }

    if (!isAllowedEmail(data.user.email)) {
      return NextResponse.json({ ok: false, message: "你沒有更新 AI 補強基金預算的權限。" }, { status: 403 });
    }

    const budgetUsd = Number(body.budgetUsd);
    if (!Number.isFinite(budgetUsd) || budgetUsd < 0 || budgetUsd > 10000) {
      return NextResponse.json({ ok: false, message: "預算需介於 0 到 10000 美元。" }, { status: 400 });
    }

    const usedUsd = Number(body.usedUsd ?? 0);
    if (!Number.isFinite(usedUsd) || usedUsd < 0 || usedUsd > 10000) {
      return NextResponse.json({ ok: false, message: "已使用金額需介於 0 到 10000 美元。" }, { status: 400 });
    }

    await saveOpenAIBudgetUsd(budgetUsd, usedUsd, supabase);
    const budget = await loadOpenAIBudgetStatus({ includeLiveCosts: false });
    return NextResponse.json({ ok: true, budget });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI 補強基金預算更新失敗";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
