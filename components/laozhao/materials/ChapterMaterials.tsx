"use client";

import Image from "next/image";
import Link from "next/link";
import { BookOpen, Clock3, ExternalLink, Images, PlayCircle } from "lucide-react";
import { formatTime } from "../player/ChapterList";
import type {
  LaoZhaoBoardFrame,
  LaoZhaoChapter,
  LaoZhaoReferenceNote
} from "../player/content-contract";

type ChapterMaterialsProps = {
  chapter: LaoZhaoChapter;
  videoId: string;
  onSeek?: (seconds: number) => void;
  overviewHref?: string;
  showHeading?: boolean;
};

function BoardFigure({
  frame,
  chapterTitle,
  videoId,
  onSeek
}: {
  frame: LaoZhaoBoardFrame;
  chapterTitle: string;
  videoId: string;
  onSeek?: (seconds: number) => void;
}) {
  const content = (
    <>
      <Image
        src={frame.src}
        alt={frame.alt}
        width={1600}
        height={900}
        unoptimized
        sizes="(max-width: 767px) 100vw, 52vw"
        className="aspect-video h-auto w-full bg-white object-contain"
      />
      <span className="flex min-h-11 items-center justify-between gap-3 border-t border-[var(--line-soft)] px-3 py-2 text-left">
        <span className="inline-flex items-center gap-2 font-mono text-xs font-bold tabular-nums text-[var(--brand-main)]">
          <Clock3 aria-hidden="true" size={15} strokeWidth={2} />
          {formatTime(frame.timeSec)}
        </span>
        <span className="inline-flex items-center gap-1 text-xs font-bold text-[var(--ink-soft)]">
          回到影片
          <PlayCircle aria-hidden="true" size={15} strokeWidth={2} />
        </span>
      </span>
    </>
  );

  const className = "block min-w-0 overflow-hidden rounded-md border border-[var(--line-soft)] bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-main)]";
  if (onSeek) {
    return (
      <button type="button" onClick={() => onSeek(frame.timeSec)} className={className}>
        {content}
      </button>
    );
  }
  return (
    <Link
      href={`/courses/laozhao-anatomy/watch/${encodeURIComponent(videoId)}?t=${Math.floor(frame.timeSec)}`}
      aria-label={`${chapterTitle} ${formatTime(frame.timeSec)} 回到影片`}
      className={className}
    >
      {content}
    </Link>
  );
}

function ReferenceNoteFigure({ note, pairNumber }: { note: LaoZhaoReferenceNote; pairNumber: number }) {
  return (
    <figure
      className="min-w-0 overflow-hidden rounded-md border border-[var(--line-soft)] bg-white"
      data-material-kind="note"
    >
      <a
        href={note.src}
        target="_blank"
        rel="noopener"
        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-main)] focus-visible:ring-inset"
        aria-label={`放大查看${note.sourceTitle}第 ${note.pdfPage} 頁`}
      >
        <Image
          src={note.src}
          alt={note.alt}
          width={1080}
          height={1560}
          unoptimized
          sizes="(max-width: 767px) 100vw, 42vw"
          className="h-auto w-full bg-white object-contain"
        />
      </a>
      <figcaption className="border-t border-[var(--line-soft)] px-3 py-3">
        <p className="mb-2 text-xs font-bold text-[var(--brand-main)]">對應板書 {pairNumber}</p>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-black">{note.sourceTitle}・第 {note.pdfPage} 頁</p>
            <p className="mt-1 text-xs font-semibold leading-5 text-[var(--ink-soft)]">
              {note.pageRegions.join("、")}
            </p>
          </div>
          <ExternalLink aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--ink-soft)]" size={16} strokeWidth={2} />
        </div>
        <p className="mt-2 text-xs leading-5 text-[var(--ink-soft)]">
          {note.matchedStructures.join("・")}
        </p>
      </figcaption>
    </figure>
  );
}

export function ChapterMaterials({
  chapter,
  videoId,
  onSeek,
  overviewHref,
  showHeading = true
}: ChapterMaterialsProps) {
  const boards = chapter.boardFrames ?? [];
  const notes = chapter.referenceNotes ?? [];
  const notesById = new Map(notes.map((note) => [note.id, note]));
  const pairs = boards.map((frame) => ({
    frame,
    notes: frame.referenceNoteIds
      .map((noteId) => notesById.get(noteId))
      .filter((note): note is LaoZhaoReferenceNote => Boolean(note))
  }));
  const linkedNoteCount = new Set(pairs.flatMap((pair) => pair.notes.map((note) => note.id))).size;
  if (pairs.length === 0) return null;

  return (
    <div className="min-w-0">
      {showHeading ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-black">板書與對照筆記</h3>
            <p className="mt-1 text-xs font-semibold text-[var(--ink-soft)]">
              {pairs.length} 組對照・{linkedNoteCount} 頁筆記
            </p>
          </div>
          {overviewHref ? (
            <Link
              href={overviewHref}
              className="inline-flex min-h-10 w-fit items-center gap-2 rounded-md border border-[var(--line-soft)] bg-white px-3 py-2 text-sm font-bold text-[var(--brand-deep)] hover:border-[var(--brand-main)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-main)]"
            >
              <Images aria-hidden="true" size={17} strokeWidth={2} />
              全部板書與筆記
            </Link>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 min-w-0">
        {pairs.map(({ frame, notes: linkedNotes }, pairIndex) => (
          <section
            key={frame.id}
            className="border-t border-[var(--line-soft)] py-6 first:border-t-0 first:pt-0 last:pb-0 sm:py-8"
            data-material-pair={frame.id}
            aria-label={`板書 ${pairIndex + 1} 與對照筆記`}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-black text-[var(--brand-deep)]">板書對照 {pairIndex + 1}</p>
              <span className="font-mono text-xs font-bold tabular-nums text-[var(--ink-soft)]">
                {formatTime(frame.timeSec)}
              </span>
            </div>
            <div
              className={`grid min-w-0 gap-4 md:items-start ${
                linkedNotes.length > 0
                  ? "md:grid-cols-[minmax(0,1.08fr)_minmax(18rem,0.92fr)]"
                  : "grid-cols-1"
              }`}
            >
              <div className="min-w-0" data-material-kind="board">
                <p className="mb-2 inline-flex items-center gap-2 text-sm font-black">
                  <Images aria-hidden="true" size={17} strokeWidth={2} />
                  老師板書
                </p>
                <BoardFigure
                  frame={frame}
                  chapterTitle={chapter.title}
                  videoId={videoId}
                  onSeek={onSeek}
                />
              </div>
              {linkedNotes.length > 0 ? (
                <div className="min-w-0">
                  <p className="mb-2 inline-flex items-center gap-2 text-sm font-black">
                    <BookOpen aria-hidden="true" size={17} strokeWidth={2} />
                    對照筆記
                  </p>
                  <div className="grid gap-4">
                    {linkedNotes.map((note) => (
                      <ReferenceNoteFigure key={note.id} note={note} pairNumber={pairIndex + 1} />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
