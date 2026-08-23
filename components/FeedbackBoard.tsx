"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, MessageCircle, Pin, RefreshCw, Send, ThumbsDown, ThumbsUp } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { createFeedbackMessage, loadFeedbackMessagesResult, voteFeedbackMessage } from "@/lib/cloudSync";
import type { FeedbackMessage, OpenAIBudgetStatus } from "@/types/quiz";

const FEEDBACK_CACHE_KEY = "homeFeedbackLastGood";

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
    if (!raw) return [] as FeedbackMessage[];
    const parsed = JSON.parse(raw) as { messages?: FeedbackMessage[] };
    return Array.isArray(parsed.messages) ? parsed.messages : [];
  } catch {
    return [] as FeedbackMessage[];
  }
}

function saveCachedFeedbackMessages(messages: FeedbackMessage[]) {
  try {
    window.localStorage.setItem(
      FEEDBACK_CACHE_KEY,
      JSON.stringify({
        messages: messages.slice(0, 40),
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
  const displayName = entry.displayName?.trim();
  if (displayName) return displayName;
  return entry.isAnonymous ? "匿名使用者" : "已登入使用者";
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
  const [submitting, setSubmitting] = useState(false);
  const [votingMessageId, setVotingMessageId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [readNotice, setReadNotice] = useState("");
  const refreshRequestIdRef = useRef(0);

  const nickname = useMemo(() => {
    const displayName =
      typeof user?.user_metadata?.display_name === "string" ? user.user_metadata.display_name.trim() : "";
    if (displayName) return displayName.slice(0, 24);
    if (user?.email) return user.email.split("@")[0].slice(0, 24);
    return "";
  }, [user]);
  const composerLabel = user && !isAnonymous ? nickname || "已登入使用者" : "匿名使用者";

  const refreshMessages = useCallback(async (
    options: { fresh?: boolean; initial?: boolean } = {}
  ) => {
    const requestId = refreshRequestIdRef.current + 1;
    refreshRequestIdRef.current = requestId;

    if (!configured) {
      setLoading(false);
      return;
    }

    if (options.initial) {
      const cachedRows = loadCachedFeedbackMessages();
      if (cachedRows.length > 0) {
        setMessages(cachedRows);
        setLoading(false);
        setReadNotice("留言正在更新，先顯示稍早資料。");
      }
    }
    if (options.fresh) setRefreshing(true);

    try {
      const result = await loadFeedbackMessagesResult(20, { fresh: options.fresh });
      if (requestId !== refreshRequestIdRef.current) return;
      if (result.messages.length > 0 || !result.degraded) {
        setMessages(result.messages);
        saveCachedFeedbackMessages(result.messages);
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
        setRefreshing(false);
      }
    }
  }, [configured]);

  useEffect(() => {
    void refreshMessages({ initial: true });
  }, [refreshMessages]);

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
      refreshRequestIdRef.current += 1;
      setMessages((current) => {
        const next = [created, ...current.filter((entry) => entry.id !== created.id)].slice(0, 40);
        saveCachedFeedbackMessages(next);
        return next;
      });
      setContent("");
      setMessage("留言已送出，謝謝你的建議。");
    } catch (submitError) {
      setMessage("");
      setError(submitError instanceof Error ? submitError.message : "留言送出失敗");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReply(parentId: string) {
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
      refreshRequestIdRef.current += 1;
      setMessages((current) => {
        const next = current.map((entry) =>
          entry.id === parentId
            ? {
                ...entry,
                replies: [
                  ...(entry.replies ?? []).filter((reply) => reply.id !== created.id),
                  created
                ]
              }
            : entry
        );
        saveCachedFeedbackMessages(next);
        return next;
      });
      setReplyContent("");
      setReplyTargetId(null);
      setMessage("回覆已送出。");
    } catch (submitError) {
      setMessage("");
      setError(submitError instanceof Error ? submitError.message : "回覆送出失敗");
    } finally {
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
    const nextVote = entry.myVote === vote ? null : vote;
    const previousMessages = messages;
    const optimisticLikeDelta =
      (nextVote === 1 ? 1 : 0) - (entry.myVote === 1 ? 1 : 0);
    const optimisticDislikeDelta =
      (nextVote === -1 ? 1 : 0) - (entry.myVote === -1 ? 1 : 0);
    setVotingMessageId(entry.id);
    setError("");
    setMessage("");
    setMessages((current) =>
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
      setMessages((current) =>
        updateMessageVote(current, result.messageId, (currentEntry) => ({
          ...currentEntry,
          myVote: result.myVote,
          likeCount: result.likeCount,
          dislikeCount: result.dislikeCount
        }))
      );
    } catch (voteError) {
      setMessages(previousMessages);
      setError(voteError instanceof Error ? voteError.message : "留言投票失敗");
    } finally {
      setVotingMessageId(null);
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
                <div className="feedback-identity" aria-label="留言顯示方式">
                  <button
                    type="button"
                    onClick={() => setIsAnonymous(true)}
                    className={isAnonymous ? "is-selected" : ""}
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
                  <span>{messages.length} 則</span>
                </div>
                <button
                  type="button"
                  onClick={() => void refreshMessages({ fresh: true })}
                  disabled={refreshing}
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

              <div className="feedback-thread">
                {loading ? (
                  <FeedbackSkeleton />
                ) : messages.length === 0 ? (
                  <div className="feedback-empty">
                    還沒有留言，你可以成為第一個給建議的人。
                  </div>
                ) : (
                  messages.map((entry) => (
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
                      disabled={votingMessageId === entry.id}
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
                              disabled={votingMessageId === reply.id}
                              onVote={(target, vote) => void handleVote(target, vote)}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                    </article>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
