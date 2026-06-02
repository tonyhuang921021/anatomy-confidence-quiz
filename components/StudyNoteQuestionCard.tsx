"use client";

import { useState } from "react";
import type { Question, StudyNoteQuestionLink } from "@/types/quiz";

type Props = {
  question?: Question;
  link?: StudyNoteQuestionLink;
  title?: string;
};

export function StudyNoteQuestionCard({ question, link, title }: Props) {
  const [showQuestion, setShowQuestion] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);

  if (!question) {
    return (
      <div className="study-note-question-card my-5 rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-500">
        找不到這題：{link?.questionId ?? title ?? "未指定題號"}
      </div>
    );
  }

  const optionEntries = Object.entries(question.options).filter(([, value]) => Boolean(value));

  return (
    <div className="study-note-question-card my-5 rounded-3xl border border-teal-100 bg-teal-50/70 p-3 shadow-sm">
      <button
        type="button"
        onClick={() => setShowQuestion((value) => !value)}
        className="flex w-full items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 text-left"
      >
        <span>
          <span className="block text-xs font-bold uppercase tracking-[0.18em] text-teal-700">Related Question</span>
          <span className="mt-1 block text-sm font-bold text-slate-950">
            {title || question.testedConcept || question.id}
          </span>
        </span>
        <span className="rounded-full bg-teal-100 px-3 py-1 text-xs font-bold text-teal-800">
          {showQuestion ? "收合" : "看題目"}
        </span>
      </button>

      {showQuestion ? (
        <div className="mt-3 rounded-2xl bg-white p-4 text-sm leading-7 text-slate-700">
          <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-500">
            <span>{question.id}</span>
            <span>{question.subject}</span>
            <span>{question.chapter}</span>
            <span>{question.section}</span>
          </div>
          <p className="mt-3 font-semibold text-slate-900">{question.stem}</p>
          <div className="mt-3 grid gap-2">
            {optionEntries.map(([key, value]) => (
              <p key={key} className="rounded-2xl bg-slate-50 px-3 py-2">
                <span className="font-bold text-slate-950">{key}. </span>
                {value}
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
          {showAnswer ? (
            <div className="mt-3 rounded-2xl bg-slate-950 px-4 py-3 text-sm leading-7 text-white">
              <p className="font-bold">答案：{question.answer}</p>
              <p className="mt-2 text-slate-100">{question.explanation}</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
