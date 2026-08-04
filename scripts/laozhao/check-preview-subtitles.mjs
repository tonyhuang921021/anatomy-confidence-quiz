import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assertTaiwanTraditionalCaptions } from "./subtitle-proofreading-core.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const manifestPath = resolve(repoRoot, "data/laozhao/previewContent.generated.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

for (const video of manifest.videos ?? []) {
  try {
    assertTaiwanTraditionalCaptions(video.captions ?? []);
  } catch (error) {
    console.error(`${video.videoId} 字幕檢查失敗：${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

if (!process.exitCode) console.log("老趙 Preview 字幕皆為臺灣繁體中文。");
