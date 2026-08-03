import type {
  ExternalSlideCue,
  ExternalTranscriptCue,
  PrivateImportedContent
} from "../types";

const TIME_PATTERN = /^(?:(\d+):)?(\d{1,2}):(\d{1,2})(?:\.(\d+))?$/;

function parseTime(value: unknown): number | null {
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

function parseCsvRows(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    const next = csv[index + 1];
    if (character === '"') {
      if (quoted && next === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && next === "\n") index += 1;
      row.push(field);
      field = "";
      if (row.some((item) => item.trim() !== "")) rows.push(row);
      row = [];
    } else {
      field += character;
    }
  }
  row.push(field);
  if (row.some((item) => item.trim() !== "")) rows.push(row);
  return rows;
}

function normalizeHeader(value: string): string {
  return value.replace(/^\uFEFF/, "").trim().toLocaleLowerCase("en-US").replace(/[\s-]+/g, "_");
}

function readField(
  row: string[],
  headers: Map<string, number>,
  aliases: string[]
): string | undefined {
  for (const alias of aliases) {
    const index = headers.get(alias);
    if (index !== undefined) return row[index]?.trim();
  }
  return undefined;
}

function readObjectField(record: Record<string, unknown>, aliases: string[]): unknown {
  for (const alias of aliases) {
    if (alias in record) return record[alias];
  }
  return undefined;
}

const TIME_ALIASES = [
  "start_sec",
  "start_seconds",
  "timestamp_sec",
  "time_sec",
  "timestamp",
  "time",
  "start"
];

const END_TIME_ALIASES = ["end_sec", "end_seconds", "finish_sec", "end"];

export function normalizeSlideIndexCsv(
  csv: string,
  options: { videoId: string }
): ExternalSlideCue[] {
  if (!options.videoId.trim()) throw new Error("videoId 不可空白。");
  const rows = parseCsvRows(csv);
  if (rows.length < 2) return [];
  const headers = new Map(rows[0].map((header, index) => [normalizeHeader(header), index]));
  const cues: ExternalSlideCue[] = [];

  for (const row of rows.slice(1)) {
    const startSec = parseTime(readField(row, headers, TIME_ALIASES));
    if (startSec === null) continue;
    const sourcePath = readField(row, headers, ["path", "file", "filename", "image", "image_path"]);
    cues.push({ videoId: options.videoId, startSec, sourcePath: sourcePath || null });
  }
  return cues.sort((left, right) => left.startSec - right.startSec);
}

function asSegmentList(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== "object" || raw === null) return [];
  const record = raw as Record<string, unknown>;
  for (const key of ["segments", "results", "items"]) {
    if (Array.isArray(record[key])) return record[key];
  }
  return [];
}

export function normalizeWhisperJson(
  raw: unknown,
  options: { videoId: string }
): ExternalTranscriptCue[] {
  if (!options.videoId.trim()) throw new Error("videoId 不可空白。");
  const cues: ExternalTranscriptCue[] = [];
  for (const item of asSegmentList(raw)) {
    if (typeof item !== "object" || item === null) continue;
    const record = item as Record<string, unknown>;
    const startSec = parseTime(readObjectField(record, TIME_ALIASES));
    const endSec = parseTime(readObjectField(record, END_TIME_ALIASES));
    const textValue = readObjectField(record, ["text", "transcript", "content"]);
    const text = typeof textValue === "string" ? textValue.trim() : "";
    if (startSec === null || endSec === null || endSec <= startSec || !text) continue;
    cues.push({ videoId: options.videoId, startSec, endSec, text });
  }
  return cues.sort((left, right) => left.startSec - right.startSec);
}

export function importPrivateExternalContent(input: {
  videoId: string;
  slideIndexCsv?: string;
  whisperJson?: unknown;
}): PrivateImportedContent {
  return {
    videoId: input.videoId,
    source: "lecture_slides",
    publishable: false,
    rightsStatus: "private_only",
    slides: input.slideIndexCsv ? normalizeSlideIndexCsv(input.slideIndexCsv, input) : [],
    transcript: input.whisperJson
      ? normalizeWhisperJson(input.whisperJson, input).map((cue) => ({
          ...cue,
          rightsStatus: "private_only" as const
        }))
      : []
  };
}
