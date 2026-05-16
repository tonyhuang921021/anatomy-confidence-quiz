"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { loadAdminDashboardStats } from "@/lib/cloudSync";
import { AdminDashboardStats } from "@/types/quiz";

function formatUpdatedAt(value: string) {
  return new Date(value).toLocaleString("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export default function AdminPage() {
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchStats() {
      try {
        setLoading(true);
        setError("");
        const nextStats = await loadAdminDashboardStats();
        setStats(nextStats);
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : "後台資料載入失敗");
      } finally {
        setLoading(false);
      }
    }

    void fetchStats();
  }, []);

  return (
    <main className="shell">
      <section className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">Admin</p>
            <h1 className="mt-2 text-3xl font-bold text-ink sm:text-4xl">後台總覽</h1>
            <p className="mt-3 text-slate-500">
              目前看的是全站訪客、同步用戶與今天作答量。
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/"
              className="min-h-12 rounded-2xl bg-slate-100 px-5 py-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-200"
            >
              返回首頁
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-8">
        {loading ? (
          <div className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100">
            載入後台資料中...
          </div>
        ) : error ? (
          <div className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100">
            <h2 className="text-xl font-semibold text-ink">後台資料載入失敗</h2>
            <p className="mt-3 text-sm text-rose-700">{error}</p>
          </div>
        ) : stats ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-3xl bg-white p-5 shadow-card ring-1 ring-slate-100">
              <p className="text-sm text-slate-500">累積訪客</p>
              <p className="mt-2 text-3xl font-bold text-ink">{stats.totalVisitors}</p>
            </article>
            <article className="rounded-3xl bg-white p-5 shadow-card ring-1 ring-slate-100">
              <p className="text-sm text-slate-500">目前在線估算</p>
              <p className="mt-2 text-3xl font-bold text-ink">{stats.onlineVisitors}</p>
            </article>
            <article className="rounded-3xl bg-white p-5 shadow-card ring-1 ring-slate-100">
              <p className="text-sm text-slate-500">已同步用戶</p>
              <p className="mt-2 text-3xl font-bold text-ink">{stats.totalSyncedUsers}</p>
            </article>
            <article className="rounded-3xl bg-white p-5 shadow-card ring-1 ring-slate-100">
              <p className="text-sm text-slate-500">今天做了幾題</p>
              <p className="mt-2 text-3xl font-bold text-ink">{stats.todayAttempts}</p>
            </article>
          </div>
        ) : null}
      </section>

      {stats ? (
        <section className="mt-6 rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100">
          <p className="text-sm text-slate-500">
            最後更新：<span className="font-semibold text-slate-700">{formatUpdatedAt(stats.updatedAt)}</span>
          </p>
          <p className="mt-2 text-sm text-slate-500">
            今天作答量以台北時區 00:00 到 23:59 計算；在線估算為最近 2 分鐘內仍有活動的裝置。
          </p>
        </section>
      ) : null}
    </main>
  );
}
