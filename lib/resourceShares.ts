import type { ResourceShare, ResourceShareComment } from "@/types/quiz";

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

export const uploadResourceShare = async ({
  accessToken,
  file,
  title,
  description,
  category,
}: {
  accessToken: string;
  file: File;
  title: string;
  description?: string;
  category?: string;
}): Promise<{ resource: ResourceShare }> => {
  const formData = new FormData();
  formData.set("file", file);
  formData.set("title", title);
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
