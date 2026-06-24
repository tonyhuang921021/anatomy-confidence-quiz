import { NextRequest, NextResponse } from "next/server";
import { isSupabaseRecoveryMode } from "@/lib/supabase/recoveryMode";
import { withServerTimeout } from "@/lib/serverTimeout";
import { getResourceAccessToken, getResourceShareServiceClient, getVerifiedResourceUser } from "../shared";

export async function POST(request: NextRequest) {
  if (isSupabaseRecoveryMode()) {
    return NextResponse.json({ ok: false, error: "資源互動暫時整理中。" }, { status: 503 });
  }

  const supabase = getResourceShareServiceClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase 尚未設定。" }, { status: 500 });
  }

  try {
    const body = (await request.json().catch(() => null)) as {
      accessToken?: string;
      resourceId?: string;
      liked?: boolean;
    } | null;
    const accessToken = getResourceAccessToken(request, typeof body?.accessToken === "string" ? body.accessToken : "");
    const resourceId = typeof body?.resourceId === "string" ? body.resourceId.trim() : "";
    const liked = Boolean(body?.liked);
    const verifiedUser = await getVerifiedResourceUser(supabase, accessToken);

    if (!verifiedUser) {
      return NextResponse.json({ ok: false, error: "請先登入。" }, { status: 401 });
    }
    if (!resourceId) {
      return NextResponse.json({ ok: false, error: "缺少資源 ID。" }, { status: 400 });
    }

    const { data: exists } = (await withServerTimeout(
      supabase.from("resource_shares").select("id").eq("id", resourceId).maybeSingle(),
      1800,
      "資源確認逾時"
    )) as { data?: { id?: string } | null };
    if (!exists?.id) {
      return NextResponse.json({ ok: false, error: "找不到這份資源。" }, { status: 404 });
    }

    if (liked) {
      const { error } = await withServerTimeout(
        supabase
          .from("resource_share_likes")
          .upsert(
            { resource_id: resourceId, user_id: verifiedUser.id },
            { onConflict: "resource_id,user_id", ignoreDuplicates: true }
          ),
        2500,
        "按讚寫入逾時"
      );
      if (error) throw error;
    } else {
      const { error } = await withServerTimeout(
        supabase
          .from("resource_share_likes")
          .delete()
          .eq("resource_id", resourceId)
          .eq("user_id", verifiedUser.id),
        2500,
        "取消按讚逾時"
      );
      if (error) throw error;
    }

    const { data: likes } = (await withServerTimeout(
      supabase.from("resource_share_likes").select("user_id").eq("resource_id", resourceId).limit(1000),
      2000,
      "按讚統計逾時"
    )) as { data?: Array<{ user_id: string }> | null };

    return NextResponse.json({
      ok: true,
      resourceId,
      likeCount: likes?.length ?? 0,
      myLiked: Boolean(likes?.some((like) => like.user_id === verifiedUser.id)),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "按讚更新失敗";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
