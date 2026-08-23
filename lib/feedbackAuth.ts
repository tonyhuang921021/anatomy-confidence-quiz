export type FeedbackIdentityIntent = "anonymous" | "authenticated" | "authentication-pending";

export type FeedbackDeliveryMessage = {
  id: string;
  content: string;
  parentId?: string;
  createdAt: string;
  replies?: FeedbackDeliveryMessage[];
};

export function getFeedbackIdentityIntent(input: {
  isAnonymous: boolean;
  hasUser: boolean;
  accessToken?: string | null;
}): FeedbackIdentityIntent {
  if (!input.hasUser) return "anonymous";
  if (input.accessToken?.trim()) return "authenticated";
  return "authentication-pending";
}

export function getFeedbackAuthorizationHeaders(accessToken?: string | null): Record<string, string> {
  const normalizedToken = accessToken?.trim();
  return normalizedToken ? { Authorization: `Bearer ${normalizedToken}` } : {};
}

export function findMatchingRecentFeedbackMessage<T extends FeedbackDeliveryMessage>(
  messages: T[],
  input: {
    content: string;
    parentId?: string | null;
    createdAfter: number;
  }
): T | null {
  const normalizedContent = input.content.trim();
  const normalizedParentId = input.parentId?.trim() || undefined;
  const queue = [...messages];

  while (queue.length > 0) {
    const entry = queue.shift();
    if (!entry) continue;
    if (entry.replies?.length) queue.push(...(entry.replies as T[]));

    const createdAt = Date.parse(entry.createdAt);
    if (
      entry.content.trim() === normalizedContent &&
      (entry.parentId || undefined) === normalizedParentId &&
      Number.isFinite(createdAt) &&
      createdAt >= input.createdAfter
    ) {
      return entry;
    }
  }

  return null;
}
