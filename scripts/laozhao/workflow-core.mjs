import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { access, copyFile, mkdir, mkdtemp, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";
import { promisify } from "node:util";
import { compressCaptionSegments } from "./captions-core.mjs";
import {
  captionFingerprint,
  findNonTaiwanCaptions,
  normalizeTaiwanMedicalText,
  TAIWAN_MEDICAL_TERMINOLOGY_GUIDE
} from "./subtitle-proofreading-core.mjs";
import { validateAndNormalizeChapterDraft } from "./review-package-core.mjs";
import {
  hasExplicitTeacherEmphasis,
  validateLectureNotesReview
} from "./lecture-notes-core.mjs";

const execFileAsync = promisify(execFile);

export const WORKFLOW_VERSION = "laozhao-chatgpt-pro-workflow-v2";
export const WORKFLOW_SCHEMA_VERSION = "1.0.0";
export const PROMPT_VERSION = "laozhao-full-video-review-v2";

const videoIdPattern = /^[A-Za-z0-9_-]{11}$/;
const sha256Pattern = /^[a-f0-9]{64}$/;
const expectedResponseFiles = [
  "response-manifest.json",
  "chapters.candidate.json",
  "captions.reviewed.json",
  "lecture-notes.candidate.json",
  "unresolved.json"
];
const directionPattern = /(上|下|前|後|內|外|近端|遠端|左|右|同側|對側|正向|負向|增加|減少|升高|降低)/g;
const auditEnglishStopwords = new Set([
  "and", "blood", "first", "for", "from", "here", "into", "line", "page",
  "procedure", "processes", "second", "section", "side", "summary", "supply", "that", "the",
  "then", "there", "third", "this", "with"
]);
const auditWeakCountUnitPattern = /^\d+(?:\.\d+)?(?:個|塊|根|層|頁|章|節|項|行)$/;
const auditWeakDiagramLabelPattern = /^d\d+$/i;
const lecturePointMaxDepth = 3;
const lecturePointMaxChildren = 14;
const lecturePointMaxNodes = 80;
const auditSignalAliases = new Map([
  ["subclavian", ["鎖骨下"]],
  ["vessels", ["血管"]],
  ["trapeziumlike", ["trapezium", "trapezoid", "菱形"]],
  ["innervation", ["神經支配"]],
  ["humeroulnar", ["肱尺"]],
  ["humeroradial", ["肱橈"]],
  ["lesser", ["小坐骨"]],
  ["sciatic", ["坐骨"]],
  ["greater", ["大坐骨"]],
  ["sinuses", ["sinus", "副鼻竇", "鼻竇"]],
  ["transverse", ["橫突"]],
  ["spinous", ["棘突"]],
  ["articular", ["關節突"]],
  ["ivd", ["椎間盤"]]
]);
const minimumDirectionCoverageRatio = 0.5;
const compressionReviewDisposition = "verified_cleanup";
const compressionReviewReasons = new Set([
  "filler_only",
  "repetition_only",
  "false_start_only",
  "meaning_preserved_after_deduplication"
]);

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function validateCompressionReviews(raw, compressionIssues) {
  const errors = [];
  const acknowledged = [];
  const ignoredStale = [];
  const reviews = raw?.compressionReviews;
  if (reviews === undefined) return { errors, acknowledged, ignoredStale, unacknowledged: compressionIssues };
  if (!Array.isArray(reviews)) {
    return {
      errors: ["compressionReviews 必須是陣列。"],
      acknowledged,
      ignoredStale,
      unacknowledged: compressionIssues
    };
  }

  const issuesById = new Map(compressionIssues.map((issue) => [issue.captionId, issue]));
  const seen = new Set();
  for (const [index, review] of reviews.entries()) {
    const label = `第 ${index + 1} 筆字幕縮短審核`;
    if (!isRecord(review) || typeof review.captionId !== "string") {
      errors.push(`${label}格式無效。`);
      continue;
    }
    if (seen.has(review.captionId)) {
      errors.push(`${review.captionId} 的字幕縮短審核重複。`);
      continue;
    }
    seen.add(review.captionId);
    const issue = issuesById.get(review.captionId);
    if (!issue) {
      ignoredStale.push(review.captionId);
      continue;
    }
    if (review.disposition !== compressionReviewDisposition) {
      errors.push(`${review.captionId} 的 disposition 必須是 ${compressionReviewDisposition}。`);
      continue;
    }
    if (!compressionReviewReasons.has(review.reason)) {
      errors.push(`${review.captionId} 的 reason 無效。`);
      continue;
    }
    if (review.baseTextSha256 !== sha256(issue.baseText)) {
      errors.push(`${review.captionId} 的 baseTextSha256 與目前基底字幕不一致。`);
      continue;
    }
    if (review.reviewedTextSha256 !== sha256(issue.reviewedText)) {
      errors.push(`${review.captionId} 的 reviewedTextSha256 與目前校訂字幕不一致。`);
      continue;
    }
    acknowledged.push({
      captionId: review.captionId,
      disposition: review.disposition,
      reason: review.reason,
      retainedRatio: issue.retainedRatio
    });
  }

  const acknowledgedIds = new Set(acknowledged.map((review) => review.captionId));
  return {
    errors,
    acknowledged,
    ignoredStale,
    unacknowledged: compressionIssues.filter((issue) => !acknowledgedIds.has(issue.captionId))
  };
}

function safeFilenamePart(value, fallback) {
  const normalized = String(value ?? "")
    .normalize("NFKC")
    .replace(/[\\/:*?"<>|%]/g, "-")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  return normalized || fallback;
}

export function buildReadablePackageStem({ position, videoTitle, promptVersion = PROMPT_VERSION }) {
  const order = Number.isInteger(position) && position > 0
    ? `第${String(position).padStart(2, "0")}支`
    : "未排序";
  const title = safeFilenamePart(videoTitle, "未命名影片");
  const version = promptVersion.match(/-v(\d+)$/)?.[1] ?? "2";
  return `老趙解剖_${order}_${title}_完整校對_v${version}`;
}

export function sha256Json(value) {
  return sha256(JSON.stringify(value));
}

function displayPath(repoRoot, pathname) {
  return relative(repoRoot, pathname) || ".";
}

function assertInside(root, pathname, label) {
  const child = relative(root, pathname);
  if (child.startsWith("..") || resolve(root, child) !== pathname) {
    throw new Error(`${label}必須位於 ${root} 內。`);
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

async function readJson(pathname, label) {
  try {
    return JSON.parse(await readFile(pathname, "utf8"));
  } catch (error) {
    throw new Error(`無法解析${label}：${pathname}`, { cause: error });
  }
}

async function resolveReadablePackageStem(repoRoot, transcript, videoId) {
  let position = null;
  let manifestTitle = "";
  try {
    const manifest = await readJson(
      resolve(repoRoot, "data/laozhao/courseManifest.generated.json"),
      "老趙課程清單"
    );
    const index = Array.isArray(manifest?.videos)
      ? manifest.videos.findIndex((video) => video?.id === videoId)
      : -1;
    if (index >= 0) {
      position = index + 1;
      manifestTitle = manifest.videos[index]?.title ?? "";
    }
  } catch {
    // 課程清單缺失時仍可用逐字稿標題建立工作包。
  }
  return buildReadablePackageStem({
    position,
    videoTitle: transcript.videoTitle || manifestTitle || "未命名影片"
  });
}

export async function writeAtomic(pathname, value) {
  await mkdir(dirname(pathname), { recursive: true });
  const temporary = `${pathname}.tmp-${process.pid}-${Date.now()}`;
  const content = typeof value === "string" ? value : `${JSON.stringify(value, null, 2)}\n`;
  await writeFile(temporary, content);
  try {
    await rename(temporary, pathname);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

export function getWorkflowPaths(repoRoot, videoId) {
  if (!videoIdPattern.test(videoId)) throw new Error("videoId 必須是 11 字元 YouTube ID。");
  const privateRoot = resolve(repoRoot, "data/laozhao/staging");
  const videoRoot = resolve(privateRoot, videoId);
  const reviewRoot = resolve(videoRoot, "review-package");
  const jobsRoot = resolve(videoRoot, "jobs");
  assertInside(privateRoot, videoRoot, "影片工作目錄");
  return {
    privateRoot,
    videoRoot,
    reviewRoot,
    jobsRoot,
    transcript: resolve(reviewRoot, "transcript.private.json"),
    chapters: resolve(reviewRoot, "chapters.validated.private.json"),
    chaptersPreview: resolve(reviewRoot, "chapters.validated.preview.private.json"),
    captionsReviewed: resolve(reviewRoot, "captions.reviewed.private.json"),
    lectureNotes: resolve(reviewRoot, "lecture-notes.validated.private.json"),
    state: resolve(reviewRoot, "pipeline-state.private.json"),
    lastValidation: resolve(reviewRoot, "workflow-validation.private.json"),
    boardSelection: resolve(reviewRoot, "board-selection.preview.private.json"),
    referenceMap: resolve(reviewRoot, "reference-notes.private.json")
  };
}

function buildCaptions(transcript) {
  const compressed = compressCaptionSegments(transcript.segments, {
    maxGapSec: 0.55,
    maxDurationSec: 7,
    maxTextLength: 56,
    respectSentenceEndings: true,
    invalidSegmentPolicy: "throw"
  });
  return compressed.map((cue, index) => ({
    id: `cue-${String(index + 1).padStart(5, "0")}`,
    startSec: cue.start,
    endSec: cue.end,
    text: cue.text,
    sourceSegmentStart: cue.sourceSegmentStart + 1,
    sourceSegmentEnd: cue.sourceSegmentEnd + 1,
    sourceSegmentCount: cue.sourceSegmentCount
  }));
}

function chapterDraftFromValidated(chapters, transcript) {
  return {
    schemaVersion: WORKFLOW_SCHEMA_VERSION,
    videoId: transcript.videoId,
    sourceFingerprint: transcript.sourceFingerprint,
    chapters: chapters.map((chapter) => ({
      title: chapter.title,
      startSec: chapter.startSec,
      endSec: chapter.endSec,
      summary: chapter.summary,
      tags: chapter.tags,
      representativeFrameTargetSec: chapter.representativeFrameTargetSec,
      reviewStatus: "draft"
    }))
  };
}

function baseChaptersFromPreview(preview, transcript) {
  if (!Array.isArray(preview?.chapters) || preview.chapters.length === 0) return [];
  return preview.chapters.map((chapter) => ({
    id: chapter.id,
    title: chapter.title,
    startSec: chapter.startSec,
    endSec: chapter.endSec,
    summary: chapter.summary,
    tags: chapter.tags,
    representativeFrameTargetSec: chapter.representativeFrameTargetSec,
    reviewStatus: "draft"
  }));
}

export function buildSourceBoundaryPromptLines() {
  return [
    "影片在句子、示範或老師的結論尚未完成時剛好到達來源檔結尾：不要補寫影片外內容，字幕與講義都只保留最後可證實的資訊。",
    "若最後 cue 已如實保留，且唯一問題只是來源檔在此結束，這屬於來源邊界，不是待查內容：不要放入 unresolved.json，也不要聲稱老師後續講了什麼。",
    "只有無法確認是否漏轉、最後 cue 本身仍聽不清，或來源檔並未真的結束時，才保留 unresolved；needs 應依實際缺少的證據填 audio、board 或 other，不可用 continuation 讓同一項疑義永久阻擋匯入。"
  ];
}

function buildPrompt({ job, transcript, baseCaptions, baseChapters }) {
  const chapterInstruction = baseChapters.length > 0
    ? "目前已有章節邊界。請保留 chapterId 對應的時間邊界，不要任意重切；若確實需要修正，只能列入 unresolved。"
    : "目前沒有已驗證章節，請先依完整逐字稿建立不重疊、連續涵蓋全片的章節。";
  return [
    "你是熟悉臺灣醫學系共筆的資深內容編輯。這是一支老師完整授課影片的工作包。請先讀完整個 input/transcript.private.json，再讀 input/captions.base.json、input/chapters.base.json 與 input/taiwan-terminology.json，最後產生可下載的結果 ZIP。",
    "",
    "不要在聊天訊息貼大量 JSON。請使用你的檔案工具建立下列五個 JSON 檔，放在一個 ZIP 裡供下載。只要無法確定，就寫入 unresolved.json，不要猜。",
    "",
    `工作識別：jobId=${job.jobId}；videoId=${job.videoId}；sourceFingerprint=${job.sourceFingerprint}；promptVersion=${PROMPT_VERSION}`,
    chapterInstruction,
    "",
    "字幕規則：",
    "1. captions.reviewed.json 必須保留 base captions 的全部 cue，ID、起訖時間、來源段落、順序及數量完全不變。只能修正文字、臺灣繁體、標點、醫學英文拼字與不自然斷句。",
    "2. 不要合併、拆分、刪除或重新編號字幕。字幕顯示可依句號、問號、驚嘆號及分號自然換行，但不能改 cue 時間。",
    "3. 不確定的同音英文、藥名、構造名或縮寫保留原本字幕文字並列入 unresolved，不可自行猜成看似合理的字。",
    "3a. 臺灣醫學術語不可只靠一般繁簡轉換猜字。腭、關節面、游離、分布、深岩神經等醫學或臺灣常用形式可以保留；不要把關節面改成關節麵，也不要做整批腭→顎、游離→遊離的替換。只有工作包明列的安全字形或上下文明確支持時才修正。",
    "3b. 若校訂文字去掉大量純贅詞、重複或起句失敗，導致去除空白與標點後少於 baseText 的 55%，必須逐段比對。只有確認定義、數字、方向、否定、例子、例外、自我修正、醫學術語與考試提醒都保留時，才可在 captions.reviewed.json 的 compressionReviews 加入審核憑證；不確定時改列 unresolved，不得假裝已確認。",
    "",
    "章節時間硬性規格（輸出前逐項檢查）：",
    "4. 每一章的 startSec、endSec、representativeFrameTargetSec 必須是 JSON number 的整數秒；禁止輸出 175.2、334.2 這類小數。representativeFrameTargetSec 也可以填 null。",
    "5. startSec 必須 >= 0；endSec 必須 > startSec；每章依時間排序且不得重疊。若原始時間碼是小數，先對每個內部邊界只做一次四捨五入，再讓前一章 endSec 與下一章 startSec 共用同一個整數，不可分別四捨五入造成重疊或缺口。",
    "6. representativeFrameTargetSec 若不是 null，必須是整數，且滿足 startSec <= representativeFrameTargetSec < endSec；無法安全落在章節內時填 null。章節不可超過逐字稿的影片長度。",
    "7. 章節必須連續涵蓋逐字稿全片；若無法判定邊界，保留原邊界並列入 unresolved，不要自行重切整支影片。",
    "",
    "講義規則：",
    "8. lecture-notes.candidate.json 必須包含完整 teacher blocks，從第一個 cue 連續涵蓋到最後一個 cue，不可缺段或重疊。每個 teacher block 最多涵蓋 14 段連續字幕；超過時必須依語意拆成相鄰區塊，但不可遺漏、重複或改動原內容。每個列點與表格列都要有 evidenceStartCue、evidenceEndCue，且證據必須位於同一章。",
    "9. 老師講過的定義、數字、單位、方向、否定、因果、步驟、比較、例子、例外、口訣、自我修正與考試提醒都不可遺漏。一般知識直接寫成客觀敘述；必要補充另列 provenance=supplement，並以 afterBlockId 指向老師區塊。",
    "10. 使用多層清單，最多四層；比較、分類、流程或容易混淆處可以使用表格。內容要像學生共筆，避免反覆寫『老師說』。",
    "11. kind 只能是 standard、teacher_note、exam_focus、mnemonic、warning。",
    "",
    "老師強調與粗體規則：",
    "12. 只有字幕明確出現重要、會考、必考、考題、考點、出題、考過、重點、一定要、要記、記得、記住、背熟、背好、要背、星星、星號、畫線、注意、小心、熟悉、常考、容易錯、混淆、務必、必須或要會等訊號，才可建立 teacherEmphasis。證據範圍可以涵蓋同一 teacher block 內相鄰 cue，但必須同時包含明確強調訊號與被強調的實際內容。",
    "13. teacherEmphasis 要保存老師原本的強調程度，例如 phrase='打一顆星' 或 phrase='打三萬顆星'，並附 evidenceStartCue/evidenceEndCue。不可把模型自己覺得重要的內容冒充老師強調。",
    "14. 需要粗體的片語放進 textRuns，所有 textRuns 串接後必須完全等於 text；只有 strong=true 的片語會顯示粗體。",
    "",
    "不確定內容與影片中斷規則：",
    "15. unresolved.json 每項至少包含 captionId、issue、reason、sourceText、needs；needs 只能是 audio、board 或 other。sourceText 必須是該 cue 的原始／校訂文字，不能只寫『聽不清楚』。來源檔正常結束不可列成 continuation。",
    "16. 聽不清楚的術語：不要把近音字改成正式解剖名詞；caption 先保留可辨識的原文，issue 寫明原音近似，candidateTerms 可列可能候選但必須標示為候選，不得放進正式講義當成確定答案。",
    ...buildSourceBoundaryPromptLines().map((line, index) => `${17 + index}. ${line}`),
    "20. 任何一個 unresolved 都會阻擋匯入；只有完全確認後才能讓 unresolved.json 成為空陣列。",
    "",
    "輸出檔案格式：",
    "response-manifest.json：{schemaVersion:'1.0.0', workflowVersion, promptVersion, jobId, videoId, sourceFingerprint, status:'candidate'}。",
    "chapters.candidate.json：沿用既有章節草稿格式，包含 schemaVersion、videoId、sourceFingerprint、chapters。",
    "captions.reviewed.json：{schemaVersion:'1.0.0', videoId, sourceFingerprint, captions:[完整 cue 陣列], compressionReviews:[...]}。compressionReviews 每項格式為 {captionId, disposition:'verified_cleanup', reason, baseTextSha256, reviewedTextSha256}；reason 只能是 filler_only、repetition_only、false_start_only、meaning_preserved_after_deduplication。兩個 SHA-256 必須分別由該 cue 的 baseText 與最終 reviewedText UTF-8 原文計算；沒有縮短警報的 cue 不可加入。",
    "lecture-notes.candidate.json：{schemaVersion:'1.0.0', videoId, reviewStatus:'lecture_notes_candidate', blocks:[...], unresolved:[]}。captionFingerprint 由本機匯入器計算，不要自行填寫。",
    "unresolved.json：陣列；每項至少包含 captionId、issue、reason、sourceText、needs。若沒有疑點才是空陣列。",
    "",
    "交付前自我檢查：確認五個檔案存在；所有字幕 cue 的 ID、時間、順序、數量與 base 完全一致；所有章節時間是整數且排序、不重疊、代表畫面在章節內；講義證據完整覆蓋；所有不確定內容都有 unresolved。不要輸出 Markdown、前言或結語。",
    `結果 ZIP 請命名為：${job.resultFilename ?? `${job.jobId}.result.zip`}`
  ].join("\n");
}

function normalizeBaseChapters(value, transcript) {
  if (value?.chapters && Array.isArray(value.chapters)) return value.chapters;
  if (Array.isArray(value)) return value;
  return [];
}

export async function loadWorkflowInput({ repoRoot, videoId }) {
  const paths = getWorkflowPaths(repoRoot, videoId);
  if (!(await exists(paths.transcript))) {
    throw new Error(`找不到逐字稿：${displayPath(repoRoot, paths.transcript)}，請先完成本機轉錄。`);
  }
  const transcript = await readJson(paths.transcript, "私人逐字稿");
  if (transcript.videoId !== videoId) throw new Error("逐字稿 videoId 不一致。");
  if (transcript.rightsStatus !== "private_only") throw new Error("逐字稿必須維持 private_only。");
  if (!sha256Pattern.test(transcript.sourceFingerprint ?? "")) throw new Error("逐字稿缺少有效 sourceFingerprint。");

  let preview = null;
  const previewPath = resolve(repoRoot, "data/laozhao/previewContent.generated.json");
  if (await exists(previewPath)) {
    const manifest = await readJson(previewPath, "既有 Preview manifest");
    preview = manifest.videos?.find((item) => item?.videoId === videoId) ?? null;
  }
  const existingChapters = await (async () => {
    for (const pathname of [paths.chaptersPreview, paths.chapters]) {
      if (await exists(pathname)) return (await readJson(pathname, "已驗證章節")).chapters ?? [];
    }
    return baseChaptersFromPreview(preview, transcript);
  })();
  const baseCaptions = preview?.captions?.length ? preview.captions : buildCaptions(transcript);
  return { paths, transcript, baseCaptions, baseChapters: normalizeBaseChapters(existingChapters, transcript), preview };
}

export async function createChatInputZip({ repoRoot, videoId }) {
  const input = await loadWorkflowInput({ repoRoot, videoId });
  const baseCaptionFingerprint = captionFingerprint(input.baseCaptions);
  const jobId = `${videoId}-${input.transcript.sourceFingerprint.slice(0, 12)}-${PROMPT_VERSION}`;
  const packageStem = await resolveReadablePackageStem(repoRoot, input.transcript, videoId);
  const inputFilename = `${packageStem}_工作包.zip`;
  const resultFilename = `${packageStem}_回傳包.zip`;
  const jobRoot = resolve(input.paths.jobsRoot, jobId);
  const inputRoot = resolve(jobRoot, "input");
  assertInside(input.paths.jobsRoot, jobRoot, "Chat 工作");
  await mkdir(inputRoot, { recursive: true });
  const job = {
    schemaVersion: WORKFLOW_SCHEMA_VERSION,
    workflowVersion: WORKFLOW_VERSION,
    promptVersion: PROMPT_VERSION,
    jobId,
    packageStem,
    inputFilename,
    resultFilename,
    videoId,
    sourceFingerprint: input.transcript.sourceFingerprint,
    baseCaptionFingerprint,
    createdAt: new Date().toISOString(),
    expectedResponseFiles
  };
  await writeAtomic(resolve(jobRoot, "job-manifest.json"), job);
  await writeAtomic(resolve(inputRoot, "transcript.private.json"), input.transcript);
  await writeAtomic(resolve(inputRoot, "captions.base.json"), {
    schemaVersion: WORKFLOW_SCHEMA_VERSION,
    videoId,
    sourceFingerprint: input.transcript.sourceFingerprint,
    captions: input.baseCaptions
  });
  await writeAtomic(resolve(inputRoot, "chapters.base.json"), {
    schemaVersion: WORKFLOW_SCHEMA_VERSION,
    videoId,
    sourceFingerprint: input.transcript.sourceFingerprint,
    chapters: input.baseChapters
  });
  await writeAtomic(resolve(inputRoot, "taiwan-terminology.json"), TAIWAN_MEDICAL_TERMINOLOGY_GUIDE);
  await writeAtomic(resolve(jobRoot, "CHATGPT_PROMPT.md"), buildPrompt({
    job,
    transcript: input.transcript,
    baseCaptions: input.baseCaptions,
    baseChapters: input.baseChapters
  }));
  const zipPath = resolve(input.paths.jobsRoot, inputFilename);
  await rm(zipPath, { force: true });
  await execFileAsync("zip", ["-q", "-r", zipPath, "input", "job-manifest.json", "CHATGPT_PROMPT.md"], { cwd: jobRoot });
  const state = await readState(input.paths);
  await writeState(input.paths, {
    ...state,
    videoId,
    sourceFingerprint: input.transcript.sourceFingerprint,
    updatedAt: new Date().toISOString(),
    state: "waiting_for_chat",
    activeJobId: jobId,
    artifacts: { ...(state.artifacts ?? {}), chatInputZip: displayPath(repoRoot, zipPath) }
  });
  return { ...input, job, jobRoot, zipPath };
}

async function readZipEntries(zipPath) {
  const { stdout } = await execFileAsync("unzip", ["-Z1", zipPath]);
  const entries = stdout.split(/\r?\n/).map((entry) => entry.trim()).filter(Boolean);
  for (const entry of entries) {
    if (entry.startsWith("/") || entry.includes("\\") || entry.split("/").includes("..")) {
      throw new Error(`結果 ZIP 含有不安全路徑：${entry}`);
    }
  }
  return entries;
}

async function extractResponseZip(zipPath) {
  const entries = await readZipEntries(zipPath);
  const root = await mkdtemp(join(tmpdir(), "laozhao-response-"));
  await execFileAsync("unzip", ["-q", zipPath, "-d", root]);
  const files = new Map();
  for (const expected of expectedResponseFiles) {
    const matches = entries.filter((entry) => basename(entry) === expected && !entry.endsWith("/"));
    if (matches.length !== 1) throw new Error(`結果 ZIP 缺少唯一的 ${expected}。`);
    const pathname = resolve(root, matches[0]);
    assertInside(root, pathname, "結果 ZIP 檔案");
    const info = await stat(pathname);
    if (!info.isFile()) throw new Error(`${expected} 不是一般檔案。`);
    files.set(expected, pathname);
  }
  return { root, files };
}

export function validateAndNormalizeReviewedCaptions(raw, baseCaptions, videoId, sourceFingerprint) {
  const errors = [];
  const normalizations = [];
  const taiwanIssues = [];
  const compressionIssues = [];
  const captions = Array.isArray(raw) ? raw : raw?.captions;
  if (!Array.isArray(captions) || captions.length !== baseCaptions.length) {
    errors.push(`校訂字幕必須完整保留 ${baseCaptions.length} 段 cue。`);
    return {
      valid: false,
      structureValid: false,
      captions: [],
      errors,
      normalizations,
      taiwanIssues,
      compressionIssues,
      acknowledgedCompressionIssues: []
    };
  }
  if (raw?.videoId && raw.videoId !== videoId) errors.push("校訂字幕 videoId 不一致。");
  if (raw?.sourceFingerprint && raw.sourceFingerprint !== sourceFingerprint) errors.push("校訂字幕來源指紋不一致。");
  const normalizedCaptions = captions.map((cue, index) => {
    const base = baseCaptions[index];
    if (!isRecord(cue) || cue.id !== base.id) {
      errors.push(`第 ${index + 1} 段字幕 ID 或順序被修改。`);
      return base;
    }
    for (const key of ["startSec", "endSec", "sourceSegmentStart", "sourceSegmentEnd", "sourceSegmentCount"]) {
      if (Number(cue[key]) !== Number(base[key])) errors.push(`${cue.id} 的 ${key} 不可修改。`);
    }
    if (typeof cue.text !== "string" || !cue.text.trim() || cue.text.length > 240) {
      errors.push(`${cue.id} 字幕文字格式無效。`);
      return base;
    }
    const safeNormalization = normalizeTaiwanMedicalText(cue.text);
    if (safeNormalization.changes.length > 0) {
      normalizations.push({ captionId: cue.id, changes: safeNormalization.changes });
    }
    const normalized = { ...base, text: safeNormalization.text };
    taiwanIssues.push(...findNonTaiwanCaptions([normalized]));
    const baseComparableLength = base.text.normalize("NFKC").replace(/[\s\p{P}\p{S}]+/gu, "").length;
    const reviewedComparableLength = normalized.text.normalize("NFKC").replace(/[\s\p{P}\p{S}]+/gu, "").length;
    const retainedRatio = baseComparableLength === 0 ? 1 : reviewedComparableLength / baseComparableLength;
    if (baseComparableLength >= 24 && retainedRatio < 0.55) {
      compressionIssues.push({
        captionId: cue.id,
        baseText: base.text,
        reviewedText: normalized.text,
        retainedRatio: Number(retainedRatio.toFixed(3))
      });
    }
    return normalized;
  });
  const structureValid = errors.length === 0;
  if (taiwanIssues.length > 0) {
    errors.push(`字幕仍有 ${taiwanIssues.length} 段需要人工確認臺灣用字。`);
  }
  const compressionReview = validateCompressionReviews(raw, compressionIssues);
  if (compressionReview.errors.length > 0) {
    errors.push(...compressionReview.errors);
  }
  if (compressionReview.unacknowledged.length > 0) {
    errors.push(`有 ${compressionReview.unacknowledged.length} 段字幕縮短超過 45%，需要逐段確認沒有遺漏老師原話。`);
  }
  return {
    valid: errors.length === 0,
    structureValid,
    captions: normalizedCaptions,
    errors,
    normalizations,
    taiwanIssues,
    compressionIssues: compressionReview.unacknowledged,
    acknowledgedCompressionIssues: compressionReview.acknowledged,
    ignoredStaleCompressionReviews: compressionReview.ignoredStale
  };
}

export function normalizeChapterTimesForImport(raw) {
  const draft = isRecord(raw) ? structuredClone(raw) : raw;
  const changes = [];
  if (!isRecord(draft) || !Array.isArray(draft.chapters)) return { draft, changes };
  const chapters = draft.chapters;
  for (let index = 0; index < chapters.length; index += 1) {
    const chapter = chapters[index];
    if (!isRecord(chapter)) continue;
    const previous = chapters[index - 1];
    if (
      isRecord(previous) &&
      Number.isFinite(Number(previous.endSec)) &&
      Number.isFinite(Number(chapter.startSec)) &&
      Math.abs(Number(previous.endSec) - Number(chapter.startSec)) <= 0.001
    ) {
      const boundary = Math.round((Number(previous.endSec) + Number(chapter.startSec)) / 2);
      for (const [target, key] of [[previous, "endSec"], [chapter, "startSec"]]) {
        if (target[key] !== boundary) changes.push({ chapterIndex: index, field: key, from: target[key], to: boundary, sharedBoundary: true });
        target[key] = boundary;
      }
    } else {
      for (const key of ["startSec", "endSec"]) {
        const value = Number(chapter[key]);
        if (!Number.isFinite(value)) continue;
        const normalized = Math.round(value);
        if (chapter[key] !== normalized) changes.push({ chapterIndex: index + 1, field: key, from: chapter[key], to: normalized });
        chapter[key] = normalized;
      }
    }
    const target = chapter.representativeFrameTargetSec;
    if (target !== null && target !== undefined && Number.isFinite(Number(target))) {
      const normalizedTarget = Math.round(Number(target));
      const nextTarget = normalizedTarget >= Number(chapter.startSec) && normalizedTarget < Number(chapter.endSec)
        ? normalizedTarget
        : null;
      if (target !== nextTarget) changes.push({ chapterIndex: index + 1, field: "representativeFrameTargetSec", from: target, to: nextTarget });
      chapter.representativeFrameTargetSec = nextTarget;
    }
  }
  return { draft, changes };
}

export function buildPrivateChapterPackage(transcript, chapters) {
  return {
    schemaVersion: WORKFLOW_SCHEMA_VERSION,
    pipelineVersion: "laozhao-private-review-v1",
    generatedAt: new Date().toISOString(),
    videoId: transcript.videoId,
    videoTitle: transcript.videoTitle,
    durationSec: transcript.durationSec,
    sourceFingerprint: transcript.sourceFingerprint,
    sourceMediaSha256: transcript.sourceMediaSha256,
    sourceFilename: transcript.sourceFilename,
    sourceSizeBytes: transcript.sourceSizeBytes,
    rightsStatus: "private_only",
    reviewStatus: "draft",
    requiresHumanReview: true,
    chapters
  };
}

function collectText(value, output = []) {
  if (typeof value === "string") output.push(value);
  else if (Array.isArray(value)) value.forEach((item) => collectText(item, output));
  else if (isRecord(value)) Object.entries(value).forEach(([key, item]) => {
    if (!["evidenceStartCue", "evidenceEndCue", "sourceCaptionStart", "sourceCaptionEnd", "textRuns", "teacherEmphasis"].includes(key)) {
      collectText(item, output);
    }
  });
  return output;
}

function normalizeAuditComparable(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}%μ]+/gu, "");
}

function signalTokens(text) {
  const numberWithUnit = text.match(/\b\d+(?:\.\d+)?\s*(?:%|％|mm|cm|kg|mg|mL|ml|μm|對|個|塊|條|根|層|頁|章|節|項|行|月|年|歲|肋|椎|骨|肌|神經|動脈|靜脈|公分|毫米|毫升|公斤|克)/g) ?? [];
  const anatomicalIds = text.match(/\b(?:[A-Za-z]\d+(?:\s*[–-]\s*[A-Za-z]?\d+)?|[IVX]{2,})\b/g) ?? [];
  const english = (text.match(/\b[A-Za-z][A-Za-z0-9-]{2,}\b/g) ?? [])
    .filter((token) => !auditEnglishStopwords.has(token.toLocaleLowerCase("en-US")));
  const unique = new Map();
  for (const signal of [...numberWithUnit, ...anatomicalIds, ...english]) {
    const normalized = normalizeAuditComparable(signal);
    if (normalized && !unique.has(normalized)) unique.set(normalized, signal.trim());
  }
  return [...unique.values()].slice(0, 500);
}

function anatomicalRangeCoversSignal(signal, noteText) {
  const match = /^([A-Za-z])(\d+)$/.exec(signal.trim());
  if (!match) return false;
  const [, prefix, rawNumber] = match;
  const number = Number(rawNumber);
  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rangePattern = new RegExp(
    `\\b${escapedPrefix}\\s*(\\d+)\\s*(?:[–—~～-]|到|至|延伸至)\\s*(?:${escapedPrefix}\\s*)?(\\d+)\\b`,
    "giu"
  );
  return [...noteText.matchAll(rangePattern)].some((range) => {
    const start = Number(range[1]);
    const end = Number(range[2]);
    return number >= Math.min(start, end) && number <= Math.max(start, end);
  });
}

function anatomicalSourceRangeCovered(signal, comparableNotes) {
  const match = /^([A-Za-z])(\d+)\s*[–—~～-]\s*(?:\1)?(\d+)$/.exec(signal.trim());
  if (!match) return false;
  const [, prefix, rawStart, rawEnd] = match;
  const startToken = normalizeAuditComparable(`${prefix}${rawStart}`);
  const endToken = normalizeAuditComparable(`${prefix}${rawEnd}`);
  return comparableNotes.includes(startToken) && comparableNotes.includes(endToken);
}

function romanToInteger(value) {
  const values = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  let total = 0;
  let previous = 0;
  for (const character of value.toUpperCase().split("").reverse()) {
    const current = values[character] ?? 0;
    total += current < previous ? -current : current;
    previous = Math.max(previous, current);
  }
  return total;
}

function romanRangeCoversSignal(signal, noteText) {
  if (!/^[IVXLCDM]+$/i.test(signal.trim())) return false;
  const target = romanToInteger(signal);
  const rangePattern = /\b([IVXLCDM]+)\s*[–—~～-]\s*([IVXLCDM]+)\b/giu;
  return [...noteText.matchAll(rangePattern)].some((range) => {
    const start = romanToInteger(range[1]);
    const end = romanToInteger(range[2]);
    return target >= Math.min(start, end) && target <= Math.max(start, end);
  });
}

function isWeakAuditSignal(signal) {
  const normalized = normalizeAuditComparable(signal);
  return auditWeakCountUnitPattern.test(normalized) || auditWeakDiagramLabelPattern.test(normalized);
}

function auditSignalCovered(signal, noteText, comparableNotes) {
  const normalized = normalizeAuditComparable(signal);
  if (!normalized) return true;
  if (comparableNotes.includes(normalized)) return true;
  if (anatomicalRangeCoversSignal(signal, noteText)) return true;
  if (anatomicalSourceRangeCovered(signal, comparableNotes)) return true;
  if (romanRangeCoversSignal(signal, noteText)) return true;
  const aliases = auditSignalAliases.get(normalized) ?? [];
  return aliases.some((alias) => comparableNotes.includes(normalizeAuditComparable(alias)));
}

export function auditWorkflowContent({ captions, lectureNotes }) {
  const sourceText = captions.map((caption) => caption.text).join(" ");
  const noteText = collectText(lectureNotes.blocks).join(" ");
  const sourceSignals = signalTokens(sourceText);
  const comparableNotes = normalizeAuditComparable(noteText);
  const uncoveredSignals = sourceSignals.filter((signal) => !auditSignalCovered(signal, noteText, comparableNotes));
  const weakMissingSignals = uncoveredSignals.filter(isWeakAuditSignal);
  const missingSignals = uncoveredSignals.filter((signal) => !isWeakAuditSignal(signal));
  const sourceDirectionCount = [...sourceText.matchAll(directionPattern)].length;
  const noteDirectionCount = [...noteText.matchAll(directionPattern)].length;
  const directionCoverageRatio = sourceDirectionCount === 0
    ? 1
    : Math.min(1, noteDirectionCount / sourceDirectionCount);
  const directionCoverageLow = directionCoverageRatio < minimumDirectionCoverageRatio;
  const emphasisCaptions = captions.filter((caption) => hasExplicitTeacherEmphasis(caption.text));
  return {
    schemaVersion: WORKFLOW_SCHEMA_VERSION,
    status: missingSignals.length > 0 || directionCoverageLow ? "needs_review" : "passed",
    missingSignals,
    weakMissingSignals,
    sourceDirectionCount,
    noteDirectionCount,
    directionCoverageRatio,
    emphasisCueIds: emphasisCaptions.map((caption) => caption.id),
    warnings: [
      ...(missingSignals.length > 0 ? [`講義未明確包含 ${missingSignals.length} 個來源訊號。`] : []),
      ...(weakMissingSignals.length > 0 ? [`另有 ${weakMissingSignals.length} 個頁碼或一般計數訊號未逐字重述，已保留供抽查。`] : []),
      ...(directionCoverageLow ? ["方向或變化詞保留比例低於 50%，請人工抽查。"] : [])
    ]
  };
}

export function collectLostTeacherEmphasisSignals(baseCaptions, reviewedCaptions) {
  const reviewedById = new Map(reviewedCaptions.map((caption) => [caption.id, caption]));
  return baseCaptions.flatMap((baseCaption) => {
    const reviewedCaption = reviewedById.get(baseCaption.id);
    if (
      !reviewedCaption
      || !hasExplicitTeacherEmphasis(baseCaption.text)
      || hasExplicitTeacherEmphasis(reviewedCaption.text)
    ) {
      return [];
    }
    return [{
      captionId: baseCaption.id,
      baseText: baseCaption.text,
      reviewedText: reviewedCaption.text
    }];
  });
}

export function collectTeacherEmphasisIssues(raw, captions) {
  if (!isRecord(raw) || !Array.isArray(raw.blocks)) return [];
  const issues = [];
  const captionIndex = new Map(captions.map((caption, index) => [caption.id, index]));

  const inspectItems = ({
    items,
    ownerLabel,
    block,
    blockIndex,
    blockStartIndex,
    blockEndIndex
  }) => {
    if (!Array.isArray(items)) return;
    for (const [itemIndex, item] of items.entries()) {
      if (!isRecord(item)) continue;
      const label = `${ownerLabel}第 ${itemIndex + 1} 個老師強調`;
      const startIndex = captionIndex.get(item.evidenceStartCue);
      const endIndex = captionIndex.get(item.evidenceEndCue);
      let reason = null;
      let message = null;
      let sourceText = "";

      if (block.provenance !== "teacher") {
        reason = "supplement_emphasis";
        message = `${label}位於補充內容，不能標示為老師強調。`;
      } else if (item.evidenceStartCue === undefined || item.evidenceEndCue === undefined) {
        reason = "missing_evidence";
        message = `${label}缺少字幕證據。`;
      } else if (
        startIndex === undefined
        || endIndex === undefined
        || endIndex < startIndex
        || startIndex < blockStartIndex
        || endIndex > blockEndIndex
      ) {
        reason = "evidence_outside_block";
        message = `${label}字幕證據超出所屬講義區塊。`;
      } else {
        sourceText = captions
          .slice(startIndex, endIndex + 1)
          .map((caption) => caption.text)
          .join(" ");
        if (!hasExplicitTeacherEmphasis(sourceText)) {
          reason = "no_explicit_signal";
          message = `${label}沒有字幕中的明確強調訊號（目前證據 ${item.evidenceStartCue}～${item.evidenceEndCue}）。`;
        }
      }

      if (!reason) continue;
      const anchorIndex = startIndex ?? blockStartIndex;
      const nearbyExplicitCues = block.provenance === "teacher"
        ? captions
          .slice(blockStartIndex, blockEndIndex + 1)
          .map((caption, offset) => ({
            id: caption.id,
            text: caption.text,
            distance: Math.abs(blockStartIndex + offset - anchorIndex)
          }))
          .filter((caption) => hasExplicitTeacherEmphasis(caption.text))
          .sort((left, right) => left.distance - right.distance)
          .slice(0, 4)
          .map(({ id, text }) => ({ id, text }))
        : [];
      issues.push({
        label,
        blockIndex: blockIndex + 1,
        blockId: typeof block.id === "string" ? block.id : null,
        phrase: typeof item.phrase === "string" ? item.phrase : null,
        evidenceStartCue: item.evidenceStartCue ?? null,
        evidenceEndCue: item.evidenceEndCue ?? null,
        sourceText,
        reason,
        message,
        nearbyExplicitCues,
        suggestedAction: nearbyExplicitCues.length > 0 && reason === "no_explicit_signal"
          ? "確認語意相符後，只延伸 evidence 範圍以同時涵蓋明確訊號與被強調內容；若不相符則刪除這個 teacherEmphasis。"
          : "刪除這個 teacherEmphasis；不得改寫字幕或虛構老師語氣。"
      });
    }
  };

  const inspectPoints = (points, ownerLabel, context) => {
    if (!Array.isArray(points)) return;
    for (const [pointIndex, point] of points.entries()) {
      if (!isRecord(point)) continue;
      const pointLabel = `${ownerLabel}第 ${pointIndex + 1} 點`;
      inspectItems({ items: point.teacherEmphasis, ownerLabel: pointLabel, ...context });
      inspectPoints(point.children, `${pointLabel}下層項目 `, context);
    }
  };

  for (const [blockIndex, block] of raw.blocks.entries()) {
    if (!isRecord(block)) continue;
    const ownerLabel = `第 ${blockIndex + 1} 個講義區塊`;
    const blockStartIndex = captionIndex.get(block.sourceCaptionStart) ?? 0;
    const blockEndIndex = captionIndex.get(block.sourceCaptionEnd) ?? Math.max(0, captions.length - 1);
    const context = { block, blockIndex, blockStartIndex, blockEndIndex };
    inspectItems({ items: block.teacherEmphasis, ownerLabel, ...context });
    inspectPoints(block.points, ownerLabel, context);
  }
  return issues;
}

function chapterIdForCaption(chapters, caption) {
  const midpoint = (caption.startSec + caption.endSec) / 2;
  const chapter = chapters.find((candidate, index) => (
    midpoint >= candidate.startSec
      && (midpoint < candidate.endSec || (index === chapters.length - 1 && midpoint <= candidate.endSec))
  ));
  return chapter ? (chapter.id ?? chapter.stableId) : null;
}

function captionRangeStaysWithinChapter(chapters, captions, startIndex, endIndex) {
  const chapterId = chapterIdForCaption(chapters, captions[startIndex]);
  if (!chapterId) return false;
  for (let index = startIndex + 1; index <= endIndex; index += 1) {
    if (chapterIdForCaption(chapters, captions[index]) !== chapterId) return false;
  }
  return true;
}

export function collectLectureNotesPreflightErrors(raw, captions, chapters = []) {
  if (!isRecord(raw) || !Array.isArray(raw.blocks)) return [];
  const errors = collectTeacherEmphasisIssues(raw, captions).map((issue) => issue.message);
  const captionIndex = new Map(captions.map((caption, index) => [caption.id, index]));
  const blockIds = new Set();
  let expectedTeacherStart = 0;

  for (const [index, block] of raw.blocks.entries()) {
    const label = `第 ${index + 1} 個講義區塊`;
    if (!isRecord(block)) {
      errors.push(`${label}格式無效。`);
      continue;
    }
    if (typeof block.id === "string") {
      if (blockIds.has(block.id)) errors.push(`列點講義區塊 id 重複：${block.id}`);
      blockIds.add(block.id);
    }
    if (block.type === "bullets" && Array.isArray(block.points)) {
      const state = { count: 0, nodeLimitReported: false };
      const inspectPoints = (points, ownerLabel, depth) => {
        if (!Array.isArray(points)) return;
        for (const [pointIndex, point] of points.entries()) {
          const pointLabel = `${ownerLabel}第 ${pointIndex + 1} 點`;
          if (!isRecord(point)) {
            errors.push(`${pointLabel}格式無效。`);
            continue;
          }
          state.count += 1;
          if (state.count > lecturePointMaxNodes && !state.nodeLimitReported) {
            errors.push(`${label}的條列節點超過 ${lecturePointMaxNodes} 個。`);
            state.nodeLimitReported = true;
          }
          const children = point.children ?? [];
          if (!Array.isArray(children) || children.length > lecturePointMaxChildren) {
            errors.push(`${pointLabel}的下層項目格式無效。`);
            continue;
          }
          if (depth >= lecturePointMaxDepth && children.length > 0) {
            errors.push(`${pointLabel}超過四層共筆結構。`);
            continue;
          }
          inspectPoints(children, `${pointLabel}下層項目 `, depth + 1);
        }
      };
      inspectPoints(block.points, label, 0);
    }
    if (block.provenance !== "teacher") continue;
    const startIndex = captionIndex.get(block.sourceCaptionStart);
    const endIndex = captionIndex.get(block.sourceCaptionEnd);
    if (startIndex === undefined || endIndex === undefined || endIndex < startIndex) {
      errors.push(`${label}字幕範圍無效。`);
      continue;
    }
    if (chapters.length > 0 && !captionRangeStaysWithinChapter(chapters, captions, startIndex, endIndex)) {
      errors.push(`${label}跨越章節，請在章節邊界拆成兩個連續區塊。`);
    }
    if (startIndex !== expectedTeacherStart) {
      const expectedId = captions[expectedTeacherStart]?.id ?? "影片結尾";
      errors.push(`${label}前有字幕缺口或重複，應從 ${expectedId} 開始。`);
    }
    const count = endIndex - startIndex + 1;
    if (count > 14) {
      errors.push(`${label}涵蓋 ${count} 段字幕，最多只能涵蓋 14 段；請拆小以便逐段核對。`);
    }
    expectedTeacherStart = endIndex + 1;
  }
  if (expectedTeacherStart !== captions.length) {
    errors.push(`列點講義未完整涵蓋 ${captions[expectedTeacherStart]?.id ?? "最後一段"} 之後的字幕。`);
  }
  return [...new Set(errors)];
}

function validateResponseManifest(raw, job) {
  if (!isRecord(raw)) throw new Error("response-manifest.json 格式無效。");
  for (const [key, expected] of [["schemaVersion", WORKFLOW_SCHEMA_VERSION], ["workflowVersion", job.workflowVersion], ["promptVersion", job.promptVersion], ["jobId", job.jobId], ["videoId", job.videoId], ["sourceFingerprint", job.sourceFingerprint]]) {
    if (raw[key] !== expected) throw new Error(`回傳識別欄位 ${key} 不一致。`);
  }
  if (raw.status !== "candidate") throw new Error("回傳結果 status 必須是 candidate。 ");
}

async function loadJob(repoRoot, videoId, jobId) {
  const input = await loadWorkflowInput({ repoRoot, videoId });
  const jobRoot = resolve(input.paths.jobsRoot, jobId);
  const job = await readJson(resolve(jobRoot, "job-manifest.json"), "Chat 工作 manifest");
  if (job.videoId !== videoId || job.sourceFingerprint !== input.transcript.sourceFingerprint) throw new Error("工作版本已過期，請重新建立工作包。");
  return { ...input, job, jobRoot };
}

export async function readState(paths) {
  if (!(await exists(paths.state))) {
    return { schemaVersion: WORKFLOW_SCHEMA_VERSION, workflowVersion: WORKFLOW_VERSION, state: "pending", artifacts: {} };
  }
  return readJson(paths.state, "流程狀態");
}

export async function writeState(paths, state) {
  await writeAtomic(paths.state, {
    ...state,
    schemaVersion: WORKFLOW_SCHEMA_VERSION,
    workflowVersion: WORKFLOW_VERSION
  });
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

async function nextNumberedDirectory(root, prefix) {
  await mkdir(root, { recursive: true });
  const entries = await readdir(root, { withFileTypes: true });
  const numbers = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name.match(new RegExp(`^${prefix}-r(\\d{2})$`)))
    .filter(Boolean)
    .map((match) => Number(match[1]));
  return Math.max(0, ...numbers) + 1;
}

function roundToken(round) {
  return `r${String(round).padStart(2, "0")}`;
}

export function buildRepairFileNames(packageStem, round) {
  const token = roundToken(round);
  return {
    token,
    input: `${packageStem}_修補_${token}_工作包.zip`,
    result: `${packageStem}_修補_${token}_回傳包.zip`
  };
}

export function buildRepairFocus(report) {
  const errors = Array.isArray(report?.errors) ? report.errors.filter(Boolean) : [];
  const missingSignals = Array.isArray(report?.audit?.missingSignals)
    ? report.audit.missingSignals.filter(Boolean)
    : [];
  const weakMissingSignals = Array.isArray(report?.audit?.weakMissingSignals)
    ? report.audit.weakMissingSignals.filter(Boolean)
    : [];
  const taiwanIssues = Array.isArray(report?.taiwanIssues) ? report.taiwanIssues : [];
  const unresolved = Array.isArray(report?.unresolved) ? report.unresolved : [];
  const teacherEmphasisIssues = Array.isArray(report?.teacherEmphasisIssues)
    ? report.teacherEmphasisIssues
    : [];
  const compressionIssues = Array.isArray(report?.compressionIssues)
    ? report.compressionIssues
    : [];
  const lostTeacherEmphasisSignals = Array.isArray(report?.lostTeacherEmphasisSignals)
    ? report.lostTeacherEmphasisSignals
    : [];
  return {
    errors,
    missingSignals,
    weakMissingSignals,
    taiwanIssues,
    unresolved,
    teacherEmphasisIssues,
    compressionIssues,
    lostTeacherEmphasisSignals,
    actionCount: errors.length
      + missingSignals.length
      + taiwanIssues.length
      + unresolved.length
      + compressionIssues.length
      + lostTeacherEmphasisSignals.length
  };
}

export function buildUnresolvedEvidencePlan({ unresolved, captions, durationSec }) {
  if (!Array.isArray(unresolved) || !Array.isArray(captions)) return [];
  const captionIndex = new Map(captions.map((caption, index) => [caption.id, index]));
  const safeDuration = Number.isFinite(durationSec) ? Math.max(0, durationSec) : Infinity;
  return unresolved.flatMap((item) => {
    if (!isRecord(item) || typeof item.captionId !== "string") return [];
    const index = captionIndex.get(item.captionId);
    if (index === undefined) return [];
    const caption = captions[index];
    if (!caption || !Number.isFinite(caption.startSec) || !Number.isFinite(caption.endSec)) return [];
    const startSec = Math.max(0, caption.startSec - 4);
    const endSec = Math.min(safeDuration, caption.endSec + 4);
    if (!(endSec > startSec)) return [];
    return [{
      captionId: item.captionId,
      needs: typeof item.needs === "string" ? item.needs : "audio",
      startSec,
      endSec,
      frameSec: Math.min(endSec, Math.max(startSec, (caption.startSec + caption.endSec) / 2)),
      context: captions.slice(Math.max(0, index - 2), Math.min(captions.length, index + 3)).map((entry) => ({
        id: entry.id,
        startSec: entry.startSec,
        endSec: entry.endSec,
        text: entry.text
      }))
    }];
  });
}

async function writeUnresolvedEvidence({ repairRoot, sourceVideo, plans }) {
  const evidenceRoot = resolve(repairRoot, "input/evidence");
  await mkdir(resolve(evidenceRoot, "audio"), { recursive: true });
  await mkdir(resolve(evidenceRoot, "frames"), { recursive: true });
  const results = [];
  for (const plan of plans) {
    const audioRelative = `evidence/audio/${plan.captionId}.m4a`;
    const frameRelative = `evidence/frames/${plan.captionId}.jpg`;
    const audioPath = resolve(repairRoot, "input", audioRelative);
    const framePath = resolve(repairRoot, "input", frameRelative);
    const duration = plan.endSec - plan.startSec;
    const result = { ...plan, audio: audioRelative, frame: frameRelative };
    try {
      await execFileAsync("ffmpeg", [
        "-hide_banner", "-loglevel", "error", "-y",
        "-ss", String(plan.startSec), "-i", sourceVideo,
        "-t", String(duration), "-vn", "-ac", "1", "-ar", "16000",
        "-c:a", "aac", "-b:a", "64k", audioPath
      ]);
    } catch (error) {
      result.audio = null;
      result.audioError = errorMessage(error);
    }
    try {
      await execFileAsync("ffmpeg", [
        "-hide_banner", "-loglevel", "error", "-y",
        "-ss", String(plan.frameSec), "-i", sourceVideo,
        "-frames:v", "1", "-vf", "scale=min(1280\\,iw):-2", "-q:v", "3", framePath
      ]);
    } catch (error) {
      result.frame = null;
      result.frameError = errorMessage(error);
    }
    results.push(result);
  }
  await writeAtomic(resolve(repairRoot, "input/unresolved-evidence.json"), {
    schemaVersion: WORKFLOW_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    items: results
  });
  return results;
}

function repairFocusPromptLines(focus) {
  const lines = ["本輪精準修補範圍："];
  const lostTeacherEmphasisSignals = focus.lostTeacherEmphasisSignals ?? [];
  const lostSignalsWithinRange = (startCue, endCue) => {
    if (typeof startCue !== "string" || typeof endCue !== "string") return [];
    return lostTeacherEmphasisSignals.filter(({ captionId }) => (
      typeof captionId === "string" && captionId >= startCue && captionId <= endCue
    ));
  };
  if (focus.errors.length > 0) {
    lines.push(...focus.errors.map((error) => `- 驗證錯誤：${error}`));
  }
  if (focus.teacherEmphasisIssues.length > 0) {
    lines.push("- 老師強調逐項證據（只處理下列項目）：");
    for (const issue of focus.teacherEmphasisIssues) {
      const nearby = issue.nearbyExplicitCues?.length > 0
        ? issue.nearbyExplicitCues.map((cue) => `${cue.id}「${cue.text}」`).join("；")
        : "同區塊沒有找到明確強調字幕";
      const lostSignals = lostSignalsWithinRange(issue.evidenceStartCue, issue.evidenceEndCue);
      const action = lostSignals.length > 0
        ? `基底字幕 ${lostSignals.map(({ captionId, baseText }) => `${captionId}「${baseText}」`).join("；")} 有明確強調訊號；先核對後把老師原話的最小必要字樣補回校訂字幕，保留這個 teacherEmphasis，不得因校訂版先刪了訊號就反過來刪除標記。`
        : issue.suggestedAction;
      lines.push(`  - ${issue.label}，phrase=${JSON.stringify(issue.phrase)}，目前證據 ${issue.evidenceStartCue ?? "缺少"}～${issue.evidenceEndCue ?? "缺少"}；可核對：${nearby}。${action}`);
    }
  }
  if (focus.missingSignals.length > 0) {
    lines.push(`- 講義確定缺少的來源訊號：${focus.missingSignals.join("、")}。請在 captions.reviewed.json 搜尋來源字幕，只在相同章節與正確 teacher block 補上內容；新增列點必須附包含該訊號的 evidenceStartCue／evidenceEndCue。`);
  }
  if (focus.taiwanIssues.length > 0) {
    lines.push(`- 臺灣繁中待修項目共 ${focus.taiwanIssues.length} 個，只修 validationReport.taiwanIssues 明列位置。`);
  }
  if (focus.compressionIssues.length > 0) {
    lines.push(`- 有 ${focus.compressionIssues.length} 段字幕相較基底縮短超過 45%。逐段比對 baseText 與 reviewedText；若刪到定義、數字、方向、否定、例子、例外、自我更正、醫學術語或考試提醒，請補回。若只刪除純贅詞、重複或起句失敗，保留精簡後文字，並在 captions.reviewed.json 的 compressionReviews 為該 cue 加入 {captionId, disposition:'verified_cleanup', reason, baseTextSha256, reviewedTextSha256}。reason 只能是 filler_only、repetition_only、false_start_only、meaning_preserved_after_deduplication；兩個 SHA-256 必須由 validationReport 內該 cue 的 baseText 與最終 reviewedText UTF-8 原文計算。沒有逐段核對或仍不確定時改列 unresolved，不得建立審核憑證。`);
  }
  if (focus.lostTeacherEmphasisSignals.length > 0) {
    lines.push(`- 有 ${focus.lostTeacherEmphasisSignals.length} 段校訂字幕刪掉了基底逐字稿中的明確老師強調訊號。只逐段核對 validationReport.lostTeacherEmphasisSignals；若是老師原話，補回原本的強調程度與內容；若基底辨識有誤，保留校訂文字並在 unresolved 寫明需要 audio 或 board，不得靜默刪除。`);
  }
  if (focus.unresolved.length > 0) {
    lines.push(`- 未解疑點共 ${focus.unresolved.length} 個；沒有明確字幕、音訊或板書證據時不得猜測。`);
  }
  if (focus.weakMissingSignals.length > 0) {
    lines.push(`- 僅供抽查、不得單獨觸發改寫的弱訊號：${focus.weakMissingSignals.join("、")}。這些多為頁碼、一般計數或圖面標號，除非同時出現在上述必修項目，否則保持 candidate 原樣。`);
  }
  if (focus.actionCount === 0) {
    lines.push("- 驗證報告沒有可安全自動修補的明確項目；不得自行擴大修改範圍。 ");
  }
  return lines;
}

async function persistResponseCandidate({ jobRoot, files, zipPath }) {
  const responsesRoot = resolve(jobRoot, "responses");
  const attempt = await nextNumberedDirectory(responsesRoot, "import");
  const attemptId = `import-${roundToken(attempt)}`;
  const candidateRoot = resolve(responsesRoot, attemptId);
  await mkdir(candidateRoot, { recursive: true });
  for (const name of expectedResponseFiles) {
    await copyFile(files.get(name), resolve(candidateRoot, name));
  }
  await copyFile(zipPath, resolve(candidateRoot, "source.result.zip"));
  await writeAtomic(resolve(candidateRoot, "import-manifest.private.json"), {
    schemaVersion: WORKFLOW_SCHEMA_VERSION,
    attemptId,
    sourceFilename: basename(zipPath),
    importedAt: new Date().toISOString()
  });
  return { attemptId, candidateRoot };
}

export async function importChatResponse({ repoRoot, videoId, responseZip, jobId, approveAudit = false }) {
  const input = await loadWorkflowInput({ repoRoot, videoId });
  const state = await readState(input.paths);
  const resolvedJobId = jobId ?? state.activeJobId;
  if (!resolvedJobId) throw new Error("找不到 active job，請先建立 Chat 工作包。 ");
  const jobData = await loadJob(repoRoot, videoId, resolvedJobId);
  const zipPath = resolve(responseZip);
  if (!(await exists(zipPath))) throw new Error(`找不到結果 ZIP：${zipPath}`);
  const { root, files } = await extractResponseZip(zipPath);
  const validationPath = resolve(jobData.jobRoot, "response.validation.json");
  try {
    const candidate = await persistResponseCandidate({ jobRoot: jobData.jobRoot, files, zipPath });
    const parsed = {};
    const errorsByArea = { files: [], manifest: [], unresolved: [], chapters: [], captions: [], lectureNotes: [] };
    await Promise.all(expectedResponseFiles.map(async (name) => {
      try {
        parsed[name] = await readJson(files.get(name), name);
      } catch (error) {
        errorsByArea.files.push(errorMessage(error));
      }
    }));

    const manifest = parsed["response-manifest.json"];
    const chaptersRaw = parsed["chapters.candidate.json"];
    const captionsRaw = parsed["captions.reviewed.json"];
    const notesRaw = parsed["lecture-notes.candidate.json"];
    const unresolvedRaw = parsed["unresolved.json"];
    if (manifest !== undefined) {
      try {
        validateResponseManifest(manifest, jobData.job);
      } catch (error) {
        errorsByArea.manifest.push(errorMessage(error));
      }
    }
    if (unresolvedRaw !== undefined) {
      if (!Array.isArray(unresolvedRaw)) errorsByArea.unresolved.push("unresolved.json 必須是陣列。");
      else if (unresolvedRaw.length > 0) errorsByArea.unresolved.push(`仍有 ${unresolvedRaw.length} 個 unresolved，不能匯入。`);
    }

    let chapterResult = null;
    let normalizedChapterDraft = null;
    let chapterNormalizations = [];
    if (chaptersRaw !== undefined) {
      const normalizedTimes = normalizeChapterTimesForImport(chaptersRaw);
      chapterNormalizations = normalizedTimes.changes;
      normalizedChapterDraft = normalizedTimes.draft;
      chapterResult = validateAndNormalizeChapterDraft(normalizedTimes.draft, jobData.transcript);
      errorsByArea.chapters.push(...chapterResult.errors);
    }

    let captionResult = null;
    if (captionsRaw !== undefined) {
      captionResult = validateAndNormalizeReviewedCaptions(
        captionsRaw,
        jobData.baseCaptions,
        videoId,
        jobData.transcript.sourceFingerprint
      );
      errorsByArea.captions.push(...captionResult.errors);
    }

    let validatedNotes = null;
    let audit = null;
    let teacherEmphasisIssues = [];
    let lostTeacherEmphasisSignals = [];
    if (notesRaw !== undefined && chapterResult?.valid && captionResult?.structureValid) {
      lostTeacherEmphasisSignals = collectLostTeacherEmphasisSignals(
        jobData.baseCaptions,
        captionResult.captions
      );
      teacherEmphasisIssues = collectTeacherEmphasisIssues(notesRaw, captionResult.captions);
      errorsByArea.lectureNotes.push(...collectLectureNotesPreflightErrors(
        notesRaw,
        captionResult.captions,
        chapterResult.chapters
      ));
      const contentForNotes = {
        videoId,
        captions: captionResult.captions,
        chapters: chapterResult.chapters.map((chapter) => ({ id: chapter.id, title: chapter.title, startSec: chapter.startSec, endSec: chapter.endSec }))
      };
      const notesCandidate = {
        ...notesRaw,
        schemaVersion: WORKFLOW_SCHEMA_VERSION,
        videoId,
        captionFingerprint: captionFingerprint(captionResult.captions),
        reviewStatus: "lecture_notes_candidate",
        unresolved: []
      };
      try {
        audit = auditWorkflowContent({
          captions: captionResult.captions,
          lectureNotes: notesRaw
        });
      } catch {
        // 原始候選格式可能不完整；正式驗證會提供可修補的精確錯誤。
      }
      try {
        validatedNotes = validateLectureNotesReview(contentForNotes, notesCandidate);
        audit = auditWorkflowContent({ captions: captionResult.captions, lectureNotes: validatedNotes });
      } catch (error) {
        errorsByArea.lectureNotes.push(errorMessage(error));
      }
    }

    for (const key of Object.keys(errorsByArea)) errorsByArea[key] = [...new Set(errorsByArea[key])];
    const errors = [...new Set(Object.values(errorsByArea).flat())];
    const structuralStatus = errors.length > 0 ? "needs_repair" : (audit?.status ?? "needs_repair");
    const report = {
      schemaVersion: WORKFLOW_SCHEMA_VERSION,
      workflowVersion: WORKFLOW_VERSION,
      jobId: resolvedJobId,
      videoId,
      sourceFingerprint: jobData.transcript.sourceFingerprint,
      validatedAt: new Date().toISOString(),
      status: structuralStatus,
      ...(errors.length > 0 ? { errors, errorGroups: errorsByArea } : {}),
      ...(Array.isArray(unresolvedRaw) && unresolvedRaw.length > 0 ? { unresolved: unresolvedRaw } : {}),
      ...(captionResult?.taiwanIssues?.length > 0 ? { taiwanIssues: captionResult.taiwanIssues } : {}),
      ...(captionResult?.compressionIssues?.length > 0 ? { compressionIssues: captionResult.compressionIssues } : {}),
      ...(captionResult?.acknowledgedCompressionIssues?.length > 0
        ? { acknowledgedCompressionIssues: captionResult.acknowledgedCompressionIssues }
        : {}),
      ...(teacherEmphasisIssues.length > 0 ? { teacherEmphasisIssues } : {}),
      ...(lostTeacherEmphasisSignals.length > 0 ? { lostTeacherEmphasisSignals } : {}),
      normalizations: {
        chapterTimes: chapterNormalizations,
        captions: captionResult?.normalizations ?? []
      },
      ...(audit ? { audit } : {}),
      artifacts: {
        candidateResponseDir: displayPath(repoRoot, candidate.candidateRoot),
        reviewedCaptions: "captions.reviewed.private.json",
        validatedChapters: "chapters.validated.private.json",
        validatedLectureNotes: "lecture-notes.validated.private.json"
      }
    };
    await writeAtomic(validationPath, report);
    await writeAtomic(resolve(candidate.candidateRoot, "validation.json"), report);
    if (captionResult?.captions?.length > 0) {
      await writeAtomic(resolve(jobData.jobRoot, "candidate.captions.reviewed.json"), { schemaVersion: WORKFLOW_SCHEMA_VERSION, videoId, sourceFingerprint: jobData.transcript.sourceFingerprint, captions: captionResult.captions });
    }
    const privateChapterPackage = chapterResult?.valid
      ? buildPrivateChapterPackage(jobData.transcript, chapterResult.chapters)
      : null;
    if (privateChapterPackage) {
      await writeAtomic(resolve(jobData.jobRoot, "candidate.chapters.validated.json"), privateChapterPackage);
    }
    if (validatedNotes) await writeAtomic(resolve(jobData.jobRoot, "candidate.lecture-notes.validated.json"), validatedNotes);
    if (errors.length > 0 || (audit?.status === "needs_review" && !approveAudit)) {
      await writeState(input.paths, { ...state, videoId, sourceFingerprint: jobData.transcript.sourceFingerprint, updatedAt: new Date().toISOString(), state: "needs_repair", activeJobId: resolvedJobId, artifacts: { ...(state.artifacts ?? {}), validation: displayPath(repoRoot, validationPath) } });
      return { status: "needs_repair", report, validationPath };
    }
    await writeAtomic(input.paths.captionsReviewed, { schemaVersion: WORKFLOW_SCHEMA_VERSION, videoId, sourceFingerprint: jobData.transcript.sourceFingerprint, captionFingerprint: captionFingerprint(captionResult.captions), reviewStatus: "validated", captions: captionResult.captions });
    await writeAtomic(input.paths.chapters, privateChapterPackage);
    await writeAtomic(input.paths.chaptersPreview, privateChapterPackage);
    await writeAtomic(input.paths.lectureNotes, validatedNotes);
    await writeState(input.paths, { ...state, videoId, sourceFingerprint: jobData.transcript.sourceFingerprint, updatedAt: new Date().toISOString(), state: "validated", activeJobId: resolvedJobId, artifacts: { ...(state.artifacts ?? {}), validation: displayPath(repoRoot, validationPath), captions: displayPath(repoRoot, input.paths.captionsReviewed), chapters: displayPath(repoRoot, input.paths.chapters), lectureNotes: displayPath(repoRoot, input.paths.lectureNotes) } });
    return { status: "validated", report, validationPath };
  } catch (error) {
    const report = {
      schemaVersion: WORKFLOW_SCHEMA_VERSION,
      workflowVersion: WORKFLOW_VERSION,
      jobId: resolvedJobId,
      videoId,
      sourceFingerprint: jobData.transcript.sourceFingerprint,
      validatedAt: new Date().toISOString(),
      status: "needs_repair",
      errors: [errorMessage(error)]
    };
    await writeAtomic(validationPath, report);
    await writeState(input.paths, { ...state, videoId, sourceFingerprint: jobData.transcript.sourceFingerprint, updatedAt: new Date().toISOString(), state: "needs_repair", activeJobId: resolvedJobId, artifacts: { ...(state.artifacts ?? {}), validation: displayPath(repoRoot, validationPath) } });
    return { status: "needs_repair", report, validationPath };
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

export async function createRepairZip({ repoRoot, videoId, jobId }) {
  const input = await loadWorkflowInput({ repoRoot, videoId });
  const state = await readState(input.paths);
  const resolvedJobId = jobId ?? state.activeJobId;
  if (!resolvedJobId) throw new Error("找不到需要修補的 job。 ");
  const jobRoot = resolve(input.paths.jobsRoot, resolvedJobId);
  const job = await readJson(resolve(jobRoot, "job-manifest.json"), "Chat 工作 manifest");
  const packageStem = typeof job.packageStem === "string" && job.packageStem.length > 0
    ? job.packageStem
    : await resolveReadablePackageStem(repoRoot, input.transcript, videoId);
  const report = await readJson(resolve(jobRoot, "response.validation.json"), "驗證報告");
  const repairsRoot = resolve(jobRoot, "repairs");
  const round = await nextNumberedDirectory(repairsRoot, "repair");
  const names = buildRepairFileNames(packageStem, round);
  const repairFocus = buildRepairFocus(report);
  const repairRoot = resolve(repairsRoot, `repair-${names.token}`);
  await mkdir(resolve(repairRoot, "input"), { recursive: true });
  await mkdir(resolve(repairRoot, "candidate"), { recursive: true });
  const candidateRelative = report.artifacts?.candidateResponseDir;
  if (!candidateRelative) throw new Error("驗證報告沒有保存候選回覆，請先用新版匯入器重新匯入結果 ZIP。");
  const candidateRoot = resolve(repoRoot, candidateRelative);
  assertInside(jobRoot, candidateRoot, "候選回覆目錄");
  for (const name of expectedResponseFiles) {
    const source = resolve(candidateRoot, name);
    if (!(await exists(source))) throw new Error(`候選回覆缺少 ${name}，無法建立自足修補包。`);
    await copyFile(source, resolve(repairRoot, "candidate", name));
  }
  const candidateCaptions = await readJson(resolve(candidateRoot, "captions.reviewed.json"), "候選校訂字幕");
  const evidencePlans = buildUnresolvedEvidencePlan({
    unresolved: report.unresolved,
    captions: candidateCaptions.captions,
    durationSec: input.transcript.durationSec
  });
  const sourceVideo = resolve(input.paths.videoRoot, "source", `${videoId}.mp4`);
  const unresolvedEvidence = evidencePlans.length > 0 && await exists(sourceVideo)
    ? await writeUnresolvedEvidence({ repairRoot, sourceVideo, plans: evidencePlans })
    : [];
  await writeAtomic(resolve(repairRoot, "input/taiwan-terminology.json"), TAIWAN_MEDICAL_TERMINOLOGY_GUIDE);
  const repair = {
    schemaVersion: WORKFLOW_SCHEMA_VERSION,
    workflowVersion: WORKFLOW_VERSION,
    jobId: resolvedJobId,
    videoId,
    sourceFingerprint: input.transcript.sourceFingerprint,
    repairRound: round,
    repairToken: names.token,
    expectedResponseFilename: names.result,
    repairFocus,
    unresolvedEvidence,
    validationReport: report,
    instruction: "以 candidate/ 內的完整上一版五檔為基礎，只修正驗證報告指出的問題；未被指出的字幕 ID、時間、章節邊界與講義內容全部保留。完成後仍回傳完整五檔結果 ZIP。"
  };
  await writeAtomic(resolve(repairRoot, "input/repair.json"), repair);
  await writeAtomic(resolve(repairRoot, "REPAIR_PROMPT.md"), [
    "這是局部修補包，可以在原本對話或新對話中處理。先讀 input/repair.json，再把 candidate/ 內的完整上一版五檔當成唯一修改基底。",
    ...repairFocusPromptLines(repairFocus),
    "只處理 validationReport 列出的錯誤或風險。不要重新改寫未受影響的字幕、章節邊界、講義或老師強調，也不要從記憶重建候選檔。",
    "若錯誤是章節時間格式：把 startSec、endSec、representativeFrameTargetSec 全部改成整數秒；原本同一個內部邊界只四捨五入一次，前一章 endSec 與下一章 startSec 必須完全相同；代表畫面無法安全落在章節內就填 null。確認所有章節 startSec >= 0、endSec > startSec、排序且不重疊。",
    "章節時間修補不能只改代表畫面：請逐一掃描全部 chapters 的 startSec、endSec、representativeFrameTargetSec。例：若某個共用邊界是 1012.62，必須選定一個整數（例如 1013），並同時令前一章 endSec=1013、下一章 startSec=1013；結果中不得再出現任何 .xx 小數。字幕 cue 的原始小數時間不可因此修改。",
    "若錯誤是臺灣繁中字形：只處理 validationReport.taiwanIssues 明列的項目；腭、關節面、游離、分布、深岩神經、回旋、念作、梁柱等醫學或臺灣常用形式不可只依一般繁簡轉換任意替換。",
    "若錯誤是字幕過度縮短：逐段比對 validationReport.compressionIssues 的 baseText 與 reviewedText，只補回被刪掉的新資訊；不得把其他 cue 的文字搬過來，也不得為了提高長度而加入老師沒說的內容。",
    "若錯誤是講義區塊超過 14 段字幕：只拆分被指出的 teacher block，使每個新區塊涵蓋 1 到 14 段連續字幕；新區塊的 sourceCaptionStart／sourceCaptionEnd 必須首尾相接、沒有缺口或重複，原本的列點、表格、老師強調與 evidence 要完整保留並依證據範圍放入對應新區塊。",
    "若錯誤是老師強調缺少明確訊號：先查看同一 teacher block 內前後字幕。若相鄰 cue 明確說出重要、會考、考過、要記、背熟、背好、注意、小心、星號等訊號，僅把 teacherEmphasis 的 evidenceStartCue／evidenceEndCue 擴到同時涵蓋該訊號與對應內容；若同一區塊內沒有明確訊號，就刪除該 teacherEmphasis。不可為了通過檢查而改寫字幕、虛構老師語氣、改動講義正文或新增強調。",
    "若問題是聽不清楚的術語：不要猜正式解剖名稱。保留原字幕文字，並在 unresolved.json 寫入 captionId、issue、reason、sourceText、needs='audio' 或 'board'；只有有明確證據時才可消除該疑點。",
    "若 input/unresolved-evidence.json 存在，請逐項聽 input/evidence/audio/ 的短音訊並查看 input/evidence/frames/ 的當下畫面，同時對照 context。只有音訊、畫面或前後文能明確支持時才能校正；證據仍不足就保留 unresolved，不可依常識猜詞。",
    ...buildSourceBoundaryPromptLines().map((line) => `若問題是影片中斷：${line}`),
    "請重新產生完整 response-manifest.json、chapters.candidate.json、captions.reviewed.json、lecture-notes.candidate.json、unresolved.json，並打包成 ZIP。",
    "回傳前逐項檢查五個檔案、字幕完整性、整數章節時間、講義 evidence 範圍與 unresolved 細節；不要在聊天訊息貼大量 JSON。",
    `結果 ZIP 請命名為：${names.result}`
  ].join("\n"));
  const zipPath = resolve(jobRoot, names.input);
  await execFileAsync("zip", ["-q", "-r", zipPath, "input", "candidate", "REPAIR_PROMPT.md"], { cwd: repairRoot });
  const previousRepairZips = Array.isArray(state.artifacts?.repairZips) ? state.artifacts.repairZips : [];
  await writeState(input.paths, {
    ...state,
    state: "waiting_for_chat",
    updatedAt: new Date().toISOString(),
    activeJobId: resolvedJobId,
    artifacts: {
      ...(state.artifacts ?? {}),
      repairZip: displayPath(repoRoot, zipPath),
      repairZips: [...previousRepairZips, displayPath(repoRoot, zipPath)]
    }
  });
  return { zipPath, report, jobId: resolvedJobId, round, expectedResponseFilename: names.result };
}

export async function auditCanonical({ repoRoot, videoId }) {
  const input = await loadWorkflowInput({ repoRoot, videoId });
  if (!(await exists(input.paths.captionsReviewed)) || !(await exists(input.paths.lectureNotes))) {
    throw new Error("目前還沒有可稽核的校訂字幕與講義。 ");
  }
  const captionsDoc = await readJson(input.paths.captionsReviewed, "校訂字幕");
  const notes = await readJson(input.paths.lectureNotes, "已驗證講義");
  const report = auditWorkflowContent({ captions: captionsDoc.captions, lectureNotes: notes });
  await writeAtomic(input.paths.lastValidation, { schemaVersion: WORKFLOW_SCHEMA_VERSION, videoId, updatedAt: new Date().toISOString(), status: report.status, audit: report });
  return report;
}

export { expectedResponseFiles };
