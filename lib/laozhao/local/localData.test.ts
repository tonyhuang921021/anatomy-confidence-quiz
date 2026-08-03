import assert from "node:assert/strict";
import test from "node:test";
import { mapLaoZhaoStorageError, LaoZhaoLocalError } from "./errors";
import { createLaoZhaoExportPayload } from "./export";
import { mergeProgressRecords, mergeWatchedRanges } from "./ranges";
import type { LaoZhaoProgressRecord } from "./types";
import {
  createLaoZhaoLocalRepository,
  getLaoZhaoLocalStorageStatus,
  resetLaoZhaoLocalRepositoryForTests
} from "./repository";

function progress(overrides: Partial<LaoZhaoProgressRecord> = {}): LaoZhaoProgressRecord {
  return {
    videoId: "video-1",
    lastPositionSec: 12,
    durationSec: 100,
    watchedRanges: [{ startSec: 0, endSec: 12 }],
    ended: false,
    updatedAt: 100,
    ...overrides
  };
}

test("watched ranges 會排序、合併重疊與極短間隔", () => {
  assert.deepEqual(
    mergeWatchedRanges(
      [{ startSec: 30, endSec: 40 }, { startSec: 0, endSec: 10 }],
      [{ startSec: 9.9, endSec: 20 }, { startSec: 40.1, endSec: 50 }]
    ),
    [{ startSec: 0, endSec: 20 }, { startSec: 30, endSec: 50 }]
  );
});

test("播放器重複送出累積觀看區間時，資料量不會跟 checkpoint 次數膨脹", () => {
  let ranges = [{ startSec: 0, endSec: 10 }];
  for (let checkpoint = 0; checkpoint < 120; checkpoint += 1) {
    ranges = mergeWatchedRanges(ranges, [
      { startSec: 0, endSec: 10 },
      { startSec: 10, endSec: 20 }
    ]);
  }

  assert.deepEqual(ranges, [{ startSec: 0, endSec: 20 }]);
});

test("較舊且較短的紀錄不會覆蓋完整 ranges、duration 或 ended", () => {
  const complete = progress({
    lastPositionSec: 90,
    durationSec: 120,
    watchedRanges: [
      { startSec: 0, endSec: 40 },
      { startSec: 60, endSec: 90 }
    ],
    ended: true,
    updatedAt: 200
  });
  const oldShort = progress({
    lastPositionSec: 10,
    durationSec: 100,
    watchedRanges: [{ startSec: 0, endSec: 10 }],
    ended: false,
    updatedAt: 100
  });

  assert.deepEqual(mergeProgressRecords(complete, oldShort), complete);
  assert.deepEqual(mergeProgressRecords(oldShort, complete), complete);
});

test("較新的位置可以更新游標，但 ranges 仍保留兩邊的完整內容", () => {
  const merged = mergeProgressRecords(
    progress({ lastPositionSec: 10, watchedRanges: [{ startSec: 0, endSec: 10 }], updatedAt: 100 }),
    progress({ lastPositionSec: 70, watchedRanges: [{ startSec: 60, endSec: 70 }], updatedAt: 200 })
  );

  assert.equal(merged.lastPositionSec, 70);
  assert.deepEqual(merged.watchedRanges, [
    { startSec: 0, endSec: 10 },
    { startSec: 60, endSec: 70 }
  ]);
});

test("export payload 固定包含完整三個 store 且不混入帳號資料", () => {
  const exported = createLaoZhaoExportPayload({
    exportedAt: 123,
    progress: [progress()],
    bookmarks: [
      {
        id: "bookmark-1",
        videoId: "video-1",
        atSec: 8,
        label: "重要",
        createdAt: 1,
        updatedAt: 2
      }
    ],
    notes: [
      {
        id: "note-1",
        videoId: "video-1",
        atSec: 9,
        label: "提醒",
        body: "純文字筆記",
        createdAt: 1,
        updatedAt: 2
      }
    ]
  });

  assert.equal(exported.schemaVersion, 1);
  assert.equal(exported.dbName, "laozhao-anatomy-learning");
  assert.equal(exported.exportedAt, 123);
  assert.equal(exported.progress.length, 1);
  assert.equal(exported.bookmarks.length, 1);
  assert.equal(exported.notes.length, 1);
  assert.equal("email" in exported, false);
  assert.equal("userId" in exported, false);
});

test("IndexedDB 錯誤會區分不可用、Safari 私密模式與 quota", () => {
  assert.equal(mapLaoZhaoStorageError({ name: "SecurityError" }, "open").code, "unavailable");
  assert.equal(
    mapLaoZhaoStorageError({ name: "InvalidStateError" }, "open").code,
    "private-mode"
  );
  assert.equal(
    mapLaoZhaoStorageError({ name: "QuotaExceededError" }, "write").code,
    "quota"
  );
  assert.ok(mapLaoZhaoStorageError({ name: "QuotaExceededError" }, "write") instanceof LaoZhaoLocalError);
});

test("沒有 IndexedDB 時改用本次瀏覽記憶體，且明確標示非永久保存", async () => {
  resetLaoZhaoLocalRepositoryForTests();
  const repository = createLaoZhaoLocalRepository();
  await repository.upsertProgress(progress());

  assert.equal((await repository.getProgress("video-1"))?.lastPositionSec, 12);
  assert.equal(getLaoZhaoLocalStorageStatus().mode, "memory");
  assert.match(getLaoZhaoLocalStorageStatus().message, /關閉分頁後可能不保留/);
});

test("永久資料庫不可用時，不會假裝完整匯出或完成部分刪除", async () => {
  resetLaoZhaoLocalRepositoryForTests();
  const repository = createLaoZhaoLocalRepository();
  await repository.upsertProgress(progress());

  await assert.rejects(() => repository.exportData(), /沒有建立不完整的匯出檔/);
  await assert.rejects(() => repository.clearAll(), /沒有執行部分刪除/);
  assert.equal((await repository.getProgress("video-1"))?.lastPositionSec, 12);
});
