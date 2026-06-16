import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isSupabaseRecoveryMode } from "@/lib/supabase/recoveryMode";
import { withServerTimeout } from "@/lib/serverTimeout";

type FeedbackVoteBody = {
  accessToken?: string | null;
  visitorId?: string | null;
  messageId?: string | null;
  vote?: 1 | -1 | null;
};

type VerifiedUser = {
  id: string;
};

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

async function getVerifiedUser(supabase: any, accessToken?: string | null): Promise<VerifiedUser | null> {
  if (!accessToken) return null;

  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user?.id) return null;

  return { id: data.user.id };
}

function normalizeVote(value: unknown): 1 | -1 | null {
  if (value === 1 || value === "1" || value === "like") return 1;
  if (value === -1 || value === "-1" || value === "dislike") return -1;
  return null;
}

function isMissingRelationError(error: unknown, relationName: string) {
  const message =
    error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : String(error ?? "");
  return message.includes(relationName) && (message.includes("does not exist") || message.includes("Could not find"));
}

async function loadVoteCounts(supabase: any, messageId: string) {
  const { data, error } = (await withServerTimeout(
    supabase
      .from("feedback_message_votes")
      .select("vote_value")
      .eq("message_id", messageId),
    1200,
    "留言投票統計逾時"
  )) as { data?: unknown; error?: unknown };

  if (error) throw error;

  return (data ?? []).reduce(
    (counts: { likeCount: number; dislikeCount: number }, row: { vote_value?: number }) => {
      if (Number(row.vote_value) > 0) counts.likeCount += 1;
      if (Number(row.vote_value) < 0) counts.dislikeCount += 1;
      return counts;
    },
    { likeCount: 0, dislikeCount: 0 }
  );
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
      { ok: false, message: "SUPABASE_SERVICE_ROLE_KEY 尚未設定，暫時無法投票。" },
      { status: 503 }
    );
  }

  try {
    const body = (await request.json().catch(() => null)) as FeedbackVoteBody | null;
    const messageId = body?.messageId?.trim();
    const vote = normalizeVote(body?.vote);

    if (!messageId) {
      return NextResponse.json({ ok: false, message: "缺少留言編號。" }, { status: 400 });
    }

    const visitorId = body?.visitorId?.trim() || null;
    const verifiedUser = await getVerifiedUser(supabase, body?.accessToken);
    const actorColumn = verifiedUser?.id ? "user_id" : "visitor_id";
    const actorValue = verifiedUser?.id ?? visitorId;

    if (!actorValue) {
      return NextResponse.json({ ok: false, message: "目前無法識別投票來源，請稍後再試。" }, { status: 400 });
    }

    const deleteQuery = supabase
      .from("feedback_message_votes")
      .delete()
      .eq("message_id", messageId)
      .eq(actorColumn, actorValue);
    const { error: deleteError } = (await withServerTimeout(deleteQuery, 1600, "留言投票更新逾時")) as {
      error?: unknown;
    };
    if (deleteError) throw deleteError;

    if (vote !== null) {
      const row = {
        message_id: messageId,
        vote_value: vote,
        user_id: verifiedUser?.id ?? null,
        visitor_id: verifiedUser?.id ? null : actorValue
      };
      const { error } = (await withServerTimeout(
        supabase
          .from("feedback_message_votes")
          .insert(row),
        1800,
        "留言投票儲存逾時"
      )) as { error?: unknown };
      if (error) throw error;
    }

    const counts = await loadVoteCounts(supabase, messageId);

    return NextResponse.json({
      ok: true,
      messageId,
      myVote: vote,
      ...counts
    });
  } catch (error) {
    if (isMissingRelationError(error, "feedback_message_votes")) {
      return NextResponse.json(
        { ok: false, message: "Supabase 還沒建立 feedback_message_votes 資料表，請先更新 schema。" },
        { status: 503 }
      );
    }

    const message = error instanceof Error ? error.message : "留言投票失敗";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
