import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import { relative, resolve } from "node:path";

const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const JOB_ID_PATTERN = /^[A-Za-z0-9_-]{11}-[a-f0-9]{16}$/;
const STAGE_PATTERN = /^[a-z][a-z0-9_-]{1,31}$/;

export const chapterDraftSchema = {
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "videoId", "sourceFingerprint", "chapters"],
  properties: {
    schemaVersion: { type: "string", const: "1.0.0" },
    videoId: { type: "string", pattern: "^[A-Za-z0-9_-]{11}$" },
    sourceFingerprint: { type: "string", pattern: "^[a-f0-9]{64}$" },
    chapters: {
      type: "array",
      minItems: 1,
      maxItems: 120,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "title",
          "startSec",
          "endSec",
          "summary",
          "tags",
          "representativeFrameTargetSec",
          "reviewStatus"
        ],
        properties: {
          title: { type: "string", minLength: 1, maxLength: 80 },
          startSec: { type: "integer", minimum: 0 },
          endSec: { type: "integer", minimum: 1 },
          summary: { type: "string", maxLength: 500 },
          tags: {
            type: "array",
            maxItems: 12,
            items: { type: "string", minLength: 1, maxLength: 30 }
          },
          representativeFrameTargetSec: {
            type: ["integer", "null"],
            minimum: 0
          },
          reviewStatus: { type: "string", const: "draft" }
        }
      }
    }
  }
};

export const supervisorReviewSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "schemaVersion",
    "jobId",
    "stage",
    "verdict",
    "summary",
    "observations",
    "risks",
    "recommendations",
    "nextCheckpoint",
    "requiresHumanDecision"
  ],
  properties: {
    schemaVersion: { type: "string", const: "1.0.0" },
    jobId: { type: "string" },
    stage: { type: "string" },
    verdict: {
      type: "string",
      enum: ["approve", "changes_requested", "blocked"]
    },
    summary: { type: "string", minLength: 1, maxLength: 1000 },
    observations: {
      type: "array",
      maxItems: 20,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["finding", "evidence"],
        properties: {
          finding: { type: "string", minLength: 1, maxLength: 500 },
          evidence: { type: "string", minLength: 1, maxLength: 500 }
        }
      }
    },
    risks: {
      type: "array",
      maxItems: 20,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["severity", "finding", "evidence", "recommendation"],
        properties: {
          severity: { type: "string", enum: ["low", "medium", "high", "critical"] },
          finding: { type: "string", minLength: 1, maxLength: 500 },
          evidence: { type: "string", minLength: 1, maxLength: 500 },
          recommendation: { type: "string", minLength: 1, maxLength: 500 }
        }
      }
    },
    recommendations: {
      type: "array",
      maxItems: 20,
      items: { type: "string", minLength: 1, maxLength: 500 }
    },
    nextCheckpoint: { type: "string", minLength: 1, maxLength: 500 },
    requiresHumanDecision: {
      type: "array",
      maxItems: 20,
      items: { type: "string", minLength: 1, maxLength: 500 }
    }
  }
};

export function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith("--")) continue;
    const key = item.slice(2);
    const next = argv[index + 1];
    result[key] = next && !next.startsWith("--") ? argv[++index] : true;
  }
  return result;
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function assertObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label}必須是 JSON 物件。`);
  }
}

function assertInside(root, pathname, label) {
  const child = relative(root, pathname);
  if (child.startsWith("..") || resolve(root, child) !== pathname) {
    throw new Error(`${label}不可離開 ${root}。`);
  }
}

export async function loadHandoffJob(jobDirArg, { cwd = process.cwd() } = {}) {
  if (typeof jobDirArg !== "string" || !jobDirArg.trim()) {
    throw new Error("缺少 --job-dir。");
  }
  const jobsRoot = resolve(cwd, "jobs");
  const jobDir = resolve(cwd, jobDirArg);
  assertInside(jobsRoot, jobDir, "接力工作");
  const jobPath = resolve(jobDir, "input/job.json");
  const job = JSON.parse(await readFile(jobPath, "utf8"));
  assertObject(job, "接力工作");
  if (job.schemaVersion !== "1.0.0" || job.pipelineVersion !== "laozhao-github-handoff-v1") {
    throw new Error("接力工作版本不相容。");
  }
  if (job.task !== "chapter_draft") throw new Error("接力工作類型不是 chapter_draft。");
  if (!JOB_ID_PATTERN.test(String(job.jobId ?? ""))) throw new Error("jobId 格式無效。");
  if (!VIDEO_ID_PATTERN.test(String(job.videoId ?? ""))) throw new Error("videoId 格式無效。");
  if (!SHA256_PATTERN.test(String(job.sourceFingerprint ?? ""))) throw new Error("來源指紋格式無效。");
  if (!SHA256_PATTERN.test(String(job.transcriptSha256 ?? ""))) throw new Error("VTT 指紋格式無效。");
  if (job.jobId !== `${job.videoId}-${job.sourceFingerprint.slice(0, 16)}`) {
    throw new Error("jobId 與影片／逐字稿指紋不一致。");
  }
  if (job.rightsStatus !== "private_only" || job.reviewStatus !== "unreviewed") {
    throw new Error("接力工作必須維持 private_only 與 unreviewed。");
  }
  if (!Number.isInteger(job.durationSec) || job.durationSec <= 0) {
    throw new Error("影片長度無效。");
  }
  if (job.transcriptFile !== "input/transcript.private.vtt") {
    throw new Error("逐字稿路徑不符合固定格式。");
  }

  const transcriptPath = resolve(jobDir, job.transcriptFile);
  assertInside(jobDir, transcriptPath, "逐字稿");
  const transcriptStat = await stat(transcriptPath);
  if (transcriptStat.size < 8 || transcriptStat.size > 2_000_000) {
    throw new Error("逐字稿大小超出 8 bytes 到 2 MB 的安全範圍。");
  }
  const transcriptVtt = await readFile(transcriptPath, "utf8");
  if (!transcriptVtt.startsWith("WEBVTT\n")) throw new Error("逐字稿不是有效的 VTT。");
  if (sha256(transcriptVtt) !== job.transcriptSha256) {
    throw new Error("逐字稿內容與 job.json 的 SHA-256 不一致。");
  }
  return { jobDir, job, transcriptVtt };
}

export function extractResponseText(response) {
  if (typeof response?.output_text === "string" && response.output_text.trim()) {
    return response.output_text.trim();
  }
  const texts = [];
  for (const item of Array.isArray(response?.output) ? response.output : []) {
    for (const content of Array.isArray(item?.content) ? item.content : []) {
      if (content?.type === "output_text" && typeof content.text === "string") {
        texts.push(content.text);
      }
    }
  }
  const joined = texts.join("\n").trim();
  if (!joined) throw new Error("OpenAI 回應沒有可解析的 output_text。");
  return joined;
}

export function validateDraftAgainstJob(draft, job) {
  assertObject(draft, "章節草稿");
  if (draft.schemaVersion !== "1.0.0") throw new Error("章節草稿 schemaVersion 無效。");
  if (draft.videoId !== job.videoId) throw new Error("章節草稿 videoId 與工作不一致。");
  if (draft.sourceFingerprint !== job.sourceFingerprint) {
    throw new Error("章節草稿逐字稿指紋與工作不一致。");
  }
  if (!Array.isArray(draft.chapters) || draft.chapters.length === 0) {
    throw new Error("章節草稿沒有 chapters。");
  }
  let previousEnd = -1;
  for (const [index, chapter] of draft.chapters.entries()) {
    assertObject(chapter, `第 ${index + 1} 章`);
    if (chapter.reviewStatus !== "draft") throw new Error(`第 ${index + 1} 章不可宣告已審核。`);
    if (!Number.isInteger(chapter.startSec) || !Number.isInteger(chapter.endSec)) {
      throw new Error(`第 ${index + 1} 章時間必須是整數秒。`);
    }
    if (chapter.startSec < previousEnd) throw new Error(`第 ${index + 1} 章與前一章重疊。`);
    if (chapter.endSec <= chapter.startSec || chapter.endSec > job.durationSec) {
      throw new Error(`第 ${index + 1} 章時間超出影片範圍。`);
    }
    if (
      chapter.representativeFrameTargetSec !== null &&
      (!Number.isInteger(chapter.representativeFrameTargetSec) ||
        chapter.representativeFrameTargetSec < chapter.startSec ||
        chapter.representativeFrameTargetSec >= chapter.endSec)
    ) {
      throw new Error(`第 ${index + 1} 章板書目標時間不在章節內。`);
    }
    previousEnd = chapter.endSec;
  }
}

export function sanitizeUsage(usage) {
  const readNumber = (value) => Number.isFinite(Number(value)) ? Number(value) : null;
  return {
    inputTokens: readNumber(usage?.input_tokens),
    outputTokens: readNumber(usage?.output_tokens),
    totalTokens: readNumber(usage?.total_tokens),
    cachedInputTokens: readNumber(usage?.input_tokens_details?.cached_tokens)
  };
}

export function validateProgressEvent(event, job) {
  assertObject(event, "進度事件");
  if (event.schemaVersion !== "1.0.0") throw new Error("進度事件 schemaVersion 無效。");
  if (event.jobId !== job.jobId || event.videoId !== job.videoId) {
    throw new Error("進度事件不屬於目前工作。");
  }
  if (event.sourceFingerprint !== job.sourceFingerprint) {
    throw new Error("進度事件逐字稿指紋不一致。");
  }
  if (!Number.isInteger(event.sequence) || event.sequence < 0 || event.sequence > 9999) {
    throw new Error("進度事件 sequence 無效。");
  }
  if (!STAGE_PATTERN.test(String(event.stage ?? ""))) throw new Error("進度事件 stage 無效。");
  if (!["planned", "in_progress", "completed", "blocked"].includes(event.status)) {
    throw new Error("進度事件 status 無效。");
  }
  if (!String(event.summary ?? "").trim()) throw new Error("進度事件缺少 summary。");
}

export async function loadProgressEvents(jobDir, job) {
  const progressDir = resolve(jobDir, "progress");
  let names = [];
  try {
    names = (await readdir(progressDir)).filter((name) => name.endsWith(".json")).sort();
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  const events = [];
  for (const name of names) {
    const event = JSON.parse(await readFile(resolve(progressDir, name), "utf8"));
    validateProgressEvent(event, job);
    events.push(event);
  }
  events.sort((left, right) => left.sequence - right.sequence || left.recordedAt.localeCompare(right.recordedAt));
  return events;
}

export function progressDigest({ job, stage, events, artifacts, transcriptIncluded }) {
  return sha256(JSON.stringify({
    jobId: job.jobId,
    sourceFingerprint: job.sourceFingerprint,
    stage,
    events,
    artifacts,
    transcriptIncluded
  }));
}

export function supervisorReportMarkdown(report) {
  const verdict = {
    approve: "通過",
    changes_requested: "需修改",
    blocked: "阻擋"
  }[report.verdict] ?? report.verdict;
  const lines = [
    `## Chat 監督審查：${verdict}`,
    "",
    report.summary,
    ""
  ];
  if (report.risks.length > 0) {
    lines.push("### 風險");
    for (const risk of report.risks) {
      lines.push(`- **${risk.severity}**：${risk.finding}；建議：${risk.recommendation}`);
    }
    lines.push("");
  }
  if (report.recommendations.length > 0) {
    lines.push("### 建議");
    for (const recommendation of report.recommendations) lines.push(`- ${recommendation}`);
    lines.push("");
  }
  lines.push(`**下一個檢查點：** ${report.nextCheckpoint}`);
  return `${lines.join("\n")}\n`;
}
