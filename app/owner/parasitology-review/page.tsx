"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";

function getAllowedEmails() {
  const raw = process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "";
  return raw
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function isAllowedEmail(email?: string | null) {
  if (!email) return false;
  return getAllowedEmails().includes(email.trim().toLowerCase());
}

export default function OwnerParasitologyReviewPage() {
  const { configured, loading, session, user } = useAuth();
  const [html, setHtml] = useState("");
  const [error, setError] = useState("");
  const [loadingHtml, setLoadingHtml] = useState(false);
  const allowed = useMemo(() => isAllowedEmail(user?.email), [user?.email]);
  const hasAllowlist = getAllowedEmails().length > 0;

  useEffect(() => {
    async function loadReviewHtml() {
      if (!allowed || !session?.access_token) return;
      setLoadingHtml(true);
      setError("");

      try {
        const response = await fetch("/api/owner/parasitology-review", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            accessToken: session.access_token
          })
        });

        const text = await response.text();
        if (!response.ok) {
          const payload = JSON.parse(text) as { message?: string };
          throw new Error(payload.message || "寄生蟲複習頁讀取失敗");
        }

        setHtml(text);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "寄生蟲複習頁讀取失敗");
      } finally {
        setLoadingHtml(false);
      }
    }

    void loadReviewHtml();
  }, [allowed, session?.access_token]);

  return (
    <main className="shell">
      <section className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">Owner Only</p>
            <h1 className="mt-2 text-3xl font-bold text-ink sm:text-4xl">寄生蟲國考互動複習</h1>
            <p className="mt-3 text-slate-500">這頁只給管理員載入，沒有登入白名單就吃閉門羹。</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/owner"
              className="min-h-12 rounded-2xl bg-slate-100 px-5 py-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-200"
            >
              返回私有數據頁
            </Link>
            <Link
              href="/"
              className="min-h-12 rounded-2xl bg-slate-100 px-5 py-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-200"
            >
              返回首頁
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-8">
        {!configured ? (
          <div className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100">
            請先完成 Supabase 設定。
          </div>
        ) : loading ? (
          <div className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100">
            正在確認登入狀態...
          </div>
        ) : !hasAllowlist ? (
          <div className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100">
            請先設定 `NEXT_PUBLIC_ADMIN_EMAILS`。
          </div>
        ) : !allowed ? (
          <div className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100">
            這頁是管理員私有內容，請先用白名單帳號登入。
          </div>
        ) : error ? (
          <div className="rounded-[2rem] bg-rose-50 p-6 text-rose-900 ring-1 ring-rose-100">
            {error}
          </div>
        ) : loadingHtml || !html ? (
          <div className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100">
            正在載入寄生蟲互動複習...
          </div>
        ) : (
          <div className="overflow-hidden rounded-[2rem] bg-white shadow-card ring-1 ring-slate-100">
            <iframe
              title="寄生蟲國考互動複習"
              srcDoc={html}
              sandbox="allow-forms allow-modals allow-scripts"
              className="h-[calc(100vh-11rem)] min-h-[720px] w-full border-0"
            />
          </div>
        )}
      </section>
    </main>
  );
}
