"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import {
  syncLeaderboardProfileForCurrentUser,
  updateLeaderboardDisplayName
} from "@/lib/cloudSync";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export function AuthPanel() {
  const { configured, loading, user, syncStatus, syncError, refreshCloudData, signOut } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const ownerAllowedEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  const canViewOwnerPage = user?.email
    ? ownerAllowedEmails.includes(user.email.trim().toLowerCase())
    : false;

  useEffect(() => {
    setNickname(typeof user?.user_metadata?.display_name === "string" ? user.user_metadata.display_name : "");
  }, [user]);

  async function handleSignIn() {
    setSubmitting(true);
    setMessage("");
    setError("");

    try {
      const { error: signInError } = await getSupabaseBrowserClient().auth.signInWithPassword({
        email,
        password
      });

      if (signInError) {
        setError(signInError.message);
        return;
      }

      setMessage("登入成功，正在同步雲端紀錄。");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSignUp() {
    setSubmitting(true);
    setMessage("");
    setError("");

    try {
      const { error: signUpError } = await getSupabaseBrowserClient().auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo:
            typeof window !== "undefined" ? `${window.location.origin}/` : undefined,
          data: nickname.trim() ? { display_name: nickname.trim().slice(0, 24) } : undefined
        }
      });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      setMessage("註冊成功，去 email 完成驗證。");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveNickname() {
    if (!user) return;
    setSubmitting(true);
    setMessage("");
    setError("");

    try {
      const trimmed = nickname.trim().slice(0, 24);
      const { data, error: updateError } = await getSupabaseBrowserClient().auth.updateUser({
        data: {
          display_name: trimmed
        }
      });

      if (updateError) {
        setError(updateError.message);
        return;
      }

      await updateLeaderboardDisplayName(data.user ?? user, trimmed);
      await syncLeaderboardProfileForCurrentUser(data.user ?? user);
      await refreshCloudData();
      setMessage("暱稱已更新，排行榜會顯示新的名稱。");
    } finally {
      setSubmitting(false);
    }
  }

  if (!configured) {
    return (
      <section className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">正式版登入</p>
        <h2 className="mt-2 text-2xl font-semibold text-ink">Supabase 尚未設定</h2>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          請先填入 `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`，再建立 `quiz_sessions`
          資料表與 RLS。這樣每個人就能有分開的雲端作答紀錄。
        </p>
      </section>
    );
  }

  if (loading) {
    return (
      <section className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100">
        <p className="text-sm text-slate-600">正在讀取登入狀態...</p>
      </section>
    );
  }

  if (user) {
    return (
      <section className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">正式版登入</p>
        <h2 className="mt-2 text-2xl font-semibold text-ink">目前使用者</h2>
        <p className="mt-3 text-base font-semibold text-slate-900">{user.email}</p>
        <div className="mt-4 grid gap-3">
          <input
            type="text"
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            placeholder="排行榜暱稱"
            maxLength={24}
            className="min-h-12 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-800 outline-none"
          />
          <p className="text-xs text-slate-500">排行榜會顯示這個暱稱，最多 24 個字。</p>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
            雲端同步狀態 <span className="font-semibold">{syncStatus}</span>
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
            使用者 ID <span className="font-semibold">{user.id.slice(0, 8)}...</span>
          </div>
        </div>
        {syncError ? (
          <div className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">{syncError}</div>
        ) : null}
        {message ? (
          <div className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900">{message}</div>
        ) : null}
        {error ? (
          <div className="mt-4 rounded-2xl bg-rose-50 p-4 text-sm text-rose-900">{error}</div>
        ) : null}
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          {canViewOwnerPage ? (
            <a
              href="/owner"
              className="min-h-12 rounded-2xl bg-slate-100 px-4 py-3 text-center text-sm font-semibold text-slate-800 transition hover:bg-slate-200"
            >
              私有數據頁
            </a>
          ) : null}
          <button
            type="button"
            onClick={() => void handleSaveNickname()}
            disabled={submitting}
            className="min-h-12 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:bg-slate-100"
          >
            儲存暱稱
          </button>
          <button
            type="button"
            onClick={() => void refreshCloudData()}
            className="min-h-12 rounded-2xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            立即同步雲端紀錄
          </button>
          <button
            type="button"
            onClick={() => void signOut()}
            className="min-h-12 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-200"
          >
            登出
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">正式版登入</p>
      <h2 className="mt-2 text-2xl font-semibold text-ink">建立個人雲端紀錄</h2>
      <p className="mt-3 text-sm leading-7 text-slate-600">
        登入後，completed sessions 會依使用者分開保存，手機與電腦也能同步。
      </p>

      <div className="mt-5 grid gap-3">
        <input
          type="text"
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
          placeholder="排行榜暱稱"
          maxLength={24}
          className="min-h-12 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-800 outline-none"
        />
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Email"
          className="min-h-12 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-800 outline-none"
        />
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Password"
          className="min-h-12 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-800 outline-none"
        />
      </div>

      {message ? (
        <div className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900">{message}</div>
      ) : null}
      {error ? (
        <div className="mt-4 rounded-2xl bg-rose-50 p-4 text-sm text-rose-900">{error}</div>
      ) : null}

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={() => void handleSignIn()}
          disabled={submitting || !email || !password}
          className="min-h-12 rounded-2xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          以 Email 登入
        </button>
        <button
          type="button"
          onClick={() => void handleSignUp()}
          disabled={submitting || !email || !password}
          className="min-h-12 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:bg-slate-100"
        >
          註冊新帳號
        </button>
      </div>
    </section>
  );
}
