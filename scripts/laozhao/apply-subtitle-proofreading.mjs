import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCliArgs } from "./review-package-core.mjs";
import { applySubtitleProofreading } from "./subtitle-proofreading-core.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const privateRoot = resolve(repoRoot, "data/laozhao/staging");
const defaultManifest = resolve(repoRoot, "data/laozhao/previewContent.generated.json");

function contentFingerprint(video) {
  const { contentFingerprint: _previous, ...content } = video;
  return createHash("sha256").update(JSON.stringify(content)).digest("hex");
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
    throw new Error("用法：node scripts/laozhao/apply-subtitle-proofreading.mjs --video-id <YouTube ID> --review <Chat 回傳私人 JSON> [--manifest <Preview JSON>]");
  }
  const manifestPath = typeof args.manifest === "string" ? resolve(args.manifest) : defaultManifest;
  const reviewRelative = relative(privateRoot, reviewPath);
  if (reviewRelative.startsWith("..") || resolve(privateRoot, reviewRelative) !== reviewPath) {
    throw new Error("Chat 字幕校對回覆必須放在 data/laozhao/staging/ 私人目錄內。");
  }
  const [manifest, review] = await Promise.all([
    readFile(manifestPath, "utf8").then(JSON.parse),
    readFile(reviewPath, "utf8").then(JSON.parse)
  ]);
  const videoIndex = manifest.videos?.findIndex((item) => item.videoId === videoId) ?? -1;
  if (videoIndex < 0) throw new Error(`Preview manifest 找不到影片：${videoId}`);
  const video = manifest.videos[videoIndex];
  const nextVideo = {
    ...video,
    captions: applySubtitleProofreading(video.captions, review, { videoId })
  };
  nextVideo.contentFingerprint = contentFingerprint(nextVideo);
  manifest.videos[videoIndex] = nextVideo;
  await writeAtomic(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`字幕校對已套用：${videoId}`);
  console.log(`修正：${review.corrections.length} 段；待確認：${review.unresolved.length} 段`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
