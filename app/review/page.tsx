"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { ReviewNotebook } from "@/components/ReviewNotebook";
import { applyQuestionClassificationOverride, getQuestionBankBySubjectFilter } from "@/data/med1QuestionBank";
import { loadConfirmedQuestionClassificationOverrides } from "@/lib/cloudSync";
import {
  DEFAULT_QUIZ_SETTINGS,
  getReviewQuestionItems,
  mergeQuestionsWithSessionSnapshots
} from "@/lib/quizAnalysis";
import { loadCompletedSessions, saveQuizSettings } from "@/lib/storage";
import { QuestionClassificationOverride, ReviewQuestionItem } from "@/types/quiz";

export default function ReviewPage() {
  const [practiceItems, setPracticeItems] = useState<ReviewQuestionItem[]>([]);
  const [classificationOverrides, setClassificationOverrides] = useState<
    Record<string, QuestionClassificationOverride>
  >({});
  const [isFullscreenReview, setIsFullscreenReview] = useState(false);
  const [isFullscreenReviewVisible, setIsFullscreenReviewVisible] = useState(false);
  const { syncVersion } = useAuth();
  const pageScrollYRef = useRef(0);
  const baseQuestions = useMemo(() => getQuestionBankBySubjectFilter("全部"), []);
  const allQuestions = useMemo(
    () =>
      baseQuestions.map((question) =>
        applyQuestionClassificationOverride(question, classificationOverrides[question.id])
      ),
    [baseQuestions, classificationOverrides]
  );

  useEffect(() => {
    void loadConfirmedQuestionClassificationOverrides(baseQuestions.map((question) => question.id))
      .then((overrides) => setClassificationOverrides(overrides))
      .catch(() => {
        // keep static classification if override fetch fails
      });
  }, [baseQuestions, syncVersion]);

  useEffect(() => {
    const sessions = loadCompletedSessions();
    const practiceSessions = sessions.filter(
      (session) =>
        session.settings?.mode !== "simulation" &&
        session.settings?.mode !== "custom_paper" &&
        session.settings?.mode !== "peak_challenge" &&
        session.settings?.customPoolLabel !== "模擬考錯題庫" &&
        session.settings?.customPoolLabel !== "自訂卷錯題庫" &&
        session.settings?.customPoolLabel !== "巔峰賽錯題庫"
    );
    const reviewQuestions = mergeQuestionsWithSessionSnapshots(allQuestions, practiceSessions);
    setPracticeItems(getReviewQuestionItems(reviewQuestions, practiceSessions, Number.MAX_SAFE_INTEGER));
  }, [allQuestions, syncVersion]);

  useEffect(() => {
    if (typeof document === "undefined" || typeof window === "undefined") return;

    if (!isFullscreenReview) {
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      window.scrollTo(0, pageScrollYRef.current);
      return;
    }

    pageScrollYRef.current = window.scrollY;
    const previousOverflow = document.body.style.overflow;
    const previousPosition = document.body.style.position;
    const previousTop = document.body.style.top;
    const previousWidth = document.body.style.width;
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${pageScrollYRef.current}px`;
    document.body.style.width = "100%";

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.position = previousPosition;
      document.body.style.top = previousTop;
      document.body.style.width = previousWidth;
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

  function handleStartPracticeReview(filteredItems: ReviewQuestionItem[] = practiceItems) {
    saveQuizSettings({
      ...DEFAULT_QUIZ_SETTINGS,
      mode: "review",
      questionCount: 10,
      subjectFilter: "全部",
      customQuestionIds: filteredItems.map((item) => item.question.id),
      customQuestionPayload: filteredItems.map((item) => item.question),
      customPoolLabel: "散題錯題庫"
    });
  }

  function handleCloseFullscreenReview() {
    setIsFullscreenReviewVisible(false);

    if (typeof window === "undefined") {
      setIsFullscreenReview(false);
      return;
    }

    window.setTimeout(() => {
      setIsFullscreenReview(false);
    }, 280);
  }

  function handleOpenFullscreenReview() {
    setIsFullscreenReview(true);
  }

  const wrongCount = practiceItems.filter((item) => item.history.wrong > 0).length;
  const lowConfidenceCount = practiceItems.filter((item) => item.history.lowConfidence > 0).length;

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
              onClick={() => handleStartPracticeReview()}
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
          <p className="mt-2 text-3xl font-bold">{wrongCount}</p>
        </article>
        <article className="rounded-3xl bg-amber-50 p-5 text-amber-900">
          <p className="text-sm font-medium">散題低信心題</p>
          <p className="mt-2 text-3xl font-bold">{lowConfidenceCount}</p>
        </article>
      </section>

      <div className="mt-8 grid gap-8">
        <div id="practice-review" className="scroll-mt-24">
          <ReviewNotebook
            title="散題錯題庫"
            description="這裡只整理平常零散刷題累積下來的錯題與低信心題。"
            startLabel="開始散題錯題複習"
            onStartReview={handleStartPracticeReview}
            items={practiceItems}
            allQuestions={allQuestions}
            headerAction={
              <button
                type="button"
                onClick={handleOpenFullscreenReview}
                className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-200 sm:hidden"
                aria-label="開啟滿版錯題複習"
                title="開啟滿版錯題複習"
              >
                ⛶ 滿版模式
              </button>
            }
          />
        </div>
      </div>

      {isFullscreenReview ? (
        <div
          className={`fixed inset-0 z-50 bg-[color:var(--bg-base)] transition-opacity duration-300 ease-out overscroll-none sm:hidden ${
            isFullscreenReviewVisible ? "opacity-100" : "opacity-0"
          }`}
        >
          <div
            className={`flex h-full flex-col transition-transform duration-300 ease-out ${
              isFullscreenReviewVisible ? "translate-y-0" : "translate-y-full"
            }`}
          >
            <div className="flex items-center justify-between gap-3 border-b px-4 py-3 shadow-sm border-[color:var(--line-soft)] bg-[color:var(--surface)] backdrop-blur">
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
