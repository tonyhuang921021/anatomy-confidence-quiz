import { NextRequest, NextResponse } from "next/server";
import { isSupabaseRecoveryMode } from "@/lib/supabase/recoveryMode";
import { withServerTimeout } from "@/lib/serverTimeout";
import { getResourceAccessToken, getResourceShareServiceClient, getVerifiedResourceUser, mapResourceShareComment } from "../shared";

export async function POST(request: NextRequest) {
  if (isSupabaseRecoveryMode()) {
    return NextResponse.json({ ok: false, error: "資源留言暫時整理中。" }, { status: 503 });
  }

  const supabase = getResourceShareServiceClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase 尚未設定。" }, { status: 500 });
  }

  try {
    const body = (await request.json().catch(() => null)) as {
      accessToken?: string;
      resourceId?: string;
      content?: string;
    } | null;
    const accessToken = getResourceAccessToken(request, typeof body?.accessToken === "string" ? body.accessToken : "");
    const resourceId = typeof body?.resourceId === "string" ? body.resourceId.trim() : "";
    const content = typeof body?.content === "string" ? body.content.trim().slice(0, 1000) : "";
    const verifiedUser = await getVerifiedResourceUser(supabase, accessToken);

    if (!verifiedUser) {
      return NextResponse.json({ ok: false, error: "請先登入。" }, { status: 401 });
    }
    if (!resourceId) {
      return NextResponse.json({ ok: false, error: "缺少資源 ID。" }, { status: 400 });
    }
    if (!content) {
      return NextResponse.json({ ok: false, error: "留言不能是空的。" }, { status: 400 });
    }

    const { data: exists } = (await withServerTimeout(
      supabase.from("resource_shares").select("id").eq("id", resourceId).maybeSingle(),
      1800,
      "資源確認逾時"
    )) as { data?: { id?: string } | null };
    if (!exists?.id) {
      return NextResponse.json({ ok: false, error: "找不到這份資源。" }, { status: 404 });
    }

    const { data: inserted, error } = (await withServerTimeout(
      supabase
        .from("resource_share_comments")
        .insert({
          resource_id: resourceId,
          content,
          author_label: verifiedUser.label,
          author_email: verifiedUser.email ?? null,
          user_id: verifiedUser.id,
        })
        .select("id, resource_id, content, author_label, author_email, created_at")
        .single(),
      2800,
      "留言寫入逾時"
    )) as { data?: any | null; error?: unknown };

    if (error || !inserted) throw error ?? new Error("留言寫入失敗");

    return NextResponse.json({ ok: true, comment: mapResourceShareComment(inserted) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "留言送出失敗";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
