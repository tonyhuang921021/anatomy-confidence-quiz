"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  BookmarkPlus,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Save,
  Trash2
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChapterList, formatTime } from "./ChapterList";
import { useLaozhaoLearning } from "./learning";
import type { LaoZhaoChapter, LaoZhaoVideo } from "./content-contract";
import { YouTubePlayer, type LaoZhaoPlayerHandle } from "./YouTubePlayer";
import type { LaoZhaoWatchClientProps } from "./types";

function clampSeconds(value: string | null, durationSec: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.min(Math.floor(parsed), durationSec > 0 ? Math.floor(durationSec) : parsed);
}

function formatDuration(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
  return safeSeconds ? formatTime(safeSeconds) : "時間待同步";
}

function buildWatchHref(videoId: string) {
  return `/courses/laozhao-anatomy/watch/${encodeURIComponent(videoId)}`;
}

function sortVideos(videos: readonly LaoZhaoVideo[]) {
  return [...videos].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}

export function WatchClient({ video, playlist, learningAdapter }: LaoZhaoWatchClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const playerRef = useRef<LaoZhaoPlayerHandle>(null);
  const initialSeekRef = useRef<{ videoId: string; seconds: number } | null>(null);
  const handledRouteSeekRef = useRef<string | null>(null);
  const [currentChapterId, setCurrentChapterId] = useState<string | null>(searchParams.get("chapter"));
  const [draftNote, setDraftNote] = useState("");
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [actionMessage, setActionMessage] = useState("");

  const orderedPlaylist = useMemo(() => sortVideos(playlist), [playlist]);
  const currentIndex = orderedPlaylist.findIndex((item) => item.id === video.id);
  const previousVideo = currentIndex > 0 ? orderedPlaylist[currentIndex - 1] : null;
  const nextVideo = currentIndex >= 0 ? orderedPlaylist[currentIndex + 1] ?? null : null;
  const chapters = useMemo(
    () => (video.chapters ?? []).filter((chapter) => chapter.reviewStatus === "reviewed"),
    [video.chapters]
  );
  const selectedChapter = useMemo(
    () => chapters.find((chapter) => chapter.stableId === searchParams.get("chapter")) ?? null,
    [chapters, searchParams]
  );
  const hasExplicitSeek = selectedChapter !== null || searchParams.has("t");
  const requestedSeekSeconds = selectedChapter?.startSec ?? clampSeconds(searchParams.get("t"), video.durationSec);
  const routeSeekKey = `${video.id}:${selectedChapter?.stableId ?? ""}:${searchParams.get("t") ?? ""}`;
  const learning = useLaozhaoLearning(video.id, learningAdapter);
  if (!learning.loading && initialSeekRef.current?.videoId !== video.id) {
    initialSeekRef.current = {
      videoId: video.id,
      seconds: hasExplicitSeek ? requestedSeekSeconds : learning.snapshot.lastPositionSec
    };
  }
  const initialSeekSeconds = initialSeekRef.current?.videoId === video.id
    ? initialSeekRef.current.seconds
    : requestedSeekSeconds;

  useEffect(() => {
    setCurrentChapterId(selectedChapter?.stableId ?? null);
    if (handledRouteSeekRef.current === null) {
      handledRouteSeekRef.current = routeSeekKey;
      return;
    }
    if (handledRouteSeekRef.current === routeSeekKey) return;
    handledRouteSeekRef.current = routeSeekKey;
    if (hasExplicitSeek) playerRef.current?.seekTo(requestedSeekSeconds);
  }, [hasExplicitSeek, requestedSeekSeconds, routeSeekKey, selectedChapter?.stableId]);

  function showMessage(message: string) {
    setActionMessage(message);
    window.setTimeout(() => setActionMessage(""), 2400);
  }

  function handleChapterSelect(chapter: LaoZhaoChapter) {
    playerRef.current?.seekTo(chapter.startSec);
    setCurrentChapterId(chapter.stableId);
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("t", String(Math.floor(chapter.startSec)));
    nextParams.set("chapter", chapter.stableId);
    router.replace(`${pathname}?${nextParams.toString()}`, { scroll: false });
  }

  async function handleAddBookmark() {
    const seconds = playerRef.current?.getCurrentTime() ?? initialSeekSeconds;
    const chapter = chapters.find((item) => item.stableId === currentChapterId);
    const result = await learning.addBookmark(seconds, chapter?.title);
    if (!result) return;
    showMessage(
      result.persisted
        ? `已記下 ${formatTime(seconds)}`
        : `${formatTime(seconds)} 目前只暫存在這個分頁`
    );
  }

  async function handleSaveNote() {
    if (!draftNote.trim()) return;
    setIsSavingNote(true);
    try {
      const seconds = playerRef.current?.getCurrentTime() ?? initialSeekSeconds;
      const result = await learning.addNote(seconds, draftNote);
      if (!result) return;
      setDraftNote("");
      showMessage(
        result.persisted
          ? `已保存 ${formatTime(seconds)} 的筆記`
          : `${formatTime(seconds)} 的筆記目前只暫存在這個分頁`
      );
    } finally {
      setIsSavingNote(false);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--bg-base)] text-[var(--ink-main)]">
      <header className="border-b border-[var(--line-soft)]">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <Link
              href="/courses/laozhao-anatomy"
              className="inline-flex min-h-10 items-center gap-2 text-sm font-bold text-[var(--brand-deep)] hover:text-[var(--brand-main)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-main)]"
            >
              <ArrowLeft aria-hidden="true" size={18} strokeWidth={2} />
              影片目錄
            </Link>
            <span className="text-sm font-semibold tabular-nums text-[var(--ink-soft)]">
              {currentIndex >= 0 ? `${currentIndex + 1} / ${orderedPlaylist.length}` : "影片"}
            </span>
          </div>
          <div className="mt-7 max-w-4xl">
            <p className="text-xs font-bold text-[var(--brand-main)]">老趙解剖學</p>
            <h1 className="mt-2 text-3xl font-black leading-tight sm:text-4xl">{video.title}</h1>
            <p className="mt-3 text-sm font-semibold text-[var(--ink-soft)]">{formatDuration(video.durationSec)}</p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
          <section className="min-w-0" aria-label="影片播放器">
            {learning.loading ? (
              <div className="aspect-video min-h-[200px] w-full animate-pulse rounded-md bg-slate-200/80 motion-reduce:animate-none" aria-label="正在讀取觀看位置" />
            ) : (
              <YouTubePlayer
                ref={playerRef}
                videoId={video.id}
                title={video.title}
                chapters={chapters}
                initialSeekSeconds={initialSeekSeconds}
                playable={video.status === "available"}
                onChapterChange={(chapter) => setCurrentChapterId(chapter?.stableId ?? null)}
                onProgressCheckpoint={(seconds, duration, completed, watchedRanges) => {
                  void learning.saveProgress(seconds, duration, completed, watchedRanges);
                }}
              />
            )}
          </section>

          <aside className="min-w-0 border-t border-[var(--line-soft)] pt-5 lg:sticky lg:top-6 lg:border-t-0 lg:border-l lg:pl-6 lg:pt-0">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-xl font-black">影片章節</h2>
              <span className="text-xs font-semibold text-[var(--ink-soft)]">{chapters.length} 個</span>
            </div>
            <div className="mt-4 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto lg:pr-1">
              <ChapterList chapters={chapters} currentChapterId={currentChapterId} onSelect={handleChapterSelect} />
            </div>
          </aside>
        </div>

        <section className="mt-10 border-t border-[var(--line-soft)] pt-7" aria-labelledby="learning-marks-heading">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 id="learning-marks-heading" className="text-2xl font-black">書籤與時間筆記</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">只保存在目前瀏覽器，不會寫入刷題紀錄。</p>
            </div>
            <span className="min-h-5 text-sm font-semibold text-[var(--brand-deep)]" aria-live="polite">
              {actionMessage}
            </span>
          </div>

          {learning.storageStatus.mode === "memory" ? (
            <p className="mt-5 border-l-2 border-amber-500 pl-3 text-sm leading-6 text-amber-800" role="status">
              {learning.storageStatus.message}
            </p>
          ) : null}
          {learning.error ? (
            <p className="mt-5 border-l-2 border-rose-500 pl-3 text-sm leading-6 text-rose-700" role="alert">
              {learning.error}
            </p>
          ) : null}

          <div className="mt-6 grid gap-10 lg:grid-cols-2">
            <div className="min-w-0">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-black">時間書籤</h3>
                <button
                  type="button"
                  onClick={() => void handleAddBookmark()}
                  className="inline-flex min-h-10 items-center gap-2 rounded-md bg-[var(--brand-deep)] px-3 py-2 text-sm font-bold text-white hover:bg-[var(--brand-main)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-main)] focus-visible:ring-offset-2"
                >
                  <BookmarkPlus aria-hidden="true" size={17} strokeWidth={2} />
                  記下目前時間
                </button>
              </div>
              {learning.snapshot.bookmarks.length > 0 ? (
                <ul className="mt-4 divide-y divide-[var(--line-soft)] border-y border-[var(--line-soft)]">
                  {learning.snapshot.bookmarks.map((bookmark) => (
                    <li key={bookmark.id} className="flex items-center gap-3 py-3">
                      <button
                        type="button"
                        onClick={() => playerRef.current?.seekTo(bookmark.timeSec)}
                        className="min-w-0 flex-1 text-left text-sm font-semibold text-[var(--brand-deep)] hover:text-[var(--brand-main)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-main)]"
                      >
                        <span className="inline-flex items-center gap-2 font-mono text-xs tabular-nums">
                          <Clock3 aria-hidden="true" size={15} strokeWidth={2} />
                          {formatTime(bookmark.timeSec)}
                        </span>
                        <span className="ml-3">{bookmark.label || "影片標記"}</span>
                      </button>
                      <button
                        type="button"
                        aria-label={`刪除 ${formatTime(bookmark.timeSec)} 書籤`}
                        onClick={() => void learning.deleteBookmark(bookmark.id)}
                        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-[var(--ink-soft)] hover:bg-rose-50 hover:text-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-main)]"
                      >
                        <Trash2 aria-hidden="true" size={17} strokeWidth={2} />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 border-t border-[var(--line-soft)] pt-4 text-sm leading-6 text-[var(--ink-soft)]">還沒有時間書籤。</p>
              )}
            </div>

            <div className="min-w-0">
              <label htmlFor="laozhao-timestamp-note" className="text-lg font-black">新增時間筆記</label>
              <textarea
                id="laozhao-timestamp-note"
                value={draftNote}
                onChange={(event) => setDraftNote(event.target.value)}
                placeholder="寫下這個時間點想回看的內容"
                rows={3}
                className="mt-4 w-full resize-y rounded-md border border-[var(--line-soft)] bg-white/70 px-3 py-2.5 text-sm leading-6 text-[var(--ink-main)] outline-none placeholder:text-[var(--ink-soft)] focus:border-[var(--brand-main)] focus:ring-2 focus:ring-[var(--brand-main)]/20"
              />
              <button
                type="button"
                disabled={!draftNote.trim() || isSavingNote}
                onClick={() => void handleSaveNote()}
                className="mt-2 inline-flex min-h-10 items-center gap-2 rounded-md border border-[var(--line-soft)] bg-white/70 px-3 py-2 text-sm font-bold text-[var(--ink-main)] hover:border-[var(--brand-main)] hover:text-[var(--brand-deep)] disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-main)]"
              >
                <Save aria-hidden="true" size={17} strokeWidth={2} />
                {isSavingNote ? "保存中" : "保存筆記"}
              </button>
              {learning.snapshot.notes.length > 0 ? (
                <ul className="mt-4 divide-y divide-[var(--line-soft)] border-y border-[var(--line-soft)]">
                  {learning.snapshot.notes.map((note) => (
                    <li key={note.id} className="flex items-start gap-3 py-3">
                      <button
                        type="button"
                        onClick={() => playerRef.current?.seekTo(note.timeSec)}
                        className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-main)]"
                      >
                        <span className="font-mono text-xs font-bold tabular-nums text-[var(--brand-main)]">{formatTime(note.timeSec)}</span>
                        <span className="mt-1 block whitespace-pre-wrap text-sm leading-6">{note.text}</span>
                      </button>
                      <button
                        type="button"
                        aria-label={`刪除 ${formatTime(note.timeSec)} 筆記`}
                        onClick={() => void learning.deleteNote(note.id)}
                        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-[var(--ink-soft)] hover:bg-rose-50 hover:text-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-main)]"
                      >
                        <Trash2 aria-hidden="true" size={17} strokeWidth={2} />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        </section>

        <nav className="mt-10 flex items-center justify-between gap-4 border-t border-[var(--line-soft)] pt-6" aria-label="前後影片">
          {previousVideo ? (
            <Link href={buildWatchHref(previousVideo.id)} className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[var(--line-soft)] px-3 py-2 text-sm font-bold hover:border-[var(--brand-main)] hover:text-[var(--brand-deep)]">
              <ChevronLeft aria-hidden="true" size={17} strokeWidth={2} />
              上一支
            </Link>
          ) : <span />}
          {nextVideo ? (
            <Link href={buildWatchHref(nextVideo.id)} className="inline-flex min-h-10 items-center gap-2 rounded-md bg-[var(--brand-deep)] px-3 py-2 text-sm font-bold text-white hover:bg-[var(--brand-main)]">
              下一支
              <ChevronRight aria-hidden="true" size={17} strokeWidth={2} />
            </Link>
          ) : null}
        </nav>
      </div>
    </main>
  );
}
