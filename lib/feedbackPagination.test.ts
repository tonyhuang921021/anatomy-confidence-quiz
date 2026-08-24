import assert from "node:assert/strict";
import test from "node:test";
import type { FeedbackMessage } from "../types/quiz";
import {
  addFeedbackReply,
  buildFeedbackTree,
  compareFeedbackIds,
  getFeedbackPageCacheKey,
  mergeFeedbackMessagePages,
  normalizeFeedbackCursor,
  sanitizeFeedbackMessagePrivacy,
  shouldResetFeedbackPageCursor,
  takeFeedbackRootPage,
  type FeedbackMessageRow
} from "./feedbackPagination";

function row(id: number, parentId?: number): FeedbackMessageRow {
  return {
    id,
    content: `message-${id}`,
    parent_id: parentId ?? null,
    display_name: null,
    is_anonymous: true,
    created_at: `2026-08-25T00:${String(id).padStart(2, "0")}:00.000Z`
  };
}

function message(id: string, replies: FeedbackMessage[] = []): FeedbackMessage {
  return {
    id,
    content: `message-${id}`,
    isAnonymous: true,
    createdAt: `2026-08-25T00:00:${id.padStart(2, "0")}.000Z`,
    likeCount: 0,
    dislikeCount: 0,
    replies
  };
}

test("根留言每頁恰好十筆，cursor 指向第十筆且下一頁不重疊", () => {
  const roots = Array.from({ length: 11 }, (_, index) => row(11 - index));
  const firstPage = takeFeedbackRootPage(roots, 10);
  assert.deepEqual(firstPage.rows.map((entry) => String(entry.id)), [
    "11", "10", "9", "8", "7", "6", "5", "4", "3", "2"
  ]);
  assert.equal(firstPage.hasMore, true);
  assert.equal(firstPage.nextCursor, "2");

  const secondPage = takeFeedbackRootPage(roots.filter((entry) => Number(entry.id) < 2), 10);
  assert.deepEqual(secondPage.rows.map((entry) => String(entry.id)), ["1"]);
  assert.equal(secondPage.hasMore, false);
  assert.equal(secondPage.nextCursor, null);
});

test("回覆不占根留言額度且同一根留言的完整回覆依時間與數值 ID 排序", () => {
  const roots = Array.from({ length: 10 }, (_, index) => row(20 - index));
  const replies = Array.from({ length: 24 }, (_, index) => ({
    ...row(100 + index, 20),
    created_at: index < 2 ? "2026-08-25T01:00:00.000Z" : `2026-08-25T01:${String(index).padStart(2, "0")}:00.000Z`
  })).reverse();
  const tree = buildFeedbackTree(roots, replies);

  assert.equal(tree.length, 10);
  assert.equal(tree[0].replies?.length, 24);
  assert.deepEqual(tree[0].replies?.slice(0, 3).map((entry) => entry.id), ["100", "101", "102"]);
  assert.equal(tree[1].replies?.length, 0);
});

test("數字字串 ID 依數值排序，不會把 9 排在 10 或 11 前面", () => {
  assert.ok(compareFeedbackIds("9", "10") < 0);
  assert.ok(compareFeedbackIds("10", "11") < 0);
  assert.equal(compareFeedbackIds("00011", "11"), 0);
});

test("cache key 會區分首頁與不同 cursor", () => {
  assert.equal(getFeedbackPageCacheKey(10), "10:first");
  assert.equal(getFeedbackPageCacheKey(10, "101"), "10:101");
  assert.notEqual(getFeedbackPageCacheKey(10, "101"), getFeedbackPageCacheKey(10, "91"));
});

test("cursor 不接受超過 PostgreSQL bigint 的值", () => {
  assert.equal(normalizeFeedbackCursor("9223372036854775807"), "9223372036854775807");
  assert.equal(normalizeFeedbackCursor("9223372036854775808"), null);
});

test("匿名留言即使舊資料殘留暱稱，也不會出現在公開資料", () => {
  const [message] = buildFeedbackTree(
    [{ ...row(20), display_name: "不該公開的暱稱", is_anonymous: true }],
    []
  );
  assert.equal(message.displayName, undefined);
});

test("舊瀏覽器快取中的匿名主串與回覆也會清掉殘留暱稱", () => {
  const cached = sanitizeFeedbackMessagePrivacy({
    ...message("20", [
      { ...message("21"), parentId: "20", displayName: "舊回覆暱稱" }
    ]),
    displayName: "舊主串暱稱"
  });

  assert.equal(cached.displayName, undefined);
  assert.equal(cached.replies?.[0].displayName, undefined);
});

test("head refresh 與舊頁以 ID 合併，保留本機新增項目並更新伺服器票數", () => {
  const localRoot = message("12");
  const firstPage = [message("11"), message("10")];
  const olderPage = [message("9")];
  const refreshed = { ...message("11"), likeCount: 4 };

  const merged = mergeFeedbackMessagePages(
    mergeFeedbackMessagePages([localRoot], [...firstPage, ...olderPage]),
    [refreshed]
  );

  assert.deepEqual(merged.map((entry) => entry.id), ["12", "11", "10", "9"]);
  assert.equal(merged.find((entry) => entry.id === "11")?.likeCount, 4);
});

test("新 head 與已載入頁完全不重疊時會重設游標，避免跳過中間頁", () => {
  const current = Array.from({ length: 10 }, (_, index) => message(String(100 - index)));
  const overlappingHead = Array.from({ length: 10 }, (_, index) => message(String(101 - index)));
  const disconnectedHead = Array.from({ length: 10 }, (_, index) => message(String(111 - index)));

  assert.equal(
    shouldResetFeedbackPageCursor(current, overlappingHead, {
      establishing: false,
      degraded: false
    }),
    false
  );
  assert.equal(
    shouldResetFeedbackPageCursor(current, disconnectedHead, {
      establishing: false,
      degraded: false
    }),
    true
  );
  assert.equal(
    shouldResetFeedbackPageCursor(current, disconnectedHead, {
      establishing: false,
      degraded: true
    }),
    false
  );
});

test("新回覆加入既有串時去重並保留依時間排序", () => {
  const root = message("20", [message("101")]);
  const reply = { ...message("100"), parentId: "20", createdAt: "2026-08-25T00:00:00.000Z" };
  const next = addFeedbackReply([root], "20", reply);

  assert.deepEqual(next[0].replies?.map((entry) => entry.id), ["100", "101"]);
  assert.deepEqual(
    addFeedbackReply(next, "20", reply)[0].replies?.map((entry) => entry.id),
    ["100", "101"]
  );
});
