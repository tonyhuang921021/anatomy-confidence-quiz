"use client";

import { useEffect, useMemo, useState } from "react";
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
    <div className="mt-5 rounded-3xl border border-emerald-100 bg-emerald-50/70 px-4 py-3 text-sm leading-6 text-emerald-950">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-700">
          Pinned
        </span>
        <span className="font-semibold">{text}</span>
      </div>
      <p className="mt-1 text-xs leading-5 text-emerald-800/80">
        小小透明一下，AI 詳解能穩穩開著就好，大家照自己的節奏用。
      </p>
    </div>
  );
}

function FeedbackSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="home-skeleton-card p-4">
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
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onVote(entry, 1)}
        disabled={disabled}
        aria-pressed={likeActive}
        className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition disabled:cursor-not-allowed disabled:opacity-60 ${
          likeActive
            ? "bg-emerald-600 text-white ring-emerald-600"
            : "bg-white text-slate-600 ring-slate-200 hover:bg-emerald-50 hover:text-emerald-700"
        }`}
      >
        讚 {entry.likeCount ?? 0}
      </button>
      <button
        type="button"
        onClick={() => onVote(entry, -1)}
        disabled={disabled}
        aria-pressed={dislikeActive}
        className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition disabled:cursor-not-allowed disabled:opacity-60 ${
          dislikeActive
            ? "bg-rose-600 text-white ring-rose-600"
            : "bg-white text-slate-600 ring-slate-200 hover:bg-rose-50 hover:text-rose-700"
        }`}
      >
        倒讚 {entry.dislikeCount ?? 0}
      </button>
    </div>
  );
}

export function FeedbackBoard() {
  const { configured, user } = useAuth();
  const [messages, setMessages] = useState<FeedbackMessage[]>([]);
  const [budget, setBudget] = useState<OpenAIBudgetStatus | null>(null);
  const [content, setContent] = useState("");
  const [replyTargetId, setReplyTargetId] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [votingMessageId, setVotingMessageId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [readNotice, setReadNotice] = useState("");

  const nickname = useMemo(() => {
    const displayName =
      typeof user?.user_metadata?.display_name === "string" ? user.user_metadata.display_name.trim() : "";
    if (displayName) return displayName.slice(0, 24);
    if (user?.email) return user.email.split("@")[0].slice(0, 24);
    return "";
  }, [user]);

  useEffect(() => {
    async function fetchMessages() {
      if (!configured) {
        setLoading(false);
        return;
      }

      const cachedRows = loadCachedFeedbackMessages();
      if (cachedRows.length > 0) {
        setMessages(cachedRows);
        setLoading(false);
        setReadNotice("留言正在更新，先顯示稍早資料。");
      }

      try {
        const result = await loadFeedbackMessagesResult();
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
        setReadNotice(fetchError instanceof Error ? fetchError.message : "留言稍後更新，先顯示稍早資料。");
      } finally {
        setLoading(false);
      }
    }

    void fetchMessages();
  }, [configured]);

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
    setMessage("");

    try {
      const created = await createFeedbackMessage({
        content,
        isAnonymous: !user || isAnonymous,
        user
      });
      setMessages((current) => {
        const next = [created, ...current].slice(0, 40);
        saveCachedFeedbackMessages(next);
        return next;
      });
      setContent("");
      setMessage("留言已送出，謝謝你的建議。");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "留言送出失敗");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReply(parentId: string) {
    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      const created = await createFeedbackMessage({
        content: replyContent,
        isAnonymous: !user || isAnonymous,
        user,
        parentId
      });
      setMessages((current) => {
        const next = current.map((entry) =>
          entry.id === parentId
            ? {
                ...entry,
                replies: [...(entry.replies ?? []), created]
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
    <section className="surface-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow">Board</p>
          <h2 className="display-title mt-2 text-3xl">留言板</h2>
        </div>
        <div className="surface-card-muted px-4 py-3 text-sm body-soft">
          最新 {messages.length} 則
        </div>
      </div>

      {!configured ? (
        <div className="surface-card-muted mt-5 p-4 text-sm body-soft">
          目前尚未設定 Supabase，留言板暫時無法使用。
        </div>
      ) : (
        <>
          {budget ? <BudgetPinnedMessage budget={budget} /> : null}

          <div className="surface-card-muted mt-5 p-4">
            {user ? (
              <div className="mb-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setIsAnonymous(true)}
                  className={`min-h-11 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                    isAnonymous
                      ? "bg-slate-900 text-white"
                      : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                  }`}
                >
                  匿名留言
                </button>
                <button
                  type="button"
                  onClick={() => setIsAnonymous(false)}
                  className={`min-h-11 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                    !isAnonymous
                      ? "bg-brand-600 text-white"
                      : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                  }`}
                >
                  用暱稱留言{nickname ? `（${nickname}）` : ""}
                </button>
              </div>
            ) : (
              <div className="surface-card-muted mb-4 px-4 py-3 text-sm body-soft">
                目前未登入，送出後會以匿名顯示。
              </div>
            )}

            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              maxLength={1200}
              placeholder="例如：哪個頁面不夠順、哪種排版不舒服、還想新增什麼功能。"
              className="min-h-32 w-full rounded-3xl border border-slate-200 bg-white p-4 text-sm leading-7 text-slate-800 outline-none"
            />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-slate-500">{content.length} / 1200</p>
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={submitting || !content.trim()}
                className="primary-pill min-h-11 px-4 py-3 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {submitting ? "送出中..." : "送出留言"}
              </button>
            </div>

            {message ? (
              <div className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900">{message}</div>
            ) : null}
            {error ? (
              <div className="mt-4 rounded-2xl bg-rose-50 p-4 text-sm text-rose-900">{error}</div>
            ) : null}
          </div>

          {readNotice ? (
            <div className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
              {readNotice}
            </div>
          ) : null}

          <div className="mt-5 max-h-[32rem] space-y-3 overflow-y-auto pr-1 sm:max-h-[36rem]">
            {loading ? (
              <FeedbackSkeleton />
            ) : messages.length === 0 ? (
              <div className="surface-card-muted p-4 text-sm body-soft">
                還沒有留言，你可以成為第一個給建議的人。
              </div>
            ) : (
              messages.map((entry) => (
                <article key={entry.id} className="surface-card-muted p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-ink">
                        {entry.isAnonymous ? "匿名使用者" : entry.displayName || "已登入使用者"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">{formatCreatedAt(entry.createdAt)}</p>
                    </div>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">{entry.content}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
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
                      className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-100"
                    >
                      {replyTargetId === entry.id ? "收起回覆" : "回覆"}
                    </button>
                    {(entry.replies?.length ?? 0) > 0 ? (
                      <span className="text-xs text-slate-500">{entry.replies?.length} 則回覆</span>
                    ) : null}
                  </div>

                  {replyTargetId === entry.id ? (
                    <div className="mt-3 rounded-2xl bg-white p-3 ring-1 ring-slate-200">
                      <textarea
                        value={replyContent}
                        onChange={(event) => setReplyContent(event.target.value)}
                        maxLength={800}
                        placeholder="回覆這則留言..."
                        className="min-h-24 w-full rounded-2xl border border-slate-200 bg-white p-3 text-sm leading-7 text-slate-800 outline-none"
                      />
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <p className="text-xs text-slate-500">{replyContent.length} / 800</p>
                        <button
                          type="button"
                          onClick={() => void handleReply(entry.id)}
                          disabled={submitting || !replyContent.trim()}
                          className="min-h-10 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                        >
                          {submitting ? "送出中..." : "送出回覆"}
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {(entry.replies?.length ?? 0) > 0 ? (
                    <div className="mt-4 space-y-2 border-l border-slate-200 pl-3">
                      {entry.replies?.map((reply) => (
                        <div key={reply.id} className="rounded-2xl bg-white px-3 py-3 ring-1 ring-slate-200">
                          <p className="text-sm font-semibold text-ink">
                            {reply.isAnonymous ? "匿名使用者" : reply.displayName || "已登入使用者"}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">{formatCreatedAt(reply.createdAt)}</p>
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                            {reply.content}
                          </p>
                          <div className="mt-3">
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
        </>
      )}
    </section>
  );
}
