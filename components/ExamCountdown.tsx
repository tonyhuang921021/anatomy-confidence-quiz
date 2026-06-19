"use client";

import { useEffect, useMemo, useState } from "react";

const EXAM_DATE = new Date("2026-07-17T08:40:00+08:00");

type CountdownParts = {
  isPast: boolean;
  days: number;
  hours: number;
  minutes: number;
};

function getCountdownParts(now: Date): CountdownParts {
  const diffMs = EXAM_DATE.getTime() - now.getTime();

  if (diffMs <= 0) {
    return {
      isPast: true,
      days: 0,
      hours: 0,
      minutes: 0
    };
  }

  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  return {
    isPast: false,
    days,
    hours,
    minutes
  };
}

export function ExamCountdown() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 60 * 1000);

    return () => window.clearInterval(timer);
  }, []);

  const countdown = useMemo(() => (now ? getCountdownParts(now) : null), [now]);

  return (
    <div className="surface-card-muted p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow text-sm tracking-[0.16em]">Exam Countdown</p>
          <p className="body-soft mt-2 text-sm">國考時間：7/17 早上 8:40</p>
        </div>
        {!countdown ? (
          <span className="stat-chip px-3 py-2 text-sm">倒數整理中</span>
        ) : countdown.isPast ? (
          <span className="stat-chip px-3 py-2 text-sm">
            國考時間已到
          </span>
        ) : (
          <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
            <span className="stat-chip px-3 py-2 text-sm">{countdown.days} 天</span>
            <span className="stat-chip px-3 py-2 text-sm">{countdown.hours} 小時</span>
            <span className="stat-chip px-3 py-2 text-sm">{countdown.minutes} 分鐘</span>
          </div>
        )}
      </div>
    </div>
  );
}
