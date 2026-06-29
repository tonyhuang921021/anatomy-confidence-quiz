import { SummaryStats } from "@/types/quiz";
import type { MasteryAnalysis } from "@/lib/masteryAnalysis";

type ResultSummaryProps = {
  summary: SummaryStats;
  masteryAnalysis: MasteryAnalysis;
};

function formatPercent(value: number | null) {
  return value === null ? "—" : `${value}%`;
}

const cards = (summary: SummaryStats, masteryAnalysis: MasteryAnalysis) => [
  {
    label: "答對率",
    value: `${summary.correctRate}%`,
    helper: "表面成績",
    tone: "slate"
  },
  {
    label: "校準後掌握指數",
    value: formatPercent(masteryAnalysis.calibratedMasteryPercent),
    helper: "扣除猜對不穩與高信心錯誤後的掌握估計",
    tone: "brand",
    featured: true
  },
  {
    label: "高信心錯誤率",
    value: formatPercent(masteryAnalysis.highConfidenceErrorPercent),
    helper: masteryAnalysis.counts[4].total === 0 ? "本次沒有信心 4 的題目" : "信心 4 題目中答錯的比例",
    tone: "rose"
  },
  {
    label: "猜對風險率",
    value: formatPercent(masteryAnalysis.guessingRiskPercent),
    helper: summary.correct === 0 ? "本次沒有答對題" : "答對題目中信心 1-2 的比例",
    tone: "yellow"
  }
];

const toneClasses: Record<string, string> = {
  slate: "bg-slate-50 text-slate-800 ring-slate-200",
  emerald: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  brand: "bg-emerald-50 text-emerald-900 ring-emerald-300",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  rose: "bg-rose-50 text-rose-800 ring-rose-200",
  yellow: "bg-yellow-50 text-yellow-800 ring-yellow-200",
  orange: "bg-orange-50 text-orange-800 ring-orange-200"
};

export function ResultSummary({ summary, masteryAnalysis }: ResultSummaryProps) {
  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards(summary, masteryAnalysis).map((card) => (
        <article
          key={card.label}
          className={`rounded-3xl p-5 ring-1 ${toneClasses[card.tone]} shadow-sm ${
            card.featured ? "shadow-emerald-100 ring-2" : ""
          }`}
        >
          <p className="text-sm font-medium opacity-80">{card.label}</p>
          <p className="mt-3 text-3xl font-bold">{card.value}</p>
          <p className="mt-2 text-xs font-semibold leading-5 opacity-75">{card.helper}</p>
        </article>
      ))}
    </section>
  );
}
