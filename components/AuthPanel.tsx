"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { getSyncStatusText } from "@/components/syncStatusText";
import { updateLeaderboardDisplayName } from "@/lib/cloudSync";
import {
  loadPracticeQuestionCount,
  loadKeyboardQuestionNavigation,
  loadPharmacologyReverseSwipe,
  loadSimulationConfidenceCalibration,
  loadSimulationOptionElimination,
  loadPracticeFastAnswerMode,
  loadPracticeStopAfterReview,
  loadReviewCompletionThreshold,
  loadHomeToneMode,
  loadThemeMode,
  savePracticeQuestionCount,
  saveKeyboardQuestionNavigation,
  savePharmacologyReverseSwipe,
  saveSimulationConfidenceCalibration,
  saveSimulationOptionElimination,
  savePracticeFastAnswerMode,
  savePracticeStopAfterReview,
  saveReviewCompletionThreshold,
  saveHomeToneMode,
  saveThemeMode,
  type PracticeQuestionCount,
  type ReviewCompletionThreshold,
  type HomeToneMode,
  type ThemeMode
} from "@/lib/storage";
import {
  getHomeToneModePreference,
  getKeyboardQuestionNavigationPreference,
  getPharmacologyReverseSwipePreference,
  hasPracticeQuestionCountPreference,
  hasKeyboardQuestionNavigationPreference,
  hasPharmacologyReverseSwipePreference,
  hasSimulationConfidenceCalibrationPreference,
  hasSimulationOptionEliminationPreference,
  hasPracticeFastAnswerModePreference,
  hasPracticeStopAfterReviewPreference,
  hasReviewCompletionThresholdPreference,
  getSimulationConfidenceCalibrationPreference,
  getSimulationOptionEliminationPreference,
  getPracticeFastAnswerModePreference,
  getPracticeQuestionCountPreference,
  getPracticeStopAfterReviewPreference,
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const ownerAllowedEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "tonyhuang921021@gmail.com")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  const canViewOwnerPage = user?.email
    ? ownerAllowedEmails.includes(user.email.trim().toLowerCase())
    : false;
  const [practiceQuestionCount, setPracticeQuestionCount] = useState<PracticeQuestionCount>(10);
  const [practiceStopAfterReview, setPracticeStopAfterReview] = useState(false);
  const [practiceFastAnswerMode, setPracticeFastAnswerMode] = useState(false);
  const [reviewCompletionThreshold, setReviewCompletionThreshold] = useState<ReviewCompletionThreshold>(() =>
    loadReviewCompletionThreshold(2)
  );
  const [keyboardQuestionNavigation, setKeyboardQuestionNavigation] = useState(false);
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
    const accountCount = getPracticeQuestionCountPreference(user?.user_metadata, 10);
    const accountStopAfterReview = getPracticeStopAfterReviewPreference(user?.user_metadata, false);
    const accountFastAnswerMode = getPracticeFastAnswerModePreference(user?.user_metadata, false);
    const accountReviewCompletionThreshold = getReviewCompletionThresholdPreference(user?.user_metadata, 2);
    const accountKeyboardQuestionNavigation = getKeyboardQuestionNavigationPreference(user?.user_metadata, false);
    const accountSimulationConfidenceCalibration = getSimulationConfidenceCalibrationPreference(user?.user_metadata, true);
    const accountSimulationOptionElimination = getSimulationOptionEliminationPreference(user?.user_metadata, false);
    const accountPharmacologyReverseSwipe = getPharmacologyReverseSwipePreference(user?.user_metadata, false);
    const nextCount = user ? accountCount : loadPracticeQuestionCount(10);
    const nextStopAfterReview = user ? accountStopAfterReview : loadPracticeStopAfterReview(false);
    const nextFastAnswerMode = user ? accountFastAnswerMode : loadPracticeFastAnswerMode(false);
    const nextReviewCompletionThreshold = user
      ? accountReviewCompletionThreshold
      : loadReviewCompletionThreshold(2);
    const nextKeyboardQuestionNavigation = user
      ? accountKeyboardQuestionNavigation
      : loadKeyboardQuestionNavigation(false);
    const nextSimulationConfidenceCalibration = user
      ? accountSimulationConfidenceCalibration
      : loadSimulationConfidenceCalibration(true);
    const nextSimulationOptionElimination = user
      ? accountSimulationOptionElimination
      : loadSimulationOptionElimination(false);
    const nextPharmacologyReverseSwipe = user
      ? accountPharmacologyReverseSwipe
      : loadPharmacologyReverseSwipe(false);
    setPracticeQuestionCount(nextCount);
    setPracticeStopAfterReview(nextStopAfterReview);
    setPracticeFastAnswerMode(nextFastAnswerMode);
    setReviewCompletionThreshold(nextReviewCompletionThreshold);
    setKeyboardQuestionNavigation(nextKeyboardQuestionNavigation);
    setSimulationConfidenceCalibration(nextSimulationConfidenceCalibration);
    setSimulationOptionElimination(nextSimulationOptionElimination);
    setPharmacologyReverseSwipe(nextPharmacologyReverseSwipe);
    if (user) {
      savePracticeQuestionCount(accountCount);
      savePracticeStopAfterReview(accountStopAfterReview);
      savePracticeFastAnswerMode(accountFastAnswerMode);
      saveReviewCompletionThreshold(accountReviewCompletionThreshold);
      saveKeyboardQuestionNavigation(accountKeyboardQuestionNavigation);
      saveSimulationConfidenceCalibration(accountSimulationConfidenceCalibration);
      saveSimulationOptionElimination(accountSimulationOptionElimination);
      savePharmacologyReverseSwipe(accountPharmacologyReverseSwipe);
      const missingQuestionCount = !hasPracticeQuestionCountPreference(user.user_metadata);
      const missingStopAfterReview = !hasPracticeStopAfterReviewPreference(user.user_metadata);
      const missingFastAnswerMode = !hasPracticeFastAnswerModePreference(user.user_metadata);
      const missingReviewCompletionThreshold = !hasReviewCompletionThresholdPreference(user.user_metadata);
      const missingKeyboardQuestionNavigation = !hasKeyboardQuestionNavigationPreference(user.user_metadata);
      const missingSimulationConfidenceCalibration = !hasSimulationConfidenceCalibrationPreference(user.user_metadata);
      const missingSimulationOptionElimination = !hasSimulationOptionEliminationPreference(user.user_metadata);
      const missingPharmacologyReverseSwipe = !hasPharmacologyReverseSwipePreference(user.user_metadata);
      if (
        missingQuestionCount ||
        missingStopAfterReview ||
        missingFastAnswerMode ||
        missingReviewCompletionThreshold ||
        missingKeyboardQuestionNavigation ||
        missingSimulationConfidenceCalibration ||
        missingSimulationOptionElimination ||
        missingPharmacologyReverseSwipe
      ) {
        const patch: AccountPreferencePatch = {};
        if (missingQuestionCount) patch.practice_question_count = 10;
        if (missingStopAfterReview) patch.practice_stop_after_review = false;
        if (missingFastAnswerMode) patch.practice_fast_answer_mode = false;
        if (missingReviewCompletionThreshold) patch.review_completion_threshold = 2;
        if (missingKeyboardQuestionNavigation) patch.keyboard_question_navigation = false;
        if (missingSimulationConfidenceCalibration) patch.simulation_confidence_calibration = true;
        if (missingSimulationOptionElimination) patch.simulation_option_elimination = false;
        if (missingPharmacologyReverseSwipe) patch.pharmacology_reverse_swipe = false;
        void persistAccountPreferences(patch).catch(() => {});
      }
    } else {
      savePracticeQuestionCount(nextCount);
      savePracticeStopAfterReview(nextStopAfterReview);
      savePracticeFastAnswerMode(nextFastAnswerMode);
      saveReviewCompletionThreshold(nextReviewCompletionThreshold);
      saveKeyboardQuestionNavigation(nextKeyboardQuestionNavigation);
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

  function handleChangePracticeFastAnswerMode(enabled: boolean) {
    setPracticeFastAnswerMode(enabled);
    savePracticeFastAnswerMode(enabled);
    if (!user) return;
    setError("");
    void persistAccountPreferences({
      practice_fast_answer_mode: enabled
    }).catch((persistError) => {
      setError(persistError instanceof Error ? persistError.message : "極速模式設定同步失敗");
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

  function handleChangeKeyboardQuestionNavigation(enabled: boolean) {
    setKeyboardQuestionNavigation(enabled);
    saveKeyboardQuestionNavigation(enabled);
    if (!user) return;
    setError("");
    void persistAccountPreferences({
      keyboard_question_navigation: enabled
    }).catch((persistError) => {
      setError(persistError instanceof Error ? persistError.message : "方向鍵設定同步失敗");
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
        <h2 className="display-title mt-2 text-3xl">Supabase 尚未設定</h2>
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
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            placeholder="新密碼（至少 6 個字元）"
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
                <div className="stat-chip">
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
        <div className="account-settings-body mt-4 grid gap-3">
          <label className="account-settings-field">
            <span>排行榜暱稱</span>
            <input
              type="text"
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              placeholder="輸入要顯示的名稱"
              maxLength={24}
              className="min-h-12 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-800 outline-none"
            />
            <small>排行榜與公開互動會顯示這個名稱。</small>
          </label>
          <div className="account-settings-preferences rounded-2xl border border-slate-200">
            <button
              type="button"
              onClick={() => setSettingsOpen((current) => !current)}
              className="flex min-h-12 w-full items-center justify-between px-4 py-3 text-left"
            >
              <div>
                <p className="text-sm font-semibold text-ink">設定</p>
                <p className="mt-1 text-xs text-slate-500">首頁、散題、模擬考與藥理複習設定</p>
              </div>
              <span className="text-sm font-semibold text-slate-500">{settingsOpen ? "收合" : "展開"}</span>
            </button>
            {settingsOpen ? (
              <div className="border-t border-slate-200 px-4 py-4">
                <div className="grid gap-5 lg:grid-cols-2">
                  <div className="rounded-2xl bg-slate-50/80 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">顯示與首頁</p>
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

                  <div className="rounded-2xl bg-slate-50/80 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">散題作答</p>
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
                        每題詳解後可結束
                      </button>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleChangePracticeFastAnswerMode(false)}
                        className={`min-h-11 rounded-full px-4 py-2 text-sm font-semibold transition ${
                          !practiceFastAnswerMode
                            ? "bg-brand-600 text-white"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}
                      >
                        選完再送出
                      </button>
                      <button
                        type="button"
                        onClick={() => handleChangePracticeFastAnswerMode(true)}
                        className={`min-h-11 rounded-full px-4 py-2 text-sm font-semibold transition ${
                          practiceFastAnswerMode
                            ? "bg-cyan-100 text-cyan-950 ring-1 ring-cyan-300"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}
                      >
                        極速做題：點選即送出
                      </button>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      極速模式會在點選選項後直接作答，作答後仍可看詳解。
                    </p>
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-white/80 p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        複習完成條件
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleChangeReviewCompletionThreshold(1)}
                          className={`min-h-11 rounded-full px-4 py-2 text-sm font-semibold transition ${
                            reviewCompletionThreshold === 1
                              ? "bg-emerald-100 text-emerald-950 ring-1 ring-emerald-300"
                              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                          }`}
                        >
                          答對 1 次就完成
                        </button>
                        <button
                          type="button"
                          onClick={() => handleChangeReviewCompletionThreshold(2)}
                          className={`min-h-11 rounded-full px-4 py-2 text-sm font-semibold transition ${
                            reviewCompletionThreshold === 2
                              ? "bg-brand-600 text-white"
                              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                          }`}
                        >
                          答對 2 次才完成
                        </button>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-slate-500">
                        同時影響錯題與沒信心題；手動移入或移回完成區仍會優先保留。
                      </p>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleChangeKeyboardQuestionNavigation(false)}
                        className={`min-h-11 rounded-full px-4 py-2 text-sm font-semibold transition ${
                          !keyboardQuestionNavigation
                            ? "bg-brand-600 text-white"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}
                      >
                        方向鍵關閉
                      </button>
                      <button
                        type="button"
                        onClick={() => handleChangeKeyboardQuestionNavigation(true)}
                        className={`min-h-11 rounded-full px-4 py-2 text-sm font-semibold transition ${
                          keyboardQuestionNavigation
                            ? "bg-cyan-100 text-cyan-950 ring-1 ring-cyan-300"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}
                      >
                        左右鍵切題
                      </button>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      散題需先送出答案才能用右鍵下一題；方向鍵不會交卷或直接進結果。
                    </p>
                  </div>

                  <div className="rounded-2xl bg-slate-50/80 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">模擬考工具</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleChangeSimulationConfidenceCalibration(true)}
                        className={`min-h-11 rounded-full px-4 py-2 text-sm font-semibold transition ${
                          simulationConfidenceCalibration
                            ? "bg-brand-600 text-white"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}
                      >
                        開啟，保留校準分析
                      </button>
                      <button
                        type="button"
                        onClick={() => handleChangeSimulationConfidenceCalibration(false)}
                        className={`min-h-11 rounded-full px-4 py-2 text-sm font-semibold transition ${
                          !simulationConfidenceCalibration
                            ? "bg-amber-100 text-amber-900 ring-1 ring-amber-300"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}
                      >
                        關閉，只看答題結果
                      </button>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      只影響模擬考校準分析；散題仍會詢問信心，低信心題會照常留到複習。
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleChangeSimulationOptionElimination(false)}
                        className={`min-h-11 rounded-full px-4 py-2 text-sm font-semibold transition ${
                          !simulationOptionElimination
                            ? "bg-brand-600 text-white"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}
                      >
                        選項打叉關閉
                      </button>
                      <button
                        type="button"
                        onClick={() => handleChangeSimulationOptionElimination(true)}
                        className={`min-h-11 rounded-full px-4 py-2 text-sm font-semibold transition ${
                          simulationOptionElimination
                            ? "bg-rose-100 text-rose-950 ring-1 ring-rose-300"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}
                      >
                        開啟選項打叉
                      </button>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      只在模擬考選項右側顯示，可標記先排除的選項；結果與 AI Prompt 會一起帶出。
                    </p>
                  </div>

                  <div className="rounded-2xl bg-slate-50/80 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">藥理卡滑動方向</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleChangePharmacologyReverseSwipe(false)}
                        className={`min-h-11 rounded-full px-4 py-2 text-sm font-semibold transition ${
                          !pharmacologyReverseSwipe
                            ? "bg-brand-600 text-white"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}
                      >
                        預設：左會、右不會
                      </button>
                      <button
                        type="button"
                        onClick={() => handleChangePharmacologyReverseSwipe(true)}
                        className={`min-h-11 rounded-full px-4 py-2 text-sm font-semibold transition ${
                          pharmacologyReverseSwipe
                            ? "bg-fuchsia-100 text-fuchsia-950 ring-1 ring-fuchsia-300"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}
                      >
                        反向：左不會、右會
                      </button>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      只影響藥理複習卡；抽卡權重仍照你的「會 / 不會」紀錄計算。
                    </p>
                  </div>

                  {!practiceStopAfterReview ? (
                    <div className="rounded-2xl bg-slate-50/80 p-4">
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
            onClick={() => void refreshCloudData({ hydrateRemoteHistory: true, uploadAllPending: true })}
            disabled={syncStatus === "syncing"}
            className="primary-pill disabled:cursor-not-allowed disabled:opacity-60"
          >
            {syncStatus === "syncing" ? "同步中..." : "立即同步雲端紀錄"}
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
        <label className="flex items-start gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={rememberAccount}
            onChange={(event) => {
              const checked = event.target.checked;
              setRememberAccount(checked);
              safeWriteLocalStorage(REMEMBER_ACCOUNT_KEY, checked ? "true" : "false");
              if (!checked) {
                safeRemoveLocalStorage(REMEMBERED_EMAIL_KEY);
              } else if (email.trim()) {
                safeWriteLocalStorage(REMEMBERED_EMAIL_KEY, email.trim());
              }
            }}
            className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-600"
          />
          <span>
            維持這台裝置的登入狀態
            <span className="block text-xs leading-6 text-slate-500">
              會記住 Email，並把登入狀態盡量存在可長期保留的位置；切回網站時也會主動刷新。
            </span>
          </span>
        </label>
      </div>

      {message ? (
        <div className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900">{message}</div>
      ) : null}
      {syncError ? (
        <div className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">{syncError}</div>
      ) : null}
      {error ? (
        <div className="mt-4 rounded-2xl bg-rose-50 p-4 text-sm text-rose-900">{error}</div>
      ) : null}

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={() => void handleSignIn()}
          disabled={submitting || !email.trim() || !password}
          className="primary-pill disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          以 Email 登入
        </button>
        <button
          type="button"
          onClick={() => void handleSignUp()}
          disabled={submitting || !email.trim() || !password}
          className="secondary-pill disabled:cursor-not-allowed disabled:bg-slate-100"
        >
          註冊新帳號
        </button>
        <button
          type="button"
          onClick={() => void handleSendPasswordReset()}
          disabled={submitting || !email.trim()}
          className="secondary-pill disabled:cursor-not-allowed disabled:bg-slate-100"
        >
          忘記密碼
        </button>
      </div>
    </section>
  );
}
