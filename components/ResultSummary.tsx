import { SummaryStats } from "@/types/quiz";
import type { AnswerKeyScoreRevision } from "@/types/quiz";
import type { MasteryAnalysis } from "@/lib/masteryAnalysis";

type ResultSummaryProps = {
  summary: SummaryStats;
  masteryAnalysis?: MasteryAnalysis;
  scoreRevision?: AnswerKeyScoreRevision;
};

export function ResultSummary({ summary, masteryAnalysis, scoreRevision }: ResultSummaryProps) {
  return (
    <section>
      {scoreRevision ? (
        <div className="mb-4 border-y border-amber-200 bg-amber-50/70 px-4 py-4 text-amber-950">
          <p className="text-xs font-semibold tracking-wide text-amber-800">115-2 申覆重算</p>
          <div className="mt-2 grid grid-cols-2 divide-x divide-amber-200">
            <div className="pr-4">
              <p className="text-sm text-amber-800">申覆前成績</p>
              <p className="mt-1 text-2xl font-bold">
                {scoreRevision.previousCorrectCount} / {scoreRevision.totalCount}
              </p>
            </div>
            <div className="pl-4">
              <p className="text-sm text-amber-800">申覆後成績</p>
              <p className="mt-1 text-2xl font-bold">
                {scoreRevision.regradedCorrectCount} / {scoreRevision.totalCount}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-8 gap-y-5 rounded-2xl border border-brand-100 bg-brand-50/60 px-5 py-5 sm:px-6">
        <div>
          <p className="text-sm font-medium text-brand-800">本次答對率</p>
          <p className="mt-1 text-4xl font-bold tabular-nums text-ink">{summary.correctRate}<span className="ml-1 text-xl">%</span></p>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <p className="text-slate-600">共 <strong className="text-ink">{summary.total}</strong> 題</p>
          <p className="text-slate-600">答對 <strong className="text-emerald-800">{summary.correct}</strong></p>
          <p className="text-slate-600">答錯 <strong className="text-rose-800">{summary.wrong}</strong></p>
        </div>
        {masteryAnalysis && masteryAnalysis.examPassEstimate.currentMockPassed !== null ? (
          <p className="text-sm font-medium text-brand-800">
            {masteryAnalysis.examPassEstimate.currentMockPassed ? "本次已達 60 分" : "本次未達 60 分"}
          </p>
        ) : null}
      </div>
    </section>
  );
}
