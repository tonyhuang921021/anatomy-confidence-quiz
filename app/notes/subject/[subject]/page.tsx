"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { StudyNoteMarkdown } from "@/components/StudyNoteMarkdown";
import { getCanonicalQuestionBank } from "@/data/med1QuestionBank";
import { subjectRegistry } from "@/data/subjectRegistry";
import { isAdminEmail } from "@/lib/adminAccess";
import { isNoteSubject } from "@/lib/noteSubjects";
import { loadStudyNote, loadStudyNotes, reorderStudyNotes } from "@/lib/studyNotes";
import type { Question, StudyNoteDetail, SubjectName } from "@/types/quiz";

function buildQuestionMap(): Map<string, Question> {
  return new Map(
    getCanonicalQuestionBank()
      .filter((question) => question.sourceType !== "AI_GENERATED")
      .map((question) => [question.id, question] as const)
  );
}

export default function SubjectNotesPage() {
  const params = useParams<{ subject: string }>();
  const subject = decodeURIComponent(params.subject ?? "");
  const { configured, session, user } = useAuth();
  const [notes, setNotes] = useState<StudyNoteDetail[]>([]);
  const [draggingNoteId, setDraggingNoteId] = useState("");
  const [activeQuestionNoteId, setActiveQuestionNoteId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const notesAllowed = isAdminEmail(user?.email);
  const validSubject = isNoteSubject(subject);
  const subjectName = subject as SubjectName;
  const subjectItem = validSubject ? subjectRegistry[subjectName] : null;

  useEffect(() => {
    if (!configured || !session?.access_token || !notesAllowed || !validSubject) {
      setNotes([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError("");
    loadStudyNotes({ accessToken: session.access_token, subject })
      .then(async (nextNotes) => {
        const details = await Promise.all(
          nextNotes.map((note) => loadStudyNote(note.id, session.access_token))
        );
        if (!cancelled) setNotes(details);
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
  }, [configured, notesAllowed, session?.access_token, subject, validSubject]);

  const questionMap = useMemo(() => buildQuestionMap(), []);
  const activeQuestionNote = notes.find((note) => note.id === activeQuestionNoteId);
  const activeRelatedQuestions = useMemo(() => {
    if (!activeQuestionNote) return [];
    return activeQuestionNote.questionLinks
      .map((link) => ({
        link,
        question: questionMap.get(link.questionId)
      }))
      .filter((item): item is { link: typeof item.link; question: Question } => Boolean(item.question));
  }, [activeQuestionNote, questionMap]);

  async function persistOrder(nextNotes: StudyNoteDetail[]) {
    if (!session?.access_token) return;
    try {
      await reorderStudyNotes({
        accessToken: session.access_token,
        orderedIds: nextNotes.map((note) => note.id)
      });
    } catch (rawError) {
      setError(rawError instanceof Error ? rawError.message : "筆記排序更新失敗");
    }
  }

  function moveDraggedNote(targetNoteId: string) {
    if (!draggingNoteId || draggingNoteId === targetNoteId) return;
    setNotes((currentNotes) => {
      const fromIndex = currentNotes.findIndex((note) => note.id === draggingNoteId);
      const toIndex = currentNotes.findIndex((note) => note.id === targetNoteId);
      if (fromIndex < 0 || toIndex < 0) return currentNotes;

      const nextNotes = [...currentNotes];
      const [movedNote] = nextNotes.splice(fromIndex, 1);
      nextNotes.splice(toIndex, 0, movedNote);
      void persistOrder(nextNotes);
      return nextNotes;
    });
  }

  return (
    <main className="shell max-w-[1600px]">
      <section className="surface-card p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Subject Document</p>
            <h1 className="display-title mt-3 text-4xl sm:text-5xl">
              {subjectItem?.label ?? "學習筆記"}
            </h1>
            <p className="body-soft mt-4 max-w-3xl leading-7">
              這裡會把同一科的筆記串成一份大文件。左邊顯示筆記名稱，抓住六點把手可以調整順序。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/notes" className="secondary-pill">
              回十科
            </Link>
            <Link href="/notes/new" className="primary-pill">
              新增筆記
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-6">
        {!configured ? (
          <div className="surface-card p-6"><p className="body-soft">Supabase 尚未設定，學習筆記需要雲端儲存才能使用。</p></div>
        ) : !user ? (
          <div className="surface-card p-6"><p className="body-soft">請先在首頁登入，才能讀取自己的私人筆記。</p></div>
        ) : !notesAllowed ? (
          <div className="surface-card p-6"><p className="body-soft">學習筆記目前只開放站長使用。</p></div>
        ) : !validSubject ? (
          <div className="surface-card p-6"><p className="body-soft">找不到這個科目的筆記頁。</p></div>
        ) : (
          <div className="relative">
            <aside className="note-outline-drawer">
              <div className="note-outline-handle" aria-hidden="true">
                筆記
              </div>
              <div className="note-outline-panel surface-card">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Notes</p>
                <div className="mt-4 grid gap-2">
                  {notes.length > 0 ? (
                    notes.map((note) => (
                      <div
                        key={note.id}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={() => moveDraggedNote(note.id)}
                        className="group grid grid-cols-[32px_minmax(0,1fr)] items-center gap-2 rounded-2xl px-2 py-2 hover:bg-teal-50"
                      >
                        <button
                          type="button"
                          draggable
                          onDragStart={() => setDraggingNoteId(note.id)}
                          onDragEnd={() => setDraggingNoteId("")}
                          aria-label={`拖曳排序：${note.title}`}
                          className="grid h-8 w-8 cursor-grab place-items-center rounded-xl text-slate-300 transition hover:bg-white hover:text-teal-700 active:cursor-grabbing"
                        >
                          <span className="leading-none">⠿</span>
                        </button>
                        <a
                          href={`#note-${note.id}`}
                          className="min-w-0 truncate text-sm font-bold text-slate-700 group-hover:text-teal-800"
                        >
                          {note.title}
                        </a>
                      </div>
                    ))
                  ) : (
                    <p className="body-soft text-sm">目前還沒有筆記。</p>
                  )}
                </div>
              </div>
            </aside>

            <article className="surface-card min-w-0 p-5 sm:p-8 lg:p-12">
              {loading ? <p className="body-soft">正在載入這科的大文件...</p> : null}
              {error ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p> : null}
              {!loading && notes.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-6">
                  <p className="font-bold text-slate-950">這科還沒有筆記。</p>
                  <p className="body-soft mt-2 text-sm">新增筆記並選擇這個科目後，就會出現在這份大文件裡。</p>
                </div>
              ) : null}

              <div className="grid gap-10">
                {notes.map((note) => {
                  const relatedQuestions = note.questionLinks
                    .map((link) => ({
                      link,
                      question: questionMap.get(link.questionId)
                    }))
                    .filter((item): item is { link: typeof item.link; question: Question } => Boolean(item.question));

                  return (
                    <article key={note.id} id={`note-${note.id}`} className="scroll-mt-8 rounded-[2rem] border border-slate-200 bg-white p-5 sm:p-7">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-700">
                            {note.subject || note.collectionName || "Study Note"}
                          </p>
                          <h2 className="mt-2 text-3xl font-black text-slate-950">{note.title}</h2>
                          {note.summary ? <p className="body-soft mt-2 leading-7">{note.summary}</p> : null}
                        </div>
                        <div className="flex flex-wrap justify-end gap-2">
                          {relatedQuestions.length > 0 ? (
                            <button
                              type="button"
                              onClick={() => setActiveQuestionNoteId(note.id)}
                              className="secondary-pill px-4 py-2 text-sm"
                            >
                              考古題 {relatedQuestions.length}
                            </button>
                          ) : null}
                          <Link href={`/notes/${note.id}`} className="secondary-pill px-4 py-2 text-sm">
                            編輯 / 詳情
                          </Link>
                        </div>
                      </div>
                      <div className="mt-6">
                        <StudyNoteMarkdown
                          markdown={note.rawMarkdown}
                          questionMap={questionMap}
                          questionLinks={note.questionLinks}
                        />
                      </div>
                    </article>
                  );
                })}
              </div>
            </article>

            <aside className="note-question-drawer" data-open={Boolean(activeQuestionNote)}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-teal-700">Linked Questions</p>
                  <h2 className="mt-2 text-2xl font-black text-slate-950">
                    {activeQuestionNote?.title ?? "考古題"}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveQuestionNoteId("")}
                  className="secondary-pill px-4 py-2 text-sm"
                >
                  收合
                </button>
              </div>

              <div className="mt-5 grid gap-4">
                {activeRelatedQuestions.length > 0 ? activeRelatedQuestions.map(({ link, question }) => (
                  <article key={`${question.id}-${link.relationType}`} className="rounded-3xl border border-slate-200 bg-white p-4 text-sm leading-7">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
                      <span className="font-bold text-slate-950">{question.id}</span>
                      <span>{question.subject}</span>
                      <span>{question.chapter}</span>
                      <span>{question.section}</span>
                    </div>
                    <p className="mt-3 font-bold text-slate-950">{question.stem}</p>
                    <div className="mt-3 grid gap-2">
                      {Object.entries(question.options)
                        .filter(([, value]) => Boolean(value))
                        .map(([key, value]) => (
                          <p key={key} className="rounded-2xl bg-slate-50 px-3 py-2 text-slate-700">
                            <span className="font-bold text-slate-950">{key}. </span>
                            {value}
                          </p>
                        ))}
                    </div>
                    {link.reason ? <p className="mt-3 rounded-2xl bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-800">{link.reason}</p> : null}
                    <details className="mt-3">
                      <summary className="secondary-pill cursor-pointer list-none px-4 py-2 text-sm">
                        看答案與詳解
                      </summary>
                      <div className="mt-3 rounded-2xl bg-slate-950 px-4 py-3 text-sm leading-7 text-white">
                        <p className="font-bold">答案：{question.answer}</p>
                        <p className="mt-2 text-slate-100">{question.explanation}</p>
                      </div>
                    </details>
                  </article>
                )) : (
                  <p className="body-soft rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm">
                    這篇筆記還沒有連結題目。
                  </p>
                )}
              </div>
            </aside>
          </div>
        )}
      </section>
    </main>
  );
}
