"use client";

import { Search, X } from "lucide-react";
import { useDeferredValue, useId, useMemo, useState } from "react";

const DEFAULT_WINDOW_RADIUS = 18;
const SEARCH_RESULT_LIMIT = 50;

export type SubtitleCue = {
  id: string;
  startSec: number;
  endSec: number;
  text: string;
};

export type TranscriptPanelProps = {
  cues: readonly SubtitleCue[];
  currentTimeSec: number;
  onSeek: (timeSec: number) => void;
  activeCueId?: string | null;
  chapterTitle?: string;
  className?: string;
};

function normalizeSeconds(value: number) {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function formatTimestamp(value: number) {
  const seconds = Math.floor(normalizeSeconds(value));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
  }
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function findNearestCueIndex(cues: readonly SubtitleCue[], currentTimeSec: number) {
  if (cues.length === 0) return -1;
  const time = normalizeSeconds(currentTimeSec);
  let low = 0;
  let high = cues.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (normalizeSeconds(cues[middle].startSec) <= time) low = middle + 1;
    else high = middle;
  }
  const previousIndex = Math.max(0, low - 1);
  const previous = cues[previousIndex];
  const previousEnd = Math.max(normalizeSeconds(previous.startSec), normalizeSeconds(previous.endSec));
  if (time < previousEnd || low >= cues.length) return previousIndex;
  const next = cues[low];
  return time - previousEnd <= normalizeSeconds(next.startSec) - time ? previousIndex : low;
}

export function TranscriptPanel({
  cues,
  currentTimeSec,
  onSeek,
  activeCueId,
  chapterTitle,
  className
}: TranscriptPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const panelId = useId();
  const titleId = `${panelId}-title`;
  const searchId = `${panelId}-search`;
  const normalizedQuery = deferredSearchQuery.trim().toLocaleLowerCase();
  const cueIndexById = useMemo(
    () => new Map(cues.map((cue, index) => [cue.id, index])),
    [cues]
  );
  const explicitActiveCueIndex = activeCueId ? cueIndexById.get(activeCueId) : undefined;

  const activeCueIndex = useMemo(() => {
    if (explicitActiveCueIndex !== undefined) return explicitActiveCueIndex;
    return findNearestCueIndex(cues, currentTimeSec);
  }, [cues, currentTimeSec, explicitActiveCueIndex]);

  const resolvedActiveCueId = activeCueId ?? cues[activeCueIndex]?.id ?? null;

  const searchMatches = useMemo(() => {
    if (!normalizedQuery) return [];
    return cues.filter((cue) => cue.text.toLocaleLowerCase().includes(normalizedQuery));
  }, [cues, normalizedQuery]);

  const visibleCues = useMemo(() => {
    if (normalizedQuery) return searchMatches.slice(0, SEARCH_RESULT_LIMIT);
    if (activeCueIndex < 0) return [];

    const startIndex = Math.max(0, activeCueIndex - DEFAULT_WINDOW_RADIUS);
    const endIndex = Math.min(cues.length, activeCueIndex + DEFAULT_WINDOW_RADIUS + 1);
    return cues.slice(startIndex, endIndex);
  }, [activeCueIndex, cues, normalizedQuery, searchMatches]);

  const isSearching = normalizedQuery.length > 0;
  const heading = chapterTitle?.trim() || "逐字字幕";
  const rootClassName = [
    "w-full min-w-0 max-w-full overflow-hidden border-y border-[var(--line-soft)] bg-[var(--surface)]",
    className
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={rootClassName} aria-labelledby={titleId}>
      <div className="min-w-0 border-b border-[var(--line-soft)] px-3 py-4 sm:px-4">
        <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <div className="min-w-0">
            <p className="text-xs font-bold tracking-wide text-[var(--brand-main)]">字幕</p>
            <h2 id={titleId} className="mt-1 break-words text-lg font-black leading-7 text-[var(--ink-main)]">
              {heading}
            </h2>
          </div>
          <span className="shrink-0 text-xs font-semibold tabular-nums text-[var(--ink-soft)]">
            {cues.length > 0 ? `${cues.length} 段` : "尚無字幕"}
          </span>
        </div>

        {cues.length > 0 ? (
          <div className="relative mt-4 min-w-0">
            <label htmlFor={searchId} className="sr-only">
              搜尋字幕內容
            </label>
            <Search
              aria-hidden="true"
              size={17}
              strokeWidth={2}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-soft)]"
            />
            <input
              id={searchId}
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape" && searchQuery) setSearchQuery("");
              }}
              placeholder="搜尋字幕"
              className="min-h-11 w-full min-w-0 rounded-md border border-[var(--line-soft)] bg-[var(--surface-muted)] py-2.5 pl-10 pr-11 text-sm text-[var(--ink-main)] outline-none placeholder:text-[var(--ink-soft)] focus:border-[var(--brand-main)] focus:ring-2 focus:ring-[var(--brand-main)]/20"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="清除字幕搜尋"
                title="清除搜尋"
                className="absolute right-1 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-[var(--ink-soft)] hover:bg-[var(--brand-tint)] hover:text-[var(--brand-deep)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-main)]"
              >
                <X aria-hidden="true" size={17} strokeWidth={2} />
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {cues.length === 0 ? (
        <p className="px-3 py-6 text-sm leading-6 text-[var(--ink-soft)] sm:px-4" role="status">
          這支影片目前沒有可用字幕。
        </p>
      ) : isSearching && searchMatches.length === 0 ? (
        <p className="px-3 py-6 text-sm leading-6 text-[var(--ink-soft)] sm:px-4" role="status">
          找不到符合「{searchQuery.trim()}」的字幕。
        </p>
      ) : (
        <div className="min-w-0">
          <p className="px-3 pb-2 pt-3 text-xs font-semibold text-[var(--ink-soft)] sm:px-4" role="status" aria-live="polite">
            {isSearching
              ? searchMatches.length > SEARCH_RESULT_LIMIT
                ? `找到 ${searchMatches.length} 段，顯示前 ${SEARCH_RESULT_LIMIT} 段`
                : `找到 ${searchMatches.length} 段字幕`
              : `顯示目前時間附近字幕，共 ${cues.length} 段`}
          </p>
          <ol aria-label={`${heading}字幕列表`} className="min-w-0 divide-y divide-[var(--line-soft)]">
            {visibleCues.map((cue) => {
              const isActive = cue.id === resolvedActiveCueId;
              return (
                <li key={cue.id} className="min-w-0">
                  <button
                    type="button"
                    aria-current={isActive ? "true" : undefined}
                    aria-label={`${formatTimestamp(cue.startSec)}，${isActive ? "目前字幕，" : ""}${cue.text}`}
                    onClick={() => onSeek(normalizeSeconds(cue.startSec))}
                    className={`flex min-h-14 w-full min-w-0 items-start gap-3 border-l-2 px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-main)] focus-visible:ring-inset motion-reduce:transition-none sm:px-4 ${
                      isActive
                        ? "border-[var(--brand-main)] bg-[var(--brand-tint)] text-[var(--brand-deep)]"
                        : "border-transparent text-[var(--ink-main)] hover:bg-[var(--brand-tint)]/60"
                    }`}
                  >
                    <span aria-hidden="true" className="w-[4.25rem] shrink-0 pt-0.5 font-mono text-xs font-bold tabular-nums text-[var(--brand-main)]">
                      {formatTimestamp(cue.startSec)}
                    </span>
                    <span className="min-w-0 flex-1 break-words whitespace-pre-wrap text-sm leading-6">
                      {cue.text}
                    </span>
                    {isActive ? <span className="sr-only">目前字幕</span> : null}
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </section>
  );
}
