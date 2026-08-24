import type { FeedbackMessage } from "../types/quiz";

export type FeedbackMessageRow = {
  id: string | number;
  content: string;
  parent_id?: string | number | null;
  display_name?: string | null;
  is_anonymous: boolean;
  created_at: string;
};

export type FeedbackVoteCounts = Map<
  string,
  { likeCount: number; dislikeCount: number }
>;

export type FeedbackRootPage = {
  rows: FeedbackMessageRow[];
  hasMore: boolean;
  nextCursor: string | null;
};

const FEEDBACK_CURSOR_PATTERN = /^[1-9]\d*$/;
const FEEDBACK_NUMERIC_ID_PATTERN = /^\d+$/;
const POSTGRES_BIGINT_MAX = "9223372036854775807";

function normalizeNumericId(value: string) {
  return value.replace(/^0+(?=\d)/, "");
}

export function compareFeedbackIds(left: string, right: string) {
  if (FEEDBACK_NUMERIC_ID_PATTERN.test(left) && FEEDBACK_NUMERIC_ID_PATTERN.test(right)) {
    const normalizedLeft = normalizeNumericId(left);
    const normalizedRight = normalizeNumericId(right);
    if (normalizedLeft.length !== normalizedRight.length) {
      return normalizedLeft.length < normalizedRight.length ? -1 : 1;
    }
    return normalizedLeft === normalizedRight
      ? 0
      : normalizedLeft < normalizedRight
        ? -1
        : 1;
  }

  return left.localeCompare(right);
}

export function normalizeFeedbackPageLimit(
  value: string | number | null | undefined,
  fallback = 10,
  maximum = 20
) {
  const requested = Number(value ?? fallback);
  if (!Number.isFinite(requested)) return fallback;
  return Math.min(maximum, Math.max(1, Math.trunc(requested)));
}

export function normalizeFeedbackCursor(value: string | null | undefined) {
  if (value === null || value === undefined || value.trim() === "") return null;
  const normalized = value.trim();
  if (!FEEDBACK_CURSOR_PATTERN.test(normalized)) return null;
  return compareFeedbackIds(normalized, POSTGRES_BIGINT_MAX) <= 0
    ? normalizeNumericId(normalized)
    : null;
}

export function getFeedbackPageCacheKey(limit: number, cursor?: string | null) {
  return `${limit}:${cursor ?? "first"}`;
}

export function takeFeedbackRootPage(
  rows: FeedbackMessageRow[],
  limit: number
): FeedbackRootPage {
  const pageRows = rows.slice(0, limit);
  const hasMore = rows.length > limit;
  return {
    rows: pageRows,
    hasMore,
    nextCursor:
      hasMore && pageRows.length > 0
        ? String(pageRows[pageRows.length - 1].id)
        : null
  };
}

export function mapFeedbackMessageRow(
  row: FeedbackMessageRow,
  voteCounts?: FeedbackVoteCounts
): FeedbackMessage {
  const counts = voteCounts?.get(String(row.id));
  return {
    id: String(row.id),
    content: row.content,
    parentId:
      row.parent_id === null || row.parent_id === undefined
        ? undefined
        : String(row.parent_id),
    displayName: row.is_anonymous ? undefined : row.display_name ?? undefined,
    isAnonymous: row.is_anonymous,
    createdAt: row.created_at,
    likeCount: counts?.likeCount ?? 0,
    dislikeCount: counts?.dislikeCount ?? 0
  };
}

export function sanitizeFeedbackMessagePrivacy(
  message: FeedbackMessage
): FeedbackMessage {
  return {
    ...message,
    displayName: message.isAnonymous ? undefined : message.displayName,
    replies: Array.isArray(message.replies)
      ? message.replies.map(sanitizeFeedbackMessagePrivacy)
      : []
  };
}

function compareReplies(left: FeedbackMessage, right: FeedbackMessage) {
  const createdAtOrder = left.createdAt.localeCompare(right.createdAt);
  return createdAtOrder || compareFeedbackIds(left.id, right.id);
}

export function buildFeedbackTree(
  roots: FeedbackMessageRow[],
  replies: FeedbackMessageRow[],
  voteCounts?: FeedbackVoteCounts
) {
  const repliesByParent = new Map<string, FeedbackMessage[]>();

  for (const row of replies) {
    if (row.parent_id === null || row.parent_id === undefined) continue;
    const parentId = String(row.parent_id);
    const group = repliesByParent.get(parentId) ?? [];
    group.push(mapFeedbackMessageRow(row, voteCounts));
    repliesByParent.set(parentId, group);
  }

  return roots.map((row) => {
    const root = mapFeedbackMessageRow(row, voteCounts);
    return {
      ...root,
      replies: (repliesByParent.get(root.id) ?? []).sort(compareReplies)
    };
  });
}

function mergeFeedbackEntry(
  current: FeedbackMessage | undefined,
  incoming: FeedbackMessage
): FeedbackMessage {
  const currentReplies = current?.replies ?? [];
  const incomingReplies = incoming.replies ?? [];
  const repliesById = new Map<string, FeedbackMessage>();

  for (const reply of currentReplies) repliesById.set(reply.id, reply);
  for (const reply of incomingReplies) {
    const previous = repliesById.get(reply.id);
    repliesById.set(reply.id, {
      ...previous,
      ...reply,
      myVote: reply.myVote ?? previous?.myVote ?? null
    });
  }

  return {
    ...current,
    ...incoming,
    myVote: incoming.myVote ?? current?.myVote ?? null,
    replies: Array.from(repliesById.values()).sort(compareReplies)
  };
}

export function mergeFeedbackMessagePages(
  current: FeedbackMessage[],
  incoming: FeedbackMessage[]
) {
  const rootsById = new Map<string, FeedbackMessage>();

  for (const root of current) rootsById.set(root.id, root);
  for (const root of incoming) {
    rootsById.set(root.id, mergeFeedbackEntry(rootsById.get(root.id), root));
  }

  return Array.from(rootsById.values()).sort((left, right) => {
    const idOrder = compareFeedbackIds(right.id, left.id);
    return idOrder || right.createdAt.localeCompare(left.createdAt);
  });
}

export function shouldResetFeedbackPageCursor(
  current: FeedbackMessage[],
  incoming: FeedbackMessage[],
  options: { establishing: boolean; degraded: boolean }
) {
  if (options.establishing || options.degraded || incoming.length === 0) return false;
  const currentIds = new Set(current.map((entry) => entry.id));
  return !incoming.some((entry) => currentIds.has(entry.id));
}

export function addFeedbackReply(
  messages: FeedbackMessage[],
  parentId: string,
  reply: FeedbackMessage
) {
  return messages.map((entry) =>
    entry.id === parentId
      ? mergeFeedbackEntry(entry, {
          ...entry,
          replies: [reply]
        })
      : entry
  );
}
