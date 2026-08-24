import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertMatchingHandoffResult,
  buildGithubHandoffJob,
  handoffJobRelativePath,
  sha256
} from "./github-handoff-core.mjs";
import {
  parseCliArgs,
  validateAndNormalizeChapterDraft
} from "./review-package-core.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../..");
const privateRoot = resolve(repoRoot, "data/laozhao/staging");
const defaultHandoffRepo = resolve(privateRoot, "private-handoff-repo");

async function readJson(pathname, label) {
  try {
    return JSON.parse(await readFile(pathname, "utf8"));
  } catch {
    throw new Error(`無法解析${label}：${pathname}`);
  }
}

async function writeAtomic(pathname, content) {
  await mkdir(dirname(pathname), { recursive: true });
  const temporary = `${pathname}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(temporary, content);
  try {
    await rename(temporary, pathname);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

async function availableOutputPath(preferred, content) {
  try {
    const existing = await readFile(preferred, "utf8");
    if (existing === content) return { pathname: preferred, unchanged: true };
    const suffix = sha256(content).slice(0, 12);
    return {
      pathname: resolve(dirname(preferred), `chapters.validated.from-github.${suffix}.private.json`),
      unchanged: false
    };
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    return { pathname: preferred, unchanged: false };
  }
}

async function main() {
  const args = parseCliArgs(process.argv.slice(2));
  const videoId = typeof args["video-id"] === "string" ? args["video-id"].trim() : "";
  if (!videoId) {
    throw new Error("用法：npm run import:laozhao-handoff -- --video-id <YouTube ID> [--source <私有 repo>]");
  }
  const handoffRepo = resolve(typeof args.source === "string" ? args.source : defaultHandoffRepo);
  const reviewPackage = resolve(privateRoot, videoId, "review-package");
  const [transcript, transcriptVtt] = await Promise.all([
    readJson(resolve(reviewPackage, "transcript.private.json"), "私人逐字稿"),
    readFile(resolve(reviewPackage, "transcript.private.vtt"), "utf8")
  ]);
  const job = buildGithubHandoffJob(transcript, transcriptVtt);
  const jobDir = resolve(handoffRepo, handoffJobRelativePath(job));
  const draftPath = resolve(jobDir, "output/chapter-draft.from-chat.json");
  const [remoteJob, report, draft, draftSource] = await Promise.all([
    readJson(resolve(jobDir, "input/job.json"), "接力工作"),
    readJson(resolve(jobDir, "output/run-report.json"), "Chat 執行報告"),
    readJson(draftPath, "Chat 章節草稿"),
    readFile(draftPath, "utf8")
  ]);
  if (JSON.stringify(remoteJob) !== JSON.stringify(job)) {
    throw new Error("私有 repo 內的接力工作與本機逐字稿不一致。");
  }
  assertMatchingHandoffResult({ job, report, draft });
  const validation = validateAndNormalizeChapterDraft(draft, transcript);
  if (!validation.valid) {
    throw new Error(`Chat 章節草稿未通過網站驗證：\n- ${validation.errors.join("\n- ")}`);
  }

  const payload = {
    schemaVersion: "1.0.0",
    pipelineVersion: "laozhao-github-handoff-v1",
    generatedAt: report.generatedAt,
    importedAt: new Date().toISOString(),
    jobId: job.jobId,
    videoId: transcript.videoId,
    videoTitle: transcript.videoTitle,
    durationSec: transcript.durationSec,
    sourceFingerprint: transcript.sourceFingerprint,
    sourceMediaSha256: transcript.sourceMediaSha256,
    transcriptSha256: job.transcriptSha256,
    model: report.model,
    responseId: report.responseId,
    usage: report.usage,
    rightsStatus: "private_only",
    reviewStatus: "draft",
    requiresHumanReview: true,
    warnings: validation.warnings,
    chapters: validation.chapters
  };
  const validationEvidence = {
    schemaVersion: "1.0.0",
    pipelineVersion: "laozhao-github-handoff-v1",
    jobId: job.jobId,
    videoId: job.videoId,
    sourceFingerprint: job.sourceFingerprint,
    transcriptSha256: job.transcriptSha256,
    chapterDraftSha256: sha256(draftSource),
    checkedAt: payload.importedAt,
    status: "passed",
    validator: "anatomy-confidence-quiz/validateAndNormalizeChapterDraft",
    chapterCount: validation.chapters.length,
    warningCount: validation.warnings.length,
    warnings: validation.warnings,
    requiresHumanReview: true
  };
  const progress = {
    schemaVersion: "1.0.0",
    jobId: job.jobId,
    videoId: job.videoId,
    sourceFingerprint: job.sourceFingerprint,
    sequence: 30,
    stage: "chapter_validation",
    actor: "codex",
    status: "completed",
    recordedAt: payload.importedAt,
    summary: `網站端章節驗證通過，共 ${validation.chapters.length} 章、${validation.warnings.length} 項待人工確認警告。`,
    changes: ["evidence/local-validation.json"],
    checks: ["影片 ID", "逐字稿指紋", "章節草稿 SHA-256", "章節排序", "章節重疊", "影片長度", "板書目標時間", "reviewStatus=draft"],
    blockers: [],
    next: "請 Chat 審查 chapter_validation；通過後才進入私人板書候選擷取。"
  };
  const content = `${JSON.stringify(payload, null, 2)}\n`;
  const preferred = resolve(reviewPackage, "chapters.validated.from-github.private.json");
  const target = await availableOutputPath(preferred, content);
  const evidenceContent = `${JSON.stringify(validationEvidence, null, 2)}\n`;
  const progressContent = `${JSON.stringify(progress, null, 2)}\n`;
  if (!target.unchanged) await writeAtomic(target.pathname, content);
  await Promise.all([
    writeAtomic(resolve(jobDir, "evidence/local-validation.json"), evidenceContent),
    writeAtomic(resolve(jobDir, "progress/030-codex-chapter-validation.json"), progressContent)
  ]);
  console.log(target.unchanged ? "接力結果已匯入，內容未變。" : "接力結果已安全匯入。" );
  console.log(`章節數：${validation.chapters.length}`);
  console.log(`輸出：${target.pathname}`);
  if (validation.warnings.length > 0) {
    console.log("仍需人工確認：");
    for (const warning of validation.warnings) console.log(`- ${warning}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
