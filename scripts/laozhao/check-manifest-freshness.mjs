import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const manifestPath = resolve("data/laozhao/courseManifest.generated.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const generatedAt = new Date(manifest.generatedAt);

if (Number.isNaN(generatedAt.getTime())) {
  throw new Error("老趙 manifest 的 generatedAt 無效。");
}

const ageDays = (Date.now() - generatedAt.getTime()) / 86_400_000;
if (ageDays > 30) {
  throw new Error("老趙 YouTube metadata 已超過 30 天；請先執行 npm run sync:laozhao 再發布這項功能。");
}

if (ageDays > 21) {
  console.warn("老趙 YouTube metadata 已超過 21 天，建議安排重新同步。");
}

console.log(`老趙 manifest freshness 通過：${manifest.videos?.length ?? 0} 部影片，${ageDays.toFixed(1)} 天前同步。`);
