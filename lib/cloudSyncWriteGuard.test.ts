import assert from "node:assert/strict";
import test from "node:test";
import {
  chooseNewestTimestampedRecord,
  getCloudSyncRetryDelayMs,
  mergeSavedQuestionSyncRecords,
  shouldUpsertLocalRecord
} from "./cloudSyncWriteGuard";

type TestRecord = {
  id: string;
  value: number;
  updatedAt: string;
};

const sameContent = (left: TestRecord, right: TestRecord) =>
  left.id === right.id && left.value === right.value;

test("相同時間且內容相同的同步紀錄不應重寫", () => {
  const record = { id: "q-1", value: 2, updatedAt: "2026-07-10T03:00:00.000Z" };

  assert.equal(shouldUpsertLocalRecord(record, { ...record }, sameContent), false);
});

test("本機較新或同時間但內容不同時仍要上傳", () => {
  const cloud = { id: "q-1", value: 1, updatedAt: "2026-07-10T03:00:00.000Z" };

  assert.equal(
    shouldUpsertLocalRecord(
      { id: "q-1", value: 2, updatedAt: "2026-07-10T03:01:00.000Z" },
      cloud,
      sameContent
    ),
    true
  );
  assert.equal(
    shouldUpsertLocalRecord(
      { id: "q-1", value: 2, updatedAt: cloud.updatedAt },
      cloud,
      sameContent
    ),
    true
  );
});

test("內容相同時不會只為了較新的時間戳反覆重寫", () => {
  const cloud = { id: "q-1", value: 2, updatedAt: "2026-07-10T03:00:00.000Z" };
  const local = { ...cloud, updatedAt: "2026-07-10T03:01:00.000Z" };

  assert.equal(shouldUpsertLocalRecord(local, cloud, sameContent), false);
});

test("雲端較新時不可被舊本機紀錄覆蓋", () => {
  assert.equal(
    shouldUpsertLocalRecord(
      { id: "q-1", value: 9, updatedAt: "2026-07-10T03:00:00.000Z" },
      { id: "q-1", value: 1, updatedAt: "2026-07-10T03:01:00.000Z" },
      sameContent
    ),
    false
  );
});

test("複習狀態同時間衝突時保留雲端，只有本機較新才採用本機", () => {
  const cloud = { id: "q-1", value: 1, updatedAt: "2026-07-10T03:00:00.000Z" };
  const equalLocal = { ...cloud, value: 2 };
  const newerLocal = { ...equalLocal, updatedAt: "2026-07-10T03:01:00.000Z" };

  assert.equal(chooseNewestTimestampedRecord(cloud, equalLocal), cloud);
  assert.equal(chooseNewestTimestampedRecord(cloud, newerLocal), newerLocal);
});

test("儲存題目跨裝置合併不會讓較完整計數倒退", () => {
  const cloud = {
    questionId: "q-1",
    source: "quiz" as const,
    addedAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-10T03:01:00.000Z",
    correctCount: 2,
    attempts: 5,
    lastAnsweredAt: "2026-07-10T03:01:00.000Z"
  };
  const olderLocal = {
    ...cloud,
    updatedAt: "2026-07-10T03:00:00.000Z",
    correctCount: 1,
    attempts: 3,
    lastAnsweredAt: "2026-07-10T03:00:00.000Z"
  };

  assert.deepEqual(mergeSavedQuestionSyncRecords(cloud, olderLocal), cloud);
});

test("儲存題目同時間衝突時只補上較完整欄位，不丟失雲端資料", () => {
  const cloud = {
    questionId: "q-1",
    source: "results" as const,
    addedAt: "2026-07-02T00:00:00.000Z",
    updatedAt: "2026-07-10T03:00:00.000Z",
    correctCount: 2,
    attempts: 4,
    lastAnsweredAt: "2026-07-09T03:00:00.000Z"
  };
  const local = {
    questionId: "q-1",
    source: "review" as const,
    addedAt: "2026-07-01T00:00:00.000Z",
    updatedAt: cloud.updatedAt,
    correctCount: 1,
    attempts: 5,
    lastAnsweredAt: "2026-07-10T03:00:00.000Z"
  };

  assert.deepEqual(mergeSavedQuestionSyncRecords(cloud, local), {
    ...cloud,
    addedAt: local.addedAt,
    attempts: 5,
    lastAnsweredAt: local.lastAnsweredAt
  });
});

test("重度使用者的相同紀錄不會因筆數多而整批重寫", () => {
  const cloudRecords = Array.from({ length: 5000 }, (_, index) => ({
    id: `q-${index}`,
    value: index,
    updatedAt: "2026-07-10T03:00:00.000Z"
  }));
  const writes = cloudRecords.filter((cloudRecord) =>
    shouldUpsertLocalRecord({ ...cloudRecord }, cloudRecord, sameContent)
  );

  assert.equal(writes.length, 0);
});

test("同步失敗退避會逐步增加並封頂", () => {
  assert.equal(getCloudSyncRetryDelayMs(0, { randomValue: 0.5 }), 15_000);
  assert.equal(getCloudSyncRetryDelayMs(1, { randomValue: 0.5 }), 30_000);
  assert.equal(getCloudSyncRetryDelayMs(2, { randomValue: 0.5 }), 60_000);
  assert.equal(getCloudSyncRetryDelayMs(20, { randomValue: 0.5 }), 300_000);
  assert.equal(getCloudSyncRetryDelayMs(20, { randomValue: 1 }), 300_000);
});
