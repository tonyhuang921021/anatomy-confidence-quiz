import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  loadHandoffJob,
  loadProgressEvents,
  parseArgs,
  progressDigest,
  supervisorReportMarkdown,
  supervisorReviewSchema
} from "./handoff-runtime.mjs";
import { createStructuredResponse } from "./openai-structured-response.mjs";

async function readJsonIfPresent(pathname) {
  try {
    return JSON.parse(await readFile(pathname, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const stage = typeof args.stage === "string" ? args.stage.trim() : "";
  if (!/^[a-z][a-z0-9_-]{1,31}$/.test(stage)) {
    throw new Error("--stage 必須是小寫英數與連字號，例如 chapter_validation。");
  }
  const includeTranscript = args["include-transcript"] === true;
  const { jobDir, job, transcriptVtt } = await loadHandoffJob(args["job-dir"]);
  const events = await loadProgressEvents(jobDir, job);
  if (events.length === 0) throw new Error("沒有可供監督的進度事件。");
  const outputDir = resolve(jobDir, "output");
  const artifacts = {
    chapterDraft: await readJsonIfPresent(resolve(outputDir, "chapter-draft.from-chat.json")),
    runReport: await readJsonIfPresent(resolve(outputDir, "run-report.json")),
    localValidation: await readJsonIfPresent(resolve(jobDir, "evidence/local-validation.json")),
    boardCandidateIndex: await readJsonIfPresent(resolve(jobDir, "evidence/board-candidate-index.json"))
  };
  const inputDigest = progressDigest({ job, stage, events, artifacts, transcriptIncluded: includeTranscript });
  const developerPrompt = [
    "角色：你是老趙解剖學內容管線的獨立監督者，審查 Codex 的計畫、過程、驗證證據與結果。",
    "目標：指出可驗證的缺口、資料混用、隱私風險、未完成驗證與可能錯誤，並給出最小且可執行的下一步。",
    "成功條件：每個判斷都引用輸入中的具體事件或 artifact；區分已證實、推論與缺少證據。",
    "限制：不得把 AI 輸出視為人工授權或內容審核。沒有證據時不得宣稱通過。approve 只代表可進下一個私人處理階段，不代表可公開。",
    "判定：critical 安全風險、來源指紋不一致或必要驗證失敗時 blocked；可修正缺口用 changes_requested；證據完整才 approve。",
    "輸出：只輸出符合 JSON schema 的監督報告。"
  ].join("\n");
  const userPayload = {
    job: {
      jobId: job.jobId,
      videoId: job.videoId,
      videoTitle: job.videoTitle,
      durationSec: job.durationSec,
      sourceFingerprint: job.sourceFingerprint,
      transcriptSha256: job.transcriptSha256,
      rightsStatus: job.rightsStatus
    },
    requestedStage: stage,
    progressEvents: events,
    artifacts,
    transcriptIncluded: includeTranscript,
    transcriptVtt: includeTranscript ? transcriptVtt : null,
    reviewInputDigest: inputDigest
  };
  const { data: review, metadata } = await createStructuredResponse({
    developerPrompt,
    userPrompt: JSON.stringify(userPayload),
    schema: supervisorReviewSchema,
    schemaName: "laozhao_supervisor_review"
  });
  if (review.jobId !== job.jobId || review.stage !== stage) {
    throw new Error("監督報告的 jobId 或 stage 與請求不一致。");
  }
  const generatedAt = new Date().toISOString();
  const report = {
    ...review,
    pipelineVersion: "laozhao-github-handoff-v1",
    generatedAt,
    reviewInputDigest: inputDigest,
    sourceFingerprint: job.sourceFingerprint,
    transcriptSha256: job.transcriptSha256,
    transcriptIncluded: includeTranscript,
    responseId: metadata.responseId,
    model: metadata.model,
    usage: metadata.usage,
    store: false,
    advisoryOnly: true
  };
  const basename = `${stage}-${inputDigest.slice(0, 12)}`;
  await Promise.all([
    writeAtomic(resolve(jobDir, `reviews/${basename}.json`), `${JSON.stringify(report, null, 2)}\n`),
    writeAtomic(resolve(jobDir, `reviews/${basename}.md`), supervisorReportMarkdown(report))
  ]);
  console.log(`監督審查完成：${report.verdict}`);
  console.log(`review_file=${resolve(jobDir, `reviews/${basename}.md`)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
