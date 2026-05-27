"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function QuizError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Quiz page crashed:", error);
  }, [error]);

  return (
    <main className="shell">
      <section className="rounded-[2rem] bg-white p-5 text-center shadow-card ring-1 ring-slate-100 sm:p-8">
        <h1 className="text-2xl font-semibold text-ink">這輪作答暫時出了點問題</h1>
        <p className="mt-3 text-sm leading-7 text-slate-500">
          目前先把白屏擋下來了。你可以先重試一次；如果還是失敗，就回首頁或結果頁，我再繼續追這輪題目資料是哪一題怪掉。
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
            查看結果
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
