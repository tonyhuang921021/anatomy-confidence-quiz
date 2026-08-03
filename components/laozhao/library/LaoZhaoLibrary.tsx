"use client";

import Link from "next/link";
import { ArrowLeft, Bookmark, BookmarkCheck, ExternalLink, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  getLaoZhaoLocalStorageStatus,
  subscribeToLaoZhaoLocalChanges,
  subscribeToLaoZhaoLocalStorageStatus,
  type LaoZhaoProgressRecord
} from "@/lib/laozhao/local";
import type { PublicCourseVideo, PublicCourseView } from "@/lib/laozhao/types";
import { formatDuration, formatRelativeProgress, getThumbnailUrl } from "./format";
import { readLaozhaoLearningSnapshot, type LaoZhaoLearningSnapshot } from "./learning";

const ROUTE_PREFIX = "/courses/laozhao-anatomy/watch";

const EMPTY_LEARNING: LaoZhaoLearningSnapshot = {
  progress: {},
  bookmarkedVideoIds: new Set<string>()
};

function getProgressPercentage(progress: LaoZhaoProgressRecord | undefined) {
  if (!progress || !progress.durationSec || progress.durationSec <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((progress.lastPositionSec / progress.durationSec) * 100)));
}

function getVideoHref(video: PublicCourseVideo) {
  return `${ROUTE_PREFIX}/${encodeURIComponent(video.id)}`;
}

function matchesQuery(video: PublicCourseVideo, query: string) {
  if (!query) return true;
  const haystack = [video.title, ...video.chapters.map((chapter) => chapter.title)]
    .join(" ")
    .toLocaleLowerCase("zh-Hant");
  return haystack.includes(query);
}

export function LaoZhaoLibrary({ course }: { course: PublicCourseView }) {
  const [query, setQuery] = useState("");
  const [onlyBookmarked, setOnlyBookmarked] = useState(false);
  const [learning, setLearning] = useState<LaoZhaoLearningSnapshot>(EMPTY_LEARNING);
  const [learningReady, setLearningReady] = useState(false);
  const [learningError, setLearningError] = useState("");
  const [storageStatus, setStorageStatus] = useState(getLaoZhaoLocalStorageStatus);

  useEffect(() => {
    let active = true;

    const refresh = () => {
      void readLaozhaoLearningSnapshot()
        .then((snapshot) => {
          if (!active) return;
          setLearning(snapshot);
          setLearningError("");
        })
        .catch((error: unknown) => {
          if (!active) return;
          setLearningError(error instanceof Error ? error.message : "本機學習紀錄暫時無法讀取。");
        })
        .finally(() => {
          if (active) setLearningReady(true);
        });
    };

    refresh();
    const unsubscribe = subscribeToLaoZhaoLocalChanges(() => refresh());

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(
    () => subscribeToLaoZhaoLocalStorageStatus(setStorageStatus),
    []
  );

  const filteredVideos = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("zh-Hant");
    return course.videos.filter((video) => {
      if (onlyBookmarked && !learning.bookmarkedVideoIds.has(video.id)) return false;
      return matchesQuery(video, normalizedQuery);
    });
  }, [course.videos, learning.bookmarkedVideoIds, onlyBookmarked, query]);

  const markedCount = course.videos.filter((video) => learning.bookmarkedVideoIds.has(video.id)).length;
  const continueVideo = useMemo(
    () =>
      course.videos
        .map((video) => ({ video, progress: learning.progress[video.id] }))
        .filter(({ progress }) => progress && !progress.ended && progress.lastPositionSec > 0)
        .sort((first, second) => (second.progress?.updatedAt ?? 0) - (first.progress?.updatedAt ?? 0))[0],
    [course.videos, learning.progress]
  );

  return (
    <main className="min-h-screen bg-[var(--bg-base)] text-[var(--ink-main)]">
      <header className="border-b border-slate-200/80 bg-[var(--bg-base)]">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <Link href="/" className="inline-flex min-h-10 items-center gap-2 text-sm font-bold text-[var(--brand-deep)] underline-offset-4 hover:underline">
            <ArrowLeft aria-hidden="true" size={18} strokeWidth={2} />
            回首頁
          </Link>

          <div className="mt-12 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0 max-w-2xl">
              <p className="text-xs font-bold text-[var(--brand-main)]">{course.subtitle}</p>
              <h1 className="mt-3 text-4xl font-black text-[var(--ink-main)] sm:text-5xl">{course.title}</h1>
              <p className="mt-4 max-w-xl text-[15px] leading-7 text-[var(--ink-soft)]">{course.description}</p>
            </div>
            <div className="flex shrink-0 items-center gap-5 border-l-2 border-[var(--brand-main)] pl-4 text-sm font-bold text-[var(--ink-soft)] sm:mb-1">
              <span>{course.videos.length} 部影片</span>
              <span>{markedCount} 個標記</span>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-7 sm:px-6 sm:py-10 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-14">
          <section aria-labelledby="video-list-heading" className="min-w-0">
            <div className="border-t border-slate-200/90 pt-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="flex items-baseline gap-3">
                    <h2 id="video-list-heading" className="text-2xl font-black">全部影片</h2>
                    <span className="text-sm font-bold text-[var(--ink-soft)]">{filteredVideos.length} 部</span>
                  </div>
                  <p className="mt-2 text-sm text-[var(--ink-soft)]">依播放清單順序排列</p>
                </div>
                <button
                  type="button"
                  onClick={() => setOnlyBookmarked((value) => !value)}
                  aria-pressed={onlyBookmarked}
                  className={`inline-flex min-h-10 items-center justify-center gap-2 self-start border px-3 text-sm font-bold transition sm:self-auto ${
                    onlyBookmarked
                      ? "border-[var(--brand-main)] bg-[var(--brand-tint)] text-[var(--brand-deep)]"
                      : "border-slate-200 bg-white/70 text-[var(--ink-soft)] hover:border-[var(--brand-main)] hover:text-[var(--brand-deep)]"
                  } rounded-[6px]`}
                >
                  {onlyBookmarked ? <BookmarkCheck aria-hidden="true" size={17} strokeWidth={2} /> : <Bookmark aria-hidden="true" size={17} strokeWidth={2} />}
                  {onlyBookmarked ? "顯示全部" : "只看我的標記"}
                </button>
              </div>

              <label className="mt-5 flex min-h-12 items-center gap-3 border border-slate-200 bg-white/80 px-4 focus-within:border-[var(--brand-main)] focus-within:ring-2 focus-within:ring-[var(--brand-tint)] rounded-[6px]">
                <Search aria-hidden="true" size={17} strokeWidth={2} className="text-[var(--ink-soft)]" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  type="search"
                  placeholder="搜尋影片或章節"
                  aria-label="搜尋影片或已審核章節"
                  className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-[var(--ink-main)] outline-none placeholder:text-slate-400"
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="inline-flex h-8 w-8 items-center justify-center text-lg font-medium text-[var(--ink-soft)] hover:text-[var(--ink-main)]"
                    aria-label="清除搜尋"
                  >
                    <X aria-hidden="true" size={18} strokeWidth={2} />
                  </button>
                ) : null}
              </label>
            </div>

            {!learningReady ? <p className="mt-5 text-xs text-[var(--ink-soft)]">正在讀取本機標記…</p> : null}
            {learningError ? (
              <p className="mt-5 border-l-2 border-amber-500 pl-3 text-sm leading-6 text-amber-800">
                {learningError}
              </p>
            ) : null}
            {storageStatus.mode === "memory" ? (
              <p className="mt-5 border-l-2 border-amber-500 pl-3 text-sm leading-6 text-amber-800">
                {storageStatus.message}
              </p>
            ) : null}

            {course.videos.length === 0 ? (
              <div className="mt-8 border-t border-slate-200/80 py-12 text-center">
                <h3 className="text-lg font-black">影片清單準備中</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">目前還沒有可顯示的影片資料。</p>
              </div>
            ) : filteredVideos.length === 0 ? (
              <div className="mt-8 border-t border-slate-200/80 py-12 text-center">
                <h3 className="text-lg font-black">找不到符合的影片</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">試試其他關鍵字，或清除目前的標記篩選。</p>
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setOnlyBookmarked(false);
                  }}
                  className="mt-5 border border-[var(--brand-main)] px-4 py-2 text-sm font-bold text-[var(--brand-deep)] hover:bg-[var(--brand-tint)] rounded-[6px]"
                >
                  清除篩選
                </button>
              </div>
            ) : (
              <ol className="mt-7">
                {filteredVideos.map((video) => (
                  <VideoListItem key={video.id} video={video} progress={learning.progress[video.id]} bookmarked={learning.bookmarkedVideoIds.has(video.id)} />
                ))}
              </ol>
            )}
          </section>

          <aside className="min-w-0 lg:sticky lg:top-6 lg:h-fit">
            <section aria-labelledby="continue-heading" className="border-t border-slate-200/90 pt-5">
              <div className="flex items-baseline justify-between gap-3">
                <h2 id="continue-heading" className="text-xl font-black">繼續觀看</h2>
                {continueVideo ? <span className="text-xs font-bold text-[var(--ink-soft)]">最近一次</span> : null}
              </div>
              {continueVideo ? (
                <Link href={getVideoHref(continueVideo.video)} className="mt-5 block border border-[var(--brand-main)] bg-[var(--brand-tint)] p-4 transition hover:bg-white rounded-[6px]">
                  <p className="text-xs font-bold text-[var(--brand-deep)]">第 {continueVideo.video.displayIndex} 部</p>
                  <h3 className="mt-2 line-clamp-2 text-base font-black leading-6">{continueVideo.video.title}</h3>
                  <p className="mt-3 text-xs font-bold text-[var(--ink-soft)]">
                    {formatRelativeProgress(
                      continueVideo.progress?.lastPositionSec ?? 0,
                      continueVideo.progress?.durationSec ?? continueVideo.video.durationSec ?? 0
                    )}
                  </p>
                  <div className="mt-3 h-1 bg-white/80" aria-hidden="true">
                    <span className="block h-full bg-[var(--brand-main)]" style={{ width: `${getProgressPercentage(continueVideo.progress)}%` }} />
                  </div>
                </Link>
              ) : (
                <div className="mt-5 border border-slate-200/90 bg-white/50 p-4 text-sm leading-6 text-[var(--ink-soft)] rounded-[6px]">
                  看過的影片會從這裡接著開始。
                </div>
              )}
            </section>

            <section aria-labelledby="marks-heading" className="mt-9 border-t border-slate-200/90 pt-5">
              <div className="flex items-baseline justify-between gap-3">
                <h2 id="marks-heading" className="text-xl font-black">我的標記</h2>
                <span className="text-sm font-bold text-[var(--ink-soft)]">{markedCount}</span>
              </div>
              <p className="mt-3 text-sm leading-6 text-[var(--ink-soft)]">把想回看的影片留在這裡。</p>
              <button
                type="button"
                onClick={() => setOnlyBookmarked(true)}
                disabled={markedCount === 0}
                className="mt-4 inline-flex min-h-10 items-center border border-slate-200 bg-white/70 px-3 text-sm font-bold text-[var(--brand-deep)] transition hover:border-[var(--brand-main)] disabled:cursor-not-allowed disabled:text-slate-400 rounded-[6px]"
              >
                {markedCount > 0 ? "查看已標記影片" : "還沒有標記"}
              </button>
            </section>

            <section className="mt-9 border-t border-slate-200/90 pt-5">
              <Link href="/courses/laozhao-anatomy/privacy" className="text-sm font-bold text-[var(--brand-deep)] underline-offset-4 hover:underline">
                影片資料與隱私 <ExternalLink aria-hidden="true" className="ml-1 inline" size={15} strokeWidth={2} />
              </Link>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}

function VideoListItem({ video, progress, bookmarked }: { video: PublicCourseVideo; progress: LaoZhaoProgressRecord | undefined; bookmarked: boolean }) {
  const thumbnailUrl = getThumbnailUrl(video);
  const reviewedChapters = video.chapters;
  const progressPercentage = getProgressPercentage(progress);

  return (
    <li className="border-b border-slate-200/80 py-4 first:pt-6 last:pb-0 sm:py-5 sm:first:pt-6">
      <Link href={getVideoHref(video)} className="group grid min-w-0 grid-cols-[7rem_minmax(0,1fr)] gap-4 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-5">
        <div className="relative aspect-video overflow-hidden rounded-[4px] bg-slate-200/80">
          {thumbnailUrl ? <img src={thumbnailUrl} alt="" loading="lazy" className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.02]" /> : <div className="grid h-full place-items-center text-xs font-bold text-slate-500">沒有縮圖</div>}
          <span className="absolute bottom-1 left-1 bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white">{video.displayIndex}</span>
          {progressPercentage > 0 && !progress?.ended ? <span className="absolute inset-x-0 bottom-0 h-1 bg-black/30"><span className="block h-full bg-[var(--brand-main)]" style={{ width: `${progressPercentage}%` }} /></span> : null}
        </div>

        <div className="min-w-0 py-0.5">
          <div className="flex min-w-0 items-start gap-3">
            <h3 className="min-w-0 flex-1 overflow-hidden text-base font-black leading-6 group-hover:text-[var(--brand-deep)] sm:text-lg">{video.title}</h3>
            {bookmarked ? <BookmarkCheck className="shrink-0 text-[var(--brand-main)]" size={17} strokeWidth={2} aria-label="已標記" /> : null}
          </div>
          <p className="mt-2 text-xs font-semibold text-[var(--ink-soft)] sm:text-sm">{reviewedChapters.length > 0 ? reviewedChapters.slice(0, 2).map((chapter) => chapter.title).join(" · ") : "章節整理中"}</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-bold text-[var(--ink-soft)]">
            <span>{formatDuration(video.durationSec)}</span>
            {progress?.ended ? <span className="text-[var(--brand-deep)]">已看完</span> : progressPercentage > 0 ? <span>{progressPercentage}%</span> : null}
          </div>
        </div>
      </Link>
    </li>
  );
}
