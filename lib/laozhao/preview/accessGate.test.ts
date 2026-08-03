import assert from "node:assert/strict";
import test from "node:test";
import {
  isLaoZhaoPreviewPath,
  isProductionRequest,
  shouldBlockLaoZhaoPreviewRequest
} from "./accessGate";

test("辨識課程頁與 Preview 板書資產路徑", () => {
  assert.equal(isLaoZhaoPreviewPath("/courses/laozhao-anatomy"), true);
  assert.equal(isLaoZhaoPreviewPath("/courses/laozhao-anatomy/watch/ATFBb25QRNw"), true);
  assert.equal(isLaoZhaoPreviewPath("/laozhao-preview/ATFBb25QRNw/boards/frame.png"), true);
  assert.equal(isLaoZhaoPreviewPath("/quiz"), false);
});

test("production 環境或正式網域都視為正式請求", () => {
  assert.equal(isProductionRequest("preview.example", { VERCEL_ENV: "production" }), true);
  assert.equal(isProductionRequest("anatomy-confidence-quiz.vercel.app", { VERCEL_ENV: "preview" }), true);
  assert.equal(isProductionRequest("quiz.example.com:443", {
    VERCEL_ENV: "preview",
    VERCEL_PROJECT_PRODUCTION_URL: "https://quiz.example.com"
  }), true);
  assert.equal(isProductionRequest("branch-project.vercel.app", { VERCEL_ENV: "preview" }), false);
  assert.equal(isProductionRequest("127.0.0.1:3003", { VERCEL_ENV: "preview" }), false);
});

test("正式網域會同時封鎖頁面與直接板書網址", () => {
  const env = { VERCEL_ENV: "preview" };
  assert.equal(shouldBlockLaoZhaoPreviewRequest({
    pathname: "/courses/laozhao-anatomy",
    host: "anatomy-confidence-quiz.vercel.app",
    env
  }), true);
  assert.equal(shouldBlockLaoZhaoPreviewRequest({
    pathname: "/laozhao-preview/ATFBb25QRNw/boards/frame.png",
    host: "anatomy-confidence-quiz.vercel.app",
    env
  }), true);
  assert.equal(shouldBlockLaoZhaoPreviewRequest({
    pathname: "/",
    host: "anatomy-confidence-quiz.vercel.app",
    env
  }), false);
});
