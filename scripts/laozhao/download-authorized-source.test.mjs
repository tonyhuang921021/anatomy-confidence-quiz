import assert from "node:assert/strict";
import test from "node:test";
import { buildDownloadPlan } from "./download-authorized-source.mjs";

const manifest = {
  videos: [
    {
      id: "ATFBb25QRNw",
      title: "2016DF01-01",
      availability: "available"
    }
  ]
};

test("下載計畫只接受已確認授權且存在於官方清單的影片", () => {
  assert.throws(
    () => buildDownloadPlan({ manifest, videoId: "ATFBb25QRNw", rightsConfirmed: undefined }),
    /LAOZHAO_CONTENT_RIGHTS_CONFIRMED/
  );
  assert.throws(
    () => buildDownloadPlan({ manifest, videoId: "abcdefghijk", rightsConfirmed: "true" }),
    /找不到影片/
  );
});

test("下載計畫固定輸出私人 staging 且限制最高畫質", () => {
  const plan = buildDownloadPlan({
    manifest,
    videoId: "ATFBb25QRNw",
    rightsConfirmed: "true",
    maxHeight: 1080
  });
  assert.match(plan.outputTemplate, /data\/laozhao\/staging\/ATFBb25QRNw\/source/);
  assert.equal(plan.format, "bv*[height<=1080]+ba/b[height<=1080]");
  assert.equal(plan.remoteComponent, "ejs:github");
  assert.equal(plan.watchUrl, "https://www.youtube.com/watch?v=ATFBb25QRNw");
});
