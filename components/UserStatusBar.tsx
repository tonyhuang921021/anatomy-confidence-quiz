"use client";

import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";

export function UserStatusBar() {
  const { configured, loading, user, syncStatus } = useAuth();

  return (
    <div className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/90 backdrop-blur">
      <div className="shell flex min-w-0 items-center justify-between gap-3 py-3">
        <Link
          href="/"
          className="min-w-0 break-words text-sm font-semibold text-ink transition hover:text-brand-700"
        >
          Anatomy Confidence Quiz
        </Link>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2 text-xs font-semibold">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
            {configured ? "Supabase 已接上" : "Supabase 未設定"}
          </span>
          <span className="max-w-full break-all rounded-full bg-brand-50 px-3 py-1 text-brand-800">
            {loading ? "讀取中..." : user?.email ?? "訪客模式"}
          </span>
          {configured && user ? (
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-800">
              sync {syncStatus}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
