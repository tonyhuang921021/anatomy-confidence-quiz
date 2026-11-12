type PastPaperCardProps = {
  selected: boolean;
  onSelect: () => void;
  trackLabel?: string;
  title: string;
  questionCount: number;
  lastAttemptSummary: string;
  resume?: {
    href: string;
    answeredCount: number;
    totalCount: number;
  };
};

export function PastPaperCard({
  selected,
  onSelect,
  trackLabel,
  title,
  questionCount,
  lastAttemptSummary,
  resume
}: PastPaperCardProps) {
  return (
    <div
      className={`flex min-w-0 flex-col rounded-xl border transition ${
        selected
          ? "border-brand-600 bg-brand-50 ring-1 ring-brand-600"
          : "border-slate-200 bg-white"
      }`}
    >
      <button
        type="button"
        aria-pressed={selected}
        onClick={onSelect}
        className={`w-full min-w-0 flex-1 rounded-xl px-3 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 ${
          selected ? "text-brand-800" : "text-slate-700 hover:bg-slate-50"
        }`}
      >
        <span className="block text-xs text-slate-500">{trackLabel}</span>
        <span className="mt-1 block text-sm font-semibold">{title}</span>
        <span className="mt-1 block text-xs leading-5 text-slate-500">
          {questionCount} 題・{lastAttemptSummary}
        </span>
      </button>
      {resume ? (
        <div className="mx-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-slate-200 py-3">
          <p className="min-w-0 text-xs leading-5 text-slate-600">
            <span className="block font-semibold text-brand-800">進行中</span>
            <span className="block">本次已答 {resume.answeredCount} / {resume.totalCount} 題</span>
          </p>
          <a
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg border border-brand-600 bg-white px-3 py-2 text-sm font-semibold text-brand-700 transition hover:bg-brand-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
            href={resume.href}
            aria-label={`繼續作答：${title}`}
          >
            繼續作答
          </a>
        </div>
      ) : null}
    </div>
  );
}
