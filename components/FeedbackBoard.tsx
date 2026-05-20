"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { createFeedbackMessage, loadFeedbackMessages } from "@/lib/cloudSync";
import type { FeedbackMessage } from "@/types/quiz";

function formatCreatedAt(value: string) {
  return new Date(value).toLocaleString("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function FeedbackBoard() {
  const { configured, user } = useAuth();
  const [messages, setMessages] = useState<FeedbackMessage[]>([]);
  const [content, setContent] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

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

      try {
        const rows = await loadFeedbackMessages();
        setMessages(rows);
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : "留言板載入失敗");
      } finally {
        setLoading(false);
      }
    }

    void fetchMessages();
  }, [configured]);

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
      setMessages((current) => [created, ...current].slice(0, 40));
      setContent("");
      setMessage("留言已送出，謝謝你的建議。");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "留言送出失敗");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">Feedback Board</p>
          <h2 className="mt-2 text-2xl font-semibold text-ink">網站改進留言板</h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            大家可以匿名留言，也可以用登入帳號的暱稱留下想改進的地方。
          </p>
        </div>
        <div className="rounded-3xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
          最新 <span className="font-semibold text-ink">{messages.length}</span> 則留言
        </div>
      </div>

      {!configured ? (
        <div className="mt-5 rounded-3xl bg-slate-50 p-4 text-sm text-slate-600">
          目前尚未設定 Supabase，留言板暫時無法使用。
        </div>
      ) : (
        <>
          <div className="mt-5 rounded-3xl bg-slate-50 p-4">
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
              <div className="mb-4 rounded-2xl bg-white px-4 py-3 text-sm text-slate-600 ring-1 ring-slate-200">
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
                className="min-h-11 rounded-2xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
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

          <div className="mt-5 space-y-3">
            {loading ? (
              <div className="rounded-3xl bg-slate-50 p-4 text-sm text-slate-600">正在載入留言...</div>
            ) : messages.length === 0 ? (
              <div className="rounded-3xl bg-slate-50 p-4 text-sm text-slate-600">
                還沒有留言，你可以成為第一個給建議的人。
              </div>
            ) : (
              messages.map((entry) => (
                <article key={entry.id} className="rounded-3xl bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-ink">
                        {entry.isAnonymous ? "匿名使用者" : entry.displayName || "已登入使用者"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">{formatCreatedAt(entry.createdAt)}</p>
                    </div>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">{entry.content}</p>
                </article>
              ))
            )}
          </div>
        </>
      )}
    </section>
  );
}
