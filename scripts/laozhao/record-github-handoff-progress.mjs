import { readFile, rename, rm, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { handoffJobRelativePath } from "./github-handoff-core.mjs";
import { parseCliArgs } from "./review-package-core.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../..");
const privateRoot = resolve(repoRoot, "data/laozhao/staging");
const defaultHandoffRepo = resolve(privateRoot, "private-handoff-repo");

function list(value) {
  if (typeof value !== "string" || !value.trim()) return [];
  return value.split("|").map((item) => item.trim()).filter(Boolean);
}

async function writeIdempotent(pathname, content) {
  try {
    const existing = await readFile(pathname, "utf8");
    if (existing === content) return false;
    throw new Error(`進度事件已存在但內容不同，請改用下一個 sequence：${pathname}`);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  await mkdir(dirname(pathname), { recursive: true });
  const temporary = `${pathname}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(temporary, content);
  try {
    await rename(temporary, pathname);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
  return true;
}

async function main() {
  const args = parseCliArgs(process.argv.slice(2));
  const videoId = typeof args["video-id"] === "string" ? args["video-id"].trim() : "";
  const sequence = Number(args.sequence);
  const stage = typeof args.stage === "string" ? args.stage.trim() : "";
  const status = typeof args.status === "string" ? args.status.trim() : "";
  const summary = typeof args.summary === "string" ? args.summary.trim() : "";
  if (!videoId || !Number.isInteger(sequence) || !/^[a-z][a-z0-9_-]{1,31}$/.test(stage)) {
    throw new Error("用法：npm run report:laozhao-handoff -- --video-id <ID> --sequence <整數> --stage <階段> --status <狀態> --summary <摘要>");
  }
  if (!["planned", "in_progress", "completed", "blocked"].includes(status) || !summary) {
    throw new Error("status 必須是 planned、in_progress、completed 或 blocked，且 summary 不可空白。");
  }
  const handoffRepo = resolve(typeof args.source === "string" ? args.source : defaultHandoffRepo);
  const reviewPackage = resolve(privateRoot, videoId, "review-package");
  const transcript = JSON.parse(await readFile(resolve(reviewPackage, "transcript.private.json"), "utf8"));
  const job = {
    videoId: transcript.videoId,
    sourceFingerprint: transcript.sourceFingerprint,
    jobId: `${transcript.videoId}-${transcript.sourceFingerprint.slice(0, 16)}`
  };
  const jobDir = resolve(handoffRepo, handoffJobRelativePath(job));
  const event = {
    schemaVersion: "1.0.0",
    jobId: job.jobId,
    videoId: job.videoId,
    sourceFingerprint: job.sourceFingerprint,
    sequence,
    stage,
    actor: "codex",
    status,
    recordedAt: new Date().toISOString(),
    summary,
    changes: list(args.changes),
    checks: list(args.checks),
    blockers: list(args.blockers),
    next: typeof args.next === "string" ? args.next.trim() : "等待下一個明確檢查點。"
  };
  const filename = `${String(sequence).padStart(3, "0")}-codex-${stage}.json`;
  const pathname = resolve(jobDir, "progress", filename);
  const changed = await writeIdempotent(pathname, `${JSON.stringify(event, null, 2)}\n`);
  console.log(changed ? `已記錄進度：${pathname}` : `進度已存在且一致：${pathname}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
