import { createHash } from "node:crypto";

const TIME_PATTERN = /^(?:(\d+):)?(\d{1,2}):(\d{1,2})(?:\.(\d+))?$/;
const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const KNOWN_WHISPER_HALLUCINATIONS = new Set([
  "请不吝点赞订阅转发打赏支持明镜与点点栏目",
  "請不吝點讚訂閱轉發打賞支持明鏡與點點欄目"
]);

export function parseCliArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith("--")) continue;
    const key = item.slice(2);
    const next = argv[index + 1];
    args[key] = next && !next.startsWith("--") ? argv[++index] : true;
  }
  return args;
}

export function parseTimeSeconds(value) {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const numeric = Number(trimmed);
  if (Number.isFinite(numeric) && numeric >= 0) return numeric;
  const match = trimmed.match(TIME_PATTERN);
  if (!match) return null;
  const hours = match[1] ? Number(match[1]) : 0;
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  const fraction = match[4] ? Number(`0.${match[4]}`) : 0;
  if (minutes > 59 || seconds > 59) return null;
  return hours * 3600 + minutes * 60 + seconds + fraction;
}

export function formatClock(seconds, includeMillis = false) {
  const safe = Math.max(0, Number(seconds) || 0);
  const whole = Math.floor(safe);
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const secs = whole % 60;
  const base = [hours, minutes, secs].map((value) => String(value).padStart(2, "0")).join(":");
  if (!includeMillis) return base;
  const millis = Math.round((safe - whole) * 1000);
  return `${base}.${String(Math.min(millis, 999)).padStart(3, "0")}`;
}

function asSegmentList(raw) {
  if (Array.isArray(raw)) return raw;
  if (!raw || typeof raw !== "object") return [];
  for (const key of ["segments", "results", "items"]) {
    if (Array.isArray(raw[key])) return raw[key];
  }
  return [];
}

function readField(record, aliases) {
  for (const alias of aliases) {
    if (Object.prototype.hasOwnProperty.call(record, alias)) return record[alias];
  }
  return undefined;
}

export function isLikelyTranscriptLoop(text) {
  if (typeof text !== "string") return false;
  const compact = text.normalize("NFKC").replace(/[\s、，,。！？!?；;：:]+/gu, "");
  if (compact.length < 8) return false;
  const maxUnitLength = Math.min(32, Math.floor(compact.length / 4));
  for (let unitLength = 1; unitLength <= maxUnitLength; unitLength += 1) {
    const unit = compact.slice(0, unitLength);
    const repeatCount = Math.floor(compact.length / unitLength);
    const remainder = compact.length % unitLength;
    const threshold = remainder === 0 ? 4 : 8;
    if (repeatCount < threshold) continue;
    if (`${unit.repeat(repeatCount)}${unit.slice(0, remainder)}` === compact) return true;
  }
  return false;
}

export function isKnownWhisperHallucination(text) {
  if (typeof text !== "string") return false;
  const compact = text.normalize("NFKC").replace(/[\s、，,。！？!?；;：:]+/gu, "");
  return KNOWN_WHISPER_HALLUCINATIONS.has(compact);
}

function compactTranscriptText(text) {
  return String(text ?? "").normalize("NFKC").replace(/[\s、，,。！？!?；;：:]+/gu, "");
}

function hasSuspiciousWhisperSignals(item) {
  const avgLogprob = Number(item?.avg_logprob);
  const compressionRatio = Number(item?.compression_ratio);
  const temperature = Number(item?.temperature);
  return (Number.isFinite(avgLogprob) && avgLogprob <= -1)
    || (Number.isFinite(compressionRatio) && compressionRatio >= 5)
    || (Number.isFinite(temperature) && temperature >= 0.8);
}

export function trimSuspiciousTerminalRepeatRun(segments, { durationSec = null } = {}) {
  if (!Array.isArray(segments) || segments.length < 4 || !Number.isFinite(durationSec)) {
    return { segments, removedCount: 0 };
  }

  const last = segments.at(-1);
  const repeatedText = compactTranscriptText(last?.text);
  if (!repeatedText || repeatedText.length > 8 || last.endSec < durationSec - 2) {
    return { segments, removedCount: 0 };
  }

  let runStart = segments.length - 1;
  while (
    runStart > 0
    && compactTranscriptText(segments[runStart - 1]?.text) === repeatedText
  ) {
    runStart -= 1;
  }

  const run = segments.slice(runStart);
  if (
    run.length < 4
    || run[0].startSec < durationSec - 15
    || !run.every((segment) => segment._whisperSuspicious === true)
  ) {
    return { segments, removedCount: 0 };
  }

  return { segments: segments.slice(0, runStart), removedCount: run.length };
}

export function normalizeTranscriptSegments(raw, { durationSec = null } = {}) {
  const warnings = [];
  const segments = [];
  const source = asSegmentList(raw);

  source.forEach((item, sourceIndex) => {
    if (!item || typeof item !== "object") {
      warnings.push(`第 ${sourceIndex + 1} 段不是物件，已略過。`);
      return;
    }
    const startSec = parseTimeSeconds(readField(item, ["startSec", "start_sec", "start", "timestamp"]));
    const endSec = parseTimeSeconds(readField(item, ["endSec", "end_sec", "end", "finish"]));
    const textValue = readField(item, ["text", "transcript", "content"]);
    const text = typeof textValue === "string"
      ? textValue.normalize("NFKC").replace(/\s+/g, " ").trim()
      : "";
    if (startSec === null || endSec === null || endSec <= startSec || !text) {
      warnings.push(`第 ${sourceIndex + 1} 段缺少有效時間或文字，已略過。`);
      return;
    }
    if (isLikelyTranscriptLoop(text)) {
      warnings.push(`第 ${sourceIndex + 1} 段疑似重複循環幻覺，已略過。`);
      return;
    }
    if (isKnownWhisperHallucination(text)) {
      warnings.push(`第 ${sourceIndex + 1} 段命中已知 Whisper 幻覺，已略過。`);
      return;
    }
    if (durationSec !== null && startSec >= durationSec + 1) {
      warnings.push(`第 ${sourceIndex + 1} 段起點超過影片長度，已略過。`);
      return;
    }
    const clippedEnd = durationSec === null ? endSec : Math.min(endSec, durationSec);
    if (clippedEnd <= startSec) {
      warnings.push(`第 ${sourceIndex + 1} 段不在影片範圍內，已略過。`);
      return;
    }
    segments.push({
      id: "",
      startSec: Math.round(startSec * 1000) / 1000,
      endSec: Math.round(clippedEnd * 1000) / 1000,
      text,
      activeSlideId: null,
      confidence: typeof item.confidence === "number" && Number.isFinite(item.confidence)
        ? Math.max(0, Math.min(1, item.confidence))
        : null,
      reviewStatus: "unreviewed",
      _whisperSuspicious: hasSuspiciousWhisperSignals(item)
    });
  });

  segments.sort((left, right) => left.startSec - right.startSec || left.endSec - right.endSec);
  const terminalTrim = trimSuspiciousTerminalRepeatRun(segments, { durationSec });
  if (terminalTrim.removedCount > 0) {
    warnings.push(`片尾 ${terminalTrim.removedCount} 段短句重複且 Whisper 訊號異常，已略過。`);
    segments.splice(0, segments.length, ...terminalTrim.segments);
  }
  segments.forEach((segment, index) => {
    delete segment._whisperSuspicious;
    segment.id = `seg-${String(index + 1).padStart(5, "0")}`;
    const previous = segments[index - 1];
    if (previous && segment.startSec < previous.endSec) {
      warnings.push(`逐字稿 ${previous.id} 與 ${segment.id} 時間重疊，分章前請人工留意。`);
    }
  });

  if (segments.length === 0) throw new Error("逐字稿沒有可用的時間戳片段。");
  return { segments, warnings };
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function transcriptToVtt(segments) {
  const cues = segments.map((segment, index) => [
    String(index + 1),
    `${formatClock(segment.startSec, true)} --> ${formatClock(segment.endSec, true)}`,
    segment.text
  ].join("\n"));
  return `WEBVTT\n\n${cues.join("\n\n")}\n`;
}

export function transcriptToMarkdown({ videoId, videoTitle, durationSec, sourceFingerprint, segments }) {
  const lines = [
    "# 老趙解剖學分章工作包",
    "",
    `- 影片 ID：\`${videoId}\``,
    `- 影片標題：${videoTitle}`,
    `- 影片長度：${formatClock(durationSec)}`,
    `- 逐字稿指紋：\`${sourceFingerprint}\``,
    "- 狀態：私人、未審核，不可公開",
    "",
    "## 給 Chat 的任務",
    "",
    "請只根據下方逐字稿與時間碼，整理成可供醫學生搜尋與跳轉的章節。不要補寫逐字稿沒有提到的內容。",
    "",
    "規則：",
    "1. 大多數章節長度以 2 到 12 分鐘為目標；明確獨立考點才可更短。",
    "2. 章節標題要是具體的解剖構造、區域、神經血管或臨床定位，不要寫『第一部分』或『繼續說明』。",
    "3. 邊界以老師轉換主題的時間碼為準。不得超出影片長度、重疊或倒序。",
    "4. 聽不清楚或無法確定時，保守命名並在 summary 註明『待人工確認』，不得猜測。",
    "5. representativeFrameTargetSec 請選在該章節接近完整板書、且老師可能已講完主要圖示的時間；不確定可填 null。",
    "6. reviewStatus 一律填 draft。",
    "7. 只輸出一個 JSON 物件，不要加 Markdown code fence 或其他文字。",
    "",
    "輸出格式：",
    "",
    "```json",
    JSON.stringify({
      schemaVersion: "1.0.0",
      videoId,
      sourceFingerprint,
      chapters: [
        {
          title: "具體章節名稱",
          startSec: 0,
          endSec: 180,
          summary: "一到兩句，只整理逐字稿可支持的內容",
          tags: ["解剖區域", "構造或功能"],
          representativeFrameTargetSec: 160,
          reviewStatus: "draft"
        }
      ]
    }, null, 2),
    "```",
    "",
    "## 含時間碼逐字稿",
    ""
  ];

  for (const segment of segments) {
    lines.push(`[${formatClock(segment.startSec)}–${formatClock(segment.endSec)}] ${segment.text}`);
  }
  lines.push("");
  return lines.join("\n");
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function safeText(value, maxLength) {
  if (typeof value !== "string") return "";
  return value.normalize("NFKC").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

export function validateAndNormalizeChapterDraft(draft, transcript) {
  const errors = [];
  const warnings = [];
  if (!isPlainObject(draft)) return { valid: false, errors: ["章節檔必須是 JSON 物件。"], warnings, chapters: [] };
  if (draft.schemaVersion !== "1.0.0") errors.push("schemaVersion 必須是 1.0.0。");
  if (!VIDEO_ID_PATTERN.test(String(draft.videoId ?? ""))) errors.push("videoId 格式無效。");
  if (draft.videoId !== transcript.videoId) errors.push("章節檔的 videoId 與逐字稿不一致。");
  if (draft.sourceFingerprint !== transcript.sourceFingerprint) errors.push("章節檔的逐字稿指紋不一致，可能用了另一版逐字稿。");
  if (!Array.isArray(draft.chapters) || draft.chapters.length === 0) errors.push("chapters 至少要有一個章節。");

  const durationSec = Number(transcript.durationSec);
  const normalized = [];
  if (Array.isArray(draft.chapters)) {
    draft.chapters.forEach((chapter, index) => {
      const label = `第 ${index + 1} 章`;
      if (!isPlainObject(chapter)) {
        errors.push(`${label} 必須是物件。`);
        return;
      }
      const title = safeText(chapter.title, 80);
      const summary = safeText(chapter.summary, 500);
      const startSec = Number(chapter.startSec);
      const endSec = Number(chapter.endSec);
      if (!title) errors.push(`${label}缺少標題。`);
      if (!Number.isInteger(startSec) || startSec < 0) errors.push(`${label} startSec 必須是非負整數秒。`);
      if (!Number.isInteger(endSec) || endSec <= startSec) errors.push(`${label} endSec 必須大於 startSec。`);
      if (Number.isFinite(durationSec) && endSec > durationSec) errors.push(`${label}終點超過影片長度。`);
      if (chapter.reviewStatus !== "draft") errors.push(`${label} reviewStatus 必須是 draft。`);
      const target = chapter.representativeFrameTargetSec;
      const representativeFrameTargetSec = target === null || target === undefined
        ? null
        : Number(target);
      if (
        representativeFrameTargetSec !== null &&
        (!Number.isInteger(representativeFrameTargetSec) ||
          representativeFrameTargetSec < startSec ||
          representativeFrameTargetSec >= endSec)
      ) {
        errors.push(`${label} representativeFrameTargetSec 必須落在章節內或填 null。`);
      }
      const tags = Array.isArray(chapter.tags)
        ? [...new Set(chapter.tags.map((tag) => safeText(tag, 30)).filter(Boolean))].slice(0, 12)
        : [];
      if (endSec - startSec < 30) warnings.push(`${label}短於 30 秒，請確認是否真的是獨立考點。`);
      if (endSec - startSec > 1200) warnings.push(`${label}超過 20 分鐘，請確認是否應再拆分。`);
      normalized.push({
        id: `${draft.videoId}-ch-${String(index + 1).padStart(3, "0")}`,
        position: index,
        videoId: draft.videoId,
        title,
        startSec,
        endSec,
        summary,
        tags,
        representativeFrameTargetSec,
        reviewStatus: "draft",
        rightsStatus: "private_only"
      });
    });
  }

  for (let index = 1; index < normalized.length; index += 1) {
    const previous = normalized[index - 1];
    const current = normalized[index];
    if (current.startSec < previous.startSec) errors.push(`第 ${index + 1} 章未依時間排序。`);
    if (current.startSec < previous.endSec) errors.push(`第 ${index} 章與第 ${index + 1} 章時間重疊。`);
    if (current.startSec - previous.endSec > 120) warnings.push(`第 ${index} 章與第 ${index + 1} 章之間有超過 2 分鐘未分章。`);
  }

  if (normalized[0]?.startSec > 120) warnings.push("影片開頭有超過 2 分鐘未分章。");
  if (Number.isFinite(durationSec) && normalized.at(-1) && durationSec - normalized.at(-1).endSec > 120) {
    warnings.push("影片結尾有超過 2 分鐘未分章。");
  }

  return { valid: errors.length === 0, errors, warnings, chapters: normalized };
}
