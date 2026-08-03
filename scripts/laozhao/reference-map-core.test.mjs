import assert from "node:assert/strict";
import test from "node:test";
import { validateReferenceMap } from "./reference-map-core.mjs";

const boardSelection = {
  videoId: "ATFBb25QRNw",
  chapters: [{
    chapterId: "ATFBb25QRNw-ch-001",
    frames: [{ candidateId: "frame-1", timeSec: 42 }]
  }]
};

const referenceMap = {
  schemaVersion: "1.1.0",
  videoId: "ATFBb25QRNw",
  visibility: "private_reference_only",
  source: {
    sha256: "a".repeat(64),
    pageCount: 12,
    publicationPermission: "not_confirmed"
  },
  boardFrameMappings: [{
    boardFrameId: "frame-1",
    chapterId: "ATFBb25QRNw-ch-001",
    videoTimeSec: 42,
    referenceImages: [{
      referenceImageId: "notes-p006-overview",
      pdfPage: 6,
      pageRegion: "中央圖",
      matchedStructures: ["胸腔"]
    }]
  }]
};

test("逐張板書與私人筆記對照完整時通過", () => {
  const result = validateReferenceMap(referenceMap, boardSelection);
  assert.equal(result.valid, true);
  assert.equal(result.canPublishReferenceImages, false);
  assert.deepEqual(result.stats, {
    selectedBoardFrames: 1,
    mappedBoardFrames: 1,
    referenceImages: 1,
    pdfPages: [6]
  });
});

test("選定板書未對照時停止", () => {
  const result = validateReferenceMap({ ...referenceMap, boardFrameMappings: [] }, boardSelection);
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /尚未對照筆記/);
});

test("時間碼、章節與頁碼錯位時停止", () => {
  const result = validateReferenceMap({
    ...referenceMap,
    boardFrameMappings: [{
      ...referenceMap.boardFrameMappings[0],
      chapterId: "ATFBb25QRNw-ch-002",
      videoTimeSec: 43,
      referenceImages: [{
        ...referenceMap.boardFrameMappings[0].referenceImages[0],
        pdfPage: 13
      }]
    }]
  }, boardSelection);
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /章節不一致/);
  assert.match(result.errors.join("\n"), /時間碼不一致/);
  assert.match(result.errors.join("\n"), /頁碼超出範圍/);
});
