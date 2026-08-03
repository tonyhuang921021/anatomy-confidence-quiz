import type { LaoZhaoChapter } from "./content-contract";

type ChapterListProps = {
  chapters: readonly LaoZhaoChapter[];
  currentChapterId: string | null;
  onSelect: (chapter: LaoZhaoChapter) => void;
  allowDrafts?: boolean;
};

function formatTime(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

export function ChapterList({ chapters, currentChapterId, onSelect, allowDrafts = false }: ChapterListProps) {
  const visibleChapters = chapters.filter(
    (chapter) => chapter.reviewStatus === "reviewed" || allowDrafts
  );

  if (visibleChapters.length === 0) {
    return (
      <p className="rounded-md bg-[var(--brand-tint)] px-4 py-3 text-sm leading-6 text-[var(--ink-soft)]">
        這支影片的章節整理完成後會顯示在這裡。
      </p>
    );
  }

  return (
    <ol className="divide-y divide-[var(--line-soft)] overflow-hidden rounded-md border border-[var(--line-soft)] bg-white/55">
      {visibleChapters.map((chapter) => {
        const isCurrent = chapter.stableId === currentChapterId;
        return (
          <li key={chapter.stableId}>
            <button
              type="button"
              aria-current={isCurrent ? "step" : undefined}
              onClick={() => onSelect(chapter)}
              className={`flex w-full items-start gap-3 px-3.5 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-main)] focus-visible:ring-inset motion-reduce:transition-none ${
                isCurrent
                  ? "bg-[var(--brand-tint)] text-[var(--brand-deep)]"
                  : "text-[var(--ink-main)] hover:bg-[var(--brand-tint)]/60"
              }`}
            >
              <span className="mt-0.5 w-11 shrink-0 font-mono text-xs font-bold tabular-nums text-[var(--brand-main)]">
                {formatTime(chapter.startSec)}
              </span>
              <span className="min-w-0 text-sm font-semibold leading-6">{chapter.title}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

export { formatTime };
