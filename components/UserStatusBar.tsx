"use client";

import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { VisitorStatsPanel } from "@/components/VisitorStatsPanel";

export function UserStatusBar() {
  const { configured, loading, user, syncStatus } = useAuth();

  return (
    <div className="sticky top-0 z-50 border-b border-[rgba(16,42,34,0.08)] bg-[rgba(250,248,243,0.84)] backdrop-blur-xl">
      <div className="shell flex min-w-0 items-center justify-between gap-3 py-2.5">
        <Link
          href="/"
          className="min-w-0 font-serif text-base font-semibold tracking-[-0.02em] text-ink transition hover:text-brand-700 sm:text-lg"
        >
          一階醫師國考刷題測驗
        </Link>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2 text-[11px] font-semibold">
          <VisitorStatsPanel compact />
          {!configured ? <span className="stat-chip">Supabase 未設定</span> : null}
          {!loading ? (
            <span className="stat-chip max-w-full break-all">
              {user?.email ?? "訪客模式"}
            </span>
          ) : null}
          {configured && user ? (
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-800 ring-1 ring-emerald-100">
              {syncStatus}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
