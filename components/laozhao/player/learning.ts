"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getLaoZhaoLocalRepository,
  getLaoZhaoLocalStorageStatus,
  normalizeWatchedRanges,
  subscribeToLaoZhaoLocalChanges,
  subscribeToLaoZhaoLocalStorageStatus
} from "@/lib/laozhao/local";
import type {
  LaoZhaoBookmark,
  LaoZhaoLearningAdapter,
  LaoZhaoLearningSnapshot,
  LaoZhaoTimestampNote
} from "./types";

const EMPTY_SNAPSHOT: LaoZhaoLearningSnapshot = {
  lastPositionSec: 0,
  watchedRanges: [],
  completed: false,
  bookmarks: [],
  notes: []
};

function normalizeTupleRanges(
  ranges: readonly [number, number][],
  durationSec = 0
): Array<[number, number]> {
  return normalizeWatchedRanges(
    ranges.map(([startSec, endSec]) => ({ startSec, endSec })),
    durationSec
  ).map(({ startSec, endSec }) => [startSec, endSec]);
}

const LOCAL_LEARNING_ADAPTER: LaoZhaoLearningAdapter = {
  async load(videoId) {
    const repository = getLaoZhaoLocalRepository();
    const [progress, bookmarks, notes] = await Promise.all([
      repository.getProgress(videoId),
      repository.listBookmarks(videoId),
      repository.listNotes(videoId)
    ]);
    return {
      lastPositionSec: progress?.lastPositionSec ?? 0,
      watchedRanges: (progress?.watchedRanges ?? []).map(
        (range) => [range.startSec, range.endSec] as [number, number]
      ),
      completed: progress?.ended ?? false,
      bookmarks: bookmarks.map((bookmark) => ({
        id: bookmark.id,
        videoId: bookmark.videoId,
        timeSec: bookmark.atSec,
        label: bookmark.label || undefined,
        createdAt: new Date(bookmark.createdAt).toISOString()
      })),
      notes: notes.map((note) => ({
        id: note.id,
        videoId: note.videoId,
        timeSec: note.atSec,
        text: note.body,
        createdAt: new Date(note.createdAt).toISOString(),
        updatedAt: new Date(note.updatedAt).toISOString()
      }))
    };
  },
  async saveProgress(input) {
    await getLaoZhaoLocalRepository().upsertProgress({
      videoId: input.videoId,
      lastPositionSec: input.lastPositionSec,
      durationSec: input.durationSec,
      watchedRanges: input.watchedRanges.map(([startSec, endSec]) => ({ startSec, endSec })),
      ended: input.completed,
      updatedAt: Date.now()
    });
  },
  async saveBookmark(bookmark) {
    await getLaoZhaoLocalRepository().addBookmark({
      id: bookmark.id,
      videoId: bookmark.videoId,
      atSec: bookmark.timeSec,
      label: bookmark.label
    });
  },
  async deleteBookmark({ bookmarkId }) {
    await getLaoZhaoLocalRepository().deleteBookmark(bookmarkId);
  },
  async saveNote(note) {
    await getLaoZhaoLocalRepository().addNote({
      id: note.id,
      videoId: note.videoId,
      atSec: note.timeSec,
      body: note.text
    });
  },
  async deleteNote({ noteId }) {
    await getLaoZhaoLocalRepository().deleteNote(noteId);
  }
};

function normalizeSnapshot(value: Partial<LaoZhaoLearningSnapshot> | null | undefined): LaoZhaoLearningSnapshot {
  const watchedRanges = Array.isArray(value?.watchedRanges)
    ? normalizeTupleRanges(
        value.watchedRanges
          .filter((range): range is [number, number] => Array.isArray(range) && range.length === 2)
          .map(([start, end]) => [Math.max(0, Number(start) || 0), Math.max(0, Number(end) || 0)])
      )
    : [];

  const bookmarks = Array.isArray(value?.bookmarks) ? value.bookmarks.filter(Boolean) : [];
  const notes = Array.isArray(value?.notes) ? value.notes.filter(Boolean) : [];

  return {
    lastPositionSec: Math.max(0, Number(value?.lastPositionSec) || 0),
    watchedRanges,
    completed: Boolean(value?.completed),
    bookmarks,
    notes
  };
}

function makeId(prefix: string, videoId: string) {
  return `${prefix}-${videoId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useLaozhaoLearning(videoId: string, adapter?: LaoZhaoLearningAdapter) {
  const effectiveAdapter = adapter ?? LOCAL_LEARNING_ADAPTER;
  const [snapshot, setSnapshot] = useState<LaoZhaoLearningSnapshot>(EMPTY_SNAPSHOT);
  const [loading, setLoading] = useState(Boolean(effectiveAdapter.load));
  const [loadedVideoId, setLoadedVideoId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [storageStatus, setStorageStatus] = useState(getLaoZhaoLocalStorageStatus);
  const activeVideoIdRef = useRef(videoId);
  activeVideoIdRef.current = videoId;

  useEffect(
    () => subscribeToLaoZhaoLocalStorageStatus(setStorageStatus),
    []
  );

  useEffect(() => {
    let cancelled = false;
    setSnapshot(EMPTY_SNAPSHOT);
    setLoadedVideoId(null);
    setError("");

    if (!effectiveAdapter.load) {
      setLoadedVideoId(videoId);
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    const reloadSnapshot = async (showInitialLoading = false) => {
      if (showInitialLoading) setLoading(true);
      try {
        const stored = await effectiveAdapter.load?.(videoId);
        if (cancelled) return;
        setSnapshot(normalizeSnapshot(stored));
        setLoadedVideoId(videoId);
        setError("");
      } catch (rawError: unknown) {
        if (cancelled) return;
        setSnapshot(EMPTY_SNAPSHOT);
        setLoadedVideoId(videoId);
        setError(rawError instanceof Error ? rawError.message : "本機學習標記載入失敗");
      } finally {
        if (!cancelled && showInitialLoading) setLoading(false);
      }
    };

    void reloadSnapshot(true);

    const unsubscribe = subscribeToLaoZhaoLocalChanges((change) => {
      if (cancelled) return;
      if (change.store === "all" || change.videoId === undefined || change.videoId === videoId) {
        void reloadSnapshot();
      }
    });

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible" || adapter) return;
      void getLaoZhaoLocalRepository()
        .restorePersistentStorage()
        .then(() => reloadSnapshot())
        .catch(() => {
          if (!cancelled) void reloadSnapshot();
        });
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      unsubscribe();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [adapter, effectiveAdapter, videoId]);

  const saveProgress = useCallback(
    async (
      lastPositionSec: number,
      durationSec: number,
      completed = false,
      watchedRanges: readonly [number, number][] = []
    ) => {
      const safePosition = Math.max(0, Math.floor(Number(lastPositionSec) || 0));
      const safeDuration = Math.max(0, Math.floor(Number(durationSec) || 0));
      const nextCompleted = completed || (safeDuration > 0 && safePosition >= safeDuration - 3);
      const normalizedIncomingRanges = normalizeTupleRanges(watchedRanges, safeDuration);
      setSnapshot((current) => {
        if (activeVideoIdRef.current !== videoId) return current;
        return {
          ...current,
          watchedRanges: normalizeTupleRanges(
            [...current.watchedRanges, ...normalizedIncomingRanges],
            safeDuration
          ),
          lastPositionSec: safePosition,
          completed: current.completed || nextCompleted
        };
      });

      try {
        await effectiveAdapter.saveProgress?.({
          videoId,
          lastPositionSec: safePosition,
          durationSec: safeDuration,
          completed: nextCompleted,
          watchedRanges: normalizedIncomingRanges
        });
      } catch (rawError: unknown) {
        setError(rawError instanceof Error ? rawError.message : "進度保存失敗，請稍後再試");
      }
    },
    [effectiveAdapter, videoId]
  );

  const addBookmark = useCallback(
    async (timeSec: number, label?: string) => {
      const now = new Date().toISOString();
      const bookmark: LaoZhaoBookmark = {
        id: makeId("bookmark", videoId),
        videoId,
        timeSec: Math.max(0, Math.floor(Number(timeSec) || 0)),
        label: label?.trim() || undefined,
        createdAt: now
      };
      try {
        await effectiveAdapter.saveBookmark?.(bookmark);
        setSnapshot((current) => activeVideoIdRef.current === videoId
          ? {
              ...current,
              bookmarks: [...current.bookmarks.filter((item) => item.id !== bookmark.id), bookmark]
                .sort((a, b) => a.timeSec - b.timeSec)
            }
          : current);
        const persisted = adapter ? true : getLaoZhaoLocalStorageStatus().mode === "persistent";
        if (!persisted) setError(getLaoZhaoLocalStorageStatus().message);
        else setError("");
        return { bookmark, persisted };
      } catch (rawError: unknown) {
        setError(rawError instanceof Error ? rawError.message : "書籤保存失敗，請稍後再試");
        return null;
      }
    },
    [adapter, effectiveAdapter, videoId]
  );

  const deleteBookmark = useCallback(
    async (bookmarkId: string) => {
      try {
        await effectiveAdapter.deleteBookmark?.({ videoId, bookmarkId });
        setSnapshot((current) => activeVideoIdRef.current === videoId
          ? {
              ...current,
              bookmarks: current.bookmarks.filter((bookmark) => bookmark.id !== bookmarkId)
            }
          : current);
        setError(getLaoZhaoLocalStorageStatus().mode === "memory" ? getLaoZhaoLocalStorageStatus().message : "");
      } catch (rawError: unknown) {
        setError(rawError instanceof Error ? rawError.message : "書籤刪除失敗，請稍後再試");
      }
    },
    [effectiveAdapter, videoId]
  );

  const addNote = useCallback(
    async (timeSec: number, text: string) => {
      const cleanedText = text.trim();
      if (!cleanedText) return null;
      const now = new Date().toISOString();
      const note: LaoZhaoTimestampNote = {
        id: makeId("note", videoId),
        videoId,
        timeSec: Math.max(0, Math.floor(Number(timeSec) || 0)),
        text: cleanedText,
        createdAt: now,
        updatedAt: now
      };
      try {
        await effectiveAdapter.saveNote?.(note);
        setSnapshot((current) => activeVideoIdRef.current === videoId
          ? {
              ...current,
              notes: [note, ...current.notes.filter((item) => item.id !== note.id)]
            }
          : current);
        const persisted = adapter ? true : getLaoZhaoLocalStorageStatus().mode === "persistent";
        if (!persisted) setError(getLaoZhaoLocalStorageStatus().message);
        else setError("");
        return { note, persisted };
      } catch (rawError: unknown) {
        setError(rawError instanceof Error ? rawError.message : "筆記保存失敗，請稍後再試");
        return null;
      }
    },
    [adapter, effectiveAdapter, videoId]
  );

  const deleteNote = useCallback(
    async (noteId: string) => {
      try {
        await effectiveAdapter.deleteNote?.({ videoId, noteId });
        setSnapshot((current) => activeVideoIdRef.current === videoId
          ? {
              ...current,
              notes: current.notes.filter((note) => note.id !== noteId)
            }
          : current);
        setError(getLaoZhaoLocalStorageStatus().mode === "memory" ? getLaoZhaoLocalStorageStatus().message : "");
      } catch (rawError: unknown) {
        setError(rawError instanceof Error ? rawError.message : "筆記刪除失敗，請稍後再試");
      }
    },
    [effectiveAdapter, videoId]
  );

  return {
    snapshot: loadedVideoId === videoId ? snapshot : EMPTY_SNAPSHOT,
    loading: loading || loadedVideoId !== videoId,
    error,
    storageStatus,
    saveProgress,
    addBookmark,
    deleteBookmark,
    addNote,
    deleteNote
  };
}
