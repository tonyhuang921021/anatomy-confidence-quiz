import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

const FEEDBACK_HOURLY_LIMIT = 3;
const FEEDBACK_DAILY_LIMIT = 10;

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

function mapFeedbackMessageRow(row: FeedbackMessageRow) {
  return {
    id: String(row.id),
    content: row.content,
    parentId: row.parent_id ? String(row.parent_id) : undefined,
    displayName: row.display_name ?? undefined,
    isAnonymous: row.is_anonymous,
    createdAt: row.created_at
  };
}

function getFeedbackDisplayName(user: VerifiedUser) {
  const displayName = user.displayName?.trim();
  if (displayName) return displayName.slice(0, 24);
  if (user.email) return user.email.split("@")[0].slice(0, 24);
  return "已登入使用者";
}

async function getVerifiedUser(supabase: any, accessToken?: string | null): Promise<VerifiedUser | null> {
  if (!accessToken) return null;

  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user?.id) return null;

  return {
    id: data.user.id,
    email: data.user.email,
    displayName:
      typeof data.user.user_metadata?.display_name === "string"
        ? data.user.user_metadata.display_name
        : null
  };
}

async function sendFeedbackNotificationEmail(input: {
  content: string;
  isReply: boolean;
  displayName: string;
  isAnonymous: boolean;
  createdAt: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.FEEDBACK_NOTIFY_TO_EMAIL || "tonyhuang921021@gmail.com";
  const fromEmail = process.env.FEEDBACK_NOTIFY_FROM_EMAIL;

  if (!apiKey || !toEmail || !fromEmail) {
    return;
  }

  const subject = input.isReply ? "留言板有新回覆" : "留言板有新留言";
  const bodyText = [
    `${input.isReply ? "收到新回覆" : "收到新留言"}`,
    `顯示名稱：${input.isAnonymous ? "匿名使用者" : input.displayName}`,
    `時間：${new Date(input.createdAt).toLocaleString("zh-TW")}`,
    "",
    input.content
  ].join("\n");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [toEmail],
      subject,
      text: bodyText
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || "留言通知寄送失敗");
  }
}

export async function POST(request: NextRequest) {
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
    const verifiedUser = await getVerifiedUser(supabase, body?.accessToken);
    const isLoggedIn = Boolean(verifiedUser?.id);
    const actorColumn = isLoggedIn ? "user_id" : "visitor_id";
    const actorValue = isLoggedIn ? verifiedUser?.id ?? null : visitorId;

    if (!actorValue) {
      return NextResponse.json({ ok: false, message: "目前無法識別留言來源，請稍後再試。" }, { status: 400 });
    }

    const now = Date.now();
    const hourAgo = new Date(now - 60 * 60 * 1000).toISOString();
    const dayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();

    const [hourResult, dayResult] = await Promise.all([
      supabase
        .from("feedback_messages")
        .select("*", { count: "exact", head: true })
        .eq(actorColumn, actorValue)
        .gte("created_at", hourAgo),
      supabase
        .from("feedback_messages")
        .select("*", { count: "exact", head: true })
        .eq(actorColumn, actorValue)
        .gte("created_at", dayAgo)
    ]);

    if (hourResult.error) throw hourResult.error;
    if (dayResult.error) throw dayResult.error;

    if ((hourResult.count ?? 0) >= FEEDBACK_HOURLY_LIMIT) {
      return NextResponse.json(
        { ok: false, message: `留言太快了，1 小時內最多 ${FEEDBACK_HOURLY_LIMIT} 則，請稍後再試。` },
        { status: 429 }
      );
    }

    if ((dayResult.count ?? 0) >= FEEDBACK_DAILY_LIMIT) {
      return NextResponse.json(
        { ok: false, message: `今天留言已達上限，24 小時內最多 ${FEEDBACK_DAILY_LIMIT} 則。` },
        { status: 429 }
      );
    }

    const isAnonymous = !verifiedUser || Boolean(body?.isAnonymous);
    const displayName = isAnonymous || !verifiedUser ? null : getFeedbackDisplayName(verifiedUser);

    const { data, error } = await supabase
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
      .single();

    if (error) throw error;

    const typedRow = data as FeedbackMessageRow;

    try {
      await sendFeedbackNotificationEmail({
        content,
        isReply: Boolean(body?.parentId?.trim()),
        displayName: displayName ?? "匿名使用者",
        isAnonymous,
        createdAt: typedRow.created_at
      });
    } catch (mailError) {
      console.error("Feedback notification email skipped:", mailError);
    }

    return NextResponse.json({
      ok: true,
      message: mapFeedbackMessageRow(typedRow)
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "留言送出失敗";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
