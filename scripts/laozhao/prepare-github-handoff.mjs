import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildGithubHandoffJob,
  handoffJobRelativePath
} from "./github-handoff-core.mjs";
import { parseCliArgs } from "./review-package-core.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../..");
const privateRoot = resolve(repoRoot, "data/laozhao/staging");
const defaultHandoffRepo = resolve(privateRoot, "private-handoff-repo");

function isWithin(parent, pathname) {
  const child = relative(parent, pathname);
  return child === "" || (!child.startsWith("..") && resolve(parent, child) === pathname);
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

async function writeIdempotent(pathname, content) {
  try {
    const existing = await readFile(pathname, "utf8");
    if (existing === content) return false;
    throw new Error(`接力檔已存在但內容不同，停止避免覆蓋：${pathname}`);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  await writeAtomic(pathname, content);
  return true;
}

async function assertHandoffRepo(pathname) {
  const markerPath = resolve(pathname, ".laozhao-private-handoff.json");
  let marker;
  try {
    marker = JSON.parse(await readFile(markerPath, "utf8"));
  } catch {
    throw new Error(`找不到私有接力 repo 標記：${markerPath}`);
  }
  if (marker.privateRepositoryRequired !== true) {
    throw new Error("接力 repo 未宣告 privateRepositoryRequired，停止匯出。");
  }
  if (pathname === repoRoot || (isWithin(repoRoot, pathname) && !isWithin(privateRoot, pathname))) {
    throw new Error("不可把私人逐字稿匯出到網站的可追蹤目錄。");
  }
}

async function main() {
  const args = parseCliArgs(process.argv.slice(2));
  const videoId = typeof args["video-id"] === "string" ? args["video-id"].trim() : "";
  if (!videoId) {
    throw new Error("用法：npm run export:laozhao-handoff -- --video-id <YouTube ID> [--destination <私有 repo>]");
  }
  const handoffRepo = resolve(
    typeof args.destination === "string" ? args.destination : defaultHandoffRepo
  );
  await assertHandoffRepo(handoffRepo);

  const reviewPackage = resolve(privateRoot, videoId, "review-package");
  const [transcriptSource, transcriptVtt] = await Promise.all([
    readFile(resolve(reviewPackage, "transcript.private.json"), "utf8"),
    readFile(resolve(reviewPackage, "transcript.private.vtt"), "utf8")
  ]);
  const transcript = JSON.parse(transcriptSource);
  const job = buildGithubHandoffJob(transcript, transcriptVtt);
  const jobDir = resolve(handoffRepo, handoffJobRelativePath(job));
  const jobJson = `${JSON.stringify(job, null, 2)}\n`;
  const initialProgress = {
    schemaVersion: "1.0.0",
    jobId: job.jobId,
    videoId: job.videoId,
    sourceFingerprint: job.sourceFingerprint,
    sequence: 10,
    stage: "plan",
    actor: "codex",
    status: "completed",
    recordedAt: job.createdAt,
    summary: "已完成授權來源、影片 ID、逐字稿與 VTT 指紋檢查，準備交由 Chat 建立私人章節草稿。",
    changes: ["input/job.json", job.transcriptFile],
    checks: ["rightsStatus=private_only", "來源影片指紋存在", "VTT SHA-256 相符"],
    blockers: [],
    next: "執行 Draft Lao Zhao chapters，產生結構化章節草稿與 PR。"
  };
  const changes = await Promise.all([
    writeIdempotent(resolve(jobDir, "input/job.json"), jobJson),
    writeIdempotent(resolve(jobDir, job.transcriptFile), transcriptVtt),
    writeIdempotent(
      resolve(jobDir, "progress/010-codex-plan.json"),
      `${JSON.stringify(initialProgress, null, 2)}\n`
    )
  ]);

  console.log(changes.some(Boolean) ? "已建立 GitHub 接力工作。" : "GitHub 接力工作已存在，內容一致。" );
  console.log(`jobId：${job.jobId}`);
  console.log(`工作路徑：${relative(handoffRepo, jobDir)}`);
  console.log("只可提交到已確認為 Private 的接力 repo；不可提交原始影片或音訊。");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
