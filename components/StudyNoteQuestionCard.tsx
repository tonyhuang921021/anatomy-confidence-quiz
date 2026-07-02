"use client";

import { useState } from "react";
import { CopyQuestionPromptButton } from "@/components/CopyQuestionPromptButton";
import { FormattedQuestionText } from "@/components/FormattedQuestionText";
import { StructuredExplanationText } from "@/components/StructuredExplanationText";
import { useAuth } from "@/components/AuthProvider";
import { YangmingExplanationPanel } from "@/components/YangmingExplanationPanel";
import { clearQuestionExplanationBackgroundCache } from "@/lib/cloudSync";
import {
  loadQuestionExplanationOverride,
  saveQuestionExplanationOverride
} from "@/lib/storage";
import { getOrCreateVisitorId } from "@/lib/visitor";
import { buildQuestionExplanationRequestQuestion } from "@/lib/questionExplanationRequest";
import type { OptionKey, Question, QuestionExplanationOverride, StudyNoteQuestionLink } from "@/types/quiz";

type Props = {
  question?: Question;
  link?: StudyNoteQuestionLink;
  title?: string;
};

export function StudyNoteQuestionCard({ question, link, title }: Props) {
  const { session } = useAuth();
  const [showQuestion, setShowQuestion] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [explanationOverride, setExplanationOverride] = useState<QuestionExplanationOverride | null>(() =>
    question ? loadQuestionExplanationOverride(question.id) ?? null : null
  );
  const [explanationLoading, setExplanationLoading] = useState(false);
  const [explanationError, setExplanationError] = useState("");

  if (!question) {
    return (
      <div className="study-note-question-card my-5 min-w-0 overflow-hidden break-words rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-500">
        找不到這題：{link?.questionId ?? title ?? "未指定題號"}
      </div>
    );
  }

  const optionEntries = Object.entries(question.options).filter(([, value]) => Boolean(value));
  const explanation = explanationOverride?.explanation || question.explanation;
  const optionAnalysis = explanationOverride?.optionAnalysis ?? question.optionAnalysis;
  const memoryTip = explanationOverride?.memoryTip ?? question.memoryTip;

  async function handleGenerateExplanation() {
    if (!question) return;
    if (!session?.access_token) {
      setExplanationError("請先登入帳號，才能使用 AI 補詳解。");
      return;
    }

    setExplanationLoading(true);
    setExplanationError("");

    try {
      const response = await fetch("/api/question-explanation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          visitorId: getOrCreateVisitorId(),
          accessToken: session.access_token,
          question: buildQuestionExplanationRequestQuestion(question),
          previousOverride: explanationOverride
        })
      });

      const payload = (await response.json()) as {
        ok: boolean;
        sharedSaved?: boolean;
        explanation?: string;
        optionAnalysis?: Partial<Record<OptionKey, string>>;
        memoryTip?: string;
        model?: string;
        message?: string;
      };

      if (!response.ok || !payload.ok || !payload.explanation) {
        if (response.status === 429 && payload.message && typeof window !== "undefined") {
          window.alert(payload.message);
        }
        setExplanationError(payload.message || "AI 詳解產生失敗。");
        return;
      }

      const override: QuestionExplanationOverride = {
        explanation: payload.explanation,
        optionAnalysis: payload.optionAnalysis ?? {},
        memoryTip: payload.memoryTip ?? "",
        model: payload.model ?? "gpt-5.4-mini",
        updatedAt: new Date().toISOString()
      };

      clearQuestionExplanationBackgroundCache(question.id);
      saveQuestionExplanationOverride(question.id, override);
      setExplanationOverride(override);
      setShowAnswer(true);
    } catch {
      setExplanationError("無法連線到 AI 詳解 API。");
    } finally {
      setExplanationLoading(false);
    }
  }

  return (
    <div className="study-note-question-card my-5 min-w-0 overflow-hidden rounded-3xl border border-teal-100 bg-teal-50/70 p-3 shadow-sm">
      <button
        type="button"
        onClick={() => setShowQuestion((value) => !value)}
        className="flex w-full items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 text-left"
      >
        <span>
          <span className="block text-xs font-bold uppercase tracking-[0.18em] text-teal-700">Related Question</span>
          <span className="mt-1 block text-sm font-bold text-slate-950">
            {title || question.stem || question.id}
          </span>
        </span>
        <span className="rounded-full bg-teal-100 px-3 py-1 text-xs font-bold text-teal-800">
          {showQuestion ? "收合" : "看題目"}
        </span>
      </button>

      {showQuestion ? (
        <div className="mt-3 min-w-0 overflow-hidden break-words rounded-2xl bg-white p-4 text-sm leading-7 text-slate-700">
          <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-500">
            <span>{question.id}</span>
            <span>{question.subject}</span>
            <span>{question.chapter}</span>
            <span>{question.section}</span>
          </div>
          <p className="mt-3 break-words font-semibold text-slate-900">
            <FormattedQuestionText text={question.stem} />
          </p>
          <div className="mt-3 grid gap-2">
            {optionEntries.map(([key, value]) => (
              <p key={key} className="break-words rounded-2xl bg-slate-50 px-3 py-2">
                <span className="font-bold text-slate-950">{key}. </span>
                <FormattedQuestionText text={value} />
              </p>
            ))}
          </div>
          {link?.reason ? (
            <p className="mt-3 rounded-2xl bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-800">
              {link.reason}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => setShowAnswer((value) => !value)}
            className="secondary-pill mt-4 px-4 py-2 text-sm"
          >
            {showAnswer ? "收合答案詳解" : "看答案與詳解"}
          </button>
          <CopyQuestionPromptButton
            question={question}
            correctAnswer={question.answer}
            compact
            className="ml-2 mt-4 align-middle"
          />
          <button
            type="button"
            onClick={() => void handleGenerateExplanation()}
            disabled={explanationLoading}
            className="secondary-pill ml-2 mt-4 px-4 py-2 text-sm disabled:opacity-60"
          >
            {explanationLoading
              ? explanationOverride
                ? "重新生成中..."
                : "AI 生成中..."
              : explanationOverride
                ? "重新替換詳解"
                : "用 AI 補詳解"}
          </button>
          {explanationError ? (
            <p className="mt-3 rounded-2xl bg-rose-50 px-3 py-2 text-xs font-semibold leading-5 text-rose-700">
              {explanationError}
            </p>
          ) : null}
          {showAnswer ? (
            <div className="mt-3 min-w-0 overflow-hidden break-words rounded-2xl bg-slate-950 px-4 py-3 text-sm leading-7 text-white">
              <p className="font-bold">答案：{question.answer}</p>
              <StructuredExplanationText
                text={explanation}
                label="詳解"
                compact
                tone="dark"
                className="mt-3"
              />
              <YangmingExplanationPanel
                questionId={question.id}
                compact
                className="mt-3"
                buttonClassName="min-h-10 rounded-2xl bg-amber-100/15 px-4 py-2 text-sm font-semibold text-amber-50 ring-1 ring-amber-100/20 transition hover:bg-amber-100/25 disabled:cursor-wait disabled:opacity-60"
              />
              {optionAnalysis && Object.keys(optionAnalysis).length > 0 ? (
                <div className="mt-3 grid gap-2">
                  {Object.entries(optionAnalysis).map(([key, value]) =>
                    value ? (
                      <p key={key} className="rounded-2xl bg-white/10 px-3 py-2">
                        <span className="font-bold text-white">{key}. </span>
                        <span className="text-slate-100">{value}</span>
                      </p>
                    ) : null
                  )}
                </div>
              ) : null}
              {memoryTip ? (
                <p className="mt-3 rounded-2xl bg-teal-400/15 px-3 py-2 text-teal-50">
                  快速記憶：{memoryTip}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
