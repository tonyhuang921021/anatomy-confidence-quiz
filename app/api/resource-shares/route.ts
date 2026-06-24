import { NextRequest, NextResponse } from "next/server";
import { isSupabaseRecoveryMode } from "@/lib/supabase/recoveryMode";
import { withServerTimeout } from "@/lib/serverTimeout";
import {
  createResourceSignedUrl,
  getResourceAccessToken,
  getResourceShareServiceClient,
  getVerifiedResourceUser,
  mapResourceShare,
  mapResourceShareComment,
} from "./shared";

export async function GET(request: NextRequest) {
  if (isSupabaseRecoveryMode()) {
    return NextResponse.json(
      { ok: false, error: "資源分享暫時整理中，先讓登入與同步恢復。" },
      { status: 503 }
    );
  }

  const supabase = getResourceShareServiceClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase 尚未設定。" }, { status: 500 });
  }

  const accessToken = getResourceAccessToken(request, request.nextUrl.searchParams.get("accessToken"));
  const verifiedUser = await getVerifiedResourceUser(supabase, accessToken);
  if (!verifiedUser) {
    return NextResponse.json({ ok: false, error: "請先登入。" }, { status: 401 });
  }

  const resourceId = request.nextUrl.searchParams.get("resourceId")?.trim();

  try {
    if (resourceId) {
      const { data: row, error } = (await withServerTimeout(
        supabase.from("resource_shares").select("*").eq("id", resourceId).maybeSingle(),
        2500,
        "資源讀取逾時"
      )) as { data?: any | null; error?: unknown };

      if (error) throw error;
      if (!row) {
        return NextResponse.json({ ok: false, error: "找不到這份資源。" }, { status: 404 });
      }

      const [{ data: likes }, { data: comments }] = (await withServerTimeout(
        Promise.all([
          supabase.from("resource_share_likes").select("user_id").eq("resource_id", resourceId).limit(1000),
          supabase
            .from("resource_share_comments")
            .select("id, resource_id, content, author_label, author_email, created_at")
            .eq("resource_id", resourceId)
            .order("created_at", { ascending: true })
            .limit(120),
        ]),
        3500,
        "互動資料讀取逾時"
      )) as [{ data?: any[] | null }, { data?: any[] | null }];

      const signedUrl = await createResourceSignedUrl(supabase, row.file_path);
      const mappedComments = (comments ?? []).map(mapResourceShareComment);
      const likeRows = likes ?? [];
      const resource = mapResourceShare(row, {
        fileUrl: signedUrl,
        likeCount: likeRows.length,
        commentCount: mappedComments.length,
        myLiked: likeRows.some((like) => like.user_id === verifiedUser.id),
        comments: mappedComments,
      });

      return NextResponse.json(
        { ok: true, resource },
        { headers: { "Cache-Control": "private, max-age=30" } }
      );
    }

    const rawLimit = Number(request.nextUrl.searchParams.get("limit") ?? "30");
    const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(60, Math.floor(rawLimit))) : 30;
    const { data: rows, error } = (await withServerTimeout(
      supabase
        .from("resource_shares")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit),
      3000,
      "資源清單讀取逾時"
    )) as { data?: any[] | null; error?: unknown };

    if (error) throw error;
    const resourcesRows = rows ?? [];
    const ids = resourcesRows.map((row) => String(row.id));

    const likeCountMap = new Map<string, number>();
    const commentCountMap = new Map<string, number>();
    const myLikedIds = new Set<string>();

    if (ids.length) {
      const [{ data: likes }, { data: comments }] = (await withServerTimeout(
        Promise.all([
          supabase.from("resource_share_likes").select("resource_id, user_id").in("resource_id", ids).limit(3000),
          supabase.from("resource_share_comments").select("resource_id").in("resource_id", ids).limit(3000),
        ]),
        3500,
        "互動統計讀取逾時"
      )) as [{ data?: any[] | null }, { data?: any[] | null }];

      for (const like of likes ?? []) {
        const id = String(like.resource_id);
        likeCountMap.set(id, (likeCountMap.get(id) ?? 0) + 1);
        if (like.user_id === verifiedUser.id) myLikedIds.add(id);
      }
      for (const comment of comments ?? []) {
        const id = String(comment.resource_id);
        commentCountMap.set(id, (commentCountMap.get(id) ?? 0) + 1);
      }
    }

    const resources = resourcesRows.map((row) =>
      mapResourceShare(row, {
        likeCount: likeCountMap.get(String(row.id)) ?? 0,
        commentCount: commentCountMap.get(String(row.id)) ?? 0,
        myLiked: myLikedIds.has(String(row.id)),
      })
    );

    return NextResponse.json(
      { ok: true, resources },
      { headers: { "Cache-Control": "private, max-age=45" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "資源分享讀取失敗";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
