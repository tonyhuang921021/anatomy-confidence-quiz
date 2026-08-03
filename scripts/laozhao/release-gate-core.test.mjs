import assert from "node:assert/strict";
import test from "node:test";
import { evaluatePreviewReleaseGate } from "./release-gate-core.mjs";

test("production 含有 Preview manifest 時阻擋", () => {
  const result = evaluatePreviewReleaseGate({
    vercelEnv: "production",
    previewVideoCount: 1,
    publicBoardAssetCount: 0
  });
  assert.equal(result.blocked, true);
});

test("production 只有板書資產時仍阻擋", () => {
  const result = evaluatePreviewReleaseGate({
    vercelEnv: "production",
    previewVideoCount: 0,
    publicBoardAssetCount: 1
  });
  assert.equal(result.blocked, true);
});

test("Preview 與不含測試教材的 production 可通過", () => {
  assert.equal(evaluatePreviewReleaseGate({
    vercelEnv: "preview",
    previewVideoCount: 1,
    publicBoardAssetCount: 22
  }).blocked, false);
  assert.equal(evaluatePreviewReleaseGate({
    vercelEnv: "production",
    previewVideoCount: 0,
    publicBoardAssetCount: 0
  }).blocked, false);
});
