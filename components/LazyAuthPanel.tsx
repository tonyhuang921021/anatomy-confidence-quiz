"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

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
  const [shouldLoad, setShouldLoad] = useState(false);

  return (
    <div>
      {shouldLoad ? (
        <AuthPanel />
      ) : (
        <section className="surface-card p-6">
          <p className="eyebrow">Account</p>
          <h2 className="display-title mt-2 text-3xl">帳號與同步</h2>
          <p className="body-soft mt-3 text-sm leading-7">需要管理登入或同步時再載入，手機滑首頁先保持輕一點。</p>
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
