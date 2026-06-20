"use client";

import dynamic from "next/dynamic";

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
  return <FeedbackBoard />;
}
