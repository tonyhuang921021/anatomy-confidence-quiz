"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";

type QuestionSummary = {
  id: string;
  subject: string;
  chapter: string;
  section: string;
  stem: string;
  testedConcept: string;
  sourceYear?: number;
  examCode?: string;
  questionNumber?: number;
};

type SuggestionEntry = {
  id: string;
  questionId: string;
  suggestionType: string;
  payload: Record<string, unknown>;
  model?: string;
  status: string;
  confidence?: number;
  createdAt: string;
};

type InspectPayload = {
  ok: boolean;
  message?: string;
  question?: QuestionSummary;
  questionDetail?: {
    id: string;
    chapter: string;
    section: string;
    stem: string;
    testedConcept: string;
    explanation: string;
    clinicalLink?: string;
  };
  candidates?: QuestionSummary[];
  suggestions?: SuggestionEntry[];
  generated?: {
    tags: Array<{ tag: string; tagType: string; confidence?: number }>;
    relations: Array<{
      targetQuestionId: string;
      relationType: string;
      confidence?: number;
      reason?: string;
    }>;
    model: string;
    usage: {
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
    };
  };
};

function getAllowedEmails() {
  const raw = process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "";
  return raw
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function isAllowedEmail(email?: string | null) {
  if (!email) return false;
  return getAllowedEmails().includes(email.trim().toLowerCase());
}

function formatSuggestionLabel(entry: SuggestionEntry) {
  if (entry.suggestionType === "tag") {
    const tag = typeof entry.payload.tag === "string" ? entry.payload.tag : "";
    const tagType = typeof entry.payload.tag_type === "string" ? entry.payload.tag_type : "";
    return `${tagType} · ${tag}`;
  }

  if (entry.suggestionType === "relation") {
    const relationType =
      typeof entry.payload.relation_type === "string" ? entry.payload.relation_type : "";
    const targetQuestionId =
      typeof entry.payload.target_question_id === "string" ? entry.payload.target_question_id : "";
    return `${relationType} · ${targetQuestionId}`;
  }

  return entry.suggestionType;
}

export default function OwnerQuestionManagementPage() {
  const { configured, loading, session, user } = useAuth();
  const [query, setQuery] = useState("視覺路徑");
  const [items, setItems] = useState<QuestionSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [selectedQuestionId, setSelectedQuestionId] = useState("");
  const [inspectState, setInspectState] = useState<InspectPayload | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const allowed = useMemo(() => isAllowedEmail(user?.email), [user?.email]);
  const hasAllowlist = getAllowedEmails().length > 0;

  async function postJson(body: Record<string, unknown>) {
    const response = await fetch("/api/owner/question-management", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    const payload = (await response.json().catch(() => null)) as InspectPayload | null;
    if (!response.ok || !payload?.ok) {
      throw new Error(payload?.message || "題庫管理操作失敗");
    }

    return payload;
  }

  async function loadSearch() {
    if (!session?.access_token) return;

    try {
      setSearchLoading(true);
      setError("");
      const payload = await postJson({
        accessToken: session.access_token,
        action: "search_questions",
        query,
        page: 1,
        pageSize: 24
      });
      const nextItems = (payload as { items?: QuestionSummary[]; total?: number }).items ?? [];
      setItems(nextItems);
      setTotal((payload as { total?: number }).total ?? 0);

      if (nextItems.length > 0) {
        setSelectedQuestionId((current) =>
          current && nextItems.some((item) => item.id === current) ? current : nextItems[0].id
        );
      } else {
        setSelectedQuestionId("");
        setInspectState(null);
      }
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "查題失敗");
    } finally {
      setSearchLoading(false);
    }
  }

  async function inspectQuestion(questionId: string) {
    if (!session?.access_token || !questionId) return;

    try {
      setDetailLoading(true);
      setError("");
      const payload = await postJson({
        accessToken: session.access_token,
        action: "inspect_question",
        questionId
      });
      setInspectState(payload);
    } catch (inspectError) {
      setError(inspectError instanceof Error ? inspectError.message : "載入題目詳情失敗");
    } finally {
      setDetailLoading(false);
    }
  }

  async function generateSuggestions() {
    if (!session?.access_token || !selectedQuestionId) return;

    try {
      setActionLoadingId("generate");
      setError("");
      const payload = await postJson({
        accessToken: session.access_token,
        action: "generate_neuro_suggestions",
        questionId: selectedQuestionId
      });

      setInspectState((current) =>
        current
          ? {
              ...current,
              generated: payload.generated,
              suggestions: [...(payload.suggestions ?? []), ...(current.suggestions ?? [])]
            }
          : payload
      );
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : "生成 AI 建議失敗");
    } finally {
      setActionLoadingId(null);
    }
  }

  async function updateSuggestion(suggestionId: string, action: "apply_suggestion" | "reject_suggestion") {
    if (!session?.access_token || !selectedQuestionId) return;

    try {
      setActionLoadingId(suggestionId);
      setError("");
      await postJson({
        accessToken: session.access_token,
        action,
        questionId: selectedQuestionId,
        suggestionId
      });

      setInspectState((current) =>
        current
          ? {
              ...current,
              suggestions: (current.suggestions ?? []).map((entry) =>
                entry.id === suggestionId
                  ? {
                      ...entry,
                      status: action === "apply_suggestion" ? "approved" : "rejected"
                    }
                  : entry
              )
            }
          : current
      );
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "更新建議失敗");
    } finally {
      setActionLoadingId(null);
    }
  }

  useEffect(() => {
    if (!configured || !user || !allowed || !session?.access_token) return;
    void loadSearch();
  }, [allowed, configured, session?.access_token, user]);

  useEffect(() => {
    if (!configured || !user || !allowed || !session?.access_token || !selectedQuestionId) return;
    void inspectQuestion(selectedQuestionId);
  }, [allowed, configured, selectedQuestionId, session?.access_token, user]);

  return (
    <main className="shell">
      <section className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">Question Management</p>
            <h1 className="mt-2 text-3xl font-bold text-ink sm:text-4xl">神經解剖題庫管理台</h1>
            <p className="mt-3 max-w-3xl text-slate-500">
              先從神經解剖正式考古題開始。這裡可以查題、看候選題、生成 AI 候選 tag / relation，再決定哪些正式採用。
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/owner"
              className="min-h-12 rounded-2xl bg-slate-100 px-5 py-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-200"
            >
              返回私有數據頁
            </Link>
            <Link
              href="/"
              className="min-h-12 rounded-2xl bg-brand-700 px-5 py-4 text-sm font-semibold text-white transition hover:bg-brand-800"
            >
              返回首頁
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-8">
        {!configured ? (
          <div className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100">請先完成 Supabase 設定。</div>
        ) : loading ? (
          <div className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100">正在確認登入狀態...</div>
        ) : !user ? (
          <div className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100">請先登入你的帳號。</div>
        ) : !hasAllowlist ? (
          <div className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100">
            請先設定 `NEXT_PUBLIC_ADMIN_EMAILS`。
          </div>
        ) : !allowed ? (
          <div className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100">你目前沒有題庫管理權限。</div>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
            <aside className="rounded-[2rem] bg-white p-5 shadow-card ring-1 ring-slate-100">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-ink">查神經解剖題</h2>
                  <p className="mt-2 text-sm text-slate-500">先從常見區塊搜，例如：視覺路徑、腦神經、內囊、丘腦。</p>
                </div>
                <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
                  {total} 題
                </span>
              </div>
              <div className="mt-4 flex gap-3">
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="輸入關鍵字"
                  className="min-h-12 flex-1 rounded-2xl border border-slate-200 px-4 text-sm outline-none transition focus:border-brand-400"
                />
                <button
                  type="button"
                  onClick={() => void loadSearch()}
                  className="min-h-12 rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-700"
                >
                  {searchLoading ? "查詢中..." : "查題"}
                </button>
              </div>
              <div className="mt-4 max-h-[70vh] space-y-3 overflow-y-auto pr-1">
                {items.map((item) => {
                  const active = item.id === selectedQuestionId;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedQuestionId(item.id)}
                      className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                        active
                          ? "border-brand-300 bg-brand-50/70"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex flex-wrap gap-2 text-[11px] font-semibold text-slate-500">
                        <span>{item.chapter}</span>
                        <span>／</span>
                        <span>{item.section}</span>
                        {item.sourceYear ? <span>／ {item.sourceYear}</span> : null}
                      </div>
                      <p className="mt-2 line-clamp-3 text-sm font-semibold text-ink">{item.stem}</p>
                      <p className="mt-2 line-clamp-2 text-xs text-slate-500">{item.testedConcept}</p>
                    </button>
                  );
                })}
                {!searchLoading && items.length === 0 ? (
                  <div className="rounded-2xl bg-slate-50 px-4 py-6 text-sm text-slate-500">目前找不到符合的神經解剖題。</div>
                ) : null}
              </div>
            </aside>

            <section className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100">
              {error ? <div className="mb-5 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
              {detailLoading && !inspectState ? (
                <div className="rounded-2xl bg-slate-50 px-4 py-6 text-sm text-slate-500">載入題目詳情中...</div>
              ) : inspectState?.questionDetail ? (
                <div className="space-y-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-500">
                        <span>{inspectState.questionDetail.chapter}</span>
                        <span>／</span>
                        <span>{inspectState.questionDetail.section}</span>
                      </div>
                      <h2 className="mt-3 text-2xl font-bold text-ink">{inspectState.questionDetail.stem}</h2>
                      <p className="mt-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                        <span className="font-semibold text-slate-900">考點：</span>{" "}
                        {inspectState.questionDetail.testedConcept}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void generateSuggestions()}
                      className="min-h-12 rounded-2xl bg-brand-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-800"
                    >
                      {actionLoadingId === "generate" ? "AI 生成中..." : "生成神經解剖候選連結"}
                    </button>
                  </div>

                  <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_360px]">
                    <article className="rounded-3xl bg-slate-50 p-5">
                      <h3 className="text-lg font-semibold text-ink">題目說明</h3>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                        {inspectState.questionDetail.explanation}
                      </p>
                      {inspectState.questionDetail.clinicalLink ? (
                        <p className="mt-4 rounded-2xl bg-white px-4 py-3 text-sm text-slate-700 ring-1 ring-slate-100">
                          <span className="font-semibold text-slate-900">臨床連結：</span>{" "}
                          {inspectState.questionDetail.clinicalLink}
                        </p>
                      ) : null}
                    </article>

                    <article className="rounded-3xl bg-slate-50 p-5">
                      <h3 className="text-lg font-semibold text-ink">候選題縮圈</h3>
                      <p className="mt-2 text-sm text-slate-500">這批是先用同 section / 相近考點縮到 20 題，再交給 AI 判斷。</p>
                      <div className="mt-4 space-y-3">
                        {(inspectState.candidates ?? []).map((candidate) => (
                          <div key={candidate.id} className="rounded-2xl bg-white px-4 py-4 ring-1 ring-slate-100">
                            <div className="text-[11px] font-semibold text-slate-500">
                              {candidate.section} · {candidate.sourceYear ?? "?"}
                            </div>
                            <p className="mt-2 line-clamp-2 text-sm font-semibold text-ink">{candidate.stem}</p>
                            <p className="mt-2 line-clamp-2 text-xs text-slate-500">{candidate.testedConcept}</p>
                          </div>
                        ))}
                      </div>
                    </article>
                  </div>

                  {inspectState.generated ? (
                    <article className="rounded-3xl bg-brand-50 p-5 ring-1 ring-brand-100">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <h3 className="text-lg font-semibold text-brand-900">這次 AI 剛生成的候選</h3>
                        <p className="text-xs font-semibold text-brand-700">
                          {inspectState.generated.model} · {inspectState.generated.usage.totalTokens.toLocaleString()} tokens
                        </p>
                      </div>
                      <div className="mt-4 grid gap-4 lg:grid-cols-2">
                        <div className="rounded-2xl bg-white px-4 py-4">
                          <p className="text-sm font-semibold text-ink">Tags</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {inspectState.generated.tags.map((tag) => (
                              <span key={`${tag.tagType}-${tag.tag}`} className="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">
                                {tag.tagType} · {tag.tag}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="rounded-2xl bg-white px-4 py-4">
                          <p className="text-sm font-semibold text-ink">Relations</p>
                          <div className="mt-3 space-y-2 text-sm text-slate-700">
                            {inspectState.generated.relations.map((relation) => (
                              <div key={`${relation.relationType}-${relation.targetQuestionId}`} className="rounded-xl bg-slate-50 px-3 py-3">
                                <p className="font-semibold text-slate-900">
                                  {relation.relationType} · {relation.targetQuestionId}
                                </p>
                                {relation.reason ? <p className="mt-1 text-xs text-slate-600">{relation.reason}</p> : null}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </article>
                  ) : null}

                  <article className="rounded-3xl bg-white ring-1 ring-slate-100">
                    <div className="border-b border-slate-100 px-5 py-4">
                      <h3 className="text-lg font-semibold text-ink">已存進資料庫的 AI 建議</h3>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {(inspectState.suggestions ?? []).map((entry) => (
                        <div key={entry.id} className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
                              <span>{entry.suggestionType}</span>
                              <span>·</span>
                              <span>{entry.status}</span>
                              {typeof entry.confidence === "number" ? <span>· {entry.confidence.toFixed(2)}</span> : null}
                            </div>
                            <p className="mt-2 text-sm font-semibold text-ink">{formatSuggestionLabel(entry)}</p>
                            {"reason" in entry.payload && typeof entry.payload.reason === "string" && entry.payload.reason ? (
                              <p className="mt-1 text-xs text-slate-500">{entry.payload.reason}</p>
                            ) : null}
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              disabled={entry.status !== "pending" || actionLoadingId === entry.id}
                              onClick={() => void updateSuggestion(entry.id, "apply_suggestion")}
                              className="min-h-11 rounded-2xl bg-brand-700 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
                            >
                              {actionLoadingId === entry.id ? "處理中..." : "套用"}
                            </button>
                            <button
                              type="button"
                              disabled={entry.status !== "pending" || actionLoadingId === entry.id}
                              onClick={() => void updateSuggestion(entry.id, "reject_suggestion")}
                              className="min-h-11 rounded-2xl bg-slate-100 px-4 text-sm font-semibold text-slate-800 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                            >
                              退回
                            </button>
                          </div>
                        </div>
                      ))}
                      {(inspectState.suggestions ?? []).length === 0 ? (
                        <div className="px-5 py-8 text-sm text-slate-500">這題目前還沒有 AI 建議。你可以先按上面的生成按鈕。</div>
                      ) : null}
                    </div>
                  </article>
                </div>
              ) : (
                <div className="rounded-2xl bg-slate-50 px-4 py-6 text-sm text-slate-500">先從左邊選一題神經解剖題。</div>
              )}
            </section>
          </div>
        )}
      </section>
    </main>
  );
}
