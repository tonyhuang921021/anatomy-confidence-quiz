"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { ReviewNotebook } from "@/components/ReviewNotebook";
import { getQuestionBankBySubjectFilter } from "@/data/med1QuestionBank";
import {
  DEFAULT_QUIZ_SETTINGS,
  getReviewQuestionItems,
  getReviewSnapshot
} from "@/lib/quizAnalysis";
import { loadCompletedSessions, saveQuizSettings } from "@/lib/storage";
import { ReviewQuestionItem } from "@/types/quiz";

export default function ReviewPage() {
  const [practiceItems, setPracticeItems] = useState<ReviewQuestionItem[]>([]);
  const [isFullscreenReview, setIsFullscreenReview] = useState(false);
  const [isFullscreenReviewVisible, setIsFullscreenReviewVisible] = useState(false);
  const [fullscreenDismissed, setFullscreenDismissed] = useState(false);
  const { syncVersion } = useAuth();
  const reviewTriggerRef = useRef<HTMLDivElement | null>(null);
  const allQuestions = getQuestionBankBySubjectFilter("全部");

  useEffect(() => {
    const sessions = loadCompletedSessions();
    const practiceSessions = sessions.filter((session) => session.settings?.mode !== "simulation");
    setPracticeItems(getReviewQuestionItems(allQuestions, practiceSessions, 60));
  }, [syncVersion]);

  useEffect(() => {
    if (typeof window === "undefined" || !reviewTriggerRef.current) return;

    const mediaQuery = window.matchMedia("(max-width: 639px)");
    if (!mediaQuery.matches) {
      setIsFullscreenReview(false);
      setFullscreenDismissed(false);
      return;
    }

    let ticking = false;

    const updateFullscreenState = () => {
      ticking = false;
      if (!reviewTriggerRef.current) return;

      const rect = reviewTriggerRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight || 0;
      const enteringFocusZone = rect.top <= viewportHeight * 0.56 && rect.bottom >= viewportHeight * 0.24;
      const safelyOutsideFocusZone = rect.top > viewportHeight * 0.92 || rect.bottom < viewportHeight * 0.08;

      if (enteringFocusZone && !fullscreenDismissed) {
        setIsFullscreenReview(true);
      }

      if (safelyOutsideFocusZone && fullscreenDismissed) {
        setFullscreenDismissed(false);
      }
    };

    const requestUpdate = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(updateFullscreenState);
    };

    updateFullscreenState();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);

    return () => {
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
    };
  }, [fullscreenDismissed]);

  useEffect(() => {
    if (typeof document === "undefined") return;

    if (!isFullscreenReview) {
      document.body.style.overflow = "";
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isFullscreenReview]);

  useEffect(() => {
    if (!isFullscreenReview || typeof window === "undefined") {
      setIsFullscreenReviewVisible(false);
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      setIsFullscreenReviewVisible(true);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [isFullscreenReview]);

  function handleStartPracticeReview() {
    saveQuizSettings({
      ...DEFAULT_QUIZ_SETTINGS,
      mode: "review",
      questionCount: 10,
      subjectFilter: "全部",
      customQuestionIds: practiceItems.map((item) => item.question.id),
      customPoolLabel: "散題錯題庫"
    });
  }

  function handleCloseFullscreenReview() {
    setIsFullscreenReviewVisible(false);
    setFullscreenDismissed(true);

    if (typeof window === "undefined") {
      setIsFullscreenReview(false);
      return;
    }

    window.setTimeout(() => {
      setIsFullscreenReview(false);
    }, 280);
  }

  const practiceSnapshot = getReviewSnapshot(practiceItems);

  return (
    <main className="shell">
      <section className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">Review</p>
            <h1 className="mt-2 text-3xl font-bold text-ink sm:text-4xl">錯題複習與沒信心題</h1>
            <p className="mt-3 text-slate-500">
              這裡只整理平常散題刷題累積下來的錯題與低信心題。
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/"
              className="min-h-12 rounded-2xl bg-slate-100 px-5 py-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-200"
            >
              返回首頁
            </Link>
            <Link
              href="/quiz?new=1"
              onClick={handleStartPracticeReview}
              className="min-h-12 rounded-2xl bg-brand-600 px-5 py-4 text-sm font-semibold text-white transition hover:bg-brand-700"
            >
              開始散題錯題複習
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-4 lg:grid-cols-2">
        <article className="rounded-3xl bg-rose-50 p-5 text-rose-900">
          <p className="text-sm font-medium">散題錯題庫</p>
          <p className="mt-2 text-3xl font-bold">{practiceSnapshot.total}</p>
        </article>
        <article className="rounded-3xl bg-amber-50 p-5 text-amber-900">
          <p className="text-sm font-medium">散題低信心題</p>
          <p className="mt-2 text-3xl font-bold">{practiceSnapshot.lowConfidence}</p>
        </article>
      </section>

      <div className="mt-8 grid gap-8">
        <div id="practice-review" ref={reviewTriggerRef} className="scroll-mt-24">
          <ReviewNotebook
            title="散題錯題庫"
            description="這裡只整理平常零散刷題累積下來的錯題與低信心題。"
            startLabel="開始散題錯題複習"
            onStartReview={handleStartPracticeReview}
            items={practiceItems}
            allQuestions={allQuestions}
          />
        </div>
      </div>

      {isFullscreenReview ? (
        <div
          className={`fixed inset-0 z-50 bg-cream/95 transition-opacity duration-300 ease-out sm:hidden ${
            isFullscreenReviewVisible ? "opacity-100" : "opacity-0"
          }`}
        >
          <div
            className={`flex h-full flex-col transition-transform duration-300 ease-out ${
              isFullscreenReviewVisible ? "translate-y-0" : "translate-y-full"
            }`}
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 shadow-sm">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">Fullscreen Review</p>
                <h2 className="text-lg font-bold text-ink">散題錯題庫</h2>
              </div>
              <button
                type="button"
                onClick={handleCloseFullscreenReview}
                className="min-h-11 rounded-2xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-200"
              >
                返回頁面
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-0 py-0">
              <ReviewNotebook
                title="散題錯題庫"
                description="手機滿版複習模式。看完可按右上角返回頁面。"
                startLabel="開始散題錯題複習"
                onStartReview={handleStartPracticeReview}
                items={practiceItems}
                allQuestions={allQuestions}
                fullscreenMobile
              />
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
