"use client";

import { BellOff, BellRing, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import {
  decodeVapidPublicKey,
  ensureFeedbackPushWorker,
  getBrowserFeedbackPushCapability,
  loadFeedbackPushPublicKey,
  removeFeedbackPushSubscription,
  saveFeedbackPushSubscription,
  type FeedbackPushClientState
} from "@/lib/feedbackPushClient";

type MobilePushSettingsState = FeedbackPushClientState | "login-required";

export function MobilePushSettings() {
  const { configured, session, user } = useAuth();
  const [pushState, setPushState] = useState<MobilePushSettingsState>("checking");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const accessToken = session?.access_token;

  useEffect(() => {
    if (!configured) {
      setPushState("unconfigured");
      return;
    }
    if (!user?.id || !accessToken) {
      setPushState("login-required");
      return;
    }
    const activeAccessToken = accessToken;

    let cancelled = false;
    async function inspectSubscription() {
      const capability = getBrowserFeedbackPushCapability();
      if (capability !== "available") {
        if (!cancelled) setPushState(capability);
        return;
      }

      try {
        const registration = await ensureFeedbackPushWorker();
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) await saveFeedbackPushSubscription(activeAccessToken, subscription);
        if (!cancelled) {
          setError("");
          setPushState(subscription ? "subscribed" : "available");
        }
      } catch (subscriptionError) {
        if (cancelled) return;
        const message = subscriptionError instanceof Error
          ? subscriptionError.message
          : "手機通知狀態確認失敗。";
        setPushState(message.includes("尚未設定") || message.includes("金鑰") ? "unconfigured" : "available");
        setError(message);
      }
    }

    void inspectSubscription();
    return () => {
      cancelled = true;
    };
  }, [accessToken, configured, user?.id]);

  async function enablePush() {
    if (!accessToken || !user?.id) {
      setPushState("login-required");
      return;
    }
    const capability = getBrowserFeedbackPushCapability();
    if (capability !== "available") {
      setPushState(capability);
      return;
    }

    setBusy(true);
    setError("");
    let createdSubscription: PushSubscription | null = null;
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setPushState(permission === "denied" ? "denied" : "available");
        if (permission === "denied") setError("手機已封鎖通知，請到系統設定重新開啟。");
        return;
      }

      const publicKey = await loadFeedbackPushPublicKey(accessToken);
      const registration = await ensureFeedbackPushWorker();
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: decodeVapidPublicKey(publicKey)
        });
        createdSubscription = subscription;
      }
      await saveFeedbackPushSubscription(accessToken, subscription);
      setPushState("subscribed");
    } catch (pushError) {
      if (createdSubscription) await createdSubscription.unsubscribe().catch(() => false);
      const message = pushError instanceof Error ? pushError.message : "手機通知開啟失敗。";
      setPushState(message.includes("尚未設定") || message.includes("金鑰") ? "unconfigured" : "available");
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  async function disablePush() {
    if (!accessToken || !user?.id) return;
    setBusy(true);
    setError("");
    try {
      const registration = await ensureFeedbackPushWorker();
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await removeFeedbackPushSubscription(accessToken, subscription);
        await subscription.unsubscribe();
      }
      setPushState("available");
    } catch (pushError) {
      setError(pushError instanceof Error ? pushError.message : "手機通知關閉失敗。");
    } finally {
      setBusy(false);
    }
  }

  const statusCopy = pushState === "subscribed"
    ? "已開啟"
    : pushState === "login-required"
      ? "需先登入"
      : pushState === "install-required"
        ? "需先加入主畫面"
        : pushState === "denied"
          ? "已被手機封鎖"
          : pushState === "unsupported"
            ? "此瀏覽器不支援"
            : pushState === "unconfigured"
              ? "暫時無法使用"
              : pushState === "checking"
                ? "確認中"
                : "尚未開啟";

  return (
    <section aria-labelledby="mobile-push-title" className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700" aria-hidden="true">
          {pushState === "subscribed" ? <BellRing size={20} /> : <Smartphone size={20} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="mobile-push-title" className="text-base font-semibold text-ink">手機通知</h2>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{statusCopy}</span>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            自己選擇是否接收留言板的新留言與回覆；網站關閉時也能收到。
          </p>
        </div>
      </div>

      <div className="mt-4 border-t border-slate-100 pt-4">
        {pushState === "login-required" ? (
          <p className="text-sm leading-6 text-slate-600">請先從右上角帳號選單登入；每位登入使用者都能開啟。</p>
        ) : pushState === "install-required" ? (
          <p className="text-sm leading-6 text-slate-600">
            iPhone 要先照下方教學加入主畫面，再從主畫面開啟網站。
          </p>
        ) : pushState === "unsupported" ? (
          <p className="text-sm leading-6 text-slate-600">請改用 Safari 或 Chrome 的手機瀏覽器。</p>
        ) : pushState === "denied" ? (
          <p className="text-sm leading-6 text-slate-600">請到手機的通知設定允許「國考刷題測驗」。</p>
        ) : pushState === "unconfigured" ? (
          <p className="text-sm leading-6 text-slate-600">手機通知服務目前尚未完成設定。</p>
        ) : pushState === "subscribed" ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void disablePush()}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <BellOff size={16} aria-hidden="true" />
            {busy ? "正在關閉…" : "關閉手機通知"}
          </button>
        ) : pushState === "available" ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void enablePush()}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <BellRing size={16} aria-hidden="true" />
            {busy ? "正在開啟…" : "開啟手機通知"}
          </button>
        ) : (
          <p className="text-sm text-slate-500">正在確認這台裝置。</p>
        )}
        {error ? <p className="mt-3 text-sm leading-6 text-rose-700" role="status">{error}</p> : null}
      </div>
    </section>
  );
}
