import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateLectureNotesReview } from "./lecture-notes-core.mjs";
import { parseCliArgs } from "./review-package-core.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const privateRoot = resolve(repoRoot, "data/laozhao/staging");
const defaultManifest = resolve(repoRoot, "data/laozhao/previewContent.generated.json");

function contentFingerprint(video) {
  const { contentFingerprint: _previous, ...content } = video;
  return createHash("sha256").update(JSON.stringify(content)).digest("hex");
}

function assertInside(root, pathname, label) {
  const child = relative(root, pathname);
  if (child.startsWith("..") || resolve(root, child) !== pathname) {
    throw new Error(`${label}必須位於 ${relative(repoRoot, root)}/ 內。`);
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
  const videoId = typeof args["video-id"] === "string" ? args["video-id"] : "";
  const reviewPath = typeof args.review === "string" ? resolve(args.review) : null;
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId) || !reviewPath) {
    throw new Error("用法：node scripts/laozhao/apply-lecture-notes-review.mjs --video-id <YouTube ID> --review <Chat 回傳私人 JSON> [--manifest <Preview JSON>] [--output <私人 JSON>]");
  }
  const manifestPath = typeof args.manifest === "string" ? resolve(args.manifest) : defaultManifest;
  const outputPath = typeof args.output === "string"
    ? resolve(args.output)
    : resolve(privateRoot, videoId, "review-package/lecture-notes.validated.private.json");
  assertInside(privateRoot, reviewPath, "Chat 講義回覆");
  assertInside(privateRoot, outputPath, "已驗證講義");

  const [manifest, review] = await Promise.all([
    readFile(manifestPath, "utf8").then(JSON.parse),
    readFile(reviewPath, "utf8").then(JSON.parse)
  ]);
  const videoIndex = manifest.videos?.findIndex((item) => item.videoId === videoId) ?? -1;
  if (videoIndex < 0) throw new Error(`Preview manifest 找不到影片：${videoId}`);
  const video = manifest.videos[videoIndex];
  const lectureNotes = validateLectureNotesReview(video, review);
  const validatedPrivate = {
    schemaVersion: "1.0.0",
    videoId,
    captionFingerprint: lectureNotes.captionFingerprint,
    reviewStatus: "validated",
    blocks: lectureNotes.blocks,
    unresolved: []
  };
  const nextVideo = { ...video, lectureNotes };
  nextVideo.contentFingerprint = contentFingerprint(nextVideo);
  manifest.videos[videoIndex] = nextVideo;

  await writeAtomic(outputPath, `${JSON.stringify(validatedPrivate, null, 2)}\n`);
  await writeAtomic(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`列點講義已驗證並套用：${videoId}`);
  console.log(`區塊：${lectureNotes.blocks.length}；字幕覆蓋：${video.captions.length} / ${video.captions.length}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
