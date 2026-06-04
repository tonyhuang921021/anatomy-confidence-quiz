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
  searchKeywords?: string[];
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
  const rawValue = value ?? "";
  const explicitQuestionLines = rawValue
    .split("\n")
    .filter((line) =>
      /^\s*(?:question\s*links|questionLinks|question_links|related\s*questions|exam\s*questions|相關題目|考古題|題號)\s*[:：]/i.test(line)
    );
  const sourceText = explicitQuestionLines.length > 0 ? explicitQuestionLines.join("\n") : rawValue;
  const cleaned = sourceText
    .replace(/^\s*(?:question\s*links|questionLinks|question_links|related\s*questions|exam\s*questions|相關題目|考古題|題號)\s*[:：]/i, "")
    .replace(/[\[\]"]/g, "")
    .replace(/```/g, "");
  return cleaned
    .split(/[,，、;\n]/)
    .map((questionId) => questionId.trim().replace(/^[-*]\s*/, ""))
    .map((questionId) =>
      questionId.replace(/^\s*(?:question\s*links|questionLinks|question_links|related\s*questions|exam\s*questions|相關題目|考古題|題號)\s*[:：]\s*/i, "")
    )
    .map((questionId) => questionId.replace(/^\d+\.\s*/, ""))
    .filter(Boolean)
    .map((questionId) => ({ questionId, relationType: "related" as const }));
}

export function parseStudyNoteQuestionLinkText(value?: string): StudyNoteQuestionLink[] {
  return parseCommaSeparatedQuestionLinks(value);
}

function parseNoteMetaBlock(rawText: string): Record<string, string> | null {
  const match =
    rawText.match(/^\s*```(?:note-meta|metadata|meta|yaml|yml)\s*([\s\S]*?)```/i) ??
    rawText.match(/^\s*---\s*\n([\s\S]*?)\n---/);
  const rawMetaText = match?.[1] ?? parseLooseNoteMetaText(rawText);
  if (!rawMetaText) return null;

  const metadata: Record<string, string> = {};
  let activeListKey = "";
  rawMetaText.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || /^---+$/.test(trimmed)) return;

    const listMatch = trimmed.match(/^[-*]\s+(.+)$/);
    if (listMatch && activeListKey) {
      metadata[activeListKey] = [metadata[activeListKey], listMatch[1].trim()].filter(Boolean).join("\n");
      return;
    }

    const dividerIndex = trimmed.search(/[:：]/);
    if (dividerIndex <= 0) return;
    const key = normalizeMetadataKey(trimmed.slice(0, dividerIndex).trim());
    const value = trimmed.slice(dividerIndex + 1).trim();
    if (!key) return;

    if (key === "tags" || key === "questionLinks" || key === "searchKeywords") {
      activeListKey = key;
    } else {
      activeListKey = "";
    }

    metadata[key] = metadata[key] ? [metadata[key], value].filter(Boolean).join("\n") : value;
  });
  return Object.keys(metadata).length > 0 ? metadata : null;
}

function parseLooseNoteMetaText(rawText: string) {
  const lines = rawText.trimStart().split("\n");
  const metadataLines: string[] = [];
  let activeListKey = "";
  const allowedKeys = new Set(["title", "subject", "collection", "summary", "tags", "questionLinks", "searchKeywords"]);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (metadataLines.length > 0) break;
      continue;
    }

    if (activeListKey && /^[-*]\s+/.test(trimmed)) {
      metadataLines.push(trimmed);
      continue;
    }

    const dividerIndex = trimmed.search(/[:：]/);
    if (dividerIndex <= 0) break;

    const rawKey = trimmed.slice(0, dividerIndex).trim();
    const normalizedKey = normalizeMetadataKey(rawKey);
    if (!allowedKeys.has(normalizedKey)) break;

    metadataLines.push(trimmed);
    activeListKey = normalizedKey === "tags" || normalizedKey === "questionLinks" || normalizedKey === "searchKeywords" ? normalizedKey : "";
  }

  return metadataLines.length >= 2 ? metadataLines.join("\n") : null;
}

function normalizeMetadataKey(key: string) {
  const compactKey = key
    .trim()
    .replace(/^#+\s*/, "")
    .replace(/["'`]/g, "")
    .replace(/[\s_-]+/g, "")
    .toLowerCase();
  const map: Record<string, string> = {
    標題: "title",
    題名: "title",
    筆記標題: "title",
    科目: "subject",
    學科: "subject",
    主題科目: "subject",
    分類: "collection",
    資料夾: "collection",
    主題分類: "collection",
    集合: "collection",
    摘要: "summary",
    簡介: "summary",
    重點摘要: "summary",
    標籤: "tags",
    關鍵字: "tags",
    相關題目: "questionLinks",
    相關考古題: "questionLinks",
    考古題: "questionLinks",
    題號: "questionLinks",
    搜尋詞: "searchKeywords",
    搜尋關鍵字: "searchKeywords",
    題庫搜尋詞: "searchKeywords",
    題庫搜尋關鍵字: "searchKeywords",
    相關搜尋詞: "searchKeywords",
    category: "collection",
    collectionName: "collection",
    collection_name: "collection",
    folder: "collection",
    topic: "collection",
    keywords: "tags",
    question_links: "questionLinks",
    questionids: "questionLinks",
    questionlinks: "questionLinks",
    relatedquestions: "questionLinks",
    examquestions: "questionLinks",
    pastquestions: "questionLinks",
    searchkeywords: "searchKeywords",
    searchterms: "searchKeywords",
    questionsearchkeywords: "searchKeywords",
    questionkeywords: "searchKeywords"
  };
  const compactMap: Record<string, string> = {
    title: "title",
    notetitle: "title",
    subject: "subject",
    collection: "collection",
    collectionname: "collection",
    category: "collection",
    folder: "collection",
    topic: "collection",
    summary: "summary",
    abstract: "summary",
    tags: "tags",
    keywords: "tags",
    questionlinks: "questionLinks",
    questionids: "questionLinks",
    relatedquestions: "questionLinks",
    examquestions: "questionLinks",
    pastquestions: "questionLinks",
    searchkeywords: "searchKeywords",
    searchterms: "searchKeywords",
    questionsearchkeywords: "searchKeywords",
    questionkeywords: "searchKeywords"
  };
  return map[key] ?? compactMap[compactKey] ?? key;
}

function normalizeMetadataSubject(value?: string): SubjectName | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return trimmed as SubjectName;
}

function parseCommaSeparatedTags(value?: string): StudyNoteTag[] {
  return (value ?? "")
    .replace(/[\[\]"]/g, "")
    .split(/[,，、\n]/)
    .map((tag) => tag.trim().replace(/^[-*]\s*/, ""))
    .filter(Boolean)
    .map((tag) => ({ tag, tagType: "misc" as const, source: "chatgpt_metadata" as const }));
}

function parseCommaSeparatedKeywords(value?: string): string[] {
  return Array.from(
    new Set(
      (value ?? "")
        .replace(/[\[\]"]/g, "")
        .split(/[,，、;\n]/)
        .map((keyword) => keyword.trim().replace(/^[-*]\s*/, ""))
        .filter((keyword) => keyword.length > 0)
    )
  );
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
      questionLinks: parseCommaSeparatedQuestionLinks(noteMeta.questionLinks),
      searchKeywords: parseCommaSeparatedKeywords(noteMeta.searchKeywords)
    };
  }

  const parsed = tryParseJson<Record<string, unknown>>(rawText);
  if (!parsed) return null;
  const parsedMetadata =
    parsed.metadata && typeof parsed.metadata === "object"
      ? (parsed.metadata as Record<string, unknown>)
      : parsed.noteMeta && typeof parsed.noteMeta === "object"
        ? (parsed.noteMeta as Record<string, unknown>)
        : parsed.note_meta && typeof parsed.note_meta === "object"
          ? (parsed.note_meta as Record<string, unknown>)
          : parsed;

  const rawTags = parsedMetadata.tags ?? parsedMetadata.keywords;
  const rawQuestionLinks =
    parsedMetadata.questionLinks ??
    parsedMetadata.question_links ??
    parsedMetadata.questionIds ??
    parsedMetadata.question_ids ??
    parsedMetadata.relatedQuestions ??
    parsedMetadata.related_questions;
  const rawSearchKeywords =
    parsedMetadata.searchKeywords ??
    parsedMetadata.search_keywords ??
    parsedMetadata.searchTerms ??
    parsedMetadata.search_terms ??
    parsedMetadata.questionSearchKeywords ??
    parsedMetadata.question_search_keywords;

  return {
    title: typeof parsedMetadata.title === "string" ? parsedMetadata.title : undefined,
    summary: typeof parsedMetadata.summary === "string" ? parsedMetadata.summary : undefined,
    subject: typeof parsedMetadata.subject === "string" ? (parsedMetadata.subject as SubjectName) : undefined,
    chapter: typeof parsedMetadata.chapter === "string" ? parsedMetadata.chapter : undefined,
    section: typeof parsedMetadata.section === "string" ? parsedMetadata.section : undefined,
    collectionName:
      typeof parsedMetadata.collectionName === "string"
        ? parsedMetadata.collectionName
        : typeof parsedMetadata.collection_name === "string"
          ? parsedMetadata.collection_name
          : typeof parsedMetadata.collection === "string"
            ? parsedMetadata.collection
            : typeof parsedMetadata.category === "string"
              ? parsedMetadata.category
              : typeof parsedMetadata.folder === "string"
                ? parsedMetadata.folder
                : undefined,
    tags: typeof rawTags === "string" ? parseCommaSeparatedTags(rawTags) : normalizeMetadataTags(rawTags),
    questionLinks:
      typeof rawQuestionLinks === "string"
        ? parseCommaSeparatedQuestionLinks(rawQuestionLinks)
        : normalizeMetadataQuestionLinks(rawQuestionLinks),
    searchKeywords:
      typeof rawSearchKeywords === "string"
        ? parseCommaSeparatedKeywords(rawSearchKeywords)
        : Array.isArray(rawSearchKeywords)
          ? parseCommaSeparatedKeywords(rawSearchKeywords.map((value) => String(value)).join("\n"))
          : []
  };
}

function stripJsonStudyNoteWrapper(rawText: string) {
  const parsed = tryParseJson<Record<string, unknown>>(rawText);
  if (!parsed) return null;
  const markdown =
    typeof parsed.rawMarkdown === "string"
      ? parsed.rawMarkdown
      : typeof parsed.raw_markdown === "string"
        ? parsed.raw_markdown
        : typeof parsed.markdown === "string"
          ? parsed.markdown
          : typeof parsed.content === "string"
            ? parsed.content
            : typeof parsed.body === "string"
              ? parsed.body
              : undefined;
  return markdown?.trim() || null;
}

export function stripStudyNoteMetadataBlock(rawText: string) {
  const jsonMarkdown = stripJsonStudyNoteWrapper(rawText);
  if (jsonMarkdown) return jsonMarkdown;

  const fenced = rawText.replace(/^\s*```(?:note-meta|metadata|meta|yaml|yml)\s*[\s\S]*?```\s*/i, "").trim();
  if (fenced !== rawText.trim()) return fenced;

  const frontMatter = rawText.replace(/^\s*---\s*\n[\s\S]*?\n---\s*/i, "").trim();
  if (frontMatter !== rawText.trim()) return frontMatter;

  const looseMeta = parseLooseNoteMetaText(rawText);
  if (!looseMeta) return rawText.trim();

  return rawText.trimStart().slice(looseMeta.length).trim();
}

function isDividerLine(line: string) {
  const trimmed = line.trim();
  return trimmed === "⸻" || (/^[\s\-—–⸻]+$/.test(trimmed) && trimmed.length >= 3);
}

function splitTableCells(line: string) {
  const trimmed = line.trim();
  if (trimmed.includes("\t")) return trimmed.split("\t").map((cell) => cell.trim()).filter(Boolean);
  return trimmed.split(/\s{2,}/).map((cell) => cell.trim()).filter(Boolean);
}

function splitCollapsedPipeTableRows(line: string) {
  const trimmed = line.trim();
  const pipeCandidate = getPipeTableCandidateLine(trimmed);
  if (!pipeCandidate || !pipeCandidate.endsWith("|")) return [line];
  if (!/\|\s+\|/.test(pipeCandidate)) return [line];

  const leadingWhitespace = line.match(/^\s*/)?.[0] ?? "";
  return pipeCandidate
    .replace(/\|\s+\|/g, "|\n|")
    .split("\n")
    .map((row) => `${leadingWhitespace}${row.trim()}`)
    .filter(Boolean);
}

function looksLikePlainTableLine(line: string) {
  const cells = splitTableCells(line);
  return cells.length >= 2 && !line.trim().startsWith("|") && !line.trim().startsWith("*") && !line.trim().startsWith("-");
}

function looksLikeMarkdownPipeTableLine(line: string) {
  const trimmed = getPipeTableCandidateLine(line);
  if (!trimmed) return false;
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return false;
  return trimmed.split("|").filter((cell) => cell.trim()).length >= 2;
}

function getPipeTableCandidateLine(line: string) {
  const trimmed = line.trim();
  if (trimmed.startsWith("|")) return trimmed;
  const withoutHeadingMarker = trimmed.replace(/^#{1,6}\s+/, "");
  return withoutHeadingMarker.startsWith("|") ? withoutHeadingMarker : "";
}

function splitPipeTableCells(line: string) {
  return getPipeTableCandidateLine(line)
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isPipeTableDividerRow(row: string[]) {
  return row.length > 0 && row.every((cell) => /^:?-{3,}:?$/.test(cell.trim()));
}

function getHeadingLevel(line: string, previousLine: string, nextLine: string) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("*") || trimmed.startsWith("-")) return 0;
  if (looksLikeMarkdownPipeTableLine(trimmed)) return 0;
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

function ensureBlankBeforeBlock(output: string[]) {
  if (output.length > 0 && output[output.length - 1].trim()) {
    output.push("");
  }
}

function flushPipeTable(tableRows: string[][], output: string[]) {
  if (tableRows.length === 0) return;
  if (tableRows.length < 2 || tableRows[0].length < 2) {
    tableRows.forEach((row) => output.push(`| ${row.join(" | ")} |`));
    return;
  }

  const [headerRow, maybeDividerRow, ...remainingRows] = tableRows;
  const bodyRows = isPipeTableDividerRow(maybeDividerRow) ? remainingRows : [maybeDividerRow, ...remainingRows];
  const maxColumns = Math.max(headerRow.length, ...bodyRows.map((row) => row.length));
  const normalizeRow = (row: string[]) => {
    const nextRow = [...row];
    while (nextRow.length < maxColumns) nextRow.push("");
    return nextRow.slice(0, maxColumns);
  };

  const normalizedHeader = normalizeRow(headerRow);
  output.push(`| ${normalizedHeader.join(" | ")} |`);
  output.push(`| ${normalizedHeader.map(() => "---").join(" | ")} |`);
  bodyRows.map(normalizeRow).forEach((row) => output.push(`| ${row.join(" | ")} |`));
}

export function normalizeStudyNoteMarkdown(rawText: string) {
  const lines = rawText.replace(/\r\n/g, "\n").split("\n").flatMap(splitCollapsedPipeTableRows);
  const output: string[] = [];
  let tableRows: string[][] = [];
  let pipeTableRows: string[][] = [];

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    const previousLine = lines[index - 1] ?? "";
    const nextLine = lines[index + 1] ?? "";
    const isPipeTableLine = looksLikeMarkdownPipeTableLine(line);

    if (looksLikePlainTableLine(line)) {
      if (pipeTableRows.length > 0) {
        flushPipeTable(pipeTableRows, output);
        pipeTableRows = [];
      }
      tableRows.push(splitTableCells(line));
      return;
    }

    if (tableRows.length > 0) {
      flushTable(tableRows, output);
      tableRows = [];
    }

    if (isPipeTableLine) {
      if (pipeTableRows.length === 0) ensureBlankBeforeBlock(output);
      pipeTableRows.push(splitPipeTableCells(line));
      return;
    }

    if (pipeTableRows.length > 0) {
      flushPipeTable(pipeTableRows, output);
      pipeTableRows = [];
    }

    if (looksLikeMarkdownPipeTableLine(output[output.length - 1] ?? "") && trimmed) {
      output.push("");
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
  if (pipeTableRows.length > 0) {
    flushPipeTable(pipeTableRows, output);
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
