"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { getHomeToneModePreference } from "@/lib/accountPreferences";
import { loadHomeToneMode, type HomeToneMode } from "@/lib/storage";

type CommunityStatsPoint = {
  date: string;
  attempts: number;
  correctRate: number;
};

const CALM_LINES = ["先寫幾題，看看還記得多少。"];
const ANXIOUS_LINES = ["今天全站已完成 {{todayQuestionCount}} 題。"];
const ANXIOUS_FALLBACK_LINES = ["先寫幾題，看看還記得多少。"];

function pickLine(lines: string[], seed: number) {
  return lines[Math.abs(seed) % lines.length] ?? lines[0] ?? "";
}

function getCalmLine() {
  const now = new Date();
  const halfDay = now.getHours() < 12 ? 0 : 1;
  const index = ((now.getFullYear() * 372 + (now.getMonth() + 1) * 31 + now.getDate()) * 2 + halfDay) % CALM_LINES.length;
  return CALM_LINES[index] ?? "";
}

function getTaipeiDateKey(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
}

function getTodayCommunityAttempts(points: CommunityStatsPoint[]) {
  const todayKey = getTaipeiDateKey(new Date());
  for (let index = points.length - 1; index >= 0; index -= 1) {
    const point = points[index];
    if (point?.date === todayKey && Number.isFinite(point.attempts)) {
      return Math.max(0, Math.round(point.attempts));
    }
  }
  return null;
}

function insertTodayQuestionCount(line: string, count: number) {
  return line.replace(/\{\{todayQuestionCount\}\}/g, count.toLocaleString("zh-TW"));
}

const ANXIOUS_LINE_ROTATION_MS = 12 * 60 * 1000;
const ANXIOUS_STATS_REFRESH_MS = 15 * 60 * 1000;
const HOME_COMMUNITY_STATS_CACHE_KEY = "homeCommunityStatsLastGood:v2";

function getAnxiousLineBucket(now = new Date()) {
  return Math.floor(now.getTime() / ANXIOUS_LINE_ROTATION_MS);
}

function loadCachedCommunityStats() {
  try {
    const raw = window.localStorage.getItem(HOME_COMMUNITY_STATS_CACHE_KEY);
    if (!raw) return [] as CommunityStatsPoint[];
    const parsed = JSON.parse(raw) as { points?: CommunityStatsPoint[] };
    return Array.isArray(parsed.points) ? parsed.points : [];
  } catch {
    return [] as CommunityStatsPoint[];
  }
}

function saveCachedCommunityStats(points: CommunityStatsPoint[]) {
  try {
    window.localStorage.setItem(
      HOME_COMMUNITY_STATS_CACHE_KEY,
      JSON.stringify({ points, updatedAt: new Date().toISOString() })
    );
  } catch {
    // Ignore localStorage quota and private-mode failures.
  }
}

export function HomeToneBanner() {
  const { user } = useAuth();
  const [mode, setMode] = useState<HomeToneMode>("calm");
  const [stats, setStats] = useState<CommunityStatsPoint[]>([]);
  const [calmLine, setCalmLine] = useState(CALM_LINES[0] ?? "");
  const [anxiousLineBucket, setAnxiousLineBucket] = useState(0);

  useEffect(() => {
    setCalmLine(getCalmLine());
    setMode(getHomeToneModePreference(user?.user_metadata) ?? loadHomeToneMode());

    function handleModeChange(event: Event) {
      const detail = (event as CustomEvent<HomeToneMode>).detail;
      setMode(detail === "anxious" ? "anxious" : "calm");
    }

    window.addEventListener("home-tone-mode-change", handleModeChange as EventListener);
    return () => {
      window.removeEventListener("home-tone-mode-change", handleModeChange as EventListener);
    };
  }, [user?.id, user?.user_metadata]);

  useEffect(() => {
    if (mode !== "anxious") return;

    setAnxiousLineBucket(getAnxiousLineBucket());
    const intervalId = window.setInterval(() => {
      setAnxiousLineBucket(getAnxiousLineBucket());
    }, ANXIOUS_LINE_ROTATION_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [mode]);

  useEffect(() => {
    if (mode !== "anxious") return;

    let cancelled = false;
    const cached = loadCachedCommunityStats();
    if (cached.length > 0) setStats(cached);

    async function refreshStats() {
      try {
        const response = await fetch("/api/community-stats?days=2");
        const payload = (await response.json().catch(() => null)) as
          | { ok?: boolean; degraded?: boolean; points?: CommunityStatsPoint[] }
          | null;
        if (!response.ok || !payload?.ok || !payload.points) return;
        if (!cancelled && payload.points.length > 0) {
          setStats(payload.points);
          if (!payload.degraded) saveCachedCommunityStats(payload.points);
        }
      } catch {
        // The fallback copy is intentionally complete without community stats.
      }
    }

    void refreshStats();
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshStats();
    }, ANXIOUS_STATS_REFRESH_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [mode]);

  const body = useMemo(() => {
    if (mode === "calm") return calmLine;

    const todayAttempts = getTodayCommunityAttempts(stats);
    if (todayAttempts === null) {
      return pickLine(ANXIOUS_FALLBACK_LINES, anxiousLineBucket);
    }

    const line = pickLine(ANXIOUS_LINES, anxiousLineBucket + todayAttempts);
    return insertTodayQuestionCount(line, todayAttempts);
  }, [anxiousLineBucket, calmLine, mode, stats]);

  return (
    <div className="home-tone-line home-data-fade mt-5">
      <p className={`body-soft whitespace-pre-line text-sm leading-7 sm:text-[15px]${mode === "calm" ? " home-tone-handwriting" : ""}`}>{body}</p>
    </div>
  );
}
