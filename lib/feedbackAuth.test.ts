import assert from "node:assert/strict";
import test from "node:test";
import {
  findMatchingRecentFeedbackMessage,
  getFeedbackAuthorizationHeaders,
  getFeedbackIdentityIntent
} from "./feedbackAuth";

test("已登入且選暱稱時沒有 token 不可降級成匿名", () => {
  assert.equal(
    getFeedbackIdentityIntent({ isAnonymous: false, hasUser: true, accessToken: null }),
    "authentication-pending"
  );
});

test("已登入匿名留言仍帶登入 token，公開顯示與版主識別分開", () => {
  assert.equal(
    getFeedbackIdentityIntent({ isAnonymous: true, hasUser: true, accessToken: "token" }),
    "authenticated"
  );
  assert.equal(
    getFeedbackIdentityIntent({ isAnonymous: true, hasUser: true, accessToken: null }),
    "authentication-pending"
  );
});

test("訪客留言使用匿名身分", () => {
  assert.equal(
    getFeedbackIdentityIntent({ isAnonymous: false, hasUser: false, accessToken: null }),
    "anonymous"
  );
});

test("登入 token 以 Authorization header 傳給 API", () => {
  assert.equal(
    getFeedbackIdentityIntent({ isAnonymous: false, hasUser: true, accessToken: "token" }),
    "authenticated"
  );
  assert.deepEqual(getFeedbackAuthorizationHeaders(" token "), {
    Authorization: "Bearer token"
  });
});

test("送出逾時後能從最新留言確認其實已成功", () => {
  const createdAt = new Date("2026-08-24T00:00:30.000Z").toISOString();
  const match = findMatchingRecentFeedbackMessage(
    [
      {
        id: "root",
        content: "原留言",
        createdAt,
        replies: [
          {
            id: "reply",
            parentId: "root",
            content: "已經送出的回覆",
            createdAt
          }
        ]
      }
    ],
    {
      content: " 已經送出的回覆 ",
      parentId: "root",
      createdAfter: Date.parse("2026-08-24T00:00:00.000Z")
    }
  );

  assert.equal(match?.id, "reply");
});

test("不會把舊留言或不同樓層誤認為剛送出", () => {
  const messages = [
    {
      id: "old",
      content: "同一句話",
      createdAt: "2026-08-23T23:00:00.000Z"
    },
    {
      id: "other-parent",
      parentId: "another-root",
      content: "同一句話",
      createdAt: "2026-08-24T00:00:30.000Z"
    }
  ];

  assert.equal(
    findMatchingRecentFeedbackMessage(messages, {
      content: "同一句話",
      parentId: "root",
      createdAfter: Date.parse("2026-08-24T00:00:00.000Z")
    }),
    null
  );
});
