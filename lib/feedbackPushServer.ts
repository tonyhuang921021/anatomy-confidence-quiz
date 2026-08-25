import "server-only";
import { createHash } from "node:crypto";
import webPush from "web-push";
import {
  buildFeedbackPushPayload,
  dispatchFeedbackPushRows,
  getFeedbackWebPushConfig,
  type FeedbackPushSubscriptionInput,
  type FeedbackPushSubscriptionRow
} from "./feedbackPush";
import { withServerTimeout } from "./serverTimeout";
import type { FeedbackMessage } from "../types/quiz";

const FEEDBACK_PUSH_BATCH_SIZE = 100;

type FeedbackPushRow = {
  id: string | number;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

export function hashFeedbackPushEndpoint(endpoint: string) {
  return createHash("sha256").update(endpoint).digest("hex");
}

export async function sendFeedbackSubscriberPush(
  supabase: any,
  message: FeedbackMessage,
  options: {
    excludeUserId?: string | null;
    env?: Record<string, string | undefined>;
  } = {}
) {
  const config = getFeedbackWebPushConfig(options.env ?? process.env);
  if (!config) return { status: "disabled" as const, sent: 0, failed: 0 };

  webPush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
  const payload = buildFeedbackPushPayload(message);
  const expiredIds: Array<string | number> = [];
  let afterId: string | null = null;
  let sent = 0;
  let failed = 0;

  while (true) {
    let query = supabase
      .from("feedback_push_subscriptions")
      .select("id, user_id, endpoint, p256dh, auth")
      .order("id", { ascending: true })
      .limit(FEEDBACK_PUSH_BATCH_SIZE);
    if (afterId) query = query.gt("id", afterId);

    const { data, error } = (await withServerTimeout(
      query,
      1600,
      "手機推播訂閱讀取逾時"
    )) as { data?: FeedbackPushRow[] | null; error?: unknown };
    if (error) throw error;
    const batch = data ?? [];
    if (batch.length === 0) break;

    const rows: FeedbackPushSubscriptionRow[] = batch.map((row) => ({
      id: row.id,
      userId: row.user_id,
      endpoint: row.endpoint,
      keys: { p256dh: row.p256dh, auth: row.auth }
    }));
    const result = await dispatchFeedbackPushRows(
      rows,
      payload,
      async (subscription: FeedbackPushSubscriptionInput) => {
        await webPush.sendNotification(subscription, JSON.stringify(payload), {
          TTL: 5 * 60,
          urgency: "high",
          topic: payload.tag,
          timeout: 2500
        });
      },
      options.excludeUserId
    );
    sent += result.sent;
    failed += result.failed;
    expiredIds.push(...result.expiredIds);

    const nextAfterId = String(batch[batch.length - 1].id);
    if (nextAfterId === afterId) throw new Error("手機推播訂閱游標沒有前進");
    afterId = nextAfterId;
    if (batch.length < FEEDBACK_PUSH_BATCH_SIZE) break;
  }

  if (expiredIds.length > 0) {
    const cleanup = (await withServerTimeout(
      supabase
        .from("feedback_push_subscriptions")
        .delete()
        .in("id", expiredIds),
      1200,
      "失效手機推播清理逾時"
    )) as { error?: unknown };
    if (cleanup.error) {
      console.error("Expired feedback push cleanup failed.");
    }
  }

  return {
    status: "sent" as const,
    sent,
    failed
  };
}
