import { createHash } from "node:crypto";
import { captionFingerprint, findNonTaiwanCaptions } from "./subtitle-proofreading-core.mjs";

const blockTypes = new Set(["bullets", "table"]);
const provenances = new Set(["teacher", "supplement"]);
const maxTeacherCaptionSpan = 14;

function sha256Json(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function normalizeText(value, label, maxLength) {
  const text = typeof value === "string"
    ? value.normalize("NFC").replace(/\s+/g, " ").trim()
    : "";
  if (!text || text.length > maxLength) throw new Error(`${label}格式無效。`);
  const issues = findNonTaiwanCaptions([{ id: label, startSec: 0, endSec: 1, text }]);
  if (issues.length > 0) throw new Error(`${label}必須使用臺灣繁體中文。`);
  return text;
}

function normalizePoints(raw, label) {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 12) {
    throw new Error(`${label}必須有 1 到 12 個重點。`);
  }
  return raw.map((point, index) => {
    if (!point || typeof point !== "object" || Array.isArray(point)) {
      throw new Error(`${label}第 ${index + 1} 點格式無效。`);
    }
    const details = point.details ?? [];
    if (!Array.isArray(details) || details.length > 8) {
      throw new Error(`${label}第 ${index + 1} 點的子項目格式無效。`);
    }
    return {
      text: normalizeText(point.text, `${label}第 ${index + 1} 點`, 320),
      details: details.map((detail, detailIndex) => (
        normalizeText(detail, `${label}第 ${index + 1} 點子項目 ${detailIndex + 1}`, 260)
      ))
    };
  });
}

function normalizeTable(raw, label) {
  const columns = raw.columns;
  const rows = raw.rows;
  if (!Array.isArray(columns) || columns.length < 2 || columns.length > 6) {
    throw new Error(`${label}表格必須有 2 到 6 欄。`);
  }
  if (!Array.isArray(rows) || rows.length === 0 || rows.length > 24) {
    throw new Error(`${label}表格必須有 1 到 24 列。`);
  }
  const normalizedColumns = columns.map((column, index) => (
    normalizeText(column, `${label}表格欄名 ${index + 1}`, 80)
  ));
  const normalizedRows = rows.map((row, rowIndex) => {
    if (!Array.isArray(row) || row.length !== normalizedColumns.length) {
      throw new Error(`${label}表格第 ${rowIndex + 1} 列欄數不一致。`);
    }
    return row.map((cell, columnIndex) => (
      normalizeText(cell, `${label}表格第 ${rowIndex + 1} 列第 ${columnIndex + 1} 欄`, 220)
    ));
  });
  return { columns: normalizedColumns, rows: normalizedRows };
}

function normalizeBlockContent(raw, label) {
  if (!blockTypes.has(raw.type)) throw new Error(`${label}類型無效。`);
  if (raw.type === "bullets") {
    return { type: "bullets", points: normalizePoints(raw.points, label) };
  }
  return { type: "table", ...normalizeTable(raw, label) };
}

function chapterForRange(chapters, startSec, endSec) {
  return chapters.find((chapter) => (
    startSec >= chapter.startSec - 0.5 && endSec <= chapter.endSec + 0.5
  )) ?? null;
}

export function lectureNotesFingerprint(notes) {
  return sha256Json({
    captionFingerprint: notes.captionFingerprint,
    blocks: notes.blocks
  });
}

export function validateLectureNotesReview(video, review, { acceptedStatuses = ["lecture_notes_candidate"] } = {}) {
  if (!video || typeof video !== "object" || Array.isArray(video)) throw new Error("影片資料格式無效。");
  if (!review || typeof review !== "object" || Array.isArray(review)) throw new Error("列點講義回覆必須是 JSON 物件。");
  if (review.schemaVersion !== "1.0.0") throw new Error("列點講義 schemaVersion 必須是 1.0.0。");
  if (review.videoId !== video.videoId) throw new Error("列點講義 videoId 與影片不一致。");
  if (!acceptedStatuses.includes(review.reviewStatus)) throw new Error("列點講義尚未通過指定的校訂階段。");
  const expectedCaptionFingerprint = captionFingerprint(video.captions ?? []);
  if (review.captionFingerprint !== expectedCaptionFingerprint) {
    throw new Error("列點講義不是針對目前這版字幕。");
  }
  if (!Array.isArray(review.unresolved)) throw new Error("列點講義 unresolved 格式無效。");
  if (review.unresolved.length > 0) {
    throw new Error(`列點講義仍有 ${review.unresolved.length} 處待確認，不能匯入。`);
  }
  if (!Array.isArray(review.blocks) || review.blocks.length === 0) {
    throw new Error("列點講義 blocks 不可為空。");
  }

  const captions = video.captions ?? [];
  const chapters = video.chapters ?? [];
  const captionIndex = new Map(captions.map((caption, index) => [caption.id, index]));
  const chapterIds = new Set(chapters.map((chapter) => chapter.id ?? chapter.stableId));
  const blockIds = new Set();
  const teacherBlocks = new Map();
  const normalizedBlocks = [];
  let expectedTeacherStart = 0;

  for (const [index, raw] of review.blocks.entries()) {
    const label = `第 ${index + 1} 個講義區塊`;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error(`${label}格式無效。`);
    const id = normalizeText(raw.id, `${label} id`, 100);
    if (blockIds.has(id)) throw new Error(`列點講義區塊 id 重複：${id}`);
    blockIds.add(id);
    if (!provenances.has(raw.provenance)) throw new Error(`${label}來源標示無效。`);
    const title = normalizeText(raw.title, `${label}標題`, 120);
    const content = normalizeBlockContent(raw, label);

    if (raw.provenance === "teacher") {
      const startIndex = captionIndex.get(raw.sourceCaptionStart);
      const endIndex = captionIndex.get(raw.sourceCaptionEnd);
      if (startIndex === undefined || endIndex === undefined || endIndex < startIndex) {
        throw new Error(`${label}字幕範圍無效。`);
      }
      if (startIndex !== expectedTeacherStart) {
        const expectedId = captions[expectedTeacherStart]?.id ?? "影片結尾";
        throw new Error(`${label}前有字幕缺口或重複，應從 ${expectedId} 開始。`);
      }
      const startSec = captions[startIndex].startSec;
      const endSec = captions[endIndex].endSec;
      const sourceCaptionCount = endIndex - startIndex + 1;
      if (sourceCaptionCount > maxTeacherCaptionSpan) {
        throw new Error(`${label}涵蓋 ${sourceCaptionCount} 段字幕，最多只能涵蓋 ${maxTeacherCaptionSpan} 段；請拆小以便逐段核對。`);
      }
      const chapter = chapterForRange(chapters, startSec, endSec);
      const chapterId = raw.chapterId;
      if (!chapter || !chapterIds.has(chapterId) || (chapter.id ?? chapter.stableId) !== chapterId) {
        throw new Error(`${label}跨越章節或 chapterId 不一致。`);
      }
      const normalized = {
        id,
        chapterId,
        provenance: "teacher",
        title,
        sourceCaptionStart: captions[startIndex].id,
        sourceCaptionEnd: captions[endIndex].id,
        sourceCaptionCount,
        startSec,
        endSec,
        ...content
      };
      normalizedBlocks.push(normalized);
      teacherBlocks.set(id, normalized);
      expectedTeacherStart = endIndex + 1;
      continue;
    }

    const afterBlockId = normalizeText(raw.afterBlockId, `${label}對應講授區塊`, 100);
    const parent = teacherBlocks.get(afterBlockId);
    if (!parent) throw new Error(`${label}必須接在已出現的老師講授區塊後。`);
    if (raw.chapterId !== parent.chapterId) throw new Error(`${label}chapterId 必須與對應講授區塊相同。`);
    normalizedBlocks.push({
      id,
      chapterId: parent.chapterId,
      provenance: "supplement",
      afterBlockId,
      title,
      startSec: parent.startSec,
      endSec: parent.endSec,
      ...content
    });
  }

  if (expectedTeacherStart !== captions.length) {
    throw new Error(`列點講義未涵蓋 ${captions[expectedTeacherStart]?.id ?? "最後一段"} 之後的字幕。`);
  }

  return {
    schemaVersion: "1.0.0",
    videoId: video.videoId ?? video.id,
    captionFingerprint: expectedCaptionFingerprint,
    reviewStatus: "draft",
    blocks: normalizedBlocks
  };
}

export function buildLectureNotesPackage(video) {
  const fingerprint = captionFingerprint(video.captions ?? []);
  const chapterContext = (video.chapters ?? []).map((chapter) => ({
    id: chapter.id ?? chapter.stableId,
    title: chapter.title,
    startSec: chapter.startSec,
    endSec: chapter.endSec,
    summary: chapter.summary,
    tags: chapter.tags
  }));
  const captionLines = (video.captions ?? []).map((caption) => JSON.stringify(caption));
  const example = {
    schemaVersion: "1.0.0",
    videoId: video.videoId ?? video.id,
    captionFingerprint: fingerprint,
    reviewStatus: "lecture_notes_candidate",
    blocks: [
      {
        id: `${video.videoId ?? video.id}-lecture-001`,
        chapterId: chapterContext[0]?.id ?? "chapter-id",
        provenance: "teacher",
        type: "bullets",
        title: "老師這一段的主題",
        sourceCaptionStart: video.captions?.[0]?.id ?? "cue-00001",
        sourceCaptionEnd: video.captions?.[1]?.id ?? "cue-00002",
        points: [
          { text: "完整保留老師講到的第一個重點。", details: ["必要時用子項目保留例子、例外與提醒。"] }
        ]
      },
      {
        id: `${video.videoId ?? video.id}-supplement-001`,
        chapterId: chapterContext[0]?.id ?? "chapter-id",
        provenance: "supplement",
        type: "table",
        title: "補充比較",
        afterBlockId: `${video.videoId ?? video.id}-lecture-001`,
        columns: ["比較項目", "重點"],
        rows: [["必要背景", "只放有助理解且不冒充老師講授的補充。"]]
      }
    ],
    unresolved: []
  };

  return [
    "# 老趙解剖學列點講義完整整理包",
    "",
    "## 請直接貼給 ChatGPT Pro 的完整指令",
    "",
    "你是臺灣醫學教育內容編輯。請把下方完整時間碼字幕整理成可在影片右側閱讀的列點講義。講義要依老師實際講述順序呈現，不能只做摘要，也不能漏掉老師講過的內容。",
    "",
    "嚴格規則：",
    "1. 先完整讀完所有章節與字幕，再開始輸出。老師講到的知識、定義、數字、步驟、因果、比較、例子、口訣、例外、否定、提醒、自我修正與考試提示都不可遺漏。",
    "2. 可以把語助詞、完全重複的措辭與不影響內容的口頭停頓併入相鄰區塊，但其字幕 ID 仍必須落在某個 teacher 區塊的來源範圍內。老師新講出的每一項資訊都必須實際寫進 points、details 或 table，不能只把字幕範圍標上去卻省略內容。",
    `3. 所有 provenance=teacher 的區塊，sourceCaptionStart 到 sourceCaptionEnd 必須依原順序連續、不可重疊、不可跳號；第一個從第一段字幕開始，最後一個涵蓋最後一段字幕。每個 teacher 區塊不得跨越章節，且最多涵蓋 ${maxTeacherCaptionSpan} 段字幕；同一主題太長時請拆成連續小區塊，方便逐段核對。`,
    "4. teacher 內容只能來自字幕。可重新組句成自然的臺灣繁體中文列點，但不可新增老師沒說過的結論，也不可改變原意。",
    "5. 若理解該段確實需要背景知識、名詞定義或比較，可新增 provenance=supplement 區塊；必須用 afterBlockId 指向前面的 teacher 區塊，不可填 sourceCaptionStart 或 sourceCaptionEnd。補充可以完整到足以協助理解，但不可取代、刪減或混入 teacher 內容，網站會把它明確標為『補充』。",
    "6. 比較、分類、流程、神經分支、構造關係或容易混淆的內容可用 type=table；其他內容用 type=bullets。表格每列欄數必須與 columns 相同。",
    "7. bullets 的 points 每點要能獨立閱讀；需要第二層時放 details。不可用 Markdown，不可輸出 HTML。",
    "8. 所有中文一律使用臺灣繁體中文。醫學英文採常見正確拼字，不確定時不可猜，列入 unresolved。",
    "9. 完成每個 teacher 區塊後，逐段回看 sourceCaptionStart 到 sourceCaptionEnd：逐一確認其中每個定義、數字、方向、因果、條件、例外、舉例、口訣、糾正與提醒，都能在該區塊的 points、details 或 table 找到，不可只保留結論。",
    "10. 若任何字幕無法可靠理解，仍要維持完整來源範圍，並把疑點列入 unresolved；不要自行補成看似合理的內容。unresolved 非空時網站會拒絕匯入，之後再由人工聽片確認。",
    "11. 只輸出一個可解析 JSON 物件，不要 Markdown code fence、前言或結語。",
    "",
    "輸出格式範例：",
    "```json",
    JSON.stringify(example, null, 2),
    "```",
    "",
    "## 檔案識別",
    "",
    `- videoId: ${video.videoId ?? video.id}`,
    `- 影片名稱: ${video.title}`,
    `- 字幕版本指紋: ${fingerprint}`,
    `- 字幕總數: ${(video.captions ?? []).length}`,
    `- 章節總數: ${chapterContext.length}`,
    "",
    "## 章節脈絡",
    "",
    "```json",
    JSON.stringify(chapterContext, null, 2),
    "```",
    "",
    "## 完整時間碼字幕",
    "",
    "以下為 JSONL，每行一段。必須完整涵蓋，不可跳過任何 ID。",
    "",
    "```jsonl",
    ...captionLines,
    "```",
    ""
  ].join("\n");
}
