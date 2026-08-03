import { copyFile, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compressCaptionSegments } from "./captions-core.mjs";
import { parseCliArgs } from "./review-package-core.mjs";
import { buildPreviewVideoContent, mergePreviewVideo } from "./preview-content-core.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../..");
const privateRoot = resolve(repoRoot, "data/laozhao/staging");
const publicRoot = resolve(repoRoot, "public/laozhao-preview");
const defaultOutput = resolve(repoRoot, "data/laozhao/previewContent.generated.json");

function assertInside(root, pathname, label) {
  const child = relative(root, pathname);
  if (child.startsWith("..") || resolve(root, child) !== pathname) {
    throw new Error(`${label}必須位於 ${relative(repoRoot, root)}/ 內。`);
  }
}

async function readJson(pathname, label) {
  try {
    return JSON.parse(await readFile(pathname, "utf8"));
  } catch {
    throw new Error(`無法解析${label}：${pathname}`);
  }
}

async function readOptionalJson(pathname, fallback) {
  if (!pathname) return fallback;
  return readJson(pathname, "板書選擇檔");
}

async function readExistingManifest(pathname) {
  try {
    return JSON.parse(await readFile(pathname, "utf8"));
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      return { schemaVersion: "1.0.0", visibility: "preview", videos: [] };
    }
    throw new Error(`無法解析既有 Preview manifest：${pathname}`);
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

function buildCaptions(transcript) {
  const compressed = compressCaptionSegments(transcript.segments, {
    maxGapSec: 0.55,
    maxDurationSec: 7,
    maxTextLength: 56,
    respectSentenceEndings: true,
    invalidSegmentPolicy: "throw"
  });
  return compressed.map((cue) => ({
    startSec: cue.start,
    endSec: cue.end,
    text: cue.text,
    sourceSegmentStart: cue.sourceSegmentStart + 1,
    sourceSegmentEnd: cue.sourceSegmentEnd + 1,
    sourceSegmentCount: cue.sourceSegmentCount
  }));
}

function destinationFor(root, chapterId, index) {
  return resolve(root, "boards", `${chapterId}-${String(index + 1).padStart(2, "0")}.png`);
}

async function copySelectedBoards(selection, video) {
  const candidateRoot = resolve(privateRoot, video.videoId, "review-package/board-candidates");
  const finalRoot = resolve(publicRoot, video.videoId);
  const temporaryRoot = resolve(publicRoot, `.tmp-${video.videoId}-${process.pid}-${Date.now()}`);
  assertInside(publicRoot, finalRoot, "板書 Preview 輸出");
  assertInside(publicRoot, temporaryRoot, "板書 Preview 暫存輸出");
  await rm(temporaryRoot, { recursive: true, force: true });
  try {
    await mkdir(resolve(temporaryRoot, "boards"), { recursive: true });
    for (const chapter of selection?.chapters ?? []) {
      for (const [index, frame] of (chapter.frames ?? []).entries()) {
        const source = resolve(candidateRoot, frame.sourcePath);
        assertInside(candidateRoot, source, "板書來源");
        if (extname(source).toLowerCase() !== ".png") throw new Error("板書來源必須是擷取器產生的 PNG。");
        const destination = destinationFor(temporaryRoot, chapter.chapterId, index);
        assertInside(temporaryRoot, destination, "板書 Preview 暫存輸出");
        await copyFile(source, destination);
      }
    }
    await rm(finalRoot, { recursive: true, force: true });
    await rename(temporaryRoot, finalRoot);
  } catch (error) {
    await rm(temporaryRoot, { recursive: true, force: true });
    throw error;
  }
}

function usage() {
  return [
    "用法：node scripts/laozhao/build-preview-content.mjs",
    "  --transcript <transcript.private.json>",
    "  --chapters <chapters.candidate.private.json>",
    "  [--board-selection <board-selection.private.json>]",
    "  [--output data/laozhao/previewContent.generated.json]",
    "  --confirm-authorized-preview"
  ].join("\n");
}

async function main() {
  const args = parseCliArgs(process.argv.slice(2));
  if (
    typeof args.transcript !== "string" ||
    typeof args.chapters !== "string" ||
    args["confirm-authorized-preview"] !== true
  ) {
    throw new Error(usage());
  }
  const transcriptPath = resolve(args.transcript);
  const chapterPath = resolve(args.chapters);
  const selectionPath = typeof args["board-selection"] === "string"
    ? resolve(args["board-selection"])
    : null;
  const outputPath = typeof args.output === "string" ? resolve(args.output) : defaultOutput;
  assertInside(privateRoot, transcriptPath, "私人逐字稿");
  assertInside(privateRoot, chapterPath, "私人章節草稿");
  if (selectionPath) assertInside(privateRoot, selectionPath, "板書選擇檔");
  assertInside(resolve(repoRoot, "data/laozhao"), outputPath, "Preview manifest");

  const [transcript, chapterDraft, boardSelection, existingManifest] = await Promise.all([
    readJson(transcriptPath, "私人逐字稿"),
    readJson(chapterPath, "私人章節草稿"),
    readOptionalJson(selectionPath, null),
    readExistingManifest(outputPath)
  ]);
  const captions = buildCaptions(transcript);
  const video = buildPreviewVideoContent({
    transcript,
    chapterDraft,
    captions,
    boardSelections: boardSelection
  });
  await copySelectedBoards(boardSelection, video);
  const merged = mergePreviewVideo(existingManifest, video);
  await writeAtomic(outputPath, `${JSON.stringify(merged, null, 2)}\n`);

  console.log(`Preview 內容已建立：${video.videoId}`);
  console.log(`章節：${video.chapters.length}`);
  console.log(`字幕：${transcript.segments.length} 段壓縮為 ${video.captions.length} 段`);
  console.log(`板書：${video.chapters.reduce((sum, chapter) => sum + chapter.boardFrames.length, 0)} 張`);
  console.log(`內容指紋：${video.contentFingerprint}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
