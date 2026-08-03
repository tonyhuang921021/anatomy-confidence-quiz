const SENTENCE_ENDING_PATTERN = /(?:[。！？!?；;]|…+|\.{1,})$/u;
const TRAILING_CLOSER_PATTERN = /[\s"'`’”」』）】〉》»]+$/u;
const NO_SPACE_BEFORE_PATTERN = /^[,.;:!?%)}\]，。！？；：、]/u;
const NO_SPACE_AFTER_PATTERN = /[(\[{「『“‘[，。！？；：、]$/u;
const HAN_CHAR_PATTERN = /\p{Script=Han}/u;

export const DEFAULT_CAPTION_COMPRESSION_OPTIONS = Object.freeze({
  maxGapSec: 0.35,
  maxDurationSec: 6,
  maxTextLength: 48,
  maxPauseSec: null,
  respectSentenceEndings: true,
  invalidSegmentPolicy: "skip"
});

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readField(record, names) {
  for (const name of names) {
    if (Object.prototype.hasOwnProperty.call(record, name)) return record[name];
  }
  return undefined;
}

function normalizeText(value) {
  return typeof value === "string"
    ? value.replace(/\s+/gu, " ").trim()
    : "";
}

function codePointLength(value) {
  return Array.from(value).length;
}

export function validateCaptionSegment(segment) {
  const errors = [];
  if (!isRecord(segment)) {
    return { valid: false, errors: ["segment must be an object"], normalized: null };
  }

  const start = readField(segment, ["start", "startSec"]);
  const end = readField(segment, ["end", "endSec"]);
  const text = normalizeText(readField(segment, ["text"]));

  if (typeof start !== "number" || !Number.isFinite(start) || start < 0) {
    errors.push("start must be a finite non-negative number");
  }
  if (typeof end !== "number" || !Number.isFinite(end) || end < 0) {
    errors.push("end must be a finite non-negative number");
  }
  if (typeof start === "number" && typeof end === "number" && Number.isFinite(start) && Number.isFinite(end) && end <= start) {
    errors.push("end must be greater than start");
  }
  if (typeof readField(segment, ["text"]) !== "string") {
    errors.push("text must be a string");
  } else if (!text) {
    errors.push("text must not be empty");
  }

  return {
    valid: errors.length === 0,
    errors,
    normalized: errors.length === 0 ? { start, end, text } : null
  };
}

export function normalizeCaptionSegments(segments, { onInvalid = "skip" } = {}) {
  if (!Array.isArray(segments)) throw new TypeError("segments must be an array");
  if (onInvalid !== "skip" && onInvalid !== "throw") {
    throw new TypeError('onInvalid must be "skip" or "throw"');
  }

  const normalized = [];
  segments.forEach((segment, sourceIndex) => {
    const result = validateCaptionSegment(segment);
    if (!result.valid) {
      if (onInvalid === "throw") {
        throw new TypeError(`Invalid caption segment at index ${sourceIndex}: ${result.errors.join("; ")}`);
      }
      return;
    }
    normalized.push({ ...result.normalized, sourceIndex });
  });

  normalized.sort((left, right) => (
    left.start - right.start ||
    left.end - right.end ||
    left.sourceIndex - right.sourceIndex
  ));
  return normalized;
}

function resolveLimit(value, name, { integer = false } = {}) {
  if (value === Infinity) return value;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative number`);
  }
  if (integer && !Number.isInteger(value)) {
    throw new RangeError(`${name} must be an integer`);
  }
  return value;
}

function resolveCompressionOptions(options) {
  if (!isRecord(options)) throw new TypeError("options must be an object");
  const merged = { ...DEFAULT_CAPTION_COMPRESSION_OPTIONS, ...options };
  const maxPauseSec = merged.maxPauseSec === null
    ? null
    : resolveLimit(merged.maxPauseSec, "maxPauseSec");

  if (typeof merged.respectSentenceEndings !== "boolean") {
    throw new TypeError("respectSentenceEndings must be a boolean");
  }
  if (merged.invalidSegmentPolicy !== "skip" && merged.invalidSegmentPolicy !== "throw") {
    throw new TypeError('invalidSegmentPolicy must be "skip" or "throw"');
  }

  return {
    maxGapSec: resolveLimit(merged.maxGapSec, "maxGapSec"),
    maxDurationSec: resolveLimit(merged.maxDurationSec, "maxDurationSec"),
    maxTextLength: resolveLimit(merged.maxTextLength, "maxTextLength", { integer: true }),
    maxPauseSec,
    respectSentenceEndings: merged.respectSentenceEndings,
    invalidSegmentPolicy: merged.invalidSegmentPolicy
  };
}

export function isSentenceEnding(text) {
  if (typeof text !== "string") return false;
  const withoutClosers = text.trim().replace(TRAILING_CLOSER_PATTERN, "");
  return SENTENCE_ENDING_PATTERN.test(withoutClosers);
}

function joinCaptionText(left, right) {
  if (!left) return right;
  if (!right) return left;
  if (NO_SPACE_BEFORE_PATTERN.test(right) || NO_SPACE_AFTER_PATTERN.test(left)) {
    return `${left}${right}`;
  }
  const leftEndsInHan = HAN_CHAR_PATTERN.test(Array.from(left).at(-1) ?? "");
  const rightStartsInHan = HAN_CHAR_PATTERN.test(Array.from(right)[0] ?? "");
  if (leftEndsInHan && rightStartsInHan) return `${left}${right}`;
  return `${left} ${right}`;
}

function createAccumulator(segment) {
  return {
    start: segment.start,
    end: segment.end,
    text: segment.text,
    sourceIndices: [segment.sourceIndex],
    sourceSegmentStart: segment.sourceIndex,
    sourceSegmentEnd: segment.sourceIndex
  };
}

function appendToAccumulator(accumulator, segment, text) {
  accumulator.end = Math.max(accumulator.end, segment.end);
  accumulator.text = text;
  accumulator.sourceIndices.push(segment.sourceIndex);
  accumulator.sourceSegmentStart = Math.min(accumulator.sourceSegmentStart, segment.sourceIndex);
  accumulator.sourceSegmentEnd = Math.max(accumulator.sourceSegmentEnd, segment.sourceIndex);
}

function toMilliseconds(seconds) {
  return Math.round(seconds * 1000);
}

function padded(value, width) {
  return String(value).padStart(width, "0");
}

export function createStableCueId(cue) {
  if (!isRecord(cue) || typeof cue.start !== "number" || typeof cue.end !== "number") {
    throw new TypeError("cue must contain numeric start and end values");
  }
  if (!Number.isInteger(cue.sourceSegmentStart) || !Number.isInteger(cue.sourceSegmentEnd)) {
    throw new TypeError("cue must contain source segment bounds");
  }
  return [
    "cue",
    padded(toMilliseconds(cue.start), 9),
    padded(toMilliseconds(cue.end), 9),
    `s${padded(cue.sourceSegmentStart, 6)}`,
    `e${padded(cue.sourceSegmentEnd, 6)}`
  ].join("-");
}

function finalizeAccumulator(accumulator) {
  const sourceSegmentIndices = [...accumulator.sourceIndices].sort((left, right) => left - right);
  const cue = {
    id: "",
    start: accumulator.start,
    end: accumulator.end,
    text: accumulator.text,
    sourceSegmentStart: accumulator.sourceSegmentStart,
    sourceSegmentEnd: accumulator.sourceSegmentEnd,
    sourceSegmentCount: sourceSegmentIndices.length,
    sourceSegmentIndices
  };
  return { ...cue, id: createStableCueId(cue) };
}

function canMerge(accumulator, segment, options) {
  const gap = Math.max(0, segment.start - accumulator.end);
  const gapLimit = options.maxPauseSec === null
    ? options.maxGapSec
    : Math.min(options.maxGapSec, options.maxPauseSec);
  if (gap > gapLimit) return false;
  if (options.respectSentenceEndings && isSentenceEnding(accumulator.text)) return false;

  const mergedEnd = Math.max(accumulator.end, segment.end);
  if (mergedEnd - accumulator.start > options.maxDurationSec) return false;

  const mergedText = joinCaptionText(accumulator.text, segment.text);
  return codePointLength(mergedText) <= options.maxTextLength;
}

export function compressCaptionSegments(segments, options = {}) {
  const resolved = resolveCompressionOptions(options);
  const normalized = normalizeCaptionSegments(segments, { onInvalid: resolved.invalidSegmentPolicy });
  if (normalized.length === 0) return [];

  const cues = [];
  let accumulator = createAccumulator(normalized[0]);
  for (const segment of normalized.slice(1)) {
    const mergedText = joinCaptionText(accumulator.text, segment.text);
    if (canMerge(accumulator, segment, resolved)) {
      appendToAccumulator(accumulator, segment, mergedText);
      continue;
    }
    cues.push(finalizeAccumulator(accumulator));
    accumulator = createAccumulator(segment);
  }
  cues.push(finalizeAccumulator(accumulator));
  return cues;
}

function cueStart(cue) {
  return isRecord(cue) && typeof cue.start === "number" ? cue.start : null;
}

function cueEnd(cue) {
  return isRecord(cue) && typeof cue.end === "number" ? cue.end : null;
}

function cueContainsTime(cue, timeSec) {
  const start = cueStart(cue);
  const end = cueEnd(cue);
  return start !== null && end !== null && start <= timeSec && timeSec < end;
}

export function findCueIndexAtTime(cues, timeSec) {
  if (!Array.isArray(cues) || !Number.isFinite(timeSec) || cues.length === 0) return -1;

  let low = 0;
  let high = cues.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    const start = cueStart(cues[middle]);
    if (start !== null && start <= timeSec) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }

  let index = low - 1;
  if (index < 0) return -1;
  if (cueContainsTime(cues[index], timeSec)) return index;

  // Compression normally produces non-overlapping cues. This small fallback
  // keeps lookup correct when protected sentence endings leave an overlap.
  while (index > 0) {
    index -= 1;
    if (cueContainsTime(cues[index], timeSec)) return index;
  }
  return -1;
}

export function findCueAtTime(cues, timeSec) {
  const index = findCueIndexAtTime(cues, timeSec);
  return index === -1 ? null : cues[index];
}
