"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import {
  OwnerClassificationReportEntry,
  OwnerDailyPoint,
  OwnerDashboardStats,
  OwnerExplanationUsageEntry,
  OwnerHourlyPoint,
  OwnerTopAttemptVisitorEntry
} from "@/types/quiz";

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

type OwnerApiPayload = {
  ok: boolean;
  message?: string;
  stats?: OwnerDashboardStats;
  dailySeries?: OwnerDailyPoint[];
  hourlySeries?: OwnerHourlyPoint[];
  explanationUsage?: OwnerExplanationUsageEntry[];
  topVisitors?: OwnerTopAttemptVisitorEntry[];
  classificationReports?: OwnerClassificationReportEntry[];
};

function formatUpdatedAt(value: string) {
  return new Date(value).toLocaleString("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

const GPT_5_MINI_INPUT_USD_PER_MILLION = 0.25;
const GPT_5_MINI_OUTPUT_USD_PER_MILLION = 2.0;
const APPROX_USD_TO_TWD = 32.5;

function estimateTwdFromTokens(inputTokens: number, outputTokens: number) {
  const usd =
    (inputTokens * GPT_5_MINI_INPUT_USD_PER_MILLION) / 1_000_000 +
    (outputTokens * GPT_5_MINI_OUTPUT_USD_PER_MILLION) / 1_000_000;
  return usd * APPROX_USD_TO_TWD;
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
          const labelY = y <= 28 ? y + 18 : y - 12;
          return (
            <g key={`${valueKey}-${item.date}`}>
              <circle cx={x} cy={y} r="4.5" fill={stroke} />
              <text
                x={x}
                y={labelY}
                textAnchor="middle"
                fontSize="11"
                fontWeight="700"
                fill={stroke}
                stroke="rgba(255,255,255,0.92)"
                strokeWidth="4"
                paintOrder="stroke"
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

function HourlyActivityBarChart({ data }: { data: OwnerHourlyPoint[] }) {
  const maxAttempts = Math.max(...data.map((item) => item.attempts), 1);

  return (
    <div className="rounded-3xl bg-slate-50 p-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-6">
        {data.map((item) => {
          const heightPercent = (item.attempts / maxAttempts) * 100;
          return (
            <div key={`hour-${item.hour}`} className="rounded-2xl bg-white p-3 ring-1 ring-slate-100">
              <p className="text-xs font-semibold text-slate-500">{String(item.hour).padStart(2, "0")}:00</p>
              <div className="mt-3 flex h-24 items-end rounded-xl bg-slate-50 px-2 py-2">
                <div
                  className="w-full rounded-lg bg-brand-600/85"
                  style={{ height: `${Math.max(heightPercent, item.attempts > 0 ? 12 : 0)}%` }}
                />
              </div>
              <p className="mt-2 text-sm font-semibold text-ink">{item.attempts} 題</p>
              <p className="text-xs text-slate-500">{item.devices} 台裝置</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function OwnerPage() {
  const { configured, loading, session, user } = useAuth();
  const [stats, setStats] = useState<OwnerDashboardStats | null>(null);
  const [dailySeries, setDailySeries] = useState<OwnerDailyPoint[]>([]);
  const [hourlySeries, setHourlySeries] = useState<OwnerHourlyPoint[]>([]);
  const [explanationUsage, setExplanationUsage] = useState<OwnerExplanationUsageEntry[]>([]);
  const [topVisitors, setTopVisitors] = useState<OwnerTopAttemptVisitorEntry[]>([]);
  const [classificationReports, setClassificationReports] = useState<OwnerClassificationReportEntry[]>([]);
  const [approvingReportId, setApprovingReportId] = useState<string | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState("");
  const allowed = useMemo(() => isAllowedEmail(user?.email), [user?.email]);
  const hasAllowlist = getAllowedEmails().length > 0;

  async function fetchOwnerData(accessToken: string) {
    const response = await fetch("/api/owner", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ accessToken })
    });

    const payload = (await response.json().catch(() => null)) as OwnerApiPayload | null;

    if (!response.ok || !payload?.ok || !payload.stats) {
      throw new Error(payload?.message || "數據載入失敗");
    }

    return payload;
  }

  async function handleApproveClassificationReport(reportId: string) {
    if (!session?.access_token) return;

    try {
      setApprovingReportId(reportId);
      setError("");
      const response = await fetch("/api/owner/classification-approve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          accessToken: session.access_token,
          reportId
        })
      });

      const payload = (await response.json().catch(() => null)) as
        | {
            ok?: boolean;
            message?: string;
            appliedAt?: string;
            approvedByEmail?: string;
          }
        | null;

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.message || "確認套用失敗");
      }

      setClassificationReports((current) =>
        current.map((report) =>
          report.id === reportId
            ? {
                ...report,
                appliedAt: payload.appliedAt ?? new Date().toISOString(),
                approvedByEmail: payload.approvedByEmail ?? user?.email ?? undefined
              }
            : report
        )
      );
    } catch (approveError) {
      setError(approveError instanceof Error ? approveError.message : "確認套用失敗");
    } finally {
      setApprovingReportId(null);
    }
  }

  useEffect(() => {
    async function fetchStats() {
      if (!configured || !user || !allowed || !session?.access_token) {
        setStats(null);
        setStatsLoading(false);
        return;
      }

      try {
        setStatsLoading(true);
        setError("");
        const payload = await fetchOwnerData(session.access_token);
        setStats(payload.stats ?? null);
        setDailySeries(payload.dailySeries ?? []);
        setHourlySeries(payload.hourlySeries ?? []);
        setExplanationUsage(payload.explanationUsage ?? []);
        setTopVisitors(payload.topVisitors ?? []);
        setClassificationReports(payload.classificationReports ?? []);
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : "數據載入失敗");
      } finally {
        setStatsLoading(false);
      }
    }

    void fetchStats();
  }, [allowed, configured, session?.access_token, user]);

  useEffect(() => {
    if (!configured || !user || !allowed || !session?.access_token) return;

    const refresh = async () => {
      try {
        const payload = await fetchOwnerData(session.access_token);
        setStats(payload.stats ?? null);
        setDailySeries(payload.dailySeries ?? []);
        setHourlySeries(payload.hourlySeries ?? []);
        setExplanationUsage(payload.explanationUsage ?? []);
        setTopVisitors(payload.topVisitors ?? []);
        setClassificationReports(payload.classificationReports ?? []);
      } catch {
        // keep existing view
      }
    };

    const intervalId = window.setInterval(() => {
      void refresh();
    }, 30000);

    const handleFocus = () => {
      void refresh();
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleFocus);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleFocus);
    };
  }, [allowed, configured, session?.access_token, user]);

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
            {(() => {
              const topHours = [...hourlySeries]
                .sort((a, b) => b.attempts - a.attempts || b.devices - a.devices)
                .slice(0, 3)
                .filter((item) => item.attempts > 0);

              return (
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
              <article className="rounded-3xl bg-white p-5 shadow-card ring-1 ring-slate-100">
                <p className="text-sm text-slate-500">AI 詳解總生成題數</p>
                <p className="mt-2 text-3xl font-bold text-ink">{stats.aiExplanationCount}</p>
              </article>
              <article className="rounded-3xl bg-white p-5 shadow-card ring-1 ring-slate-100">
                <p className="text-sm text-slate-500">AI 詳解累積 Input Tokens</p>
                <p className="mt-2 text-3xl font-bold text-ink">{stats.aiExplanationInputTokens.toLocaleString()}</p>
              </article>
              <article className="rounded-3xl bg-white p-5 shadow-card ring-1 ring-slate-100">
                <p className="text-sm text-slate-500">AI 詳解累積 Output Tokens</p>
                <p className="mt-2 text-3xl font-bold text-ink">{stats.aiExplanationOutputTokens.toLocaleString()}</p>
              </article>
              <article className="rounded-3xl bg-white p-5 shadow-card ring-1 ring-slate-100">
                <p className="text-sm text-slate-500">AI 詳解累積總 Tokens</p>
                <p className="mt-2 text-3xl font-bold text-ink">{stats.aiExplanationTotalTokens.toLocaleString()}</p>
              </article>
              <article className="rounded-3xl bg-white p-5 shadow-card ring-1 ring-slate-100">
                <p className="text-sm text-slate-500">AI 詳解累積約台幣</p>
                <p className="mt-2 text-3xl font-bold text-ink">
                  NT$ {estimateTwdFromTokens(stats.aiExplanationInputTokens, stats.aiExplanationOutputTokens).toFixed(2)}
                </p>
              </article>
              <article className="rounded-3xl bg-white p-5 shadow-card ring-1 ring-slate-100 md:col-span-2 xl:col-span-3">
                <p className="text-sm text-slate-500">大家最常做題的時段</p>
                <p className="mt-2 text-base font-semibold text-ink">
                  {topHours.length > 0
                    ? topHours
                        .map((item) => `${String(item.hour).padStart(2, "0")}:00（${item.attempts} 題 / ${item.devices} 台）`)
                        .join("、")
                    : "目前還沒有足夠資料"}
                </p>
              </article>
            </div>
              );
            })()}

            <section className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-ink">做題前 5 多的訪客</h2>
                  <p className="mt-2 text-sm text-slate-500">依累積作答題數排序，方便你快速看最活躍的裝置。</p>
                </div>
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-slate-500">
                    <tr className="border-b border-slate-200">
                      <th className="px-3 py-3 font-semibold">排名</th>
                      <th className="px-3 py-3 font-semibold">訪客裝置</th>
                      <th className="px-3 py-3 font-semibold">累積作答題數</th>
                      <th className="px-3 py-3 font-semibold">最近作答</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topVisitors.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-6 text-center text-slate-500">
                          目前還沒有足夠資料。
                        </td>
                      </tr>
                    ) : (
                      topVisitors.map((entry, index) => (
                        <tr key={entry.visitorId ?? entry.label} className="border-b border-slate-100 last:border-b-0">
                          <td className="px-3 py-3 font-semibold text-ink">#{index + 1}</td>
                          <td className="px-3 py-3 font-medium text-ink">{entry.label}</td>
                          <td className="px-3 py-3 text-slate-700">{entry.attempts}</td>
                          <td className="px-3 py-3 text-slate-500">
                            {entry.lastAttemptedAt ? formatUpdatedAt(entry.lastAttemptedAt) : "—"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100">
              <div className="grid gap-6">
                <div>
                  <h2 className="text-lg font-semibold text-ink">大家做題的時間分布</h2>
                  <p className="mt-2 text-sm text-slate-500">最近 7 天，大家大多在哪些時段做題。</p>
                  <div className="mt-4">
                    <HourlyActivityBarChart data={hourlySeries} />
                  </div>
                </div>
              </div>
            </section>

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
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-ink">AI 詳解使用統計</h2>
                  <p className="mt-2 text-sm text-slate-500">看誰總共用了多少題詳解，以及花了多少 token。</p>
                </div>
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-slate-500">
                    <tr className="border-b border-slate-200">
                      <th className="px-3 py-3 font-semibold">使用者 / 裝置</th>
                      <th className="px-3 py-3 font-semibold">詳解題數</th>
                      <th className="px-3 py-3 font-semibold">Input</th>
                      <th className="px-3 py-3 font-semibold">Output</th>
                      <th className="px-3 py-3 font-semibold">總 Tokens</th>
                      <th className="px-3 py-3 font-semibold">約台幣</th>
                      <th className="px-3 py-3 font-semibold">最後使用</th>
                    </tr>
                  </thead>
                  <tbody>
                    {explanationUsage.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-3 py-6 text-center text-slate-500">
                          目前還沒有 AI 詳解使用紀錄。
                        </td>
                      </tr>
                    ) : (
                      explanationUsage.map((entry) => (
                        <tr key={`${entry.userEmail ?? entry.visitorId ?? entry.label}`} className="border-b border-slate-100 last:border-b-0">
                          <td className="px-3 py-3 font-medium text-ink">{entry.label}</td>
                          <td className="px-3 py-3 text-slate-700">{entry.explanationCount}</td>
                          <td className="px-3 py-3 text-slate-700">{entry.inputTokens.toLocaleString()}</td>
                          <td className="px-3 py-3 text-slate-700">{entry.outputTokens.toLocaleString()}</td>
                          <td className="px-3 py-3 text-slate-700">{entry.totalTokens.toLocaleString()}</td>
                          <td className="px-3 py-3 text-slate-700">
                            NT$ {estimateTwdFromTokens(entry.inputTokens, entry.outputTokens).toFixed(2)}
                          </td>
                          <td className="px-3 py-3 text-slate-500">
                            {entry.lastUsedAt ? formatUpdatedAt(entry.lastUsedAt) : "—"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-ink">分類更動回報</h2>
                  <p className="mt-2 text-sm text-slate-500">看誰回報了哪一題分類有問題，以及 AI 建議改分到哪裡。</p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  {classificationReports.length} 筆
                </span>
              </div>
              <div className="mt-4 grid gap-3">
                {classificationReports.length === 0 ? (
                  <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
                    目前還沒有分類更動回報。
                  </div>
                ) : (
                  classificationReports.map((report) => (
                    <article key={report.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-ink">{report.questionId}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            回報者：{report.reporterLabel} ・ {formatUpdatedAt(report.createdAt)}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {report.appliedAt ? (
                            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                              已套用
                            </span>
                          ) : null}
                          {report.model ? (
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                              {report.model}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div className="mt-3 grid gap-2 text-sm text-slate-700">
                        <p>
                          <span className="font-semibold">目前分類：</span>
                          {report.currentSubject}
                          {report.currentChapter ? ` / ${report.currentChapter}` : ""}
                          {report.currentSection ? ` / ${report.currentSection}` : ""}
                        </p>
                        <p>
                          <span className="font-semibold">AI 建議：</span>
                          {report.suggestedSubject ?? "未判定"}
                          {report.suggestedChapter ? ` / ${report.suggestedChapter}` : ""}
                          {report.suggestedSection ? ` / ${report.suggestedSection}` : ""}
                        </p>
                        {report.reason ? (
                          <p>
                            <span className="font-semibold">原因：</span>
                            {report.reason}
                          </p>
                        ) : null}
                        {report.appliedAt ? (
                          <p>
                            <span className="font-semibold">套用時間：</span>
                            {formatUpdatedAt(report.appliedAt)}
                            {report.approvedByEmail ? ` ・ ${report.approvedByEmail}` : ""}
                          </p>
                        ) : null}
                      </div>
                      <div className="mt-4 flex justify-end">
                        <button
                          type="button"
                          onClick={() => void handleApproveClassificationReport(report.id)}
                          disabled={Boolean(report.appliedAt) || approvingReportId === report.id}
                          className="min-h-10 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:bg-slate-300"
                        >
                          {report.appliedAt
                            ? "已正式套用"
                            : approvingReportId === report.id
                              ? "套用中..."
                              : "確認後正式套用到題庫 override"}
                        </button>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100">
              <p className="text-sm text-slate-500">
                最後更新：<span className="font-semibold text-slate-700">{formatUpdatedAt(stats.updatedAt)}</span>
              </p>
              <p className="mt-2 text-sm text-slate-500">
                在線估算為最近 2 分鐘內仍有活動的裝置；作答裝置與題數只統計已同步到雲端的作答。
              </p>
              <p className="mt-2 text-sm text-slate-500">
                AI 詳解台幣換算使用 GPT-5-mini 目前價格估算，並以 1 USD ≈ 32.5 TWD 粗估。
              </p>
            </section>
          </div>
        ) : null}
      </section>
    </main>
  );
}
