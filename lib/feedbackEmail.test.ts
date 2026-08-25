import assert from "node:assert/strict";
import test from "node:test";
import type { FeedbackMessage } from "../types/quiz";
import {
  buildFeedbackOwnerEmail,
  getFeedbackNotificationRecipients,
  sendFeedbackOwnerEmail
} from "./feedbackEmail";

function feedbackMessage(overrides: Partial<FeedbackMessage> = {}): FeedbackMessage {
  return {
    id: "123",
    content: "請幫忙看看這一題",
    isAnonymous: true,
    createdAt: "2026-08-25T04:05:00.000Z",
    likeCount: 0,
    dislikeCount: 0,
    ...overrides
  };
}

test("收件者只使用合法且去重後的伺服器設定", () => {
  assert.deepEqual(
    getFeedbackNotificationRecipients({
      FEEDBACK_NOTIFICATION_EMAILS: "OWNER@example.com, owner@example.com;bad-address\nsecond@example.com"
    }),
    ["owner@example.com", "second@example.com"]
  );
});

test("匿名留言信件不會洩漏殘留暱稱，HTML 內容也會跳脫", () => {
  const email = buildFeedbackOwnerEmail(
    feedbackMessage({
      content: "<script>alert('x')</script>",
      displayName: "不該出現的暱稱"
    }),
    { FEEDBACK_NOTIFICATION_EMAILS: "owner@example.com" }
  );

  assert.ok(email);
  assert.match(email.text, /匿名使用者/);
  assert.doesNotMatch(email.text, /不該出現的暱稱/);
  assert.match(email.html, /&lt;script&gt;/);
  assert.doesNotMatch(email.html, /<script>/);
  assert.equal(email.idempotencyKey, "feedback-created-123");
});

test("回覆通知會標明新回覆並連回留言板", () => {
  const email = buildFeedbackOwnerEmail(
    feedbackMessage({
      parentId: "99",
      isAnonymous: false,
      displayName: "讀者甲"
    }),
    {
      FEEDBACK_NOTIFICATION_EMAILS: "owner@example.com",
      FEEDBACK_NOTIFICATION_SITE_URL: "https://preview.example.com/path"
    }
  );

  assert.ok(email);
  assert.equal(email.subject, "國考刷題網站有新回覆");
  assert.match(email.text, /讀者甲/);
  assert.match(email.text, /https:\/\/preview\.example\.com\/#feedback/);
});

test("沒有 API key 時不呼叫外部寄信服務", async () => {
  let fetchCount = 0;
  const result = await sendFeedbackOwnerEmail(feedbackMessage(), {
    env: { FEEDBACK_NOTIFICATION_EMAILS: "owner@example.com" },
    fetchImpl: async () => {
      fetchCount += 1;
      return new Response(null, { status: 200 });
    }
  });

  assert.equal(result.status, "disabled");
  assert.equal(fetchCount, 0);
});

test("寄信使用 bearer、固定防重送碼與安全 payload", async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const result = await sendFeedbackOwnerEmail(feedbackMessage(), {
    env: {
      RESEND_API_KEY: "re_test_key",
      FEEDBACK_NOTIFICATION_EMAILS: "owner@example.com"
    },
    fetchImpl: async (input, init) => {
      requests.push({ url: String(input), init });
      return Response.json({ id: "email-1" });
    }
  });

  assert.deepEqual(result, { status: "sent", emailId: "email-1" });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "https://api.resend.com/emails");
  assert.equal((requests[0].init?.headers as Record<string, string>).Authorization, "Bearer re_test_key");
  assert.equal(
    (requests[0].init?.headers as Record<string, string>)["Idempotency-Key"],
    "feedback-created-123"
  );
  const body = JSON.parse(String(requests[0].init?.body)) as Record<string, unknown>;
  assert.deepEqual(body.to, ["owner@example.com"]);
  assert.equal("userId" in body, false);
  assert.equal("visitorId" in body, false);
});

test("暫時性錯誤會用同一防重送碼重試一次", async () => {
  const idempotencyKeys: string[] = [];
  let requestCount = 0;
  const result = await sendFeedbackOwnerEmail(feedbackMessage(), {
    env: {
      RESEND_API_KEY: "re_test_key",
      FEEDBACK_NOTIFICATION_EMAILS: "owner@example.com"
    },
    fetchImpl: async (_input, init) => {
      requestCount += 1;
      idempotencyKeys.push(
        (init?.headers as Record<string, string>)["Idempotency-Key"]
      );
      return requestCount === 1
        ? new Response(null, { status: 503 })
        : Response.json({ id: "email-2" });
    }
  });

  assert.equal(result.status, "sent");
  assert.equal(requestCount, 2);
  assert.deepEqual(idempotencyKeys, ["feedback-created-123", "feedback-created-123"]);
});
