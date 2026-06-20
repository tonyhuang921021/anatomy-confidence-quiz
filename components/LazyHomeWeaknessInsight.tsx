"use client";

import dynamic from "next/dynamic";

const HomeWeaknessInsight = dynamic(
  () => import("@/components/HomeWeaknessInsight").then((mod) => mod.HomeWeaknessInsight),
  {
    ssr: false,
    loading: () => (
      <div className="home-progress-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-slate-500">資料整理中</p>
            <h3 className="mt-1 text-base font-black text-ink">弱點判讀載入中</h3>
          </div>
          <span className="home-entry-mark">稍等</span>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/70">
          <div className="h-full w-1/3 rounded-full bg-gradient-to-r from-brand-500 to-amber-500" />
        </div>
        <p className="body-soft mt-3 text-xs leading-6">正在整理最近作答紀錄。</p>
      </div>
    ),
  }
);

export function LazyHomeWeaknessInsight() {
  return <HomeWeaknessInsight />;
}
