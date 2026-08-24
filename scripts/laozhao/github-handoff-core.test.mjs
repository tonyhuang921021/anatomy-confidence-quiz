import assert from "node:assert/strict";
import test from "node:test";
import {
  assertMatchingHandoffResult,
  buildGithubHandoffJob,
  handoffJobRelativePath,
  sha256
} from "./github-handoff-core.mjs";

const transcript = {
  generatedAt: "2026-08-03T12:00:00.000Z",
  videoId: "ATFBb25QRNw",
  videoTitle: "2016DF01-01",
  durationSec: 6822,
  sourceFingerprint: "a".repeat(64),
  rightsStatus: "private_only"
};

test("接力工作 ID 由影片與逐字稿指紋穩定產生", () => {
  const vtt = "WEBVTT\n\n1\n00:00:00.000 --> 00:00:02.000\n上肢解剖\n";
  const job = buildGithubHandoffJob(transcript, vtt);
  assert.equal(job.jobId, "ATFBb25QRNw-aaaaaaaaaaaaaaaa");
  assert.equal(job.transcriptSha256, sha256(vtt));
  assert.equal(handoffJobRelativePath(job), "jobs/ATFBb25QRNw/ATFBb25QRNw-aaaaaaaaaaaaaaaa");
});

test("不是 private_only 的逐字稿不能匯出", () => {
  assert.throws(
    () => buildGithubHandoffJob({ ...transcript, rightsStatus: "public" }, "WEBVTT\n"),
    /private_only/
  );
});

test("匯入時會攔截拿錯影片或拿錯逐字稿的結果", () => {
  const job = buildGithubHandoffJob(transcript, "WEBVTT\n");
  const report = {
    status: "completed",
    jobId: job.jobId,
    videoId: job.videoId,
    sourceFingerprint: job.sourceFingerprint,
    transcriptSha256: job.transcriptSha256
  };
  const draft = {
    schemaVersion: "1.0.0",
    videoId: job.videoId,
    sourceFingerprint: job.sourceFingerprint,
    chapters: []
  };
  assert.doesNotThrow(() => assertMatchingHandoffResult({ job, report, draft }));
  assert.throws(
    () => assertMatchingHandoffResult({
      job,
      report: { ...report, sourceFingerprint: "b".repeat(64) },
      draft
    }),
    /指紋不一致/
  );
});
