import assert from "node:assert/strict";
import test from "node:test";
import {
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
