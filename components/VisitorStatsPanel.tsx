"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { loadVisitorStats } from "@/lib/cloudSync";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { isSupabaseRecoveryMode, getRecoveryTimestamp } from "@/lib/supabase/recoveryMode";
import type { OnlineVisitor, VisitorStats } from "@/types/quiz";

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

const emptyStats: VisitorStats = {
  totalVisitors: 0,
  onlineVisitors: 0,
  updatedAt: ""
};

type VisitorStatsPanelProps = {
  compact?: boolean;
};

function formatLastSeen(lastSeenAt: string) {
  const timestamp = Date.parse(lastSeenAt);
  if (!Number.isFinite(timestamp)) return "剛剛";
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 1) return "剛剛";
  return `${minutes} 分鐘前`;
}

function OnlineVisitorList({
  visitors,
  loading,
  error,
  stale,
  style
}: {
  visitors: OnlineVisitor[];
  loading: boolean;
  error: string;
  stale: boolean;
  style?: CSSProperties;
}) {
  return (
    <div
      className="fixed z-[120] max-h-[calc(100dvh-5rem)] w-[min(18rem,calc(100vw-2rem))] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-3 text-left shadow-2xl shadow-slate-200/70"
      style={style}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-bold text-ink">現在在線</p>
        {loading || stale ? (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
            更新中
          </span>
        ) : null}
      </div>
      {error ? <p className="mt-2 text-xs font-semibold text-rose-600">{error}</p> : null}
      <div className="mt-3 space-y-2">
        {visitors.length > 0 ? (
          visitors.map((visitor) => (
            <div
              key={visitor.userId ?? visitor.visitorId}
              className="flex min-w-0 items-center justify-between gap-3 rounded-2xl bg-slate-50 px-3 py-2"
            >
              <span className="min-w-0 truncate text-sm font-semibold text-slate-800">
                {visitor.label}
              </span>
              <span className="shrink-0 text-[11px] font-semibold text-slate-500">
                {formatLastSeen(visitor.lastSeenAt)}
              </span>
            </div>
          ))
        ) : (
          <p className="rounded-2xl bg-slate-50 px-3 py-3 text-xs font-semibold text-slate-500">
            目前沒有抓到登入中的同學。
          </p>
        )}
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
        為了省流量，名單只在點開時更新；10 分鐘內有登入心跳才算在線。
      </p>
    </div>
  );
}

export function VisitorStatsPanel({ compact = false }: VisitorStatsPanelProps) {
  const [stats, setStats] = useState<VisitorStats>(emptyStats);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [panelPosition, setPanelPosition] = useState<CSSProperties>({ right: 16, top: 56 });
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (isSupabaseRecoveryMode()) {
      setStats({
        totalVisitors: 0,
        onlineVisitors: 0,
        updatedAt: getRecoveryTimestamp()
      });
      setLoading(false);
      return;
    }

    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function refresh() {
      try {
        const nextStats = await loadVisitorStats();
        if (!cancelled) {
          setStats((previous) => ({
            ...previous,
            ...nextStats,
            online: previous.online
          }));
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

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (!open) return;

    function updatePanelPosition() {
      const button = buttonRef.current;
      if (!button) return;

      const rect = button.getBoundingClientRect();
      const margin = 16;
      const panelWidth = Math.min(288, Math.max(0, window.innerWidth - margin * 2));
      const maxRight = Math.max(margin, window.innerWidth - panelWidth - margin);
      const preferredRight = window.innerWidth - rect.right;

      setPanelPosition({
        top: Math.max(margin, rect.bottom + 8),
        right: Math.min(Math.max(preferredRight, margin), maxRight)
      });
    }

    updatePanelPosition();
    window.addEventListener("resize", updatePanelPosition);
    window.addEventListener("scroll", updatePanelPosition, true);

    function handlePointerDown(event: PointerEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      window.removeEventListener("resize", updatePanelPosition);
      window.removeEventListener("scroll", updatePanelPosition, true);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [open]);

  async function refreshOnlineList() {
    if (!isSupabaseConfigured() || isSupabaseRecoveryMode()) return;
    setListLoading(true);
    try {
      const nextStats = await loadVisitorStats({ includeOnline: true });
      setStats(nextStats);
      setError("");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "線上名單稍後更新");
    } finally {
      setLoading(false);
      setListLoading(false);
    }
  }

  function toggleOnlineList() {
    setOpen((current) => {
      const nextOpen = !current;
      if (nextOpen) {
        window.requestAnimationFrame(() => {
          const button = buttonRef.current;
          if (!button) return;

          const rect = button.getBoundingClientRect();
          const margin = 16;
          const panelWidth = Math.min(288, Math.max(0, window.innerWidth - margin * 2));
          const maxRight = Math.max(margin, window.innerWidth - panelWidth - margin);
          const preferredRight = window.innerWidth - rect.right;

          setPanelPosition({
            top: Math.max(margin, rect.bottom + 8),
            right: Math.min(Math.max(preferredRight, margin), maxRight)
          });
        });
      }
      return nextOpen;
    });
    if (!open) {
      void refreshOnlineList();
    }
  }

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
    return (
      <div ref={wrapperRef} className="relative shrink-0">
        <button
          ref={buttonRef}
          type="button"
          onClick={toggleOnlineList}
          className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-800 ring-1 ring-emerald-100 transition hover:bg-emerald-100"
          aria-expanded={open}
        >
          {loading ? "線上讀取中" : `線上 ${stats.onlineVisitors} 人`}
        </button>
        {open ? (
          <OnlineVisitorList
            visitors={stats.online ?? []}
            loading={listLoading}
            error={error}
            stale={Boolean(stats.stale || stats.degraded)}
            style={panelPosition}
          />
        ) : null}
      </div>
    );
  }

  return (
    <>
      <div className="rounded-3xl bg-slate-50 p-4">
        <p className="text-sm text-slate-500">目前在線</p>
        <p className="mt-2 text-2xl font-bold text-ink">
          {loading ? "..." : stats.onlineVisitors}
        </p>
      </div>
      <div className="rounded-3xl bg-slate-50 p-4">
        <p className="text-sm text-slate-500">在線名單</p>
        <p className="mt-2 text-2xl font-bold text-ink">
          {stats.online?.length ?? 0}
        </p>
        <p className="mt-1 text-xs text-slate-500">以最近 10 分鐘登入心跳估算</p>
        {error ? <p className="mt-1 text-xs text-rose-600">{error}</p> : null}
      </div>
    </>
  );
}
