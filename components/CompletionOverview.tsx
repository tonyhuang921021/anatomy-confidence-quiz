import { ChapterCompletionStats, OverallCompletionStats } from "@/types/quiz";
import { ChapterCompletionCard } from "@/components/ChapterCompletionCard";

type CompletionOverviewProps = {
  overall: OverallCompletionStats;
  chapters: ChapterCompletionStats[];
};

export function CompletionOverview({ overall, chapters }: CompletionOverviewProps) {
  return (
    <section className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">
            Anatomy Progress
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-ink">整體解剖學完成度</h2>
          <p className="mt-2 text-sm text-slate-500">
            已作答不重複題數 {overall.attemptedQuestions} / {overall.totalQuestionsInBank}
          </p>
        </div>
        <div className="rounded-3xl bg-brand-50 px-5 py-4 text-brand-900">
          <p className="text-xs font-semibold uppercase tracking-[0.2em]">Mastery</p>
          <p className="mt-2 text-3xl font-bold">{overall.masteryScore}</p>
        </div>
      </div>

      <div className="mt-5 h-4 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-brand-500 via-emerald-500 to-emerald-400"
          style={{ width: `${overall.completionRate}%` }}
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-600">
        <span>完成度 {overall.completionRate}%</span>
        <span>答對率 {overall.correctRate}%</span>
        <span>平均信心 {overall.averageConfidence}</span>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {chapters.map((chapter) => (
          <ChapterCompletionCard key={chapter.chapter} chapter={chapter} />
        ))}
      </div>
    </section>
  );
}
