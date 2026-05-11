"use client";

import { useEffect, useState } from "react";
import { loadVisitorStats } from "@/lib/cloudSync";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import type { VisitorStats } from "@/types/quiz";

const REFRESH_INTERVAL_MS = 30 * 1000;

const emptyStats: VisitorStats = {
  totalVisitors: 0,
  onlineVisitors: 0,
  updatedAt: ""
};

export function VisitorStatsPanel() {
  const [stats, setStats] = useState<VisitorStats>(emptyStats);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function refresh() {
      try {
        const nextStats = await loadVisitorStats();
        if (!cancelled) {
          setStats(nextStats);
          setError("");
          setLoading(false);
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : "讀取訪客統計失敗");
          setLoading(false);
        }
      }
    }

    void refresh();
    const intervalId = window.setInterval(() => {
      void refresh();
    }, REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  if (!isSupabaseConfigured()) {
    return (
      <div className="rounded-3xl bg-slate-50 p-4">
        <p className="text-sm text-slate-500">訪客統計</p>
        <p className="mt-2 text-sm text-slate-600">需先設定 Supabase 才會顯示。</p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-3xl bg-slate-50 p-4">
        <p className="text-sm text-slate-500">累積訪客</p>
        <p className="mt-2 text-2xl font-bold text-ink">
          {loading ? "..." : stats.totalVisitors}
        </p>
      </div>
      <div className="rounded-3xl bg-slate-50 p-4">
        <p className="text-sm text-slate-500">目前在線估算</p>
        <p className="mt-2 text-2xl font-bold text-ink">
          {loading ? "..." : stats.onlineVisitors}
        </p>
        <p className="mt-1 text-xs text-slate-500">以最近 2 分鐘內仍有活動的裝置估算</p>
        {error ? <p className="mt-1 text-xs text-rose-600">{error}</p> : null}
      </div>
    </>
  );
}
