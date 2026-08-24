import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import {
  extractResponseText,
  loadHandoffJob,
  progressDigest,
  sha256,
  supervisorReportMarkdown,
  validateDraftAgainstJob,
  validateProgressEvent
} from "./handoff-runtime.mjs";

async function createJobFixture() {
  const cwd = await mkdtemp(resolve(tmpdir(), "laozhao-handoff-"));
  const jobDir = resolve(cwd, "jobs/ATFBb25QRNw/ATFBb25QRNw-aaaaaaaaaaaaaaaa");
  await mkdir(resolve(jobDir, "input"), { recursive: true });
  const transcriptVtt = "WEBVTT\n\n1\n00:00:00.000 --> 00:00:10.000\n臂神經叢\n";
  const job = {
    schemaVersion: "1.0.0",
    pipelineVersion: "laozhao-github-handoff-v1",
    task: "chapter_draft",
    jobId: "ATFBb25QRNw-aaaaaaaaaaaaaaaa",
    videoId: "ATFBb25QRNw",
    videoTitle: "示範",
    durationSec: 600,
    sourceFingerprint: "a".repeat(64),
    transcriptSha256: sha256(transcriptVtt),
    transcriptFile: "input/transcript.private.vtt",
    rightsStatus: "private_only",
    reviewStatus: "unreviewed",
    createdAt: "2026-08-03T00:00:00.000Z"
  };
  await writeFile(resolve(jobDir, "input/job.json"), JSON.stringify(job));
  await writeFile(resolve(jobDir, "input/transcript.private.vtt"), transcriptVtt);
  return { cwd, jobDir, job, transcriptVtt };
}

test("只能載入 jobs 內且指紋相符的私人逐字稿", async () => {
  const fixture = await createJobFixture();
  const loaded = await loadHandoffJob(
    "jobs/ATFBb25QRNw/ATFBb25QRNw-aaaaaaaaaaaaaaaa",
    { cwd: fixture.cwd }
  );
  assert.equal(loaded.job.jobId, fixture.job.jobId);
  assert.equal(loaded.transcriptVtt, fixture.transcriptVtt);
  await assert.rejects(() => loadHandoffJob("../outside", { cwd: fixture.cwd }), /不可離開/);
});

test("可解析 Responses API 的 output_text", () => {
  const parsed = extractResponseText({
    output: [{ content: [{ type: "output_text", text: "{\"ok\":true}" }] }]
  });
  assert.equal(parsed, "{\"ok\":true}");
});

test("章節草稿會檢查來源、順序與板書時間", () => {
  const job = {
    videoId: "ATFBb25QRNw",
    sourceFingerprint: "a".repeat(64),
    durationSec: 600
  };
  const draft = {
    schemaVersion: "1.0.0",
    videoId: job.videoId,
    sourceFingerprint: job.sourceFingerprint,
    chapters: [{
      title: "臂神經叢",
      startSec: 0,
      endSec: 600,
      summary: "",
      tags: [],
      representativeFrameTargetSec: 500,
      reviewStatus: "draft"
    }]
  };
  assert.doesNotThrow(() => validateDraftAgainstJob(draft, job));
  assert.throws(
    () => validateDraftAgainstJob({
      ...draft,
      chapters: [{ ...draft.chapters[0], representativeFrameTargetSec: 600 }]
    }, job),
    /板書目標時間/
  );
});

test("進度事件與監督摘要保留工作指紋和具體建議", () => {
  const job = {
    jobId: "ATFBb25QRNw-aaaaaaaaaaaaaaaa",
    videoId: "ATFBb25QRNw",
    sourceFingerprint: "a".repeat(64)
  };
  const event = {
    schemaVersion: "1.0.0",
    jobId: job.jobId,
    videoId: job.videoId,
    sourceFingerprint: job.sourceFingerprint,
    sequence: 10,
    stage: "plan",
    status: "completed",
    summary: "完成計畫",
    recordedAt: "2026-08-03T00:00:00.000Z"
  };
  assert.doesNotThrow(() => validateProgressEvent(event, job));
  const digest = progressDigest({
    job,
    stage: "plan",
    events: [event],
    artifacts: {},
    transcriptIncluded: false
  });
  assert.match(digest, /^[a-f0-9]{64}$/);
  const markdown = supervisorReportMarkdown({
    verdict: "changes_requested",
    summary: "需要補驗證。",
    risks: [{ severity: "high", finding: "缺少測試", recommendation: "執行測試" }],
    recommendations: ["補上來源指紋檢查"],
    nextCheckpoint: "完成測試後重審"
  });
  assert.match(markdown, /需修改/);
  assert.match(markdown, /完成測試後重審/);
});
