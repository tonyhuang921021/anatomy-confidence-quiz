"use client";

import { useEffect, useState } from "react";
import { useAuth, type CloudRefreshResult } from "@/components/AuthProvider";

export function CloudHistoryReadStatus({ historyMode }: { historyMode?: "simulation" }) {
  const { user, refreshCloudData } = useAuth();
  const ownerId = user?.id ?? null;
  const key = `${ownerId ?? "guest"}:${historyMode ?? "all"}`;
  const [retryVersion, setRetryVersion] = useState(0);
  const [result, setResult] = useState<{ key: string; status: "loading" | "ready" | "error"; message?: string }>({ key: "", status: "loading" });
  const current = result.key === key ? result : { key, status: "loading" as const };

  useEffect(() => {
    if (!ownerId) return;
    let cancelled = false, running = false, completed = false;
    const run = async () => {
      if (cancelled || running || completed) return;
      running = true;
      setResult({ key, status: "loading" });
      try {
        // Both initial loading and the button are read-only. Never drain a
        // pending upload queue or replay an uncertain write to recover counts.
        let outcome: CloudRefreshResult | undefined;
        for (let pass = 0; pass < 2; pass++) {
          outcome = await refreshCloudData({ hydrateRemoteHistory: true, historyHydration: true,
            readRemoteOnly: true, force: true, historyMode });
          while (!cancelled && outcome.status === "skipped" && outcome.pending) outcome = await outcome.pending;
          if (cancelled) return;
          if (outcome.status === "completed" && outcome.userId === ownerId &&
              outcome.historyHydrated && outcome.historyMode === historyMode) {
            completed = true;
            setResult({ key, status: "ready" });
            return;
          }
          // An unrelated in-flight read is not evidence that this scope loaded.
          if (outcome.status !== "completed") break;
        }
        setResult({ key, status: "error", message: outcome?.status === "failed" ? outcome.message : undefined });
      } catch (error) {
        if (!cancelled) setResult({ key, status: "error", message: error instanceof Error ? error.message : undefined });
      } finally { running = false; }
    };
    void run();
    window.addEventListener("focus", run);
    return () => { cancelled = true; window.removeEventListener("focus", run); };
  }, [ownerId, key, historyMode, refreshCloudData, retryVersion]);

  if (!ownerId) return null;
  return <section className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" aria-label="雲端紀錄讀取狀態">
    <p role="status" aria-live="polite">
      {current.status === "ready" ? "雲端紀錄已讀取。" : current.status === "loading"
        ? "正在讀取完整雲端紀錄，先顯示這台裝置已有的紀錄。"
        : current.message || "雲端紀錄尚未完整讀取，目前顯示這台裝置已有的紀錄。"}
    </p>
    <button type="button" disabled={current.status === "loading"}
      className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 py-2 font-semibold disabled:opacity-50"
      onClick={() => setRetryVersion(value => value + 1)}>重新讀取雲端紀錄</button>
  </section>;
}
