"use client";

import { useEffect, useState } from "react";
import type { AISimulationPaperOption } from "@/data/aiSimulationPapers";
import {
  SIMULATION_PAPER_SCORE_BUCKETS,
  type SimulationPaperStats
} from "@/lib/simulationPaperStats";

type SelectedSimulationPaperPanelProps = {
  paper: AISimulationPaperOption;
  canViewDetailedStats: boolean;
};

const BUCKET_COLORS = [
  "bg-rose-400",
  "bg-orange-400",
  "bg-amber-400",
  "bg-lime-500",
  "bg-emerald-500",
  "bg-sky-500"
];

function EmptyStats({ message }: { message: string }) {
  return (
    <div className="border-l-2 border-amber-300 pl-3 text-sm leading-6 text-slate-500">
      {message}
    </div>
  );
}

export function SelectedSimulationPaperPanel({
  paper,
  canViewDetailedStats
}: SelectedSimulationPaperPanelProps) {
  const [stats, setStats] = useState<SimulationPaperStats | null>(null);
  const [statsState, setStatsState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const controller = new AbortController();
    setStats(null);
    setStatsState("loading");

    fetch(`/api/simulation-paper-stats?paperKey=${encodeURIComponent(paper.key)}`, {
      signal: controller.signal
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("模擬卷統計讀取失敗");
        return (await response.json()) as SimulationPaperStats;
      })
      .then((payload) => {
        if (controller.signal.aborted) return;
        setStats(payload);
        setStatsState("ready");
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatsState("error");
      });

    return () => controller.abort();
  }, [paper.key]);

  return (
    <aside className="self-start rounded-lg border border-amber-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="min-w-0">
          <p className="text-xs font-bold text-amber-700">已選模擬卷</p>
          <h3 className="mt-1 text-base font-bold leading-7 text-ink">{paper.label}</h3>
        </div>
        <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800 ring-1 ring-amber-100">
          {paper.questionCount} 題
        </span>
      </div>

      <section className="mt-4" aria-live="polite">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-ink">有效完成紀錄</p>
            <p className="mt-1 text-xs text-slate-500">有效樣本，排除 3 分以下誤送</p>
          </div>
          {statsState === "loading" ? (
            <div className="h-7 w-16 animate-pulse rounded bg-slate-200" />
          ) : statsState === "error" ? (
            <span className="text-xs font-semibold text-slate-400">暫時無法讀取</span>
          ) : (
            <p className="text-2xl font-black text-ink">
              {stats?.sampleCount ?? 0}
              <span className="ml-1 text-xs font-bold text-slate-500">份</span>
            </p>
          )}
        </div>

        {canViewDetailedStats ? (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <div className="mb-4 flex items-end justify-between gap-3">
              <p className="text-sm font-bold text-ink">平均與級距</p>
              {stats?.available && stats.averageScore !== null ? (
                <p className="text-2xl font-black text-ink">
                  {stats.averageScore}
                  <span className="ml-1 text-xs font-bold text-slate-500">分</span>
                </p>
              ) : null}
            </div>

            {statsState === "loading" ? (
              <div className="space-y-3 py-2">
                <div className="h-3 w-full animate-pulse rounded-full bg-slate-200" />
                <div className="h-3 w-4/5 animate-pulse rounded-full bg-slate-200" />
              </div>
            ) : statsState === "error" ? (
              <EmptyStats message="級距暫時讀不到，不影響開始作答。" />
            ) : !stats?.available ? (
              <EmptyStats
                message={
                  stats?.unavailableReason ??
                  `有效完成紀錄滿 ${stats?.minimumSampleSize ?? 5} 份後顯示平均與級距。`
                }
              />
            ) : (
              <div>
                <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-200">
                  {SIMULATION_PAPER_SCORE_BUCKETS.map((bucket, index) => {
                    const count = stats.buckets[bucket.key];
                    if (count <= 0) return null;
                    return (
                      <span
                        key={bucket.key}
                        className={BUCKET_COLORS[index]}
                        style={{ width: `${(count / stats.sampleCount) * 100}%` }}
                        title={`${bucket.label} 分：${count} 份`}
                      />
                    );
                  })}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
                  {SIMULATION_PAPER_SCORE_BUCKETS.map((bucket, index) => {
                    const count = stats.buckets[bucket.key];
                    const percentage = Math.round((count / stats.sampleCount) * 100);
                    return (
                      <div key={bucket.key} className="flex items-center justify-between gap-2 text-xs">
                        <span className="inline-flex items-center gap-2 font-semibold text-slate-600">
                          <span className={`h-2.5 w-2.5 rounded-full ${BUCKET_COLORS[index]}`} />
                          {bucket.label}
                        </span>
                        <span className="font-black text-slate-800">{percentage}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="mt-4 border-l-2 border-amber-300 pl-3 text-sm leading-6 text-slate-500">
            完成這份考卷後，可查看全站平均與成績級距。
          </p>
        )}
      </section>

      {paper.info ? (
        <section className="mt-5 border-t border-slate-100 pt-5">
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-sm font-bold text-ink">本卷資訊</h4>
            <span className="text-xs font-bold text-slate-400">paperCode 002</span>
          </div>
          <p className="mt-3 text-sm leading-7 text-slate-600">{paper.info.summary}</p>

          <div className="mt-5">
            <h4 className="text-sm font-bold text-ink">本次主要改進</h4>
            <div className="mt-3 border-l border-amber-200 pl-4">
              {paper.info.highlights.map((highlight, index) => (
                <div
                  key={highlight.title}
                  className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-2 pb-4 last:pb-0"
                >
                  <span className="pt-0.5 text-xs font-black text-amber-700">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-800">{highlight.title}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{highlight.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {paper.info.validationNote ? (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4 text-xs font-semibold text-slate-500">
              <span>選項長度檢查</span>
              <span className="text-right text-slate-700">{paper.info.validationNote}</span>
            </div>
          ) : null}
        </section>
      ) : null}
    </aside>
  );
}
