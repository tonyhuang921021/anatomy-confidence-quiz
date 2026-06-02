"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { MED1_SUBJECTS, MED2_SUBJECTS, subjectRegistry } from "@/data/subjectRegistry";
import { loadStudyNotes } from "@/lib/studyNotes";
import type { StudyNoteSummary } from "@/types/quiz";

const SUBJECT_OPTIONS = [...MED1_SUBJECTS, ...MED2_SUBJECTS].map((subjectName) => subjectRegistry[subjectName]);

function formatDate(value: string) {
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
  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState("全部");
  const [tag, setTag] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const deferredSearch = useDeferredValue(search);
  const deferredTag = useDeferredValue(tag);

  useEffect(() => {
    if (!configured || !session?.access_token) {
      setNotes([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError("");
    loadStudyNotes({
      accessToken: session.access_token,
      search: deferredSearch,
      subject: subject === "全部" ? "" : subject,
      tag: deferredTag
    })
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
  }, [configured, deferredSearch, deferredTag, session?.access_token, subject]);

  const tagSuggestions = useMemo(() => {
    return Array.from(new Set(notes.flatMap((note) => note.tags.map((item) => item.tag))))
      .slice(0, 12);
  }, [notes]);

  return (
    <main className="shell">
      <section className="surface-card p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Study Notes</p>
            <h1 className="display-title mt-3 text-4xl sm:text-5xl">學習筆記庫</h1>
            <p className="body-soft mt-4 max-w-2xl leading-7">
              收各種複習資料與整理筆記，保留 Markdown 排版，再慢慢接回題庫、tag 和知識連結。
            </p>
          </div>
          <Link href="/notes/new" className="primary-pill">
            新增筆記
          </Link>
        </div>
      </section>

      <section className="surface-card mt-6 p-5 sm:p-6">
        {!configured ? (
          <p className="body-soft">Supabase 尚未設定，學習筆記需要雲端儲存才能使用。</p>
        ) : !user ? (
          <p className="body-soft">請先在首頁登入，筆記會以私人資料存在雲端。</p>
        ) : (
          <>
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_220px_220px]">
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                關鍵字
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="搜尋標題、內文、章節或 tag"
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-teal-500"
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                科目
                <select
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-teal-500"
                >
                  <option value="全部">全部科目</option>
                  {SUBJECT_OPTIONS.map((item) => (
                    <option key={item.subject} value={item.subject}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Tag
                <input
                  value={tag}
                  onChange={(event) => setTag(event.target.value)}
                  placeholder="例如 視交叉"
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-teal-500"
                />
              </label>
            </div>

            {tagSuggestions.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {tagSuggestions.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setTag(item)}
                    className="stat-chip hover:border-teal-300"
                  >
                    #{item}
                  </button>
                ))}
              </div>
            ) : null}

            <div className="mt-6 grid gap-4">
              {loading ? <p className="body-soft">正在載入筆記...</p> : null}
              {error ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p> : null}
              {!loading && notes.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-6">
                  <p className="font-semibold text-slate-900">目前還沒有符合條件的筆記。</p>
                  <p className="body-soft mt-2 text-sm">先新增一篇複習資料，筆記庫就會開始長出來。</p>
                </div>
              ) : null}
              {notes.map((note) => (
                <Link
                  key={note.id}
                  href={`/notes/${note.id}`}
                  className="block rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-md"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-bold text-slate-950">{note.title}</h2>
                      <p className="body-soft mt-2 line-clamp-2 text-sm leading-6">
                        {note.summary || "尚未填摘要，點進去看完整 Markdown 筆記。"}
                      </p>
                    </div>
                    <span className="stat-chip">更新 {formatDate(note.updatedAt)}</span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {note.collectionName ? <span className="stat-chip">{note.collectionName}</span> : null}
                    {note.subject ? <span className="stat-chip">{note.subject}</span> : null}
                    {note.chapter ? <span className="stat-chip">{note.chapter}</span> : null}
                    {note.section ? <span className="stat-chip">{note.section}</span> : null}
                    {note.questionLinkCount > 0 ? <span className="stat-chip">相關題 {note.questionLinkCount}</span> : null}
                  </div>
                  {note.tags.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {note.tags.slice(0, 8).map((item) => (
                        <span key={`${item.tagType}-${item.tag}`} className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800">
                          #{item.tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </Link>
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
