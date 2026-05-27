"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function ResultsError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Results page crashed:", error);
  }, [error]);

  return (
    <main className="shell">
      <section className="rounded-[2rem] bg-white p-5 text-center shadow-card ring-1 ring-slate-100 sm:p-8">
        <h1 className="text-2xl font-semibold text-ink">這筆結果目前讀取失敗</h1>
        <p className="mt-3 text-sm leading-7 text-slate-500">
          這通常是某一筆舊作答資料格式不完整。你可以先回到作答紀錄，換看別筆結果；如果按重試後還是一樣，我會再繼續幫你追這筆資料。
        </p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={reset}
            className="min-h-12 rounded-2xl bg-brand-600 px-5 py-4 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            重新嘗試
          </button>
          <Link
            href="/results"
            className="min-h-12 rounded-2xl bg-slate-100 px-5 py-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-200"
          >
            回到作答紀錄
          </Link>
          <Link
            href="/"
            className="min-h-12 rounded-2xl bg-slate-100 px-5 py-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-200"
          >
            返回首頁
          </Link>
        </div>
      </section>
    </main>
  );
}
