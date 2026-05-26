"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { loadCurrentSession } from "@/lib/storage";
import type { QuizSession } from "@/types/quiz";

function isResumableSession(session: QuizSession | null) {
  return Boolean(session && !session.completedAt && (session.questionOrder?.length ?? 0) > 0);
}

export function ContinueQuizButton() {
  const [session, setSession] = useState<QuizSession | null>(null);

  useEffect(() => {
    setSession(loadCurrentSession());

    function handleSessionChange(event: Event) {
      const detail = (event as CustomEvent<QuizSession | null>).detail;
      setSession(detail ?? loadCurrentSession());
    }

    function handleStorageChange(event: StorageEvent) {
      if (event.key?.includes("anatomy-confidence-current-session")) {
        setSession(loadCurrentSession());
      }
    }

    window.addEventListener("current-session-change", handleSessionChange as EventListener);
    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener("current-session-change", handleSessionChange as EventListener);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  const resumeMeta = useMemo(() => {
    if (!session || !isResumableSession(session)) return null;
    const activeSession = session;
    const currentIndex = activeSession.currentQuestionIndex ?? 0;
    const total = activeSession.questionOrder?.length ?? 0;
    const shownIndex = Math.min(total, Math.max(1, currentIndex + 1));
    return {
      subject: activeSession.subject,
      progressLabel: `做到第 ${shownIndex} / ${total} 題`
    };
  }, [session]);

  if (!resumeMeta) return null;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Link href="/quiz" className="secondary-pill">
        繼續測驗
      </Link>
      <p className="body-soft text-sm">
        {resumeMeta.subject}．{resumeMeta.progressLabel}
      </p>
    </div>
  );
}
