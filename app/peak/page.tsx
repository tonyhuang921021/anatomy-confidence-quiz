"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { getQuestionBankBySubjectFilter } from "@/data/med1QuestionBank";
import {
  generatePeakChallengeSession,
  loadPeakChallengeLeaderboard
} from "@/lib/cloudSync";
import {
  DEFAULT_QUIZ_SETTINGS,
  getReviewQuestionItems,
  getReviewSnapshot
} from "@/lib/quizAnalysis";
import { loadCompletedSessions, saveQuizSettings } from "@/lib/storage";
import { getOrCreateVisitorId } from "@/lib/visitor";
import type { PeakChallengeLeaderboardEntry } from "@/types/quiz";

const ENTRY_THRESHOLD = 25;

function getAllowedEmails() {
  return (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function isAllowedEmail(email?: string | null) {
  if (!email) return false;
  return getAllowedEmails().includes(email.trim().toLowerCase());
}

export default function PeakChallengePage() {
  const router = useRouter();
  const { session, syncVersion, user } = useAuth();
  const [leaderboard, setLeaderboard] = useState<PeakChallengeLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState("");
  const allQuestions = useMemo(() => getQuestionBankBySubjectFilter("全部"), []);

  const { practiceSnapshot, wrongPoolCandidates, peakDoneQuestionIds, practicedSubjects } = useMemo(() => {
    const sessions = loadCompletedSessions();
    const practiceSessions = sessions.filter(
      (sessionItem) =>
        sessionItem.settings?.mode !== "simulation" &&
        sessionItem.settings?.mode !== "custom_paper" &&
        sessionItem.settings?.mode !== "peak_challenge" &&
        sessionItem.settings?.customPoolLabel !== "模擬考錯題庫" &&
        sessionItem.settings?.customPoolLabel !== "自訂卷錯題庫" &&
        sessionItem.settings?.customPoolLabel !== "巔峰賽錯題庫"
    );
    const peakSessions = sessions.filter((sessionItem) => sessionItem.settings?.mode === "peak_challenge");
    const practiceItems = getReviewQuestionItems(allQuestions, practiceSessions, 120);

    return {
      practiceSnapshot: getReviewSnapshot(practiceItems),
      wrongPoolCandidates: practiceItems.map((item) => ({
        questionId: item.question.id,
        subject: item.question.subject,
        chapter: item.question.chapter,
        section: item.question.section,
        stem: item.question.stem,
        testedConcept: item.question.testedConcept,
        riskScore: item.riskScore,
        wrongCount: item.history.wrong,
        lowConfidenceCount: item.history.lowConfidence,
        sourceType: item.question.sourceType
      })),
      peakDoneQuestionIds: Array.from(
        new Set(peakSessions.flatMap((sessionItem) => sessionItem.attempts.map((attempt) => attempt.questionId)))
      ),
      practicedSubjects: Array.from(
        new Set(
          practiceSessions
            .flatMap((sessionItem) => sessionItem.generatedQuestions?.map((question) => question.subject) ?? [])
            .filter(Boolean)
        )
      )
    };
  }, [allQuestions, syncVersion]);

  const canEnter = practiceSnapshot.total > ENTRY_THRESHOLD;
  const allowed = isAllowedEmail(user?.email);

  useEffect(() => {
    if (!allowed) {
      setLoading(false);
      return;
    }

    async function fetchLeaderboard() {
      try {
        setLoading(true);
        setError("");
        setLeaderboard(await loadPeakChallengeLeaderboard());
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : "巔峰賽榜單載入失敗");
      } finally {
        setLoading(false);
      }
    }

    void fetchLeaderboard();
  }, [allowed, syncVersion]);

  async function handleStartPeakChallenge() {
    if (!allowed) {
      setStartError("這個模式目前僅限站長帳號使用。");
      return;
    }
    if (!session?.access_token) {
      setStartError("請先登入帳號，才能開始巔峰賽。");
      return;
    }
    if (!canEnter) {
      setStartError(`目前散題錯題庫只有 ${practiceSnapshot.total} 題，超過 ${ENTRY_THRESHOLD} 題才能進入巔峰賽。`);
      return;
    }

    try {
      setStarting(true);
      setStartError("");
      const generated = await generatePeakChallengeSession({
        accessToken: session.access_token,
        visitorId: getOrCreateVisitorId() ?? "",
        wrongPoolCandidates,
        doneQuestionIds: peakDoneQuestionIds,
        desiredCount: 1,
        existingSourceBreakdown: { pastExam: 0, aiGenerated: 0 },
        practicedSubjects,
        nextQuestionIndex: 0
      });

      saveQuizSettings({
        ...DEFAULT_QUIZ_SETTINGS,
        mode: "peak_challenge",
        questionCount: generated.questionIds.length,
        subjectFilter: "全部",
        subjectFilters: practicedSubjects,
        customQuestionIds: generated.questionIds,
        customQuestionPayload: generated.questions,
        customPoolLabel: "巔峰賽錯題庫",
        feedbackMode: "none",
        peakWrongPoolCandidates: wrongPoolCandidates,
        peakSourceBreakdown: generated.sourceBreakdown
      });

      router.push("/quiz?new=1");
    } catch (generateError) {
      setStartError(generateError instanceof Error ? generateError.message : "巔峰賽題目產生失敗");
    } finally {
      setStarting(false);
    }
  }

  return (
    <main className="shell">
      {!allowed ? (
        <section className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">Peak Challenge</p>
          <h1 className="mt-2 text-3xl font-bold text-ink sm:text-4xl">巔峰賽模式</h1>
          <p className="mt-3 max-w-3xl text-slate-500">這個模式目前先隱藏，僅限站長帳號使用。</p>
          <div className="mt-6">
            <Link
              href="/"
              className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-slate-100 px-5 py-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-200"
            >
              返回首頁
            </Link>
          </div>
        </section>
      ) : (
        <>
      <section className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">Peak Challenge</p>
            <h1 className="mt-2 text-3xl font-bold text-ink sm:text-4xl">巔峰賽模式</h1>
            <p className="mt-3 max-w-3xl text-slate-500">
              先看榜單。只有散題錯題庫超過 25 題的挑戰者才能開局；每次答對加 1 分，答錯立刻結束。
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void handleStartPeakChallenge()}
              disabled={starting || !canEnter || !session?.access_token}
              className="min-h-12 rounded-2xl bg-rose-600 px-5 py-4 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {starting ? "巔峰賽生成中..." : "開始巔峰賽"}
            </button>
            <Link
              href="/peak-review"
              className="min-h-12 rounded-2xl bg-slate-100 px-5 py-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-200"
            >
              巔峰賽錯題庫
            </Link>
            <Link
              href="/"
              className="min-h-12 rounded-2xl bg-slate-100 px-5 py-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-200"
            >
              返回首頁
            </Link>
          </div>
        </div>
        {startError ? (
          <div className="mt-4 rounded-2xl bg-rose-50 p-4 text-sm text-rose-900">{startError}</div>
        ) : null}
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <article className="rounded-3xl bg-rose-50 p-5 text-rose-900">
          <p className="text-sm font-medium">散題錯題庫</p>
          <p className="mt-2 text-3xl font-bold">{practiceSnapshot.total}</p>
          <p className="mt-2 text-sm">超過 {ENTRY_THRESHOLD} 題才可進入</p>
        </article>
        <article className="rounded-3xl bg-amber-50 p-5 text-amber-900">
          <p className="text-sm font-medium">你已做過的巔峰賽題目</p>
          <p className="mt-2 text-3xl font-bold">{peakDoneQuestionIds.length}</p>
          <p className="mt-2 text-sm">新開局會優先避開這些題</p>
        </article>
      </section>

      <section className="mt-8 rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">Leaderboard</p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">巔峰賽榜單</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              依個人最高分排序；同分時再看平均分與挑戰次數。
            </p>
          </div>
        </div>

        {loading ? (
          <p className="mt-6 text-sm text-slate-500">載入巔峰賽榜單中...</p>
        ) : error ? (
          <div className="mt-6 rounded-2xl bg-rose-50 p-4 text-sm text-rose-900">{error}</div>
        ) : leaderboard.length === 0 ? (
          <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
            目前還沒有巔峰賽紀錄，等第一位挑戰者開局。
          </div>
        ) : (
          <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200">
            <div className="grid grid-cols-[72px_minmax(0,1fr)_96px_96px_96px] gap-3 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              <span>排名</span>
              <span>挑戰者</span>
              <span>最高分</span>
              <span>平均分</span>
              <span>挑戰次數</span>
            </div>
            <div className="divide-y divide-slate-100">
              {leaderboard.slice(0, 30).map((entry, index) => (
                <div
                  key={`${entry.userEmail ?? entry.label}-${index}`}
                  className="grid grid-cols-[72px_minmax(0,1fr)_96px_96px_96px] gap-3 px-4 py-4 text-sm text-slate-700"
                >
                  <span className="font-semibold text-slate-500">#{index + 1}</span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink">{entry.label}</p>
                    {entry.latestCompletedAt ? (
                      <p className="mt-1 text-xs text-slate-500">
                        最近挑戰 {new Date(entry.latestCompletedAt).toLocaleString("zh-TW", {
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </p>
                    ) : null}
                  </div>
                  <span className="font-bold text-rose-700">{entry.bestScore}</span>
                  <span>{entry.averageScore}</span>
                  <span>{entry.runCount}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
        </>
      )}
    </main>
  );
}
