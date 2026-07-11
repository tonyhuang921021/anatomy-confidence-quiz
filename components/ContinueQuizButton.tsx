"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import {
  getCanonicalResumableSessionId,
  getResumableSessionActivity,
  isResumableQuizSession
} from "@/lib/resumableSessions";
import { loadCurrentSession, saveCurrentSession } from "@/lib/storage";
import type { QuizMode, QuizSession } from "@/types/quiz";

const MODE_LABELS: Record<QuizMode, string> = {
  random: "自由測驗",
  weakness: "弱點補強",
  review: "複習題庫",
  simulation: "模擬考",
  custom_paper: "自訂卷"
};

function getSessionModeLabel(session: QuizSession) {
  return session.settings?.mode ? MODE_LABELS[session.settings.mode] : "一般測驗";
}

function getSessionTitle(session: QuizSession) {
  return (
    session.settings?.customPaperName?.trim() ||
    session.settings?.sessionName?.trim() ||
    session.settings?.customPoolLabel?.trim() ||
    `${session.subject} ${getSessionModeLabel(session)}`
  );
}

function formatActivityTime(session: QuizSession) {
  const value = getResumableSessionActivity(session);
  if (!value) return "尚無作答時間";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "尚無作答時間";
  return date.toLocaleString("zh-TW", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function sessionProgress(session: QuizSession) {
  const total = session.questionOrder?.length ?? session.generatedQuestions?.length ?? 0;
  const answered = Math.min(total, session.attempts.length);
  return {
    answered,
    total,
    percent: total > 0 ? Math.round((answered / total) * 100) : 0
  };
}

export function ContinueQuizButton() {
  const router = useRouter();
  const { configured, session: authSession, syncStatus, syncVersion } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [localSession, setLocalSession] = useState<QuizSession | null>(null);
  const [sessions, setSessions] = useState<QuizSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [cloudError, setCloudError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const refreshSessions = useCallback(async () => {
    try {
      setLoading(true);
      setCloudError("");
      const { loadResumableQuizSessionsForCurrentUser } = await import("@/lib/cloudSync");
      const result = await loadResumableQuizSessionsForCurrentUser(
        authSession?.user?.id ?? null
      );
      setSessions(result.sessions);
      setCloudError(result.cloudError ?? "");
    } catch (error) {
      setCloudError(
        error instanceof Error ? error.message : "進行中測驗清單讀取失敗，請稍後再試。"
      );
    } finally {
      setLoading(false);
    }
  }, [authSession?.user?.id]);

  useEffect(() => {
    setMounted(true);
    setLocalSession(loadCurrentSession());

    function handleSessionChange() {
      setLocalSession(loadCurrentSession());
    }

    function handleStorageChange(event: StorageEvent) {
      if (event.key?.includes("anatomy-confidence-current-session")) {
        handleSessionChange();
      }
    }

    window.addEventListener("current-session-change", handleSessionChange);
    window.addEventListener("storage", handleStorageChange);
    return () => {
      window.removeEventListener("current-session-change", handleSessionChange);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  useEffect(() => {
    setLocalSession(loadCurrentSession());
    if (open) void refreshSessions();
  }, [open, refreshSessions, syncVersion]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const localResumeMeta = useMemo(() => {
    if (!isResumableQuizSession(localSession)) return null;
    return sessionProgress(localSession);
  }, [localSession]);

  function handleOpen() {
    setDeleteError("");
    setConfirmDeleteId(null);
    setOpen(true);
  }

  function handleResume(session: QuizSession) {
    saveCurrentSession(session);
    setOpen(false);
    router.push("/quiz");
  }

  async function handleDelete(session: QuizSession) {
    const canonicalId = getCanonicalResumableSessionId(session.id);
    try {
      setDeletingId(canonicalId);
      setDeleteError("");
      const { deleteResumableQuizSession } = await import("@/lib/cloudSync");
      await deleteResumableQuizSession({
        sessionId: session.id,
        userId: authSession?.user?.id ?? null,
        accessToken: authSession?.access_token ?? null
      });
      setSessions((current) =>
        current.filter(
          (item) => getCanonicalResumableSessionId(item.id) !== canonicalId
        )
      );
      setLocalSession(loadCurrentSession());
      setConfirmDeleteId(null);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "刪除進行中測驗失敗。");
    } finally {
      setDeletingId(null);
    }
  }

  const dialog = open && mounted ? (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-5" role="presentation" onMouseDown={(event) => {
      if (event.currentTarget === event.target) setOpen(false);
    }}>
      <section role="dialog" aria-modal="true" aria-labelledby="resume-dialog-title" aria-busy={loading} className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div>
            <h2 id="resume-dialog-title" className="text-xl font-semibold text-ink">可繼續的測驗</h2>
            <p aria-live="polite" className="mt-1 text-sm text-slate-500">{loading ? "正在整理..." : `${sessions.length} 份進行中`}</p>
          </div>
          <button type="button" onClick={() => setOpen(false)} aria-label="關閉可繼續測驗" title="關閉" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900">×</button>
        </header>

        <div className="overflow-y-auto px-5 py-2 sm:px-6">
          {cloudError ? <p className="my-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{cloudError}</p> : null}
          {deleteError ? <p className="my-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-900">{deleteError}</p> : null}

          {loading && sessions.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">正在讀取進行中的測驗...</div>
          ) : sessions.length === 0 ? (
            <div className="py-12 text-center">
              <p className="font-semibold text-ink">目前沒有進行中的測驗</p>
              <p className="mt-1 text-sm text-slate-500">開始作答後，尚未完成的測驗會出現在這裡。</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {sessions.map((session) => {
                const id = getCanonicalResumableSessionId(session.id);
                const progress = sessionProgress(session);
                const confirming = confirmDeleteId === id;
                const deleting = deletingId === id;
                return (
                  <article key={id} className="py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">{getSessionModeLabel(session)}</span>
                          <h3 className="min-w-0 truncate text-base font-semibold text-ink">{getSessionTitle(session)}</h3>
                        </div>
                        <p className="mt-2 text-sm text-slate-600">已答 {progress.answered} / {progress.total} 題・最後作答 {formatActivityTime(session)}</p>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-brand-600" style={{ width: `${progress.percent}%` }} />
                        </div>
                      </div>
                    </div>

                    {confirming ? (
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-rose-50 px-3 py-2.5">
                        <p className="text-sm font-semibold text-rose-900">確定刪除這份進行中測驗？</p>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => setConfirmDeleteId(null)} disabled={deleting} className="min-h-9 rounded-lg bg-white px-3 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">取消</button>
                          <button type="button" onClick={() => void handleDelete(session)} disabled={deleting} className="min-h-9 rounded-lg bg-rose-600 px-3 text-xs font-semibold text-white disabled:bg-rose-300">{deleting ? "刪除中..." : "確定刪除"}</button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 flex items-center justify-end gap-2">
                        <button type="button" onClick={() => setConfirmDeleteId(id)} className="min-h-10 rounded-lg px-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-50">刪除</button>
                        <button type="button" onClick={() => handleResume(session)} className="min-h-10 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-700">繼續作答</button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  ) : null;

  return (
    <>
      <button type="button" onClick={handleOpen} className="home-continue-button">
        <span className="home-continue-label">繼續測驗</span>
        <span className="home-continue-meta">
          {localResumeMeta
            ? `這台裝置有 1 份・已答 ${localResumeMeta.answered} / ${localResumeMeta.total} 題`
            : configured && authSession?.user && syncStatus === "syncing"
              ? "正在檢查雲端紀錄"
              : "查看進行中的測驗"}
        </span>
        <span aria-hidden="true" className="home-continue-arrow">›</span>
      </button>
      {dialog ? createPortal(dialog, document.body) : null}
    </>
  );
}
