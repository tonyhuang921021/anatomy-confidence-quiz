import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  normalizeFeedbackCursor,
  normalizeFeedbackPageLimit
} from "@/lib/feedbackPagination";
import { isSupabaseRecoveryMode } from "@/lib/supabase/recoveryMode";
import { withServerTimeout } from "@/lib/serverTimeout";
import type { FeedbackActivity } from "@/types/quiz";

type FeedbackActivityRow = {
  id: string | number;
  content: string;
  parent_id?: string | number | null;
  display_name?: string | null;
  is_anonymous: boolean;
  user_id?: string | null;
  created_at: string;
};

const FEEDBACK_ACTIVITY_CACHE_HEADER = "private, no-store";
const FEEDBACK_ACTIVITY_AUTH_TIMEOUT_MS = 4000;

function getServiceSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

function getBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization") ?? "";
  return authorization.toLowerCase().startsWith("bearer ")
    ? authorization.slice(7).trim()
    : "";
}

function getAllowedEmails() {
  return (
    process.env.ADMIN_EMAILS ??
    process.env.NEXT_PUBLIC_ADMIN_EMAILS ??
    "tonyhuang921021@gmail.com"
  )
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

async function getVerifiedOwner(supabase: any, accessToken: string) {
  const { data, error } = (await withServerTimeout(
    supabase.auth.getUser(accessToken),
    FEEDBACK_ACTIVITY_AUTH_TIMEOUT_MS,
    "留言通知登入驗證逾時"
  )) as {
    data?: { user?: { id?: string; email?: string | null } | null };
    error?: unknown;
  };

  const userId = data?.user?.id;
  const email = data?.user?.email?.trim().toLowerCase();
  if (error || !userId || !email) return null;
  if (!getAllowedEmails().includes(email)) return null;
  return { id: userId };
}

function mapFeedbackActivity(row: FeedbackActivityRow, ownerId: string): FeedbackActivity {
  const isReply = row.parent_id !== null && row.parent_id !== undefined;
  return {
    id: String(row.id),
    type: isReply ? "reply" : "root",
    content: row.content.trim().slice(0, 180),
    parentId: isReply ? String(row.parent_id) : undefined,
    displayName: row.is_anonymous ? undefined : row.display_name ?? undefined,
    isAnonymous: row.is_anonymous,
    isOwn: row.user_id === ownerId,
    createdAt: row.created_at
  };
}

export async function GET(request: NextRequest) {
  const rawAfter = request.nextUrl.searchParams.get("after");
  const after = normalizeFeedbackCursor(rawAfter);
  if (rawAfter && !after) {
    return NextResponse.json(
      { ok: false, message: "留言通知游標格式錯誤。" },
      { status: 400, headers: { "Cache-Control": FEEDBACK_ACTIVITY_CACHE_HEADER } }
    );
  }

  if (isSupabaseRecoveryMode()) {
    return NextResponse.json(
      {
        ok: true,
        activities: [],
        nextCursor: after,
        hasMore: false,
        authorized: null,
        degraded: true,
        message: "留言通知暫停更新。"
      },
      { headers: { "Cache-Control": FEEDBACK_ACTIVITY_CACHE_HEADER } }
    );
  }

  const supabase = getServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, message: "留言通知尚未設定。" },
      { status: 503, headers: { "Cache-Control": FEEDBACK_ACTIVITY_CACHE_HEADER } }
    );
  }

  const accessToken = getBearerToken(request);
  if (!accessToken) {
    return NextResponse.json(
      { ok: false, message: "請先登入。" },
      { status: 401, headers: { "Cache-Control": FEEDBACK_ACTIVITY_CACHE_HEADER } }
    );
  }

  try {
    const owner = await getVerifiedOwner(supabase, accessToken);
    if (!owner) {
      return NextResponse.json(
        { ok: false, message: "沒有留言通知權限。" },
        { status: 403, headers: { "Cache-Control": FEEDBACK_ACTIVITY_CACHE_HEADER } }
      );
    }

    if (!after) {
      const { data, error } = await withServerTimeout(
        supabase
          .from("feedback_messages")
          .select("id")
          .order("id", { ascending: false })
          .limit(1),
        1200,
        "留言通知基準讀取逾時"
      );
      if (error) throw error;
      const latest = ((data ?? []) as Array<{ id: string | number }>)[0];
      return NextResponse.json(
        {
          ok: true,
          activities: [],
          nextCursor: latest ? String(latest.id) : null,
          hasMore: false,
          authorized: true,
          updatedAt: new Date().toISOString()
        },
        { headers: { "Cache-Control": FEEDBACK_ACTIVITY_CACHE_HEADER } }
      );
    }

    const limit = normalizeFeedbackPageLimit(
      request.nextUrl.searchParams.get("limit"),
      20,
      50
    );
    const { data, error } = await withServerTimeout(
      supabase
        .from("feedback_messages")
        .select("id, content, parent_id, display_name, is_anonymous, user_id, created_at")
        .gt("id", after)
        .order("id", { ascending: true })
        .limit(limit + 1),
      1600,
      "留言通知讀取逾時"
    );
    if (error) throw error;

    const rows = (data ?? []) as FeedbackActivityRow[];
    const pageRows = rows.slice(0, limit);
    const hasMore = rows.length > limit;
    const nextCursor = pageRows.length > 0
      ? String(pageRows[pageRows.length - 1].id)
      : after;

    return NextResponse.json(
      {
        ok: true,
        activities: pageRows.map((row) => mapFeedbackActivity(row, owner.id)),
        nextCursor,
        hasMore,
        authorized: true,
        updatedAt: new Date().toISOString()
      },
      { headers: { "Cache-Control": FEEDBACK_ACTIVITY_CACHE_HEADER } }
    );
  } catch (error) {
    console.error("Feedback activity read failed:", error);
    return NextResponse.json(
      { ok: false, message: "留言通知暫時讀不到，稍後會再試。" },
      { status: 503, headers: { "Cache-Control": FEEDBACK_ACTIVITY_CACHE_HEADER } }
    );
  }
}
