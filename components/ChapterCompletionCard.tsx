import { ChapterCompletionStats, CompletionStatus } from "@/types/quiz";

type ChapterCompletionCardProps = {
  chapter: ChapterCompletionStats;
};

const statusClasses: Record<CompletionStatus, string> = {
  未開始: "bg-slate-100 text-slate-700",
  進行中: "bg-sky-100 text-sky-800",
  已完成但不穩: "bg-amber-100 text-amber-900",
  已完成且穩定: "bg-emerald-100 text-emerald-800"
};

export function ChapterCompletionCard({ chapter }: ChapterCompletionCardProps) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-ink">{chapter.chapter}</h3>
          <p className="mt-1 text-sm text-slate-500">
            完成度 {chapter.completionRate}% ・ 掌握度 {chapter.masteryScore}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClasses[chapter.status]}`}>
          {chapter.status}
        </span>
      </div>
      <div className="mt-4 h-3 overflow-hidden rounded-full bg-white">
        <div
          className="h-full rounded-full bg-gradient-to-r from-sky-500 to-brand-500"
          style={{ width: `${chapter.completionRate}%` }}
        />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-600">
        <p className="rounded-2xl bg-white px-4 py-3">
          已作答 <span className="font-semibold">{chapter.attemptedQuestions}</span>
        </p>
        <p className="rounded-2xl bg-white px-4 py-3">
          題庫數 <span className="font-semibold">{chapter.totalQuestionsInBank}</span>
        </p>
        <p className="rounded-2xl bg-white px-4 py-3">
          答對率 <span className="font-semibold">{chapter.correctRate}%</span>
        </p>
        <p className="rounded-2xl bg-white px-4 py-3">
          平均信心 <span className="font-semibold">{chapter.averageConfidence}</span>
        </p>
      </div>
    </article>
  );
}
