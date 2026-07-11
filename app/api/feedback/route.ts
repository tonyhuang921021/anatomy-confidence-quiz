import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isSupabaseRecoveryMode } from "@/lib/supabase/recoveryMode";
import { withServerTimeout } from "@/lib/serverTimeout";

type FeedbackBody = {
  accessToken?: string | null;
  visitorId?: string | null;
  content?: string;
  isAnonymous?: boolean;
  parentId?: string | null;
};

type VerifiedUser = {
  id: string;
  email?: string | null;
  displayName?: string | null;
};

type FeedbackMessageRow = {
  id: string | number;
  content: string;
  parent_id?: string | number | null;
  display_name?: string | null;
  is_anonymous: boolean;
  created_at: string;
};

type FeedbackVoteRow = {
  message_id: string | number;
  vote_value: number;
};

const FEEDBACK_DAILY_LIMIT = 10;
const FEEDBACK_AUTH_VERIFY_TIMEOUT_MS = 4000;
const FEEDBACK_READ_CACHE_HEADER = "public, max-age=30, s-maxage=60, stale-while-revalidate=300";
const FEEDBACK_DEGRADED_CACHE_HEADER = "no-store";

type FeedbackResponseMessage = ReturnType<typeof mapFeedbackMessageRow> & {
  replies?: ReturnType<typeof mapFeedbackMessageRow>[];
};

const feedbackReadCache = new Map<number, { messages: FeedbackResponseMessage[]; updatedAt: string }>();

class FeedbackAuthError extends Error {
  constructor(message: string, readonly status: 401 | 503) {
    super(message);
    this.name = "FeedbackAuthError";
  }
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

function getBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization") ?? "";
  return authorization.toLowerCase().startsWith("bearer ")
    ? authorization.slice(7).trim()
    : "";
}

function isMissingRelationError(error: unknown, relationName: string) {
  const message =
    error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : String(error ?? "");
  return message.includes(relationName) && (message.includes("does not exist") || message.includes("Could not find"));
}

function mapFeedbackMessageRow(row: FeedbackMessageRow, voteCounts?: Map<string, { likeCount: number; dislikeCount: number }>) {
  const counts = voteCounts?.get(String(row.id));
  return {
    id: String(row.id),
    content: row.content,
    parentId: row.parent_id ? String(row.parent_id) : undefined,
    displayName: row.display_name ?? undefined,
    isAnonymous: row.is_anonymous,
    createdAt: row.created_at,
    likeCount: counts?.likeCount ?? 0,
    dislikeCount: counts?.dislikeCount ?? 0
  };
}

function buildVoteCountMap(rows: FeedbackVoteRow[]) {
  const counts = new Map<string, { likeCount: number; dislikeCount: number }>();
  for (const row of rows) {
    const key = String(row.message_id);
    const current = counts.get(key) ?? { likeCount: 0, dislikeCount: 0 };
    if (Number(row.vote_value) > 0) current.likeCount += 1;
    if (Number(row.vote_value) < 0) current.dislikeCount += 1;
    counts.set(key, current);
  }
  return counts;
}

async function loadFeedbackVoteCounts(supabase: any, messageIds: string[]) {
  if (messageIds.length === 0) return new Map<string, { likeCount: number; dislikeCount: number }>();

  const { data, error } = (await withServerTimeout(
    supabase
      .from("feedback_message_votes")
      .select("message_id, vote_value")
      .in("message_id", messageIds),
    1200,
    "留言投票讀取逾時"
  )) as { data?: unknown; error?: unknown };

  if (error) {
    if (isMissingRelationError(error, "feedback_message_votes")) {
      return new Map<string, { likeCount: number; dislikeCount: number }>();
    }
    throw error;
  }

  return buildVoteCountMap((data ?? []) as FeedbackVoteRow[]);
}

function buildFeedbackTree(
  rows: FeedbackMessageRow[],
  limit: number,
  voteCounts?: Map<string, { likeCount: number; dislikeCount: number }>
) {
  const flatMessages = rows.map((row) => mapFeedbackMessageRow(row, voteCounts));
  const byParent = new Map<string, ReturnType<typeof mapFeedbackMessageRow>[]>();
  const roots: ReturnType<typeof mapFeedbackMessageRow>[] = [];

  for (const entry of flatMessages) {
    if (!entry.parentId) {
      roots.push(entry);
      continue;
    }

    const group = byParent.get(entry.parentId) ?? [];
    group.push(entry);
    byParent.set(entry.parentId, group);
  }

  return roots.slice(0, limit).map((entry) => ({
    ...entry,
    replies: (byParent.get(entry.id) ?? []).sort((left, right) => left.createdAt.localeCompare(right.createdAt))
  }));
}

function getFeedbackDisplayName(user: VerifiedUser) {
  const displayName = user.displayName?.trim();
  if (displayName) return displayName.slice(0, 24);
  if (user.email) return user.email.split("@")[0].slice(0, 24);
  return "已登入使用者";
}

async function getVerifiedUser(supabase: any, accessToken?: string | null): Promise<VerifiedUser | null> {
  if (!accessToken) return null;

  try {
    const { data, error } = (await withServerTimeout(
      supabase.auth.getUser(accessToken),
      FEEDBACK_AUTH_VERIFY_TIMEOUT_MS,
      "登入狀態驗證逾時"
    )) as { data?: { user?: { id?: string; email?: string; user_metadata?: Record<string, unknown> } | null }; error?: unknown };
    if (error || !data?.user?.id) {
      throw new FeedbackAuthError("登入狀態已失效，留言尚未送出，請重新整理後再試。", 401);
    }

    return {
      id: data.user.id,
      email: data.user.email,
      displayName:
        typeof data.user.user_metadata?.display_name === "string"
          ? data.user.user_metadata.display_name
          : null
    };
  } catch (error) {
    if (error instanceof FeedbackAuthError) throw error;
    throw new FeedbackAuthError("登入驗證暫時逾時，留言尚未送出，請稍後再試。", 503);
  }
}

export async function GET(request: NextRequest) {
  if (isSupabaseRecoveryMode()) {
    const cached = feedbackReadCache.get(20);
    return NextResponse.json(
      {
        ok: true,
        messages: cached?.messages ?? [],
        degraded: true,
        recovery: true,
        stale: Boolean(cached),
        message: "留言板維護中",
        updatedAt: cached?.updatedAt
      },
      { headers: { "Cache-Control": FEEDBACK_DEGRADED_CACHE_HEADER } }
    );
  }

  const supabase = getServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { ok: true, messages: [] },
      { headers: { "Cache-Control": FEEDBACK_READ_CACHE_HEADER } }
    );
  }

  const requestedLimit = Number(request.nextUrl.searchParams.get("limit") ?? "20");
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(40, Math.max(1, Math.trunc(requestedLimit)))
    : 20;

  try {
    const { data, error } = await withServerTimeout(
      supabase
        .from("feedback_messages")
        .select("id, content, parent_id, display_name, is_anonymous, created_at")
        .order("created_at", { ascending: false })
        .limit(limit * 4),
      1600,
      "留言讀取逾時"
    );

    if (error) throw error;
    const rows = (data ?? []) as FeedbackMessageRow[];
    const voteCounts = await loadFeedbackVoteCounts(
      supabase,
      rows.map((row) => String(row.id))
    );

    const messages = buildFeedbackTree(rows, limit, voteCounts);
    const updatedAt = new Date().toISOString();
    feedbackReadCache.set(limit, { messages, updatedAt });

    return NextResponse.json(
      { ok: true, messages, updatedAt },
      { headers: { "Cache-Control": FEEDBACK_READ_CACHE_HEADER } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "留言讀取失敗";
    const cached = feedbackReadCache.get(limit);
    return NextResponse.json(
      {
        ok: true,
        degraded: true,
        stale: Boolean(cached),
        message,
        messages: cached?.messages ?? [],
        updatedAt: cached?.updatedAt
      },
      { headers: { "Cache-Control": FEEDBACK_DEGRADED_CACHE_HEADER } }
    );
  }
}

export async function POST(request: NextRequest) {
  if (isSupabaseRecoveryMode()) {
    return NextResponse.json(
      { ok: false, message: "留言板暫時維護中，先讓登入與同步恢復。" },
      { status: 503 }
    );
  }

  const supabase = getServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, message: "SUPABASE_SERVICE_ROLE_KEY 尚未設定，暫時無法留言。" },
      { status: 503 }
    );
  }

  try {
    const body = (await request.json().catch(() => null)) as FeedbackBody | null;
    const content = body?.content?.trim().slice(0, 1200) ?? "";
    if (!content) {
      return NextResponse.json({ ok: false, message: "留言內容不能是空白。" }, { status: 400 });
    }

    const visitorId = body?.visitorId?.trim() || null;
    const requestedAnonymous = body?.isAnonymous !== false;
    const accessToken = getBearerToken(request) || body?.accessToken?.trim() || "";
    if (!requestedAnonymous && !accessToken) {
      return NextResponse.json(
        { ok: false, message: "登入狀態正在刷新，留言尚未送出，請稍後再試。" },
        { status: 401 }
      );
    }
    const verifiedUser = requestedAnonymous
      ? null
      : await getVerifiedUser(supabase, accessToken);
    const isLoggedIn = Boolean(verifiedUser?.id);
    const actorColumn = isLoggedIn ? "user_id" : "visitor_id";
    const actorValue = isLoggedIn ? verifiedUser?.id ?? null : visitorId;

    if (!actorValue) {
      return NextResponse.json({ ok: false, message: "目前無法識別留言來源，請稍後再試。" }, { status: 400 });
    }

    if (!isLoggedIn) {
      const now = Date.now();
      const dayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();

      const dayResult = await withServerTimeout(
        supabase
          .from("feedback_messages")
          .select("id", { count: "exact", head: true })
          .eq(actorColumn, actorValue)
          .gte("created_at", dayAgo),
        1600,
        "留言頻率檢查逾時"
      );

      if (dayResult.error) throw dayResult.error;

      if ((dayResult.count ?? 0) >= FEEDBACK_DAILY_LIMIT) {
        return NextResponse.json(
          { ok: false, message: `今天留言已達上限，24 小時內最多 ${FEEDBACK_DAILY_LIMIT} 則。` },
          { status: 429 }
        );
      }
    }

    const isAnonymous = requestedAnonymous;
    const displayName = isAnonymous || !verifiedUser ? null : getFeedbackDisplayName(verifiedUser);

    const { data, error } = await withServerTimeout(
      supabase
        .from("feedback_messages")
        .insert({
          content,
          parent_id: body?.parentId?.trim() || null,
          display_name: displayName,
          is_anonymous: isAnonymous,
          user_id: verifiedUser?.id ?? null,
          visitor_id: visitorId
        })
        .select("id, content, parent_id, display_name, is_anonymous, created_at")
        .single(),
      2500,
      "留言送出逾時"
    );

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      message: mapFeedbackMessageRow(data as FeedbackMessageRow)
    });
  } catch (error) {
    if (error instanceof FeedbackAuthError) {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: error.status }
      );
    }
    const message = error instanceof Error ? error.message : "留言送出失敗";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
