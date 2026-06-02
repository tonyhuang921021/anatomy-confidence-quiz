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
import { loadStudyNote, loadStudyNotes } from "@/lib/studyNotes";
import type { Question, StudyNoteDetail, SubjectName } from "@/types/quiz";

type OutlineSection = {
  chapter: string;
  section: string;
};

function getNoteSectionKey(note: StudyNoteDetail) {
  return note.section || note.chapter || "未分小節";
}

function getSectionAnchor(section: string) {
  return encodeURIComponent(section);
}

function groupNotesBySection(notes: StudyNoteDetail[]) {
  const map = new Map<string, StudyNoteDetail[]>();
  for (const note of notes) {
    const key = getNoteSectionKey(note);
    const bucket = map.get(key) ?? [];
    bucket.push(note);
    map.set(key, bucket);
  }
  return map;
}

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

  const groupedNotes = useMemo(() => groupNotesBySection(notes), [notes]);
  const questionMap = useMemo(() => buildQuestionMap(), []);

  const orderedSections = useMemo<OutlineSection[]>(() => {
    const outline = (subjectItem?.chapters ?? []).flatMap((chapter) =>
      chapter.sections.map((section) => ({
        chapter: chapter.chapter,
        section
      }))
    );
    const outlineSectionNames = outline.map((item) => item.section);
    const extra = Array.from(groupedNotes.keys())
      .filter((section) => !outlineSectionNames.includes(section))
      .map((section) => ({
        chapter: "未列入小節排序",
        section
      }));

    return [...outline, ...extra].filter((item) => groupedNotes.has(item.section));
  }, [groupedNotes, subjectItem?.chapters]);

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
              這裡會把同一科的筆記串成一份大文件。左邊先依照目前題庫小節排序，之後可替換成小傑小節目錄。
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
          <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
            <aside className="surface-card sticky top-4 max-h-[calc(100vh-2rem)] overflow-auto p-5">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Outline</p>
              <div className="mt-4 grid gap-2">
                {orderedSections.length > 0 ? (
                  orderedSections.map((item) => (
                    <a
                      key={`${item.chapter}-${item.section}`}
                      href={`#${getSectionAnchor(item.section)}`}
                      className="rounded-2xl px-3 py-2 text-sm font-bold text-slate-700 hover:bg-teal-50 hover:text-teal-800"
                    >
                      <span className="block text-[11px] font-semibold text-slate-400">{item.chapter}</span>
                      {item.section}
                    </a>
                  ))
                ) : (
                  <p className="body-soft text-sm">目前還沒有筆記小節。</p>
                )}
              </div>
            </aside>

            <article className="surface-card min-w-0 p-5 sm:p-8 lg:p-10">
              {loading ? <p className="body-soft">正在載入這科的大文件...</p> : null}
              {error ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p> : null}
              {!loading && notes.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-6">
                  <p className="font-bold text-slate-950">這科還沒有筆記。</p>
                  <p className="body-soft mt-2 text-sm">新增筆記並選擇這個科目後，就會出現在這份大文件裡。</p>
                </div>
              ) : null}

              <div className="grid gap-10">
                {orderedSections.map((outlineSection) => {
                  const sectionNotes = groupedNotes.get(outlineSection.section) ?? [];
                  if (sectionNotes.length === 0) return null;
                  return (
                    <section key={outlineSection.section} id={getSectionAnchor(outlineSection.section)} className="scroll-mt-8">
                      <p className="text-sm font-bold uppercase tracking-[0.18em] text-teal-700">{outlineSection.chapter}</p>
                      <h2 className="mt-2 text-3xl font-black text-slate-950">{outlineSection.section}</h2>
                      <div className="mt-5 grid gap-6">
                        {sectionNotes.map((note) => (
                          <article key={note.id} className="rounded-[2rem] border border-slate-200 bg-white p-5 sm:p-7">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-700">
                                  {note.section || note.collectionName || "Study Note"}
                                </p>
                                <h3 className="mt-2 text-2xl font-black text-slate-950">{note.title}</h3>
                                {note.summary ? <p className="body-soft mt-2 leading-7">{note.summary}</p> : null}
                              </div>
                              <Link href={`/notes/${note.id}`} className="secondary-pill px-4 py-2 text-sm">
                                編輯 / 詳情
                              </Link>
                            </div>
                            <div className="mt-6">
                              <StudyNoteMarkdown
                                markdown={note.rawMarkdown}
                                questionMap={questionMap}
                                questionLinks={note.questionLinks}
                              />
                            </div>
                          </article>
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>
            </article>
          </div>
        )}
      </section>
    </main>
  );
}
