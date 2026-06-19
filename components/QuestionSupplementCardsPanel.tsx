"use client";

import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { useAuth } from "@/components/AuthProvider";
import {
  loadQuestionSupplementCards,
  toggleQuestionSupplementReaction,
  uploadQuestionSupplementImage,
  upsertQuestionSupplementCard,
  voteQuestionSupplementCard
} from "@/lib/questionSupplementCards";
import type {
  Question,
  QuestionSupplementCard,
  QuestionSupplementCardVote,
  QuestionSupplementReactionSummary
} from "@/types/quiz";

type QuestionSupplementCardsPanelProps = {
  question: Question;
  compact?: boolean;
  onCountChange?: (count: number) => void;
};

function formatUpdatedAt(value: string) {
  return new Date(value).toLocaleString("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getImageUrlsFromMarkdown(markdown: string) {
  const urls: string[] = [];
  const imagePattern = /!\[[^\]]*]\(([^)]+)\)/g;
  let match = imagePattern.exec(markdown);
  while (match) {
    const url = match[1]?.trim();
    if (url) urls.push(url);
    match = imagePattern.exec(markdown);
  }
  return Array.from(new Set(urls)).slice(0, 8);
}

function SupplementMarkdown({ markdown }: { markdown: string }) {
  return (
    <div className="note-markdown text-sm leading-7 text-slate-700">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
        {markdown}
      </ReactMarkdown>
    </div>
  );
}

export function QuestionSupplementCardsPanel({
  question,
  compact = false,
  onCountChange
}: QuestionSupplementCardsPanelProps) {
  const { session } = useAuth();
  const [cards, setCards] = useState<QuestionSupplementCard[]>([]);
  const [reactions, setReactions] = useState<QuestionSupplementReactionSummary[]>([]);
  const [draftMarkdown, setDraftMarkdown] = useState("");
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [votingCardId, setVotingCardId] = useState<string | null>(null);
  const [reactionLoading, setReactionLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const ownCard = useMemo(() => cards.find((card) => card.isMine), [cards]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    loadQuestionSupplementCards(question.id, session?.access_token)
      .then((payload) => {
        if (cancelled) return;
        setCards(payload.cards);
        setReactions(payload.reactions);
        onCountChange?.(payload.cards.length);
      })
      .catch((rawError) => {
        if (!cancelled) setError(rawError instanceof Error ? rawError.message : "補充卡片載入失敗");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [onCountChange, question.id, session?.access_token]);

  function beginEdit() {
    if (!session?.access_token) {
      setError("請先登入，才能新增補充卡片。");
      setMessage("");
      return;
    }
    setDraftMarkdown(ownCard?.contentMarkdown ?? "");
    setEditing(true);
    setError("");
    setMessage("");
  }

  async function handleSave() {
    if (!session?.access_token) {
      setError("請先登入，才能儲存補充卡片。");
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const payload = await upsertQuestionSupplementCard({
        question,
        accessToken: session.access_token,
        contentMarkdown: draftMarkdown,
        attachmentUrls: getImageUrlsFromMarkdown(draftMarkdown)
      });
      setCards(payload.cards ?? []);
      setReactions(payload.reactions ?? []);
      onCountChange?.(payload.cards?.length ?? 0);
      setEditing(false);
      setMessage("補充卡片已儲存，這題的旁門左道又多一點光。");
    } catch (rawError) {
      setError(rawError instanceof Error ? rawError.message : "補充卡片儲存失敗");
    } finally {
      setSaving(false);
    }
  }

  async function handleUploadImage(file?: File | null) {
    if (!file) return;
    if (!session?.access_token) {
      setError("請先登入，才能上傳圖片。");
      return;
    }
    setUploading(true);
    setError("");
    try {
      const url = await uploadQuestionSupplementImage({
        questionId: question.id,
        accessToken: session.access_token,
        file
      });
      setDraftMarkdown((current) => `${current.trimEnd()}\n\n![補充圖片](${url})\n`);
      setMessage("圖片已插入補充卡片。");
    } catch (rawError) {
      setError(rawError instanceof Error ? rawError.message : "圖片上傳失敗");
    } finally {
      setUploading(false);
    }
  }

  async function handleVote(card: QuestionSupplementCard, vote: QuestionSupplementCardVote) {
    if (!session?.access_token) {
      setError("請先登入，才能評價補充卡片。");
      return;
    }
    setVotingCardId(card.id);
    setError("");
    try {
      const payload = await voteQuestionSupplementCard({
        cardId: card.id,
        vote: card.myVote === vote ? null : vote,
        accessToken: session.access_token
      });
      setCards(payload.cards ?? []);
      setReactions(payload.reactions ?? []);
      onCountChange?.(payload.cards?.length ?? 0);
    } catch (rawError) {
      setError(rawError instanceof Error ? rawError.message : "補充卡片評價失敗");
    } finally {
      setVotingCardId(null);
    }
  }

  async function handleToggleReaction() {
    if (!session?.access_token) {
      setError("請先登入，才能標記這題。");
      return;
    }
    setReactionLoading(true);
    setError("");
    try {
      const payload = await toggleQuestionSupplementReaction({
        question,
        reactionType: "pure_chaos",
        accessToken: session.access_token
      });
      setCards(payload.cards ?? []);
      setReactions(payload.reactions ?? []);
      onCountChange?.(payload.cards?.length ?? 0);
    } catch (rawError) {
      setError(rawError instanceof Error ? rawError.message : "題目標記失敗");
    } finally {
      setReactionLoading(false);
    }
  }

  const pureChaosReaction = reactions.find((reaction) => reaction.type === "pure_chaos") ?? {
    type: "pure_chaos" as const,
    label: "這題純搞",
    count: 0,
    active: false
  };

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/70 p-3 ring-1 ring-slate-100">
        <div>
          <p className="text-sm font-black text-slate-950">同學補充卡片</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            每人每題一張，可補陽明和 AI 都沒講清楚的地方。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void handleToggleReaction()}
            disabled={reactionLoading}
            aria-pressed={pureChaosReaction.active}
            className={`rounded-full px-3 py-1.5 text-xs font-black ring-1 transition disabled:cursor-wait disabled:opacity-60 ${
              pureChaosReaction.active
                ? "bg-rose-600 text-white ring-rose-600"
                : "bg-rose-50 text-rose-800 ring-rose-100 hover:bg-rose-100"
            }`}
          >
            {pureChaosReaction.label} {pureChaosReaction.count}
          </button>
          <button
            type="button"
            onClick={beginEdit}
            className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-black text-white transition hover:bg-black"
          >
            {ownCard ? "編輯我的補充" : "新增補充"}
          </button>
        </div>
      </div>

      {loading ? <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">正在載入同學補充...</p> : null}
      {error ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p> : null}
      {message ? <p className="rounded-2xl bg-teal-50 px-4 py-3 text-sm font-semibold text-teal-800">{message}</p> : null}

      {editing ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-4">
          <label className="grid gap-2 text-sm font-bold text-slate-700">
            我的補充
            <textarea
              value={draftMarkdown}
              onChange={(event) => setDraftMarkdown(event.target.value)}
              rows={compact ? 7 : 10}
              className="min-h-44 rounded-2xl border border-slate-200 bg-white px-4 py-3 font-mono text-sm leading-6 outline-none focus:border-teal-400 focus:ring-4 focus:ring-teal-50"
              placeholder="可以貼自己查到的資料、表格、記憶法，或補充這題為什麼根本純搞。支援 Markdown。"
            />
          </label>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <label className="inline-flex cursor-pointer items-center rounded-full bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-200">
              {uploading ? "圖片上傳中..." : "上傳圖片"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                disabled={uploading}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.currentTarget.value = "";
                  void handleUploadImage(file);
                }}
              />
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEditing(false)}
                disabled={saving}
                className="rounded-full bg-slate-100 px-4 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-200 disabled:opacity-60"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className="rounded-full bg-teal-600 px-4 py-2 text-xs font-black text-white transition hover:bg-teal-700 disabled:cursor-wait disabled:opacity-60"
              >
                {saving ? "儲存中..." : "儲存補充"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {!loading && cards.length === 0 && !editing ? (
        <p className="rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-500">
          目前還沒有補充卡片。這題如果陽明和 AI 都講得像謎語，可以當第一個救火的人。
        </p>
      ) : null}

      <div className="grid gap-3">
        {cards.map((card) => (
          <article key={card.id} className="rounded-3xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-black text-slate-950">{card.authorLabel}</p>
                  {card.isMine ? <span className="stat-chip">我的補充</span> : null}
                  {card.problematicCount >= 2 && card.problematicCount > card.helpfulCount ? (
                    <span className="rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700 ring-1 ring-rose-100">
                      多人標記有問題
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-slate-500">更新 {formatUpdatedAt(card.updatedAt)}</p>
              </div>
              {card.isMine ? (
                <button type="button" onClick={beginEdit} className="secondary-pill px-3 py-1.5 text-xs">
                  編輯
                </button>
              ) : null}
            </div>
            <div className="mt-3">
              <SupplementMarkdown markdown={card.contentMarkdown} />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void handleVote(card, "helpful")}
                disabled={votingCardId === card.id}
                aria-pressed={card.myVote === "helpful"}
                className={`rounded-full px-3 py-1.5 text-xs font-bold ring-1 transition disabled:cursor-wait disabled:opacity-60 ${
                  card.myVote === "helpful"
                    ? "bg-emerald-600 text-white ring-emerald-600"
                    : "bg-emerald-50 text-emerald-800 ring-emerald-100 hover:bg-emerald-100"
                }`}
              >
                有幫助 {card.helpfulCount}
              </button>
              <button
                type="button"
                onClick={() => void handleVote(card, "problematic")}
                disabled={votingCardId === card.id}
                aria-pressed={card.myVote === "problematic"}
                className={`rounded-full px-3 py-1.5 text-xs font-bold ring-1 transition disabled:cursor-wait disabled:opacity-60 ${
                  card.myVote === "problematic"
                    ? "bg-rose-600 text-white ring-rose-600"
                    : "bg-rose-50 text-rose-800 ring-rose-100 hover:bg-rose-100"
                }`}
              >
                有問題 {card.problematicCount}
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
