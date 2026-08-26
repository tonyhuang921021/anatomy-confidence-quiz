"use client";

import Link from "next/link";
import { Bell, BellRing, MessageCircle, MessagesSquare } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import {
  EMPTY_FEEDBACK_ACTIVITY_STATE,
  FEEDBACK_CREATED_EVENT,
  applyFeedbackActivityPage,
  countUnreadFeedbackActivities,
  markFeedbackActivitiesRead,
  mergeFeedbackActivityStates,
  reconcileOwnFeedbackActivities,
  type FeedbackActivityState
} from "@/lib/feedbackActivity";
import { loadFeedbackActivity } from "@/lib/cloudSync";
import { compareFeedbackIds } from "@/lib/feedbackPagination";
import type { FeedbackActivity } from "@/types/quiz";

const ACTIVITY_STATE_PREFIX = "feedbackActivity:v1:";
const ACTIVITY_LEASE_PREFIX = "feedbackActivityLease:v1:";
const OWN_CREATED_IDS_KEY = "feedbackOwnCreatedIds:v1";
const ACTIVITY_REFRESH_EVENT = "feedback-activity-refresh";
const VISIBLE_POLL_MS = 90 * 1000;
const LEASE_MS = 4 * 60 * 1000;
const OWN_ID_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type OwnCreatedId = { id: string; createdAt: number };

function activityStateKey(userId: string) {
  return `${ACTIVITY_STATE_PREFIX}${userId}`;
}

function activityLeaseKey(userId: string) {
  return `${ACTIVITY_LEASE_PREFIX}${userId}`;
}

function loadStoredActivityState(userId: string): FeedbackActivityState {
  try {
    const raw = window.localStorage.getItem(activityStateKey(userId));
    if (!raw) return EMPTY_FEEDBACK_ACTIVITY_STATE;
    const parsed = JSON.parse(raw) as Partial<FeedbackActivityState>;
    const activities = Array.isArray(parsed.activities)
      ? parsed.activities.filter(
          (activity): activity is FeedbackActivity =>
            Boolean(
              activity &&
              typeof activity.id === "string" &&
              (activity.type === "root" || activity.type === "reply") &&
              typeof activity.content === "string" &&
              typeof activity.createdAt === "string"
            )
        ).slice(0, 20)
      : [];
    const readCursor = typeof parsed.readCursor === "string" ? parsed.readCursor : null;
    const legacyUnreadCount = activities.filter(
      (activity) => !readCursor || compareFeedbackIds(activity.id, readCursor) > 0
    ).length;
    const activityCount =
      typeof parsed.activityCount === "number" && Number.isFinite(parsed.activityCount)
        ? Math.max(0, Math.trunc(parsed.activityCount))
        : activities.length;
    const readActivityCount =
      typeof parsed.readActivityCount === "number" && Number.isFinite(parsed.readActivityCount)
        ? Math.max(0, Math.min(activityCount, Math.trunc(parsed.readActivityCount)))
        : Math.max(0, activityCount - legacyUnreadCount);

    return {
      cursor: typeof parsed.cursor === "string" ? parsed.cursor : null,
      readCursor,
      activityCount,
      readActivityCount,
      activities
    };
  } catch {
    return EMPTY_FEEDBACK_ACTIVITY_STATE;
  }
}

function saveStoredActivityState(userId: string, state: FeedbackActivityState) {
  try {
    window.localStorage.setItem(activityStateKey(userId), JSON.stringify(state));
  } catch {
    // The in-memory bell still works when browser storage is unavailable.
  }
}

function loadOwnCreatedIds() {
  try {
    const raw = window.localStorage.getItem(OWN_CREATED_IDS_KEY);
    if (!raw) return [] as OwnCreatedId[];
    const cutoff = Date.now() - OWN_ID_TTL_MS;
    const parsed = JSON.parse(raw) as OwnCreatedId[];
    return Array.isArray(parsed)
      ? parsed
          .filter(
            (entry) =>
              entry &&
              typeof entry.id === "string" &&
              typeof entry.createdAt === "number" &&
              entry.createdAt >= cutoff
          )
          .slice(-100)
      : [];
  } catch {
    return [] as OwnCreatedId[];
  }
}

function saveOwnCreatedIds(entries: OwnCreatedId[]) {
  try {
    window.localStorage.setItem(OWN_CREATED_IDS_KEY, JSON.stringify(entries.slice(-100)));
  } catch {
    // Own-ID filtering also happens on the server for signed-in owners.
  }
}

function formatActivityTime(value: string) {
  return new Date(value).toLocaleString("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getActivityAuthor(activity: FeedbackActivity) {
  if (activity.isAnonymous) return "匿名使用者";
  if (activity.displayName?.trim()) return activity.displayName.trim();
  return "已登入使用者";
}

export function FeedbackNotificationBell({
  open,
  onOpenChange,
  placement = "topbar"
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  placement?: "topbar" | "settings";
}) {
  const { configured, session, user } = useAuth();
  const [activityState, setActivityState] = useState<FeedbackActivityState>(
    EMPTY_FEEDBACK_ACTIVITY_STATE
  );
  const [authorizedUserId, setAuthorizedUserId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const activityStateRef = useRef<FeedbackActivityState>(EMPTY_FEEDBACK_ACTIVITY_STATE);
  const openRef = useRef(open);
  const tabIdRef = useRef("");
  const eligible = Boolean(configured && user?.id && session?.access_token);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) onOpenChange(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onOpenChange(false);
      triggerRef.current?.focus();
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onOpenChange, open]);

  useEffect(() => {
    const userId = user?.id;
    const accessToken = session?.access_token;
    if (!eligible || !userId || !accessToken) {
      activityStateRef.current = EMPTY_FEEDBACK_ACTIVITY_STATE;
      setActivityState(EMPTY_FEEDBACK_ACTIVITY_STATE);
      setAuthorizedUserId(null);
      return;
    }
    const ownerUserId: string = userId;
    const ownerAccessToken: string = accessToken;

    if (!tabIdRef.current) {
      tabIdRef.current = typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }

    const stored = reconcileOwnFeedbackActivities(
      loadStoredActivityState(ownerUserId),
      loadOwnCreatedIds().map((entry) => entry.id)
    );
    activityStateRef.current = stored;
    setActivityState(stored);
    saveStoredActivityState(ownerUserId, stored);

    let cancelled = false;
    let timerId: number | undefined;
    let polling = false;
    let failureCount = 0;

    const commitState = (next: FeedbackActivityState) => {
      const merged = reconcileOwnFeedbackActivities(
        mergeFeedbackActivityStates(loadStoredActivityState(ownerUserId), next),
        loadOwnCreatedIds().map((entry) => entry.id)
      );
      activityStateRef.current = merged;
      setActivityState(merged);
      saveStoredActivityState(ownerUserId, merged);
    };

    const schedule = (delay: number) => {
      if (cancelled) return;
      if (timerId !== undefined) window.clearTimeout(timerId);
      timerId = window.setTimeout(() => void poll(), delay);
    };

    const releasePollingLease = () => {
      const key = activityLeaseKey(ownerUserId);
      try {
        const lease = JSON.parse(window.localStorage.getItem(key) ?? "null") as {
          owner?: string;
        } | null;
        if (lease?.owner === tabIdRef.current) window.localStorage.removeItem(key);
      } catch {
        // Expired leases are harmless and will be replaced by the next active tab.
      }
    };

    const acquirePollingLease = () => {
      const key = activityLeaseKey(ownerUserId);
      const now = Date.now();
      try {
        const current = JSON.parse(window.localStorage.getItem(key) ?? "null") as {
          owner?: string;
          expiresAt?: number;
          hidden?: boolean;
        } | null;
        const visibleTabCanTakeHiddenLease = !document.hidden && current?.hidden === true;
        if (
          current?.owner &&
          current.owner !== tabIdRef.current &&
          (current.expiresAt ?? 0) > now &&
          !visibleTabCanTakeHiddenLease
        ) {
          return false;
        }
        window.localStorage.setItem(
          key,
          JSON.stringify({
            owner: tabIdRef.current,
            expiresAt: now + LEASE_MS,
            hidden: document.hidden
          })
        );
        const confirmed = JSON.parse(window.localStorage.getItem(key) ?? "null") as {
          owner?: string;
        } | null;
        return confirmed?.owner === tabIdRef.current;
      } catch {
        return true;
      }
    };

    async function poll() {
      if (cancelled || polling) return;
      if (navigator.onLine === false) {
        schedule(VISIBLE_POLL_MS);
        return;
      }
      if (document.hidden) {
        releasePollingLease();
        schedule(VISIBLE_POLL_MS);
        return;
      }
      if (!acquirePollingLease()) {
        const synced = loadStoredActivityState(ownerUserId);
        const merged = reconcileOwnFeedbackActivities(
          mergeFeedbackActivityStates(activityStateRef.current, synced),
          loadOwnCreatedIds().map((entry) => entry.id)
        );
        activityStateRef.current = merged;
        setActivityState(merged);
        saveStoredActivityState(ownerUserId, merged);
        schedule(30 * 1000);
        return;
      }

      polling = true;
      try {
        const page = await loadFeedbackActivity({
          accessToken: ownerAccessToken,
          cursor: activityStateRef.current.cursor,
          limit: 20
        });
        if (cancelled) return;
        if (page.authorized === false) {
          setAuthorizedUserId(null);
          setError("");
          releasePollingLease();
          return;
        }
        if (page.authorized === true) setAuthorizedUserId(ownerUserId);
        const ownCreatedIds = new Set(loadOwnCreatedIds().map((entry) => entry.id));
        const applied = applyFeedbackActivityPage(activityStateRef.current, page, ownCreatedIds);
        let nextState = applied.state;
        if (openRef.current) nextState = markFeedbackActivitiesRead(nextState);
        commitState(nextState);
        setError(page.degraded ? page.message ?? "留言通知暫停更新。" : "");

        failureCount = 0;
        schedule(page.hasMore ? 1000 : VISIBLE_POLL_MS);
      } catch (pollError) {
        if (!cancelled) {
          failureCount += 1;
          setError(pollError instanceof Error ? pollError.message : "留言通知稍後更新。");
          schedule(Math.min(5 * 60 * 1000, 30 * 1000 * 2 ** Math.min(failureCount - 1, 4)));
        }
      } finally {
        polling = false;
      }
    }

    function requestImmediatePoll() {
      if (document.hidden) {
        releasePollingLease();
        schedule(VISIBLE_POLL_MS);
        return;
      }
      schedule(250);
    }

    function handleStorage(event: StorageEvent) {
      if (
        (event.key === activityStateKey(ownerUserId) && event.newValue) ||
        event.key === OWN_CREATED_IDS_KEY
      ) {
        const synced = loadStoredActivityState(ownerUserId);
        const merged = reconcileOwnFeedbackActivities(
          mergeFeedbackActivityStates(activityStateRef.current, synced),
          loadOwnCreatedIds().map((entry) => entry.id)
        );
        activityStateRef.current = merged;
        setActivityState(merged);
        saveStoredActivityState(ownerUserId, merged);
      }
    }

    function handleCreated(event: Event) {
      const id = (event as CustomEvent<{ id?: unknown }>).detail?.id;
      if (typeof id !== "string") return;
      const entries = loadOwnCreatedIds().filter((entry) => entry.id !== id);
      entries.push({ id, createdAt: Date.now() });
      saveOwnCreatedIds(entries);
      const filtered = reconcileOwnFeedbackActivities(
        mergeFeedbackActivityStates(
          activityStateRef.current,
          loadStoredActivityState(ownerUserId)
        ),
        entries.map((entry) => entry.id)
      );
      activityStateRef.current = filtered;
      setActivityState(filtered);
      saveStoredActivityState(ownerUserId, filtered);
    }

    window.addEventListener("online", requestImmediatePoll);
    window.addEventListener("storage", handleStorage);
    window.addEventListener(FEEDBACK_CREATED_EVENT, handleCreated);
    window.addEventListener(ACTIVITY_REFRESH_EVENT, requestImmediatePoll);
    document.addEventListener("visibilitychange", requestImmediatePoll);
    schedule(1200);

    return () => {
      cancelled = true;
      if (timerId !== undefined) window.clearTimeout(timerId);
      window.removeEventListener("online", requestImmediatePoll);
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(FEEDBACK_CREATED_EVENT, handleCreated);
      window.removeEventListener(ACTIVITY_REFRESH_EVENT, requestImmediatePoll);
      document.removeEventListener("visibilitychange", requestImmediatePoll);
      releasePollingLease();
    };
  }, [eligible, session?.access_token, user?.id]);

  const unreadCount = countUnreadFeedbackActivities(activityState);
  const previews = useMemo(() => activityState.activities.slice(0, 8), [activityState.activities]);
  const inSettings = placement === "settings";

  if (!eligible || !user?.id || authorizedUserId !== user.id) return null;

  function markCurrentActivityRead() {
    if (!user?.id) return;
    const current = reconcileOwnFeedbackActivities(
      mergeFeedbackActivityStates(
        activityStateRef.current,
        loadStoredActivityState(user.id)
      ),
      loadOwnCreatedIds().map((entry) => entry.id)
    );
    const next = markFeedbackActivitiesRead(current);
    activityStateRef.current = next;
    setActivityState(next);
    saveStoredActivityState(user.id, next);
  }

  function toggleOpen() {
    const nextOpen = !open;
    if (nextOpen) {
      markCurrentActivityRead();
      window.dispatchEvent(new Event(ACTIVITY_REFRESH_EVENT));
    }
    onOpenChange(nextOpen);
  }

  return (
    <div
      ref={wrapperRef}
      className={`app-feedback-notification-wrap${inSettings ? " app-feedback-notification-wrap-settings" : ""}`}
    >
      <button
        ref={triggerRef}
        type="button"
        className={`app-feedback-notification-trigger${inSettings ? " app-feedback-notification-trigger-settings" : ""}`}
        onClick={toggleOpen}
        aria-label={`留言通知，${unreadCount} 則未讀`}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls="app-feedback-notification-popover"
      >
        {unreadCount > 0 ? <BellRing size={19} strokeWidth={1.8} /> : <Bell size={19} strokeWidth={1.8} />}
        {inSettings ? (
          <span className="app-feedback-notification-trigger-copy">
            <strong>留言通知</strong>
            <small>{unreadCount > 0 ? `${unreadCount} 則未讀` : "查看最近的新留言與回覆"}</small>
          </span>
        ) : null}
        {unreadCount > 0 ? (
          <span className="app-feedback-notification-badge" aria-hidden="true">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>
      <span className="sr-only" aria-live="polite">
        {unreadCount > 0 ? `留言板有 ${unreadCount} 則新動態。` : ""}
      </span>

      {open ? (
        <section
          id="app-feedback-notification-popover"
          className={`app-feedback-notification-popover${inSettings ? " app-feedback-notification-popover-settings" : ""}`}
          role={inSettings ? "region" : "dialog"}
          aria-labelledby="app-feedback-notification-title"
        >
          <div className="app-feedback-notification-head">
            <div>
              <p id="app-feedback-notification-title">留言通知</p>
              <span>只讀取上次檢查後的新留言與回覆</span>
            </div>
            <Bell size={17} strokeWidth={1.8} aria-hidden="true" />
          </div>

          <div className="app-feedback-notification-list">
            {previews.length > 0 ? (
              previews.map((activity) => (
                <Link
                  key={activity.id}
                  href="/#feedback"
                  onClick={() => onOpenChange(false)}
                  className="app-feedback-notification-item"
                >
                  <span aria-hidden="true">
                    {activity.type === "reply" ? (
                      <MessageCircle size={16} strokeWidth={1.8} />
                    ) : (
                      <MessagesSquare size={16} strokeWidth={1.8} />
                    )}
                  </span>
                  <span>
                    <strong>{activity.type === "reply" ? "新回覆" : "新留言"}</strong>
                    <small>{getActivityAuthor(activity)} · {formatActivityTime(activity.createdAt)}</small>
                    <p>{activity.content}</p>
                  </span>
                </Link>
              ))
            ) : (
              <p className="app-feedback-notification-empty">目前沒有新動態。</p>
            )}
          </div>

          {!inSettings ? (
            <div className="app-feedback-notification-settings">
              <Link
                href="/settings"
                onClick={() => onOpenChange(false)}
                className="inline-flex min-h-11 items-center font-semibold text-brand-700"
              >
                前往設定
              </Link>
              {error ? <p className="is-error" role="status">{error}</p> : null}
            </div>
          ) : error ? (
            <div className="app-feedback-notification-settings">
              <p className="is-error" role="status">{error}</p>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
