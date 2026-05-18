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
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 60 * 1000);

    return () => window.clearInterval(timer);
  }, []);

  const countdown = useMemo(() => getCountdownParts(now), [now]);

  return (
    <div className="rounded-3xl bg-amber-50 p-4 ring-1 ring-amber-200">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-800">Exam Countdown</p>
          <p className="mt-2 text-sm text-slate-600">國考時間：7/17 早上 8:40</p>
        </div>
        {countdown.isPast ? (
          <span className="rounded-full bg-emerald-100 px-3 py-2 text-sm font-semibold text-emerald-900">
            國考時間已到
          </span>
        ) : (
          <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-amber-950">
            <span className="rounded-2xl bg-white px-3 py-2 ring-1 ring-amber-200">{countdown.days} 天</span>
            <span className="rounded-2xl bg-white px-3 py-2 ring-1 ring-amber-200">{countdown.hours} 小時</span>
            <span className="rounded-2xl bg-white px-3 py-2 ring-1 ring-amber-200">{countdown.minutes} 分鐘</span>
          </div>
        )}
      </div>
    </div>
  );
}
