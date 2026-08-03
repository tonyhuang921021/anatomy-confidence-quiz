import { readdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { evaluatePreviewReleaseGate } from "./release-gate-core.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const manifestPath = resolve(repoRoot, "data/laozhao/previewContent.generated.json");
const publicBoardRoot = resolve(repoRoot, "public/laozhao-preview");

async function countPreviewVideos() {
  try {
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    return Array.isArray(manifest?.videos) ? manifest.videos.length : 0;
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") return 0;
    throw new Error("無法檢查老趙 Preview manifest。", { cause: error });
  }
}

async function countFiles(pathname) {
  try {
    const entries = await readdir(pathname, { withFileTypes: true });
    let count = 0;
    for (const entry of entries) {
      count += entry.isDirectory()
        ? await countFiles(resolve(pathname, entry.name))
        : 1;
    }
    return count;
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") return 0;
    throw error;
  }
}

const [previewVideoCount, publicBoardAssetCount] = await Promise.all([
  countPreviewVideos(),
  countFiles(publicBoardRoot)
]);
const result = evaluatePreviewReleaseGate({
  vercelEnv: process.env.VERCEL_ENV,
  previewVideoCount,
  publicBoardAssetCount
});

if (result.blocked) {
  console.error(result.message);
  process.exitCode = 1;
} else {
  console.log(result.message);
}
