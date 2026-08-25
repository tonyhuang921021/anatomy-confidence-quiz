import { compareFeedbackIds } from "./feedbackPagination";
import type { FeedbackActivity } from "../types/quiz";

export type FeedbackActivityState = {
  cursor: string | null;
  readCursor: string | null;
  activityCount: number;
  readActivityCount: number;
  activities: FeedbackActivity[];
};

export type FeedbackActivityPage = {
  activities: FeedbackActivity[];
  nextCursor: string | null;
  hasMore: boolean;
};

export const FEEDBACK_CREATED_EVENT = "feedback-message-created";

export const EMPTY_FEEDBACK_ACTIVITY_STATE: FeedbackActivityState = {
  cursor: null,
  readCursor: null,
  activityCount: 0,
  readActivityCount: 0,
  activities: []
};

function newestFeedbackId(...ids: Array<string | null | undefined>) {
  return ids.reduce<string | null>((newest, candidate) => {
    if (!candidate) return newest;
    if (!newest || compareFeedbackIds(candidate, newest) > 0) return candidate;
    return newest;
  }, null);
}

export function applyFeedbackActivityPage(
  current: FeedbackActivityState,
  page: FeedbackActivityPage,
  ownCreatedIds: ReadonlySet<string> = new Set(),
  maximumActivities = 20
) {
  const visibleIncoming = page.activities.filter(
    (activity) => !activity.isOwn && !ownCreatedIds.has(activity.id)
  );
  const newlyScannedActivities = visibleIncoming.filter(
    (activity) => !current.cursor || compareFeedbackIds(activity.id, current.cursor) > 0
  );
  const activitiesById = new Map<string, FeedbackActivity>();

  for (const activity of current.activities) activitiesById.set(activity.id, activity);
  for (const activity of visibleIncoming) activitiesById.set(activity.id, activity);

  const activities = Array.from(activitiesById.values())
    .sort((left, right) => compareFeedbackIds(right.id, left.id))
    .slice(0, maximumActivities);
  const cursor = newestFeedbackId(
    current.cursor,
    page.nextCursor,
    ...page.activities.map((activity) => activity.id)
  );
  const isFirstBaseline = current.cursor === null && page.activities.length === 0;

  return {
    state: {
      cursor,
      readCursor:
        isFirstBaseline && current.readCursor === null
          ? cursor
          : current.readCursor,
      activityCount: current.activityCount + newlyScannedActivities.length,
      readActivityCount: current.readActivityCount,
      activities
    },
    addedActivities: newlyScannedActivities
  };
}

export function countUnreadFeedbackActivities(state: FeedbackActivityState) {
  return Math.max(0, state.activityCount - state.readActivityCount);
}

export function markFeedbackActivitiesRead(
  state: FeedbackActivityState
): FeedbackActivityState {
  return {
    ...state,
    readCursor: newestFeedbackId(
      state.readCursor,
      state.cursor,
      ...state.activities.map((activity) => activity.id)
    ),
    readActivityCount: state.activityCount
  };
}

export function mergeFeedbackActivityStates(
  current: FeedbackActivityState,
  incoming: FeedbackActivityState,
  maximumActivities = 20
): FeedbackActivityState {
  const activitiesById = new Map<string, FeedbackActivity>();
  for (const activity of current.activities) activitiesById.set(activity.id, activity);
  for (const activity of incoming.activities) activitiesById.set(activity.id, activity);

  const activityCount = Math.max(current.activityCount, incoming.activityCount);
  return {
    cursor: newestFeedbackId(current.cursor, incoming.cursor),
    readCursor: newestFeedbackId(current.readCursor, incoming.readCursor),
    activityCount,
    readActivityCount: Math.min(
      activityCount,
      Math.max(current.readActivityCount, incoming.readActivityCount)
    ),
    activities: Array.from(activitiesById.values())
      .sort((left, right) => compareFeedbackIds(right.id, left.id))
      .slice(0, maximumActivities)
  };
}

export function excludeOwnFeedbackActivity(
  state: FeedbackActivityState,
  activityId: string
): FeedbackActivityState {
  if (!state.activities.some((activity) => activity.id === activityId)) return state;
  const wasRead = Boolean(
    state.readCursor && compareFeedbackIds(activityId, state.readCursor) <= 0
  );
  const activityCount = Math.max(0, state.activityCount - 1);
  return {
    ...state,
    activityCount,
    readActivityCount: Math.min(
      activityCount,
      Math.max(0, state.readActivityCount - (wasRead ? 1 : 0))
    ),
    activities: state.activities.filter((activity) => activity.id !== activityId)
  };
}

export function reconcileOwnFeedbackActivities(
  state: FeedbackActivityState,
  ownActivityIds: Iterable<string>
): FeedbackActivityState {
  let reconciled = state;
  for (const activityId of ownActivityIds) {
    reconciled = excludeOwnFeedbackActivity(reconciled, activityId);
  }
  return reconciled;
}
