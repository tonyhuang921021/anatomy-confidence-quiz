"use client";

import { Clock3 } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import type {
  LaoZhaoPreviewLectureBlock,
  LaoZhaoPreviewLecturePoint,
  LaoZhaoPreviewLecturePointKind,
  LaoZhaoPreviewLectureTable
} from "../../../lib/laozhao/preview/types";
import type { LaoZhaoChapter, LaoZhaoLectureNotes } from "./content-contract";
import { formatTime } from "./ChapterList";

type LectureNotesPanelProps = {
  notes?: LaoZhaoLectureNotes;
  chapters: readonly LaoZhaoChapter[];
  currentTimeSec: number;
  onSeek: (seconds: number, chapterId: string) => void;
};

const pointKindLabels: Partial<Record<LaoZhaoPreviewLecturePointKind, string>> = {
  teacher_note: "〈師說〉",
  exam_focus: "〈考點〉",
  mnemonic: "〈口訣〉",
  warning: "〈注意〉"
};

const pointKindClasses: Partial<Record<LaoZhaoPreviewLecturePointKind, string>> = {
  teacher_note: "text-sky-700",
  exam_focus: "text-rose-700",
  mnemonic: "text-amber-700",
  warning: "text-orange-700"
};

const listStyleClasses = [
  "list-decimal",
  "[list-style-type:upper-alpha]",
  "[list-style-type:lower-alpha]",
  "[list-style-type:lower-roman]"
] as const;

function toChineseNumber(value: number) {
  const digits = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
  if (value <= 9) return digits[value];
  if (value === 10) return "十";
  if (value < 20) return "十" + digits[value % 10];
  if (value < 100) {
    const remainder = value % 10;
    return digits[Math.floor(value / 10)] + "十" + (remainder ? digits[remainder] : "");
  }
  return String(value);
}

function pointChildren(point: LaoZhaoPreviewLecturePoint) {
  const legacyChildren: LaoZhaoPreviewLecturePoint[] = point.details.map((text) => ({
    text,
    details: []
  }));
  return [...(point.children ?? []), ...legacyChildren];
}

function PointText({ point }: { point: LaoZhaoPreviewLecturePoint }) {
  const runs = point.textRuns;
  const emphasis = [...new Set((point.teacherEmphasis ?? []).map((item) => item.phrase))];
  return (
    <>
      <span>
        {runs && runs.length > 0
          ? runs.map((run, index) => (
              run.strong
                ? <strong key={index} className="font-black text-[var(--ink-main)]">{run.text}</strong>
                : <span key={index}>{run.text}</span>
            ))
          : point.text}
      </span>
      {emphasis.length > 0 ? (
        <span className="ml-1.5 text-[0.86em] font-semibold text-rose-700">
          （老師：{emphasis.join("、")}）
        </span>
      ) : null}
    </>
  );
}

function OutlineList({
  points,
  depth,
  blockId
}: {
  points: readonly LaoZhaoPreviewLecturePoint[];
  depth: number;
  blockId: string;
}) {
  const styleClass = listStyleClasses[Math.min(depth, listStyleClasses.length - 1)];
  return (
    <ol
      className={[
        styleClass,
        depth === 0
          ? "mt-3 space-y-2.5 pl-7 text-sm leading-7"
          : "mt-1.5 space-y-1.5 pl-7 text-[0.94em] leading-6"
      ].join(" ")}
    >
      {points.map((point, pointIndex) => {
        const children = pointChildren(point);
        const label = pointKindLabels[point.kind ?? "standard"];
        return (
          <li key={[blockId, depth, pointIndex].join("-")} className="pl-1.5 marker:font-semibold marker:text-[var(--ink-soft)]">
            {label ? (
              <span
                data-lecture-kind={point.kind}
                className={"mr-1 font-black " + (pointKindClasses[point.kind ?? "standard"] ?? "")}
              >
                {label}
              </span>
            ) : null}
            <PointText point={point} />
            {children.length > 0 ? (
              <OutlineList points={children} depth={depth + 1} blockId={blockId} />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function LectureTable({ table, blockId, tableIndex }: {
  table: LaoZhaoPreviewLectureTable;
  blockId: string;
  tableIndex: number;
}) {
  const fitsMobileWidth = table.columns.length <= 2;
  return (
    <figure
      className="mt-5"
      data-lecture-table
      data-lecture-table-columns={table.columns.length}
    >
      <figcaption className="mb-2 text-sm font-black text-[var(--ink-main)]">{table.title}</figcaption>
      <div className="overflow-x-auto overscroll-x-contain">
        <table
          className={[
            "w-full border-collapse text-left text-xs leading-5",
            fitsMobileWidth ? "table-fixed" : "min-w-[28rem]"
          ].join(" ")}
        >
          <thead>
            <tr className="border-y border-[var(--line-soft)] bg-white/60 text-[var(--ink-soft)]">
              {table.columns.map((column, columnIndex) => (
                <th
                  key={[blockId, tableIndex, "column", columnIndex].join("-")}
                  scope="col"
                  className="px-2 py-2 font-black [overflow-wrap:anywhere]"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, rowIndex) => (
              <tr key={[blockId, tableIndex, "row", rowIndex].join("-")} className="border-b border-[var(--line-soft)] align-top">
                {row.map((cell, columnIndex) => (
                  <td
                    key={[blockId, tableIndex, "cell", rowIndex, columnIndex].join("-")}
                    className="px-2 py-2.5 [overflow-wrap:anywhere]"
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

type ChapterGroup = {
  chapter: LaoZhaoChapter;
  blocks: readonly LaoZhaoPreviewLectureBlock[];
};

export function LectureNotesPanel({ notes, chapters, currentTimeSec, onSeek }: LectureNotesPanelProps) {
  const activeRef = useRef<HTMLElement | null>(null);
  const blocks = notes?.blocks ?? [];
  const chapterGroups = useMemo<ChapterGroup[]>(() => {
    const blocksByChapter = new Map<string, LaoZhaoPreviewLectureBlock[]>();
    for (const block of blocks) {
      const current = blocksByChapter.get(block.chapterId) ?? [];
      current.push(block);
      blocksByChapter.set(block.chapterId, current);
    }
    return chapters
      .map((chapter) => ({
        chapter,
        blocks: blocksByChapter.get(chapter.stableId) ?? []
      }))
      .filter((group) => group.blocks.length > 0);
  }, [blocks, chapters]);
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
    <div className="space-y-8" aria-label="依章節整理的共筆式列點講義">
      {chapterGroups.map(({ chapter, blocks: chapterBlocks }, chapterIndex) => (
        <section key={chapter.stableId} data-lecture-chapter={chapter.stableId}>
          <header className="border-y border-[var(--line-soft)] bg-[#f2f2ef] px-3 py-3 sm:px-4">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
              <div className="flex min-w-0 items-baseline gap-2.5">
                <span aria-hidden="true" className="shrink-0 text-lg font-black text-[var(--brand-deep)]">§</span>
                <h2 className="min-w-0 text-base font-black leading-6 text-[var(--ink-main)]">
                  {chapterIndex + 1}. {chapter.title}
                </h2>
              </div>
              <span className="shrink-0 text-xs font-semibold tabular-nums text-[var(--ink-soft)]">
                {formatTime(chapter.startSec)}
                {chapter.endSec ? "–" + formatTime(chapter.endSec) : ""}
              </span>
            </div>
          </header>

          <ol className="divide-y divide-[var(--line-soft)]">
            {chapterBlocks.map((block, blockIndex) => {
              const isSupplement = block.provenance === "supplement";
              const blockEmphasis = block.provenance === "teacher"
                ? [...new Set((block.teacherEmphasis ?? []).map((item) => item.phrase))]
                : [];
              const isActive = !isSupplement && block.id === activeTeacherId;
              const sectionNumber = chapterBlocks
                .slice(0, blockIndex + 1)
                .filter((candidate) => candidate.provenance === "teacher").length;
              return (
                <li key={block.id}>
                  <article
                    ref={isActive ? activeRef : undefined}
                    data-lecture-block={block.id}
                    data-lecture-provenance={block.provenance}
                    className={[
                      "py-5 transition-colors",
                      isSupplement ? "border-l-2 border-sky-400 pl-4" : "",
                      isActive ? "border-l-2 border-[var(--brand-main)] bg-emerald-50/40 pl-4" : ""
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          {isSupplement ? (
                            <span className="text-[0.7rem] font-black text-sky-700">補充</span>
                          ) : isActive ? (
                            <span className="text-[0.7rem] font-black text-[var(--brand-main)]">播放中</span>
                          ) : null}
                        </div>
                        <h3 className="mt-1 text-base font-black leading-7 text-[var(--ink-main)]">
                          <span aria-hidden="true" className="mr-2">
                            {isSupplement ? "補充" : toChineseNumber(sectionNumber) + "、"}
                          </span>
                          {block.title}
                        </h3>
                        {blockEmphasis.length > 0 ? (
                          <p className="mt-1 text-xs font-semibold leading-5 text-rose-700">
                            老師：{blockEmphasis.join("、")}
                          </p>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => onSeek(block.startSec, block.chapterId)}
                        aria-label={"跳到 " + formatTime(block.startSec) + "：" + block.title}
                        className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-md px-2 text-xs font-bold tabular-nums text-[var(--brand-deep)] hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-main)]"
                      >
                        <Clock3 aria-hidden="true" size={15} strokeWidth={2} />
                        {formatTime(block.startSec)}
                      </button>
                    </div>

                    {block.type === "bullets" ? (
                      <>
                        <OutlineList points={block.points} depth={0} blockId={block.id} />
                        {block.tables?.map((table, tableIndex) => (
                          <LectureTable
                            key={[block.id, "table", tableIndex].join("-")}
                            table={table}
                            blockId={block.id}
                            tableIndex={tableIndex}
                          />
                        ))}
                      </>
                    ) : (
                      <LectureTable
                        table={{ title: block.title, columns: block.columns, rows: block.rows }}
                        blockId={block.id}
                        tableIndex={0}
                      />
                    )}
                  </article>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
