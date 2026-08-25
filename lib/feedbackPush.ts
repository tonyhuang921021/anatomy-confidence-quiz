import type { FeedbackMessage } from "../types/quiz";

const VAPID_PUBLIC_KEY_PATTERN = /^[A-Za-z0-9_-]{80,100}$/;
const VAPID_PRIVATE_KEY_PATTERN = /^[A-Za-z0-9_-]{40,60}$/;
const PUSH_KEY_PATTERN = /^[A-Za-z0-9_-]+$/;

export type FeedbackPushSubscriptionInput = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
};

export type FeedbackPushSubscriptionRow = FeedbackPushSubscriptionInput & {
  id: string | number;
  userId: string;
};

export type FeedbackPushPayload = {
  title: string;
  body: string;
  tag: string;
  url: string;
};

export type FeedbackPushCapability =
  | "available"
  | "denied"
  | "install-required"
  | "unsupported";

export type FeedbackWebPushConfig = {
  publicKey: string;
  privateKey: string;
  subject: string;
};

export function normalizeFeedbackPushEndpoint(value: unknown) {
  if (typeof value !== "string" || value.length > 2048) return null;
  let endpoint: URL;
  try {
    endpoint = new URL(value);
  } catch {
    return null;
  }
  if (
    endpoint.protocol !== "https:" ||
    endpoint.username ||
    endpoint.password ||
    !endpoint.hostname.includes(".") ||
    !/[a-z]/i.test(endpoint.hostname) ||
    /(?:^|\.)(?:localhost|local|internal)$/i.test(endpoint.hostname)
  ) {
    return null;
  }
  return endpoint.toString();
}

function isValidPushKey(value: string, minimum: number, maximum: number) {
  return (
    value.length >= minimum &&
    value.length <= maximum &&
    PUSH_KEY_PATTERN.test(value)
  );
}

export function parseFeedbackPushSubscription(
  value: unknown
): FeedbackPushSubscriptionInput | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as {
    endpoint?: unknown;
    keys?: { p256dh?: unknown; auth?: unknown } | null;
  };
  if (typeof candidate.endpoint !== "string" || !candidate.keys) return null;
  if (
    typeof candidate.keys.p256dh !== "string" ||
    typeof candidate.keys.auth !== "string"
  ) {
    return null;
  }

  const endpoint = normalizeFeedbackPushEndpoint(candidate.endpoint);
  if (!endpoint) return null;

  const p256dh = candidate.keys.p256dh.trim();
  const auth = candidate.keys.auth.trim();
  if (!isValidPushKey(p256dh, 80, 100) || !isValidPushKey(auth, 16, 64)) {
    return null;
  }

  return {
    endpoint,
    keys: { p256dh, auth }
  };
}

export function getFeedbackWebPushConfig(
  env: Record<string, string | undefined>
): FeedbackWebPushConfig | null {
  const publicKey = env.WEB_PUSH_VAPID_PUBLIC_KEY?.trim() ?? "";
  const privateKey = env.WEB_PUSH_VAPID_PRIVATE_KEY?.trim() ?? "";
  const rawSubject = env.WEB_PUSH_VAPID_SUBJECT?.trim() ||
    "https://anatomy-confidence-quiz.vercel.app";
  if (
    !VAPID_PUBLIC_KEY_PATTERN.test(publicKey) ||
    !VAPID_PRIVATE_KEY_PATTERN.test(privateKey)
  ) {
    return null;
  }

  let subject = rawSubject;
  if (!subject.startsWith("mailto:")) {
    try {
      const url = new URL(subject);
      if (url.protocol !== "https:") return null;
      subject = url.origin;
    } catch {
      return null;
    }
  } else if (!/^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(subject)) {
    return null;
  }

  return { publicKey, privateKey, subject };
}

function getFeedbackPushAuthor(message: FeedbackMessage) {
  if (message.isAnonymous) return "匿名使用者";
  return message.displayName?.trim() || "已登入使用者";
}

export function buildFeedbackPushPayload(message: FeedbackMessage): FeedbackPushPayload {
  const kind = message.parentId ? "新回覆" : "新留言";
  const author = getFeedbackPushAuthor(message);
  const content = message.content.trim().replace(/\s+/g, " ").slice(0, 140);
  return {
    title: `留言板有${kind}`,
    body: `${author}：${content}`,
    tag: `feedback-${message.id}`.slice(0, 32),
    url: "/#feedback"
  };
}

export function getFeedbackPushCapability(input: {
  hasServiceWorker: boolean;
  hasPushManager: boolean;
  hasNotifications: boolean;
  isIos: boolean;
  isStandalone: boolean;
  permission: NotificationPermission | "unsupported";
}): FeedbackPushCapability {
  if (
    !input.hasServiceWorker ||
    !input.hasPushManager ||
    !input.hasNotifications ||
    input.permission === "unsupported"
  ) {
    return "unsupported";
  }
  if (input.isIos && !input.isStandalone) return "install-required";
  if (input.permission === "denied") return "denied";
  return "available";
}

function getPushErrorStatus(error: unknown) {
  if (!error || typeof error !== "object" || !("statusCode" in error)) return undefined;
  const statusCode = Number((error as { statusCode?: unknown }).statusCode);
  return Number.isFinite(statusCode) ? statusCode : undefined;
}

export async function dispatchFeedbackPushRows(
  rows: FeedbackPushSubscriptionRow[],
  payload: FeedbackPushPayload,
  send: (
    subscription: FeedbackPushSubscriptionInput,
    payload: FeedbackPushPayload
  ) => Promise<void>,
  excludeUserId?: string | null
) {
  const expiredIds: Array<string | number> = [];
  let sent = 0;
  let failed = 0;

  await Promise.all(
    rows.map(async (row) => {
      if (excludeUserId && row.userId === excludeUserId) return;
      try {
        await send({ endpoint: row.endpoint, keys: row.keys }, payload);
        sent += 1;
      } catch (error) {
        const statusCode = getPushErrorStatus(error);
        if (statusCode === 404 || statusCode === 410) expiredIds.push(row.id);
        else failed += 1;
      }
    })
  );

  return { sent, failed, expiredIds };
}
