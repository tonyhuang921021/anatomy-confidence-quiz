"use client";

import { useEffect, useRef, useState } from "react";
import { FeedbackBoard } from "@/components/FeedbackBoard";

export function LazyFeedbackBoard() {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    if (shouldLoad) return;
    const node = sentinelRef.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setShouldLoad(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setShouldLoad(true);
        observer.disconnect();
      },
      { rootMargin: "420px 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [shouldLoad]);

  return (
    <div ref={sentinelRef} className="min-h-32">
      {shouldLoad ? (
        <FeedbackBoard />
      ) : (
        <section className="surface-card p-6">
          <p className="eyebrow">Feedback</p>
          <h2 className="display-title mt-2 text-3xl">留言板</h2>
          <p className="body-soft mt-3 text-sm leading-7">
            滑到這裡才載入留言，首頁先把力氣留給刷題。
          </p>
        </section>
      )}
    </div>
  );
}
