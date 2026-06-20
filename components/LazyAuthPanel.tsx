"use client";

import dynamic from "next/dynamic";

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
  return <AuthPanel />;
}
