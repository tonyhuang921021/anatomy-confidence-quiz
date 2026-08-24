import assert from "node:assert/strict";
import test from "node:test";
import { buildBoardSelectionHydrationPlan } from "./board-selection-hydration-core.mjs";

const index = {
  videoId: "ATFBb25QRNw",
  sourceFingerprint: "a".repeat(64),
  boardCrop: { x: 5, y: 5, width: 1274, height: 714 },
  chapters: [{ chapterId: "ATFBb25QRNw-ch-001", startSec: 0, endSec: 100 }]
};

const selection = {
  videoId: "ATFBb25QRNw",
  sourceFingerprint: "a".repeat(64),
  chapters: [{
    chapterId: "ATFBb25QRNw-ch-001",
    frames: [{
      candidateId: "ATFBb25QRNw-ch-001-frame-03",
      sourcePath: "ATFBb25QRNw-ch-001/candidate-03-00-01-10.png",
      timeSec: 70
    }]
  }]
};

test("依人工保存時間碼建立可重建的板書影格計畫", () => {
  const result = buildBoardSelectionHydrationPlan(selection, index);
  assert.equal(result.valid, true);
  assert.equal(result.frames.length, 1);
  assert.equal(result.frames[0].timeSec, 70);
});

test("阻擋跨章時間與不安全輸出路徑", () => {
  const result = buildBoardSelectionHydrationPlan({
    ...selection,
    chapters: [{
      ...selection.chapters[0],
      frames: [{ ...selection.chapters[0].frames[0], sourcePath: "../outside.png", timeSec: 101 }]
    }]
  }, index);
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /sourcePath/);
  assert.match(result.errors.join("\n"), /超出章節範圍/);
});

test("阻擋不同來源指紋，避免拿新影片重建舊選圖", () => {
  const result = buildBoardSelectionHydrationPlan(selection, {
    ...index,
    sourceFingerprint: "b".repeat(64)
  });
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /來源指紋/);
});
