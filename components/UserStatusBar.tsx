"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { getSyncStatusText, getSyncStatusTone } from "@/components/syncStatusText";
import { VisitorStatsPanel } from "@/components/VisitorStatsPanel";

export function UserStatusBar() {
  const pathname = usePathname();
  const { configured, loading, user, syncStatus, syncError } = useAuth();
  const isOwnerReviewPage =
    pathname === "/owner/parasitology-review" ||
    pathname === "/owner/bacteria-review" ||
    pathname === "/owner/virus-review" ||
    pathname === "/owner/biochemistry-review";
  const syncTone = getSyncStatusTone(syncStatus, Boolean(syncError));

  if (isOwnerReviewPage) {
    return null;
  }

  return (
    <div className="topbar-shell sticky top-0 z-50 backdrop-blur-xl">
      <div className="shell flex min-w-0 items-center justify-between gap-3 py-2.5">
        <Link
          href="/"
          className="min-w-0 font-serif text-base font-semibold tracking-[-0.02em] text-ink transition hover:text-brand-700 sm:text-lg"
        >
          一階醫師國考刷題測驗
        </Link>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2 text-[11px] font-semibold">
          {!configured ? <span className="stat-chip">Supabase 未設定</span> : null}
          {configured ? <VisitorStatsPanel compact /> : null}
          {!loading ? (
            <span className="stat-chip max-w-full break-all">
              {user?.email ?? "訪客模式"}
            </span>
          ) : null}
          {configured && user ? (
            <span
              className={`rounded-full px-3 py-1 ring-1 ${
                syncTone === "syncing"
                  ? "bg-amber-50 text-amber-800 ring-amber-100"
                  : syncTone === "fallback"
                    ? "bg-slate-50 text-slate-600 ring-slate-200"
                    : "bg-emerald-50 text-emerald-800 ring-emerald-100 dark-success-chip"
              }`}
              title={syncError || undefined}
            >
              {getSyncStatusText(syncStatus, Boolean(syncError))}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
