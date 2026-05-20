"use client";

import { LeaderboardEntry } from "@/types/quiz";

function formatUpdatedAt(value?: string) {
  if (!value) return "尚未同步";
  return new Date(value).toLocaleString("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

type LeaderboardTableProps = {
  entries: LeaderboardEntry[];
  currentUserId?: string;
  sortMode: "attempts" | "accuracy";
};

export function LeaderboardTable({ entries, currentUserId, sortMode }: LeaderboardTableProps) {
  if (entries.length === 0) {
    return (
      <section className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100">
        <h2 className="text-2xl font-semibold text-ink">刷題榜</h2>
        <p className="mt-3 text-sm text-slate-500">目前還沒有可顯示的上榜資料。</p>
      </section>
    );
  }

  return (
    <section className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-ink">刷題榜</h2>
          <p className="mt-2 text-sm text-slate-500">
            {sortMode === "attempts"
              ? "先依總答題量排序，答題量相同時再看正確率。"
              : "先依正確率排序，正確率相同時再看總答題量。"}
          </p>
        </div>
        <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
          共 <span className="font-semibold">{entries.length}</span> 位上榜
        </div>
      </div>

      <div className="mt-5 grid gap-4">
        {entries.map((entry, index) => {
          const isCurrentUser = currentUserId === entry.userId;
          const isChampion = index === 0;
          return (
            <article
              key={entry.userId}
              className={`relative overflow-hidden rounded-3xl border p-5 ${
                isChampion
                  ? "border-amber-300 bg-[radial-gradient(circle_at_top_right,_rgba(251,191,36,0.18),_rgba(255,251,235,0.92)_45%,_rgba(255,255,255,1)_80%)] shadow-[0_18px_45px_rgba(245,158,11,0.12)]"
                  : index < 3
                  ? "border-amber-200 bg-amber-50/70"
                  : isCurrentUser
                    ? "border-brand-200 bg-brand-50/70"
                    : "border-slate-200 bg-slate-50"
              }`}
            >
              <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
                        isChampion
                          ? "bg-amber-100 text-amber-950 ring-amber-300"
                          : "bg-white text-slate-700 ring-slate-200"
                      }`}
                    >
                      第 {index + 1} 名
                    </span>
                    {isCurrentUser ? (
                      <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-800">
                        你
                      </span>
                    ) : null}
                  </div>
                  <h3 className="mt-3 break-words text-xl font-semibold text-ink">{entry.displayName}</h3>
                  <p className="mt-2 text-sm text-slate-500">最近同步：{formatUpdatedAt(entry.updatedAt)}</p>
                </div>
                <div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-700">
                  正確率 <span className="font-semibold">{entry.correctRate}%</span>
                </div>
              </div>

              <div className="relative z-10 mt-4 grid gap-3 sm:grid-cols-3">
                <p className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-700">
                  總答題量 <span className="font-semibold">{entry.totalAttempts}</span>
                </p>
                <p className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-700">
                  答對題數 <span className="font-semibold">{entry.correctAttempts}</span>
                </p>
                <p className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-700">
                  完成場次 <span className="font-semibold">{entry.totalSessions}</span>
                </p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
