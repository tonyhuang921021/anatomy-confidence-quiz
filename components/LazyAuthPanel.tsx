"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

const AuthPanel = dynamic(
  () => import("@/components/AuthPanel").then((mod) => mod.AuthPanel),
  {
    ssr: false,
    loading: () => (
      <section className="surface-card p-6">
        <p className="eyebrow">Account</p>
        <h2 className="display-title mt-2 text-3xl">帳號與同步</h2>
        <p className="body-soft mt-3 text-sm leading-7">帳號設定載入中。</p>
      </section>
    ),
  }
);

export function LazyAuthPanel() {
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
      { rootMargin: "160px 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [shouldLoad]);

  return (
    <div ref={sentinelRef} className="min-h-40">
      {shouldLoad ? (
        <AuthPanel />
      ) : (
        <section className="surface-card p-6">
          <p className="eyebrow">Account</p>
          <h2 className="display-title mt-2 text-3xl">帳號與同步</h2>
          <p className="body-soft mt-3 text-sm leading-7">靠近這裡才載入帳號設定，首頁先不要扛題庫設定大包。</p>
          <button
            type="button"
            className="mt-5 rounded-full bg-slate-900 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-800"
            onClick={() => setShouldLoad(true)}
          >
            載入帳號設定
          </button>
        </section>
      )}
    </div>
  );
}
