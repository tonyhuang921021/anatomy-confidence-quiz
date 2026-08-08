import { createHash } from "node:crypto";
import { captionFingerprint, findNonTaiwanCaptions } from "./subtitle-proofreading-core.mjs";

const blockTypes = new Set(["bullets", "table"]);
const provenances = new Set(["teacher", "supplement"]);
const pointKinds = new Set(["standard", "teacher_note", "exam_focus", "mnemonic", "warning"]);
const maxTeacherCaptionSpan = 14;
const maxOutlineCaptionSpan = 32;
const maxPointDepth = 3;
const maxPointChildren = 10;
const maxPointNodes = 80;

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

function normalizePoint(raw, label, depth, state) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(`${label}格式無效。`);
  }
  state.count += 1;
  if (state.count > maxPointNodes) {
    throw new Error(`${label}所屬區塊的條列節點過多。`);
  }
  const details = raw.details ?? [];
  if (!Array.isArray(details) || details.length > 8) {
    throw new Error(`${label}的舊式子項目格式無效。`);
  }
  const children = raw.children ?? [];
  if (!Array.isArray(children) || children.length > maxPointChildren) {
    throw new Error(`${label}的下層項目格式無效。`);
  }
  if (depth >= maxPointDepth && children.length > 0) {
    throw new Error(`${label}超過四層共筆結構。`);
  }
  const kind = raw.kind ?? "standard";
  if (!pointKinds.has(kind)) {
    throw new Error(`${label}的標記類型無效。`);
  }
  const normalizedChildren = children.map((child, childIndex) => (
    normalizePoint(child, `${label}下層項目 ${childIndex + 1}`, depth + 1, state)
  ));
  return {
    text: normalizeText(raw.text, label, depth === 0 ? 320 : 260),
    details: details.map((detail, detailIndex) => (
      normalizeText(detail, `${label}舊式子項目 ${detailIndex + 1}`, 260)
    )),
    ...(kind === "standard" ? {} : { kind }),
    ...(normalizedChildren.length === 0 ? {} : { children: normalizedChildren })
  };
}

function normalizePoints(raw, label) {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 12) {
    throw new Error(`${label}必須有 1 到 12 個重點。`);
  }
  const state = { count: 0 };
  return raw.map((point, index) => (
    normalizePoint(point, `${label}第 ${index + 1} 點`, 0, state)
  ));
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

function normalizeEmbeddedTables(raw, label) {
  const tables = raw ?? [];
  if (!Array.isArray(tables) || tables.length > 4) {
    throw new Error(`${label}內嵌表格數量無效。`);
  }
  return tables.map((table, tableIndex) => {
    if (!table || typeof table !== "object" || Array.isArray(table)) {
      throw new Error(`${label}第 ${tableIndex + 1} 張表格格式無效。`);
    }
    return {
      title: normalizeText(table.title, `${label}第 ${tableIndex + 1} 張表格標題`, 120),
      ...normalizeTable({
        columns: table.columns ?? table.headers,
        rows: table.rows
      }, `${label}第 ${tableIndex + 1} 張`)
    };
  });
}

function normalizeBlockContent(raw, label) {
  if (!blockTypes.has(raw.type)) throw new Error(`${label}類型無效。`);
  if (raw.type === "bullets") {
    const tables = normalizeEmbeddedTables(raw.tables, label);
    return {
      type: "bullets",
      points: normalizePoints(raw.points, label),
      ...(tables.length > 0 ? { tables } : {})
    };
  }
  return { type: "table", ...normalizeTable(raw, label) };
}

function chapterForCaption(chapters, caption) {
  const midpoint = (caption.startSec + caption.endSec) / 2;
  const directMatch = chapters.find((chapter, index) => (
    midpoint >= chapter.startSec
      && (midpoint < chapter.endSec || (index === chapters.length - 1 && midpoint <= chapter.endSec))
  ));
  if (directMatch) return directMatch;

  let bestMatch = null;
  let bestOverlap = 0;
  for (const chapter of chapters) {
    const overlap = Math.max(
      0,
      Math.min(caption.endSec, chapter.endSec) - Math.max(caption.startSec, chapter.startSec)
    );
    if (overlap > bestOverlap) {
      bestMatch = chapter;
      bestOverlap = overlap;
    }
  }
  return bestMatch;
}

function chapterForRange(chapters, captions, startIndex, endIndex) {
  const chapter = chapterForCaption(chapters, captions[startIndex]);
  if (!chapter) return null;
  const chapterId = chapter.id ?? chapter.stableId;
  for (let index = startIndex + 1; index <= endIndex; index += 1) {
    const candidate = chapterForCaption(chapters, captions[index]);
    if (!candidate || (candidate.id ?? candidate.stableId) !== chapterId) return null;
  }
  return chapter;
}

function chapterCaptionBounds(chapters, captions) {
  const bounds = new Map();
  for (const caption of captions) {
    const chapter = chapterForCaption(chapters, caption);
    if (!chapter) continue;
    const chapterId = chapter.id ?? chapter.stableId;
    const current = bounds.get(chapterId);
    bounds.set(chapterId, {
      sourceCaptionStart: current?.sourceCaptionStart ?? caption.id,
      sourceCaptionEnd: caption.id
    });
  }
  return bounds;
}

function sameSecond(left, right) {
  return typeof left === "number" && Number.isFinite(left) && Math.abs(left - right) <= 0.001;
}

function captionMidpoint(caption) {
  return (caption.startSec + caption.endSec) / 2;
}

function stripSectionNumber(title) {
  return title.replace(/^[一二三四五六七八九十百]+[、．.]\s*/, "").trim();
}

function validateTimedPointTree(raw, label, chapterStartSec, chapterEndSec, depth = 0) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(`${label}格式無效。`);
  }
  if (
    typeof raw.startSec !== "number" ||
    !Number.isFinite(raw.startSec) ||
    raw.startSec < chapterStartSec - 0.001 ||
    raw.startSec > chapterEndSec + 0.001
  ) {
    throw new Error(`${label}時間碼不在對應章節內。`);
  }
  const children = raw.children ?? [];
  if (!Array.isArray(children) || children.length > maxPointChildren) {
    throw new Error(`${label}的下層項目格式無效。`);
  }
  if (depth >= maxPointDepth && children.length > 0) {
    throw new Error(`${label}超過四層共筆結構。`);
  }
  let previousStartSec = raw.startSec;
  children.forEach((child, childIndex) => {
    validateTimedPointTree(
      child,
      `${label}下層項目 ${childIndex + 1}`,
      chapterStartSec,
      chapterEndSec,
      depth + 1
    );
    if (child.startSec < raw.startSec - 0.001 || child.startSec < previousStartSec - 0.001) {
      throw new Error(`${label}的下層項目時間碼倒序。`);
    }
    previousStartSec = child.startSec;
  });
}

export function convertChapterLectureReview(video, review) {
  if (!video || typeof video !== "object" || Array.isArray(video)) throw new Error("影片資料格式無效。");
  if (!review || typeof review !== "object" || Array.isArray(review)) throw new Error("章節式列點講義必須是 JSON 物件。");
  if (review.schemaVersion !== "1.0.0") throw new Error("章節式列點講義 schemaVersion 必須是 1.0.0。");
  if (review.videoId !== video.videoId) throw new Error("章節式列點講義 videoId 與影片不一致。");
  const expectedFingerprint = captionFingerprint(video.captions ?? []);
  if (review.captionFingerprint !== expectedFingerprint) {
    throw new Error("章節式列點講義不是針對目前這版字幕。");
  }
  if (review.unresolved !== undefined && (!Array.isArray(review.unresolved) || review.unresolved.length > 0)) {
    throw new Error("章節式列點講義仍有待確認內容，不能匯入。");
  }

  const sourceChapters = video.chapters ?? [];
  const captions = video.captions ?? [];
  if (!Array.isArray(review.chapters) || review.chapters.length !== sourceChapters.length) {
    throw new Error(`章節式列點講義必須完整保留 ${sourceChapters.length} 章。`);
  }

  const blocks = [];
  let globalCaptionCursor = 0;
  let blockNumber = 0;
  for (const [chapterIndex, sourceChapter] of sourceChapters.entries()) {
    const rawChapter = review.chapters[chapterIndex];
    const label = `第 ${chapterIndex + 1} 章`;
    if (!rawChapter || typeof rawChapter !== "object" || Array.isArray(rawChapter)) {
      throw new Error(`${label}格式無效。`);
    }
    const chapterId = sourceChapter.id ?? sourceChapter.stableId;
    if (rawChapter.chapterId !== chapterId) throw new Error(`${label} chapterId 與目前章節不一致。`);
    if (!sameSecond(rawChapter.startSec, sourceChapter.startSec) || !sameSecond(rawChapter.endSec, sourceChapter.endSec)) {
      throw new Error(`${label}時間邊界與目前章節不一致。`);
    }
    normalizeText(rawChapter.title, `${label}標題`, 120);
    if (!Array.isArray(rawChapter.sections) || rawChapter.sections.length === 0 || rawChapter.sections.length > 20) {
      throw new Error(`${label}必須有 1 到 20 個分節。`);
    }

    const chapterCaptionStart = globalCaptionCursor;
    while (globalCaptionCursor < captions.length) {
      const captionChapter = chapterForCaption(sourceChapters, captions[globalCaptionCursor]);
      if ((captionChapter?.id ?? captionChapter?.stableId) !== chapterId) break;
      globalCaptionCursor += 1;
    }
    const chapterCaptionEnd = globalCaptionCursor;
    if (chapterCaptionStart === chapterCaptionEnd) throw new Error(`${label}沒有可對應的字幕。`);

    let sectionCaptionCursor = chapterCaptionStart;
    let previousSectionStart = sourceChapter.startSec;
    for (const [sectionIndex, rawSection] of rawChapter.sections.entries()) {
      const sectionLabel = `${label}第 ${sectionIndex + 1} 節`;
      if (!rawSection || typeof rawSection !== "object" || Array.isArray(rawSection)) {
        throw new Error(`${sectionLabel}格式無效。`);
      }
      const rawTitle = normalizeText(rawSection.title, `${sectionLabel}標題`, 120);
      const title = stripSectionNumber(rawTitle);
      if (!title) throw new Error(`${sectionLabel}標題格式無效。`);
      if (
        typeof rawSection.startSec !== "number" ||
        !Number.isFinite(rawSection.startSec) ||
        rawSection.startSec < sourceChapter.startSec - 0.001 ||
        rawSection.startSec >= sourceChapter.endSec ||
        rawSection.startSec < previousSectionStart - 0.001
      ) {
        throw new Error(`${sectionLabel}時間碼無效或倒序。`);
      }
      previousSectionStart = rawSection.startSec;

      if (!Array.isArray(rawSection.points) || rawSection.points.length === 0 || rawSection.points.length > 12) {
        throw new Error(`${sectionLabel}必須有 1 到 12 個重點。`);
      }
      let previousPointStart = rawSection.startSec;
      rawSection.points.forEach((point, pointIndex) => {
        validateTimedPointTree(
          point,
          `${sectionLabel}第 ${pointIndex + 1} 點`,
          sourceChapter.startSec,
          sourceChapter.endSec
        );
        if (point.startSec < previousPointStart - 0.001) {
          throw new Error(`${sectionLabel}頂層重點時間碼倒序。`);
        }
        previousPointStart = point.startSec;
      });

      const nextSectionStart = rawChapter.sections[sectionIndex + 1]?.startSec ?? sourceChapter.endSec;
      let nextSectionCaptionCursor = sectionCaptionCursor;
      while (
        nextSectionCaptionCursor < chapterCaptionEnd &&
        captionMidpoint(captions[nextSectionCaptionCursor]) < nextSectionStart
      ) {
        nextSectionCaptionCursor += 1;
      }
      if (nextSectionCaptionCursor === sectionCaptionCursor) {
        throw new Error(`${sectionLabel}沒有可對應的字幕。`);
      }
      const startIndex = sectionCaptionCursor;
      const endIndex = nextSectionCaptionCursor - 1;
      const sourceCaptionCount = endIndex - startIndex + 1;
      if (sourceCaptionCount > maxOutlineCaptionSpan) {
        throw new Error(`${sectionLabel}涵蓋 ${sourceCaptionCount} 段字幕，超過 ${maxOutlineCaptionSpan} 段安全上限。`);
      }
      const state = { count: 0 };
      const points = rawSection.points.map((point, pointIndex) => (
        normalizePoint(point, `${sectionLabel}第 ${pointIndex + 1} 點`, 0, state)
      ));
      const tables = normalizeEmbeddedTables(rawSection.tables, sectionLabel);
      blockNumber += 1;
      blocks.push({
        id: `${video.videoId}-lecture-${String(blockNumber).padStart(3, "0")}`,
        chapterId,
        provenance: "teacher",
        type: "bullets",
        title,
        sourceCaptionStart: captions[startIndex].id,
        sourceCaptionEnd: captions[endIndex].id,
        sourceCaptionCount,
        sourceFormat: "timecoded_outline",
        points,
        ...(tables.length > 0 ? { tables } : {})
      });
      sectionCaptionCursor = nextSectionCaptionCursor;
    }
    if (sectionCaptionCursor !== chapterCaptionEnd) {
      throw new Error(`${label}分節未完整涵蓋章內字幕。`);
    }
  }
  if (globalCaptionCursor !== captions.length) {
    throw new Error(`章節式列點講義未涵蓋 ${captions[globalCaptionCursor]?.id ?? "最後一段"} 之後的字幕。`);
  }

  return {
    schemaVersion: "1.0.0",
    videoId: video.videoId,
    captionFingerprint: expectedFingerprint,
    reviewStatus: "lecture_notes_candidate",
    blocks,
    unresolved: []
  };
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
  if (Array.isArray(review.chapters) && !Array.isArray(review.blocks)) {
    review = convertChapterLectureReview(video, review);
  }
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
      if (raw.sourceFormat !== undefined && raw.sourceFormat !== "timecoded_outline") {
        throw new Error(`${label}來源格式無效。`);
      }
      const captionSpanLimit = raw.sourceFormat === "timecoded_outline"
        ? maxOutlineCaptionSpan
        : maxTeacherCaptionSpan;
      if (sourceCaptionCount > captionSpanLimit) {
        throw new Error(`${label}涵蓋 ${sourceCaptionCount} 段字幕，最多只能涵蓋 ${captionSpanLimit} 段；請拆小以便逐段核對。`);
      }
      const chapter = chapterForRange(chapters, captions, startIndex, endIndex);
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
        ...(raw.sourceFormat === "timecoded_outline" ? { sourceFormat: raw.sourceFormat } : {}),
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
  const captionBounds = chapterCaptionBounds(video.chapters ?? [], video.captions ?? []);
  const chapterContext = (video.chapters ?? []).map((chapter) => ({
    id: chapter.id ?? chapter.stableId,
    title: chapter.title,
    startSec: chapter.startSec,
    endSec: chapter.endSec,
    ...captionBounds.get(chapter.id ?? chapter.stableId),
    summary: chapter.summary,
    tags: chapter.tags
  }));
  const captionLines = (video.captions ?? []).map((caption) => JSON.stringify(caption));
  const existingNotes = video.lectureNotes
    ? {
        captionFingerprint: video.lectureNotes.captionFingerprint,
        blocks: video.lectureNotes.blocks
      }
    : null;
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
        title: "酸鹼平衡的基本判讀",
        sourceCaptionStart: video.captions?.[0]?.id ?? "cue-00001",
        sourceCaptionEnd: video.captions?.[1]?.id ?? "cue-00002",
        points: [
          {
            text: "酸鹼平衡由 pH、HCO3- 與 PCO2 共同決定。",
            details: [],
            children: [
              {
                text: "正常血液 pH 約為 7.35–7.45。",
                details: []
              },
              {
                text: "臨床判讀時，HCO3- 主要反映腎臟調節，PCO2 主要反映呼吸調節。",
                details: [],
                kind: "teacher_note"
              }
            ]
          }
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
    "# 老趙解剖學共筆式列點講義完整整理包",
    "",
    "## 請直接貼給 ChatGPT Pro 的完整指令",
    "",
    "你是熟悉臺灣醫學系共筆的資深內容編輯。請把下方完整時間碼字幕整理成像學生團隊實際編寫的共筆式列點講義：有清楚章節、分節與多層清單，語氣自然、精準、可直接閱讀，不像逐字稿摘要或 AI 改寫。講義須依老師實際講述順序呈現，不能只做摘要，也不能漏掉老師講過的內容。",
    "",
    "嚴格規則：",
    "1. 先完整讀完所有章節與字幕，再開始輸出。老師講到的知識、定義、數字、步驟、因果、比較、例子、口訣、例外、否定、提醒、自我修正與考試提示都不可遺漏。",
    "2. 可以刪除語助詞、口頭停頓與完全重複的措辭，但其字幕 ID 仍必須落在某個 teacher 區塊的來源範圍內。老師新講出的每一項資訊都必須實際寫進 points、children、details 或 table，不能只標字幕範圍卻省略內容。",
    `3. 所有 provenance=teacher 的區塊，sourceCaptionStart 到 sourceCaptionEnd 必須依原順序連續、不可重疊、不可跳號；第一個從第一段字幕開始，最後一個涵蓋最後一段字幕。每個 teacher 區塊不得超出章節脈絡列出的 sourceCaptionStart 與 sourceCaptionEnd，且最多涵蓋 ${maxTeacherCaptionSpan} 段字幕；同一主題太長時請拆成連續小區塊，方便逐段核對。`,
    "4. teacher 內容只能來自字幕。請把一般醫學事實直接寫成客觀敘述，不要反覆寫『老師說』『老師指出』『老師提到』。只有老師個人的考試提醒、口訣、臨床提醒、主觀經驗、特殊比喻或自我更正，才使用 kind=teacher_note、exam_focus、mnemonic 或 warning；網站會視情況顯示為〈師說〉、〈考點〉、〈口訣〉或〈注意〉。",
    "5. 若理解該段確實需要背景知識、名詞定義或比較，可新增 provenance=supplement 區塊；必須用 afterBlockId 指向前面的 teacher 區塊，不可填 sourceCaptionStart 或 sourceCaptionEnd。補充可以完整到足以協助理解，但不可取代、刪減或混入 teacher 內容，網站會把它明確標為『補充』。",
    "6. 比較、分類、流程、神經分支、構造關係或容易混淆的內容可用 type=table；其他內容用 type=bullets。表格每列欄數必須與 columns 相同。",
    "7. bullets 必須呈現真正的多層共筆結構：points 是第一層，children 依內容關係往下展開，最多四層。定義下放條件、系統下放構成、機轉下放步驟、比較下放差異；不要把所有內容塞成同一層長段落，也不要為了層級而把一句話拆成零碎片語。details 僅保留相容舊資料，新回覆一律填空陣列並使用 children。",
    "8. 每個 chapterId 對應網站的一個章節標頭，每個 block.title 對應該章內的一個分節標題。標題要像共筆標題，簡短、具體，必要時可中英並列；不要寫『老師這段說明』『本段重點』等空泛標題。",
    "9. kind 只能使用 standard、teacher_note、exam_focus、mnemonic、warning。一般知識省略 kind 或填 standard；不要為了裝飾大量加標記。標記文字本身不要再重複加『老師說』。",
    "10. 所有中文一律使用臺灣繁體中文。醫學英文採常見正確拼字，數字、單位、方向與否定詞不得改動；不確定時不可猜，列入 unresolved。",
    "11. 完成每個 teacher 區塊後，逐段回看 sourceCaptionStart 到 sourceCaptionEnd：逐一確認其中每個定義、數字、方向、因果、條件、例外、舉例、口訣、糾正與提醒，都能在該區塊的 points、children、details 或 table 找到，不可只保留結論。",
    "12. 若任何字幕無法可靠理解，仍要維持完整來源範圍，並把疑點列入 unresolved；不要自行補成看似合理的內容。unresolved 非空時網站會拒絕匯入，之後再由人工聽片確認。",
    "13. 目前逐段核對講義只用來防止遺漏，不可沿用它過多的『老師說』語氣或扁平段落結構；必須重新依共筆邏輯組織。",
    "14. 只輸出一個可解析 JSON 物件，不要 Markdown code fence、前言或結語。",
    "",
    "輸出格式範例：",
    "```json",
    JSON.stringify(example, null, 2),
    "```",
    "",
    ...(existingNotes ? [
      "## 目前逐段核對講義（完整性檢查用）",
      "",
      "這份資料已逐段核對，可用來確認沒有漏掉老師內容；請勿照抄其扁平層級與敘述語氣。",
      "",
      "```json",
      JSON.stringify(existingNotes, null, 2),
      "```",
      ""
    ] : []),
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
