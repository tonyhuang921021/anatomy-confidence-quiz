import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { createReadStream } from "node:fs";
import { mkdir, readFile, rename, rm, stat } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { promisify } from "node:util";
import { buildBoardSelectionHydrationPlan } from "./board-selection-hydration-core.mjs";
import { writeAtomic } from "./workflow-core.mjs";

const execFileAsync = promisify(execFile);
const repoRoot = resolve(process.cwd());
const privateRoot = resolve(repoRoot, "data/laozhao/staging");

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    parsed[token.slice(2)] = argv[index + 1];
    index += 1;
  }
  return parsed;
}

function assertInsidePrivate(pathname, label) {
  const child = relative(privateRoot, pathname);
  if (child.startsWith("..") || resolve(privateRoot, child) !== pathname) {
    throw new Error(`${label}必須位於 data/laozhao/staging/ 內。`);
  }
}

async function readJson(pathname, label) {
  try {
    return JSON.parse(await readFile(pathname, "utf8"));
  } catch (error) {
    throw new Error(`無法讀取${label}：${pathname}`, { cause: error });
  }
}

async function sha256File(pathname) {
  return new Promise((resolveHash, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(pathname);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolveHash(hash.digest("hex")));
  });
}

const args = parseArgs(process.argv.slice(2));
if (!args.source || !args.selection || !args.index) {
  throw new Error("用法：hydrate-board-selection.mjs --source <影片> --selection <板書選擇 JSON> --index <候選索引 JSON>");
}

const sourcePath = resolve(args.source);
const selectionPath = resolve(args.selection);
const indexPath = resolve(args.index);
assertInsidePrivate(sourcePath, "來源影片");
assertInsidePrivate(selectionPath, "板書選擇檔");
assertInsidePrivate(indexPath, "板書候選索引");

const [selection, candidateIndex, sourceSha256] = await Promise.all([
  readJson(selectionPath, "板書選擇檔"),
  readJson(indexPath, "板書候選索引"),
  sha256File(sourcePath)
]);
if (sourceSha256 !== candidateIndex.sourceMediaSha256) {
  throw new Error("來源影片 SHA-256 與候選索引不一致，拒絕重建板書。");
}

const plan = buildBoardSelectionHydrationPlan(selection, candidateIndex);
if (!plan.valid) throw new Error(`板書重建計畫無效：${plan.errors.join("；")}`);
const outputRoot = dirname(indexPath);
const hydratedFrames = [];
for (const frame of plan.frames) {
  const destination = resolve(outputRoot, frame.sourcePath);
  assertInsidePrivate(destination, "板書輸出");
  await mkdir(dirname(destination), { recursive: true });
  const temporary = `${destination}.tmp-${process.pid}.png`;
  try {
    await execFileAsync("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-y",
      "-ss", String(frame.timeSec),
      "-i", sourcePath,
      "-frames:v", "1",
      "-vf", `crop=${plan.crop.width}:${plan.crop.height}:${plan.crop.x}:${plan.crop.y}`,
      temporary
    ]);
    const info = await stat(temporary);
    if (!info.isFile() || info.size === 0) throw new Error(`${frame.candidateId} 沒有產生有效 PNG。`);
    await rename(temporary, destination);
    hydratedFrames.push({ ...frame, sizeBytes: info.size, actualFrame: true, composite: false });
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

const manifestPath = resolve(outputRoot, "hydrated-selection.private.json");
await writeAtomic(manifestPath, {
  schemaVersion: "1.0.0",
  videoId: selection.videoId,
  sourceFingerprint: selection.sourceFingerprint,
  sourceMediaSha256: sourceSha256,
  generatedAt: new Date().toISOString(),
  method: "exact_frame_from_human_selection_time",
  boardCrop: plan.crop,
  frames: hydratedFrames
});

console.log(`已依人工時間碼重建 ${hydratedFrames.length} 張真實板書：${relative(repoRoot, outputRoot)}`);
console.log("未重新評分、未變更人工選圖、未拼接或補畫畫面。");
