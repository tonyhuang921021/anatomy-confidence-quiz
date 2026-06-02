"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { StudyNoteMarkdown } from "@/components/StudyNoteMarkdown";
import { getCanonicalQuestionBank } from "@/data/med1QuestionBank";
import { DEFAULT_QUIZ_SETTINGS } from "@/lib/quizAnalysis";
import { saveQuizSettings } from "@/lib/storage";
import { loadStudyNote } from "@/lib/studyNotes";
import type { Question, StudyNoteDetail } from "@/types/quiz";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-Hant", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export default function StudyNoteDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { configured, session, user } = useAuth();
  const [note, setNote] = useState<StudyNoteDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!configured || !session?.access_token || !params.id) {
      setNote(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError("");
    loadStudyNote(params.id, session.access_token)
      .then((nextNote) => {
        if (!cancelled) setNote(nextNote);
      })
      .catch((rawError) => {
        if (!cancelled) {
          setError(rawError instanceof Error ? rawError.message : "筆記載入失敗");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [configured, params.id, session?.access_token]);

  const questionMap = useMemo(
    () =>
      new Map(
        getCanonicalQuestionBank()
          .filter((question) => question.sourceType !== "AI_GENERATED")
          .map((question) => [question.id, question] as const)
      ),
    []
  );

  const relatedQuestions = useMemo(() => {
    if (!note) return [];
    return note.questionLinks
      .map((link) => ({
        link,
        question: questionMap.get(link.questionId)
      }))
      .filter((item): item is { link: typeof item.link; question: Question } => Boolean(item.question));
  }, [note, questionMap]);

  function startLinkedQuiz() {
    if (!note || relatedQuestions.length === 0) return;
    const questionIds = relatedQuestions.map((item) => item.question.id);
    saveQuizSettings({
      ...DEFAULT_QUIZ_SETTINGS,
      mode: "custom_paper",
      questionCount: questionIds.length,
      subjectFilter: note.subject ?? "全部",
      subjectFilters: note.subject ? [note.subject] : undefined,
      customQuestionIds: questionIds,
      customPoolLabel: `筆記：${note.title}`,
      customPaperName: note.title
    });
    router.push("/quiz?new=1");
  }

  return (
    <main className="shell">
      <section className="surface-card p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Study Note</p>
            <h1 className="display-title mt-3 text-4xl sm:text-5xl">
              {note?.title ?? "學習筆記"}
            </h1>
            {note?.summary ? <p className="body-soft mt-4 max-w-3xl leading-7">{note.summary}</p> : null}
          </div>
          <Link href="/notes" className="secondary-pill">
            回筆記庫
          </Link>
        </div>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <article className="surface-card min-w-0 p-5 sm:p-8">
          {!configured ? <p className="body-soft">Supabase 尚未設定，學習筆記需要雲端儲存才能使用。</p> : null}
          {configured && !user ? <p className="body-soft">請先登入，才能讀取自己的私人筆記。</p> : null}
          {loading ? <p className="body-soft">正在載入筆記...</p> : null}
          {error ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p> : null}
          {note ? <StudyNoteMarkdown markdown={note.rawMarkdown} /> : null}
        </article>

        <aside className="grid content-start gap-4">
          {note ? (
            <>
              <div className="surface-card p-5">
                <h2 className="text-lg font-bold text-slate-950">分類狀態</h2>
                <div className="mt-4 flex flex-wrap gap-2">
                  {note.collectionName ? <span className="stat-chip">{note.collectionName}</span> : null}
                  {note.subject ? <span className="stat-chip">{note.subject}</span> : null}
                  {note.chapter ? <span className="stat-chip">{note.chapter}</span> : null}
                  {note.section ? <span className="stat-chip">{note.section}</span> : null}
                  <span className="stat-chip">更新 {formatDate(note.updatedAt)}</span>
                </div>
              </div>

              <div className="surface-card p-5">
                <h2 className="text-lg font-bold text-slate-950">Tags</h2>
                {note.tags.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {note.tags.map((item) => (
                      <span key={`${item.tagType}-${item.tag}`} className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800">
                        #{item.tag}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="body-soft mt-3 text-sm">這篇還沒有 tags。</p>
                )}
              </div>

              <div className="surface-card p-5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-bold text-slate-950">相關題目</h2>
                  <span className="stat-chip">{relatedQuestions.length} 題</span>
                </div>
                {relatedQuestions.length > 0 ? (
                  <div className="mt-4 grid gap-3">
                    {relatedQuestions.map(({ link, question }) => (
                      <div key={`${question.id}-${link.relationType}`} className="rounded-2xl border border-slate-200 bg-white p-3 text-sm">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-slate-950">{question.id}</span>
                          <span className="stat-chip">{link.relationType}</span>
                          {typeof link.confidence === "number" ? <span className="stat-chip">{Math.round(link.confidence * 100)}%</span> : null}
                        </div>
                        <p className="mt-2 text-xs font-semibold text-slate-500">
                          {question.subject} / {question.chapter} / {question.section}
                        </p>
                        <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-700">{question.stem}</p>
                        {link.reason ? <p className="mt-2 rounded-2xl bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">{link.reason}</p> : null}
                        <Link
                          href={`/search?query=${encodeURIComponent(question.id)}`}
                          className="mt-3 inline-flex text-xs font-bold text-teal-700"
                        >
                          到題目搜尋查看
                        </Link>
                      </div>
                    ))}
                    <button type="button" onClick={startLinkedQuiz} className="primary-pill justify-center">
                      用相關題目建立自訂卷
                    </button>
                  </div>
                ) : (
                  <p className="body-soft mt-3 text-sm">這篇還沒有連到題目。之後可以用 metadata JSON 或新增頁先勾選。</p>
                )}
              </div>
            </>
          ) : null}
        </aside>
      </section>
    </main>
  );
}
