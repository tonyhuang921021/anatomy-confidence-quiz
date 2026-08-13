"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

const loadFeedbackBoard = () => import("@/components/FeedbackBoard").then((mod) => mod.FeedbackBoard);

function useNearViewport(rootMargin = "900px") {
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

function FeedbackBoardPlaceholder({ showHeading = true }: { showHeading?: boolean }) {
  return (
    <section className={`feedback-placeholder${showHeading ? "" : " is-embedded"}`}>
      {showHeading ? (
        <>
          <p className="eyebrow">Feedback</p>
          <h2 className="display-title mt-2 text-3xl">留言板</h2>
        </>
      ) : null}
      <div className="mt-5 space-y-2">
        <div className="feedback-placeholder-row" />
        <div className="feedback-placeholder-row" />
      </div>
    </section>
  );
}

const FeedbackBoard = dynamic(
  loadFeedbackBoard,
  {
    ssr: false,
    loading: () => <FeedbackBoardPlaceholder showHeading={false} />,
  }
);

export function LazyFeedbackBoard({
  eager = false,
  showHeading = true
}: {
  eager?: boolean;
  showHeading?: boolean;
}) {
  const { ref, shouldLoad } = useNearViewport();
  const shouldRender = eager || shouldLoad;

  if (!shouldRender) {
    return (
      <div ref={ref}>
        <FeedbackBoardPlaceholder showHeading={showHeading} />
      </div>
    );
  }

  return <FeedbackBoard showHeading={showHeading} />;
}
