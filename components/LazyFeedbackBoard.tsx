"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

function useNearViewport(rootMargin = "1200px") {
  const ref = useRef<HTMLDivElement | null>(null);
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    if (shouldLoad) return;
    const node = ref.current;
    if (!node) return;

    if (!("IntersectionObserver" in window)) {
      const timerId = globalThis.setTimeout(() => setShouldLoad(true), 1200);
      return () => globalThis.clearTimeout(timerId);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );
    observer.observe(node);

    return () => observer.disconnect();
  }, [rootMargin, shouldLoad]);

  return { ref, shouldLoad };
}

function FeedbackBoardPlaceholder() {
  return (
    <section className="surface-card min-h-[30rem] p-6">
      <p className="eyebrow">Feedback</p>
      <h2 className="display-title mt-2 text-3xl">留言板</h2>
      <p className="body-soft mt-3 text-sm leading-7">留言板會在滑到附近時自動載入。</p>
      <div className="mt-6 space-y-3">
        <div className="surface-card-muted h-24 p-4" />
        <div className="surface-card-muted h-24 p-4" />
        <div className="surface-card-muted h-24 p-4" />
      </div>
    </section>
  );
}

const FeedbackBoard = dynamic(
  () => import("@/components/FeedbackBoard").then((mod) => mod.FeedbackBoard),
  {
    ssr: false,
    loading: () => <FeedbackBoardPlaceholder />,
  }
);

export function LazyFeedbackBoard() {
  const { ref, shouldLoad } = useNearViewport();

  if (!shouldLoad) {
    return (
      <div ref={ref}>
        <FeedbackBoardPlaceholder />
      </div>
    );
  }

  return <FeedbackBoard />;
}
