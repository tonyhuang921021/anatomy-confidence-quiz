import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseCliArgs,
  validateAndNormalizeChapterDraft
} from "./review-package-core.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../..");
const privateRoot = resolve(repoRoot, "data/laozhao/staging");

function assertPrivatePath(pathname, label) {
  const pathFromPrivateRoot = relative(privateRoot, pathname);
  if (pathFromPrivateRoot.startsWith("..") || resolve(privateRoot, pathFromPrivateRoot) !== pathname) {
    throw new Error(`${label}只能位於 data/laozhao/staging/ 內。`);
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

function usage() {
  return "用法：npm run validate:laozhao-chapters -- --transcript <transcript.private.json> --draft <Chat 回傳 JSON> [--output <chapters.validated.private.json>]";
}

async function readJson(pathname, label) {
  try {
    return JSON.parse(await readFile(pathname, "utf8"));
  } catch {
    throw new Error(`無法解析${label}：${pathname}`);
  }
}

async function main() {
  const args = parseCliArgs(process.argv.slice(2));
  if (typeof args.transcript !== "string" || typeof args.draft !== "string") {
    throw new Error(usage());
  }
  const transcriptPath = resolve(args.transcript);
  const draftPath = resolve(args.draft);
  assertPrivatePath(transcriptPath, "私人逐字稿");
  const [transcript, draft] = await Promise.all([
    readJson(transcriptPath, "私人逐字稿"),
    readJson(draftPath, "Chat 章節檔")
  ]);
  if (transcript.rightsStatus !== "private_only") {
    throw new Error("逐字稿必須標記為 private_only，否則停止處理。");
  }
  if (typeof transcript.sourceMediaSha256 !== "string" || !/^[a-f0-9]{64}$/.test(transcript.sourceMediaSha256)) {
    throw new Error("逐字稿缺少有效的來源影片 SHA-256，否則停止處理。");
  }
  const result = validateAndNormalizeChapterDraft(draft, transcript);
  if (!result.valid) {
    console.error("章節檔未通過驗證：");
    for (const error of result.errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }

  const outputPath = typeof args.output === "string"
    ? resolve(args.output)
    : resolve(dirname(transcriptPath), "chapters.validated.private.json");
  assertPrivatePath(outputPath, "章節驗證結果");
  const output = {
    schemaVersion: "1.0.0",
    pipelineVersion: "laozhao-private-review-v1",
    generatedAt: new Date().toISOString(),
    videoId: transcript.videoId,
    videoTitle: transcript.videoTitle,
    durationSec: transcript.durationSec,
    sourceFingerprint: transcript.sourceFingerprint,
    sourceMediaSha256: transcript.sourceMediaSha256,
    sourceFilename: transcript.sourceFilename,
    sourceSizeBytes: transcript.sourceSizeBytes,
    rightsStatus: "private_only",
    reviewStatus: "draft",
    requiresHumanReview: true,
    chapters: result.chapters
  };
  await writeAtomic(outputPath, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`章節驗證通過：${result.chapters.length} 章`);
  console.log(`已寫入：${outputPath}`);
  if (result.warnings.length > 0) {
    console.log("請人工確認：");
    for (const warning of result.warnings) console.log(`- ${warning}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
