"use client";

import { useEffect, useMemo, useState } from "react";
import { loadHomeToneMode, type HomeToneMode } from "@/lib/storage";

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

function getAnxiousEncouragement(todayAttempts: number) {
  if (todayAttempts >= 400) return "今天已經很多人在往前推了，你也不是一個人在撐。";
  if (todayAttempts >= 200) return "今天整體節奏很快，但穩定把自己的弱點抓出來就夠了。";
  if (todayAttempts > 0) return "今天大家也在慢慢堆進度，你現在開始也完全來得及。";
  return "今天還很安靜，現在開始刷，這波節奏就由你帶起來。";
}

function formatDateLabel(date: string, offsetFromEnd: number) {
  if (offsetFromEnd === 0) return "今天";
  if (offsetFromEnd === 1) return "昨天";
  return date.slice(5);
}

export function HomeToneBanner() {
  const [mode, setMode] = useState<HomeToneMode>("calm");
  const [stats, setStats] = useState<{ date: string; attempts: number; correctRate: number }[]>([]);

  useEffect(() => {
    setMode(loadHomeToneMode());

    function handleModeChange(event: Event) {
      const detail = (event as CustomEvent<HomeToneMode>).detail;
      setMode(detail === "anxious" ? "anxious" : "calm");
    }

    window.addEventListener("home-tone-mode-change", handleModeChange as EventListener);
    return () => {
      window.removeEventListener("home-tone-mode-change", handleModeChange as EventListener);
    };
  }, []);

  useEffect(() => {
    if (mode !== "anxious") return;

    let cancelled = false;
    void fetch("/api/community-stats")
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as
          | { ok?: boolean; points?: { date: string; attempts: number; correctRate: number }[] }
          | null;
        if (!response.ok || !payload?.ok || !payload.points) {
          throw new Error("community-stats-unavailable");
        }
        if (!cancelled) setStats(payload.points);
      })
      .catch(() => {
        if (!cancelled) setStats([]);
      });

    return () => {
      cancelled = true;
    };
  }, [mode]);

  const content = useMemo(() => {
    if (mode === "calm") {
      return {
        label: "抗焦慮版",
        body: getCalmLine()
      };
    }

    const today = stats.at(-1);
    const yesterday = stats.at(-2);
    const segments = [yesterday, today]
      .filter((item): item is { date: string; attempts: number; correctRate: number } => Boolean(item))
      .map((item, index, arr) => {
        const offsetFromEnd = arr.length - 1 - index;
        return `${formatDateLabel(item.date, offsetFromEnd)} ${item.attempts} 題，正確率 ${item.correctRate}%`;
      });

    return {
      label: "焦慮版",
      body:
        segments.length > 0
          ? `${segments.join("；")}。${getAnxiousEncouragement(today?.attempts ?? 0)}`
          : "今天和昨天的整體作答還在整理中。先把自己的節奏穩住就好。"
    };
  }, [mode, stats]);

  return (
    <div className="mt-5 rounded-2xl border border-slate-200/80 bg-white/70 px-4 py-3 backdrop-blur-sm">
      <p className="text-sm leading-7 text-slate-600 sm:text-[15px]">{content.body}</p>
    </div>
  );
}
