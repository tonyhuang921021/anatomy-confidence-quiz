"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

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
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const scheduledRef = useRef(false);
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    if (shouldLoad) return;

    let timerId: number | null = null;
    let autoTimerId: number | null = null;
    let frameId: number | null = null;
    let idleId: number | null = null;
    const idleWindow = window as typeof window & {
      requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

    function queueLoad(delayMs: number) {
      if (scheduledRef.current) return;
      scheduledRef.current = true;
      timerId = window.setTimeout(() => {
        if (typeof idleWindow.requestIdleCallback === "function") {
          idleId = idleWindow.requestIdleCallback(() => setShouldLoad(true), { timeout: 2400 });
          return;
        }
        frameId = window.requestAnimationFrame(() => setShouldLoad(true));
      }, delayMs);
    }

    const node = sentinelRef.current;
    const observer =
      node && typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(
            ([entry]) => {
              if (!entry?.isIntersecting) return;
              queueLoad(520);
            },
            { rootMargin: "420px 0px" }
          )
        : null;

    if (observer && node) observer.observe(node);
    autoTimerId = window.setTimeout(() => queueLoad(0), 5600);

    return () => {
      observer?.disconnect();
      if (timerId !== null) window.clearTimeout(timerId);
      if (autoTimerId !== null) window.clearTimeout(autoTimerId);
      if (frameId !== null) window.cancelAnimationFrame(frameId);
      if (idleId !== null) idleWindow.cancelIdleCallback?.(idleId);
    };
  }, [shouldLoad]);

  return (
    <div ref={sentinelRef}>
      {shouldLoad ? (
        <FeedbackBoard />
      ) : (
        <section className="surface-card p-6">
          <p className="eyebrow">Feedback</p>
          <h2 className="display-title mt-2 text-3xl">留言板</h2>
          <p className="body-soft mt-3 text-sm leading-7">
            留言板會自動載入，靠近時排隊進場；不用手動按。
          </p>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full w-1/3 rounded-full bg-gradient-to-r from-brand-500 to-amber-300" />
          </div>
        </section>
      )}
    </div>
  );
}
