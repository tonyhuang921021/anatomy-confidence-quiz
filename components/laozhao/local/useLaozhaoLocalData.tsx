"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getLaoZhaoLocalRepository,
  subscribeToLaoZhaoLocalChanges,
  type LaoZhaoBookmarkInput,
  type LaoZhaoBookmarkPatch,
  type LaoZhaoBookmarkRecord,
  type LaoZhaoLocalError,
  type LaoZhaoLocalExport,
  type LaoZhaoNoteInput,
  type LaoZhaoNotePatch,
  type LaoZhaoNoteRecord,
  type LaoZhaoProgressRecord
} from "@/lib/laozhao/local";

export type UseLaoZhaoLocalDataResult = {
  progress: LaoZhaoProgressRecord | null;
  bookmarks: LaoZhaoBookmarkRecord[];
  notes: LaoZhaoNoteRecord[];
  isLoading: boolean;
  error: LaoZhaoLocalError | Error | null;
  refresh: () => Promise<void>;
  saveProgress: (progress: LaoZhaoProgressRecord) => Promise<LaoZhaoProgressRecord>;
  addBookmark: (input: LaoZhaoBookmarkInput) => Promise<LaoZhaoBookmarkRecord>;
  updateBookmark: (id: string, patch: LaoZhaoBookmarkPatch) => Promise<LaoZhaoBookmarkRecord>;
  deleteBookmark: (id: string) => Promise<void>;
  addNote: (input: LaoZhaoNoteInput) => Promise<LaoZhaoNoteRecord>;
  updateNote: (id: string, patch: LaoZhaoNotePatch) => Promise<LaoZhaoNoteRecord>;
  deleteNote: (id: string) => Promise<void>;
  exportData: () => Promise<LaoZhaoLocalExport>;
  clearAll: () => Promise<void>;
};

export function useLaoZhaoLocalData(videoId?: string): UseLaoZhaoLocalDataResult {
  const repository = useMemo(() => getLaoZhaoLocalRepository(), []);
  const [progress, setProgress] = useState<LaoZhaoProgressRecord | null>(null);
  const [bookmarks, setBookmarks] = useState<LaoZhaoBookmarkRecord[]>([]);
  const [notes, setNotes] = useState<LaoZhaoNoteRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<LaoZhaoLocalError | Error | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const [nextProgress, nextBookmarks, nextNotes] = await Promise.all([
        videoId ? repository.getProgress(videoId) : Promise.resolve(null),
        repository.listBookmarks(videoId),
        repository.listNotes(videoId)
      ]);
      setProgress(nextProgress);
      setBookmarks(nextBookmarks);
      setNotes(nextNotes);
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError : new Error("本機資料讀取失敗。"));
    } finally {
      setIsLoading(false);
    }
  }, [repository, videoId]);

  useEffect(() => {
    let active = true;
    void refresh();
    const unsubscribe = subscribeToLaoZhaoLocalChanges((change) => {
      if (!active) return;
      if (
        change.store === "all" ||
        videoId === undefined ||
        change.videoId === undefined ||
        change.videoId === videoId
      ) {
        void refresh();
      }
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [refresh, videoId]);

  const saveProgress = useCallback(
    async (nextProgress: LaoZhaoProgressRecord) => {
      try {
        const saved = await repository.upsertProgress(nextProgress);
        if (saved.videoId === videoId) setProgress(saved);
        setError(null);
        return saved;
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError : new Error("本機進度保存失敗。"));
        throw nextError;
      }
    },
    [repository, videoId]
  );

  const runMutation = useCallback(
    async <T,>(mutation: () => Promise<T>) => {
      try {
        const result = await mutation();
        setError(null);
        await refresh();
        return result;
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError : new Error("本機資料保存失敗。"));
        throw nextError;
      }
    },
    [refresh]
  );

  const addBookmark = useCallback(
    (input: LaoZhaoBookmarkInput) => runMutation(() => repository.addBookmark(input)),
    [repository, runMutation]
  );
  const updateBookmark = useCallback(
    (id: string, patch: LaoZhaoBookmarkPatch) => runMutation(() => repository.updateBookmark(id, patch)),
    [repository, runMutation]
  );
  const deleteBookmark = useCallback(
    (id: string) => runMutation(() => repository.deleteBookmark(id)),
    [repository, runMutation]
  );
  const addNote = useCallback(
    (input: LaoZhaoNoteInput) => runMutation(() => repository.addNote(input)),
    [repository, runMutation]
  );
  const updateNote = useCallback(
    (id: string, patch: LaoZhaoNotePatch) => runMutation(() => repository.updateNote(id, patch)),
    [repository, runMutation]
  );
  const deleteNote = useCallback(
    (id: string) => runMutation(() => repository.deleteNote(id)),
    [repository, runMutation]
  );
  const exportData = useCallback(() => runMutation(() => repository.exportData()), [repository, runMutation]);
  const clearAll = useCallback(() => runMutation(() => repository.clearAll()), [repository, runMutation]);

  return {
    progress,
    bookmarks,
    notes,
    isLoading,
    error,
    refresh,
    saveProgress,
    addBookmark,
    updateBookmark,
    deleteBookmark,
    addNote,
    updateNote,
    deleteNote,
    exportData,
    clearAll
  };
}
