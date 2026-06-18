"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LeaderboardTable } from "@/components/LeaderboardTable";
import { useAuth } from "@/components/AuthProvider";
import { loadLeaderboard } from "@/lib/cloudSync";
import { LeaderboardEntry } from "@/types/quiz";

const LEADERBOARD_LOAD_TIMEOUT_MS = 5000;

export default function LeaderboardPage() {
  const { configured, user, syncVersion } = useAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [sortMode, setSortMode] = useState<"attempts" | "accuracy">("attempts");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let isActive = true;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      controller.abort();
    }, LEADERBOARD_LOAD_TIMEOUT_MS);

    async function fetchLeaderboard() {
      if (!configured) {
        setEntries([]);
        setLoading(false);
        window.clearTimeout(timeoutId);
        return;
      }

      try {
        setLoading(true);
        setError("");
        const data = await loadLeaderboard(50, { signal: controller.signal });
        if (!isActive) return;
        setEntries(data);
      } catch (fetchError) {
        if (!isActive) return;
        const isAbortError =
          fetchError instanceof Error &&
          (fetchError.name === "AbortError" || fetchError.message.toLowerCase().includes("abort"));
        setError(
          isAbortError
            ? "刷題榜讀取逾時，請稍後再試一次。"
            : fetchError instanceof Error
              ? fetchError.message
              : "刷題榜載入失敗"
        );
      } finally {
        if (isActive) {
          setLoading(false);
        }
        window.clearTimeout(timeoutId);
      }
    }

    void fetchLeaderboard();

    return () => {
      isActive = false;
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [configured, reloadKey, syncVersion]);

  const sortedEntries = [...entries].sort((a, b) => {
    if (sortMode === "accuracy") {
      return (
        b.correctRate - a.correctRate ||
        b.totalAttempts - a.totalAttempts ||
        b.correctAttempts - a.correctAttempts
      );
    }

    return (
      b.totalAttempts - a.totalAttempts ||
      b.correctRate - a.correctRate ||
      b.correctAttempts - a.correctAttempts
    );
  });

  return (
    <main className="shell">
      <section className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">Leaderboard</p>
            <h1 className="mt-2 text-3xl font-bold text-ink sm:text-4xl">刷題榜</h1>
            <p className="mt-3 text-slate-500">
              依總答題量排序，答題量相同時再以正確率排序。
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/"
              className="min-h-12 rounded-2xl bg-slate-100 px-5 py-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-200"
            >
              返回首頁
            </Link>
            <Link
              href="/quiz?new=1"
              className="min-h-12 rounded-2xl bg-brand-600 px-5 py-4 text-sm font-semibold text-white transition hover:bg-brand-700"
            >
              開始測驗
            </Link>
          </div>
        </div>
      </section>

      <div className="mt-8">
        {!configured ? (
          <section className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100">
            <h2 className="text-2xl font-semibold text-ink">刷題榜尚未啟用</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              請先設定 Supabase，並重新執行最新版 [supabase/schema.sql](/Users/huangguanlun/Documents/New%20project/supabase/schema.sql) 建立 leaderboard 資料表。
            </p>
          </section>
        ) : loading ? (
          <section className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100">
            載入刷題榜中...
          </section>
        ) : error ? (
          <section className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100">
            <h2 className="text-2xl font-semibold text-ink">刷題榜載入失敗</h2>
            <p className="mt-3 text-sm leading-7 text-rose-700">{error}</p>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              如果你剛升級這版，請回 Supabase SQL Editor 重新執行一次 [supabase/schema.sql](/Users/huangguanlun/Documents/New%20project/supabase/schema.sql)。
            </p>
            <button
              type="button"
              onClick={() => setReloadKey((value) => value + 1)}
              className="mt-4 min-h-12 rounded-2xl bg-brand-600 px-5 py-4 text-sm font-semibold text-white transition hover:bg-brand-700"
            >
              重新載入刷題榜
            </button>
          </section>
        ) : (
          <div className="space-y-6">
            <section className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100">
              <h2 className="text-xl font-semibold text-ink">排序方式</h2>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setSortMode("attempts")}
                  className={`min-h-12 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                    sortMode === "attempts"
                      ? "bg-brand-600 text-white"
                      : "bg-slate-100 text-slate-800 hover:bg-slate-200"
                  }`}
                >
                  依總答題量排序
                </button>
                <button
                  type="button"
                  onClick={() => setSortMode("accuracy")}
                  className={`min-h-12 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                    sortMode === "accuracy"
                      ? "bg-brand-600 text-white"
                      : "bg-slate-100 text-slate-800 hover:bg-slate-200"
                  }`}
                >
                  依正確率排序
                </button>
              </div>
            </section>

            <LeaderboardTable
              entries={sortedEntries}
              currentUserId={user?.id}
              sortMode={sortMode}
            />
          </div>
        )}
      </div>
    </main>
  );
}
