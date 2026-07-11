"use client";

import dynamic from "next/dynamic";

const ResultsClient = dynamic(() => import("./ResultsClient"), {
  ssr: false,
  loading: () => (
    <main className="shell" aria-busy="true" aria-live="polite">
      <div className="rounded-[2rem] bg-white p-5 shadow-card ring-1 ring-slate-100 sm:p-7">
        <p className="text-base font-semibold text-ink">結果載入中...</p>
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full w-1/3 rounded-full bg-brand-500" />
        </div>
      </div>
    </main>
  )
});

export default function ResultsPage() {
  return <ResultsClient />;
}
