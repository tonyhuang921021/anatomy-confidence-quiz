import assert from "node:assert/strict";
import test from "node:test";
import {
  applySubtitleProofreading,
  buildSubtitleProofreadingPackage,
  captionFingerprint,
  findNonTaiwanCaptions
} from "./subtitle-proofreading-core.mjs";

const captions = [
  { id: "cue-00001", startSec: 0, endSec: 2, text: "这边是胸腔" },
  { id: "cue-00002", startSec: 2, endSec: 4, text: "Mediastinum 是縱隔" }
];

test("找出簡體字幕並提供臺灣繁體建議", () => {
  const issues = findNonTaiwanCaptions(captions);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].convertedText, "這邊是胸腔");
});

test("臺灣醫學慣用字不會被誤判，偏好字形會正規化", () => {
  const approvedCaptions = [
    { id: "cue-00011", startSec: 0, endSec: 2, text: "顳骨岩部與大岩神經、小岩神經" },
    { id: "cue-00012", startSec: 2, endSec: 4, text: "後面是腭骨" }
  ];
  assert.deepEqual(findNonTaiwanCaptions(approvedCaptions), []);

  const result = applySubtitleProofreading(approvedCaptions, {
    schemaVersion: "1.0.0",
    videoId: "ATFBb25QRNw",
    captionFingerprint: captionFingerprint(approvedCaptions),
    reviewStatus: "proofread_candidate",
    corrections: [{
      captionId: "cue-00012",
      correctedText: "講台後面是齶骨與鼻梁，去念這一段",
      changeTypes: ["traditional_chinese", "recognition_error"],
      rationale: "統一臺灣偏好字形與醫學用字"
    }],
    unresolved: []
  }, { videoId: "ATFBb25QRNw" });
  assert.equal(result[1].text, "講臺後面是腭骨與鼻樑，去唸這一段");
});

test("套用 Chat 校對時保留字幕 ID 與時間", () => {
  const result = applySubtitleProofreading(captions, {
    schemaVersion: "1.0.0",
    videoId: "ATFBb25QRNw",
    captionFingerprint: captionFingerprint(captions),
    reviewStatus: "proofread_candidate",
    corrections: [{
      captionId: "cue-00001",
      correctedText: "這邊是胸腔",
      changeTypes: ["traditional_chinese"],
      rationale: "簡體轉臺灣繁體"
    }],
    unresolved: []
  }, { videoId: "ATFBb25QRNw" });
  assert.equal(result[0].text, "這邊是胸腔");
  assert.equal(result[0].startSec, 0);
  assert.equal(result[1].text, captions[1].text);
});

test("舊版回覆與仍含簡體字都會被阻擋", () => {
  const base = {
    schemaVersion: "1.0.0",
    videoId: "ATFBb25QRNw",
    captionFingerprint: captionFingerprint(captions),
    reviewStatus: "proofread_candidate",
    corrections: [],
    unresolved: []
  };
  assert.throws(() => applySubtitleProofreading(captions, {
    ...base,
    captionFingerprint: "a".repeat(64)
  }, { videoId: "ATFBb25QRNw" }), /不是針對目前這版字幕/);
  assert.throws(() => applySubtitleProofreading(captions, base, {
    videoId: "ATFBb25QRNw"
  }), /不是臺灣繁體中文/);
});

test("校對包包含規則、章節與完整時間碼字幕", () => {
  const output = buildSubtitleProofreadingPackage({
    videoId: "ATFBb25QRNw",
    title: "測試影片",
    chapters: [{
      id: "ATFBb25QRNw-ch-001",
      title: "胸腔",
      startSec: 0,
      endSec: 4,
      summary: "胸腔與縱隔",
      tags: ["胸腔"]
    }],
    captions
  });
  assert.match(output, /所有中文一律使用臺灣繁體中文/);
  assert.match(output, /ATFBb25QRNw-ch-001/);
  assert.match(output, /cue-00001/);
  assert.match(output, /cue-00002/);
});
