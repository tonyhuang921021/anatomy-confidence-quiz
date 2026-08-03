import { publishLaoZhaoLocalChange } from "./channel";
import { clearAllStores, readAllStores, readStore, writeStore } from "./database";
import {
  createLaoZhaoInvalidDataError,
  createLaoZhaoNotFoundError,
  LaoZhaoLocalError
} from "./errors";
import { createLaoZhaoExportPayload } from "./export";
import { createLaoZhaoClientId } from "./ids";
import { mergeProgressRecords, normalizeProgressRecord } from "./ranges";
import {
  type LaoZhaoBookmarkInput,
  type LaoZhaoBookmarkPatch,
  type LaoZhaoBookmarkRecord,
  type LaoZhaoLocalExport,
  type LaoZhaoNoteInput,
  type LaoZhaoNotePatch,
  type LaoZhaoNoteRecord,
  type LaoZhaoProgressRecord
} from "./types";

function normalizeVideoId(videoId: string) {
  const normalized = videoId.trim();
  if (!normalized) throw createLaoZhaoInvalidDataError("videoId 不可為空白。", "write");
  return normalized;
}

function normalizeAtSec(atSec: number) {
  if (!Number.isFinite(atSec) || atSec < 0) {
    throw createLaoZhaoInvalidDataError("atSec 必須是大於等於 0 的有限數字。", "write");
  }
  return atSec;
}

function normalizePlainText(value: string | undefined, fieldName: string) {
  if (value === undefined) return "";
  if (typeof value !== "string") {
    throw createLaoZhaoInvalidDataError(`${fieldName} 必須是純文字。`, "write");
  }
  return value.replace(/\u0000/g, "").replace(/\r\n?/g, "\n").trim();
}

function normalizeId(id: string | undefined, prefix: "bookmark" | "note") {
  if (id === undefined) return createLaoZhaoClientId(prefix);
  const normalized = id.trim();
  if (!normalized) throw createLaoZhaoInvalidDataError("client ID 不可為空白。", "write");
  return normalized;
}

function normalizeStoredId(id: unknown, entity: "書籤" | "筆記") {
  if (typeof id !== "string" || !id.trim()) {
    throw createLaoZhaoInvalidDataError(`本機${entity}的 client ID 無效。`, "read");
  }
  return id.trim();
}

function normalizeStoredTimestamp(value: unknown, fieldName: string) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw createLaoZhaoInvalidDataError(`本機資料的 ${fieldName} 無效。`, "read");
  }
  return value;
}

function normalizeStoredPlainText(value: unknown, fieldName: string) {
  if (typeof value !== "string") {
    throw createLaoZhaoInvalidDataError(`本機資料的 ${fieldName} 必須是純文字。`, "read");
  }
  return normalizePlainText(value, fieldName);
}

function normalizeBookmarkInput(input: LaoZhaoBookmarkInput, now: number): LaoZhaoBookmarkRecord {
  return {
    id: normalizeId(input.id, "bookmark"),
    videoId: normalizeVideoId(input.videoId),
    atSec: normalizeAtSec(input.atSec),
    label: normalizePlainText(input.label, "label"),
    createdAt: now,
    updatedAt: now
  };
}

function normalizeNoteInput(input: LaoZhaoNoteInput, now: number): LaoZhaoNoteRecord {
  return {
    id: normalizeId(input.id, "note"),
    videoId: normalizeVideoId(input.videoId),
    atSec: normalizeAtSec(input.atSec),
    label: normalizePlainText(input.label, "label"),
    body: normalizePlainText(input.body, "body"),
    createdAt: now,
    updatedAt: now
  };
}

function normalizeStoredBookmark(record: LaoZhaoBookmarkRecord): LaoZhaoBookmarkRecord {
  if (!record || typeof record !== "object") {
    throw createLaoZhaoInvalidDataError("本機書籤資料格式無效。", "read");
  }
  return {
    id: normalizeStoredId(record.id, "書籤"),
    videoId: normalizeVideoId(record.videoId),
    atSec: normalizeAtSec(record.atSec),
    label: normalizeStoredPlainText(record.label, "label"),
    createdAt: normalizeStoredTimestamp(record.createdAt, "createdAt"),
    updatedAt: normalizeStoredTimestamp(record.updatedAt, "updatedAt")
  };
}

function normalizeStoredNote(record: LaoZhaoNoteRecord): LaoZhaoNoteRecord {
  if (!record || typeof record !== "object") {
    throw createLaoZhaoInvalidDataError("本機筆記資料格式無效。", "read");
  }
  return {
    id: normalizeStoredId(record.id, "筆記"),
    videoId: normalizeVideoId(record.videoId),
    atSec: normalizeAtSec(record.atSec),
    label: normalizeStoredPlainText(record.label, "label"),
    body: normalizeStoredPlainText(record.body, "body"),
    createdAt: normalizeStoredTimestamp(record.createdAt, "createdAt"),
    updatedAt: normalizeStoredTimestamp(record.updatedAt, "updatedAt")
  };
}

export interface LaoZhaoLocalRepository {
  getProgress(videoId: string): Promise<LaoZhaoProgressRecord | null>;
  listProgress(): Promise<LaoZhaoProgressRecord[]>;
  upsertProgress(progress: LaoZhaoProgressRecord): Promise<LaoZhaoProgressRecord>;
  listBookmarks(videoId?: string): Promise<LaoZhaoBookmarkRecord[]>;
  addBookmark(input: LaoZhaoBookmarkInput): Promise<LaoZhaoBookmarkRecord>;
  updateBookmark(id: string, patch: LaoZhaoBookmarkPatch): Promise<LaoZhaoBookmarkRecord>;
  deleteBookmark(id: string): Promise<void>;
  listNotes(videoId?: string): Promise<LaoZhaoNoteRecord[]>;
  addNote(input: LaoZhaoNoteInput): Promise<LaoZhaoNoteRecord>;
  updateNote(id: string, patch: LaoZhaoNotePatch): Promise<LaoZhaoNoteRecord>;
  deleteNote(id: string): Promise<void>;
  exportData(): Promise<LaoZhaoLocalExport>;
  clearAll(): Promise<void>;
  restorePersistentStorage(): Promise<boolean>;
}

export type LaoZhaoLocalStorageStatus = {
  mode: "persistent" | "memory";
  message: string;
};

const PERSISTENT_STORAGE_STATUS: LaoZhaoLocalStorageStatus = {
  mode: "persistent",
  message: "學習紀錄保存在這台裝置。"
};
const MEMORY_STORAGE_STATUS: LaoZhaoLocalStorageStatus = {
  mode: "memory",
  message: "瀏覽器暫時無法使用本機資料庫；本次瀏覽仍可使用，但關閉分頁後可能不保留。"
};

let localStorageStatus = PERSISTENT_STORAGE_STATUS;
const localStorageStatusListeners = new Set<(status: LaoZhaoLocalStorageStatus) => void>();

function setLocalStorageStatus(status: LaoZhaoLocalStorageStatus) {
  if (localStorageStatus.mode === status.mode && localStorageStatus.message === status.message) return;
  localStorageStatus = status;
  for (const listener of localStorageStatusListeners) listener(status);
}

export function getLaoZhaoLocalStorageStatus() {
  return localStorageStatus;
}

export function subscribeToLaoZhaoLocalStorageStatus(
  listener: (status: LaoZhaoLocalStorageStatus) => void
) {
  localStorageStatusListeners.add(listener);
  return () => {
    localStorageStatusListeners.delete(listener);
  };
}

class IndexedDbLaoZhaoLocalRepository implements LaoZhaoLocalRepository {
  async getProgress(videoId: string) {
    const normalizedVideoId = normalizeVideoId(videoId);
    const value = await readStore<LaoZhaoProgressRecord | undefined>(
      "progress",
      (store) => store.get(normalizedVideoId)
    );
    return value ? normalizeProgressRecord(value) : null;
  }

  async listProgress() {
    const values = await readStore<LaoZhaoProgressRecord[]>("progress", (store) => store.getAll());
    return values.map(normalizeProgressRecord).sort((left, right) => right.updatedAt - left.updatedAt);
  }

  async upsertProgress(progress: LaoZhaoProgressRecord) {
    const normalized = normalizeProgressRecord(progress);
    const merged = await writeStore<LaoZhaoProgressRecord>("progress", (store, setResult, fail) => {
      const request = store.get(normalized.videoId);
      request.onsuccess = () => {
        try {
          const existing = request.result as LaoZhaoProgressRecord | undefined;
          const next = mergeProgressRecords(existing ?? null, normalized);
          setResult(next);
          store.put(next);
        } catch (error) {
          fail(error);
        }
      };
      request.onerror = () => fail(request.error);
    });

    publishLaoZhaoLocalChange({
      store: "progress",
      action: "upsert",
      id: merged.videoId,
      videoId: merged.videoId
    });
    return merged;
  }

  async listBookmarks(videoId?: string) {
    const values = await readStore<LaoZhaoBookmarkRecord[]>("bookmarks", (store) => store.getAll());
    const normalizedVideoId = videoId === undefined ? undefined : normalizeVideoId(videoId);
    return values
      .map(normalizeStoredBookmark)
      .filter((bookmark) => normalizedVideoId === undefined || bookmark.videoId === normalizedVideoId)
      .sort((left, right) => left.atSec - right.atSec || left.createdAt - right.createdAt);
  }

  async addBookmark(input: LaoZhaoBookmarkInput) {
    const record = normalizeBookmarkInput(input, Date.now());
    const saved = await writeStore<LaoZhaoBookmarkRecord>("bookmarks", (store, setResult) => {
      store.add(record);
      setResult(record);
    });
    publishLaoZhaoLocalChange({
      store: "bookmarks",
      action: "upsert",
      id: saved.id,
      videoId: saved.videoId
    });
    return saved;
  }

  async mergeBookmarkSnapshot(record: LaoZhaoBookmarkRecord) {
    const incoming = normalizeStoredBookmark(record);
    return writeStore<LaoZhaoBookmarkRecord>("bookmarks", (store, setResult, fail) => {
      const request = store.get(incoming.id);
      request.onsuccess = () => {
        try {
          const existing = request.result as LaoZhaoBookmarkRecord | undefined;
          const saved = existing && normalizeStoredBookmark(existing).updatedAt > incoming.updatedAt
            ? normalizeStoredBookmark(existing)
            : incoming;
          store.put(saved);
          setResult(saved);
        } catch (error) {
          fail(error);
        }
      };
      request.onerror = () => fail(request.error);
    });
  }

  async deleteBookmarkIfPresent(id: string) {
    const normalizedId = normalizeId(id, "bookmark");
    await writeStore<string>("bookmarks", (store, setResult) => {
      store.delete(normalizedId);
      setResult(normalizedId);
    });
  }

  async updateBookmark(id: string, patch: LaoZhaoBookmarkPatch) {
    const normalizedId = normalizeId(id, "bookmark");
    const now = Date.now();
    const saved = await writeStore<LaoZhaoBookmarkRecord>("bookmarks", (store, setResult, fail) => {
      const request = store.get(normalizedId);
      request.onsuccess = () => {
        try {
          const existing = request.result as LaoZhaoBookmarkRecord | undefined;
          if (!existing) {
            fail(createLaoZhaoNotFoundError("書籤", normalizedId));
            return;
          }
          const normalizedExisting = normalizeStoredBookmark(existing);
          const next: LaoZhaoBookmarkRecord = {
            ...normalizedExisting,
            atSec: patch.atSec === undefined ? normalizedExisting.atSec : normalizeAtSec(patch.atSec),
            label:
              patch.label === undefined
                ? normalizedExisting.label
                : normalizePlainText(patch.label, "label"),
            updatedAt: now
          };
          store.put(next);
          setResult(next);
        } catch (error) {
          fail(error);
        }
      };
      request.onerror = () => fail(request.error);
    });
    publishLaoZhaoLocalChange({
      store: "bookmarks",
      action: "upsert",
      id: saved.id,
      videoId: saved.videoId
    });
    return saved;
  }

  async deleteBookmark(id: string) {
    const normalizedId = normalizeId(id, "bookmark");
    const existing = await writeStore<LaoZhaoBookmarkRecord>("bookmarks", (store, setResult, fail) => {
      const request = store.get(normalizedId);
      request.onsuccess = () => {
        try {
          const record = request.result as LaoZhaoBookmarkRecord | undefined;
          if (!record) {
            fail(createLaoZhaoNotFoundError("書籤", normalizedId));
            return;
          }
          store.delete(normalizedId);
          setResult(normalizeStoredBookmark(record));
        } catch (error) {
          fail(error);
        }
      };
      request.onerror = () => fail(request.error);
    });
    publishLaoZhaoLocalChange({
      store: "bookmarks",
      action: "delete",
      id: normalizedId,
      videoId: existing.videoId
    });
  }

  async listNotes(videoId?: string) {
    const values = await readStore<LaoZhaoNoteRecord[]>("notes", (store) => store.getAll());
    const normalizedVideoId = videoId === undefined ? undefined : normalizeVideoId(videoId);
    return values
      .map(normalizeStoredNote)
      .filter((note) => normalizedVideoId === undefined || note.videoId === normalizedVideoId)
      .sort((left, right) => left.atSec - right.atSec || left.createdAt - right.createdAt);
  }

  async addNote(input: LaoZhaoNoteInput) {
    const record = normalizeNoteInput(input, Date.now());
    const saved = await writeStore<LaoZhaoNoteRecord>("notes", (store, setResult) => {
      store.add(record);
      setResult(record);
    });
    publishLaoZhaoLocalChange({
      store: "notes",
      action: "upsert",
      id: saved.id,
      videoId: saved.videoId
    });
    return saved;
  }

  async mergeNoteSnapshot(record: LaoZhaoNoteRecord) {
    const incoming = normalizeStoredNote(record);
    return writeStore<LaoZhaoNoteRecord>("notes", (store, setResult, fail) => {
      const request = store.get(incoming.id);
      request.onsuccess = () => {
        try {
          const existing = request.result as LaoZhaoNoteRecord | undefined;
          const saved = existing && normalizeStoredNote(existing).updatedAt > incoming.updatedAt
            ? normalizeStoredNote(existing)
            : incoming;
          store.put(saved);
          setResult(saved);
        } catch (error) {
          fail(error);
        }
      };
      request.onerror = () => fail(request.error);
    });
  }

  async deleteNoteIfPresent(id: string) {
    const normalizedId = normalizeId(id, "note");
    await writeStore<string>("notes", (store, setResult) => {
      store.delete(normalizedId);
      setResult(normalizedId);
    });
  }

  async updateNote(id: string, patch: LaoZhaoNotePatch) {
    const normalizedId = normalizeId(id, "note");
    const now = Date.now();
    const saved = await writeStore<LaoZhaoNoteRecord>("notes", (store, setResult, fail) => {
      const request = store.get(normalizedId);
      request.onsuccess = () => {
        try {
          const existing = request.result as LaoZhaoNoteRecord | undefined;
          if (!existing) {
            fail(createLaoZhaoNotFoundError("筆記", normalizedId));
            return;
          }
          const normalizedExisting = normalizeStoredNote(existing);
          const next: LaoZhaoNoteRecord = {
            ...normalizedExisting,
            atSec: patch.atSec === undefined ? normalizedExisting.atSec : normalizeAtSec(patch.atSec),
            label:
              patch.label === undefined
                ? normalizedExisting.label
                : normalizePlainText(patch.label, "label"),
            body:
              patch.body === undefined
                ? normalizedExisting.body
                : normalizePlainText(patch.body, "body"),
            updatedAt: now
          };
          store.put(next);
          setResult(next);
        } catch (error) {
          fail(error);
        }
      };
      request.onerror = () => fail(request.error);
    });
    publishLaoZhaoLocalChange({
      store: "notes",
      action: "upsert",
      id: saved.id,
      videoId: saved.videoId
    });
    return saved;
  }

  async deleteNote(id: string) {
    const normalizedId = normalizeId(id, "note");
    const existing = await writeStore<LaoZhaoNoteRecord>("notes", (store, setResult, fail) => {
      const request = store.get(normalizedId);
      request.onsuccess = () => {
        try {
          const record = request.result as LaoZhaoNoteRecord | undefined;
          if (!record) {
            fail(createLaoZhaoNotFoundError("筆記", normalizedId));
            return;
          }
          store.delete(normalizedId);
          setResult(normalizeStoredNote(record));
        } catch (error) {
          fail(error);
        }
      };
      request.onerror = () => fail(request.error);
    });
    publishLaoZhaoLocalChange({
      store: "notes",
      action: "delete",
      id: normalizedId,
      videoId: existing.videoId
    });
  }

  async exportData() {
    const values = await readAllStores();
    try {
      return createLaoZhaoExportPayload({
        progress: values.progress as LaoZhaoProgressRecord[],
        bookmarks: values.bookmarks as LaoZhaoBookmarkRecord[],
        notes: values.notes as LaoZhaoNoteRecord[]
      });
    } catch (error) {
      throw createLaoZhaoInvalidDataError(
        error instanceof Error ? error.message : "本機資料格式無效，無法匯出。",
        "export"
      );
    }
  }

  async clearAll() {
    await clearAllStores();
    publishLaoZhaoLocalChange({ store: "all", action: "clear" });
  }

  async restorePersistentStorage() {
    await this.listProgress();
    return true;
  }
}

class MemoryLaoZhaoLocalRepository implements LaoZhaoLocalRepository {
  private readonly progress = new Map<string, LaoZhaoProgressRecord>();
  private readonly bookmarks = new Map<string, LaoZhaoBookmarkRecord>();
  private readonly notes = new Map<string, LaoZhaoNoteRecord>();

  seedProgress(records: LaoZhaoProgressRecord[]) {
    for (const record of records) {
      const normalized = normalizeProgressRecord(record);
      const existing = this.progress.get(normalized.videoId);
      this.progress.set(normalized.videoId, mergeProgressRecords(existing, normalized));
    }
  }

  replaceProgress(records: LaoZhaoProgressRecord[]) {
    this.progress.clear();
    this.seedProgress(records);
  }

  replaceProgressForVideo(videoId: string, record: LaoZhaoProgressRecord | null) {
    const normalizedVideoId = normalizeVideoId(videoId);
    this.progress.delete(normalizedVideoId);
    if (record) this.seedProgress([record]);
  }

  seedBookmarks(records: LaoZhaoBookmarkRecord[]) {
    for (const record of records) this.bookmarks.set(record.id, normalizeStoredBookmark(record));
  }

  replaceBookmarks(records: LaoZhaoBookmarkRecord[], videoId?: string) {
    if (videoId === undefined) {
      this.bookmarks.clear();
    } else {
      const normalizedVideoId = normalizeVideoId(videoId);
      for (const [id, record] of this.bookmarks) {
        if (record.videoId === normalizedVideoId) this.bookmarks.delete(id);
      }
    }
    this.seedBookmarks(records);
  }

  seedNotes(records: LaoZhaoNoteRecord[]) {
    for (const record of records) this.notes.set(record.id, normalizeStoredNote(record));
  }

  replaceNotes(records: LaoZhaoNoteRecord[], videoId?: string) {
    if (videoId === undefined) {
      this.notes.clear();
    } else {
      const normalizedVideoId = normalizeVideoId(videoId);
      for (const [id, record] of this.notes) {
        if (record.videoId === normalizedVideoId) this.notes.delete(id);
      }
    }
    this.seedNotes(records);
  }

  removeBookmark(id: string) {
    this.bookmarks.delete(id);
  }

  removeNote(id: string) {
    this.notes.delete(id);
  }

  clearSilently() {
    this.progress.clear();
    this.bookmarks.clear();
    this.notes.clear();
  }

  async getProgress(videoId: string) {
    const record = this.progress.get(normalizeVideoId(videoId));
    return record ? normalizeProgressRecord(record) : null;
  }

  async listProgress() {
    return [...this.progress.values()]
      .map(normalizeProgressRecord)
      .sort((left, right) => right.updatedAt - left.updatedAt);
  }

  async upsertProgress(progress: LaoZhaoProgressRecord) {
    const normalized = normalizeProgressRecord(progress);
    const saved = mergeProgressRecords(this.progress.get(normalized.videoId), normalized);
    this.progress.set(saved.videoId, saved);
    publishLaoZhaoLocalChange({
      store: "progress",
      action: "upsert",
      id: saved.videoId,
      videoId: saved.videoId
    });
    return saved;
  }

  async listBookmarks(videoId?: string) {
    const normalizedVideoId = videoId === undefined ? undefined : normalizeVideoId(videoId);
    return [...this.bookmarks.values()]
      .map(normalizeStoredBookmark)
      .filter((bookmark) => normalizedVideoId === undefined || bookmark.videoId === normalizedVideoId)
      .sort((left, right) => left.atSec - right.atSec || left.createdAt - right.createdAt);
  }

  async addBookmark(input: LaoZhaoBookmarkInput) {
    const saved = normalizeBookmarkInput(input, Date.now());
    if (this.bookmarks.has(saved.id)) throw createLaoZhaoInvalidDataError("書籤 ID 已存在。", "write");
    this.bookmarks.set(saved.id, saved);
    publishLaoZhaoLocalChange({ store: "bookmarks", action: "upsert", id: saved.id, videoId: saved.videoId });
    return saved;
  }

  async updateBookmark(id: string, patch: LaoZhaoBookmarkPatch) {
    const normalizedId = normalizeId(id, "bookmark");
    const existing = this.bookmarks.get(normalizedId);
    if (!existing) throw createLaoZhaoNotFoundError("書籤", normalizedId);
    const saved: LaoZhaoBookmarkRecord = {
      ...normalizeStoredBookmark(existing),
      atSec: patch.atSec === undefined ? existing.atSec : normalizeAtSec(patch.atSec),
      label: patch.label === undefined ? existing.label : normalizePlainText(patch.label, "label"),
      updatedAt: Date.now()
    };
    this.bookmarks.set(saved.id, saved);
    publishLaoZhaoLocalChange({ store: "bookmarks", action: "upsert", id: saved.id, videoId: saved.videoId });
    return saved;
  }

  async deleteBookmark(id: string) {
    const normalizedId = normalizeId(id, "bookmark");
    const existing = this.bookmarks.get(normalizedId);
    if (!existing) throw createLaoZhaoNotFoundError("書籤", normalizedId);
    this.bookmarks.delete(normalizedId);
    publishLaoZhaoLocalChange({ store: "bookmarks", action: "delete", id: normalizedId, videoId: existing.videoId });
  }

  async listNotes(videoId?: string) {
    const normalizedVideoId = videoId === undefined ? undefined : normalizeVideoId(videoId);
    return [...this.notes.values()]
      .map(normalizeStoredNote)
      .filter((note) => normalizedVideoId === undefined || note.videoId === normalizedVideoId)
      .sort((left, right) => left.atSec - right.atSec || left.createdAt - right.createdAt);
  }

  async addNote(input: LaoZhaoNoteInput) {
    const saved = normalizeNoteInput(input, Date.now());
    if (this.notes.has(saved.id)) throw createLaoZhaoInvalidDataError("筆記 ID 已存在。", "write");
    this.notes.set(saved.id, saved);
    publishLaoZhaoLocalChange({ store: "notes", action: "upsert", id: saved.id, videoId: saved.videoId });
    return saved;
  }

  async updateNote(id: string, patch: LaoZhaoNotePatch) {
    const normalizedId = normalizeId(id, "note");
    const existing = this.notes.get(normalizedId);
    if (!existing) throw createLaoZhaoNotFoundError("筆記", normalizedId);
    const saved: LaoZhaoNoteRecord = {
      ...normalizeStoredNote(existing),
      atSec: patch.atSec === undefined ? existing.atSec : normalizeAtSec(patch.atSec),
      label: patch.label === undefined ? existing.label : normalizePlainText(patch.label, "label"),
      body: patch.body === undefined ? existing.body : normalizePlainText(patch.body, "body"),
      updatedAt: Date.now()
    };
    this.notes.set(saved.id, saved);
    publishLaoZhaoLocalChange({ store: "notes", action: "upsert", id: saved.id, videoId: saved.videoId });
    return saved;
  }

  async deleteNote(id: string) {
    const normalizedId = normalizeId(id, "note");
    const existing = this.notes.get(normalizedId);
    if (!existing) throw createLaoZhaoNotFoundError("筆記", normalizedId);
    this.notes.delete(normalizedId);
    publishLaoZhaoLocalChange({ store: "notes", action: "delete", id: normalizedId, videoId: existing.videoId });
  }

  async exportData() {
    return createLaoZhaoExportPayload({
      progress: await this.listProgress(),
      bookmarks: await this.listBookmarks(),
      notes: await this.listNotes()
    });
  }

  async clearAll() {
    this.clearSilently();
    publishLaoZhaoLocalChange({ store: "all", action: "clear" });
  }

  async restorePersistentStorage() {
    return false;
  }
}

function shouldUseMemoryFallback(error: unknown) {
  return (
    error instanceof LaoZhaoLocalError &&
    error.code !== "invalid-data" &&
    error.code !== "not-found"
  );
}

class ResilientLaoZhaoLocalRepository implements LaoZhaoLocalRepository {
  private readonly indexedDb = new IndexedDbLaoZhaoLocalRepository();
  private readonly memory = new MemoryLaoZhaoLocalRepository();
  private memoryOnly = false;
  private nextRecoveryAt = 0;
  private recoveryPromise: Promise<boolean> | null = null;
  private readonly deletedBookmarkIds = new Set<string>();
  private readonly deletedNoteIds = new Set<string>();

  private async recoverPersistentStorage(force = false) {
    if (!this.memoryOnly) return true;
    if (!force && Date.now() < this.nextRecoveryAt) return false;
    if (this.recoveryPromise) return this.recoveryPromise;

    this.recoveryPromise = (async () => {
      try {
        const progress = await this.memory.listProgress();
        const bookmarks = await this.memory.listBookmarks();
        const notes = await this.memory.listNotes();

        for (const record of progress) await this.indexedDb.upsertProgress(record);
        for (const record of bookmarks) await this.indexedDb.mergeBookmarkSnapshot(record);
        for (const record of notes) await this.indexedDb.mergeNoteSnapshot(record);
        for (const id of this.deletedBookmarkIds) await this.indexedDb.deleteBookmarkIfPresent(id);
        for (const id of this.deletedNoteIds) await this.indexedDb.deleteNoteIfPresent(id);

        this.deletedBookmarkIds.clear();
        this.deletedNoteIds.clear();
        this.memoryOnly = false;
        this.nextRecoveryAt = 0;
        setLocalStorageStatus(PERSISTENT_STORAGE_STATUS);
        return true;
      } catch {
        this.memoryOnly = true;
        this.nextRecoveryAt = Date.now() + 5_000;
        setLocalStorageStatus(MEMORY_STORAGE_STATUS);
        return false;
      } finally {
        this.recoveryPromise = null;
      }
    })();

    return this.recoveryPromise;
  }

  private async run<T>(persistent: () => Promise<T>, temporary: () => Promise<T>) {
    if (this.memoryOnly && !(await this.recoverPersistentStorage())) return temporary();
    try {
      const result = await persistent();
      setLocalStorageStatus(PERSISTENT_STORAGE_STATUS);
      return result;
    } catch (error) {
      if (!shouldUseMemoryFallback(error)) throw error;
      this.memoryOnly = true;
      this.nextRecoveryAt = Date.now() + 5_000;
      setLocalStorageStatus(MEMORY_STORAGE_STATUS);
      return temporary();
    }
  }

  async getProgress(videoId: string) {
    return this.run(
      async () => {
        const record = await this.indexedDb.getProgress(videoId);
        this.memory.replaceProgressForVideo(videoId, record);
        return record;
      },
      () => this.memory.getProgress(videoId)
    );
  }

  async listProgress() {
    return this.run(
      async () => {
        const records = await this.indexedDb.listProgress();
        this.memory.replaceProgress(records);
        return records;
      },
      () => this.memory.listProgress()
    );
  }

  async upsertProgress(progress: LaoZhaoProgressRecord) {
    return this.run(
      async () => {
        const saved = await this.indexedDb.upsertProgress(progress);
        this.memory.seedProgress([saved]);
        return saved;
      },
      () => this.memory.upsertProgress(progress)
    );
  }

  async listBookmarks(videoId?: string) {
    return this.run(
      async () => {
        const records = await this.indexedDb.listBookmarks(videoId);
        this.memory.replaceBookmarks(records, videoId);
        return records;
      },
      () => this.memory.listBookmarks(videoId)
    );
  }

  async addBookmark(input: LaoZhaoBookmarkInput) {
    return this.run(
      async () => {
        const saved = await this.indexedDb.addBookmark(input);
        this.memory.seedBookmarks([saved]);
        return saved;
      },
      () => this.memory.addBookmark(input)
    );
  }

  async updateBookmark(id: string, patch: LaoZhaoBookmarkPatch) {
    return this.run(
      async () => {
        const saved = await this.indexedDb.updateBookmark(id, patch);
        this.memory.seedBookmarks([saved]);
        return saved;
      },
      () => this.memory.updateBookmark(id, patch)
    );
  }

  async deleteBookmark(id: string) {
    return this.run(
      async () => {
        await this.indexedDb.deleteBookmark(id);
        this.memory.removeBookmark(id);
      },
      async () => {
        this.memory.removeBookmark(id);
        this.deletedBookmarkIds.add(id);
      }
    );
  }

  async listNotes(videoId?: string) {
    return this.run(
      async () => {
        const records = await this.indexedDb.listNotes(videoId);
        this.memory.replaceNotes(records, videoId);
        return records;
      },
      () => this.memory.listNotes(videoId)
    );
  }

  async addNote(input: LaoZhaoNoteInput) {
    return this.run(
      async () => {
        const saved = await this.indexedDb.addNote(input);
        this.memory.seedNotes([saved]);
        return saved;
      },
      () => this.memory.addNote(input)
    );
  }

  async updateNote(id: string, patch: LaoZhaoNotePatch) {
    return this.run(
      async () => {
        const saved = await this.indexedDb.updateNote(id, patch);
        this.memory.seedNotes([saved]);
        return saved;
      },
      () => this.memory.updateNote(id, patch)
    );
  }

  async deleteNote(id: string) {
    return this.run(
      async () => {
        await this.indexedDb.deleteNote(id);
        this.memory.removeNote(id);
      },
      async () => {
        this.memory.removeNote(id);
        this.deletedNoteIds.add(id);
      }
    );
  }

  async exportData() {
    if (!(await this.recoverPersistentStorage(true))) {
      throw new LaoZhaoLocalError(
        "operation-failed",
        "export",
        "完整本機資料目前無法讀取，因此沒有建立不完整的匯出檔。"
      );
    }
    return this.indexedDb.exportData();
  }

  async clearAll() {
    if (!(await this.recoverPersistentStorage(true))) {
      throw new LaoZhaoLocalError(
        "operation-failed",
        "clear",
        "完整本機資料庫目前無法開啟，因此沒有執行部分刪除。"
      );
    }
    await this.indexedDb.clearAll();
    this.memory.clearSilently();
    this.deletedBookmarkIds.clear();
    this.deletedNoteIds.clear();
  }

  async restorePersistentStorage() {
    if (this.memoryOnly) return this.recoverPersistentStorage(true);
    try {
      await this.indexedDb.restorePersistentStorage();
      setLocalStorageStatus(PERSISTENT_STORAGE_STATUS);
      return true;
    } catch {
      this.memoryOnly = true;
      this.nextRecoveryAt = Date.now() + 5_000;
      setLocalStorageStatus(MEMORY_STORAGE_STATUS);
      return false;
    }
  }
}

let repository: LaoZhaoLocalRepository | null = null;

export function getLaoZhaoLocalRepository() {
  if (!repository) repository = new ResilientLaoZhaoLocalRepository();
  return repository;
}

export function createLaoZhaoLocalRepository() {
  return new ResilientLaoZhaoLocalRepository();
}

export function resetLaoZhaoLocalRepositoryForTests() {
  repository = null;
  localStorageStatus = PERSISTENT_STORAGE_STATUS;
}
