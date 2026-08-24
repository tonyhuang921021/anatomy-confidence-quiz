import { spawnSync } from "node:child_process";
import { readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCliArgs } from "./review-package-core.mjs";
import {
  auditCanonical,
  createChatInputZip,
  createRepairZip,
  getWorkflowPaths,
  importChatResponse,
  readState
} from "./workflow-core.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const videoIdPattern = /^[A-Za-z0-9_-]{11}$/;

function requireVideoId(args) {
  const videoId = typeof args["video-id"] === "string" ? args["video-id"] : "";
  if (!videoIdPattern.test(videoId)) throw new Error("請提供 --video-id <11 字元 YouTube ID>。");
  return videoId;
}

async function statusRows(videoId = null) {
  const ids = videoId
    ? [videoId]
    : (await readdir(resolve(repoRoot, "data/laozhao/staging"), { withFileTypes: true }))
      .filter((entry) => entry.isDirectory() && videoIdPattern.test(entry.name))
      .map((entry) => entry.name)
      .sort();
  const rows = [];
  for (const id of ids) {
    const state = await readState(getWorkflowPaths(repoRoot, id));
    rows.push({ videoId: id, state: state.state, activeJobId: state.activeJobId ?? null, updatedAt: state.updatedAt ?? null });
  }
  return rows;
}

async function main() {
  const command = process.argv[2];
  const args = parseCliArgs(process.argv.slice(3));
  if (command === "status") {
    const videoId = args.all === true ? null : requireVideoId(args);
    console.table(await statusRows(videoId));
    return;
  }

  const videoId = requireVideoId(args);
  if (command === "prepare") {
    const result = await createChatInputZip({ repoRoot, videoId });
    console.log(`工作包已建立：${result.zipPath}`);
    console.log(`Chat 回傳檔名：${result.job.resultFilename}`);
    return;
  }
  if (command === "import") {
    if (typeof args.response !== "string") throw new Error("請提供 --response <Chat 回傳 ZIP>。");
    const result = await importChatResponse({
      repoRoot,
      videoId,
      responseZip: args.response,
      jobId: typeof args["job-id"] === "string" ? args["job-id"] : undefined,
      approveAudit: args["approve-audit"] === true
    });
    console.log(result.status === "validated" ? "匯入完成，內容已通過驗證。" : "匯入完成，但仍需局部修補。");
    if (Array.isArray(result.report.errors)) result.report.errors.forEach((error) => console.log(`- ${error}`));
    return;
  }
  if (command === "repair") {
    const result = await createRepairZip({
      repoRoot,
      videoId,
      jobId: typeof args["job-id"] === "string" ? args["job-id"] : undefined
    });
    console.log(`第 ${result.round} 輪修補包已建立：${result.zipPath}`);
    console.log(`Chat 回傳檔名：${result.expectedResponseFilename}`);
    return;
  }
  if (command === "audit") {
    const result = await auditCanonical({ repoRoot, videoId });
    console.log(result.status === "passed" ? "內容稽核通過。" : "內容稽核仍需人工確認。");
    result.warnings.forEach((warning) => console.log(`- ${warning}`));
    return;
  }
  if (command === "preview") {
    const state = await readState(getWorkflowPaths(repoRoot, videoId));
    if (state.state !== "validated") throw new Error("這支影片尚未通過完整驗證，不能建立 Preview。");
    const result = spawnSync(process.execPath, [
      resolve(repoRoot, "scripts/laozhao/process-video-preview.mjs"),
      ...process.argv.slice(3)
    ], { cwd: repoRoot, env: process.env, stdio: "inherit" });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exitCode = result.status ?? 1;
    return;
  }
  throw new Error("用法：workflow-cli.mjs <prepare|import|repair|audit|status|preview> [參數]");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
