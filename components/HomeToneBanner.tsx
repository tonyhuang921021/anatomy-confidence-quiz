"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { getHomeToneModePreference } from "@/lib/accountPreferences";
import {
  getCompletedSessionsStorageLengthForUser,
  loadCompletedSessions,
  loadCurrentSession,
  loadHomeToneMode,
  type HomeToneMode
} from "@/lib/storage";

const CALM_LINES = [
  "今天願意打開題目，就已經很不容易了。\n不用急著把所有東西一次讀完，只要今天多理解一點、多拿回一點分數，就是往前走。",
  "你不是一定要狀態很好，才有資格開始讀書。\n很多時候，是先坐下來、先做一題，狀態才會慢慢回來。",
  "昨天不管讀得好不好，都已經過去了。\n今天重新開始，重新整理，重新靠近目標一點點，就很值得。",
  "準備考試的路本來就不會每天都順。\n但只要你還願意回來面對題目，還願意把不會的地方補起來，你就還在前進。",
  "不用因為還有很多沒讀完，就否定已經會的東西。\n你正在做的，是把模糊的地方慢慢變清楚，把不安的地方慢慢變穩。",
  "今天不需要完美。\n今天只需要比昨天更知道一個觀念、少踩一個陷阱、多熟一個考點。",
  "每一次登入，都不是在提醒你還差多少。\n它是在提醒你：你又給了自己一次變強的機會。",
  "有些進步很安靜，安靜到當下幾乎感覺不到。\n但它會累積在每一次訂正、每一次複習、每一次重新想懂的瞬間。",
  "不要把錯題看成失敗。\n它只是提前出現的提醒，幫你在真正上考場之前，把可能失去的分數先找回來。",
  "你不需要每一天都很有信心。\n準備考試的人本來就會懷疑、會焦慮、會累，但你還是願意繼續，這就很重要。",
  "今天的你，也許不是最有精神的你。\n但只要願意做一點點，就已經是在替未來的自己減少一點慌張。",
  "不要小看今天做的幾題。\n有時候考場上救你的，不是某一次爆讀，而是那些每天慢慢累積起來的小觀念。",
  "你現在覺得不熟的地方，不代表永遠都不會。\n它只是還需要被多看幾次、多整理幾次、多放回正確的位置。",
  "準備考試不是每天都要贏很多。\n有時候只是守住節奏、沒有放棄、願意再看一題，就已經很好了。",
  "今天先不要責備自己。\n先打開題目，先看一個觀念，先讓自己重新進入軌道，其他的慢慢來。",
  "你不是在跟別人的進度比賽。\n你是在幫自己把該拿的分數，一分一分地找回來。",
  "讀書很累，尤其是明明努力了，還是有題目會錯的時候。\n但錯題不是在說你不夠好，而是在告訴你下一步該補哪裡。",
  "今天的任務不是把所有焦慮消除。\n今天的任務是帶著一點焦慮，還是願意往前走一點點。",
  "你可以慢一點，但不要因此覺得自己沒有在前進。\n很多真正穩的能力，都是在一次又一次看似很小的複習裡長出來的。",
  "打開這裡，不是為了被分數審判。\n是為了更清楚地知道自己會什麼、不會什麼，然後一步一步變得更穩。",
  "今天也許只適合做少一點，那也沒關係。\n能維持住一點節奏，就比完全放棄更靠近目標。",
  "你現在做的每一題，都不是孤立的。\n它們會慢慢連成一張網，讓你在考場看到題目時，知道自己可以怎麼想。",
  "不用害怕發現自己不會。\n真正可怕的不是不會，而是一直沒機會發現；現在發現，就還來得及補起來。",
  "今天給自己一點耐心。\n你正在讀的東西本來就不簡單，而你願意每天回來面對它，已經是一件很勇敢的事。",
  "有些題目現在看起來很陌生，之後會變成熟悉。\n有些觀念現在想很久，之後會變成直覺。你正在經過那個過程。",
  "今天不必想著「我還差好多」。\n先想著「我現在可以多拿回哪一分」，這樣路會比較走得下去。",
  "你不需要一次變成很厲害的人。\n你只需要每天把一點點不確定，慢慢變成比較確定。",
  "再忙、再累，願意回來看一眼進度，都是在照顧未來的自己。\n不是每次都要讀很多，但每次回來，都代表你還沒有放掉目標。",
  "考試前的努力常常不會立刻有感覺。\n但你現在補起來的每一個小洞，都可能在正式考試那天，變成讓你安心的一分。",
  "今天就從一題開始。\n不用先想整份考卷，也不用先想最後結果；把眼前這一題弄懂，就是今天最踏實的前進。"
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
const SAFARI_HOME_HISTORY_READ_LIMIT = 750_000;

function isSafariBrowser() {
  if (typeof navigator === "undefined") return false;
  const userAgent = navigator.userAgent;
  return /Safari/i.test(userAgent) && !/Chrome|Chromium|CriOS|FxiOS|EdgiOS|Edg\//i.test(userAgent);
}

function shouldSkipHeavyHomeHistoryRead() {
  return isSafariBrowser() && getCompletedSessionsStorageLengthForUser() > SAFARI_HOME_HISTORY_READ_LIMIT;
}

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

  const sessions = shouldSkipHeavyHomeHistoryRead() ? [] : loadCompletedSessions();
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
        `現在還早，今天先卡 ${Math.max(20 - todayAttempts, 0)} 題基本盤，不要一醒來就欠債。`,
        `阿米諾斯，早上腦袋還沒被世界污染，拿來做題，不要拿來發呆。`
      ],
      seed
    );
  }

  if (hour < 12) {
    return pickLine(
      [
        `上午已經在流走，你今天 ${todayAttempts} 題。不要把黃金時段拿去醞釀焦慮。`,
        `早上是最便宜的進度，現在不買，晚上會用焦慮加價買回來。`,
        `上午先刷一輪，下午才有資格說自己今天有在動。`,
        `納尼尊嘟假嘟？你今天是在做題，還是在確認 App 能不能開？`
      ],
      seed
    );
  }

  if (hour < 18) {
    return pickLine(
      [
        `下午了，你今天 ${todayAttempts} 題。這個數字如果太小，晚上會變成睡前審判。`,
        `下午不是拿來重開讀書計畫的，是拿來把題目做掉的。`,
        `現在補還來得及，但不要再跟自己開會了，直接按開始測驗。`,
        `我嘞個豆，有動，但動得像國考不會來一樣。`
      ],
      seed
    );
  }

  if (hour < 23) {
    return pickLine(
      [
        `晚上到了，你今天 ${todayAttempts} 題。白天沒做的題，不會自己繁殖成進度。`,
        `現在再做一組，至少睡前不要被「今天才這樣」追殺。`,
        `今天還能救。不是用祈禱救，是用再刷 20 題救。`,
        `歐買尬居蛇十塊，白天沒做的題，不會自己繁殖成進度。`
      ],
      seed
    );
  }

  return pickLine(
    [
      `快半夜了，你今天 ${todayAttempts} 題。可以睡，但明天首頁會記得。`,
      `現在不是叫你熬夜爆刷，是提醒你：今天的進度已經定稿了。`,
      `夜深了，焦慮開始值班。明天不要再讓它加班。`,
      `今天不是創造奇蹟，是保存戰力；但明天不要繼續用這招。`
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
        `今天還沒留下任何作答紀錄。先做 10 題，至少讓焦慮有資料可以罵。`,
        `阿米諾斯，今天的進度乾淨到像剛格式化。`,
        `系統差點以為你轉系了。`,
        `題庫沒有生氣，它只是默默變陌生。`
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
        `今天 ${todayAttempts} 題${rateText}。不要急著感動，這只是起跑線旁邊的便利商店。`,
        `咩噗咩噗，這個進度不能說沒有，只能說國考委員還感受不到威脅。`,
        `居蛇十塊，很強，但樣本數小到統計學想離席。`,
        `熱身結束了，現在可以開始讀書了嗎？`
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
        `今天 ${todayAttempts} 題。再做一組錯題，讓焦慮從背景音變成燃料。`,
        `運氣分已入帳，知識請補上。`,
        `錯題不是收藏品，請不要只是放著欣賞。`,
        `哈基米哈基米，請不要把「好像會」誤認成「真的會」。`
      ],
      seed
    );
  }

  if (yesterdayAttempts > todayAttempts + 20) {
    return pickLine(
      [
        `你今天 ${todayAttempts} 題，昨天 ${yesterdayAttempts} 題。昨天的你看起來比較想過國考。`,
        `今天 ${todayAttempts} 題，明顯輸給昨天的 ${yesterdayAttempts} 題。不要讓昨天的自己變成學霸前任。`,
        `昨天 ${yesterdayAttempts} 題，今天 ${todayAttempts} 題。不是不能休息，但這個落差需要補一口。`,
        `全站都在變強，請不要只負責見證歷史。`,
        `不要用昨天的努力當今天偷懶的免死金牌。`
      ],
      seed
    );
  }

  if (sevenDayAttempts < 120) {
    return pickLine(
      [
        `近 7 天總共 ${sevenDayAttempts} 題、活躍 ${activeDays} 天${rateText}。這節奏很養生，但國考不是養生村。`,
        `近 7 天 ${sevenDayAttempts} 題。你不是沒有努力，是努力得太有禮貌了。`,
        `這週 ${sevenDayAttempts} 題、${activeDays} 天有刷。再密一點，不然弱點會住下來。`,
        `錯題沒有變難，是你忘得很有紀律。`,
        `藥名目前在你腦中像一群沒有名牌的親戚。`,
        `代謝路徑不是迷宮，是你今天沒帶地圖。`
      ],
      seed
    );
  }

  return pickLine(
    [
      `你今天 ${todayAttempts} 題，近 7 天 ${sevenDayAttempts} 題${rateText}。可以，但不要開始跟自己談判。`,
      `${communityText}，你今天 ${todayAttempts} 題。節奏有了，現在要把錯題追到它不敢再出現。`,
      `今天 ${todayAttempts} 題，這週 ${sevenDayAttempts} 題。很好，繼續，不要讓焦慮有翻盤機會。`,
      `你今天 ${todayAttempts} 題${rateText}。這才像有在備考，接下來請把低信心題抓出來審問。`,
      `蘇巴拉西，今天腦袋有上班，請趁熱把錯題抓去審問。`,
      `牙白內，這個題量開始像要跟考選部談條件了。`,
      `大發事件，你今天成為別人的焦慮來源。`,
      `很好，但不要用今天的努力當明天偷懶的免死金牌。`
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
      <p className="body-soft whitespace-pre-line text-sm leading-7 sm:text-[15px]">{content.body}</p>
      {mode === "anxious" && statsStatus === "loading" ? (
        <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-brand-700">
          <span className="home-loading-dot" />
          全站數據整理中
        </div>
      ) : null}
    </div>
  );
}
