import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { createReadStream } from "node:fs";
import { copyFile, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { compressCaptionSegments } from "./captions-core.mjs";
import { parseCliArgs } from "./review-package-core.mjs";
import { captionFingerprint } from "./subtitle-proofreading-core.mjs";
import {
  buildPreviewVideoContent,
  deriveAutomaticPreviewMaterials,
  mergePreviewVideo,
  validateReviewedCaptionsForPreview
} from "./preview-content-core.mjs";
import { validateReferenceMap } from "./reference-map-core.mjs";

const execFileAsync = promisify(execFile);

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

async function readOptionalJson(pathname, fallback, label) {
  if (!pathname) return fallback;
  return readJson(pathname, label);
}

async function fileExists(pathname) {
  try {
    await stat(pathname);
    return true;
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") return false;
    throw error;
  }
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

function referenceDestinationFor(root, pdfPage) {
  return resolve(root, "notes", `page-${String(pdfPage).padStart(3, "0")}`);
}

async function sha256File(pathname) {
  const hash = createHash("sha256");
  await new Promise((accept, reject) => {
    const stream = createReadStream(pathname);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", accept);
  });
  return hash.digest("hex");
}

async function renderReferenceNotes(referenceMap, referencePdfPath, video, temporaryRoot) {
  if (!referenceMap) return;
  const actualSha256 = await sha256File(referencePdfPath);
  if (actualSha256 !== referenceMap.source?.sha256) {
    throw new Error("參考筆記 PDF 與人工對照時使用的版本不同，停止建立 Preview。");
  }
  const pages = [...new Set(video.chapters.flatMap((chapter) => (
    chapter.referenceNotes.map((note) => note.pdfPage)
  )))].sort((left, right) => left - right);
  await mkdir(resolve(temporaryRoot, "notes"), { recursive: true });
  for (const pdfPage of pages) {
    const destination = referenceDestinationFor(temporaryRoot, pdfPage);
    assertInside(temporaryRoot, destination, "筆記 Preview 暫存輸出");
    await execFileAsync("pdftoppm", [
      "-f", String(pdfPage),
      "-l", String(pdfPage),
      "-singlefile",
      "-jpeg",
      "-jpegopt", "quality=88,optimize=y,progressive=y",
      "-r", "144",
      referencePdfPath,
      destination
    ]);
    await stat(`${destination}.jpg`);
  }
}

async function buildPublicMaterials(selection, video, referenceMap, referencePdfPath) {
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
    await renderReferenceNotes(referenceMap, referencePdfPath, video, temporaryRoot);
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
    "  [--captions <captions.reviewed.private.json>]",
    "  --chapters <chapters.candidate.private.json>",
    "  [--board-selection <board-selection.private.json>]",
    "  [--board-candidates <board-candidates/index.private.json>]",
    "  [--reference-map <reference-notes.private.json>]",
    "  [--reference-pdf <reference-notes.pdf>]",
    "  [--lecture-notes <lecture-notes.validated.private.json>]",
    "  [--output data/laozhao/previewContent.generated.json]",
    "  --confirm-authorized-preview",
    "  [--confirm-reference-preview]"
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
  const captionsPath = typeof args.captions === "string" ? resolve(args.captions) : null;
  const chapterPath = resolve(args.chapters);
  const selectionPath = typeof args["board-selection"] === "string"
    ? resolve(args["board-selection"])
    : null;
  const boardCandidatesPath = typeof args["board-candidates"] === "string"
    ? resolve(args["board-candidates"])
    : resolve(dirname(chapterPath), "board-candidates/index.private.json");
  const referenceMapPath = typeof args["reference-map"] === "string"
    ? resolve(args["reference-map"])
    : null;
  const referencePdfPath = typeof args["reference-pdf"] === "string"
    ? resolve(args["reference-pdf"])
    : null;
  const lectureNotesPath = typeof args["lecture-notes"] === "string"
    ? resolve(args["lecture-notes"])
    : null;
  const includeReferenceNotes = Boolean(referenceMapPath || referencePdfPath || args["confirm-reference-preview"]);
  if (
    includeReferenceNotes &&
    (!referenceMapPath || !referencePdfPath || args["confirm-reference-preview"] !== true)
  ) {
    throw new Error("加入筆記必須同時提供 --reference-map、--reference-pdf 與 --confirm-reference-preview。");
  }
  const outputPath = typeof args.output === "string" ? resolve(args.output) : defaultOutput;
  assertInside(privateRoot, transcriptPath, "私人逐字稿");
  if (captionsPath) assertInside(privateRoot, captionsPath, "已驗證字幕");
  assertInside(privateRoot, chapterPath, "私人章節草稿");
  if (selectionPath) assertInside(privateRoot, selectionPath, "板書選擇檔");
  assertInside(privateRoot, boardCandidatesPath, "板書候選檔");
  if (referenceMapPath) assertInside(privateRoot, referenceMapPath, "私人筆記對照檔");
  if (lectureNotesPath) assertInside(privateRoot, lectureNotesPath, "已驗證列點講義");
  assertInside(resolve(repoRoot, "data/laozhao"), outputPath, "Preview manifest");

  const [transcript, reviewedCaptions, chapterDraft, boardSelection, boardCandidates, referenceMap, explicitLectureNotes, existingManifest] = await Promise.all([
    readJson(transcriptPath, "私人逐字稿"),
    readOptionalJson(captionsPath, null, "已驗證字幕"),
    readJson(chapterPath, "私人章節草稿"),
    readOptionalJson(selectionPath, null, "板書選擇檔"),
    fileExists(boardCandidatesPath)
      .then((exists) => exists ? readJson(boardCandidatesPath, "板書候選檔") : null),
    readOptionalJson(referenceMapPath, null, "私人筆記對照檔"),
    readOptionalJson(lectureNotesPath, null, "已驗證列點講義"),
    readExistingManifest(outputPath)
  ]);
  const materialInputs = deriveAutomaticPreviewMaterials({
    videoId: transcript.videoId,
    sourceFingerprint: transcript.sourceFingerprint,
    boardSelection,
    boardCandidates,
    referenceMap
  });
  const effectiveBoardSelection = materialInputs.boardSelection;
  const effectiveReferenceMap = materialInputs.referenceMap;
  if (effectiveReferenceMap) {
    if (!effectiveBoardSelection) throw new Error("加入筆記前必須提供板書選擇檔或板書候選檔。");
    const referenceValidation = validateReferenceMap(effectiveReferenceMap, effectiveBoardSelection);
    if (!referenceValidation.valid) {
      throw new Error(`筆記對照未通過驗證：${referenceValidation.errors.join("；")}`);
    }
  }
  const existingVideo = existingManifest.videos
    ?.find((item) => item?.videoId === transcript.videoId)
    ?? null;
  const existingLectureNotes = existingVideo?.lectureNotes ?? null;
  const lectureNotes = explicitLectureNotes ?? existingLectureNotes;
  const existingCaptions = Array.isArray(existingVideo?.captions) ? existingVideo.captions : null;
  const captions = reviewedCaptions
    ? validateReviewedCaptionsForPreview(transcript, reviewedCaptions)
    : existingLectureNotes
      && existingCaptions
      && existingLectureNotes.captionFingerprint === captionFingerprint(existingCaptions)
      ? existingCaptions
      : buildCaptions(transcript);
  if (lectureNotes && lectureNotes.captionFingerprint !== captionFingerprint(captions)) {
    throw new Error("列點講義不是針對目前這版字幕；請提供相同版本的校訂字幕與講義。");
  }
  const video = buildPreviewVideoContent({
    transcript,
    chapterDraft,
    captions,
    boardSelections: effectiveBoardSelection,
    referenceMap: effectiveReferenceMap,
    lectureNotes
  });
  await buildPublicMaterials(effectiveBoardSelection, video, effectiveReferenceMap, referencePdfPath);
  const merged = mergePreviewVideo(existingManifest, video);
  await writeAtomic(outputPath, `${JSON.stringify(merged, null, 2)}\n`);

  console.log(`Preview 內容已建立：${video.videoId}`);
  console.log(`章節：${video.chapters.length}`);
  console.log(`字幕：${transcript.segments.length} 段壓縮為 ${video.captions.length} 段`);
  console.log(`板書：${video.chapters.reduce((sum, chapter) => sum + chapter.boardFrames.length, 0)} 張`);
  console.log(`筆記：${new Set(video.chapters.flatMap((chapter) => chapter.referenceNotes.map((note) => note.src))).size} 頁`);
  if (materialInputs.autoSelectedCount > 0 || materialInputs.autoMappedCount > 0) {
    console.log(`自動補入：${materialInputs.autoSelectedCount} 張板書、${materialInputs.autoMappedCount} 組筆記對照`);
  }
  console.log(`列點講義：${video.lectureNotes?.blocks.length ?? 0} 區塊`);
  console.log(`內容指紋：${video.contentFingerprint}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
