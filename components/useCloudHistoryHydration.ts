"use client";

import { useEffect, useState } from "react";
import { useAuth, type CloudRefreshResult } from "@/components/AuthProvider";

type CloudHistoryHydrationOptions = {
  force?: boolean;
  readRemoteOnly?: boolean;
  historyMode?: "simulation";
};

export function useCloudHistoryHydration(
  enabled = true,
  options: CloudHistoryHydrationOptions = {}
) {
  const { user, refreshCloudData } = useAuth();
  const [completedKey, setCompletedKey] = useState<string | null>(null);
  const userId = user?.id ?? null;
  const force = options.force === true;
  const readRemoteOnly = options.readRemoteOnly === true;
  const historyMode = options.historyMode;
  const hydrationKey = userId
    ? `${userId}:${force ? "forced" : "auto"}:${readRemoteOnly ? "read" : "sync"}:${historyMode ?? "all"}`
    : null;

  useEffect(() => {
    setCompletedKey(null);
    if (!enabled || !userId || !hydrationKey) return;
    let cancelled = false, running = false, done = false, attempted = false, failures = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let retryAt = 0;
    const schedule = (at: number) => {
      if (cancelled || done) return;
      retryAt = Math.max(Date.now() + 1000, at);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { timer = undefined; void run(); }, retryAt - Date.now());
    };
    const run = async () => {
      if (cancelled || done || running || Date.now() < retryAt) return;
      running = true;
      // A retry only reads/reconciles history. It never replays pending uploads
      // or forces past the provider's cooldown after an uncertain first attempt.
      const retry = attempted;
      attempted = true;
      try {
        let result: CloudRefreshResult = await refreshCloudData({
          hydrateRemoteHistory: true, historyHydration: true,
          automatic: retry || !force, force: !retry && force,
          readRemoteOnly: retry || readRemoteOnly, historyMode
        });
        while (!cancelled && result.status === "skipped" && result.pending) {
          result = await result.pending;
        }
        if (cancelled) return;
        if (result.status === "completed" && result.userId === userId &&
            result.historyHydrated && result.historyMode === historyMode) {
          done = true;
          setCompletedKey(hydrationKey);
        } else if (result.status === "failed") {
          if (++failures <= 3) schedule(result.retryAt);
        } else if (result.status === "skipped") {
          if (result.retryAt) schedule(result.retryAt);
          // Recovery/unconfigured mode waits for a real state change or focus.
        } else {
          schedule(Date.now() + 1000); // unrelated in-flight sync finished
        }
      } catch {
        if (++failures <= 3) schedule(Date.now() + 90_000);
      } finally {
        running = false;
      }
    };
    const resume = () => {
      if (Date.now() < retryAt || running || done) return;
      failures = 0;
      void run();
    };
    window.addEventListener("focus", resume);
    void run();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      window.removeEventListener("focus", resume);
    };
  }, [enabled, force, historyMode, hydrationKey, readRemoteOnly, refreshCloudData, userId]);

  return Boolean(enabled && hydrationKey && completedKey !== hydrationKey);
}
