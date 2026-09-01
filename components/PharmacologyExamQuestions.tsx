"use client";

import { ChevronDown, ExternalLink } from "lucide-react";
import { useMemo, useState } from "react";
import { PharmacologyExamPeriodSummary } from "@/components/PharmacologyExamPeriodSummary";
import { QuestionOptionBlock, QuestionStemBlock } from "@/components/QuestionMediaBlock";
import { SavedQuestionButton } from "@/components/SavedQuestionButton";
import { StructuredExplanationText } from "@/components/StructuredExplanationText";
import {
  getPharmacologyExamPeriods,
  sortPharmacologyLibraryExams,
  type PharmacologyLibraryExam
} from "@/lib/pharmacologyLibrary";
import type { OptionKey, Question } from "@/types/quiz";

const OPTION_KEYS = ["A", "B", "C", "D", "E"] as const;

function getAnswerLabel(question: Question) {
  if (
    (question.answerCreditType === "multiple_accepted" || question.answerCreditType === "multiple_answers") &&
    question.acceptedAnswers?.length
  ) {
    return `${question.acceptedAnswers.join("/")} 皆可`;
  }

  if (question.answerCreditType === "all_credit") return "本題一律給分";
  return question.answer;
}

export function PharmacologyExamQuestions({
  exams,
  heading = "國考題目",
  showEmpty = false
}: {
  exams: readonly PharmacologyLibraryExam[];
  heading?: string;
  showEmpty?: boolean;
}) {
  const sortedExams = useMemo(() => sortPharmacologyLibraryExams(exams), [exams]);
  const [openExamId, setOpenExamId] = useState<string | null>(null);
  const [questionCache, setQuestionCache] = useState<Record<string, Question>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [errorById, setErrorById] = useState<Record<string, string>>({});
  const [revealedAnswerIds, setRevealedAnswerIds] = useState<Record<string, boolean>>({});

  async function toggleExam(exam: PharmacologyLibraryExam) {
    if (openExamId === exam.id) {
      setOpenExamId(null);
      return;
    }

    setOpenExamId(exam.id);
    setRevealedAnswerIds((current) => ({ ...current, [exam.id]: false }));
    if (questionCache[exam.id] || loadingId === exam.id) return;

    setLoadingId(exam.id);
    setErrorById((current) => ({ ...current, [exam.id]: "" }));

    try {
      const response = await fetch(`/api/pharmacology-review/questions?ids=${encodeURIComponent(exam.id)}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = (await response.json()) as { questions?: Question[] };
      const question = payload.questions?.[0];
      if (!question) throw new Error("missing question");
      setQuestionCache((current) => ({ ...current, [exam.id]: question }));
    } catch {
      setErrorById((current) => ({ ...current, [exam.id]: "站內暫時找不到這題，請稍後再試。" }));
    } finally {
      setLoadingId((current) => (current === exam.id ? null : current));
    }
  }

  if (sortedExams.length === 0) {
    return showEmpty ? (
      <p className="text-sm font-semibold text-slate-500">目前沒有可連結的站內考題。</p>
    ) : null;
  }

  const openExam = sortedExams.find((exam) => exam.id === openExamId) ?? null;
  const openQuestion = openExam ? questionCache[openExam.id] : null;
  const isAnswerRevealed = openExam ? Boolean(revealedAnswerIds[openExam.id]) : false;

  return (
    <section className="overflow-hidden rounded-2xl border border-amber-200/80 bg-white" aria-label={heading}>
      <div className="border-b border-amber-100 bg-amber-50/70 px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-black text-ink">{heading}</h3>
          <p className="text-xs font-bold tabular-nums text-slate-500">
            {getPharmacologyExamPeriods(sortedExams).length} 個考期 · {sortedExams.length} 題
          </p>
        </div>
        <p className="mt-1 text-xs font-semibold text-slate-600">先選考期看題目，答案不會直接顯示。</p>
      </div>

      <ul className="flex flex-wrap gap-2 px-4 py-3 sm:px-5" aria-label="考題考期">
        {sortedExams.map((exam) => {
          const isOpen = openExamId === exam.id;
          return (
            <li key={exam.id}>
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={`pharmacology-exam-${exam.id}`}
                onClick={() => void toggleExam(exam)}
                className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 ${
                  isOpen
                    ? "bg-slate-950 text-white"
                    : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-amber-50 hover:text-amber-950 hover:ring-amber-200"
                }`}
              >
                <span className="font-black tabular-nums">{exam.period}</span>
                <span className={isOpen ? "text-slate-300" : "text-slate-500"}>第 {exam.questionNo} 題</span>
                <span className={isOpen ? "text-amber-200" : "text-amber-800"}>
                  {exam.verificationStatus === "verified_exam_target" ? "考點" : "曾出現"}
                </span>
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>

      {openExam ? (
        <div id={`pharmacology-exam-${openExam.id}`} className="border-t border-slate-200 px-4 py-4 sm:px-5 sm:py-5">
          {loadingId === openExam.id ? (
            <p className="text-sm font-bold text-slate-500" role="status" aria-live="polite">正在載入考題…</p>
          ) : errorById[openExam.id] ? (
            <p className="text-sm font-bold text-rose-700" role="alert">{errorById[openExam.id]}</p>
          ) : openQuestion ? (
            <article className="min-w-0">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black tabular-nums text-amber-800">
                    {openExam.period} · 第 {openExam.questionNo} 題
                  </p>
                  <p className="mt-1 text-[11px] font-semibold text-slate-500">{openExam.id}</p>
                </div>
                <SavedQuestionButton questionId={openQuestion.id} source="review" showLabel />
              </div>

              <QuestionStemBlock question={openQuestion} className="mt-4 text-sm leading-7" />
              <div className="mt-4 grid gap-2.5">
                {OPTION_KEYS.filter((key) => typeof openQuestion.options[key] === "string").map((key) => (
                  <QuestionOptionBlock
                    key={`${openQuestion.id}-${key}`}
                    question={openQuestion}
                    optionKey={key}
                    wrapperClassName="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-3 sm:px-4"
                  />
                ))}
              </div>

              {!isAnswerRevealed ? (
                <div className="mt-4 flex justify-center">
                  <button
                    type="button"
                    onClick={() => setRevealedAnswerIds((current) => ({ ...current, [openExam.id]: true }))}
                    className="min-h-11 rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
                  >
                    顯示答案與詳解
                  </button>
                </div>
              ) : (
                <div className="mt-4 space-y-4 border-t border-slate-200 pt-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-950 ring-1 ring-emerald-200">
                    <p><span className="font-semibold">正確答案：</span><strong className="ml-1 text-base">{getAnswerLabel(openQuestion)}</strong></p>
                    <div className="flex flex-wrap gap-3 text-xs font-bold">
                      {openExam.questionUrl ? (
                        <a href={openExam.questionUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline underline-offset-2">
                          官方題本 <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        </a>
                      ) : null}
                      {openExam.answerUrl ? (
                        <a href={openExam.answerUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline underline-offset-2">
                          官方答案 <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        </a>
                      ) : null}
                    </div>
                  </div>
                  <StructuredExplanationText text={openQuestion.explanation} label="詳解" compact />
                  {openQuestion.optionAnalysis ? (
                    <div className="grid gap-2.5">
                      {OPTION_KEYS.map((key) => {
                        const text = openQuestion.optionAnalysis?.[key as OptionKey];
                        if (!text) return null;
                        return (
                          <div key={`${openQuestion.id}-analysis-${key}`} className="rounded-xl bg-slate-50 px-3 py-3 text-sm leading-6 text-slate-700 ring-1 ring-slate-200">
                            <span className="mr-2 font-black text-ink">{key}.</span>{text}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              )}
            </article>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
