import { getFeedbackPushCapability, type FeedbackPushCapability } from "./feedbackPush";
import { getFeedbackAuthorizationHeaders } from "./feedbackAuth";

type NavigatorWithStandalone = Navigator & { standalone?: boolean };

export type FeedbackPushClientState =
  | FeedbackPushCapability
  | "checking"
  | "subscribed"
  | "unconfigured";

function isIosDevice() {
  const navigatorWithStandalone = navigator as NavigatorWithStandalone;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) ||
    navigatorWithStandalone.standalone === true;
}

function isStandaloneApp() {
  const navigatorWithStandalone = navigator as NavigatorWithStandalone;
  return window.matchMedia("(display-mode: standalone)").matches ||
    navigatorWithStandalone.standalone === true;
}

export function getBrowserFeedbackPushCapability(): FeedbackPushCapability {
  return getFeedbackPushCapability({
    hasServiceWorker: "serviceWorker" in navigator,
    hasPushManager: "PushManager" in window,
    hasNotifications: "Notification" in window,
    isIos: isIosDevice(),
    isStandalone: isStandaloneApp(),
    permission: typeof Notification === "undefined" ? "unsupported" : Notification.permission
  });
}

export async function ensureFeedbackPushWorker() {
  if (!("serviceWorker" in navigator)) throw new Error("這台裝置不支援背景推播。");
  const registration = await navigator.serviceWorker.register("/sw.js", {
    scope: "/",
    updateViaCache: "none"
  });
  return registration;
}

export function decodeVapidPublicKey(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

async function readJson(response: Response) {
  return (await response.json().catch(() => null)) as {
    ok?: boolean;
    publicKey?: string;
    message?: string;
  } | null;
}

export async function loadFeedbackPushPublicKey(accessToken: string) {
  const response = await fetch("/api/feedback/push", {
    cache: "no-store",
    headers: getFeedbackAuthorizationHeaders(accessToken)
  });
  const payload = await readJson(response);
  if (!response.ok || !payload?.ok || !payload.publicKey) {
    throw new Error(payload?.message || "手機推播尚未設定。");
  }
  return payload.publicKey;
}

export async function saveFeedbackPushSubscription(
  accessToken: string,
  subscription: PushSubscription
) {
  const response = await fetch("/api/feedback/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getFeedbackAuthorizationHeaders(accessToken)
    },
    body: JSON.stringify({ subscription: subscription.toJSON() })
  });
  const payload = await readJson(response);
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.message || "手機推播訂閱失敗。");
  }
}

export async function removeFeedbackPushSubscription(
  accessToken: string,
  subscription: PushSubscription
) {
  const response = await fetch("/api/feedback/push", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      ...getFeedbackAuthorizationHeaders(accessToken)
    },
    body: JSON.stringify({ endpoint: subscription.endpoint })
  });
  const payload = await readJson(response);
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.message || "手機推播取消失敗。");
  }
}
