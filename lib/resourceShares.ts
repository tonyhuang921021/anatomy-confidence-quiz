import type { ResourceShare, ResourceShareComment } from "@/types/quiz";

const RESOURCE_HTML_CACHE_LIMIT = 4;
const RESOURCE_HTML_SESSION_CACHE_LIMIT = 3;
const RESOURCE_HTML_SESSION_MAX_CHARS = 1_200_000;
const RESOURCE_HTML_SESSION_TTL_MS = 6 * 60 * 60 * 1000;
const RESOURCE_HTML_SESSION_PREFIX = "resourceShareHtml:";
const RESOURCE_HTML_SESSION_INDEX_KEY = "resourceShareHtml:index";
const resourceHtmlCache = new Map<string, string>();
const resourceHtmlInflight = new Map<string, Promise<string>>();

const parseJsonResponse = async <T>(response: Response, fallbackMessage: string): Promise<T> => {
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : fallbackMessage;
    throw new Error(message);
  }
  return payload as T;
};

const readResourceShareHtmlSessionCache = (resourceId: string): string | null => {
  if (typeof window === "undefined" || !resourceId) return null;
  try {
    const raw = window.sessionStorage.getItem(`${RESOURCE_HTML_SESSION_PREFIX}${resourceId}`);
    if (!raw) return null;
    const payload = JSON.parse(raw) as { html?: unknown; cachedAt?: unknown };
    const cachedAt = typeof payload.cachedAt === "number" ? payload.cachedAt : 0;
    if (!cachedAt || Date.now() - cachedAt > RESOURCE_HTML_SESSION_TTL_MS || typeof payload.html !== "string") {
      window.sessionStorage.removeItem(`${RESOURCE_HTML_SESSION_PREFIX}${resourceId}`);
      return null;
    }
    return payload.html;
  } catch {
    return null;
  }
};

const rememberResourceShareHtmlSessionCache = (resourceId: string, html: string) => {
  if (typeof window === "undefined" || !resourceId || !html || html.length > RESOURCE_HTML_SESSION_MAX_CHARS) return;
  try {
    window.sessionStorage.setItem(
      `${RESOURCE_HTML_SESSION_PREFIX}${resourceId}`,
      JSON.stringify({ html, cachedAt: Date.now() })
    );
    const rawIndex = window.sessionStorage.getItem(RESOURCE_HTML_SESSION_INDEX_KEY);
    const parsedIndex = rawIndex ? JSON.parse(rawIndex) : [];
    const index = Array.isArray(parsedIndex) ? parsedIndex.filter((item): item is string => typeof item === "string") : [];
    const nextIndex = [resourceId, ...index.filter((item) => item !== resourceId)].slice(0, RESOURCE_HTML_SESSION_CACHE_LIMIT);
    for (const staleId of index.slice(RESOURCE_HTML_SESSION_CACHE_LIMIT - 1)) {
      if (!nextIndex.includes(staleId)) {
        window.sessionStorage.removeItem(`${RESOURCE_HTML_SESSION_PREFIX}${staleId}`);
      }
    }
    window.sessionStorage.setItem(RESOURCE_HTML_SESSION_INDEX_KEY, JSON.stringify(nextIndex));
  } catch {
    // HTML resources can be large. If the browser refuses the cache, the network path still works.
  }
};

const rememberResourceShareHtml = (resourceId: string, html: string) => {
  if (!resourceId || !html) return;
  if (resourceHtmlCache.has(resourceId)) {
    resourceHtmlCache.delete(resourceId);
  }
  resourceHtmlCache.set(resourceId, html);
  rememberResourceShareHtmlSessionCache(resourceId, html);
  while (resourceHtmlCache.size > RESOURCE_HTML_CACHE_LIMIT) {
    const oldestKey = resourceHtmlCache.keys().next().value;
    if (!oldestKey) break;
    resourceHtmlCache.delete(oldestKey);
  }
};

export const getCachedResourceShareHtml = (resourceId: string): string | null => {
  const cached = resourceHtmlCache.get(resourceId);
  if (cached) {
    resourceHtmlCache.delete(resourceId);
    resourceHtmlCache.set(resourceId, cached);
    return cached;
  }

  const sessionCached = readResourceShareHtmlSessionCache(resourceId);
  if (!sessionCached) return null;
  resourceHtmlCache.set(resourceId, sessionCached);
  return sessionCached;
};

export const loadResourceShares = async (
  accessToken: string,
  limit = 30
): Promise<{ resources: ResourceShare[] }> => {
  const params = new URLSearchParams({
    limit: String(Math.max(1, Math.min(60, Math.floor(limit)))),
  });
  const response = await fetch(`/api/resource-shares?${params.toString()}`, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return parseJsonResponse<{ resources: ResourceShare[] }>(response, "資源分享讀取失敗");
};

export const loadResourceShareDetail = async (
  resourceId: string,
  accessToken: string
): Promise<{ resource: ResourceShare }> => {
  const params = new URLSearchParams({ resourceId });
  const response = await fetch(`/api/resource-shares?${params.toString()}`, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return parseJsonResponse<{ resource: ResourceShare }>(response, "資源內容讀取失敗");
};

export const loadResourceShareHtml = async (resourceId: string, accessToken: string): Promise<string> => {
  const cached = getCachedResourceShareHtml(resourceId);
  if (cached !== null) return cached;

  const inflight = resourceHtmlInflight.get(resourceId);
  if (inflight) return inflight;

  const params = new URLSearchParams({ resourceId });
  const request = fetch(`/api/resource-shares/html?${params.toString()}`, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${accessToken}` },
  })
    .then((response) => parseJsonResponse<{ html?: string }>(response, "HTML 資源讀取失敗"))
    .then((payload) => {
      const html = typeof payload.html === "string" ? payload.html : "";
      rememberResourceShareHtml(resourceId, html);
      return html;
    })
    .finally(() => {
      resourceHtmlInflight.delete(resourceId);
    });

  resourceHtmlInflight.set(resourceId, request);
  return request;
};

export const uploadResourceShare = async ({
  accessToken,
  file,
  title,
  description,
  category,
}: {
  accessToken: string;
  file?: File | null;
  title: string;
  description?: string;
  category?: string;
}): Promise<{ resource: ResourceShare }> => {
  const formData = new FormData();
  if (file) formData.set("file", file);
  if (title) formData.set("title", title);
  if (description) formData.set("description", description);
  if (category) formData.set("category", category);
  const response = await fetch("/api/resource-shares/upload", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: formData,
  });
  return parseJsonResponse<{ resource: ResourceShare }>(response, "資源上傳失敗");
};

export const toggleResourceShareLike = async ({
  accessToken,
  resourceId,
  liked,
}: {
  accessToken: string;
  resourceId: string;
  liked: boolean;
}): Promise<{ resourceId: string; likeCount: number; myLiked: boolean }> => {
  const response = await fetch("/api/resource-shares/like", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ resourceId, liked }),
  });
  return parseJsonResponse<{ resourceId: string; likeCount: number; myLiked: boolean }>(
    response,
    "按讚更新失敗"
  );
};

export const createResourceShareComment = async ({
  accessToken,
  resourceId,
  content,
}: {
  accessToken: string;
  resourceId: string;
  content: string;
}): Promise<{ comment: ResourceShareComment }> => {
  const response = await fetch("/api/resource-shares/comments", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ resourceId, content }),
  });
  return parseJsonResponse<{ comment: ResourceShareComment }>(response, "留言送出失敗");
};
