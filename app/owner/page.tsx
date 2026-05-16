"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { loadOwnerDailySeries, loadOwnerDashboardStats } from "@/lib/cloudSync";
import { OwnerDailyPoint, OwnerDashboardStats } from "@/types/quiz";

function getAllowedEmails() {
  const raw = process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "";
  return raw
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function isAllowedEmail(email?: string | null) {
  if (!email) return false;
  return getAllowedEmails().includes(email.trim().toLowerCase());
}

function formatUpdatedAt(value: string) {
  return new Date(value).toLocaleString("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function TinyLineChart({
  data,
  tone,
  valueKey,
  title
}: {
  data: OwnerDailyPoint[];
  tone: "brand" | "amber";
  valueKey: "attempts" | "devices";
  title: string;
}) {
  const width = 560;
  const height = 180;
  const padding = 20;
  const values = data.map((item) => item[valueKey]);
  const maxValue = Math.max(...values, 1);
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;

  const points = data.map((item, index) => {
    const x = padding + (index / Math.max(data.length - 1, 1)) * innerWidth;
    const y = padding + innerHeight - (item[valueKey] / maxValue) * innerHeight;
    return `${x},${y}`;
  });

  const stroke = tone === "brand" ? "#0f766e" : "#d97706";
  const fill = tone === "brand" ? "rgba(15, 118, 110, 0.10)" : "rgba(217, 119, 6, 0.10)";
  const areaPoints = [`${padding},${height - padding}`, ...points, `${width - padding},${height - padding}`].join(" ");

  return (
    <div className="overflow-hidden rounded-3xl bg-slate-50 p-4">
      <div className="mb-3 flex items-center justify-between text-xs font-semibold">
        <span className="text-slate-500">{title}</span>
        <span style={{ color: stroke }}>最高 {maxValue}</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-44 w-full">
        <polygon points={areaPoints} fill={fill} />
        <polyline
          points={points.join(" ")}
          fill="none"
          stroke={stroke}
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {data.map((item, index) => {
          const x = padding + (index / Math.max(data.length - 1, 1)) * innerWidth;
          const y = padding + innerHeight - (item[valueKey] / maxValue) * innerHeight;
          return (
            <g key={`${valueKey}-${item.date}`}>
              <circle cx={x} cy={y} r="4.5" fill={stroke} />
              <text
                x={x}
                y={Math.max(14, y - 10)}
                textAnchor="middle"
                fontSize="11"
                fontWeight="700"
                fill={stroke}
              >
                {item[valueKey]}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="mt-3 flex justify-between gap-2 overflow-hidden text-[11px] text-slate-500">
        {data.map((item, index) => (
          <span key={`${valueKey}-label-${item.date}`} className={index % 2 === 1 ? "opacity-60" : ""}>
            {item.date.slice(5)}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function OwnerPage() {
  const { configured, loading, user } = useAuth();
  const [stats, setStats] = useState<OwnerDashboardStats | null>(null);
  const [dailySeries, setDailySeries] = useState<OwnerDailyPoint[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState("");
  const allowed = useMemo(() => isAllowedEmail(user?.email), [user?.email]);
  const hasAllowlist = getAllowedEmails().length > 0;

  useEffect(() => {
    async function fetchStats() {
      if (!configured || !user || !allowed) {
        setStats(null);
        setStatsLoading(false);
        return;
      }

      try {
        setStatsLoading(true);
        setError("");
        const [nextStats, nextSeries] = await Promise.all([
          loadOwnerDashboardStats(),
          loadOwnerDailySeries(14)
        ]);
        setStats(nextStats);
        setDailySeries(nextSeries);
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : "數據載入失敗");
      } finally {
        setStatsLoading(false);
      }
    }

    void fetchStats();
  }, [allowed, configured, user]);

  return (
    <main className="shell">
      <section className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">Private Analytics</p>
            <h1 className="mt-2 text-3xl font-bold text-ink sm:text-4xl">私有數據頁</h1>
            <p className="mt-3 text-slate-500">
              只看你真正需要的數字：訪客裝置、作答裝置、同步用戶與最近作答量。
            </p>
          </div>
          <Link
            href="/"
            className="min-h-12 rounded-2xl bg-slate-100 px-5 py-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-200"
          >
            返回首頁
          </Link>
        </div>
      </section>

      <section className="mt-8">
        {!configured ? (
          <div className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100">
            請先完成 Supabase 設定。
          </div>
        ) : loading ? (
          <div className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100">
            正在確認登入狀態...
          </div>
        ) : !user ? (
          <div className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100">
            請先登入你的帳號。
          </div>
        ) : !hasAllowlist ? (
          <div className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100">
            <h2 className="text-xl font-semibold text-ink">尚未設定私有白名單</h2>
            <p className="mt-3 text-sm text-slate-600">
              請在 `.env.local` 或 Vercel 環境變數加入 `NEXT_PUBLIC_ADMIN_EMAILS=你的email`。
            </p>
          </div>
        ) : !allowed ? (
          <div className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100">
            <h2 className="text-xl font-semibold text-ink">你目前沒有權限查看這個頁面</h2>
            <p className="mt-3 text-sm text-slate-600">目前登入帳號：{user.email}</p>
          </div>
        ) : statsLoading ? (
          <div className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100">
            數據載入中...
          </div>
        ) : error ? (
          <div className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100">
            <h2 className="text-xl font-semibold text-ink">數據載入失敗</h2>
            <p className="mt-3 text-sm text-rose-700">{error}</p>
          </div>
        ) : stats ? (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <article className="rounded-3xl bg-white p-5 shadow-card ring-1 ring-slate-100">
                <p className="text-sm text-slate-500">總訪客裝置數</p>
                <p className="mt-2 text-3xl font-bold text-ink">{stats.totalVisitorDevices}</p>
              </article>
              <article className="rounded-3xl bg-white p-5 shadow-card ring-1 ring-slate-100">
                <p className="text-sm text-slate-500">有做過題的裝置數</p>
                <p className="mt-2 text-3xl font-bold text-ink">{stats.totalAttemptDevices}</p>
              </article>
              <article className="rounded-3xl bg-white p-5 shadow-card ring-1 ring-slate-100">
                <p className="text-sm text-slate-500">今天有做題的裝置數</p>
                <p className="mt-2 text-3xl font-bold text-ink">{stats.attemptDevicesToday}</p>
              </article>
              <article className="rounded-3xl bg-white p-5 shadow-card ring-1 ring-slate-100">
                <p className="text-sm text-slate-500">目前在線估算</p>
                <p className="mt-2 text-3xl font-bold text-ink">{stats.onlineVisitors}</p>
              </article>
              <article className="rounded-3xl bg-white p-5 shadow-card ring-1 ring-slate-100">
                <p className="text-sm text-slate-500">總同步用戶數</p>
                <p className="mt-2 text-3xl font-bold text-ink">{stats.totalSyncedUsers}</p>
              </article>
              <article className="rounded-3xl bg-white p-5 shadow-card ring-1 ring-slate-100">
                <p className="text-sm text-slate-500">今天大家做了幾題</p>
                <p className="mt-2 text-3xl font-bold text-ink">{stats.attemptsToday}</p>
              </article>
              <article className="rounded-3xl bg-white p-5 shadow-card ring-1 ring-slate-100">
                <p className="text-sm text-slate-500">近 7 天總作答題數</p>
                <p className="mt-2 text-3xl font-bold text-ink">{stats.attemptsLast7Days}</p>
              </article>
              <article className="rounded-3xl bg-white p-5 shadow-card ring-1 ring-slate-100">
                <p className="text-sm text-slate-500">全站累積總作答題數</p>
                <p className="mt-2 text-3xl font-bold text-ink">{stats.totalAttempts}</p>
              </article>
            </div>

            <section className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100">
              <div className="grid gap-6 xl:grid-cols-2">
                <div>
                  <h2 className="text-lg font-semibold text-ink">每日作答題數</h2>
                  <p className="mt-2 text-sm text-slate-500">最近 14 天，大家每天總共做了幾題。</p>
                  <div className="mt-4">
                    <TinyLineChart
                      data={dailySeries}
                      tone="brand"
                      valueKey="attempts"
                      title="每日題數"
                    />
                  </div>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-ink">每日作答裝置數</h2>
                  <p className="mt-2 text-sm text-slate-500">最近 14 天，每天有幾個不同裝置實際作答。</p>
                  <div className="mt-4">
                    <TinyLineChart
                      data={dailySeries}
                      tone="amber"
                      valueKey="devices"
                      title="每日作答裝置"
                    />
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100">
              <p className="text-sm text-slate-500">
                最後更新：<span className="font-semibold text-slate-700">{formatUpdatedAt(stats.updatedAt)}</span>
              </p>
              <p className="mt-2 text-sm text-slate-500">
                在線估算為最近 2 分鐘內仍有活動的裝置；作答裝置與題數只統計已同步到雲端的作答。
              </p>
            </section>
          </div>
        ) : null}
      </section>
    </main>
  );
}
