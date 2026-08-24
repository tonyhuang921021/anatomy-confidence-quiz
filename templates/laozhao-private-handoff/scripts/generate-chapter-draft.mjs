import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  chapterDraftSchema,
  loadHandoffJob,
  parseArgs,
  validateDraftAgainstJob
} from "./handoff-runtime.mjs";
import { createStructuredResponse } from "./openai-structured-response.mjs";

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

async function exists(pathname) {
  try {
    await readFile(pathname);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { jobDir, job, transcriptVtt } = await loadHandoffJob(args["job-dir"]);
  const outputDir = resolve(jobDir, "output");
  const draftPath = resolve(outputDir, "chapter-draft.from-chat.json");
  const reportPath = resolve(outputDir, "run-report.json");
  if ((await exists(draftPath) || await exists(reportPath)) && args.force !== true) {
    throw new Error("這個工作已有輸出；如需重新產生，請在 workflow 勾選 force。舊結果會由 Git 保留。" );
  }

  const developerPrompt = [
    "角色：你是醫學解剖學課程的章節編輯。",
    "目標：只根據含時間碼逐字稿，建立可搜尋、可跳轉且方便後續擷取完整板書的章節草稿。",
    "成功條件：章節依時間排序、互不重疊、不超出影片；標題具體；摘要不加入逐字稿未支持的事實；板書目標時間保守選擇。",
    "限制：多數章節以 2 到 12 分鐘為目標。聽不清楚時寫待人工確認，不得猜測。reviewStatus 一律是 draft。",
    "輸出：只輸出符合 JSON schema 的資料，不要附加說明。",
    "停止規則：證據不足時保守命名或將 representativeFrameTargetSec 設為 null，不得自行補完。"
  ].join("\n");
  const userPrompt = [
    `工作資訊：${JSON.stringify({
      jobId: job.jobId,
      videoId: job.videoId,
      videoTitle: job.videoTitle,
      durationSec: job.durationSec,
      sourceFingerprint: job.sourceFingerprint
    })}`,
    "",
    "含時間碼逐字稿：",
    transcriptVtt
  ].join("\n");
  const { data: draft, metadata } = await createStructuredResponse({
    developerPrompt,
    userPrompt,
    schema: chapterDraftSchema,
    schemaName: "laozhao_chapter_draft"
  });
  validateDraftAgainstJob(draft, job);

  const generatedAt = new Date().toISOString();
  const report = {
    schemaVersion: "1.0.0",
    pipelineVersion: "laozhao-github-handoff-v1",
    status: "completed",
    jobId: job.jobId,
    videoId: job.videoId,
    sourceFingerprint: job.sourceFingerprint,
    transcriptSha256: job.transcriptSha256,
    generatedAt,
    responseId: metadata.responseId,
    model: metadata.model,
    usage: metadata.usage,
    store: false,
    requiresHumanReview: true
  };
  const progress = {
    schemaVersion: "1.0.0",
    jobId: job.jobId,
    videoId: job.videoId,
    sourceFingerprint: job.sourceFingerprint,
    sequence: 20,
    stage: "chapter_draft",
    actor: "openai_api",
    status: "completed",
    recordedAt: generatedAt,
    summary: `已產生 ${draft.chapters.length} 個章節草稿，尚未經人工與網站驗證器核准。`,
    changes: ["output/chapter-draft.from-chat.json", "output/run-report.json"],
    checks: ["OpenAI strict JSON schema", "影片 ID 與逐字稿指紋一致", "章節時間排序與範圍初檢"],
    blockers: [],
    next: "由 Codex 拉回網站 repo 執行完整章節驗證，接著再擷取板書候選。"
  };
  await Promise.all([
    writeAtomic(draftPath, `${JSON.stringify(draft, null, 2)}\n`),
    writeAtomic(reportPath, `${JSON.stringify(report, null, 2)}\n`),
    writeAtomic(resolve(jobDir, "progress/020-chat-chapter-draft.json"), `${JSON.stringify(progress, null, 2)}\n`)
  ]);
  console.log(`章節草稿完成：${draft.chapters.length} 章`);
  console.log(`模型：${metadata.model}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
