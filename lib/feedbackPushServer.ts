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

const FEEDBACK_PUSH_MAX_SUBSCRIPTIONS = 20;

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

export async function sendFeedbackOwnerPush(
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
  const { data, error } = (await withServerTimeout(
    supabase
      .from("feedback_push_subscriptions")
      .select("id, user_id, endpoint, p256dh, auth")
      .order("updated_at", { ascending: false })
      .limit(FEEDBACK_PUSH_MAX_SUBSCRIPTIONS),
    1600,
    "手機推播訂閱讀取逾時"
  )) as { data?: FeedbackPushRow[] | null; error?: unknown };
  if (error) throw error;

  const rows: FeedbackPushSubscriptionRow[] = (data ?? []).map((row) => ({
    id: row.id,
    userId: row.user_id,
    endpoint: row.endpoint,
    keys: { p256dh: row.p256dh, auth: row.auth }
  }));
  const payload = buildFeedbackPushPayload(message);
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

  if (result.expiredIds.length > 0) {
    const cleanup = (await withServerTimeout(
      supabase
        .from("feedback_push_subscriptions")
        .delete()
        .in("id", result.expiredIds),
      1200,
      "失效手機推播清理逾時"
    )) as { error?: unknown };
    if (cleanup.error) {
      console.error("Expired feedback push cleanup failed.");
    }
  }

  return {
    status: "sent" as const,
    sent: result.sent,
    failed: result.failed
  };
}
