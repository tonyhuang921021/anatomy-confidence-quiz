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
    <main id="main-content" className="shell workspace-page">
      <section className="surface-card workspace-page-panel workspace-page-header p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="workspace-page-kicker">筆記</p>
            <h1 className="workspace-page-title">學習筆記</h1>
            <p className="body-soft mt-2 text-sm">依科目整理筆記與章節。</p>
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

      <section className="workspace-section mt-5 p-4 sm:p-5">
        {!configured ? (
          <p className="workspace-empty-state">學習筆記目前無法連上雲端。</p>
        ) : !user ? (
          <p className="workspace-empty-state">登入後即可查看與建立學習筆記。</p>
        ) : (
          <>
            {loading ? <p className="body-soft">正在整理十科筆記...</p> : null}
            {error ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p> : null}
            <div className="notes-subject-grid">
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
                const cardClassName = "notes-subject-card group text-left";
                const cardContent = (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="text-lg font-semibold text-ink">{item.label}</h2>
                      <span className="text-xs font-semibold text-slate-500">{stats?.count ?? 0} 篇</span>
                    </div>
                    <p className="mt-3 text-sm text-slate-500">
                      {stats?.chapters.size ?? 0} 個章節・更新 {formatDate(stats?.updatedAt)}
                    </p>
                    <span className="mt-4 inline-flex text-sm font-semibold text-brand-700">
                      {isMicrobiology ? "選擇分類" : "開啟筆記"} →
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
                        <div className="grid gap-1 border-l-2 border-brand-200 pl-3">
                          {MICROBIOLOGY_IMMUNOLOGY_CATEGORIES.map((category) => (
                            <Link
                              key={category.id}
                              href={`/notes/subject/${encodeURIComponent(subject)}?category=${category.id}`}
                              className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-brand-50 hover:text-brand-800"
                            >
                              <span className="flex items-center justify-between gap-3">
                                <span>{category.label}</span>
                                <span>{microCategoryCounts.get(category.id) ?? 0} 篇</span>
                              </span>
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
