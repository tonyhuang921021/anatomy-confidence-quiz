"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

const loadAuthPanel = () => import("@/components/AuthPanel").then((mod) => mod.AuthPanel);

function useNearViewport(rootMargin = "520px") {
  const ref = useRef<HTMLDivElement | null>(null);
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    if (shouldLoad) return;
    const node = ref.current;
    if (!node) return;

    if (!("IntersectionObserver" in window)) {
      const timerId = globalThis.setTimeout(() => setShouldLoad(true), 900);
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

function AuthPanelPlaceholder() {
  return (
    <section className="surface-card min-h-[10rem] p-5">
      <p className="eyebrow">Account</p>
      <h2 className="display-title mt-2 text-3xl">帳號與同步</h2>
      <p className="body-soft mt-3 text-sm leading-7">帳號設定會在滑到附近時自動載入。</p>
    </section>
  );
}

const AuthPanel = dynamic(
  loadAuthPanel,
  {
    ssr: false,
    loading: () => <AuthPanelPlaceholder />,
  }
);

export function LazyAuthPanel() {
  const { ref, shouldLoad } = useNearViewport();

  if (!shouldLoad) {
    return (
      <div ref={ref}>
        <AuthPanelPlaceholder />
      </div>
    );
  }

  return <AuthPanel />;
}
