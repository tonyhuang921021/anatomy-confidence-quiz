"use client";

import type {
  Question,
  QuestionSupplementCard,
  QuestionSupplementCardVote,
  QuestionSupplementReactionSummary,
  RecentQuestionSupplementCard
} from "@/types/quiz";

type QuestionSupplementResponse = {
  ok?: boolean;
  message?: string;
  count?: number;
  cards?: QuestionSupplementCard[];
  reactions?: QuestionSupplementReactionSummary[];
};

async function parseSupplementResponse<T>(response: Response): Promise<T> {
  const rawText = await response.text();
  const payload = (rawText ? JSON.parse(rawText) : null) as (T & { ok?: boolean; message?: string }) | null;
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.message || rawText || "補充卡片操作失敗。");
  }
  return payload;
}

export async function loadQuestionSupplementCards(
  questionId: string,
  accessToken?: string | null
): Promise<Required<Pick<QuestionSupplementResponse, "cards" | "reactions">>> {
  const params = new URLSearchParams({ questionId });
  if (accessToken) params.set("accessToken", accessToken);
  const response = await fetch(`/api/question-supplement-cards?${params.toString()}`, {
    headers: { "Cache-Control": "no-store" }
  });
  const payload = await parseSupplementResponse<QuestionSupplementResponse>(response);
  return {
    cards: payload.cards ?? [],
    reactions: payload.reactions ?? []
  };
}

export async function loadQuestionSupplementCount(questionId: string): Promise<number> {
  const params = new URLSearchParams({ questionId, countOnly: "1" });
  const response = await fetch(`/api/question-supplement-cards?${params.toString()}`, {
    headers: { "Cache-Control": "no-store" }
  });
  const payload = await parseSupplementResponse<QuestionSupplementResponse>(response);
  return Math.max(0, payload.count ?? 0);
}

export async function loadQuestionSupplementMeta(
  questionId: string,
  accessToken?: string | null
): Promise<Required<Pick<QuestionSupplementResponse, "count" | "reactions">>> {
  const params = new URLSearchParams({ questionId, countOnly: "1", includeReactions: "1" });
  if (accessToken) params.set("accessToken", accessToken);
  const response = await fetch(`/api/question-supplement-cards?${params.toString()}`, {
    headers: { "Cache-Control": "no-store" }
  });
  const payload = await parseSupplementResponse<QuestionSupplementResponse>(response);
  return {
    count: Math.max(0, payload.count ?? 0),
    reactions: payload.reactions ?? []
  };
}

export async function loadRecentQuestionSupplementCards(
  accessToken?: string | null,
  limit = 12
): Promise<RecentQuestionSupplementCard[]> {
  const params = new URLSearchParams({ recent: "1", limit: String(limit) });
  if (accessToken) params.set("accessToken", accessToken);
  const response = await fetch(`/api/question-supplement-cards?${params.toString()}`, {
    headers: { "Cache-Control": "no-store" }
  });
  const payload = await parseSupplementResponse<{
    ok?: boolean;
    recentCards?: RecentQuestionSupplementCard[];
  }>(response);
  return payload.recentCards ?? [];
}

export async function upsertQuestionSupplementCard(input: {
  question: Question;
  accessToken?: string | null;
  contentMarkdown: string;
  attachmentUrls?: string[];
}) {
  const response = await fetch("/api/question-supplement-cards", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "upsert_card",
      accessToken: input.accessToken ?? null,
      question: {
        id: input.question.id,
        subject: input.question.subject,
        chapter: input.question.chapter,
        section: input.question.section,
        stem: input.question.stem
      },
      contentMarkdown: input.contentMarkdown,
      attachmentUrls: input.attachmentUrls ?? []
    })
  });
  return parseSupplementResponse<QuestionSupplementResponse>(response);
}

export async function voteQuestionSupplementCard(input: {
  cardId: string;
  vote: QuestionSupplementCardVote | null;
  accessToken?: string | null;
}) {
  const response = await fetch("/api/question-supplement-cards", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "vote_card",
      accessToken: input.accessToken ?? null,
      cardId: input.cardId,
      vote: input.vote
    })
  });
  return parseSupplementResponse<QuestionSupplementResponse>(response);
}

export async function toggleQuestionSupplementReaction(input: {
  question: Question;
  reactionType: "pure_chaos";
  accessToken?: string | null;
}) {
  const response = await fetch("/api/question-supplement-cards", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "toggle_reaction",
      accessToken: input.accessToken ?? null,
      question: {
        id: input.question.id,
        subject: input.question.subject,
        chapter: input.question.chapter,
        section: input.question.section,
        stem: input.question.stem
      },
      reactionType: input.reactionType
    })
  });
  return parseSupplementResponse<QuestionSupplementResponse>(response);
}

export async function uploadQuestionSupplementImage(input: {
  questionId: string;
  accessToken?: string | null;
  file: File;
}) {
  const formData = new FormData();
  formData.set("accessToken", input.accessToken ?? "");
  formData.set("questionId", input.questionId);
  formData.set("file", input.file);

  const response = await fetch("/api/question-supplement-cards/upload", {
    method: "POST",
    body: formData
  });
  const payload = await parseSupplementResponse<{ ok?: boolean; url?: string }>(response);
  if (!payload.url) throw new Error("圖片上傳後沒有取得網址。");
  return payload.url;
}
