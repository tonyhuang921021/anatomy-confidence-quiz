import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { waitUntil } from "@vercel/functions";
import { sendFeedbackSubscriberPush } from "@/lib/feedbackPushServer";
import {
  buildFeedbackTree,
  getFeedbackPageCacheKey,
  mapFeedbackMessageRow,
  normalizeFeedbackCursor,
  normalizeFeedbackPageLimit,
  takeFeedbackRootPage,
  type FeedbackMessageRow
} from "@/lib/feedbackPagination";
import { isSupabaseRecoveryMode } from "@/lib/supabase/recoveryMode";
import { withServerTimeout } from "@/lib/serverTimeout";
import type { FeedbackMessage } from "@/types/quiz";

export const runtime = "nodejs";

type FeedbackBody = {
  accessToken?: string | null;
  visitorId?: string | null;
  content?: string;
  isAnonymous?: boolean;
  parentId?: string | null;
};

type VerifiedUser = {
  id: string;
  displayName?: string | null;
};

type FeedbackVoteRow = {
  id: string | number;
  message_id: string | number;
  vote_value: number;
};

const FEEDBACK_DAILY_LIMIT = 10;
const FEEDBACK_AUTH_VERIFY_TIMEOUT_MS = 4000;
const FEEDBACK_READ_CACHE_HEADER = "public, max-age=30, s-maxage=60, stale-while-revalidate=300";
const FEEDBACK_DEGRADED_CACHE_HEADER = "no-store";
const FEEDBACK_REPLY_BATCH_SIZE = 500;
const FEEDBACK_REPLY_MAX_ROWS_PER_PAGE = 5000;
const FEEDBACK_VOTE_ID_BATCH_SIZE = 200;
const FEEDBACK_VOTE_ROW_BATCH_SIZE = 500;
const FEEDBACK_VOTE_MAX_ROWS_PER_ID_BATCH = 20_000;
const FEEDBACK_READ_CACHE_MAX_ENTRIES = 80;
const FEEDBACK_READ_CACHE_TTL_MS = 10 * 60 * 1000;
const FEEDBACK_VISITOR_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{7,127}$/;

type FeedbackReadCacheEntry = {
  messages: FeedbackMessage[];
  nextCursor: string | null;
  hasMore: boolean;
  updatedAt: string;
  cachedAt: number;
};

const feedbackReadCache = new Map<string, FeedbackReadCacheEntry>();

async function notifyFeedbackSubscribers(
  supabase: any,
  message: FeedbackMessage,
  excludeUserId?: string | null
) {
  try {
    const notificationResult = await sendFeedbackSubscriberPush(supabase, message, {
      excludeUserId
    });
    if (notificationResult.status === "sent" && notificationResult.failed > 0) {
      console.error("Some feedback push notifications failed:", {
        failed: notificationResult.failed
      });
    }
  } catch {
    console.error("Feedback push notification failed unexpectedly.");
  }
}

function scheduleFeedbackSubscriberNotification(
  supabase: any,
  message: FeedbackMessage,
  excludeUserId?: string | null
) {
  waitUntil(notifyFeedbackSubscribers(supabase, message, excludeUserId));
}

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

function getCachedFeedbackPage(key: string) {
  const cached = feedbackReadCache.get(key);
  if (!cached) return undefined;
  if (Date.now() - cached.cachedAt > FEEDBACK_READ_CACHE_TTL_MS) {
    feedbackReadCache.delete(key);
    return undefined;
  }
  feedbackReadCache.delete(key);
  feedbackReadCache.set(key, cached);
  return cached;
}

function setCachedFeedbackPage(key: string, entry: FeedbackReadCacheEntry) {
  feedbackReadCache.delete(key);
  feedbackReadCache.set(key, entry);
  while (feedbackReadCache.size > FEEDBACK_READ_CACHE_MAX_ENTRIES) {
    const oldestKey = feedbackReadCache.keys().next().value as string | undefined;
    if (!oldestKey) break;
    feedbackReadCache.delete(oldestKey);
  }
}

function addVoteRows(
  counts: Map<string, { likeCount: number; dislikeCount: number }>,
  rows: FeedbackVoteRow[]
) {
  for (const row of rows) {
    const key = String(row.message_id);
    const current = counts.get(key) ?? { likeCount: 0, dislikeCount: 0 };
    if (Number(row.vote_value) > 0) current.likeCount += 1;
    if (Number(row.vote_value) < 0) current.dislikeCount += 1;
    counts.set(key, current);
  }
}

async function loadFeedbackVoteCounts(supabase: any, messageIds: string[]) {
  if (messageIds.length === 0) return new Map<string, { likeCount: number; dislikeCount: number }>();

  const counts = new Map<string, { likeCount: number; dislikeCount: number }>();
  for (let index = 0; index < messageIds.length; index += FEEDBACK_VOTE_ID_BATCH_SIZE) {
    const chunk = messageIds.slice(index, index + FEEDBACK_VOTE_ID_BATCH_SIZE);
    const highWatermarkResult = (await withServerTimeout(
      supabase
        .from("feedback_message_votes")
        .select("id")
        .in("message_id", chunk)
        .order("id", { ascending: false })
        .limit(1),
      1200,
      "留言投票讀取逾時"
    )) as { data?: unknown; error?: unknown };
    if (highWatermarkResult.error) {
      if (isMissingRelationError(highWatermarkResult.error, "feedback_message_votes")) {
        return new Map<string, { likeCount: number; dislikeCount: number }>();
      }
      throw highWatermarkResult.error;
    }
    const highWatermark = String(
      ((highWatermarkResult.data ?? []) as Array<{ id: string | number }>)[0]?.id ?? ""
    );
    if (!highWatermark) continue;

    const countResult = (await withServerTimeout(
      supabase
        .from("feedback_message_votes")
        .select("id", { count: "exact", head: true })
        .in("message_id", chunk)
        .lte("id", highWatermark),
      1200,
      "留言投票數量確認逾時"
    )) as { count?: number | null; error?: unknown };
    if (countResult.error) throw countResult.error;
    const expectedRows = countResult.count ?? 0;
    if (expectedRows > FEEDBACK_VOTE_MAX_ROWS_PER_ID_BATCH) {
      throw new Error("留言投票數量超出安全讀取範圍");
    }

    let afterId: string | null = null;
    let loadedRows = 0;
    while (loadedRows < expectedRows) {
      let query = supabase
        .from("feedback_message_votes")
        .select("id, message_id, vote_value")
        .in("message_id", chunk)
        .lte("id", highWatermark)
        .order("id", { ascending: true })
        .limit(FEEDBACK_VOTE_ROW_BATCH_SIZE);
      if (afterId) query = query.gt("id", afterId);

      const pageResult = (await withServerTimeout(
        query,
        1200,
        "留言投票讀取逾時"
      )) as { data?: unknown; error?: unknown };
      if (pageResult.error) throw pageResult.error;
      const rows = (pageResult.data ?? []) as FeedbackVoteRow[];
      if (rows.length === 0) throw new Error("留言投票資料未完整讀取");

      addVoteRows(counts, rows);
      loadedRows += rows.length;
      const nextAfterId = String(rows[rows.length - 1].id);
      if (nextAfterId === afterId) throw new Error("留言投票分頁游標沒有前進");
      afterId = nextAfterId;
    }
  }

  return counts;
}

async function loadFeedbackReplies(supabase: any, rootIds: string[]) {
  if (rootIds.length === 0) return [] as FeedbackMessageRow[];

  const highWatermarkResult = (await withServerTimeout(
    supabase
      .from("feedback_messages")
      .select("id")
      .in("parent_id", rootIds)
      .order("id", { ascending: false })
      .limit(1),
    1200,
    "留言回覆範圍確認逾時"
  )) as { data?: unknown; error?: unknown };
  if (highWatermarkResult.error) throw highWatermarkResult.error;
  const highWatermark = String(
    ((highWatermarkResult.data ?? []) as Array<{ id: string | number }>)[0]?.id ?? ""
  );
  if (!highWatermark) return [] as FeedbackMessageRow[];

  const countResult = (await withServerTimeout(
    supabase
      .from("feedback_messages")
      .select("id", { count: "exact", head: true })
      .in("parent_id", rootIds)
      .lte("id", highWatermark),
    1200,
    "留言回覆數量確認逾時"
  )) as { count?: number | null; error?: unknown };
  if (countResult.error) throw countResult.error;
  const expectedRows = countResult.count ?? 0;
  if (expectedRows > FEEDBACK_REPLY_MAX_ROWS_PER_PAGE) {
    throw new Error("留言回覆數量超出安全讀取範圍");
  }

  const replies: FeedbackMessageRow[] = [];
  let afterId: string | null = null;

  while (replies.length < expectedRows) {
    let query = supabase
      .from("feedback_messages")
      .select("id, content, parent_id, display_name, is_anonymous, created_at")
      .in("parent_id", rootIds)
      .lte("id", highWatermark)
      .order("id", { ascending: true })
      .limit(FEEDBACK_REPLY_BATCH_SIZE);
    if (afterId) query = query.gt("id", afterId);

    const { data, error } = (await withServerTimeout(
      query,
      1600,
      "留言回覆讀取逾時"
    )) as { data?: unknown; error?: unknown };
    if (error) throw error;

    const batch = (data ?? []) as FeedbackMessageRow[];
    if (batch.length === 0) throw new Error("留言回覆資料未完整讀取");
    replies.push(...batch);

    const nextAfterId = String(batch[batch.length - 1].id);
    if (nextAfterId === afterId) throw new Error("留言回覆分頁游標沒有前進");
    afterId = nextAfterId;
  }

  return replies;
}

function getFeedbackDisplayName(user: VerifiedUser) {
  const displayName = user.displayName?.trim();
  if (displayName) return displayName.slice(0, 24);
  return "已登入使用者";
}

async function getVerifiedUser(supabase: any, accessToken?: string | null): Promise<VerifiedUser | null> {
  if (!accessToken) return null;

  try {
    const { data, error } = (await withServerTimeout(
      supabase.auth.getUser(accessToken),
      FEEDBACK_AUTH_VERIFY_TIMEOUT_MS,
      "登入狀態驗證逾時"
    )) as { data?: { user?: { id?: string; user_metadata?: Record<string, unknown> } | null }; error?: unknown };
    if (error || !data?.user?.id) {
      throw new FeedbackAuthError("登入狀態已失效，留言尚未送出，請重新整理後再試。", 401);
    }

    return {
      id: data.user.id,
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
  const rawCursor = request.nextUrl.searchParams.get("cursor");
  const cursor = normalizeFeedbackCursor(rawCursor);
  if (rawCursor && !cursor) {
    return NextResponse.json(
      { ok: false, message: "留言分頁游標格式錯誤。" },
      { status: 400, headers: { "Cache-Control": FEEDBACK_DEGRADED_CACHE_HEADER } }
    );
  }
  const limit = normalizeFeedbackPageLimit(request.nextUrl.searchParams.get("limit"));
  const cacheKey = getFeedbackPageCacheKey(limit, cursor);
  const fresh = request.nextUrl.searchParams.get("fresh") === "1";
  const responseCacheHeader = fresh ? "no-store" : FEEDBACK_READ_CACHE_HEADER;
  if (isSupabaseRecoveryMode()) {
    const cached = getCachedFeedbackPage(cacheKey);
    return NextResponse.json(
      {
        ok: true,
        messages: cached?.messages ?? [],
        nextCursor: cached?.nextCursor ?? null,
        hasMore: cached?.hasMore ?? false,
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
      { ok: false, message: "留言板服務尚未設定完成。" },
      { status: 503, headers: { "Cache-Control": FEEDBACK_DEGRADED_CACHE_HEADER } }
    );
  }

  try {
    let rootQuery = supabase
      .from("feedback_messages")
      .select("id, content, parent_id, display_name, is_anonymous, created_at")
      .is("parent_id", null)
      .order("id", { ascending: false })
      .limit(limit + 1);
    if (cursor) rootQuery = rootQuery.lt("id", cursor);

    const { data, error } = await withServerTimeout(
      rootQuery,
      1600,
      "留言讀取逾時"
    );

    if (error) throw error;
    const rootPage = takeFeedbackRootPage((data ?? []) as FeedbackMessageRow[], limit);
    const replies = await loadFeedbackReplies(
      supabase,
      rootPage.rows.map((row) => String(row.id))
    );
    const allRows = [...rootPage.rows, ...replies];
    const voteCounts = await loadFeedbackVoteCounts(
      supabase,
      allRows.map((row) => String(row.id))
    );

    const messages = buildFeedbackTree(rootPage.rows, replies, voteCounts);
    const updatedAt = new Date().toISOString();
    setCachedFeedbackPage(cacheKey, {
      messages,
      nextCursor: rootPage.nextCursor,
      hasMore: rootPage.hasMore,
      updatedAt,
      cachedAt: Date.now()
    });

    return NextResponse.json(
      {
        ok: true,
        messages,
        nextCursor: rootPage.nextCursor,
        hasMore: rootPage.hasMore,
        updatedAt
      },
      { headers: { "Cache-Control": responseCacheHeader } }
    );
  } catch (error) {
    console.error("Feedback read failed:", error);
    const cached = getCachedFeedbackPage(cacheKey);
    return NextResponse.json(
      {
        ok: true,
        degraded: true,
        stale: Boolean(cached),
        message: "留言暫時讀不到，請稍後再試。",
        messages: cached?.messages ?? [],
        nextCursor: cached?.nextCursor ?? null,
        hasMore: cached?.hasMore ?? false,
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
      { ok: false, message: "留言服務尚未設定完成，暫時無法留言。" },
      { status: 503 }
    );
  }

  try {
    const body = (await request.json().catch(() => null)) as FeedbackBody | null;
    const content = body?.content?.trim().slice(0, 1200) ?? "";
    if (!content) {
      return NextResponse.json({ ok: false, message: "留言內容不能是空白。" }, { status: 400 });
    }

    const rawVisitorId = body?.visitorId?.trim() || null;
    if (rawVisitorId && !FEEDBACK_VISITOR_ID_PATTERN.test(rawVisitorId)) {
      return NextResponse.json({ ok: false, message: "留言來源格式錯誤。" }, { status: 400 });
    }
    const visitorId = rawVisitorId;
    const requestedAnonymous = body?.isAnonymous !== false;
    const accessToken = getBearerToken(request) || body?.accessToken?.trim() || "";
    if (!requestedAnonymous && !accessToken) {
      return NextResponse.json(
        { ok: false, message: "登入狀態正在刷新，留言尚未送出，請稍後再試。" },
        { status: 401 }
      );
    }
    const verifiedUser = accessToken
      ? await getVerifiedUser(supabase, accessToken)
      : null;
    const isLoggedIn = Boolean(verifiedUser?.id);
    const actorColumn = isLoggedIn ? "user_id" : "visitor_id";
    const actorValue = isLoggedIn ? verifiedUser?.id ?? null : visitorId;

    if (!actorValue) {
      return NextResponse.json({ ok: false, message: "目前無法識別留言來源，請稍後再試。" }, { status: 400 });
    }

    const rawParentId = body?.parentId?.trim() || null;
    const parentId = normalizeFeedbackCursor(rawParentId);
    if (rawParentId && !parentId) {
      return NextResponse.json({ ok: false, message: "回覆目標格式錯誤。" }, { status: 400 });
    }
    if (parentId) {
      const parentResult = await withServerTimeout(
        supabase
          .from("feedback_messages")
          .select("id, parent_id")
          .eq("id", parentId)
          .maybeSingle(),
        1200,
        "回覆目標確認逾時"
      );
      const parentRow = parentResult.data as { id?: string | number; parent_id?: string | number | null } | null;
      if (parentResult.error) throw parentResult.error;
      if (!parentRow?.id || parentRow.parent_id !== null) {
        return NextResponse.json(
          { ok: false, message: "這則留言已不存在，或不能再回覆下一層。" },
          { status: 400 }
        );
      }
    }
    const duplicateSince = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    try {
      let duplicateQuery = supabase
        .from("feedback_messages")
        .select("id, content, parent_id, display_name, is_anonymous, created_at")
        .eq(actorColumn, actorValue)
        .eq("content", content)
        .gte("created_at", duplicateSince)
        .order("created_at", { ascending: false })
        .limit(1);
      duplicateQuery = parentId
        ? duplicateQuery.eq("parent_id", parentId)
        : duplicateQuery.is("parent_id", null);

      const duplicateResult = await withServerTimeout(
        duplicateQuery,
        1200,
        "重複留言確認逾時"
      );
      const duplicateRow = (duplicateResult.data ?? [])[0] as FeedbackMessageRow | undefined;
      if (!duplicateResult.error && duplicateRow) {
        const duplicateMessage = mapFeedbackMessageRow(duplicateRow);
        feedbackReadCache.clear();
        return NextResponse.json(
          { ok: true, message: duplicateMessage, deduplicated: true },
          { headers: { "Cache-Control": "no-store" } }
        );
      }
    } catch {
      // Duplicate protection is best-effort; a failed check must not block a new message.
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
          parent_id: parentId,
          display_name: displayName,
          is_anonymous: isAnonymous,
          user_id: verifiedUser?.id ?? null,
          visitor_id: isLoggedIn ? null : visitorId
        })
        .select("id, content, parent_id, display_name, is_anonymous, created_at")
        .single(),
      2500,
      "留言送出逾時"
    );

    if (error) throw error;

    const createdMessage = mapFeedbackMessageRow(data as FeedbackMessageRow);
    scheduleFeedbackSubscriberNotification(supabase, createdMessage, verifiedUser?.id);

    feedbackReadCache.clear();
    return NextResponse.json(
      {
        ok: true,
        message: createdMessage
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    if (error instanceof FeedbackAuthError) {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: error.status }
      );
    }
    console.error("Feedback write failed:", error);
    return NextResponse.json(
      { ok: false, message: "留言送出失敗，內容仍保留，請稍後再試。" },
      { status: 500 }
    );
  }
}
