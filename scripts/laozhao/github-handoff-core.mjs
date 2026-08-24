import { createHash } from "node:crypto";

const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function buildGithubHandoffJob(transcript, transcriptVtt) {
  if (!transcript || typeof transcript !== "object") {
    throw new Error("私人逐字稿格式無效。");
  }
  if (!VIDEO_ID_PATTERN.test(String(transcript.videoId ?? ""))) {
    throw new Error("私人逐字稿缺少有效的 videoId。");
  }
  if (!SHA256_PATTERN.test(String(transcript.sourceFingerprint ?? ""))) {
    throw new Error("私人逐字稿缺少有效的來源指紋。");
  }
  if (transcript.rightsStatus !== "private_only") {
    throw new Error("只有 private_only 逐字稿可以建立私有 GitHub 接力工作。");
  }
  if (!Number.isInteger(transcript.durationSec) || transcript.durationSec <= 0) {
    throw new Error("私人逐字稿缺少有效的影片長度。");
  }
  if (typeof transcriptVtt !== "string" || !transcriptVtt.startsWith("WEBVTT\n")) {
    throw new Error("私人 VTT 格式無效。");
  }

  const fingerprint = transcript.sourceFingerprint;
  const jobId = `${transcript.videoId}-${fingerprint.slice(0, 16)}`;
  return {
    schemaVersion: "1.0.0",
    pipelineVersion: "laozhao-github-handoff-v1",
    task: "chapter_draft",
    jobId,
    videoId: transcript.videoId,
    videoTitle: String(transcript.videoTitle ?? "").trim(),
    durationSec: transcript.durationSec,
    sourceFingerprint: fingerprint,
    transcriptSha256: sha256(transcriptVtt),
    transcriptFile: "input/transcript.private.vtt",
    rightsStatus: "private_only",
    reviewStatus: "unreviewed",
    createdAt: typeof transcript.generatedAt === "string"
      ? transcript.generatedAt
      : new Date(0).toISOString()
  };
}

export function handoffJobRelativePath(job) {
  return `jobs/${job.videoId}/${job.jobId}`;
}

export function assertMatchingHandoffResult({ job, report, draft }) {
  const errors = [];
  if (!job || typeof job !== "object") errors.push("缺少接力工作資訊。");
  if (!report || typeof report !== "object") errors.push("缺少 Chat 執行報告。");
  if (!draft || typeof draft !== "object") errors.push("缺少 Chat 章節草稿。");
  if (errors.length > 0) throw new Error(errors.join(" "));

  if (report.status !== "completed") errors.push("Chat 執行尚未完成。");
  if (report.jobId !== job.jobId) errors.push("執行報告的 jobId 不一致。");
  if (report.videoId !== job.videoId) errors.push("執行報告的 videoId 不一致。");
  if (report.sourceFingerprint !== job.sourceFingerprint) {
    errors.push("執行報告的逐字稿指紋不一致。");
  }
  if (report.transcriptSha256 !== job.transcriptSha256) {
    errors.push("執行報告的 VTT 指紋不一致。");
  }
  if (draft.videoId !== job.videoId) errors.push("章節草稿的 videoId 不一致。");
  if (draft.sourceFingerprint !== job.sourceFingerprint) {
    errors.push("章節草稿的逐字稿指紋不一致。");
  }
  if (errors.length > 0) throw new Error(errors.join(" "));
}
