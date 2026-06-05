"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { NOTE_SUBJECTS } from "@/lib/noteSubjects";
import {
  getMicrobiologyImmunologyCategory,
  isMicrobiologyImmunologySubject,
  MICROBIOLOGY_IMMUNOLOGY_CATEGORIES
} from "@/lib/noteSubjectCategories";
import { loadStudyNotes } from "@/lib/studyNotes";
import { subjectRegistry } from "@/data/subjectRegistry";
import type { StudyNoteSummary } from "@/types/quiz";

const STUDY_NOTES_MANUAL_HREF = "/manuals/學習筆記功能說明.html";

function formatDate(value?: string) {
  if (!value) return "尚無筆記";
  return new Intl.DateTimeFormat("zh-Hant", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export default function StudyNotesPage() {
  const { configured, session, user } = useAuth();
  const [notes, setNotes] = useState<StudyNoteSummary[]>([]);
  const [expandedMicrobiology, setExpandedMicrobiology] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!configured || !session?.access_token) {
      setNotes([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError("");
    loadStudyNotes({ accessToken: session.access_token })
      .then((nextNotes) => {
        if (!cancelled) setNotes(nextNotes);
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
  }, [configured, session?.access_token]);

  const statsBySubject = useMemo(() => {
    const map = new Map<string, { count: number; updatedAt?: string; chapters: Set<string> }>();
    for (const note of notes) {
      if (!note.subject) continue;
      const current = map.get(note.subject) ?? { count: 0, updatedAt: undefined, chapters: new Set<string>() };
      current.count += 1;
      if (note.chapter) current.chapters.add(note.chapter);
      if (!current.updatedAt || new Date(note.updatedAt).getTime() > new Date(current.updatedAt).getTime()) {
        current.updatedAt = note.updatedAt;
      }
      map.set(note.subject, current);
    }
    return map;
  }, [notes]);

  return (
    <main className="shell">
      <section className="surface-card p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Study Library</p>
            <h1 className="display-title mt-3 text-4xl sm:text-5xl">學習筆記</h1>
            <p className="body-soft mt-4 max-w-3xl leading-7">
              先選一科，進去後會像一份大文件：左邊是章節檢索，右邊是完整筆記、相關題目小卡與可編輯內容。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href={STUDY_NOTES_MANUAL_HREF} target="_blank" rel="noreferrer" className="secondary-pill">
              打開說明書
            </a>
            <Link href="/notes/new" className="primary-pill">
              新增筆記
            </Link>
          </div>
        </div>
      </section>

      <section className="surface-card mt-6 p-5 sm:p-6">
        {!configured ? (
          <p className="body-soft">Supabase 尚未設定，學習筆記需要雲端儲存才能使用。</p>
        ) : !user ? (
          <p className="body-soft">請先在首頁登入，登入後就能建立自己的學習筆記。</p>
        ) : (
          <>
            {loading ? <p className="body-soft">正在整理十科筆記...</p> : null}
            {error ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p> : null}
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              {NOTE_SUBJECTS.map((subject) => {
                const item = subjectRegistry[subject];
                const stats = statsBySubject.get(subject);
                const isMicrobiology = isMicrobiologyImmunologySubject(subject);
                const subjectNotes = notes.filter((note) => note.subject === subject);
                const microCategoryCounts = new Map(
                  MICROBIOLOGY_IMMUNOLOGY_CATEGORIES.map((category) => [
                    category.id,
                    subjectNotes.filter((note) => getMicrobiologyImmunologyCategory(note) === category.id).length
                  ])
                );
                const cardClassName =
                  "group rounded-[2rem] border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-1 hover:border-teal-300 hover:shadow-xl";
                const cardContent = (
                  <>
                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-teal-700">Subject</p>
                    <h2 className="mt-3 text-2xl font-black text-slate-950">{item.label}</h2>
                    <div className="mt-5 grid gap-2 text-sm font-semibold text-slate-600">
                      <span>{stats?.count ?? 0} 篇筆記</span>
                      <span>{stats?.chapters.size ?? 0} 個章節</span>
                      <span>更新 {formatDate(stats?.updatedAt)}</span>
                    </div>
                    <span className="mt-5 inline-flex rounded-full bg-slate-950 px-4 py-2 text-sm font-bold text-white transition group-hover:bg-teal-700">
                      {isMicrobiology ? "選擇分類" : "打開大文件"}
                    </span>
                  </>
                );
                if (isMicrobiology) {
                  return (
                    <div key={subject} className="grid gap-3">
                      <button
                        type="button"
                        onClick={() => setExpandedMicrobiology((current) => !current)}
                        className={cardClassName}
                        aria-expanded={expandedMicrobiology}
                      >
                        {cardContent}
                      </button>
                      {expandedMicrobiology ? (
                        <div className="grid gap-2 rounded-[1.5rem] border border-teal-100 bg-teal-50/70 p-3">
                          {MICROBIOLOGY_IMMUNOLOGY_CATEGORIES.map((category) => (
                            <Link
                              key={category.id}
                              href={`/notes/subject/${encodeURIComponent(subject)}?category=${category.id}`}
                              className="rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-800 shadow-sm transition hover:bg-teal-700 hover:text-white"
                            >
                              <span className="flex items-center justify-between gap-3">
                                <span>{category.label}</span>
                                <span>{microCategoryCounts.get(category.id) ?? 0} 篇</span>
                              </span>
                              <span className="mt-1 block text-xs font-medium opacity-70">{category.description}</span>
                            </Link>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                }
                return (
                  <Link
                    key={subject}
                    href={`/notes/subject/${encodeURIComponent(subject)}`}
                    className={cardClassName}
                  >
                    {cardContent}
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
