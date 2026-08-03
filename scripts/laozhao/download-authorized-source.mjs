import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCliArgs } from "./review-package-core.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = resolve(dirname(scriptPath), "../..");
const privateRoot = resolve(repoRoot, "data/laozhao/staging");
const manifestPath = resolve(repoRoot, "data/laozhao/courseManifest.generated.json");
const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

function assertPrivatePath(pathname) {
  const child = relative(privateRoot, pathname);
  if (child.startsWith("..") || resolve(privateRoot, child) !== pathname) {
    throw new Error("授權影片只能下載到 data/laozhao/staging/ 內。");
  }
}

export function buildDownloadPlan({ manifest, videoId, rightsConfirmed, maxHeight = 1080 }) {
  if (rightsConfirmed !== "true") {
    throw new Error("請先設定 LAOZHAO_CONTENT_RIGHTS_CONFIRMED=true，確認這次下載已取得授權。");
  }
  if (!VIDEO_ID_PATTERN.test(videoId)) throw new Error("--video-id 必須是 11 字元的 YouTube video ID。");
  if (!Number.isInteger(maxHeight) || maxHeight < 360 || maxHeight > 2160) {
    throw new Error("--max-height 必須是 360 到 2160 的整數。");
  }
  const video = manifest.videos?.find((candidate) => candidate.id === videoId);
  if (!video) throw new Error(`官方播放清單找不到影片 ${videoId}。`);
  if (video.availability !== "available") throw new Error(`影片 ${videoId} 目前不可播放，停止下載。`);

  const outputDir = resolve(privateRoot, videoId, "source");
  assertPrivatePath(outputDir);
  return {
    video,
    outputDir,
    outputTemplate: resolve(outputDir, `${videoId}.%(ext)s`),
    watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
    format: `bv*[height<=${maxHeight}]+ba/b[height<=${maxHeight}]`
  };
}

function resolvePython() {
  const localPython = resolve(repoRoot, ".venv-laozhao/bin/python3");
  if (process.env.LAOZHAO_PYTHON) return process.env.LAOZHAO_PYTHON;
  if (existsSync(localPython)) return localPython;
  return "python3";
}

async function main() {
  const args = parseCliArgs(process.argv.slice(2));
  const videoId = typeof args["video-id"] === "string" ? args["video-id"].trim() : "";
  const maxHeight = args["max-height"] === undefined ? 1080 : Number(args["max-height"]);
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const plan = buildDownloadPlan({
    manifest,
    videoId,
    maxHeight,
    rightsConfirmed: process.env.LAOZHAO_CONTENT_RIGHTS_CONFIRMED
  });
  await mkdir(plan.outputDir, { recursive: true });

  const python = resolvePython();
  const result = spawnSync(python, [
    "-m",
    "yt_dlp",
    "--no-playlist",
    "--js-runtimes",
    `node:${process.execPath}`,
    "--no-overwrites",
    "--newline",
    "--concurrent-fragments",
    "4",
    "--format",
    plan.format,
    "--merge-output-format",
    "mp4",
    "--write-info-json",
    "--output",
    plan.outputTemplate,
    plan.watchUrl
  ], {
    cwd: repoRoot,
    env: process.env,
    stdio: "inherit"
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`影片下載失敗，yt-dlp 結束碼 ${result.status ?? "unknown"}。`);
  console.log(`已完成私人來源下載：${plan.video.title} (${plan.video.id})`);
}

if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
