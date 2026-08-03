import { readFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCliArgs } from "./review-package-core.mjs";
import { validateReferenceMap } from "./reference-map-core.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const privateRoot = resolve(repoRoot, "data/laozhao/staging");

function assertPrivatePath(pathname, label) {
  const child = relative(privateRoot, pathname);
  if (child.startsWith("..") || resolve(privateRoot, child) !== pathname) {
    throw new Error(`${label}只能位於 data/laozhao/staging/ 內。`);
  }
}

async function readJson(pathname, label) {
  try {
    return JSON.parse(await readFile(pathname, "utf8"));
  } catch {
    throw new Error(`無法解析${label}：${pathname}`);
  }
}

async function main() {
  const args = parseCliArgs(process.argv.slice(2));
  if (typeof args.reference !== "string" || typeof args["board-selection"] !== "string") {
    throw new Error("用法：validate-reference-map.mjs --reference <reference-notes.private.json> --board-selection <board-selection.private.json>");
  }
  const referencePath = resolve(args.reference);
  const boardSelectionPath = resolve(args["board-selection"]);
  assertPrivatePath(referencePath, "筆記對照檔");
  assertPrivatePath(boardSelectionPath, "板書選擇檔");
  const [referenceMap, boardSelection] = await Promise.all([
    readJson(referencePath, "筆記對照檔"),
    readJson(boardSelectionPath, "板書選擇檔")
  ]);
  const result = validateReferenceMap(referenceMap, boardSelection);
  if (!result.valid) {
    for (const error of result.errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }
  console.log(`板書對照驗證通過：${result.stats.mappedBoardFrames} 張`);
  console.log(`對應筆記頁：${result.stats.pdfPages.join("、")}`);
  if (!result.canPublishReferenceImages) {
    console.log("筆記圖片維持私人參考；尚未確認公開授權。");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
