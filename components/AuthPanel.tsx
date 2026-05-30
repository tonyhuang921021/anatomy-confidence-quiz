"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { enabledSubjects, MED1_SUBJECTS, MED2_SUBJECTS } from "@/data/subjectRegistry";
import {
  syncLeaderboardProfileForCurrentUser,
  updateLeaderboardDisplayName
} from "@/lib/cloudSync";
import {
  loadPracticeQuestionCount,
  loadPracticeStopAfterReview,
  loadPracticeYearRange,
  loadHomeToneMode,
  loadThemeMode,
  savePracticeQuestionCount,
  savePracticeStopAfterReview,
  savePracticeYearRange,
  saveHomeToneMode,
  saveThemeMode,
  type PracticeQuestionCount,
  type PracticeYearRange,
  type HomeToneMode,
  type ThemeMode
} from "@/lib/storage";
import {
  getHomeToneModePreference,
  getPracticeQuestionCountPreference,
  getPracticeStopAfterReviewPreference,
  getPracticeYearRangePreference,
  getThemeModePreference,
  type AccountPreferencePatch
} from "@/lib/accountPreferences";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export function AuthPanel() {
  const { configured, loading, user, syncStatus, syncError, refreshCloudData, signOut } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [homeToneMode, setHomeToneMode] = useState<HomeToneMode>("calm");
  const [themeMode, setThemeMode] = useState<ThemeMode>("light");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const ownerAllowedEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "tonyhuang921021@gmail.com")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  const canViewOwnerPage = user?.email
    ? ownerAllowedEmails.includes(user.email.trim().toLowerCase())
    : false;
  const selectableSubjects = useMemo(
    () =>
      enabledSubjects.filter(
        (item) =>
          item.subject !== "醫學（一）" &&
          item.subject !== "醫學（二）" &&
          (MED1_SUBJECTS.includes(item.subject) || MED2_SUBJECTS.includes(item.subject))
      ),
    []
  );
  const availableYears = useMemo(
    () =>
      Array.from(
        new Set(
          selectableSubjects
            .flatMap((item) => item.questions.map((question) => question.sourceYear))
            .filter((year): year is number => typeof year === "number")
        )
      ).sort((a, b) => a - b),
    [selectableSubjects]
  );
  const defaultPracticeYearRange = useMemo<PracticeYearRange>(
    () => ({
      yearFrom: availableYears[0] ?? 100,
      yearTo: availableYears[availableYears.length - 1] ?? 115
    }),
    [availableYears]
  );
  const [practiceYearRange, setPracticeYearRange] = useState<PracticeYearRange>(defaultPracticeYearRange);
  const [practiceQuestionCount, setPracticeQuestionCount] = useState<PracticeQuestionCount>(10);
  const [practiceStopAfterReview, setPracticeStopAfterReview] = useState(false);

  useEffect(() => {
    setNickname(typeof user?.user_metadata?.display_name === "string" ? user.user_metadata.display_name : "");
  }, [user]);

  useEffect(() => {
    const accountToneMode = getHomeToneModePreference(user?.user_metadata);
    const accountThemeMode = getThemeModePreference(user?.user_metadata);
    const nextToneMode = accountToneMode ?? loadHomeToneMode();
    const nextThemeMode = accountThemeMode ?? loadThemeMode();
    setHomeToneMode(nextToneMode);
    setThemeMode(nextThemeMode);
    if (accountToneMode) saveHomeToneMode(accountToneMode);
    if (accountThemeMode) saveThemeMode(accountThemeMode);
  }, [user?.id, user?.user_metadata]);

  useEffect(() => {
    const accountRange = getPracticeYearRangePreference(user?.user_metadata, defaultPracticeYearRange);
    const nextRange = accountRange ?? loadPracticeYearRange(defaultPracticeYearRange) ?? defaultPracticeYearRange;
    setPracticeYearRange(nextRange);
    if (accountRange) savePracticeYearRange(accountRange);
  }, [defaultPracticeYearRange, user?.id, user?.user_metadata]);

  useEffect(() => {
    const accountCount = getPracticeQuestionCountPreference(user?.user_metadata, 10);
    const accountStopAfterReview = getPracticeStopAfterReviewPreference(user?.user_metadata, false);
    const nextCount = user ? accountCount : loadPracticeQuestionCount(10);
    const nextStopAfterReview = user ? accountStopAfterReview : loadPracticeStopAfterReview(false);
    setPracticeQuestionCount(nextCount);
    setPracticeStopAfterReview(nextStopAfterReview);
    if (user) {
      savePracticeQuestionCount(accountCount);
      savePracticeStopAfterReview(accountStopAfterReview);
    }
  }, [user?.id, user?.user_metadata]);

  async function persistAccountPreferences(patch: AccountPreferencePatch) {
    if (!user) return;

    const { error: updateError } = await getSupabaseBrowserClient().auth.updateUser({
      data: {
        ...user.user_metadata,
        ...patch
      }
    });

    if (updateError) {
      throw updateError;
    }
  }

  function handleChangeHomeToneMode(mode: HomeToneMode) {
    setHomeToneMode(mode);
    saveHomeToneMode(mode);
    if (!user) return;
    setError("");
    void persistAccountPreferences({ home_tone_mode: mode }).catch((persistError) => {
      setError(persistError instanceof Error ? persistError.message : "首頁模式同步失敗");
    });
  }

  function handleChangeThemeMode(mode: ThemeMode) {
    setThemeMode(mode);
    saveThemeMode(mode);
    if (!user) return;
    setError("");
    void persistAccountPreferences({ theme_mode: mode }).catch((persistError) => {
      setError(persistError instanceof Error ? persistError.message : "暗夜模式同步失敗");
    });
  }

  function handleChangePracticeYearRange(next: PracticeYearRange) {
    const normalized = {
      yearFrom: Math.min(next.yearFrom, next.yearTo),
      yearTo: Math.max(next.yearFrom, next.yearTo)
    };
    setPracticeYearRange(normalized);
    savePracticeYearRange(normalized);
    if (!user) return;
    setError("");
    void persistAccountPreferences({
      practice_year_from: normalized.yearFrom,
      practice_year_to: normalized.yearTo
    }).catch((persistError) => {
      setError(persistError instanceof Error ? persistError.message : "年份設定同步失敗");
    });
  }

  function handleChangePracticeQuestionCount(next: PracticeQuestionCount) {
    setPracticeQuestionCount(next);
    savePracticeQuestionCount(next);
    if (!user) return;
    setError("");
    void persistAccountPreferences({
      practice_question_count: next
    }).catch((persistError) => {
      setError(persistError instanceof Error ? persistError.message : "題數設定同步失敗");
    });
  }

  function handleChangePracticeStopAfterReview(enabled: boolean) {
    setPracticeStopAfterReview(enabled);
    savePracticeStopAfterReview(enabled);
    if (!user) return;
    setError("");
    void persistAccountPreferences({
      practice_stop_after_review: enabled
    }).catch((persistError) => {
      setError(persistError instanceof Error ? persistError.message : "結束作答設定同步失敗");
    });
  }

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
      <section className="surface-card p-6">
        <p className="eyebrow">Account</p>
        <h2 className="display-title mt-2 text-3xl">Supabase 尚未設定</h2>
      </section>
    );
  }

  if (loading) {
    return (
      <section className="surface-card p-6">
        <p className="text-sm text-slate-600">正在讀取登入狀態...</p>
      </section>
    );
  }

  if (user) {
    return (
      <section className="surface-card p-6">
        <p className="eyebrow">Account</p>
        <div className="mt-2 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="display-title text-3xl">目前使用者</h2>
            <p className="mt-2 text-sm font-semibold text-slate-900 sm:text-base">{user.email}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="stat-chip">同步 {syncStatus}</div>
            <div className="stat-chip">ID {user.id.slice(0, 8)}...</div>
          </div>
        </div>
        <div className="mt-4 grid gap-3">
          <input
            type="text"
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            placeholder="排行榜暱稱"
            maxLength={24}
            className="min-h-12 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-800 outline-none"
          />
          <p className="text-xs text-slate-500">排行榜會顯示這個暱稱。</p>
          <div className="rounded-2xl border border-slate-200">
            <button
              type="button"
              onClick={() => setSettingsOpen((current) => !current)}
              className="flex min-h-12 w-full items-center justify-between px-4 py-3 text-left"
            >
              <div>
                <p className="text-sm font-semibold text-ink">設定</p>
                <p className="mt-1 text-xs text-slate-500">首頁模式、暗夜模式、開始測驗設定</p>
              </div>
              <span className="text-sm font-semibold text-slate-500">{settingsOpen ? "收合" : "展開"}</span>
            </button>
            {settingsOpen ? (
              <div className="border-t border-slate-200 px-4 py-4">
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">首頁模式</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleChangeHomeToneMode("calm")}
                        className={`min-h-11 rounded-full px-4 py-2 text-sm font-semibold transition ${
                          homeToneMode === "calm"
                            ? "bg-emerald-100 text-emerald-950"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}
                      >
                        抗焦慮版
                      </button>
                      <button
                        type="button"
                        onClick={() => handleChangeHomeToneMode("anxious")}
                        className={`min-h-11 rounded-full px-4 py-2 text-sm font-semibold transition ${
                          homeToneMode === "anxious"
                            ? "bg-rose-100 text-rose-950"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}
                      >
                        焦慮版
                      </button>
                      <button
                        type="button"
                        onClick={() => handleChangeThemeMode(themeMode === "dark" ? "light" : "dark")}
                        className={`min-h-11 rounded-full px-4 py-2 text-sm font-semibold transition ${
                          themeMode === "dark"
                            ? "bg-slate-900 text-slate-100"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}
                      >
                        暗夜模式
                      </button>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">開始測驗抽題年份</p>
                    <p className="mt-2 text-sm text-slate-600">
                      目前設定：{practiceYearRange.yearFrom} 年到 {practiceYearRange.yearTo} 年
                    </p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <label className="grid gap-2 text-sm text-slate-700">
                        從哪一年開始
                        <select
                          value={practiceYearRange.yearFrom}
                          onChange={(event) => {
                            const nextFrom = Number(event.target.value);
                            handleChangePracticeYearRange({
                              yearFrom: nextFrom,
                              yearTo: Math.max(nextFrom, practiceYearRange.yearTo)
                            });
                          }}
                          className="min-h-12 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-800 outline-none"
                        >
                          {availableYears.map((year) => (
                            <option key={`from-${year}`} value={year}>
                              {year}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="grid gap-2 text-sm text-slate-700">
                        到哪一年結束
                        <select
                          value={practiceYearRange.yearTo}
                          onChange={(event) => {
                            const nextTo = Number(event.target.value);
                            handleChangePracticeYearRange({
                              yearFrom: Math.min(practiceYearRange.yearFrom, nextTo),
                              yearTo: nextTo
                            });
                          }}
                          className="min-h-12 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-800 outline-none"
                        >
                          {availableYears.map((year) => (
                            <option key={`to-${year}`} value={year}>
                              {year}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">作答節奏</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleChangePracticeStopAfterReview(false)}
                        className={`min-h-11 rounded-full px-4 py-2 text-sm font-semibold transition ${
                          !practiceStopAfterReview
                            ? "bg-brand-600 text-white"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}
                      >
                        正常做完整輪
                      </button>
                      <button
                        type="button"
                        onClick={() => handleChangePracticeStopAfterReview(true)}
                        className={`min-h-11 rounded-full px-4 py-2 text-sm font-semibold transition ${
                          practiceStopAfterReview
                            ? "bg-amber-100 text-amber-900 ring-1 ring-amber-300"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}
                      >
                        看完某題詳解後結束
                      </button>
                    </div>
                  </div>

                  {!practiceStopAfterReview ? (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">開始測驗題數</p>
                      <p className="mt-2 text-sm text-slate-600">目前設定：每次 {practiceQuestionCount} 題</p>
                      <label className="mt-3 grid gap-2 text-sm text-slate-700 sm:max-w-xs">
                        選擇題數
                        <select
                          value={practiceQuestionCount}
                          onChange={(event) =>
                            handleChangePracticeQuestionCount(
                              Number(event.target.value) as PracticeQuestionCount
                            )
                          }
                          className="min-h-12 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-800 outline-none"
                        >
                          {[5, 10, 15, 20, 25, 30, 35, 40, 45, 50].map((count) => (
                            <option key={count} value={count}>
                              {count} 題
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
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
              className="secondary-pill text-center"
            >
              私有數據頁
            </a>
          ) : null}
          <a
            href="/progress"
            className="secondary-pill text-center"
          >
            進度總覽
          </a>
          <button
            type="button"
            onClick={() => void handleSaveNickname()}
            disabled={submitting}
            className="secondary-pill disabled:cursor-not-allowed disabled:bg-slate-100"
          >
            儲存暱稱
          </button>
          <button
            type="button"
            onClick={() => void refreshCloudData()}
            className="primary-pill"
          >
            立即同步雲端紀錄
          </button>
          <button
            type="button"
            onClick={() => void signOut()}
            className="secondary-pill"
          >
            登出
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="surface-card p-6">
      <p className="eyebrow">Account</p>
      <h2 className="display-title mt-2 text-3xl">建立個人雲端紀錄</h2>
      <p className="body-soft mt-3 text-sm leading-7">登入後可以同步作答、錯題與自訂卷。</p>

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
          className="primary-pill disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          以 Email 登入
        </button>
        <button
          type="button"
          onClick={() => void handleSignUp()}
          disabled={submitting || !email || !password}
          className="secondary-pill disabled:cursor-not-allowed disabled:bg-slate-100"
        >
          註冊新帳號
        </button>
      </div>
    </section>
  );
}
