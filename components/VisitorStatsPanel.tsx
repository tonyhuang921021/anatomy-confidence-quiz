"use client";

import { useEffect, useState } from "react";
import { loadVisitorStats } from "@/lib/cloudSync";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import type { VisitorStats } from "@/types/quiz";

const REFRESH_INTERVAL_MS = 90 * 1000;

const emptyStats: VisitorStats = {
  totalVisitors: 0,
  onlineVisitors: 0,
  updatedAt: ""
};

type VisitorStatsPanelProps = {
  compact?: boolean;
};

export function VisitorStatsPanel({ compact = false }: VisitorStatsPanelProps) {
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
      if (typeof document === "undefined" || document.visibilityState === "visible") {
        void refresh();
      }
    }, REFRESH_INTERVAL_MS);

    function handleVisibilityChange() {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        void refresh();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  if (!isSupabaseConfigured()) {
    if (compact) return null;

    return (
      <div className="rounded-3xl bg-slate-50 p-4">
        <p className="text-sm text-slate-500">訪客統計</p>
        <p className="mt-2 text-sm text-slate-600">需先設定 Supabase 才會顯示。</p>
      </div>
    );
  }

  if (compact) {
    if (loading) {
      return null;
    }

    return (
      <div className="flex min-w-0 flex-wrap items-center justify-end gap-2 text-xs font-semibold">
        <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
          累積訪客 {stats.totalVisitors}
        </span>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
          在線估算 {stats.onlineVisitors}
        </span>
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
