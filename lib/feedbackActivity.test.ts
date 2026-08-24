import assert from "node:assert/strict";
import test from "node:test";
import {
  EMPTY_FEEDBACK_ACTIVITY_STATE,
  applyFeedbackActivityPage,
  countUnreadFeedbackActivities,
  excludeOwnFeedbackActivity,
  markFeedbackActivitiesRead,
  mergeFeedbackActivityStates,
  reconcileOwnFeedbackActivities,
  shouldShowFeedbackBrowserNotification,
  type FeedbackActivityState
} from "./feedbackActivity";
import type { FeedbackActivity } from "../types/quiz";

function activity(id: string, type: "root" | "reply" = "root", isOwn = false): FeedbackActivity {
  return {
    id,
    type,
    content: `activity-${id}`,
    parentId: type === "reply" ? "90" : undefined,
    isAnonymous: true,
    isOwn,
    createdAt: `2026-08-25T00:00:${id.slice(-2).padStart(2, "0")}.000Z`
  };
}

test("首次 bootstrap 只建立 baseline，不把歷史算成未讀", () => {
  const result = applyFeedbackActivityPage(EMPTY_FEEDBACK_ACTIVITY_STATE, {
    activities: [],
    nextCursor: "100",
    hasMore: false
  });
  assert.equal(result.state.cursor, "100");
  assert.equal(result.state.readCursor, "100");
  assert.equal(countUnreadFeedbackActivities(result.state), 0);
});

test("自己建立的事件不顯示，但掃描 cursor 仍前進", () => {
  const current: FeedbackActivityState = {
    cursor: "100",
    readCursor: "100",
    activityCount: 0,
    readActivityCount: 0,
    activities: []
  };
  const result = applyFeedbackActivityPage(current, {
    activities: [activity("101"), activity("102", "reply"), activity("103", "root", true)],
    nextCursor: "103",
    hasMore: false
  });

  assert.deepEqual(result.state.activities.map((entry) => entry.id), ["102", "101"]);
  assert.equal(result.state.cursor, "103");
  assert.equal(countUnreadFeedbackActivities(result.state), 2);
});

test("本機 own ID 會被過濾，重播重疊頁也不重複計數或倒退 cursor", () => {
  const current: FeedbackActivityState = {
    cursor: "100",
    readCursor: "100",
    activityCount: 0,
    readActivityCount: 0,
    activities: []
  };
  const first = applyFeedbackActivityPage(
    current,
    {
      activities: [activity("101"), activity("102")],
      nextCursor: "102",
      hasMore: false
    },
    new Set(["102"])
  );
  const replay = applyFeedbackActivityPage(first.state, {
    activities: [activity("101")],
    nextCursor: "101",
    hasMore: false
  });

  assert.deepEqual(replay.state.activities.map((entry) => entry.id), ["101"]);
  assert.equal(replay.state.cursor, "102");
  assert.equal(replay.addedActivities.length, 0);
  assert.equal(countUnreadFeedbackActivities(replay.state), 1);
});

test("打開通知面板會把目前 cursor 標成已讀", () => {
  const state: FeedbackActivityState = {
    cursor: "102",
    readCursor: "100",
    activityCount: 2,
    readActivityCount: 0,
    activities: [activity("102", "reply"), activity("101")]
  };
  const read = markFeedbackActivitiesRead(state);
  assert.equal(read.readCursor, "102");
  assert.equal(countUnreadFeedbackActivities(read), 0);
});

test("多頁追趕超過二十則時，preview 保持精簡但未讀總數不會少算", () => {
  let state: FeedbackActivityState = {
    cursor: "100",
    readCursor: "100",
    activityCount: 0,
    readActivityCount: 0,
    activities: []
  };

  for (let start = 101; start <= 131; start += 15) {
    const end = Math.min(145, start + 14);
    state = applyFeedbackActivityPage(state, {
      activities: Array.from({ length: end - start + 1 }, (_, index) => activity(String(start + index))),
      nextCursor: String(end),
      hasMore: end < 145
    }).state;
  }

  assert.equal(state.cursor, "145");
  assert.equal(state.activities.length, 20);
  assert.equal(countUnreadFeedbackActivities(state), 45);
});

test("跨分頁合併會保留較新的已讀進度，不讓未讀倒退", () => {
  const pollingTab: FeedbackActivityState = {
    cursor: "151",
    readCursor: "100",
    activityCount: 51,
    readActivityCount: 0,
    activities: [activity("151"), activity("150")]
  };
  const readingTab: FeedbackActivityState = {
    cursor: "150",
    readCursor: "150",
    activityCount: 50,
    readActivityCount: 50,
    activities: [activity("150"), activity("149")]
  };

  const merged = mergeFeedbackActivityStates(pollingTab, readingTab);
  assert.equal(merged.cursor, "151");
  assert.equal(merged.readCursor, "150");
  assert.deepEqual(merged.activities.map((entry) => entry.id), ["151", "150", "149"]);
  assert.equal(countUnreadFeedbackActivities(merged), 1);
});

test("較晚收到自己的建立事件時，會從 preview 與未讀計數移除", () => {
  const state: FeedbackActivityState = {
    cursor: "103",
    readCursor: "100",
    activityCount: 3,
    readActivityCount: 0,
    activities: [activity("103"), activity("102"), activity("101")]
  };

  const filtered = excludeOwnFeedbackActivity(state, "103");
  assert.deepEqual(filtered.activities.map((entry) => entry.id), ["102", "101"]);
  assert.equal(countUnreadFeedbackActivities(filtered), 2);

  const readThenFiltered = excludeOwnFeedbackActivity(markFeedbackActivitiesRead(state), "103");
  assert.equal(countUnreadFeedbackActivities(readThenFiltered), 0);
});

test("跨分頁合併舊狀態後仍會排除自己建立的事件", () => {
  const staleTab: FeedbackActivityState = {
    cursor: "103",
    readCursor: "100",
    activityCount: 3,
    readActivityCount: 0,
    activities: [activity("103"), activity("102"), activity("101")]
  };
  const filteredTab = excludeOwnFeedbackActivity(staleTab, "103");
  const merged = mergeFeedbackActivityStates(filteredTab, staleTab);
  const reconciled = reconcileOwnFeedbackActivities(merged, new Set(["103"]));

  assert.deepEqual(reconciled.activities.map((entry) => entry.id), ["102", "101"]);
  assert.equal(countUnreadFeedbackActivities(reconciled), 2);
});

test("瀏覽器提醒只在已初始化、使用者開啟且 permission granted 時觸發", () => {
  const addedActivities = [activity("101")];
  assert.equal(
    shouldShowFeedbackBrowserNotification({
      initialized: true,
      enabled: true,
      permission: "granted",
      addedActivities
    }),
    true
  );
  for (const input of [
    { initialized: false, enabled: true, permission: "granted" as const, addedActivities },
    { initialized: true, enabled: false, permission: "granted" as const, addedActivities },
    { initialized: true, enabled: true, permission: "denied" as const, addedActivities },
    { initialized: true, enabled: true, permission: "unsupported" as const, addedActivities },
    { initialized: true, enabled: true, permission: "granted" as const, addedActivities: [] }
  ]) {
    assert.equal(shouldShowFeedbackBrowserNotification(input), false);
  }
});
