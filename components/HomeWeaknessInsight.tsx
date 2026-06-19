"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { getQuestionBankBySubjectFilter } from "@/data/med1QuestionBank";
import { loadCompletedSessions } from "@/lib/storage";
import type { QuizSession } from "@/types/quiz";

type WeakSectionInsight = {
  chapter: string;
  section: string;
  total: number;
  wrong: number;
  correctRate: number;
  wrongRate: number;
  lowConfidence: number;
  overconfidence: number;
  evidenceScore: number;
};

const MIN_TOTAL_ATTEMPTS_FOR_DIAGNOSIS = 10;
const MIN_SECTION_ATTEMPTS_FOR_DIAGNOSIS = 2;
const WEAKNESS_ROTATION_INTERVAL_MS = 6 * 60 * 60 * 1000;
const MAX_ROTATING_WEAK_SECTIONS = 5;
const MAX_HOME_WEAKNESS_SESSIONS = 80;
const MAX_HOME_WEAKNESS_ATTEMPTS = 500;

function round(value: number) {
  return Math.round(value * 10) / 10;
}

function getWeakSectionInsight(sessions: QuizSession[]): {
  totalAttempts: number;
  insights: WeakSectionInsight[];
} {
  const questions = getQuestionBankBySubjectFilter("全部");
  const questionMap = new Map(questions.map((question) => [question.id, question] as const));
  const sectionMap = new Map<string, WeakSectionInsight>();
  let totalAttempts = 0;

  function trackAttempt(attempt: QuizSession["attempts"][number]) {
    const question = questionMap.get(attempt.questionId);
    if (!question) return;
    totalAttempts += 1;

    const key = `${question.chapter}__${question.section}`;
    const current =
      sectionMap.get(key) ??
      ({
        chapter: question.chapter,
        section: question.section,
        total: 0,
        wrong: 0,
        correctRate: 0,
        wrongRate: 0,
        lowConfidence: 0,
        overconfidence: 0,
        evidenceScore: 0
      } satisfies WeakSectionInsight);

    current.total += 1;
    current.wrong += attempt.isCorrect ? 0 : 1;
    current.lowConfidence += attempt.confidence <= 2 ? 1 : 0;
    current.overconfidence += !attempt.isCorrect && attempt.confidence >= 4 ? 1 : 0;
    sectionMap.set(key, current);
  }

  for (
    let sessionIndex = sessions.length - 1, visitedSessions = 0;
    sessionIndex >= 0 && visitedSessions < MAX_HOME_WEAKNESS_SESSIONS && totalAttempts < MAX_HOME_WEAKNESS_ATTEMPTS;
    sessionIndex -= 1, visitedSessions += 1
  ) {
    const attempts = sessions[sessionIndex].attempts;
    for (
      let attemptIndex = attempts.length - 1;
      attemptIndex >= 0 && totalAttempts < MAX_HOME_WEAKNESS_ATTEMPTS;
      attemptIndex -= 1
    ) {
      trackAttempt(attempts[attemptIndex]);
    }
  }

  const ranked = Array.from(sectionMap.values())
    .filter((item) => item.total >= MIN_SECTION_ATTEMPTS_FOR_DIAGNOSIS)
    .map((item) => {
      const wrongRate = item.total === 0 ? 0 : round((item.wrong / item.total) * 100);
      const correctRate = item.total === 0 ? 0 : round(100 - wrongRate);
      const lowConfidenceRate = item.total === 0 ? 0 : (item.lowConfidence / item.total) * 100;
      const overconfidenceRate = item.total === 0 ? 0 : (item.overconfidence / item.total) * 100;
      const evidenceScore =
        wrongRate * 0.62 +
        lowConfidenceRate * 0.24 +
        overconfidenceRate * 0.14 +
        Math.min(item.total, 8) * 1.8;

      return {
        ...item,
        correctRate,
        wrongRate,
        evidenceScore: round(evidenceScore)
      };
    })
    .sort(
      (a, b) =>
        b.evidenceScore - a.evidenceScore ||
        b.wrongRate - a.wrongRate ||
        b.total - a.total ||
        a.section.localeCompare(b.section)
    );

  return {
    totalAttempts,
    insights: totalAttempts >= MIN_TOTAL_ATTEMPTS_FOR_DIAGNOSIS ? ranked : []
  };
}

function getWeaknessRotationBucket() {
  return Math.floor(Date.now() / WEAKNESS_ROTATION_INTERVAL_MS);
}

function getNextWeaknessRotationDelay() {
  const nextBoundary = (getWeaknessRotationBucket() + 1) * WEAKNESS_ROTATION_INTERVAL_MS;
  return Math.max(nextBoundary - Date.now(), 60_000);
}

export function HomeWeaknessInsight() {
  const { syncVersion } = useAuth();
  const [sessions, setSessions] = useState<QuizSession[]>([]);
  const [rotationBucket, setRotationBucket] = useState(getWeaknessRotationBucket);

  useEffect(() => {
    function refreshSessions() {
      setSessions(loadCompletedSessions());
    }

    refreshSessions();
    window.addEventListener("completed-sessions-change", refreshSessions as EventListener);
    return () => {
      window.removeEventListener("completed-sessions-change", refreshSessions as EventListener);
    };
  }, [syncVersion]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setRotationBucket(getWeaknessRotationBucket());
    }, getNextWeaknessRotationDelay());

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [rotationBucket]);

  const { totalAttempts, insights } = useMemo(() => getWeakSectionInsight(sessions), [sessions]);
  const insight = useMemo(() => {
    if (insights.length === 0) return null;
    const rotatingPool = insights.slice(0, MAX_ROTATING_WEAK_SECTIONS);
    return rotatingPool[rotationBucket % rotatingPool.length] ?? rotatingPool[0] ?? null;
  }, [insights, rotationBucket]);
  const neededAttempts = Math.max(MIN_TOTAL_ATTEMPTS_FOR_DIAGNOSIS - totalAttempts, 0);

  if (!insight) {
    return (
      <div className="home-progress-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-slate-500">資料累積中</p>
            <h3 className="mt-1 text-base font-black text-ink">先作答，首頁才會判讀弱點</h3>
          </div>
          <span className="home-entry-mark">{totalAttempts} 題</span>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/70">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-500 to-amber-500 transition-all"
            style={{
              width: `${Math.min((totalAttempts / MIN_TOTAL_ATTEMPTS_FOR_DIAGNOSIS) * 100, 100)}%`
            }}
          />
        </div>
        <p className="body-soft mt-3 text-xs leading-6">
          至少累積 {MIN_TOTAL_ATTEMPTS_FOR_DIAGNOSIS} 題，且同一小節至少作答 {MIN_SECTION_ATTEMPTS_FOR_DIAGNOSIS} 題後，才會顯示「最容易漏」的判讀。
          {neededAttempts > 0 ? ` 還差 ${neededAttempts} 題。` : ""}
        </p>
        <Link href="/start" className="mt-4 inline-flex text-sm font-bold text-brand-700">
          先刷一輪 →
        </Link>
      </div>
    );
  }

  return (
    <div className="home-progress-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold text-slate-500">依你的作答紀錄判讀</p>
          <h3 className="mt-1 text-base font-black text-ink">{insight.section}</h3>
          <p className="body-soft mt-1 text-xs">{insight.chapter}</p>
        </div>
        <span className="home-entry-mark home-risk-chip">答錯率 {insight.wrongRate}%</span>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/70">
        <div
          className="home-progress-fill home-risk-fill"
          style={{ width: `${Math.max(insight.wrongRate, 8)}%` }}
        />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
        <div className="home-evidence-pill">
          <span>{insight.total}</span>
          <small>已作答</small>
        </div>
        <div className="home-evidence-pill home-evidence-risk">
          <span>{insight.wrong}</span>
          <small>答錯</small>
        </div>
        <div className="home-evidence-pill">
          <span>{insight.lowConfidence}</span>
          <small>低信心</small>
        </div>
      </div>

      <p className="body-soft mt-3 text-xs leading-6">
        依據：同小節作答數、答錯率、低信心題與錯誤自信題一起排序；不是模擬考限定。
      </p>
    </div>
  );
}
