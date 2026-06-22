import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isSupabaseRecoveryMode } from "@/lib/supabase/recoveryMode";
import { isServerTimeoutError, withServerTimeout } from "@/lib/serverTimeout";

type VerifiedUser = {
  id: string;
  email?: string | null;
  displayName?: string;
};

type SupplementCardRow = {
  id: string;
  question_id: string;
  subject?: string | null;
  chapter?: string | null;
  section?: string | null;
  question_stem?: string | null;
  content_markdown: string;
  attachment_urls?: string[] | null;
  author_label: string;
  author_email?: string | null;
  user_id: string;
  created_at: string;
  updated_at: string;
};

type SupplementVoteRow = {
  card_id: string;
  vote_value: "helpful" | "problematic";
  user_id: string;
};

type SupplementReactionRow = {
  reaction_type: "pure_chaos";
  user_id: string;
};

type SupplementCardBody = {
  action?: "upsert_card" | "vote_card" | "toggle_reaction";
  accessToken?: string | null;
  question?: {
    id?: string;
    subject?: string;
    chapter?: string;
    section?: string;
    stem?: string;
  };
  cardId?: string;
  contentMarkdown?: string;
  attachmentUrls?: string[];
  vote?: "helpful" | "problematic" | null;
  reactionType?: "pure_chaos";
};

const REACTION_LABELS: Record<string, string> = {
  pure_chaos: "這題我們不要了"
};

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

function getDisplayName(user: { email?: string | null; user_metadata?: Record<string, unknown> | null }) {
  const displayName =
    typeof user.user_metadata?.display_name === "string" ? user.user_metadata.display_name.trim() : "";
  if (displayName) return displayName.slice(0, 24);
  return user.email?.split("@")[0]?.trim().slice(0, 24) || "已登入同學";
}

async function getVerifiedUser(supabase: any, accessToken?: string | null): Promise<VerifiedUser | null> {
  if (!accessToken) return null;

  try {
    const { data, error } = (await withServerTimeout(
      supabase.auth.getUser(accessToken),
      1500,
      "登入狀態驗證逾時"
    )) as {
      data?: { user?: { id?: string; email?: string | null; user_metadata?: Record<string, unknown> | null } | null };
      error?: unknown;
    };

    if (error || !data?.user?.id) return null;

    return {
      id: data.user.id,
      email: data.user.email,
      displayName: getDisplayName(data.user)
    };
  } catch {
    return null;
  }
}

function isMissingRelationError(error: unknown, relationName: string) {
  const message =
    error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : String(error ?? "");
  return message.includes(relationName) && (message.includes("does not exist") || message.includes("Could not find"));
}

function isMissingSupplementRelationError(error: unknown) {
  return [
    "question_supplement_cards",
    "question_supplement_card_votes",
    "question_supplement_reactions"
  ].some((relationName) => isMissingRelationError(error, relationName));
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function emptySupplementPayload() {
  return { count: 0, cards: [], reactions: [] };
}

function shouldDegradeSupplementRead(error: unknown) {
  return isServerTimeoutError(error) || isMissingSupplementRelationError(error);
}

function logSupplementReadFallback(error: unknown) {
  console.warn("[question-supplement-cards] optional read fallback", {
    message: getErrorMessage(error, "補充卡片讀取失敗")
  });
}

function normalizeAttachmentUrls(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
    .slice(0, 8);
}

function summarizeContent(markdown: string) {
  return markdown
    .replace(/!\[[^\]]*]\([^)]+\)/g, "[圖片]")
    .replace(/[#>*_`|\-\[\]()]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);
}

async function loadCardsForQuestion(supabase: any, questionId: string, userId?: string | null) {
  const { data: cardData, error: cardError } = (await withServerTimeout(
    supabase
      .from("question_supplement_cards")
      .select("id, question_id, subject, chapter, section, question_stem, content_markdown, attachment_urls, author_label, author_email, user_id, created_at, updated_at")
      .eq("question_id", questionId)
      .order("updated_at", { ascending: false }),
    2200,
    "補充卡片載入逾時"
  )) as { data?: SupplementCardRow[]; error?: unknown };

  if (cardError) throw cardError;

  const rows = cardData ?? [];
  const cardIds = rows.map((row) => row.id);
  let voteRows: SupplementVoteRow[] = [];

  if (cardIds.length > 0) {
    const { data: votes, error: voteError } = (await withServerTimeout(
      supabase
        .from("question_supplement_card_votes")
        .select("card_id, vote_value, user_id")
        .in("card_id", cardIds),
      2200,
      "補充卡片評價載入逾時"
    )) as { data?: SupplementVoteRow[]; error?: unknown };

    if (voteError) throw voteError;
    voteRows = votes ?? [];
  }

  const voteMap = new Map<string, { helpful: number; problematic: number; myVote?: "helpful" | "problematic" }>();
  for (const vote of voteRows) {
    const bucket = voteMap.get(vote.card_id) ?? { helpful: 0, problematic: 0 };
    if (vote.vote_value === "helpful") bucket.helpful += 1;
    if (vote.vote_value === "problematic") bucket.problematic += 1;
    if (userId && vote.user_id === userId) bucket.myVote = vote.vote_value;
    voteMap.set(vote.card_id, bucket);
  }

  return rows
    .map((row) => {
      const votes = voteMap.get(row.id) ?? { helpful: 0, problematic: 0 };
      return {
        id: row.id,
        questionId: row.question_id,
        subject: row.subject ?? undefined,
        chapter: row.chapter ?? undefined,
        section: row.section ?? undefined,
        contentMarkdown: row.content_markdown,
        authorLabel: row.author_label,
        isMine: userId ? row.user_id === userId : false,
        helpfulCount: votes.helpful,
        problematicCount: votes.problematic,
        myVote: votes.myVote,
        attachmentUrls: row.attachment_urls ?? [],
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    })
    .sort((left, right) => {
      if (left.isMine !== right.isMine) return left.isMine ? -1 : 1;
      const leftScore = left.helpfulCount - left.problematicCount * 2;
      const rightScore = right.helpfulCount - right.problematicCount * 2;
      if (leftScore !== rightScore) return rightScore - leftScore;
      return right.updatedAt.localeCompare(left.updatedAt);
    });
}

async function countCardsForQuestion(supabase: any, questionId: string) {
  const { data, error } = (await withServerTimeout(
    supabase
      .from("question_supplement_cards")
      .select("id")
      .eq("question_id", questionId)
      .limit(50),
    1400,
    "補充卡片數量載入逾時"
  )) as { data?: Array<{ id: string }>; error?: unknown };

  if (error) throw error;
  return (data ?? []).length;
}

async function loadReactionsForQuestion(supabase: any, questionId: string, userId?: string | null) {
  const { data, error } = (await withServerTimeout(
    supabase
      .from("question_supplement_reactions")
      .select("reaction_type, user_id")
      .eq("question_id", questionId),
    1800,
    "題目快速標記載入逾時"
  )) as { data?: SupplementReactionRow[]; error?: unknown };

  if (error) {
    if (isMissingRelationError(error, "question_supplement_reactions")) return [];
    throw error;
  }

  const rows = data ?? [];
  return Object.entries(REACTION_LABELS).map(([type, label]) => ({
    type,
    label,
    count: rows.filter((row) => row.reaction_type === type).length,
    active: userId ? rows.some((row) => row.reaction_type === type && row.user_id === userId) : false
  }));
}

async function buildQuestionPayload(supabase: any, questionId: string, userId?: string | null) {
  const [cards, reactions] = await Promise.all([
    loadCardsForQuestion(supabase, questionId, userId),
    loadReactionsForQuestion(supabase, questionId, userId)
  ]);
  return { cards, reactions };
}

export async function GET(request: NextRequest) {
  if (isSupabaseRecoveryMode()) {
    return NextResponse.json(
      { ok: false, message: "補充卡片暫時維護中，先讓登入與同步恢復。" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  const supabase = getServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, message: "Supabase 尚未設定。" }, { status: 500 });
  }

  try {
    const accessToken = request.nextUrl.searchParams.get("accessToken");
    const verifiedUser = await getVerifiedUser(supabase, accessToken);
    const recent = request.nextUrl.searchParams.get("recent") === "1";
    const countOnly = request.nextUrl.searchParams.get("countOnly") === "1";
    const includeReactions = request.nextUrl.searchParams.get("includeReactions") === "1";

    if (recent) {
      if (!verifiedUser) {
        return NextResponse.json({ ok: false, message: "請先登入。" }, { status: 401 });
      }

      const limit = Math.min(Math.max(Number(request.nextUrl.searchParams.get("limit") ?? 12), 1), 30);
      const { data, error } = (await withServerTimeout(
        supabase
          .from("question_supplement_cards")
          .select("id, question_id, subject, chapter, section, question_stem, content_markdown, updated_at")
          .eq("user_id", verifiedUser.id)
          .order("updated_at", { ascending: false })
          .limit(limit),
        2200,
        "最近補充卡片載入逾時"
      )) as { data?: Array<Pick<SupplementCardRow, "id" | "question_id" | "subject" | "chapter" | "section" | "question_stem" | "content_markdown" | "updated_at">>; error?: unknown };

      if (error) throw error;

      return NextResponse.json({
        ok: true,
        recentCards: (data ?? []).map((row) => ({
          id: row.id,
          questionId: row.question_id,
          subject: row.subject ?? undefined,
          chapter: row.chapter ?? undefined,
          section: row.section ?? undefined,
          contentPreview: summarizeContent(row.content_markdown),
          updatedAt: row.updated_at
        }))
      });
    }

    const questionId = request.nextUrl.searchParams.get("questionId")?.trim();
    if (!questionId) {
      return NextResponse.json({ ok: false, message: "缺少題號。" }, { status: 400 });
    }

    if (countOnly) {
      const [count, reactions] = await Promise.all([
        countCardsForQuestion(supabase, questionId),
        includeReactions ? loadReactionsForQuestion(supabase, questionId, verifiedUser?.id) : Promise.resolve([])
      ]);
      return NextResponse.json({ ok: true, count, reactions }, { headers: { "Cache-Control": "no-store" } });
    }

    const payload = await buildQuestionPayload(supabase, questionId, verifiedUser?.id);
    return NextResponse.json({ ok: true, ...payload }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (shouldDegradeSupplementRead(error)) {
      logSupplementReadFallback(error);
      return NextResponse.json(
        { ok: true, ...emptySupplementPayload() },
        { headers: { "Cache-Control": "no-store" } }
      );
    }
    const message = getErrorMessage(error, "補充卡片載入失敗");
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (isSupabaseRecoveryMode()) {
    return NextResponse.json(
      { ok: false, message: "補充卡片暫時維護中，先讓登入與同步恢復。" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  const supabase = getServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, message: "Supabase 尚未設定。" }, { status: 500 });
  }

  try {
    const body = (await request.json().catch(() => null)) as SupplementCardBody | null;
    const verifiedUser = await getVerifiedUser(supabase, body?.accessToken);
    if (!verifiedUser) {
      return NextResponse.json({ ok: false, message: "請先登入。" }, { status: 401 });
    }

    const action = body?.action;
    const questionId = body?.question?.id?.trim();

    if (action === "upsert_card") {
      const contentMarkdown = body?.contentMarkdown?.trim() ?? "";
      if (!questionId) return NextResponse.json({ ok: false, message: "缺少題號。" }, { status: 400 });
      if (contentMarkdown.length < 2) {
        return NextResponse.json({ ok: false, message: "請先輸入補充內容。" }, { status: 400 });
      }

      const now = new Date().toISOString();
      const { error } = (await withServerTimeout(
        supabase
          .from("question_supplement_cards")
          .upsert(
            {
              question_id: questionId,
              subject: body?.question?.subject?.trim() || null,
              chapter: body?.question?.chapter?.trim() || null,
              section: body?.question?.section?.trim() || null,
              question_stem: body?.question?.stem?.trim() || null,
              content_markdown: contentMarkdown,
              attachment_urls: normalizeAttachmentUrls(body?.attachmentUrls),
              author_label: verifiedUser.displayName || "已登入同學",
              author_email: verifiedUser.email ?? null,
              user_id: verifiedUser.id,
              updated_at: now
            },
            { onConflict: "user_id,question_id" }
          ),
        2400,
        "補充卡片儲存逾時"
      )) as { error?: unknown };

      if (error) throw error;

      const payload = await buildQuestionPayload(supabase, questionId, verifiedUser.id);
      return NextResponse.json({ ok: true, message: "補充卡片已儲存。", ...payload });
    }

    if (action === "vote_card") {
      const cardId = body?.cardId?.trim();
      const vote = body?.vote;
      if (!cardId) return NextResponse.json({ ok: false, message: "缺少補充卡片。" }, { status: 400 });

      const { data: card, error: cardError } = (await withServerTimeout(
        supabase
          .from("question_supplement_cards")
          .select("question_id")
          .eq("id", cardId)
          .single(),
        1600,
        "補充卡片查詢逾時"
      )) as { data?: { question_id?: string }; error?: unknown };

      if (cardError) throw cardError;
      const targetQuestionId = card?.question_id;
      if (!targetQuestionId) return NextResponse.json({ ok: false, message: "找不到補充卡片。" }, { status: 404 });

      const { error: deleteError } = (await withServerTimeout(
        supabase
          .from("question_supplement_card_votes")
          .delete()
          .eq("card_id", cardId)
          .eq("user_id", verifiedUser.id),
        1600,
        "補充卡片評價更新逾時"
      )) as { error?: unknown };

      if (deleteError) throw deleteError;

      if (vote === "helpful" || vote === "problematic") {
        const { error: insertError } = (await withServerTimeout(
          supabase
            .from("question_supplement_card_votes")
            .insert({
              card_id: cardId,
              question_id: targetQuestionId,
              vote_value: vote,
              user_id: verifiedUser.id
            }),
          1600,
          "補充卡片評價儲存逾時"
        )) as { error?: unknown };

        if (insertError) throw insertError;
      }

      const payload = await buildQuestionPayload(supabase, targetQuestionId, verifiedUser.id);
      return NextResponse.json({ ok: true, ...payload });
    }

    if (action === "toggle_reaction") {
      const reactionType = body?.reactionType ?? "pure_chaos";
      if (!questionId) return NextResponse.json({ ok: false, message: "缺少題號。" }, { status: 400 });
      if (!REACTION_LABELS[reactionType]) {
        return NextResponse.json({ ok: false, message: "不支援的快速標記。" }, { status: 400 });
      }

      const { data: existing, error: existingError } = (await withServerTimeout(
        supabase
          .from("question_supplement_reactions")
          .select("id")
          .eq("question_id", questionId)
          .eq("reaction_type", reactionType)
          .eq("user_id", verifiedUser.id)
          .maybeSingle(),
        3600,
        "題目快速標記查詢逾時"
      )) as { data?: { id?: string | number } | null; error?: unknown };

      if (existingError) throw existingError;

      if (existing?.id) {
        const { error } = (await withServerTimeout(
          supabase
            .from("question_supplement_reactions")
            .delete()
            .eq("id", existing.id),
          3600,
          "題目快速標記取消逾時"
        )) as { error?: unknown };
        if (error) throw error;
      } else {
        const { error } = (await withServerTimeout(
          supabase
            .from("question_supplement_reactions")
            .insert({
              question_id: questionId,
              reaction_type: reactionType,
              user_id: verifiedUser.id,
              user_email: verifiedUser.email ?? null
            }),
          3600,
          "題目快速標記儲存逾時"
        )) as { error?: unknown };
        if (error) throw error;
      }

      const payload = await buildQuestionPayload(supabase, questionId, verifiedUser.id);
      return NextResponse.json({ ok: true, ...payload });
    }

    return NextResponse.json({ ok: false, message: "不支援的操作。" }, { status: 400 });
  } catch (error) {
    const message = getErrorMessage(error, "補充卡片操作失敗");
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
