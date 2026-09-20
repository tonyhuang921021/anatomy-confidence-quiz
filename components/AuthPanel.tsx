"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { Check } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { getSyncStatusText } from "@/components/syncStatusText";
import { updateLeaderboardDisplayName } from "@/lib/cloudSync";
import {
  loadPharmacologyReverseSwipe,
  loadSimulationConfidenceCalibration,
  loadSimulationOptionElimination,
  loadReviewCompletionThreshold,
  loadHomeToneMode,
  loadThemeMode,
  savePharmacologyReverseSwipe,
  saveSimulationConfidenceCalibration,
  saveSimulationOptionElimination,
  saveReviewCompletionThreshold,
  saveHomeToneMode,
  saveThemeMode,
  type ReviewCompletionThreshold,
  type HomeToneMode,
  type ThemeMode
} from "@/lib/storage";
import {
  getHomeToneModePreference,
  getPharmacologyReverseSwipePreference,
  hasPharmacologyReverseSwipePreference,
  hasSimulationConfidenceCalibrationPreference,
  hasSimulationOptionEliminationPreference,
  hasReviewCompletionThresholdPreference,
  getSimulationConfidenceCalibrationPreference,
  getSimulationOptionEliminationPreference,
  getReviewCompletionThresholdPreference,
  getThemeModePreference,
  type AccountPreferencePatch
} from "@/lib/accountPreferences";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSupabaseRecoveryMode } from "@/lib/supabase/recoveryMode";

const AUTH_ACTION_TIMEOUT_MS = 15000;
const AUTH_SESSION_RECOVERY_TIMEOUT_MS = 2500;
const REMEMBER_ACCOUNT_KEY = "medQuizRememberAccount";
const REMEMBERED_EMAIL_KEY = "medQuizRememberedEmail";
const RECOVERY_MODE_MESSAGE = "暫用本機，稍後補傳。雲端登入與同步維護中，目前紀錄會先留在本機。";
const AUTH_INPUT_CLASS_NAME =
  "min-h-12 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-800 outline-none transition focus-visible:border-brand-500 focus-visible:ring-2 focus-visible:ring-brand-200 focus-visible:ring-offset-1";
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => reject(new Error(message)), timeoutMs);
    promise
      .then(resolve)
      .catch(reject)
      .finally(() => window.clearTimeout(timeoutId));
  });
}

function safeReadLocalStorage(key: string) {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeWriteLocalStorage(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore browsers that block storage; Supabase session storage still handles auth.
  }
}

function safeRemoveLocalStorage(key: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore browsers that block storage.
  }
}

function loadRememberAccountPreference() {
  return safeReadLocalStorage(REMEMBER_ACCOUNT_KEY) !== "false";
}

function PreferenceGroup({
  title,
  description,
  children
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="account-preference-group">
      <header className="account-preference-group-heading">
        <h3>{title}</h3>
        <p>{description}</p>
      </header>
      <div className="account-preference-list">{children}</div>
    </section>
  );
}

function PreferenceRow({
  label,
  description,
  children
}: {
  label: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="account-preference-row">
      <div className="account-preference-copy">
        <h4>{label}</h4>
        <p>{description}</p>
      </div>
      <div className="account-preference-control">{children}</div>
    </div>
  );
}

function PreferenceChoice({
  selected,
  onClick,
  children
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`account-preference-choice${selected ? " is-selected" : ""}`}
      aria-pressed={selected}
      onClick={onClick}
    >
      <span className="account-preference-choice-indicator" aria-hidden="true">
        {selected ? <Check size={14} strokeWidth={2.4} /> : null}
      </span>
      <span>{children}</span>
    </button>
  );
}

async function getRecoveredAuthSession() {
  try {
    const {
      data: { session }
    } = await withTimeout(
      getSupabaseBrowserClient().auth.getSession(),
      AUTH_SESSION_RECOVERY_TIMEOUT_MS,
      "登入狀態補抓逾時"
    );
    return session ?? null;
  } catch {
    return null;
  }
}

export function AuthPanel({ compactHeader = false }: { compactHeader?: boolean } = {}) {
  const recoveryMode = isSupabaseRecoveryMode();
  const {
    configured,
    loading,
    user,
    passwordRecovery,
    syncStatus,
    syncError,
    pendingCompletedUploadCount,
    applyAuthSession,
    finishPasswordRecovery,
    refreshCloudData,
    signOut
  } = useAuth();
  const [authMode, setAuthMode] = useState<"login" | "register" | "reset">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberAccount, setRememberAccount] = useState(true);
  const [newPassword, setNewPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [homeToneMode, setHomeToneMode] = useState<HomeToneMode>("calm");
  const [themeMode, setThemeMode] = useState<ThemeMode>("light");
  const ownerAllowedEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "tonyhuang921021@gmail.com")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  const canViewOwnerPage = user?.email
    ? ownerAllowedEmails.includes(user.email.trim().toLowerCase())
    : false;
  const [reviewCompletionThreshold, setReviewCompletionThreshold] = useState<ReviewCompletionThreshold>(() =>
    loadReviewCompletionThreshold(2)
  );
  const [simulationConfidenceCalibration, setSimulationConfidenceCalibration] = useState(() =>
    loadSimulationConfidenceCalibration(true)
  );
  const [simulationOptionElimination, setSimulationOptionElimination] = useState(() =>
    loadSimulationOptionElimination(false)
  );
  const [pharmacologyReverseSwipe, setPharmacologyReverseSwipe] = useState(() =>
    loadPharmacologyReverseSwipe(false)
  );

  useEffect(() => {
    const shouldRemember = loadRememberAccountPreference();
    setRememberAccount(shouldRemember);
    if (shouldRemember) {
      const rememberedEmail = safeReadLocalStorage(REMEMBERED_EMAIL_KEY);
      if (rememberedEmail) {
        setEmail((current) => current || rememberedEmail);
      }
    }
  }, []);

  useEffect(() => {
    if (!user?.email) return;
    setEmail(user.email);
    if (rememberAccount) {
      safeWriteLocalStorage(REMEMBERED_EMAIL_KEY, user.email);
    }
  }, [rememberAccount, user?.email]);

  function persistRememberedEmail(nextEmail: string) {
    safeWriteLocalStorage(REMEMBER_ACCOUNT_KEY, rememberAccount ? "true" : "false");
    if (rememberAccount) {
      safeWriteLocalStorage(REMEMBERED_EMAIL_KEY, nextEmail.trim());
    } else {
      safeRemoveLocalStorage(REMEMBERED_EMAIL_KEY);
    }
  }

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
    const accountReviewCompletionThreshold = getReviewCompletionThresholdPreference(user?.user_metadata, 2);
    const accountSimulationConfidenceCalibration = getSimulationConfidenceCalibrationPreference(user?.user_metadata, true);
    const accountSimulationOptionElimination = getSimulationOptionEliminationPreference(user?.user_metadata, false);
    const accountPharmacologyReverseSwipe = getPharmacologyReverseSwipePreference(user?.user_metadata, false);
    const nextReviewCompletionThreshold = user
      ? accountReviewCompletionThreshold
      : loadReviewCompletionThreshold(2);
    const nextSimulationConfidenceCalibration = user
      ? accountSimulationConfidenceCalibration
      : loadSimulationConfidenceCalibration(true);
    const nextSimulationOptionElimination = user
      ? accountSimulationOptionElimination
      : loadSimulationOptionElimination(false);
    const nextPharmacologyReverseSwipe = user
      ? accountPharmacologyReverseSwipe
      : loadPharmacologyReverseSwipe(false);
    setReviewCompletionThreshold(nextReviewCompletionThreshold);
    setSimulationConfidenceCalibration(nextSimulationConfidenceCalibration);
    setSimulationOptionElimination(nextSimulationOptionElimination);
    setPharmacologyReverseSwipe(nextPharmacologyReverseSwipe);
    if (user) {
      saveReviewCompletionThreshold(accountReviewCompletionThreshold);
      saveSimulationConfidenceCalibration(accountSimulationConfidenceCalibration);
      saveSimulationOptionElimination(accountSimulationOptionElimination);
      savePharmacologyReverseSwipe(accountPharmacologyReverseSwipe);
      const missingReviewCompletionThreshold = !hasReviewCompletionThresholdPreference(user.user_metadata);
      const missingSimulationConfidenceCalibration = !hasSimulationConfidenceCalibrationPreference(user.user_metadata);
      const missingSimulationOptionElimination = !hasSimulationOptionEliminationPreference(user.user_metadata);
      const missingPharmacologyReverseSwipe = !hasPharmacologyReverseSwipePreference(user.user_metadata);
      if (
        missingReviewCompletionThreshold ||
        missingSimulationConfidenceCalibration ||
        missingSimulationOptionElimination ||
        missingPharmacologyReverseSwipe
      ) {
        const patch: AccountPreferencePatch = {};
        if (missingReviewCompletionThreshold) patch.review_completion_threshold = 2;
        if (missingSimulationConfidenceCalibration) patch.simulation_confidence_calibration = true;
        if (missingSimulationOptionElimination) patch.simulation_option_elimination = false;
        if (missingPharmacologyReverseSwipe) patch.pharmacology_reverse_swipe = false;
        void persistAccountPreferences(patch).catch(() => {});
      }
    } else {
      saveReviewCompletionThreshold(nextReviewCompletionThreshold);
      saveSimulationConfidenceCalibration(nextSimulationConfidenceCalibration);
      saveSimulationOptionElimination(nextSimulationOptionElimination);
      savePharmacologyReverseSwipe(nextPharmacologyReverseSwipe);
    }
  }, [user?.id, user?.user_metadata]);

  async function persistAccountPreferences(patch: AccountPreferencePatch) {
    if (!user || recoveryMode) return;

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

  function handleChangeReviewCompletionThreshold(threshold: ReviewCompletionThreshold) {
    setReviewCompletionThreshold(threshold);
    saveReviewCompletionThreshold(threshold);
    if (!user) return;
    setError("");
    void persistAccountPreferences({
      review_completion_threshold: threshold
    }).catch((persistError) => {
      setError(persistError instanceof Error ? persistError.message : "複習完成條件同步失敗");
    });
  }

  function handleChangeSimulationConfidenceCalibration(enabled: boolean) {
    setSimulationConfidenceCalibration(enabled);
    saveSimulationConfidenceCalibration(enabled);
    if (!user) return;
    setError("");
    void persistAccountPreferences({
      simulation_confidence_calibration: enabled
    }).catch((persistError) => {
      setError(persistError instanceof Error ? persistError.message : "信心校準設定同步失敗");
    });
  }

  function handleChangeSimulationOptionElimination(enabled: boolean) {
    setSimulationOptionElimination(enabled);
    saveSimulationOptionElimination(enabled);
    if (!user) return;
    setError("");
    void persistAccountPreferences({
      simulation_option_elimination: enabled
    }).catch((persistError) => {
      setError(persistError instanceof Error ? persistError.message : "選項打叉設定同步失敗");
    });
  }

  function handleChangePharmacologyReverseSwipe(enabled: boolean) {
    setPharmacologyReverseSwipe(enabled);
    savePharmacologyReverseSwipe(enabled);
    if (!user) return;
    setError("");
    void persistAccountPreferences({
      pharmacology_reverse_swipe: enabled
    }).catch((persistError) => {
      setError(persistError instanceof Error ? persistError.message : "藥理卡滑動設定同步失敗");
    });
  }

  async function handleSignIn() {
    if (recoveryMode) {
      setError(RECOVERY_MODE_MESSAGE);
      return;
    }

    setSubmitting(true);
    setMessage("");
    setError("");
    const trimmedEmail = email.trim();
    persistRememberedEmail(trimmedEmail);

    try {
      const { data, error: signInError } = await withTimeout(
        getSupabaseBrowserClient().auth.signInWithPassword({
          email: trimmedEmail,
          password
        }),
        AUTH_ACTION_TIMEOUT_MS,
        "登入伺服器暫時忙碌，請稍後再試。"
      );

      if (signInError) {
        setError(signInError.message);
        return;
      }

      applyAuthSession(data.session ?? null);
      setMessage("登入成功，正在同步雲端紀錄。");
    } catch (signInError) {
      const recoveredSession = await getRecoveredAuthSession();
      if (recoveredSession) {
        applyAuthSession(recoveredSession);
        setMessage("登入成功，雲端紀錄會在背景同步。");
        setError("");
        return;
      }
      setError(signInError instanceof Error ? signInError.message : "登入失敗，請稍後再試。");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSignUp() {
    if (recoveryMode) {
      setError(RECOVERY_MODE_MESSAGE);
      return;
    }

    setSubmitting(true);
    setMessage("");
    setError("");
    const trimmedEmail = email.trim();
    persistRememberedEmail(trimmedEmail);

    try {
      const { error: signUpError } = await withTimeout(
        getSupabaseBrowserClient().auth.signUp({
          email: trimmedEmail,
          password,
          options: {
            emailRedirectTo:
              typeof window !== "undefined" ? `${window.location.origin}/` : undefined,
            data: nickname.trim() ? { display_name: nickname.trim().slice(0, 24) } : undefined
          }
        }),
        AUTH_ACTION_TIMEOUT_MS,
        "註冊伺服器暫時忙碌，請稍後再試。"
      );

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      setMessage("註冊成功，去 email 完成驗證。");
    } catch (signUpError) {
      setError(signUpError instanceof Error ? signUpError.message : "註冊失敗，請稍後再試。");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSendPasswordReset() {
    if (recoveryMode) {
      setError(RECOVERY_MODE_MESSAGE);
      return;
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("請先輸入 Email。");
      return;
    }
    persistRememberedEmail(trimmedEmail);

    setSubmitting(true);
    setMessage("");
    setError("");

    try {
      const { error: resetError } = await withTimeout(
        getSupabaseBrowserClient().auth.resetPasswordForEmail(trimmedEmail, {
          redirectTo: typeof window !== "undefined" ? `${window.location.origin}/reset-password` : undefined
        }),
        AUTH_ACTION_TIMEOUT_MS,
        "重設密碼信寄送逾時，請稍後再試。"
      );

      if (resetError) {
        setError(resetError.message);
        return;
      }

      setMessage("重設密碼信已寄出，請到信箱點連結後設定新密碼。");
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "重設密碼信寄送失敗，請稍後再試。");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdateRecoveredPassword() {
    if (recoveryMode) {
      setError(RECOVERY_MODE_MESSAGE);
      return;
    }

    if (newPassword.length < 6) {
      setError("新密碼至少需要 6 個字元。");
      return;
    }

    setSubmitting(true);
    setMessage("");
    setError("");

    try {
      const { error: updateError } = await withTimeout(
        getSupabaseBrowserClient().auth.updateUser({
          password: newPassword
        }),
        AUTH_ACTION_TIMEOUT_MS,
        "更新密碼逾時，請稍後再試。"
      );

      if (updateError) {
        setError(updateError.message);
        return;
      }

      setNewPassword("");
      finishPasswordRecovery();
      setMessage("密碼已更新，之後可以用新密碼登入。");
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "更新密碼失敗，請稍後再試。");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveNickname() {
    if (!user) return;
    if (recoveryMode) {
      setError(RECOVERY_MODE_MESSAGE);
      return;
    }
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
      await refreshCloudData({ hydrateRemoteHistory: false });
      setMessage("暱稱已更新，排行榜會顯示新的名稱。");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSignOutClick() {
    setSigningOut(true);
    setError("");
    setMessage("正在登出這台瀏覽器...");
    await signOut();
    setSigningOut(false);
  }

  if (!configured) {
    return (
      <section className="surface-card p-6">
        <p className="eyebrow">Account</p>
        <h2 className="display-title mt-2 text-3xl">登入功能暫時無法使用</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">你仍可繼續刷題，作答紀錄會保存在這台裝置。</p>
      </section>
    );
  }

  if (recoveryMode) {
    return (
      <section className="surface-card p-6">
        <p className="eyebrow">Account</p>
        <h2 className="display-title mt-2 text-3xl">雲端同步維護中</h2>
        <p className="body-soft mt-3 text-sm leading-7">
          目前先暫停登入與跨裝置同步，避免伺服器忙碌時卡住作答。你仍然可以用訪客模式刷題，本機紀錄會保存在這台裝置。
        </p>
        <div className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm leading-7 text-amber-900">
          {RECOVERY_MODE_MESSAGE}
        </div>
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

  if (user && passwordRecovery) {
    return (
      <section className="surface-card p-6">
        <p className="eyebrow">Password Reset</p>
        <h2 className="display-title mt-2 text-3xl">設定新密碼</h2>
        <p className="body-soft mt-3 text-sm leading-7">
          已確認重設連結，請輸入新密碼。完成後就能用新密碼登入。
        </p>

        <div className="mt-5 grid gap-3">
          <input
            type="password"
            aria-label="新密碼"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            placeholder="新密碼（至少 6 個字元）"
            className={AUTH_INPUT_CLASS_NAME}
          />
        </div>

        {message ? (
          <div className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900" role="status" aria-live="polite">{message}</div>
        ) : null}
        {error ? (
          <div className="mt-4 rounded-2xl bg-rose-50 p-4 text-sm text-rose-900" role="alert">{error}</div>
        ) : null}

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => void handleUpdateRecoveredPassword()}
            disabled={submitting || newPassword.length < 6}
            className="primary-pill disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            更新密碼
          </button>
          <button
            type="button"
            onClick={() => {
              finishPasswordRecovery();
              setNewPassword("");
              setError("");
            }}
            className="secondary-pill"
          >
            先略過
          </button>
        </div>
      </section>
    );
  }

  if (user) {
    return (
      <section className="surface-card account-settings-content p-6">
        {!compactHeader ? (
          <>
            <p className="eyebrow">帳號資料</p>
            <div className="account-settings-hero mt-2 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="display-title text-3xl">目前使用者</h2>
                <p className="mt-2 text-sm font-semibold text-slate-900 sm:text-base">{user.email}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="stat-chip" role="status" aria-live="polite">
                  {getSyncStatusText(
                    syncStatus,
                    Boolean(syncError),
                    pendingCompletedUploadCount
                  )}
                </div>
                <div className="stat-chip">ID {user.id.slice(0, 8)}...</div>
              </div>
            </div>
          </>
        ) : null}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <p className="text-sm text-slate-600" role="status" aria-live="polite">
            {getSyncStatusText(syncStatus, Boolean(syncError), pendingCompletedUploadCount)}
          </p>
          <button
            type="button"
            onClick={() => void refreshCloudData({ hydrateRemoteHistory: true, uploadAllPending: true })}
            disabled={syncStatus === "syncing"}
            className="primary-pill disabled:cursor-not-allowed disabled:opacity-60"
          >
            {syncStatus === "syncing" ? "同步中..." : "立即同步雲端紀錄"}
          </button>
        </div>
        <div className="account-settings-body mt-4 grid gap-3">
          <label className="account-settings-field">
            <span>排行榜暱稱</span>
            <input
              type="text"
              aria-label="排行榜暱稱"
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              placeholder="輸入要顯示的名稱"
              maxLength={24}
              className={AUTH_INPUT_CLASS_NAME}
            />
            <small>排行榜與公開互動會顯示這個名稱。</small>
          </label>
          <div className="account-settings-preferences">
            <header className="account-settings-preferences-heading">
              <p>偏好設定</p>
              <span>各項設定會保存在這台裝置，登入後也會帶到其他裝置。</span>
            </header>
            <div className="account-preference-sections">
                <PreferenceGroup title="顯示" description="首頁文字與畫面模式">
                  <PreferenceRow label="首頁提示" description="選擇首頁顯示的文字語氣。">
                    <div className="account-preference-options" role="group" aria-label="首頁提示">
                      <PreferenceChoice
                        selected={homeToneMode === "calm"}
                        onClick={() => handleChangeHomeToneMode("calm")}
                      >
                        抗焦慮版
                      </PreferenceChoice>
                      <PreferenceChoice
                        selected={homeToneMode === "anxious"}
                        onClick={() => handleChangeHomeToneMode("anxious")}
                      >
                        焦慮版
                      </PreferenceChoice>
                    </div>
                  </PreferenceRow>
                  <PreferenceRow label="畫面模式" description="依閱讀環境切換明亮或暗色畫面。">
                    <div className="account-preference-options" role="group" aria-label="畫面模式">
                      <PreferenceChoice
                        selected={themeMode === "light"}
                        onClick={() => handleChangeThemeMode("light")}
                      >
                        明亮
                      </PreferenceChoice>
                      <PreferenceChoice
                        selected={themeMode === "dark"}
                        onClick={() => handleChangeThemeMode("dark")}
                      >
                        暗夜
                      </PreferenceChoice>
                    </div>
                  </PreferenceRow>
                </PreferenceGroup>

                <PreferenceGroup title="複習" description="錯題與低信心題的完成條件">
                  <PreferenceRow label="複習完成" description="同時套用錯題與沒信心題；手動調整仍優先保留。">
                    <div className="account-preference-options" role="group" aria-label="複習完成條件">
                      <PreferenceChoice
                        selected={reviewCompletionThreshold === 1}
                        onClick={() => handleChangeReviewCompletionThreshold(1)}
                      >
                        答對 1 次
                      </PreferenceChoice>
                      <PreferenceChoice
                        selected={reviewCompletionThreshold === 2}
                        onClick={() => handleChangeReviewCompletionThreshold(2)}
                      >
                        答對 2 次
                      </PreferenceChoice>
                    </div>
                  </PreferenceRow>
                </PreferenceGroup>

                <PreferenceGroup title="模擬考" description="考試中使用的輔助工具">
                  <PreferenceRow label="信心校準" description="關閉後只看答題結果；散題的低信心複習不受影響。">
                    <div className="account-preference-options" role="group" aria-label="模擬考信心校準">
                      <PreferenceChoice
                        selected={simulationConfidenceCalibration}
                        onClick={() => handleChangeSimulationConfidenceCalibration(true)}
                      >
                        開啟
                      </PreferenceChoice>
                      <PreferenceChoice
                        selected={!simulationConfidenceCalibration}
                        onClick={() => handleChangeSimulationConfidenceCalibration(false)}
                      >
                        關閉
                      </PreferenceChoice>
                    </div>
                  </PreferenceRow>
                  <PreferenceRow label="選項排除" description="在選項旁標記先排除的答案，結果頁會一起保留。">
                    <div className="account-preference-options" role="group" aria-label="模擬考選項排除">
                      <PreferenceChoice
                        selected={!simulationOptionElimination}
                        onClick={() => handleChangeSimulationOptionElimination(false)}
                      >
                        關閉
                      </PreferenceChoice>
                      <PreferenceChoice
                        selected={simulationOptionElimination}
                        onClick={() => handleChangeSimulationOptionElimination(true)}
                      >
                        開啟
                      </PreferenceChoice>
                    </div>
                  </PreferenceRow>
                </PreferenceGroup>

                <PreferenceGroup title="藥理複習" description="卡片操作偏好">
                  <PreferenceRow label="滑動方向" description="只改變卡片手勢，抽卡權重仍依會與不會的紀錄。">
                    <div className="account-preference-options" role="group" aria-label="藥理卡滑動方向">
                      <PreferenceChoice
                        selected={!pharmacologyReverseSwipe}
                        onClick={() => handleChangePharmacologyReverseSwipe(false)}
                      >
                        左會、右不會
                      </PreferenceChoice>
                      <PreferenceChoice
                        selected={pharmacologyReverseSwipe}
                        onClick={() => handleChangePharmacologyReverseSwipe(true)}
                      >
                        左不會、右會
                      </PreferenceChoice>
                    </div>
                  </PreferenceRow>
                </PreferenceGroup>
            </div>
          </div>
        </div>
        {syncError ? (
          <div className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900" role="status" aria-live="polite">{syncError}</div>
        ) : null}
        {message ? (
          <div className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900" role="status" aria-live="polite">{message}</div>
        ) : null}
        {error ? (
          <div className="mt-4 rounded-2xl bg-rose-50 p-4 text-sm text-rose-900" role="alert">{error}</div>
        ) : null}
        <div className="account-settings-actions mt-5 flex flex-col gap-3 sm:flex-row">
          {canViewOwnerPage ? (
            <>
              <Link
                href="/owner"
                className="secondary-pill text-center"
              >
                私有數據頁
              </Link>
            </>
          ) : null}
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
            onClick={() => void handleSignOutClick()}
            disabled={signingOut}
            className="secondary-pill disabled:cursor-not-allowed disabled:bg-slate-100"
          >
            {signingOut ? "登出中..." : "登出"}
          </button>
        </div>
      </section>
    );
  }

  function switchAuthMode(nextMode: "login" | "register" | "reset") {
    setAuthMode(nextMode);
    setMessage("");
    setError("");
  }

  return (
    <section className="min-w-0">
      <h2 className="text-xl font-semibold text-ink">
        {authMode === "login" ? "登入帳號" : authMode === "register" ? "註冊新帳號" : "重設密碼"}
      </h2>
      <p className="mt-2 text-sm leading-6 text-slate-500">
        {authMode === "reset"
          ? "輸入註冊時的 Email，我們會寄出重設密碼連結。"
          : "目前作答保存在這台裝置；登入後可同步到其他裝置。"}
      </p>

      <form
        className="mt-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (submitting || !email.trim() || (authMode !== "reset" && !password)) return;
          if (authMode === "reset") void handleSendPasswordReset();
          else if (authMode === "register") void handleSignUp();
          else void handleSignIn();
        }}
      >
        <div className="grid gap-4">
          <label className="grid gap-2 text-sm font-medium text-ink">
            Email
            <input
              type="email"
              name="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@example.com"
              className={AUTH_INPUT_CLASS_NAME}
            />
          </label>
          {authMode !== "reset" ? (
            <label className="grid gap-2 text-sm font-medium text-ink">
              密碼
              <input
                type="password"
                name="password"
                autoComplete={authMode === "register" ? "new-password" : "current-password"}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={authMode === "register" ? "至少 6 個字元" : "輸入密碼"}
                className={AUTH_INPUT_CLASS_NAME}
              />
            </label>
          ) : null}
          {authMode === "register" ? (
            <label className="grid gap-2 text-sm font-medium text-ink">
              公開暱稱（選填）
              <input
                type="text"
                aria-label="公開暱稱（選填）"
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                placeholder="排行榜與公開互動會顯示的名稱"
                maxLength={24}
                className={AUTH_INPUT_CLASS_NAME}
              />
            </label>
          ) : null}
          {authMode !== "reset" ? (
            <label className="flex items-center gap-3 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={rememberAccount}
                onChange={(event) => {
                  const checked = event.target.checked;
                  setRememberAccount(checked);
                  safeWriteLocalStorage(REMEMBER_ACCOUNT_KEY, checked ? "true" : "false");
                  if (!checked) safeRemoveLocalStorage(REMEMBERED_EMAIL_KEY);
                  else if (email.trim()) safeWriteLocalStorage(REMEMBERED_EMAIL_KEY, email.trim());
                }}
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
              />
              記住 Email 並保持登入
            </label>
          ) : null}
        </div>

        {message ? <div className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900" role="status" aria-live="polite">{message}</div> : null}
        {syncError ? <div className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900" role="status" aria-live="polite">{syncError}</div> : null}
        {error ? <div className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-900" role="alert">{error}</div> : null}

        <button
          type="submit"
          disabled={submitting || !email.trim() || (authMode !== "reset" && !password)}
          className="mt-5 min-h-12 w-full rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {submitting ? "處理中…" : authMode === "login" ? "以 Email 登入" : authMode === "register" ? "建立帳號" : "寄送重設密碼信"}
        </button>
      </form>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4">
        <button
          type="button"
          disabled={submitting}
          onClick={() => switchAuthMode(authMode === "login" ? "register" : "login")}
          className="min-h-11 rounded-lg py-2 text-sm font-semibold text-brand-700 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-50"
        >
          {authMode === "login" ? "註冊新帳號" : "返回登入"}
        </button>
        {authMode === "login" ? (
          <button
            type="button"
            disabled={submitting}
            onClick={() => switchAuthMode("reset")}
            className="min-h-11 rounded-lg py-2 text-sm text-slate-600 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-50"
          >
            忘記密碼
          </button>
        ) : null}
      </div>
    </section>
  );
}
