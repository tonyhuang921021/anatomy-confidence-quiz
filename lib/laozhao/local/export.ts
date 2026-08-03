import { createLaoZhaoInvalidDataError } from "./errors";
import { normalizeProgressRecord } from "./ranges";
import {
  LAOZHAO_LOCAL_DB_NAME,
  LAOZHAO_LOCAL_DB_VERSION,
  type LaoZhaoBookmarkRecord,
  type LaoZhaoLocalExport,
  type LaoZhaoNoteRecord,
  type LaoZhaoProgressRecord
} from "./types";

function normalizeTimestamp(value: number, fieldName: string) {
  if (!Number.isFinite(value) || value < 0) {
    throw createLaoZhaoInvalidDataError(`${fieldName} 必須是有效時間。`, "export");
  }
  return value;
}

export function createLaoZhaoExportPayload(input: {
  progress: LaoZhaoProgressRecord[];
  bookmarks: LaoZhaoBookmarkRecord[];
  notes: LaoZhaoNoteRecord[];
  exportedAt?: number;
}): LaoZhaoLocalExport {
  const exportedAt = normalizeTimestamp(input.exportedAt ?? Date.now(), "exportedAt");

  return {
    schemaVersion: LAOZHAO_LOCAL_DB_VERSION,
    dbName: LAOZHAO_LOCAL_DB_NAME,
    exportedAt,
    progress: input.progress.map(normalizeProgressRecord),
    bookmarks: input.bookmarks.map((bookmark) => ({ ...bookmark })),
    notes: input.notes.map((note) => ({ ...note }))
  };
}
