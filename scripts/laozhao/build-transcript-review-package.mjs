import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  normalizeTranscriptSegments,
  parseCliArgs,
  sha256,
  transcriptToMarkdown,
  transcriptToVtt
} from "./review-package-core.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../..");
const privateRoot = resolve(repoRoot, "data/laozhao/staging");

function usage() {
  return [
    "用法：",
    "npm run package:laozhao-transcript -- --video-id <YouTube ID> --transcript <Whisper JSON>",
    "",
    "輸出會放在 data/laozhao/staging/<videoId>/review-package，該目錄已被 Git 忽略。"
  ].join("\n");
}

function assertPrivateOutputPath(pathname) {
  const pathFromPrivateRoot = relative(privateRoot, pathname);
  if (pathFromPrivateRoot.startsWith("..") || resolve(privateRoot, pathFromPrivateRoot) !== pathname) {
    throw new Error("為避免逐字稿誤進公開目錄，輸出只能位於 data/laozhao/staging/ 內。");
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
  const args = parseCliArgs(process.argv.slice(2));
  const videoId = typeof args["video-id"] === "string" ? args["video-id"].trim() : "";
  const transcriptPath = typeof args.transcript === "string" ? resolve(args.transcript) : "";
  if (!videoId || !transcriptPath) throw new Error(usage());

  const manifestPath = resolve(repoRoot, "data/laozhao/courseManifest.generated.json");
  const [manifestSource, transcriptSource] = await Promise.all([
    readFile(manifestPath, "utf8"),
    readFile(transcriptPath, "utf8")
  ]);
  const manifest = JSON.parse(manifestSource);
  const video = manifest.videos?.find((candidate) => candidate.id === videoId);
  if (!video) throw new Error(`官方清單找不到影片 ${videoId}。`);
  if (!Number.isInteger(video.durationSec) || video.durationSec <= 0) {
    throw new Error(`影片 ${videoId} 缺少可靠時長，暫不建立分章包。`);
  }

  let rawTranscript;
  try {
    rawTranscript = JSON.parse(transcriptSource);
  } catch {
    throw new Error(`無法解析逐字稿 JSON：${transcriptPath}`);
  }
  const sourceIdentity = rawTranscript?._laozhao;
  if (
    !sourceIdentity ||
    sourceIdentity.videoId !== videoId ||
    typeof sourceIdentity.sourceMediaSha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(sourceIdentity.sourceMediaSha256)
  ) {
    throw new Error("逐字稿缺少相符的影片 ID 或來源影片 SHA-256，請用 transcribe:laozhao 重新產生。");
  }
  const { segments, warnings } = normalizeTranscriptSegments(rawTranscript, {
    durationSec: video.durationSec
  });
  const sourceFingerprint = sha256(transcriptSource);
  const generatedAt = new Date().toISOString();
  const transcript = {
    schemaVersion: "1.0.0",
    pipelineVersion: "laozhao-private-review-v1",
    generatedAt,
    videoId,
    videoTitle: video.title,
    durationSec: video.durationSec,
    language: "zh-Hant",
    rightsStatus: "private_only",
    reviewStatus: "unreviewed",
    sourceFingerprint,
    sourceMediaSha256: sourceIdentity.sourceMediaSha256,
    sourceFilename: typeof sourceIdentity.sourceFilename === "string" ? sourceIdentity.sourceFilename : null,
    sourceSizeBytes: Number.isInteger(sourceIdentity.sourceSizeBytes) ? sourceIdentity.sourceSizeBytes : null,
    segments
  };

  const outputDir = resolve(privateRoot, videoId, "review-package");
  assertPrivateOutputPath(outputDir);
  const template = {
    schemaVersion: "1.0.0",
    videoId,
    sourceFingerprint,
    chapters: []
  };
  const readme = [
    "老趙解剖學私人分章工作包",
    "",
    "1. 將 chat-chapter-package.md 交給 Chat。",
    "2. 請 Chat 只回傳 JSON，另存成 chapter-draft.from-chat.json。",
    "3. 回到網站 repo 執行：",
    `   npm run validate:laozhao-chapters -- --transcript ${relative(repoRoot, resolve(outputDir, "transcript.private.json"))} --draft <Chat 回傳 JSON 路徑>`,
    "4. 驗證通過後才擷取板書候選；所有內容仍是 private_only。",
    "",
    "請勿將這個資料夾加入 Git、Vercel 或公開分享。"
  ].join("\n");

  await Promise.all([
    writeAtomic(resolve(outputDir, "transcript.private.json"), `${JSON.stringify(transcript, null, 2)}\n`),
    writeAtomic(resolve(outputDir, "transcript.private.vtt"), transcriptToVtt(segments)),
    writeAtomic(
      resolve(outputDir, "chat-chapter-package.md"),
      transcriptToMarkdown({
        videoId,
        videoTitle: video.title,
        durationSec: video.durationSec,
        sourceFingerprint,
        segments
      })
    ),
    writeAtomic(resolve(outputDir, "chapter-draft.template.json"), `${JSON.stringify(template, null, 2)}\n`),
    writeAtomic(resolve(outputDir, "warnings.txt"), warnings.length ? `${warnings.join("\n")}\n` : "沒有格式警告。\n"),
    writeAtomic(resolve(outputDir, "README.txt"), `${readme}\n`)
  ]);

  console.log(`已建立私人工作包：${outputDir}`);
  console.log(`逐字稿片段：${segments.length}`);
  console.log(`格式警告：${warnings.length}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
