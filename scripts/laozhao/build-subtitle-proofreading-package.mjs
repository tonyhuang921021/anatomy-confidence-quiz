import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCliArgs } from "./review-package-core.mjs";
import { buildSubtitleProofreadingPackage } from "./subtitle-proofreading-core.mjs";

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
    throw new Error("用法：node scripts/laozhao/build-subtitle-proofreading-package.mjs --video-id <YouTube ID> [--manifest <Preview JSON>] [--output <私人 Markdown>]");
  }
  const manifestPath = typeof args.manifest === "string" ? resolve(args.manifest) : defaultManifest;
  const outputPath = typeof args.output === "string"
    ? resolve(args.output)
    : resolve(privateRoot, videoId, "review-package/subtitle-proofreading-package.private.md");
  assertInside(privateRoot, outputPath, "字幕校對包");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const video = manifest.videos?.find((item) => item.videoId === videoId);
  if (!video) throw new Error(`Preview manifest 找不到影片：${videoId}`);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, buildSubtitleProofreadingPackage(video));
  console.log(`完整字幕校對包已建立：${relative(repoRoot, outputPath)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
