import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildLectureNotesPackage } from "./lecture-notes-core.mjs";
import { parseCliArgs } from "./review-package-core.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const privateRoot = resolve(repoRoot, "data/laozhao/staging");
const defaultManifest = resolve(repoRoot, "data/laozhao/previewContent.generated.json");

function assertInside(root, pathname, label) {
  const child = relative(root, pathname);
  if (child.startsWith("..") || resolve(root, child) !== pathname) {
    throw new Error(`${label}必須位於 ${relative(repoRoot, root)}/ 內。`);
  }
}

async function main() {
  const args = parseCliArgs(process.argv.slice(2));
  const videoId = typeof args["video-id"] === "string" ? args["video-id"] : "";
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
    throw new Error("用法：node scripts/laozhao/build-lecture-notes-package.mjs --video-id <YouTube ID> [--manifest <Preview JSON>] [--output <私人 Markdown>]");
  }
  const manifestPath = typeof args.manifest === "string" ? resolve(args.manifest) : defaultManifest;
  const outputPath = typeof args.output === "string"
    ? resolve(args.output)
    : resolve(privateRoot, videoId, "review-package/lecture-notes-package.private.md");
  assertInside(privateRoot, outputPath, "講義整理包");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const video = manifest.videos?.find((item) => item.videoId === videoId);
  if (!video) throw new Error(`Preview manifest 找不到影片：${videoId}`);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, buildLectureNotesPackage(video));
  console.log(`完整列點講義整理包已建立：${relative(repoRoot, outputPath)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
