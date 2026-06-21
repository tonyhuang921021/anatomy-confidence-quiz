"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { loadCompletedSessions } from "@/lib/storage";
import {
  getHomeWeakSectionInsight,
  MAX_HOME_WEAKNESS_ATTEMPTS,
  MAX_ROTATING_WEAK_SECTIONS,
  MIN_SECTION_ATTEMPTS_FOR_DIAGNOSIS,
  MIN_TOTAL_ATTEMPTS_FOR_DIAGNOSIS,
  type HomeWeakSectionInsight
} from "@/lib/homeWeakness";
import type { QuizSession } from "@/types/quiz";

const WEAKNESS_ROTATION_INTERVAL_MS = 6 * 60 * 60 * 1000;
const MAX_HOME_WEAKNESS_SESSIONS = 80;
const HOME_WEAKNESS_CACHE_KEY = "homeWeaknessLastGood";

type HomeWeaknessSnapshot = {
  totalAttempts: number;
  insights: HomeWeakSectionInsight[];
  generatedAt?: string;
  source?: "cloud" | "local" | "stale";
  updating?: boolean;
};

function getLocalWeaknessSnapshot(sessions: QuizSession[]): HomeWeaknessSnapshot {
  const attempts: Array<{
    questionId: string;
    isCorrect: boolean;
    confidence?: number | null;
  }> = [];
  for (
    let sessionIndex = sessions.length - 1, visitedSessions = 0;
    sessionIndex >= 0 && visitedSessions < MAX_HOME_WEAKNESS_SESSIONS && attempts.length < MAX_HOME_WEAKNESS_ATTEMPTS;
    sessionIndex -= 1, visitedSessions += 1
  ) {
    const sessionAttempts = sessions[sessionIndex].attempts;
    for (
      let attemptIndex = sessionAttempts.length - 1;
      attemptIndex >= 0 && attempts.length < MAX_HOME_WEAKNESS_ATTEMPTS;
      attemptIndex -= 1
    ) {
      const attempt = sessionAttempts[attemptIndex];
      attempts.push({
        questionId: attempt.questionId,
        isCorrect: attempt.isCorrect,
        confidence: attempt.confidence
      });
    }
  }

  return { ...getHomeWeakSectionInsight(attempts), source: "local" };
}

function loadCachedWeaknessSnapshot(): HomeWeaknessSnapshot | null {
  try {
    const raw = window.localStorage.getItem(HOME_WEAKNESS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as HomeWeaknessSnapshot;
    if (!Array.isArray(parsed.insights)) return null;
    return { ...parsed, source: "stale" };
  } catch {
    return null;
  }
}

function saveCachedWeaknessSnapshot(snapshot: HomeWeaknessSnapshot) {
  try {
    window.localStorage.setItem(
      HOME_WEAKNESS_CACHE_KEY,
      JSON.stringify({
        totalAttempts: snapshot.totalAttempts,
        insights: snapshot.insights,
        generatedAt: snapshot.generatedAt ?? new Date().toISOString()
      })
    );
  } catch {
    // Keep homepage rendering independent from storage quota failures.
  }
}

function getWeaknessRotationBucket() {
  return Math.floor(Date.now() / WEAKNESS_ROTATION_INTERVAL_MS);
}

function getNextWeaknessRotationDelay() {
  const nextBoundary = (getWeaknessRotationBucket() + 1) * WEAKNESS_ROTATION_INTERVAL_MS;
  return Math.max(nextBoundary - Date.now(), 60_000);
}

export function HomeWeaknessInsight() {
  const { session, syncVersion } = useAuth();
  const [sessions, setSessions] = useState<QuizSession[]>([]);
  const [cloudSnapshot, setCloudSnapshot] = useState<HomeWeaknessSnapshot | null>(null);
  const [loadingCloud, setLoadingCloud] = useState(false);
  const [cloudNotice, setCloudNotice] = useState("");
  const [rotationBucket, setRotationBucket] = useState(getWeaknessRotationBucket);

  useEffect(() => {
    function refreshSessions() {
      setSessions(loadCompletedSessions());
    }

    refreshSessions();
    window.addEventListener("completed-sessions-change", refreshSessions as EventListener);
    return () => {
      window.removeEventListener("completed-sessions-change", refreshSessions as EventListener);
    };
  }, [syncVersion]);

  useEffect(() => {
    let cancelled = false;
    const accessToken = session?.access_token;

    const cached = loadCachedWeaknessSnapshot();
    if (cached && !cloudSnapshot) {
      setCloudSnapshot(cached);
    }

    if (!accessToken) return;

    async function refreshCloudSnapshot() {
      setLoadingCloud(true);
      setCloudNotice("");
      try {
        const response = await fetch("/api/home-weakness", {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        });
        const payload = (await response.json().catch(() => null)) as
          | {
              ok?: boolean;
              degraded?: boolean;
              inactive?: boolean;
              message?: string;
              totalAttempts?: number;
              insights?: HomeWeakSectionInsight[];
              generatedAt?: string;
            }
          | null;

        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.message || "弱點判讀暫時讀不到");
        }

        if (cancelled) return;
        if (payload.inactive) {
          setCloudNotice("雲端弱點稍後更新，先用本機紀錄判讀。");
          return;
        }

        const nextSnapshot: HomeWeaknessSnapshot = {
          totalAttempts: Number(payload.totalAttempts ?? 0),
          insights: payload.insights ?? [],
          generatedAt: payload.generatedAt,
          source: payload.degraded ? "stale" : "cloud",
          updating: Boolean(payload.degraded)
        };
        setCloudSnapshot(nextSnapshot);
        if (nextSnapshot.insights.length > 0) saveCachedWeaknessSnapshot(nextSnapshot);
        if (payload.degraded) {
          setCloudNotice(payload.message || "雲端弱點更新中，先顯示稍早資料。");
        }
      } catch (error) {
        if (!cancelled) {
          setCloudNotice(error instanceof Error ? error.message : "雲端弱點更新中，先用本機紀錄。");
        }
      } finally {
        if (!cancelled) setLoadingCloud(false);
      }
    }

    void refreshCloudSnapshot();

    return () => {
      cancelled = true;
    };
  }, [session?.access_token, syncVersion]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setRotationBucket(getWeaknessRotationBucket());
    }, getNextWeaknessRotationDelay());

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [rotationBucket]);

  const localSnapshot = useMemo(() => getLocalWeaknessSnapshot(sessions), [sessions]);
  const snapshot = cloudSnapshot?.insights.length ? cloudSnapshot : localSnapshot;
  const { totalAttempts, insights } = snapshot;
  const insight = useMemo(() => {
    if (insights.length === 0) return null;
    const rotatingPool = insights.slice(0, MAX_ROTATING_WEAK_SECTIONS);
    return rotatingPool[rotationBucket % rotatingPool.length] ?? rotatingPool[0] ?? null;
  }, [insights, rotationBucket]);
  const neededAttempts = Math.max(MIN_TOTAL_ATTEMPTS_FOR_DIAGNOSIS - totalAttempts, 0);
  const sourceLabel =
    snapshot.source === "cloud"
      ? "雲端快照"
      : snapshot.source === "stale"
        ? "稍早快照"
        : "本機紀錄";
  const statusLabel = loadingCloud ? "更新中" : cloudNotice ? "暫用備援" : sourceLabel;

  if (!insight) {
    return (
      <div className="home-progress-card home-data-fade">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-slate-500">資料累積中</p>
            <h3 className="mt-1 text-base font-black text-ink">先作答，首頁才會判讀弱點</h3>
          </div>
          <span className="home-entry-mark">{loadingCloud ? "更新中" : `${totalAttempts} 題`}</span>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/70">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-500 to-amber-500 transition-all"
            style={{
              width: `${Math.min((totalAttempts / MIN_TOTAL_ATTEMPTS_FOR_DIAGNOSIS) * 100, 100)}%`
            }}
          />
        </div>
        <p className="body-soft mt-3 text-xs leading-6">
          至少累積 {MIN_TOTAL_ATTEMPTS_FOR_DIAGNOSIS} 題，且同一小節至少作答 {MIN_SECTION_ATTEMPTS_FOR_DIAGNOSIS} 題後，才會顯示「最容易漏」的判讀。
          {neededAttempts > 0 ? ` 還差 ${neededAttempts} 題。` : ""}
        </p>
        {cloudNotice ? <p className="mt-2 text-xs font-semibold text-amber-700">{cloudNotice}</p> : null}
        <Link href="/start" prefetch={false} className="mt-4 inline-flex text-sm font-bold text-brand-700">
          先刷一輪 →
        </Link>
      </div>
    );
  }

  return (
    <div className="home-progress-card home-data-fade">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold text-slate-500">
            依你的作答紀錄判讀
            <span className="ml-2 rounded-full bg-white/75 px-2 py-0.5 text-[10px] text-slate-500 ring-1 ring-slate-200">
              {statusLabel}
            </span>
          </p>
          <h3 className="mt-1 text-base font-black text-ink">{insight.section}</h3>
          <p className="body-soft mt-1 text-xs">{insight.chapter}</p>
        </div>
        <span className="home-entry-mark home-risk-chip">答錯率 {insight.wrongRate}%</span>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/70">
        <div
          className="home-progress-fill home-risk-fill"
          style={{ width: `${Math.max(insight.wrongRate, 8)}%` }}
        />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
        <div className="home-evidence-pill">
          <span>{insight.total}</span>
          <small>已作答</small>
        </div>
        <div className="home-evidence-pill home-evidence-risk">
          <span>{insight.wrong}</span>
          <small>答錯</small>
        </div>
        <div className="home-evidence-pill">
          <span>{insight.lowConfidence}</span>
          <small>低信心</small>
        </div>
      </div>

      <p className="body-soft mt-3 text-xs leading-6">
        依據：同小節作答數、答錯率、低信心題與錯誤自信題一起排序；不是模擬考限定。
      </p>
      {cloudNotice ? <p className="mt-2 text-xs font-semibold text-amber-700">{cloudNotice}</p> : null}
    </div>
  );
}
