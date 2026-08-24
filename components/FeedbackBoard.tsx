"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, MessageCircle, Pin, RefreshCw, Send, ThumbsDown, ThumbsUp } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { createFeedbackMessage, loadFeedbackMessagesResult, voteFeedbackMessage } from "@/lib/cloudSync";
import { FEEDBACK_CREATED_EVENT } from "@/lib/feedbackActivity";
import {
  addFeedbackReply,
  mergeFeedbackMessagePages,
  sanitizeFeedbackMessagePrivacy,
  shouldResetFeedbackPageCursor
} from "@/lib/feedbackPagination";
import type { FeedbackMessage, OpenAIBudgetStatus } from "@/types/quiz";

const FEEDBACK_CACHE_KEY = "homeFeedbackLastGood:v2";
const FEEDBACK_PAGE_SIZE = 10;

type CachedFeedbackPage = {
  messages: FeedbackMessage[];
  nextCursor: string | null;
  hasMore: boolean;
};

function formatCreatedAt(value: string) {
  return new Date(value).toLocaleString("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatUsd(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return `US$${value.toFixed(2)}`;
}

function BudgetPinnedMessage({ budget }: { budget: OpenAIBudgetStatus }) {
  if (!budget.enabled) return null;

  const used = formatUsd(budget.usedUsd);
  const budgetTotal = formatUsd(budget.budgetUsd);
  const remaining = formatUsd(budget.remainingUsd);
  const statusMessage = budget.message?.replace(/[。.]$/, "");
  const text =
    used && budgetTotal && remaining
      ? `AI 補強基金：已使用 ${used} / 預算 ${budgetTotal}，剩餘約 ${remaining}`
      : budgetTotal
        ? statusMessage && statusMessage !== "使用狀態整理中"
          ? `AI 補強基金：預算 ${budgetTotal}，使用量暫時讀不到（${statusMessage}）`
          : `AI 補強基金：預算 ${budgetTotal}，使用狀態整理中`
        : "";

  if (!text) return null;

  return (
    <div className="feedback-pinned">
      <Pin size={16} strokeWidth={1.8} aria-hidden="true" />
      <div>
        <p className="font-semibold">{text}</p>
        <p className="mt-1 text-xs leading-5 text-emerald-800/80">
        小小透明一下，AI 詳解能穩穩開著就好，大家照自己的節奏用。
        </p>
      </div>
    </div>
  );
}

function FeedbackSkeleton() {
  return (
    <div className="feedback-skeleton-list">
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="feedback-skeleton-row">
          <div className="home-skeleton-line h-4 w-32" />
          <div className="home-skeleton-line mt-3 h-3 w-full" />
          <div className="home-skeleton-line mt-2 h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}

function loadCachedFeedbackMessages() {
  try {
    const raw = window.localStorage.getItem(FEEDBACK_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedFeedbackPage>;
    if (!Array.isArray(parsed.messages)) return null;
    return {
      messages: parsed.messages
        .slice(0, FEEDBACK_PAGE_SIZE)
        .map(sanitizeFeedbackMessagePrivacy),
      nextCursor: typeof parsed.nextCursor === "string" ? parsed.nextCursor : null,
      hasMore: Boolean(parsed.hasMore)
    } satisfies CachedFeedbackPage;
  } catch {
    return null;
  }
}

function saveCachedFeedbackMessages(
  messages: FeedbackMessage[],
  nextCursor: string | null,
  hasMore: boolean
) {
  try {
    const cachedMessages = messages.slice(0, FEEDBACK_PAGE_SIZE);
    window.localStorage.setItem(
      FEEDBACK_CACHE_KEY,
      JSON.stringify({
        messages: cachedMessages,
        nextCursor,
        hasMore,
        updatedAt: new Date().toISOString()
      })
    );
  } catch {
    // Feedback should not depend on localStorage quota.
  }
}

function FeedbackVoteControls({
  entry,
  disabled,
  onVote
}: {
  entry: FeedbackMessage;
  disabled: boolean;
  onVote: (entry: FeedbackMessage, vote: 1 | -1) => void;
}) {
  const likeActive = entry.myVote === 1;
  const dislikeActive = entry.myVote === -1;

  return (
    <div className="feedback-votes">
      <button
        type="button"
        onClick={() => onVote(entry, 1)}
        disabled={disabled}
        aria-pressed={likeActive}
        className={likeActive ? "is-active is-like" : ""}
        title="按讚"
      >
        <ThumbsUp size={15} strokeWidth={1.8} aria-hidden="true" />
        <span>讚 {entry.likeCount ?? 0}</span>
      </button>
      <button
        type="button"
        onClick={() => onVote(entry, -1)}
        disabled={disabled}
        aria-pressed={dislikeActive}
        className={dislikeActive ? "is-active is-dislike" : ""}
        title="倒讚"
      >
        <ThumbsDown size={15} strokeWidth={1.8} aria-hidden="true" />
        <span>倒讚 {entry.dislikeCount ?? 0}</span>
      </button>
    </div>
  );
}

function getFeedbackAuthorLabel(entry: FeedbackMessage) {
  if (entry.isAnonymous) return "匿名使用者";
  const displayName = entry.displayName?.trim();
  if (displayName) return displayName;
  return "已登入使用者";
}

function getFeedbackAuthorInitial(label: string) {
  return Array.from(label.trim())[0]?.toUpperCase() ?? "匿";
}

export function FeedbackBoard({ showHeading = true }: { showHeading?: boolean }) {
  const { configured, session, user } = useAuth();
  const [messages, setMessages] = useState<FeedbackMessage[]>([]);
  const [budget, setBudget] = useState<OpenAIBudgetStatus | null>(null);
  const [content, setContent] = useState("");
  const [replyTargetId, setReplyTargetId] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadOlderError, setLoadOlderError] = useState("");
  const [loadAnnouncement, setLoadAnnouncement] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [votingMessageIds, setVotingMessageIds] = useState<Set<string>>(() => new Set());
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [readNotice, setReadNotice] = useState("");
  const refreshRequestIdRef = useRef(0);
  const messagesRef = useRef<FeedbackMessage[]>([]);
  const headPageRef = useRef<FeedbackMessage[]>([]);
  const initialPageLoadedRef = useRef(false);
  const loadingOlderRef = useRef(false);
  const refreshingRef = useRef(false);
  const submittingRef = useRef(false);
  const pendingVoteIdsRef = useRef(new Set<string>());
  const nextCursorRef = useRef<string | null>(null);
  const hasMoreRef = useRef(false);
  const feedbackThreadRef = useRef<HTMLDivElement | null>(null);
  const loadSentinelRef = useRef<HTMLDivElement | null>(null);

  const updateMessages = useCallback(
    (updater: (current: FeedbackMessage[]) => FeedbackMessage[]) => {
      setMessages((current) => {
        const next = updater(current);
        messagesRef.current = next;
        return next;
      });
    },
    []
  );

  const nickname = useMemo(() => {
    const displayName =
      typeof user?.user_metadata?.display_name === "string" ? user.user_metadata.display_name.trim() : "";
    if (displayName) return displayName.slice(0, 24);
    return "";
  }, [user]);
  const composerLabel = user && !isAnonymous ? nickname || "已登入使用者" : "匿名使用者";

  const refreshMessages = useCallback(async (
    options: { fresh?: boolean; initial?: boolean } = {}
  ) => {
    if (options.fresh && loadingOlderRef.current) return;
    const requestId = refreshRequestIdRef.current + 1;
    refreshRequestIdRef.current = requestId;

    if (!configured) {
      setLoading(false);
      return;
    }
    refreshingRef.current = true;
    setRefreshing(true);

    if (options.initial) {
      const cachedPage = loadCachedFeedbackMessages();
      if (cachedPage && cachedPage.messages.length > 0) {
        messagesRef.current = cachedPage.messages;
        headPageRef.current = cachedPage.messages;
        setMessages(cachedPage.messages);
        nextCursorRef.current = cachedPage.nextCursor;
        hasMoreRef.current = cachedPage.hasMore;
        setNextCursor(cachedPage.nextCursor);
        setHasMore(cachedPage.hasMore);
        setLoading(false);
        setReadNotice("留言正在更新，先顯示稍早資料。");
      }
    }
    try {
      const result = await loadFeedbackMessagesResult(FEEDBACK_PAGE_SIZE, {
        fresh: options.fresh
      });
      if (requestId !== refreshRequestIdRef.current) return;
      const establishingPagination = !initialPageLoadedRef.current;
      const shouldResetPagination = shouldResetFeedbackPageCursor(
        headPageRef.current,
        result.messages,
        {
          establishing: establishingPagination,
          degraded: result.degraded
        }
      );
      const shouldUpdatePagination = establishingPagination || shouldResetPagination;
      if (result.messages.length > 0 || !result.degraded) {
        updateMessages((current) => {
          return mergeFeedbackMessagePages(current, result.messages);
        });
      }
      if (!result.degraded || result.stale) {
        headPageRef.current = result.messages;
        saveCachedFeedbackMessages(result.messages, result.nextCursor, result.hasMore);
        if (shouldUpdatePagination) {
          nextCursorRef.current = result.nextCursor;
          hasMoreRef.current = result.hasMore;
          setNextCursor(result.nextCursor);
          setHasMore(result.hasMore);
        }
        initialPageLoadedRef.current = true;
      }
      setReadNotice(
        result.degraded
          ? result.message || (result.stale ? "留言稍後更新，先顯示稍早資料。" : "留言稍後更新。")
          : ""
      );
    } catch (fetchError) {
      if (requestId !== refreshRequestIdRef.current) return;
      setReadNotice(fetchError instanceof Error ? fetchError.message : "留言稍後更新，先顯示稍早資料。");
    } finally {
      if (requestId === refreshRequestIdRef.current) {
        setLoading(false);
        refreshingRef.current = false;
        setRefreshing(false);
      }
    }
  }, [configured, updateMessages]);

  useEffect(() => {
    void refreshMessages({ initial: true });
  }, [refreshMessages]);

  const loadOlderMessages = useCallback(async () => {
    const cursor = nextCursorRef.current;
    if (
      !configured ||
      !cursor ||
      !hasMoreRef.current ||
      loadingOlderRef.current ||
      refreshingRef.current
    ) {
      return;
    }

    loadingOlderRef.current = true;
    setLoadingOlder(true);
    setLoadOlderError("");
    setLoadAnnouncement("");

    try {
      const result = await loadFeedbackMessagesResult(FEEDBACK_PAGE_SIZE, { cursor });
      if (result.degraded && !result.stale) {
        throw new Error(result.message || "較早留言暫時讀不到，請稍後再試。");
      }

      updateMessages((current) => {
        return mergeFeedbackMessagePages(current, result.messages);
      });
      nextCursorRef.current = result.nextCursor;
      hasMoreRef.current = result.hasMore;
      setNextCursor(result.nextCursor);
      setHasMore(result.hasMore);
      setLoadAnnouncement(
        result.messages.length > 0
          ? `已載入 ${result.messages.length} 則較早留言。`
          : "已載入全部留言。"
      );
    } catch (loadError) {
      setLoadOlderError(
        loadError instanceof Error ? loadError.message : "較早留言暫時讀不到，請稍後再試。"
      );
    } finally {
      loadingOlderRef.current = false;
      setLoadingOlder(false);
    }
  }, [configured, updateMessages]);

  useEffect(() => {
    if (
      !hasMore ||
      !nextCursor ||
      refreshing ||
      loadOlderError ||
      typeof IntersectionObserver === "undefined"
    ) {
      return;
    }

    const sentinel = loadSentinelRef.current;
    const scrollContainer = feedbackThreadRef.current;
    if (!sentinel || !scrollContainer) return;
    const overflowY = window.getComputedStyle(scrollContainer).overflowY;
    const observerRoot = /^(auto|scroll|overlay)$/.test(overflowY)
      ? scrollContainer
      : null;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadOlderMessages();
        }
      },
      {
        root: observerRoot,
        rootMargin: "0px 0px 120px",
        threshold: 0.01
      }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadOlderError, loadOlderMessages, nextCursor, refreshing]);

  useEffect(() => {
    async function fetchBudget() {
      const loadBudget = async (url: string) => {
        const response = await fetch(url);
        const payload = (await response.json().catch(() => null)) as
          | { ok?: boolean; budget?: OpenAIBudgetStatus }
          | null;
        if (response.ok && payload?.ok && payload.budget?.enabled) {
          setBudget(payload.budget);
        }
      };

      try {
        await loadBudget("/api/openai-budget?live=false");
      } catch {
        // Keep the feedback board quiet if the budget badge is unavailable.
      }
    }

    void fetchBudget();
  }, []);

  async function handleSubmit() {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError("");
    setMessage("留言送出中…");

    try {
      const created = await createFeedbackMessage({
        content,
        isAnonymous: !user || isAnonymous,
        accessToken: session?.access_token,
        user
      });
      setLoading(false);
      updateMessages((current) => {
        return mergeFeedbackMessagePages(current, [created]);
      });
      window.dispatchEvent(
        new CustomEvent(FEEDBACK_CREATED_EVENT, { detail: { id: created.id } })
      );
      setContent("");
      setMessage("留言已送出，謝謝你的建議。");
    } catch (submitError) {
      setMessage("");
      setError(submitError instanceof Error ? submitError.message : "留言送出失敗");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  async function handleReply(parentId: string) {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError("");
    setMessage("回覆送出中…");

    try {
      const created = await createFeedbackMessage({
        content: replyContent,
        isAnonymous: !user || isAnonymous,
        accessToken: session?.access_token,
        user,
        parentId
      });
      setLoading(false);
      updateMessages((current) => {
        return addFeedbackReply(current, parentId, created);
      });
      window.dispatchEvent(
        new CustomEvent(FEEDBACK_CREATED_EVENT, { detail: { id: created.id } })
      );
      setReplyContent("");
      setReplyTargetId(null);
      setMessage("回覆已送出。");
    } catch (submitError) {
      setMessage("");
      setError(submitError instanceof Error ? submitError.message : "回覆送出失敗");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  function updateMessageVote(
    entries: FeedbackMessage[],
    messageId: string,
    updater: (entry: FeedbackMessage) => FeedbackMessage
  ): FeedbackMessage[] {
    return entries.map((entry) => {
      if (entry.id === messageId) return updater(entry);
      if ((entry.replies?.length ?? 0) > 0) {
        return {
          ...entry,
          replies: updateMessageVote(entry.replies ?? [], messageId, updater)
        };
      }
      return entry;
    });
  }

  async function handleVote(entry: FeedbackMessage, vote: 1 | -1) {
    if (pendingVoteIdsRef.current.has(entry.id)) return;
    pendingVoteIdsRef.current.add(entry.id);
    setVotingMessageIds((current) => {
      const next = new Set(current);
      next.add(entry.id);
      return next;
    });
    const nextVote = entry.myVote === vote ? null : vote;
    const previousVote = entry.myVote ?? null;
    const previousLikeCount = entry.likeCount ?? 0;
    const previousDislikeCount = entry.dislikeCount ?? 0;
    const optimisticLikeDelta =
      (nextVote === 1 ? 1 : 0) - (entry.myVote === 1 ? 1 : 0);
    const optimisticDislikeDelta =
      (nextVote === -1 ? 1 : 0) - (entry.myVote === -1 ? 1 : 0);
    setError("");
    setMessage("");
    updateMessages((current) =>
      updateMessageVote(current, entry.id, (currentEntry) => ({
        ...currentEntry,
        myVote: nextVote,
        likeCount: Math.max(0, (currentEntry.likeCount ?? 0) + optimisticLikeDelta),
        dislikeCount: Math.max(0, (currentEntry.dislikeCount ?? 0) + optimisticDislikeDelta)
      }))
    );

    try {
      const result = await voteFeedbackMessage({
        messageId: entry.id,
        vote: nextVote,
        accessToken: session?.access_token,
        user
      });
      updateMessages((current) => {
        return updateMessageVote(current, result.messageId, (currentEntry) => ({
          ...currentEntry,
          myVote: result.myVote,
          likeCount: result.likeCount,
          dislikeCount: result.dislikeCount
        }));
      });
    } catch (voteError) {
      updateMessages((current) =>
        updateMessageVote(current, entry.id, (currentEntry) => ({
          ...currentEntry,
          myVote: previousVote,
          likeCount: previousLikeCount,
          dislikeCount: previousDislikeCount
        }))
      );
      setError(voteError instanceof Error ? voteError.message : "留言投票失敗");
    } finally {
      pendingVoteIdsRef.current.delete(entry.id);
      setVotingMessageIds((current) => {
        const next = new Set(current);
        next.delete(entry.id);
        return next;
      });
    }
  }

  return (
    <section className={`feedback-board${showHeading ? "" : " is-embedded"}`}>
      {showHeading ? (
        <div className="feedback-heading">
          <div>
            <h2>留言板</h2>
            <p>建議、題目問題與網站狀況都可以留在這裡。</p>
          </div>
        </div>
      ) : null}

      {!configured ? (
        <div className="feedback-notice">
          目前尚未設定 Supabase，留言板暫時無法使用。
        </div>
      ) : (
        <>
          {budget ? <BudgetPinnedMessage budget={budget} /> : null}

          <div className="feedback-layout">
            <div className="feedback-composer">
              <div className="feedback-composer-header">
                <span className="feedback-avatar" aria-hidden="true">
                  {getFeedbackAuthorInitial(composerLabel)}
                </span>
                <div>
                  <p>留下你的想法</p>
                  <span>送出後會直接出現在留言串，不用重複按。</span>
                </div>
              </div>
              {user ? (
                <div className="feedback-identity" role="group" aria-label="留言顯示方式">
                  <button
                    type="button"
                    onClick={() => setIsAnonymous(true)}
                    className={isAnonymous ? "is-selected" : ""}
                    aria-pressed={isAnonymous}
                  >
                    <span className="feedback-identity-indicator" aria-hidden="true">
                      {isAnonymous ? <Check size={14} strokeWidth={2.4} /> : null}
                    </span>
                    <span>匿名留言</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAnonymous(false)}
                    className={!isAnonymous ? "is-selected" : ""}
                    aria-pressed={!isAnonymous}
                  >
                    <span className="feedback-identity-indicator" aria-hidden="true">
                      {!isAnonymous ? <Check size={14} strokeWidth={2.4} /> : null}
                    </span>
                    <span>用暱稱留言{nickname ? `（${nickname}）` : ""}</span>
                  </button>
                </div>
              ) : (
                <div className="feedback-guest-note">
                  目前未登入，送出後會以匿名顯示。
                </div>
              )}

              <textarea
                aria-label="留言內容"
                value={content}
                onChange={(event) => setContent(event.target.value)}
                maxLength={1200}
                placeholder="例如：哪個頁面不夠順、哪種排版不舒服、還想新增什麼功能。"
                className="feedback-textarea"
                disabled={submitting}
                aria-busy={submitting}
              />
              <div className="feedback-compose-footer">
                <p>{content.length} / 1200</p>
                <button
                  type="button"
                  onClick={() => void handleSubmit()}
                  disabled={submitting || !content.trim()}
                  className="feedback-submit"
                >
                  <Send size={16} strokeWidth={1.8} aria-hidden="true" />
                  {submitting ? "送出中..." : "送出留言"}
                </button>
              </div>

              {message ? (
                <div
                  className={`feedback-status ${submitting ? "is-pending" : "is-success"}`}
                  aria-live="polite"
                >
                  {submitting ? (
                    <RefreshCw className="animate-spin" size={15} strokeWidth={1.8} aria-hidden="true" />
                  ) : null}
                  {message}
                </div>
              ) : null}
              {error ? (
                <div className="feedback-status is-error" aria-live="assertive">{error}</div>
              ) : null}
            </div>

            <div className="feedback-stream">
              {readNotice ? (
                <div className="feedback-status is-warning">
                  {readNotice}
                </div>
              ) : null}

              <div className="feedback-list-toolbar">
                <div>
                  <p>最新留言</p>
                  <span>{messages.length} 串</span>
                </div>
                <button
                  type="button"
                  onClick={() => void refreshMessages({ fresh: true })}
                  disabled={refreshing || loadingOlder}
                  title="重新整理留言"
                  aria-label="重新整理留言"
                >
                  <RefreshCw
                    size={17}
                    strokeWidth={1.8}
                    className={refreshing ? "animate-spin" : ""}
                    aria-hidden="true"
                  />
                </button>
              </div>

              <div ref={feedbackThreadRef} className="feedback-thread">
                {loading ? (
                  <FeedbackSkeleton />
                ) : messages.length === 0 ? (
                  <div className="feedback-empty">
                    還沒有留言，你可以成為第一個給建議的人。
                  </div>
                ) : (
                  <>
                  {messages.map((entry) => (
                    <article key={entry.id} className="feedback-entry">
                  <div className="feedback-entry-head">
                    <div className="feedback-entry-identity">
                      <span className="feedback-avatar" aria-hidden="true">
                        {getFeedbackAuthorInitial(getFeedbackAuthorLabel(entry))}
                      </span>
                      <div>
                        <p className="feedback-author">
                          {getFeedbackAuthorLabel(entry)}
                        </p>
                        <p className="feedback-time">{formatCreatedAt(entry.createdAt)}</p>
                      </div>
                    </div>
                  </div>
                  <p className="feedback-content">{entry.content}</p>
                  <div className="feedback-entry-actions">
                    <FeedbackVoteControls
                      entry={entry}
                      disabled={votingMessageIds.has(entry.id)}
                      onVote={(target, vote) => void handleVote(target, vote)}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setReplyTargetId((current) => (current === entry.id ? null : entry.id));
                        setReplyContent("");
                      }}
                      className="feedback-reply-trigger"
                    >
                      <MessageCircle size={15} strokeWidth={1.8} aria-hidden="true" />
                      {replyTargetId === entry.id ? "收起回覆" : "回覆"}
                    </button>
                    {(entry.replies?.length ?? 0) > 0 ? (
                      <span className="feedback-reply-count">{entry.replies?.length} 則回覆</span>
                    ) : null}
                  </div>

                  {replyTargetId === entry.id ? (
                    <div className="feedback-reply-composer">
                      <textarea
                        aria-label={`回覆 ${getFeedbackAuthorLabel(entry)} 的留言`}
                        value={replyContent}
                        onChange={(event) => setReplyContent(event.target.value)}
                        maxLength={800}
                        placeholder="回覆這則留言..."
                        className="feedback-textarea feedback-reply-textarea"
                        disabled={submitting}
                        aria-busy={submitting}
                      />
                      <div className="feedback-compose-footer">
                        <p>{replyContent.length} / 800</p>
                        <button
                          type="button"
                          onClick={() => void handleReply(entry.id)}
                          disabled={submitting || !replyContent.trim()}
                          className="feedback-submit"
                        >
                          {submitting ? "送出中..." : "送出回覆"}
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {(entry.replies?.length ?? 0) > 0 ? (
                    <div className="feedback-replies">
                      {entry.replies?.map((reply) => (
                        <div key={reply.id} className="feedback-reply">
                          <div className="feedback-entry-identity">
                            <span className="feedback-avatar is-reply" aria-hidden="true">
                              {getFeedbackAuthorInitial(getFeedbackAuthorLabel(reply))}
                            </span>
                            <div>
                              <p className="feedback-author">
                                {getFeedbackAuthorLabel(reply)}
                              </p>
                              <p className="feedback-time">{formatCreatedAt(reply.createdAt)}</p>
                            </div>
                          </div>
                          <p className="feedback-content">
                            {reply.content}
                          </p>
                          <div className="feedback-entry-actions">
                            <FeedbackVoteControls
                              entry={reply}
                              disabled={votingMessageIds.has(reply.id)}
                              onVote={(target, vote) => void handleVote(target, vote)}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                    </article>
                  ))}
                  <div ref={loadSentinelRef} className="feedback-load-sentinel" aria-hidden="true" />
                  {hasMore ? (
                    <div className="feedback-pagination">
                      <button
                        type="button"
                        onClick={() => void loadOlderMessages()}
                        disabled={loadingOlder || refreshing || !nextCursor}
                      >
                        {loadingOlder ? (
                          <RefreshCw className="animate-spin" size={15} strokeWidth={1.8} aria-hidden="true" />
                        ) : null}
                        {loadOlderError ? "再試一次" : loadingOlder ? "載入中..." : "載入較早留言"}
                      </button>
                      {loadOlderError ? <p role="alert">{loadOlderError}</p> : null}
                    </div>
                  ) : null}
                  <p className="sr-only" aria-live="polite">{loadAnnouncement}</p>
                  </>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
