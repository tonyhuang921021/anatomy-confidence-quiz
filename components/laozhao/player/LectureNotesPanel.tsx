"use client";

import { Clock3 } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import type { LaoZhaoChapter, LaoZhaoLectureNotes } from "./content-contract";
import { formatTime } from "./ChapterList";

type LectureNotesPanelProps = {
  notes?: LaoZhaoLectureNotes;
  chapters: readonly LaoZhaoChapter[];
  currentTimeSec: number;
  onSeek: (seconds: number, chapterId: string) => void;
};

export function LectureNotesPanel({ notes, chapters, currentTimeSec, onSeek }: LectureNotesPanelProps) {
  const activeRef = useRef<HTMLElement | null>(null);
  const chapterTitles = useMemo(
    () => new Map(chapters.map((chapter) => [chapter.stableId, chapter.title])),
    [chapters]
  );
  const blocks = notes?.blocks ?? [];
  const activeTeacherId = useMemo(() => {
    const active = blocks.find((block) => (
      block.provenance === "teacher" &&
      currentTimeSec >= block.startSec &&
      currentTimeSec < block.endSec
    ));
    return active?.id ?? null;
  }, [blocks, currentTimeSec]);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeTeacherId]);

  if (!notes || blocks.length === 0) {
    return (
      <div className="border-y border-[var(--line-soft)] py-6 text-sm leading-7 text-[var(--ink-soft)]">
        <p className="font-bold text-[var(--ink-main)]">列點講義待校訂</p>
        <p className="mt-1">字幕與章節可以先使用，講義通過逐段核對後才會放上來。</p>
      </div>
    );
  }

  return (
    <ol className="divide-y divide-[var(--line-soft)]" aria-label="依老師講述順序整理的列點講義">
      {blocks.map((block) => {
        const isSupplement = block.provenance === "supplement";
        const isActive = !isSupplement && block.id === activeTeacherId;
        return (
          <li key={block.id}>
            <article
              ref={isActive ? activeRef : undefined}
              data-lecture-block={block.id}
              data-lecture-provenance={block.provenance}
              className={`py-5 ${isSupplement ? "border-l-2 border-sky-400 pl-4" : ""}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    {isSupplement ? (
                      <span className="text-[0.7rem] font-black text-sky-700">補充</span>
                    ) : isActive ? (
                      <span className="text-[0.7rem] font-black text-[var(--brand-main)]">播放中</span>
                    ) : null}
                    <span className="text-[0.7rem] font-bold text-[var(--ink-soft)]">
                      {chapterTitles.get(block.chapterId) ?? "章節"}
                    </span>
                  </div>
                  <h3 className="mt-1 text-base font-black leading-6 text-[var(--ink-main)]">{block.title}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => onSeek(block.startSec, block.chapterId)}
                  aria-label={`跳到 ${formatTime(block.startSec)}：${block.title}`}
                  className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-md px-2 text-xs font-bold tabular-nums text-[var(--brand-deep)] hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-main)]"
                >
                  <Clock3 aria-hidden="true" size={15} strokeWidth={2} />
                  {formatTime(block.startSec)}
                </button>
              </div>

              {block.type === "bullets" ? (
                <ul className="mt-3 space-y-2.5 pl-5 text-sm leading-6 marker:text-[var(--brand-main)]">
                  {block.points.map((point, pointIndex) => (
                    <li key={`${block.id}-point-${pointIndex}`}>
                      <span>{point.text}</span>
                      {point.details.length > 0 ? (
                        <ul className="mt-1.5 space-y-1 border-l border-[var(--line-soft)] pl-3 text-[var(--ink-soft)]">
                          {point.details.map((detail, detailIndex) => (
                            <li key={`${block.id}-detail-${pointIndex}-${detailIndex}`}>{detail}</li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="mt-3 overflow-x-auto overscroll-x-contain">
                  <table className="w-full min-w-[28rem] border-collapse text-left text-xs leading-5">
                    <thead>
                      <tr className="border-y border-[var(--line-soft)] text-[var(--ink-soft)]">
                        {block.columns.map((column, columnIndex) => (
                          <th key={`${block.id}-column-${columnIndex}`} scope="col" className="px-2 py-2 font-black">
                            {column}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {block.rows.map((row, rowIndex) => (
                        <tr key={`${block.id}-row-${rowIndex}`} className="border-b border-[var(--line-soft)] align-top">
                          {row.map((cell, columnIndex) => (
                            <td key={`${block.id}-cell-${rowIndex}-${columnIndex}`} className="px-2 py-2.5">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </article>
          </li>
        );
      })}
    </ol>
  );
}
