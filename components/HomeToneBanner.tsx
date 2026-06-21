"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { getHomeToneModePreference } from "@/lib/accountPreferences";
import { loadCompletedSessions, loadCurrentSession, loadHomeToneMode, type HomeToneMode } from "@/lib/storage";

const CALM_LINES = [
  "現在的不穩，不代表你不行，只代表你正在把縫補起來。",
  "今天先把一個洞補好，就已經在贏昨天的自己。",
  "國考不是拚每題都會，是拚把常錯的地方慢慢變少。",
  "你不是落後，你是在把不熟的地方一格一格照亮。",
  "先把手上的十題做好，焦慮自然會比昨天少一點。",
  "會怕很正常，但你還在往前，這件事本身就很強。",
  "每次願意再點進來刷題，都是在替未來的自己減壓。",
  "今天讀得慢也沒關係，穩穩把弱點逼出來就夠了。"
];

function getCalmLine() {
  const now = new Date();
  const halfDay = now.getHours() < 12 ? 0 : 1;
  const index = ((now.getFullYear() * 372 + (now.getMonth() + 1) * 31 + now.getDate()) * 2 + halfDay) % CALM_LINES.length;
  return CALM_LINES[index];
}

type PersonalPaceStats = {
  todayAttempts: number;
  yesterdayAttempts: number;
  sevenDayAttempts: number;
  activeDays: number;
  correctRate: number | null;
};

function getTaipeiDateKey(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

const MAX_PERSONAL_PACE_SESSIONS = 80;

function getPersonalPaceStats(now = new Date()): PersonalPaceStats {
  const todayKey = getTaipeiDateKey(now);
  const yesterdayKey = getTaipeiDateKey(addDays(now, -1));
  const recentKeys = new Set(Array.from({ length: 7 }, (_, index) => getTaipeiDateKey(addDays(now, -index))));
  const oldestRecentKey = getTaipeiDateKey(addDays(now, -6));
  const dayCounts = new Map<string, { attempts: number; correct: number }>();

  function trackAttempt(attempt: { answeredAt: string; isCorrect: boolean }) {
    const key = getTaipeiDateKey(attempt.answeredAt);
    if (!key || !recentKeys.has(key)) return;
    const current = dayCounts.get(key) ?? { attempts: 0, correct: 0 };
    current.attempts += 1;
    current.correct += attempt.isCorrect ? 1 : 0;
    dayCounts.set(key, current);
  }

  const currentSession = loadCurrentSession();
  currentSession?.attempts?.forEach(trackAttempt);

  const sessions = loadCompletedSessions();
  let visitedSessions = 0;
  for (let index = sessions.length - 1; index >= 0 && visitedSessions < MAX_PERSONAL_PACE_SESSIONS; index -= 1) {
    const session = sessions[index];
    const sessionKey = getTaipeiDateKey(session.completedAt ?? session.startedAt);
    if (sessionKey && sessionKey < oldestRecentKey) break;
    visitedSessions += 1;

    for (let attemptIndex = session.attempts.length - 1; attemptIndex >= 0; attemptIndex -= 1) {
      const attempt = session.attempts[attemptIndex];
      const attemptKey = getTaipeiDateKey(attempt.answeredAt);
      if (attemptKey && attemptKey < oldestRecentKey) break;
      trackAttempt(attempt);
    }
  }

  const today = dayCounts.get(todayKey) ?? { attempts: 0, correct: 0 };
  const yesterday = dayCounts.get(yesterdayKey) ?? { attempts: 0, correct: 0 };
  const sevenDay = Array.from(dayCounts.values()).reduce(
    (sum, item) => ({
      attempts: sum.attempts + item.attempts,
      correct: sum.correct + item.correct
    }),
    { attempts: 0, correct: 0 }
  );

  return {
    todayAttempts: today.attempts,
    yesterdayAttempts: yesterday.attempts,
    sevenDayAttempts: sevenDay.attempts,
    activeDays: Array.from(dayCounts.values()).filter((item) => item.attempts > 0).length,
    correctRate: sevenDay.attempts > 0 ? Math.round((sevenDay.correct / sevenDay.attempts) * 1000) / 10 : null
  };
}

function pickLine(lines: string[], seed: number) {
  return lines[Math.abs(seed) % lines.length] ?? lines[0] ?? "";
}

const ANXIOUS_LINE_ROTATION_MS = 12 * 60 * 1000;

function getAnxiousLineBucket(now = new Date()) {
  return Math.floor(now.getTime() / ANXIOUS_LINE_ROTATION_MS);
}

function getTaipeiHour(now = new Date()) {
  return Number(
    now.toLocaleTimeString("en-US", {
      timeZone: "Asia/Taipei",
      hour: "2-digit",
      hour12: false
    })
  );
}

function getTimePressureLine(todayAttempts: number, seed: number) {
  const hour = getTaipeiHour();

  if (hour < 8) {
    return pickLine(
      [
        `清晨適合偷跑，不適合滑掉。先把今天第一輪刷起來。`,
        `早上腦子還沒被世界污染，拿來做題，不要拿來發呆。`,
        `現在還早，今天先卡 ${Math.max(20 - todayAttempts, 0)} 題基本盤，不要一醒來就欠債。`
      ],
      seed
    );
  }

  if (hour < 12) {
    return pickLine(
      [
        `上午已經在流走，你今天 ${todayAttempts} 題。不要把黃金時段拿去醞釀焦慮。`,
        `早上是最便宜的進度，現在不買，晚上會用焦慮加價買回來。`,
        `上午先刷一輪，下午才有資格說自己今天有在動。`
      ],
      seed
    );
  }

  if (hour < 18) {
    return pickLine(
      [
        `下午了，你今天 ${todayAttempts} 題。這個數字如果太小，晚上會變成睡前審判。`,
        `下午不是拿來重開讀書計畫的，是拿來把題目做掉的。`,
        `現在補還來得及，但不要再跟自己開會了，直接按開始測驗。`
      ],
      seed
    );
  }

  if (hour < 23) {
    return pickLine(
      [
        `晚上到了，你今天 ${todayAttempts} 題。白天沒做的題，不會自己繁殖成進度。`,
        `現在再做一組，至少睡前不要被「今天才這樣」追殺。`,
        `今天還能救。不是用祈禱救，是用再刷 20 題救。`
      ],
      seed
    );
  }

  return pickLine(
    [
      `快半夜了，你今天 ${todayAttempts} 題。可以睡，但明天首頁會記得。`,
      `現在不是叫你熬夜爆刷，是提醒你：今天的進度已經定稿了。`,
      `夜深了，焦慮開始值班。明天不要再讓它加班。`
    ],
    seed
  );
}

function getPersonalAnxiousLine(personal: PersonalPaceStats, communityTodayAttempts: number, seed: number) {
  const { todayAttempts, yesterdayAttempts, sevenDayAttempts, activeDays, correctRate } = personal;
  const rateText = correctRate === null ? "" : `，近 7 天答對率 ${correctRate}%`;
  const communityText =
    communityTodayAttempts > 0 ? `全站今天已經 ${communityTodayAttempts} 題` : "全站數據還在醒";

  if (todayAttempts === 0) {
    return pickLine(
      [
        `${communityText}，你今天目前 0 題。不是沒救，是還沒開機，但再不開機就真的很像裝死。`,
        `你今天 0 題。國考不會因為你很會規劃就自動幫你加分，先按開始測驗。`,
        `${communityText}，你這邊還是 0 題。焦慮不是敵人，0 題才是。`,
        `今天還沒留下任何作答紀錄。先做 10 題，至少讓焦慮有資料可以罵。`
      ],
      seed
    );
  }

  if (todayAttempts < 10) {
    return pickLine(
      [
        `你今天才 ${todayAttempts} 題而已。這個量比較像暖手，不像在準備國考。`,
        `${communityText}，你今天 ${todayAttempts} 題。可以，至少有呼吸，但不能只靠呼吸通過一階。`,
        `目前 ${todayAttempts} 題。這不是進度，這比較像跟題庫打招呼。再補到 20 題。`,
        `今天 ${todayAttempts} 題${rateText}。不要急著感動，這只是起跑線旁邊的便利商店。`
      ],
      seed
    );
  }

  if (todayAttempts < 30) {
    return pickLine(
      [
        `你今天 ${todayAttempts} 題，有開始，但還不到能放心滑手機的量。`,
        `${communityText}，你今天 ${todayAttempts} 題。再湊一輪，讓今天不要只是象徵性刷題。`,
        `目前 ${todayAttempts} 題${rateText}。進度有影子了，但影子不能上考場。`,
        `今天 ${todayAttempts} 題。再做一組錯題，讓焦慮從背景音變成燃料。`
      ],
      seed
    );
  }

  if (yesterdayAttempts > todayAttempts + 20) {
    return pickLine(
      [
        `你今天 ${todayAttempts} 題，昨天 ${yesterdayAttempts} 題。昨天的你看起來比較想過國考。`,
        `今天 ${todayAttempts} 題，明顯輸給昨天的 ${yesterdayAttempts} 題。不要讓昨天的自己變成學霸前任。`,
        `昨天 ${yesterdayAttempts} 題，今天 ${todayAttempts} 題。不是不能休息，但這個落差需要補一口。`
      ],
      seed
    );
  }

  if (sevenDayAttempts < 120) {
    return pickLine(
      [
        `近 7 天總共 ${sevenDayAttempts} 題、活躍 ${activeDays} 天${rateText}。這節奏很養生，但國考不是養生村。`,
        `近 7 天 ${sevenDayAttempts} 題。你不是沒有努力，是努力得太有禮貌了。`,
        `這週 ${sevenDayAttempts} 題、${activeDays} 天有刷。再密一點，不然弱點會住下來。`
      ],
      seed
    );
  }

  return pickLine(
    [
      `你今天 ${todayAttempts} 題，近 7 天 ${sevenDayAttempts} 題${rateText}。可以，但不要開始跟自己談判。`,
      `${communityText}，你今天 ${todayAttempts} 題。節奏有了，現在要把錯題追到它不敢再出現。`,
      `今天 ${todayAttempts} 題，這週 ${sevenDayAttempts} 題。很好，繼續，不要讓焦慮有翻盤機會。`,
      `你今天 ${todayAttempts} 題${rateText}。這才像有在備考，接下來請把低信心題抓出來審問。`
    ],
    seed
  );
}

function formatDateLabel(date: string, offsetFromEnd: number) {
  if (offsetFromEnd === 0) return "今天";
  if (offsetFromEnd === 1) return "昨天";
  return date.slice(5);
}

function getLastPoint<T>(items: T[], fromEnd = 0) {
  const index = items.length - 1 - fromEnd;
  return index >= 0 ? items[index] : undefined;
}

const ANXIOUS_STATS_REFRESH_MS = 60 * 60 * 1000;
const HOME_COMMUNITY_STATS_CACHE_KEY = "homeCommunityStatsLastGood";

type CommunityStatsPoint = { date: string; attempts: number; correctRate: number };

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
    // Ignore localStorage quota/private mode issues.
  }
}

export function HomeToneBanner() {
  const { user, syncVersion } = useAuth();
  const [mode, setMode] = useState<HomeToneMode>("calm");
  const [stats, setStats] = useState<CommunityStatsPoint[]>([]);
  const [statsStatus, setStatsStatus] = useState<"idle" | "loading" | "ready" | "stale">("idle");
  const [calmLine, setCalmLine] = useState(CALM_LINES[0]);
  const [anxiousLineBucket, setAnxiousLineBucket] = useState(0);
  const [personalPace, setPersonalPace] = useState<PersonalPaceStats>(() => ({
    todayAttempts: 0,
    yesterdayAttempts: 0,
    sevenDayAttempts: 0,
    activeDays: 0,
    correctRate: null
  }));

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
    const lineIntervalId = window.setInterval(() => {
      setAnxiousLineBucket(getAnxiousLineBucket());
    }, ANXIOUS_LINE_ROTATION_MS);

    function refreshPersonalPace() {
      setPersonalPace(getPersonalPaceStats());
    }

    refreshPersonalPace();
    window.addEventListener("current-session-change", refreshPersonalPace as EventListener);
    window.addEventListener("completed-sessions-change", refreshPersonalPace as EventListener);
    window.addEventListener("storage", refreshPersonalPace);
    return () => {
      window.clearInterval(lineIntervalId);
      window.removeEventListener("current-session-change", refreshPersonalPace as EventListener);
      window.removeEventListener("completed-sessions-change", refreshPersonalPace as EventListener);
      window.removeEventListener("storage", refreshPersonalPace);
    };
  }, [mode, syncVersion]);

  useEffect(() => {
    if (mode !== "anxious") return;

    let cancelled = false;
    const cached = loadCachedCommunityStats();
    if (cached.length > 0) {
      setStats(cached);
      setStatsStatus("stale");
    } else {
      setStatsStatus("loading");
    }

    async function refreshStats() {
      try {
        const response = await fetch("/api/community-stats?days=2");
        const payload = (await response.json().catch(() => null)) as
          | { ok?: boolean; degraded?: boolean; points?: CommunityStatsPoint[] }
          | null;
        if (!response.ok || !payload?.ok || !payload.points) {
          throw new Error("community-stats-unavailable");
        }
        if (!cancelled) {
          if (payload.points.length > 0) {
            setStats(payload.points);
            if (!payload.degraded) saveCachedCommunityStats(payload.points);
          }
          setStatsStatus(payload.degraded ? "stale" : "ready");
        }
      } catch {
        if (!cancelled) {
          const fallback = loadCachedCommunityStats();
          if (fallback.length > 0) setStats(fallback);
          setStatsStatus("stale");
        }
      }
    }

    void refreshStats();
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refreshStats();
      }
    }, ANXIOUS_STATS_REFRESH_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [mode]);

  const content = useMemo(() => {
    if (mode === "calm") {
      return {
        label: "抗焦慮版",
        body: calmLine
      };
    }

    const today = getLastPoint(stats, 0);
    const yesterday = getLastPoint(stats, 1);
    const segments = [yesterday, today]
      .filter((item): item is { date: string; attempts: number; correctRate: number } => Boolean(item))
      .map((item, index, arr) => {
        const offsetFromEnd = arr.length - 1 - index;
        return `${formatDateLabel(item.date, offsetFromEnd)}大家 ${item.attempts} 題，正確率 ${item.correctRate}%`;
      });

    return {
      label: "焦慮版",
      body:
        segments.length > 0
          ? `${getPersonalAnxiousLine(personalPace, today?.attempts ?? 0, personalPace.todayAttempts + personalPace.sevenDayAttempts + (today?.attempts ?? 0) + anxiousLineBucket)} ${getTimePressureLine(personalPace.todayAttempts, anxiousLineBucket)} ${segments.join("；")}${statsStatus === "stale" ? "（全站數據更新中）" : ""}。`
          : `${getPersonalAnxiousLine(personalPace, 0, personalPace.todayAttempts + personalPace.sevenDayAttempts + anxiousLineBucket)} ${getTimePressureLine(personalPace.todayAttempts, anxiousLineBucket)}`
    };
  }, [anxiousLineBucket, calmLine, mode, personalPace, stats, statsStatus]);

  return (
    <div className="surface-card-muted home-data-fade mt-5 px-4 py-3">
      <p className="body-soft text-sm leading-7 sm:text-[15px]">{content.body}</p>
      {mode === "anxious" && statsStatus === "loading" ? (
        <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-brand-700">
          <span className="home-loading-dot" />
          全站數據整理中
        </div>
      ) : null}
    </div>
  );
}
