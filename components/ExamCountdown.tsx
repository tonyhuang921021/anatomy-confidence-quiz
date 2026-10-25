"use client";
import { useEffect, useState } from "react";
import { getExamCountdown } from "@/lib/examCountdown";
import { formatRocDate } from "@/lib/rocDate";

export function ExamCountdown() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const refresh = () => setNow(new Date());
    refresh();
    const timer = window.setInterval(refresh, 60000);
    document.addEventListener("visibilitychange", refresh);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", refresh); };
  }, []);
  const countdown = now ? getExamCountdown(now) : null;
  return (
    <p className="mt-3 text-sm leading-7 text-slate-500" aria-label="醫師第一階段考試倒數">
      {!countdown ? "考期確認中" : !countdown.exam ? "下一次醫師一階日期待官方公告" : <>
        <a href={countdown.exam.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
          {countdown.exam.label}：{formatRocDate(countdown.exam.date!)}
        </a>
        <span>・{countdown.status === "today" ? "今天考試，請依通知書時間應試" : `倒數 ${countdown.days} 天`}</span>
      </>}
    </p>
  );
}
