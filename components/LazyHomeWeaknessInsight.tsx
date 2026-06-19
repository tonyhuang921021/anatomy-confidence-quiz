"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

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
        <p className="body-soft mt-3 text-xs leading-6">先把首頁打開，題庫弱點判讀晚一點再進場。</p>
      </div>
    ),
  }
);

export function LazyHomeWeaknessInsight() {
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    if (shouldLoad) return;

    const timeoutId = window.setTimeout(() => {
      if (document.visibilityState === "visible") setShouldLoad(true);
    }, 3500);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [shouldLoad]);

  if (shouldLoad) return <HomeWeaknessInsight />;

  return (
    <div className="home-progress-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-slate-500">稍後整理</p>
          <h3 className="mt-1 text-base font-black text-ink">弱點判讀先待命</h3>
        </div>
        <span className="home-entry-mark">省電</span>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/70">
        <div className="h-full w-1/4 rounded-full bg-gradient-to-r from-brand-500 to-amber-500" />
      </div>
      <p className="body-soft mt-3 text-xs leading-6">
        首頁先輕量載入，等瀏覽器空一點再判讀你的弱點。
      </p>
      <button
        type="button"
        className="mt-4 inline-flex text-sm font-bold text-brand-700"
        onClick={() => setShouldLoad(true)}
      >
        立刻看弱點 →
      </button>
    </div>
  );
}
