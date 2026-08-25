import type { FeedbackMessage } from "../types/quiz";

const DEFAULT_FEEDBACK_SITE_URL = "https://anatomy-confidence-quiz.vercel.app";
const DEFAULT_FEEDBACK_FROM = "國考刷題網站 <onboarding@resend.dev>";
const RESEND_EMAIL_API_URL = "https://api.resend.com/emails";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FeedbackEmailEnvironment = Record<string, string | undefined>;

export type FeedbackOwnerEmail = {
  from: string;
  to: string[];
  subject: string;
  text: string;
  html: string;
  idempotencyKey: string;
};

export type FeedbackEmailDeliveryResult =
  | { status: "sent"; emailId?: string }
  | { status: "disabled" }
  | { status: "failed"; httpStatus?: number; reason: "request" | "provider" };

function uniqueConfiguredEmails(value?: string) {
  return Array.from(
    new Set(
      (value ?? "")
        .split(/[\n,;]+/)
        .map((email) => email.trim().toLowerCase())
        .filter((email) => EMAIL_PATTERN.test(email))
    )
  ).slice(0, 5);
}

function normalizeSiteUrl(value?: string) {
  try {
    const url = new URL(value?.trim() || DEFAULT_FEEDBACK_SITE_URL);
    if (url.protocol !== "https:" && url.hostname !== "localhost") {
      return DEFAULT_FEEDBACK_SITE_URL;
    }
    return url.origin;
  } catch {
    return DEFAULT_FEEDBACK_SITE_URL;
  }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const escaped: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;"
    };
    return escaped[character] ?? character;
  });
}

function getFeedbackAuthor(message: FeedbackMessage) {
  if (message.isAnonymous) return "匿名使用者";
  return message.displayName?.trim() || "已登入使用者";
}

function formatFeedbackTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "時間未提供";
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

export function getFeedbackNotificationRecipients(env: FeedbackEmailEnvironment) {
  return uniqueConfiguredEmails(
    env.FEEDBACK_NOTIFICATION_EMAILS ??
      env.ADMIN_EMAILS ??
      env.NEXT_PUBLIC_ADMIN_EMAILS
  );
}

export function buildFeedbackOwnerEmail(
  message: FeedbackMessage,
  env: FeedbackEmailEnvironment
): FeedbackOwnerEmail | null {
  const recipients = getFeedbackNotificationRecipients(env);
  if (recipients.length === 0) return null;

  const kind = message.parentId ? "新回覆" : "新留言";
  const author = getFeedbackAuthor(message);
  const content = message.content.trim().replace(/\s+/g, " ").slice(0, 240);
  const createdAt = formatFeedbackTime(message.createdAt);
  const siteUrl = normalizeSiteUrl(env.FEEDBACK_NOTIFICATION_SITE_URL);
  const feedbackUrl = `${siteUrl}/#feedback`;
  const safeKind = escapeHtml(kind);
  const safeAuthor = escapeHtml(author);
  const safeContent = escapeHtml(content);
  const safeCreatedAt = escapeHtml(createdAt);
  const safeFeedbackUrl = escapeHtml(feedbackUrl);

  return {
    from: env.FEEDBACK_NOTIFICATION_FROM?.trim() || DEFAULT_FEEDBACK_FROM,
    to: recipients,
    subject: `國考刷題網站有${kind}`,
    text: [
      `${kind}｜${author}`,
      createdAt,
      "",
      content,
      "",
      `打開留言板：${feedbackUrl}`
    ].join("\n"),
    html: [
      "<!doctype html>",
      '<html lang="zh-Hant"><body style="font-family:system-ui,-apple-system,BlinkMacSystemFont,sans-serif;line-height:1.6;color:#17352a">',
      `<h1 style="font-size:20px;margin:0 0 12px">${safeKind}</h1>`,
      `<p style="margin:0 0 8px"><strong>${safeAuthor}</strong> · ${safeCreatedAt}</p>`,
      `<p style="margin:0 0 20px;white-space:pre-wrap">${safeContent}</p>`,
      `<p style="margin:0"><a href="${safeFeedbackUrl}">打開留言板</a></p>`,
      "</body></html>"
    ].join(""),
    idempotencyKey: `feedback-created-${message.id}`
  };
}

async function sendResendRequest(
  email: FeedbackOwnerEmail,
  apiKey: string,
  fetchImpl: typeof fetch,
  timeoutMs: number
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(RESEND_EMAIL_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": email.idempotencyKey
      },
      body: JSON.stringify({
        from: email.from,
        to: email.to,
        subject: email.subject,
        text: email.text,
        html: email.html
      }),
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function sendFeedbackOwnerEmail(
  message: FeedbackMessage,
  options: {
    env?: FeedbackEmailEnvironment;
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
  } = {}
): Promise<FeedbackEmailDeliveryResult> {
  const env = options.env ?? process.env;
  const apiKey = env.RESEND_API_KEY?.trim();
  const email = buildFeedbackOwnerEmail(message, env);
  if (!apiKey || !email) return { status: "disabled" };

  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 2500;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await sendResendRequest(email, apiKey, fetchImpl, timeoutMs);
      if (response.ok) {
        const payload = (await response.json().catch(() => null)) as { id?: string } | null;
        return { status: "sent", emailId: payload?.id };
      }
      if (attempt === 0 && (response.status === 429 || response.status >= 500)) continue;
      return { status: "failed", httpStatus: response.status, reason: "provider" };
    } catch {
      if (attempt === 0) continue;
      return { status: "failed", reason: "request" };
    }
  }

  return { status: "failed", reason: "request" };
}
