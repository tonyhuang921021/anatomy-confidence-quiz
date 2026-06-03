import type {
  StudyNoteDetail,
  StudyNoteQuestionLink,
  StudyNoteSummary,
  StudyNoteTag,
  StudyNoteTagType,
  SubjectName
} from "@/types/quiz";

export type StudyNoteMetadataInput = {
  title?: string;
  summary?: string;
  subject?: SubjectName;
  chapter?: string;
  section?: string;
  collectionName?: string;
  tags?: StudyNoteTag[];
  questionLinks?: StudyNoteQuestionLink[];
};

export type CreateStudyNoteInput = {
  accessToken?: string | null;
  title: string;
  rawMarkdown: string;
  summary?: string;
  subject?: SubjectName | "";
  chapter?: string;
  section?: string;
  collectionName?: string;
  tags?: StudyNoteTag[];
  questionLinks?: StudyNoteQuestionLink[];
};

export type UpdateStudyNoteInput = CreateStudyNoteInput & {
  id: string;
};

export type LoadStudyNotesInput = {
  accessToken?: string | null;
  search?: string;
  subject?: string;
  tag?: string;
};

export type ReorderStudyNotesInput = {
  accessToken?: string | null;
  orderedIds: string[];
};

export type ToggleStudyNoteStarInput = {
  accessToken?: string | null;
  noteId: string;
  starred: boolean;
};

function tryParseJson<T>(rawText: string): T | null {
  if (!rawText.trim()) return null;

  const cleaned = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}

function normalizeTagType(value?: string): StudyNoteTagType {
  const allowed: StudyNoteTagType[] = [
    "concept",
    "disease",
    "drug",
    "mechanism",
    "anatomy",
    "symptom",
    "treatment",
    "exam_skill",
    "misc"
  ];
  return allowed.includes(value as StudyNoteTagType) ? (value as StudyNoteTagType) : "misc";
}

function normalizeMetadataTags(rawTags: unknown): StudyNoteTag[] {
  if (!Array.isArray(rawTags)) return [];

  const normalized: StudyNoteTag[] = [];
  rawTags.forEach((item) => {
    if (typeof item === "string") {
      const tag = item.trim();
      if (tag) {
        normalized.push({ tag, tagType: "misc", source: "chatgpt_metadata" });
      }
      return;
    }
    if (!item || typeof item !== "object") return;
    const raw = item as Record<string, unknown>;
    const tag = String(raw.tag ?? raw.name ?? "").trim();
    if (!tag) return;
    normalized.push({
      tag,
      tagType: normalizeTagType(String(raw.tagType ?? raw.tag_type ?? "misc")),
      source: "chatgpt_metadata"
    });
  });

  return normalized;
}

function normalizeMetadataQuestionLinks(rawLinks: unknown): StudyNoteQuestionLink[] {
  if (!Array.isArray(rawLinks)) return [];

  return rawLinks
    .map((item) => {
      if (typeof item === "string") {
        const questionId = item.trim();
        return questionId ? { questionId, relationType: "related" as const } : null;
      }
      if (!item || typeof item !== "object") return null;
      const raw = item as Record<string, unknown>;
      const questionId = String(raw.questionId ?? raw.question_id ?? raw.id ?? "").trim();
      if (!questionId) return null;
      const relationType = String(raw.relationType ?? raw.relation_type ?? "related");
      return {
        questionId,
        relationType: ["related", "same_concept", "explains", "practice_target"].includes(relationType)
          ? (relationType as StudyNoteQuestionLink["relationType"])
          : "related",
        confidence: typeof raw.confidence === "number" ? raw.confidence : undefined,
        reason: typeof raw.reason === "string" ? raw.reason : undefined
      };
    })
    .filter((item): item is StudyNoteQuestionLink => Boolean(item));
}

function parseCommaSeparatedQuestionLinks(value?: string): StudyNoteQuestionLink[] {
  return (value ?? "")
    .split(/[,，、\n]/)
    .map((questionId) => questionId.trim())
    .filter(Boolean)
    .map((questionId) => ({ questionId, relationType: "related" as const }));
}

function parseNoteMetaBlock(rawText: string): Record<string, string> | null {
  const match = rawText.match(/```note-meta\s*([\s\S]*?)```/i);
  const rawMetaText = match?.[1] ?? parseLooseNoteMetaText(rawText);
  if (!rawMetaText) return null;

  const metadata: Record<string, string> = {};
  rawMetaText.split("\n").forEach((line) => {
    const dividerIndex = line.search(/[:：]/);
    if (dividerIndex <= 0) return;
    const key = normalizeMetadataKey(line.slice(0, dividerIndex).trim());
    const value = line.slice(dividerIndex + 1).trim();
    if (key && value) metadata[key] = value;
  });
  return Object.keys(metadata).length > 0 ? metadata : null;
}

function parseLooseNoteMetaText(rawText: string) {
  const lines = rawText.trimStart().split("\n");
  const metadataLines: string[] = [];
  const allowedKeys = new Set([
    "title",
    "subject",
    "collection",
    "category",
    "summary",
    "tags",
    "questionLinks",
    "question_links",
    "標題",
    "科目",
    "分類",
    "摘要",
    "標籤",
    "相關題目"
  ]);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (metadataLines.length > 0) break;
      continue;
    }

    const dividerIndex = trimmed.search(/[:：]/);
    if (dividerIndex <= 0) break;

    const rawKey = trimmed.slice(0, dividerIndex).trim();
    if (!allowedKeys.has(rawKey)) break;

    metadataLines.push(trimmed);
  }

  return metadataLines.length >= 2 ? metadataLines.join("\n") : null;
}

function normalizeMetadataKey(key: string) {
  const map: Record<string, string> = {
    標題: "title",
    科目: "subject",
    分類: "collection",
    摘要: "summary",
    標籤: "tags",
    相關題目: "questionLinks",
    category: "collection",
    collectionName: "collection",
    collection_name: "collection",
    question_links: "questionLinks"
  };
  return map[key] ?? key;
}

function normalizeMetadataSubject(value?: string): SubjectName | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return trimmed as SubjectName;
}

function parseCommaSeparatedTags(value?: string): StudyNoteTag[] {
  return (value ?? "")
    .split(/[,，、\n]/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => ({ tag, tagType: "misc" as const, source: "chatgpt_metadata" as const }));
}

export function parseStudyNoteMetadata(rawText: string): StudyNoteMetadataInput | null {
  const noteMeta = parseNoteMetaBlock(rawText);
  if (noteMeta) {
    return {
      title: noteMeta.title,
      summary: noteMeta.summary,
      subject: normalizeMetadataSubject(noteMeta.subject),
      collectionName: noteMeta.collection,
      tags: parseCommaSeparatedTags(noteMeta.tags),
      questionLinks: parseCommaSeparatedQuestionLinks(noteMeta.questionLinks)
    };
  }

  const parsed = tryParseJson<Record<string, unknown>>(rawText);
  if (!parsed) return null;

  return {
    title: typeof parsed.title === "string" ? parsed.title : undefined,
    summary: typeof parsed.summary === "string" ? parsed.summary : undefined,
    subject: typeof parsed.subject === "string" ? (parsed.subject as SubjectName) : undefined,
    chapter: typeof parsed.chapter === "string" ? parsed.chapter : undefined,
    section: typeof parsed.section === "string" ? parsed.section : undefined,
    collectionName:
      typeof parsed.collectionName === "string"
        ? parsed.collectionName
        : typeof parsed.collection_name === "string"
          ? parsed.collection_name
          : undefined,
    tags: normalizeMetadataTags(parsed.tags),
    questionLinks: normalizeMetadataQuestionLinks(parsed.questionLinks ?? parsed.question_links)
  };
}

export function stripStudyNoteMetadataBlock(rawText: string) {
  const fenced = rawText.replace(/```note-meta\s*[\s\S]*?```\s*/i, "").trim();
  if (fenced !== rawText.trim()) return fenced;

  const looseMeta = parseLooseNoteMetaText(rawText);
  if (!looseMeta) return rawText.trim();

  return rawText.trimStart().slice(looseMeta.length).trim();
}

function isDividerLine(line: string) {
  return /^[\s\-—–⸻]+$/.test(line.trim()) && line.trim().length >= 3;
}

function splitTableCells(line: string) {
  const trimmed = line.trim();
  if (trimmed.includes("\t")) return trimmed.split("\t").map((cell) => cell.trim()).filter(Boolean);
  return trimmed.split(/\s{2,}/).map((cell) => cell.trim()).filter(Boolean);
}

function looksLikePlainTableLine(line: string) {
  const cells = splitTableCells(line);
  return cells.length >= 2 && !line.trim().startsWith("|") && !line.trim().startsWith("*") && !line.trim().startsWith("-");
}

function getHeadingLevel(line: string, previousLine: string, nextLine: string) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("*") || trimmed.startsWith("-")) return 0;
  if (trimmed.includes(":") || trimmed.includes("：")) return 0;
  if (looksLikePlainTableLine(trimmed)) return 0;
  if (trimmed.length > 34) return 0;
  if (/^[A-E]\./.test(trimmed)) return 0;
  if (previousLine.trim() && nextLine.trim()) return 0;

  if (/總整理|核心概念|高頻|速背/.test(trimmed)) return 1;
  if (/總表|咽弓|咽囊|咽裂|主動脈弓|疾病|Syndrome|Cyst/.test(trimmed)) return 2;
  return 3;
}

function flushTable(tableRows: string[][], output: string[]) {
  if (tableRows.length < 2) {
    tableRows.forEach((row) => output.push(row.join(" ")));
    return;
  }

  const maxColumns = Math.max(...tableRows.map((row) => row.length));
  const normalizedRows = tableRows.map((row) => {
    const nextRow = [...row];
    while (nextRow.length < maxColumns) nextRow.push("");
    return nextRow;
  });

  output.push(`| ${normalizedRows[0].join(" | ")} |`);
  output.push(`| ${normalizedRows[0].map(() => "---").join(" | ")} |`);
  normalizedRows.slice(1).forEach((row) => output.push(`| ${row.join(" | ")} |`));
}

export function normalizeStudyNoteMarkdown(rawText: string) {
  const lines = rawText.replace(/\r\n/g, "\n").split("\n");
  const output: string[] = [];
  let tableRows: string[][] = [];

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    const previousLine = lines[index - 1] ?? "";
    const nextLine = lines[index + 1] ?? "";

    if (looksLikePlainTableLine(line)) {
      tableRows.push(splitTableCells(line));
      return;
    }

    if (tableRows.length > 0) {
      flushTable(tableRows, output);
      tableRows = [];
    }

    if (isDividerLine(line)) {
      output.push("---");
      return;
    }

    const headingLevel = getHeadingLevel(line, previousLine, nextLine);
    if (headingLevel > 0) {
      output.push(`${"#".repeat(headingLevel)} ${trimmed}`);
      return;
    }

    output.push(line);
  });

  if (tableRows.length > 0) {
    flushTable(tableRows, output);
  }

  return output.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function inferStudyNoteTitle(rawMarkdown: string) {
  const metadataTitle = parseStudyNoteMetadata(rawMarkdown)?.title?.trim();
  if (metadataTitle) return metadataTitle;

  const heading = rawMarkdown.match(/^#\s+(.+)$/m)?.[1]?.trim();
  if (heading) return heading;

  return "未命名學習筆記";
}

function buildAuthHeaders(accessToken?: string | null) {
  return {
    "Content-Type": "application/json",
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
  };
}

async function parseStudyNoteResponse<T>(response: Response) {
  const rawText = await response.text();
  const payload = tryParseJson<T & { ok?: boolean; message?: string }>(rawText);

  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.message || rawText || "學習筆記操作失敗");
  }

  return payload;
}

export async function loadStudyNotes(input: LoadStudyNotesInput): Promise<StudyNoteSummary[]> {
  const params = new URLSearchParams();
  if (input.search?.trim()) params.set("search", input.search.trim());
  if (input.subject?.trim()) params.set("subject", input.subject.trim());
  if (input.tag?.trim()) params.set("tag", input.tag.trim());

  const response = await fetch(`/api/study-notes?${params.toString()}`, {
    headers: buildAuthHeaders(input.accessToken)
  });
  const payload = await parseStudyNoteResponse<{ notes?: StudyNoteSummary[] }>(response);
  return payload.notes ?? [];
}

export async function loadStudyNote(
  id: string,
  accessToken?: string | null
): Promise<StudyNoteDetail> {
  const params = new URLSearchParams({ id });
  const response = await fetch(`/api/study-notes?${params.toString()}`, {
    headers: buildAuthHeaders(accessToken)
  });
  const payload = await parseStudyNoteResponse<{ note?: StudyNoteDetail }>(response);
  if (!payload.note) throw new Error("找不到這篇學習筆記");
  return payload.note;
}

export async function createStudyNote(input: CreateStudyNoteInput): Promise<StudyNoteDetail> {
  const response = await fetch("/api/study-notes", {
    method: "POST",
    headers: buildAuthHeaders(input.accessToken),
    body: JSON.stringify(input)
  });
  const payload = await parseStudyNoteResponse<{ note?: StudyNoteDetail }>(response);
  if (!payload.note) throw new Error("學習筆記建立失敗");
  return payload.note;
}

export async function updateStudyNote(input: UpdateStudyNoteInput): Promise<StudyNoteDetail> {
  const response = await fetch("/api/study-notes", {
    method: "PUT",
    headers: buildAuthHeaders(input.accessToken),
    body: JSON.stringify(input)
  });
  const payload = await parseStudyNoteResponse<{ note?: StudyNoteDetail }>(response);
  if (!payload.note) throw new Error("學習筆記更新失敗");
  return payload.note;
}

export async function deleteStudyNote(id: string, accessToken?: string | null): Promise<void> {
  const params = new URLSearchParams({ id });
  const response = await fetch(`/api/study-notes?${params.toString()}`, {
    method: "DELETE",
    headers: buildAuthHeaders(accessToken)
  });
  await parseStudyNoteResponse<{ deletedId?: string }>(response);
}

export async function reorderStudyNotes(input: ReorderStudyNotesInput): Promise<void> {
  const response = await fetch("/api/study-notes/reorder", {
    method: "POST",
    headers: buildAuthHeaders(input.accessToken),
    body: JSON.stringify({ orderedIds: input.orderedIds })
  });
  await parseStudyNoteResponse<{ updated?: number }>(response);
}

export async function toggleStudyNoteStar(input: ToggleStudyNoteStarInput): Promise<{ starred: boolean }> {
  const response = await fetch("/api/study-notes/star", {
    method: "POST",
    headers: buildAuthHeaders(input.accessToken),
    body: JSON.stringify({ noteId: input.noteId, starred: input.starred })
  });
  const payload = await parseStudyNoteResponse<{ starred?: boolean }>(response);
  return { starred: Boolean(payload.starred) };
}
