import { SummaryStats } from "@/types/quiz";
import type { MasteryAnalysis } from "@/lib/masteryAnalysis";

type ResultSummaryProps = {
  summary: SummaryStats;
  masteryAnalysis?: MasteryAnalysis;
};

function formatPercent(value: number | null) {
  return value === null ? "—" : `${value}%`;
}

function formatExamScore(value: number) {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

const cards = (summary: SummaryStats, masteryAnalysis?: MasteryAnalysis) => {
  if (!masteryAnalysis) {
    return [
      { label: "總題數", value: summary.total, helper: "本輪完成題數", tone: "slate" },
      { label: "答對題數", value: summary.correct, helper: "答對的題目數", tone: "emerald" },
      { label: "答對率", value: `${summary.correctRate}%`, helper: "本輪正確率", tone: "brand", featured: true },
      { label: "答錯題數", value: summary.wrong, helper: "需要回顧的題目數", tone: "rose" }
    ];
  }

  const examEstimate = masteryAnalysis.examPassEstimate;
  const passTone =
    examEstimate.predictivePassProbability >= 0.85
      ? "emerald"
      : examEstimate.predictivePassProbability >= 0.65
        ? "sky"
        : examEstimate.predictivePassProbability >= 0.45
          ? "amber"
          : "rose";

  return [
    {
      label: "本次答對率",
      value: `${summary.correctRate}%`,
      helper:
        examEstimate.currentMockScore !== null
          ? `本次模擬考分數：${examEstimate.currentMockScore} / 100`
          : "本次練習表面成績",
      tone: "slate",
      badge:
        examEstimate.currentMockPassed === null
          ? undefined
          : examEstimate.currentMockPassed
            ? "本次已達 60 分"
            : "本次未達 60 分"
    },
    {
      label: "校準後掌握",
      value: formatPercent(masteryAnalysis.calibratedMasteryPercent),
      helper: "扣除猜對不穩與高信心錯誤後的掌握估計",
      tone: "brand"
    },
    {
      label: "正式考及格機率",
      value: `${examEstimate.predictivePassProbabilityPercent}%`,
      helper:
        examEstimate.sampleWarning ?? "預估正式考 100 題中達到 60 題以上的機率",
      tone: passTone,
      featured: true,
      badge: examEstimate.sampleWarning ?? examEstimate.passBadgeLabel
    },
    {
      label: "預估正式考分數",
      value: `${formatExamScore(examEstimate.expectedExamScore)} / 100`,
      helper: `80% 可能範圍：${examEstimate.scoreRange80[0]}–${examEstimate.scoreRange80[1]} 分`,
      tone: "sky"
    }
  ];
};

const toneClasses: Record<string, string> = {
  slate: "bg-slate-50 text-slate-800 ring-slate-200",
  emerald: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  brand: "bg-emerald-50 text-emerald-900 ring-emerald-300",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  rose: "bg-rose-50 text-rose-800 ring-rose-200",
  sky: "bg-sky-50 text-sky-900 ring-sky-200",
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
          <div className="flex min-h-6 flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium opacity-80">{card.label}</p>
            {"badge" in card && card.badge ? (
              <span className="rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-black shadow-sm ring-1 ring-current/10">
                {card.badge}
              </span>
            ) : null}
          </div>
          <p className="mt-3 text-3xl font-bold">{card.value}</p>
          <p className="mt-2 text-xs font-semibold leading-5 opacity-75">{card.helper}</p>
        </article>
      ))}
    </section>
  );
}
