import { createHash } from "node:crypto";
import OpenCC from "opencc-js";

const toTaiwanTraditional = OpenCC.Converter({ from: "cn", to: "tw" });
const approvedTaiwanTerms = [
  "大岩神經",
  "小岩神經",
  "大岩",
  "小岩",
  "岩部",
  "腭骨",
  "後面"
];
const preferredTaiwanForms = [
  ["去念", "去唸"],
  ["講台", "講臺"],
  ["鼻梁", "鼻樑"],
  ["齶骨", "腭骨"]
];
const correctionTypes = new Set([
  "traditional_chinese",
  "medical_english",
  "recognition_error",
  "punctuation"
]);

function sha256Json(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function normalizePreferredTaiwanForms(text) {
  return preferredTaiwanForms.reduce(
    (normalized, [source, target]) => normalized.replaceAll(source, target),
    text
  );
}

function convertForTaiwanCheck(text) {
  const placeholders = [];
  let protectedText = normalizePreferredTaiwanForms(text);
  for (const term of approvedTaiwanTerms) {
    if (!protectedText.includes(term)) continue;
    const token = `__LAOZHAO_TW_TERM_${placeholders.length}__`;
    placeholders.push([token, term]);
    protectedText = protectedText.replaceAll(term, token);
  }
  let convertedText = toTaiwanTraditional(protectedText);
  for (const [token, term] of placeholders) {
    convertedText = convertedText.replaceAll(token, term);
  }
  return convertedText;
}

export function captionFingerprint(captions) {
  return sha256Json(captions.map((caption) => ({
    id: caption.id,
    startSec: caption.startSec,
    endSec: caption.endSec,
    text: caption.text
  })));
}

export function findNonTaiwanCaptions(captions) {
  const issues = [];
  for (const caption of captions) {
    const convertedText = convertForTaiwanCheck(caption.text);
    if (convertedText !== caption.text) {
      issues.push({ captionId: caption.id, text: caption.text, convertedText });
    }
  }
  return issues;
}

export function assertTaiwanTraditionalCaptions(captions) {
  const issues = findNonTaiwanCaptions(captions);
  if (issues.length > 0) {
    const sample = issues.slice(0, 8).map((issue) => issue.captionId).join("、");
    throw new Error(`字幕仍有 ${issues.length} 段不是臺灣繁體中文：${sample}`);
  }
}

export function applySubtitleProofreading(captions, review, { videoId }) {
  if (!review || typeof review !== "object" || Array.isArray(review)) {
    throw new Error("字幕校對回覆必須是 JSON 物件。");
  }
  if (review.schemaVersion !== "1.0.0") throw new Error("字幕校對回覆 schemaVersion 必須是 1.0.0。");
  if (review.videoId !== videoId) throw new Error("字幕校對回覆 videoId 與影片不一致。");
  if (review.reviewStatus !== "proofread_candidate") throw new Error("字幕校對回覆尚未標記為 proofread_candidate。");
  if (review.captionFingerprint !== captionFingerprint(captions)) {
    throw new Error("字幕校對回覆不是針對目前這版字幕。");
  }
  if (!Array.isArray(review.corrections)) throw new Error("字幕校對回覆 corrections 格式無效。");
  if (!Array.isArray(review.unresolved)) throw new Error("字幕校對回覆 unresolved 格式無效。");

  const byId = new Map(captions.map((caption) => [caption.id, caption]));
  const replacements = new Map();
  for (const [index, correction] of review.corrections.entries()) {
    if (!correction || typeof correction !== "object" || Array.isArray(correction)) {
      throw new Error(`第 ${index + 1} 筆字幕修正格式無效。`);
    }
    if (!byId.has(correction.captionId)) throw new Error(`字幕修正 ID 不存在：${correction.captionId}`);
    if (replacements.has(correction.captionId)) throw new Error(`字幕修正 ID 重複：${correction.captionId}`);
    const correctedText = typeof correction.correctedText === "string"
      ? normalizePreferredTaiwanForms(
        correction.correctedText.normalize("NFC").replace(/\s+/g, " ").trim()
      )
      : "";
    if (!correctedText || correctedText.length > 240) {
      throw new Error(`${correction.captionId} 修正後文字長度無效。`);
    }
    if (!Array.isArray(correction.changeTypes) || correction.changeTypes.length === 0 || correction.changeTypes.some((type) => !correctionTypes.has(type))) {
      throw new Error(`${correction.captionId} changeTypes 格式無效。`);
    }
    if (typeof correction.rationale !== "string" || !correction.rationale.trim() || correction.rationale.length > 160) {
      throw new Error(`${correction.captionId} 缺少簡短修正理由。`);
    }
    replacements.set(correction.captionId, correctedText);
  }

  for (const [index, unresolved] of review.unresolved.entries()) {
    if (!unresolved || typeof unresolved !== "object" || Array.isArray(unresolved)) {
      throw new Error(`第 ${index + 1} 筆待確認字幕格式無效。`);
    }
    if (!byId.has(unresolved.captionId)) throw new Error(`待確認字幕 ID 不存在：${unresolved.captionId}`);
    if (typeof unresolved.issue !== "string" || !unresolved.issue.trim()) {
      throw new Error(`${unresolved.captionId} 缺少待確認原因。`);
    }
  }

  const corrected = captions.map((caption) => ({
    ...caption,
    text: replacements.get(caption.id) ?? caption.text
  }));
  assertTaiwanTraditionalCaptions(corrected);
  return corrected;
}

export function buildSubtitleProofreadingPackage(video) {
  const fingerprint = captionFingerprint(video.captions);
  const simplifiedIssues = findNonTaiwanCaptions(video.captions);
  const chapterContext = video.chapters.map((chapter) => ({
    id: chapter.id,
    title: chapter.title,
    startSec: chapter.startSec,
    endSec: chapter.endSec,
    summary: chapter.summary,
    tags: chapter.tags
  }));
  const captionLines = video.captions.map((caption) => JSON.stringify({
    id: caption.id,
    startSec: caption.startSec,
    endSec: caption.endSec,
    text: caption.text
  }));

  return [
    "# 老趙解剖學字幕完整校對包",
    "",
    "## 請直接貼給 ChatGPT Pro 的完整指令",
    "",
    "你是臺灣醫學教育字幕校對員。請校對下方老趙解剖學影片的完整逐字字幕。這是語音辨識稿，可能含簡體字、錯別字、中文同音誤辨，以及英文醫學術語因同音而拼錯。請依章節脈絡、前後字幕與解剖學知識修正，但不得改寫老師原意。",
    "",
    "嚴格規則：",
    "1. 所有中文一律使用臺灣繁體中文，不可留下任何簡體字。",
    "2. 修正明顯錯誤的英文解剖、組織、生理與醫學術語，例如語音辨識造成的近音拼字；英文大小寫採常見醫學寫法。請特別檢查 mediastinum、hyperplasia、pelvic brim 等可能被辨成相近發音文字的情形，但只能依本片上下文判斷，不可把例子硬套到無關字幕。",
    "3. 英文術語只修正可由章節、相鄰字幕或醫學語意支持的拼字，不要擅自翻譯成中文，也不要補出老師沒說的完整句。",
    "4. 請依語意調整斷句與標點，讓臺灣使用者自然閱讀。若一句話跨越相鄰字幕，前一段可不加句號、下一段接續語意；不可為了斷句把文字搬到別的 caption、合併或拆分 cue，也不可改時間碼。",
    "5. 可整理必要的中英文空格，但不要把口語逐字稿改寫成講義，也不要刪除老師的自我更正、重述或重要語氣。",
    "6. 不得新增逐字稿沒有的知識、數字或結論。不能確定時不要猜，請列入 unresolved。若現有 cue 邊界使句意無法在不移動文字的前提下修好，也列入 unresolved 並說明相鄰 captionId。",
    "7. 若某段同時有可確定的簡體中文與不確定的英文，仍要在 corrections 先完成保守的臺灣繁體修正，並把同一 captionId 的英文疑點另列 unresolved；不可因一個詞不確定就留下整段簡體字。",
    "8. 不可合併、拆分、刪除、重排字幕，不可修改 captionId、startSec 或 endSec。",
    "9. corrections 只列真正需要改動的字幕；未修改字幕不要重複輸出。斷句或標點有調整時，changeTypes 必須包含 punctuation。",
    "10. correctedText 最多 240 字。每一筆都要附 changeTypes 與簡短 rationale。",
    "11. 請先完整讀完 24 章與 1,017 段字幕，再分三輪檢查：第一輪處理臺灣繁體中文，第二輪依上下文處理醫學英文與辨識錯誤，第三輪檢查斷句與標點。最後逐字檢查所有輸出的中文欄位，確定沒有簡體字。",
    "",
    "只輸出一個可解析的 JSON 物件，不要 Markdown code fence，不要前言或結語：",
    JSON.stringify({
      schemaVersion: "1.0.0",
      videoId: video.videoId,
      captionFingerprint: fingerprint,
      reviewStatus: "proofread_candidate",
      corrections: [{
        captionId: "cue-00001",
        correctedText: "修正後完整字幕",
        changeTypes: ["traditional_chinese", "medical_english"],
        rationale: "簡體轉臺灣繁體並修正醫學英文拼字"
      }],
      unresolved: [{
        captionId: "cue-00002",
        issue: "前後文仍不足以確認術語",
        candidates: ["候選術語 A", "候選術語 B"]
      }]
    }, null, 2),
    "",
    "changeTypes 只可使用：traditional_chinese、medical_english、recognition_error、punctuation。",
    "",
    "## 檔案識別",
    "",
    `- videoId: ${video.videoId}`,
    `- 影片名稱: ${video.title}`,
    `- 字幕版本指紋: ${fingerprint}`,
    `- 字幕總數: ${video.captions.length}`,
    `- 自動偵測到可能需要繁體化的字幕: ${simplifiedIssues.length}`,
    "",
    "## 章節脈絡",
    "",
    "```json",
    JSON.stringify(chapterContext, null, 2),
    "```",
    "",
    "## 完整時間碼逐字稿",
    "",
    "以下為 JSONL，每行是一段字幕。請完整讀完後再輸出修正 JSON。",
    "",
    "```jsonl",
    ...captionLines,
    "```",
    ""
  ].join("\n");
}
