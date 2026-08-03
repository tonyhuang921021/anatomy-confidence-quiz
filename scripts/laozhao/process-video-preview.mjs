import { spawnSync } from "node:child_process";
import { access, mkdir, rename, rm, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCliArgs } from "./review-package-core.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const privateRoot = resolve(repoRoot, "data/laozhao/staging");
const videoIdPattern = /^[A-Za-z0-9_-]{11}$/;

function assertInside(root, pathname, label) {
  const child = relative(root, pathname);
  if (child.startsWith("..") || resolve(root, child) !== pathname) {
    throw new Error(`${label}必須位於 ${relative(repoRoot, root)}/ 內。`);
  }
}

async function exists(pathname) {
  try {
    await access(pathname, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function firstExisting(paths) {
  for (const pathname of paths) {
    if (await exists(pathname)) return pathname;
  }
  return null;
}

function runNode(script, args) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: repoRoot,
    env: process.env,
    stdio: "inherit"
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${relative(repoRoot, script)} 執行失敗。`);
}

async function writeAtomic(pathname, value) {
  await mkdir(dirname(pathname), { recursive: true });
  const temporary = `${pathname}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`);
  try {
    await rename(temporary, pathname);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

function displayPath(pathname) {
  return relative(repoRoot, pathname);
}

async function main() {
  const args = parseCliArgs(process.argv.slice(2));
  const videoId = typeof args["video-id"] === "string" ? args["video-id"] : "";
  if (!videoIdPattern.test(videoId)) {
    throw new Error("用法：npm run process:laozhao-video -- --video-id <11 字元 YouTube ID> [--chapter-draft <私人 JSON>] [--extract-board] [--board-selection <私人 JSON>] [--reference-map <私人 JSON>] [--confirm-authorized-preview]");
  }

  const videoRoot = resolve(privateRoot, videoId);
  const reviewRoot = resolve(videoRoot, "review-package");
  const transcriptPath = typeof args.transcript === "string"
    ? resolve(args.transcript)
    : resolve(reviewRoot, "transcript.private.json");
  const validatedPath = typeof args.output === "string"
    ? resolve(args.output)
    : resolve(reviewRoot, "chapters.validated.preview.private.json");
  const sourcePath = typeof args.source === "string"
    ? resolve(args.source)
    : resolve(videoRoot, `source/${videoId}.mp4`);
  const selectionPath = typeof args["board-selection"] === "string"
    ? resolve(args["board-selection"])
    : resolve(reviewRoot, "board-selection.preview.private.json");
  const referencePath = typeof args["reference-map"] === "string"
    ? resolve(args["reference-map"])
    : resolve(reviewRoot, "reference-notes.private.json");
  const statusPath = resolve(reviewRoot, "pipeline-status.private.json");

  for (const [pathname, label] of [
    [transcriptPath, "私人逐字稿"],
    [validatedPath, "已驗證章節"],
    [sourcePath, "來源影片"],
    [selectionPath, "板書選擇檔"],
    [referencePath, "筆記對照檔"],
    [statusPath, "流程狀態檔"]
  ]) assertInside(privateRoot, pathname, label);

  if (!(await exists(transcriptPath))) throw new Error(`找不到私人逐字稿：${displayPath(transcriptPath)}`);
  const explicitDraft = typeof args["chapter-draft"] === "string" ? resolve(args["chapter-draft"]) : null;
  if (explicitDraft) assertInside(privateRoot, explicitDraft, "章節草稿");
  const inferredDraft = explicitDraft ?? await firstExisting([
    resolve(reviewRoot, "chapters.candidate.private.json"),
    resolve(reviewRoot, "chapters.chatgpt-pro.candidate.private.json"),
    resolve(reviewRoot, "chapter-draft.from-chat.private.json")
  ]);

  if (inferredDraft) {
    runNode(resolve(repoRoot, "scripts/laozhao/validate-chapter-draft.mjs"), [
      "--transcript", transcriptPath,
      "--draft", inferredDraft,
      "--output", validatedPath
    ]);
  } else if (!(await exists(validatedPath))) {
    throw new Error("找不到章節草稿或已驗證章節，請先放入 Chat 回傳的私人 JSON。");
  }

  if (args["extract-board"] === true) {
    if (!(await exists(sourcePath))) throw new Error(`找不到已授權來源影片：${displayPath(sourcePath)}`);
    const boardArgs = ["board", sourcePath, validatedPath];
    if (typeof args["capture-tool"] === "string") boardArgs.push("--capture-tool", args["capture-tool"]);
    runNode(resolve(repoRoot, "scripts/laozhao/run-python-tool.mjs"), boardArgs);
  }

  const hasSelection = await exists(selectionPath);
  const hasReferenceMap = await exists(referencePath);
  if (hasReferenceMap) {
    if (!hasSelection) throw new Error("已有筆記對照，但缺少其對應的板書選擇檔。");
    runNode(resolve(repoRoot, "scripts/laozhao/validate-reference-map.mjs"), [
      "--reference", referencePath,
      "--board-selection", selectionPath
    ]);
  }

  if (args["confirm-authorized-preview"] !== true) {
    const state = hasSelection ? "awaiting_preview_confirmation" : "awaiting_human_board_selection";
    await writeAtomic(statusPath, {
      schemaVersion: "1.0.0",
      pipelineVersion: "laozhao-video-preview-v1",
      videoId,
      updatedAt: new Date().toISOString(),
      state,
      artifacts: {
        transcript: displayPath(transcriptPath),
        chapters: displayPath(validatedPath),
        boardCandidates: displayPath(resolve(reviewRoot, "board-candidates/index.private.json")),
        boardSelection: hasSelection ? displayPath(selectionPath) : null,
        referenceMap: hasReferenceMap ? displayPath(referencePath) : null
      },
      gates: {
        chapterValidation: "passed",
        humanBoardSelection: hasSelection ? "passed" : "required",
        referenceMapping: hasReferenceMap ? "passed_private_only" : "not_provided",
        authorizedPreviewConfirmation: "required"
      }
    });
    console.log(hasSelection
      ? "私人內容已驗證；請明確加入 --confirm-authorized-preview 才會重建測試頁。"
      : "章節已驗證；請先人工選擇最完整板書，再建立測試頁。");
    return;
  }

  if (!hasSelection) throw new Error("建立 Preview 前必須提供人工確認的板書選擇檔；沒有板書的章節可在檔案中明確留空。");
  runNode(resolve(repoRoot, "scripts/laozhao/build-preview-content.mjs"), [
    "--transcript", transcriptPath,
    "--chapters", validatedPath,
    "--board-selection", selectionPath,
    "--confirm-authorized-preview"
  ]);
  await writeAtomic(statusPath, {
    schemaVersion: "1.0.0",
    pipelineVersion: "laozhao-video-preview-v1",
    videoId,
    updatedAt: new Date().toISOString(),
    state: "preview_built",
    artifacts: {
      transcript: displayPath(transcriptPath),
      chapters: displayPath(validatedPath),
      boardSelection: displayPath(selectionPath),
      referenceMap: hasReferenceMap ? displayPath(referencePath) : null,
      previewManifest: "data/laozhao/previewContent.generated.json",
      publicBoards: `public/laozhao-preview/${videoId}/boards/`
    },
    gates: {
      chapterValidation: "passed",
      humanBoardSelection: "passed",
      referenceMapping: hasReferenceMap ? "passed_private_only" : "not_provided",
      authorizedPreviewConfirmation: "passed",
      productionRelease: "blocked"
    }
  });
  console.log(`第一階段 Preview 已重建：${videoId}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
