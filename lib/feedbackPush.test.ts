import assert from "node:assert/strict";
import test from "node:test";
import type { FeedbackMessage } from "../types/quiz";
import {
  buildFeedbackPushPayload,
  dispatchFeedbackPushRows,
  getFeedbackPushCapability,
  getFeedbackWebPushConfig,
  parseFeedbackPushSubscription,
  type FeedbackPushSubscriptionRow
} from "./feedbackPush";

const PUBLIC_KEY = "B".repeat(87);
const PRIVATE_KEY = "a".repeat(43);
const P256DH = "C".repeat(87);
const AUTH = "d".repeat(22);

function feedback(overrides: Partial<FeedbackMessage> = {}): FeedbackMessage {
  return {
    id: "123",
    content: "請幫忙看看這一題",
    isAnonymous: true,
    createdAt: "2026-08-25T05:00:00.000Z",
    ...overrides
  };
}

test("只接受 HTTPS 且金鑰格式完整的 PushSubscription", () => {
  assert.deepEqual(
    parseFeedbackPushSubscription({
      endpoint: "https://push.example.com/send/abc",
      keys: { p256dh: P256DH, auth: AUTH }
    }),
    {
      endpoint: "https://push.example.com/send/abc",
      keys: { p256dh: P256DH, auth: AUTH }
    }
  );
  assert.equal(
    parseFeedbackPushSubscription({
      endpoint: "http://127.0.0.1/internal",
      keys: { p256dh: P256DH, auth: AUTH }
    }),
    null
  );
  assert.equal(
    parseFeedbackPushSubscription({
      endpoint: "https://127.0.0.1/internal",
      keys: { p256dh: P256DH, auth: AUTH }
    }),
    null
  );
  assert.equal(
    parseFeedbackPushSubscription({
      endpoint: "https://push.internal/send/abc",
      keys: { p256dh: P256DH, auth: AUTH }
    }),
    null
  );
  assert.equal(
    parseFeedbackPushSubscription({
      endpoint: "https://push.example.com/send/abc",
      keys: { p256dh: "short", auth: AUTH }
    }),
    null
  );
});

test("VAPID 設定缺少或格式錯誤時保持停用", () => {
  assert.equal(getFeedbackWebPushConfig({}), null);
  assert.equal(
    getFeedbackWebPushConfig({
      WEB_PUSH_VAPID_PUBLIC_KEY: PUBLIC_KEY,
      WEB_PUSH_VAPID_PRIVATE_KEY: PRIVATE_KEY,
      WEB_PUSH_VAPID_SUBJECT: "javascript:alert(1)"
    }),
    null
  );
  assert.deepEqual(
    getFeedbackWebPushConfig({
      WEB_PUSH_VAPID_PUBLIC_KEY: PUBLIC_KEY,
      WEB_PUSH_VAPID_PRIVATE_KEY: PRIVATE_KEY,
      WEB_PUSH_VAPID_SUBJECT: "https://preview.example.com/path"
    }),
    {
      publicKey: PUBLIC_KEY,
      privateKey: PRIVATE_KEY,
      subject: "https://preview.example.com"
    }
  );
});

test("匿名推播不會洩漏殘留暱稱且內容有長度上限", () => {
  const payload = buildFeedbackPushPayload(
    feedback({ displayName: "不該出現", content: "內容 ".repeat(100) })
  );
  assert.equal(payload.title, "留言板有新留言");
  assert.match(payload.body, /^匿名使用者：/);
  assert.doesNotMatch(payload.body, /不該出現/);
  assert.ok(payload.body.length <= 147);
  assert.equal(payload.tag, "feedback-123");
  assert.equal(payload.url, "/#feedback");
});

test("iPhone 必須先加入主畫面，封鎖或不支援時不顯示開啟流程", () => {
  const supported = {
    hasServiceWorker: true,
    hasPushManager: true,
    hasNotifications: true,
    isIos: false,
    isStandalone: false,
    permission: "default" as const
  };
  assert.equal(getFeedbackPushCapability(supported), "available");
  assert.equal(
    getFeedbackPushCapability({ ...supported, isIos: true }),
    "install-required"
  );
  assert.equal(
    getFeedbackPushCapability({ ...supported, permission: "denied" }),
    "denied"
  );
  assert.equal(
    getFeedbackPushCapability({ ...supported, hasPushManager: false }),
    "unsupported"
  );
});

test("派送排除自己的裝置並清理 404/410 的失效訂閱", async () => {
  const rows: FeedbackPushSubscriptionRow[] = [
    { id: "1", userId: "owner", endpoint: "https://push.example.com/1", keys: { p256dh: P256DH, auth: AUTH } },
    { id: "2", userId: "other", endpoint: "https://push.example.com/2", keys: { p256dh: P256DH, auth: AUTH } },
    { id: "3", userId: "other", endpoint: "https://push.example.com/3", keys: { p256dh: P256DH, auth: AUTH } },
    { id: "4", userId: "other", endpoint: "https://push.example.com/4", keys: { p256dh: P256DH, auth: AUTH } }
  ];
  const called: string[] = [];
  const result = await dispatchFeedbackPushRows(
    rows,
    buildFeedbackPushPayload(feedback()),
    async (subscription) => {
      called.push(subscription.endpoint);
      if (subscription.endpoint.endsWith("/2")) throw { statusCode: 410 };
      if (subscription.endpoint.endsWith("/3")) throw { statusCode: 503 };
    },
    "owner"
  );

  assert.deepEqual(called, [
    "https://push.example.com/2",
    "https://push.example.com/3",
    "https://push.example.com/4"
  ]);
  assert.deepEqual(result, { sent: 1, failed: 1, expiredIds: ["2"] });
});
