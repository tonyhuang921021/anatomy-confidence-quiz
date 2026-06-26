"use client";

import type {
  Question,
  QuestionSupplementCard,
  QuestionSupplementCardVote,
  QuestionSupplementReactionSummary,
  RecentQuestionSupplementCard
} from "@/types/quiz";

type QuestionSupplementResponse = {
  ok?: boolean;
  message?: string;
  count?: number;
  cards?: QuestionSupplementCard[];
  reactions?: QuestionSupplementReactionSummary[];
};

type SupplementCacheEntry<T> = {
  expiresAt: number;
  value: T;
};

type SupplementCardsPayload = Required<Pick<QuestionSupplementResponse, "cards" | "reactions">>;
type SupplementMetaPayload = Required<Pick<QuestionSupplementResponse, "count" | "reactions">>;

const SUPPLEMENT_META_CACHE_TTL_MS = 30 * 60 * 1000;
const SUPPLEMENT_CARDS_CACHE_TTL_MS = 5 * 60 * 1000;
const SUPPLEMENT_META_SESSION_PREFIX = "aq:supplement-meta:v2:";
const supplementMetaCache = new Map<string, SupplementCacheEntry<SupplementMetaPayload>>();
const supplementCardsCache = new Map<string, SupplementCacheEntry<SupplementCardsPayload>>();
const supplementRequestsInFlight = new Map<string, Promise<unknown>>();

function getAccessTokenScope(accessToken?: string | null) {
  if (!accessToken) return "public";

  let hash = 0;
  for (let index = 0; index < accessToken.length; index += 1) {
    hash = ((hash << 5) - hash + accessToken.charCodeAt(index)) | 0;
  }
  return `auth:${Math.abs(hash)}`;
}

function getSupplementCacheKey(questionId: string, accessToken?: string | null) {
  return `${questionId}:${getAccessTokenScope(accessToken)}`;
}

function readSupplementCache<T>(cache: Map<string, SupplementCacheEntry<T>>, key: string) {
  const cached = cache.get(key);
  if (!cached) return undefined;
  if (cached.expiresAt <= Date.now()) {
    cache.delete(key);
    return undefined;
  }
  return cached.value;
}

function writeSupplementCache<T>(cache: Map<string, SupplementCacheEntry<T>>, key: string, value: T, ttlMs: number) {
  cache.set(key, {
    expiresAt: Date.now() + ttlMs,
    value
  });
}

function getSupplementSessionStorage() {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function readSupplementMetaCache(key: string) {
  const cached = readSupplementCache(supplementMetaCache, key);
  if (cached) return cached;

  const storage = getSupplementSessionStorage();
  if (!storage) return undefined;

  try {
    const storageKey = `${SUPPLEMENT_META_SESSION_PREFIX}${key}`;
    const rawValue = storage.getItem(storageKey);
    if (!rawValue) return undefined;

    const entry = JSON.parse(rawValue) as SupplementCacheEntry<SupplementMetaPayload>;
    if (!entry || typeof entry.expiresAt !== "number" || entry.expiresAt <= Date.now()) {
      storage.removeItem(storageKey);
      return undefined;
    }

    supplementMetaCache.set(key, entry);
    return entry.value;
  } catch {
    return undefined;
  }
}

function writeSupplementMetaCache(key: string, value: SupplementMetaPayload, ttlMs: number) {
  writeSupplementCache(supplementMetaCache, key, value, ttlMs);

  const storage = getSupplementSessionStorage();
  if (!storage) return;

  try {
    const entry = supplementMetaCache.get(key);
    if (!entry) return;
    storage.setItem(`${SUPPLEMENT_META_SESSION_PREFIX}${key}`, JSON.stringify(entry));
  } catch {
    // Session cache is only a request reducer; failing to write it should not block the page.
  }
}

function invalidateQuestionSupplementMetaSessionCache(questionId: string) {
  const storage = getSupplementSessionStorage();
  if (!storage) return;

  try {
    const keyPrefix = `${SUPPLEMENT_META_SESSION_PREFIX}${questionId}:`;
    for (let index = storage.length - 1; index >= 0; index -= 1) {
      const storageKey = storage.key(index);
      if (storageKey?.startsWith(keyPrefix)) {
        storage.removeItem(storageKey);
      }
    }
  } catch {
    // Best-effort invalidation only.
  }
}

function invalidateQuestionSupplementCaches(questionId: string) {
  for (const key of Array.from(supplementMetaCache.keys())) {
    if (key.startsWith(`${questionId}:`)) supplementMetaCache.delete(key);
  }
  invalidateQuestionSupplementMetaSessionCache(questionId);
  for (const key of Array.from(supplementCardsCache.keys())) {
    if (key.startsWith(`${questionId}:`)) supplementCardsCache.delete(key);
  }
  for (const key of Array.from(supplementRequestsInFlight.keys())) {
    if (key.includes(`:${questionId}:`) || key === `count:${questionId}`) {
      supplementRequestsInFlight.delete(key);
    }
  }
}

function rememberSupplementPayload(questionId: string, accessToken: string | null | undefined, payload: QuestionSupplementResponse) {
  const cacheKey = getSupplementCacheKey(questionId, accessToken);
  const cards = payload.cards ?? [];
  const reactions = payload.reactions ?? [];

  if (payload.cards) {
    writeSupplementCache(
      supplementCardsCache,
      cacheKey,
      { cards, reactions },
      SUPPLEMENT_CARDS_CACHE_TTL_MS
    );
  }

  if (typeof payload.count === "number" || payload.cards || payload.reactions) {
    writeSupplementMetaCache(
      cacheKey,
      {
        count: Math.max(0, payload.count ?? cards.length),
        reactions
      },
      SUPPLEMENT_META_CACHE_TTL_MS
    );
  }
}

async function reuseSupplementRequest<T>(key: string, taskFactory: () => Promise<T>): Promise<T> {
  const existing = supplementRequestsInFlight.get(key) as Promise<T> | undefined;
  if (existing) return existing;

  const task = taskFactory();
  supplementRequestsInFlight.set(key, task);
  try {
    return await task;
  } finally {
    supplementRequestsInFlight.delete(key);
  }
}

async function parseSupplementResponse<T>(response: Response): Promise<T> {
  const rawText = await response.text();
  const payload = (rawText ? JSON.parse(rawText) : null) as (T & { ok?: boolean; message?: string }) | null;
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.message || rawText || "補充卡片操作失敗。");
  }
  return payload;
}

export async function loadQuestionSupplementCards(
  questionId: string,
  accessToken?: string | null
): Promise<Required<Pick<QuestionSupplementResponse, "cards" | "reactions">>> {
  const cacheKey = getSupplementCacheKey(questionId, accessToken);
  const cached = readSupplementCache(supplementCardsCache, cacheKey);
  if (cached) return cached;

  const params = new URLSearchParams({ questionId });
  if (accessToken) params.set("accessToken", accessToken);
  return reuseSupplementRequest(`cards:${cacheKey}`, async () => {
    const response = await fetch(`/api/question-supplement-cards?${params.toString()}`);
    const payload = await parseSupplementResponse<QuestionSupplementResponse>(response);
    const result = {
      cards: payload.cards ?? [],
      reactions: payload.reactions ?? []
    };
    rememberSupplementPayload(questionId, accessToken, result);
    return result;
  });
}

export async function loadQuestionSupplementCount(questionId: string): Promise<number> {
  const cached = readSupplementMetaCache(getSupplementCacheKey(questionId));
  if (cached) return cached.count;

  const params = new URLSearchParams({ questionId, countOnly: "1" });
  return reuseSupplementRequest(`count:${questionId}`, async () => {
    const response = await fetch(`/api/question-supplement-cards?${params.toString()}`);
    const payload = await parseSupplementResponse<QuestionSupplementResponse>(response);
    const count = Math.max(0, payload.count ?? 0);
    rememberSupplementPayload(questionId, null, { count, reactions: [] });
    return count;
  });
}

export async function loadQuestionSupplementMeta(
  questionId: string,
  accessToken?: string | null
): Promise<Required<Pick<QuestionSupplementResponse, "count" | "reactions">>> {
  const cacheKey = getSupplementCacheKey(questionId, accessToken);
  const cached = readSupplementMetaCache(cacheKey);
  if (cached) return cached;

  const params = new URLSearchParams({ questionId, countOnly: "1", includeReactions: "1" });
  if (accessToken) params.set("accessToken", accessToken);
  return reuseSupplementRequest(`meta:${cacheKey}`, async () => {
    const response = await fetch(`/api/question-supplement-cards?${params.toString()}`);
    const payload = await parseSupplementResponse<QuestionSupplementResponse>(response);
    const result = {
      count: Math.max(0, payload.count ?? 0),
      reactions: payload.reactions ?? []
    };
    rememberSupplementPayload(questionId, accessToken, result);
    return result;
  });
}

export async function loadRecentQuestionSupplementCards(
  accessToken?: string | null,
  limit = 12
): Promise<RecentQuestionSupplementCard[]> {
  const params = new URLSearchParams({ recent: "1", limit: String(limit) });
  if (accessToken) params.set("accessToken", accessToken);
  const response = await fetch(`/api/question-supplement-cards?${params.toString()}`);
  const payload = await parseSupplementResponse<{
    ok?: boolean;
    recentCards?: RecentQuestionSupplementCard[];
  }>(response);
  return payload.recentCards ?? [];
}

export async function upsertQuestionSupplementCard(input: {
  question: Question;
  accessToken?: string | null;
  contentMarkdown: string;
  attachmentUrls?: string[];
}) {
  const response = await fetch("/api/question-supplement-cards", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "upsert_card",
      accessToken: input.accessToken ?? null,
      question: {
        id: input.question.id,
        subject: input.question.subject,
        chapter: input.question.chapter,
        section: input.question.section,
        stem: input.question.stem
      },
      contentMarkdown: input.contentMarkdown,
      attachmentUrls: input.attachmentUrls ?? []
    })
  });
  const payload = await parseSupplementResponse<QuestionSupplementResponse>(response);
  invalidateQuestionSupplementCaches(input.question.id);
  rememberSupplementPayload(input.question.id, input.accessToken, payload);
  return payload;
}

export async function voteQuestionSupplementCard(input: {
  cardId: string;
  vote: QuestionSupplementCardVote | null;
  accessToken?: string | null;
}) {
  const response = await fetch("/api/question-supplement-cards", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "vote_card",
      accessToken: input.accessToken ?? null,
      cardId: input.cardId,
      vote: input.vote
    })
  });
  const payload = await parseSupplementResponse<QuestionSupplementResponse>(response);
  const questionId = payload.cards?.[0]?.questionId;
  if (questionId) {
    invalidateQuestionSupplementCaches(questionId);
    rememberSupplementPayload(questionId, input.accessToken, payload);
  }
  return payload;
}

export async function toggleQuestionSupplementReaction(input: {
  question: Question;
  reactionType: "pure_chaos";
  accessToken?: string | null;
}) {
  const response = await fetch("/api/question-supplement-cards", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "toggle_reaction",
      accessToken: input.accessToken ?? null,
      question: {
        id: input.question.id,
        subject: input.question.subject,
        chapter: input.question.chapter,
        section: input.question.section,
        stem: input.question.stem
      },
      reactionType: input.reactionType
    })
  });
  const payload = await parseSupplementResponse<QuestionSupplementResponse>(response);
  invalidateQuestionSupplementCaches(input.question.id);
  rememberSupplementPayload(input.question.id, input.accessToken, payload);
  return payload;
}

export async function uploadQuestionSupplementImage(input: {
  questionId: string;
  accessToken?: string | null;
  file: File;
}) {
  const formData = new FormData();
  formData.set("accessToken", input.accessToken ?? "");
  formData.set("questionId", input.questionId);
  formData.set("file", input.file);

  const response = await fetch("/api/question-supplement-cards/upload", {
    method: "POST",
    body: formData
  });
  const payload = await parseSupplementResponse<{ ok?: boolean; url?: string }>(response);
  if (!payload.url) throw new Error("圖片上傳後沒有取得網址。");
  return payload.url;
}
