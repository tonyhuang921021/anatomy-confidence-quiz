"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

const FeedbackBoard = dynamic(
  () => import("@/components/FeedbackBoard").then((mod) => mod.FeedbackBoard),
  {
    ssr: false,
    loading: () => (
      <section className="surface-card p-6">
        <p className="eyebrow">Feedback</p>
        <h2 className="display-title mt-2 text-3xl">留言板</h2>
        <p className="body-soft mt-3 text-sm leading-7">留言板載入中，先不要急著催它。</p>
      </section>
    ),
  }
);

export function LazyFeedbackBoard() {
  const [shouldLoad, setShouldLoad] = useState(false);

  return (
    <div>
      {shouldLoad ? (
        <FeedbackBoard />
      ) : (
        <section className="surface-card p-6">
          <p className="eyebrow">Feedback</p>
          <h2 className="display-title mt-2 text-3xl">留言板</h2>
          <p className="body-soft mt-3 text-sm leading-7">
            留言很多，手機先不要一滑到就硬扛；想看再按。
          </p>
          <button
            type="button"
            className="mt-5 rounded-full bg-slate-900 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-800"
            onClick={() => setShouldLoad(true)}
          >
            載入留言板
          </button>
        </section>
      )}
    </div>
  );
}
