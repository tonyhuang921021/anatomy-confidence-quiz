import { SummaryStats } from "@/types/quiz";

type ResultSummaryProps = {
  summary: SummaryStats;
};

const cards = (summary: SummaryStats) => [
  { label: "總題數", value: summary.total, tone: "slate" },
  { label: "答對題數", value: summary.correct, tone: "emerald" },
  { label: "答對率", value: `${summary.correctRate}%`, tone: "brand" },
  { label: "平均信心", value: summary.averageConfidence, tone: "amber" },
  { label: "錯誤自信數", value: summary.overconfidenceCount, tone: "rose" },
  { label: "猜對風險數", value: summary.guessRiskCount, tone: "yellow" },
  { label: "優先補弱數", value: summary.priorityWeaknessCount, tone: "orange" }
];

const toneClasses: Record<string, string> = {
  slate: "bg-slate-50 text-slate-800 ring-slate-200",
  emerald: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  brand: "bg-brand-50 text-brand-800 ring-brand-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  rose: "bg-rose-50 text-rose-800 ring-rose-200",
  yellow: "bg-yellow-50 text-yellow-800 ring-yellow-200",
  orange: "bg-orange-50 text-orange-800 ring-orange-200"
};

export function ResultSummary({ summary }: ResultSummaryProps) {
  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards(summary).map((card) => (
        <article
          key={card.label}
          className={`rounded-3xl p-5 ring-1 ${toneClasses[card.tone]} shadow-sm`}
        >
          <p className="text-sm font-medium opacity-80">{card.label}</p>
          <p className="mt-3 text-3xl font-bold">{card.value}</p>
        </article>
      ))}
    </section>
  );
}
