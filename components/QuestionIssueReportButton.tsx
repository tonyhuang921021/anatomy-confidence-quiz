"use client";

import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { submitQuestionIssueReport } from "@/lib/questionIssueReport";
import type { Question } from "@/types/quiz";

const QUESTION_ISSUE_OPTIONS = [
  { value: "stem_layout", label: "題幹跑版 / OCR 錯字" },
  { value: "official_multiple_answers", label: "官方多重答案或給分疑義" },
  { value: "option_wording", label: "選項敘述問題" },
  { value: "answer_key", label: "答案疑似錯誤" },
  { value: "image_table", label: "圖片或表格問題" },
  { value: "other", label: "其他" }
] as const;

type QuestionIssueReportButtonProps = {
  question: Question;
  disabled?: boolean;
};

type QuestionReportButtonProps = QuestionIssueReportButtonProps & {
  classificationLoading?: boolean;
  classificationMessage?: string;
  onReportClassification?: () => void;
};

export function QuestionReportButton({
  question,
  disabled = false,
  classificationLoading = false,
  classificationMessage = "",
  onReportClassification
}: QuestionReportButtonProps) {
  const { session } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [activeFlow, setActiveFlow] = useState<"choice" | "issue">("choice");
  const [issueCategory, setIssueCategory] = useState<string>("");
  const [issueNote, setIssueNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!session?.access_token) {
      setError("請先登入帳號，才能回報此題題目瑕疵。");
      return;
    }

    if (!issueCategory) {
      setError("請先選一個瑕疵原因，站長才知道要從哪裡開刀。");
      return;
    }

    setIsSubmitting(true);
    setError("");
    setMessage("");

    try {
      const payload = await submitQuestionIssueReport(question, session.access_token, {
        issueCategory,
        issueNote: issueNote.trim()
      });
      setMessage(payload.message ?? "已回報題目瑕疵，謝謝你幫忙補主訴。");
      setIssueCategory("");
      setIssueNote("");
      setIsOpen(false);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "題目瑕疵回報送出失敗。");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setIsOpen(true);
          setActiveFlow("choice");
          setError("");
        }}
        disabled={disabled || isSubmitting || classificationLoading}
        className="min-h-10 rounded-2xl bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900 ring-1 ring-amber-100 transition hover:bg-amber-100 disabled:cursor-wait disabled:opacity-60"
      >
        {isSubmitting || classificationLoading ? "回報中..." : "回報"}
      </button>
      {message ? <p className="basis-full text-sm font-medium text-slate-600">{message}</p> : null}
      {classificationMessage ? (
        <p className="basis-full text-sm font-medium text-slate-600">{classificationMessage}</p>
      ) : null}

      {isOpen ? (
        <div className="fixed inset-0 z-[140] flex items-center justify-center overflow-y-auto bg-slate-950/40 px-4 py-6">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="回報題目問題"
            className="max-h-[calc(100vh-3rem)] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl ring-1 ring-slate-200"
          >
            <div className="space-y-2">
              <h2 className="text-xl font-black text-slate-950">回報這題</h2>
              <p className="text-sm leading-6 text-slate-600">
                先選你看到的問題類型，我會把它送到對應的待修清單。
              </p>
            </div>

            {activeFlow === "choice" ? (
              <div className="mt-4 grid gap-3">
                <button
                  type="button"
                  onClick={() => {
                    onReportClassification?.();
                    setIsOpen(false);
                  }}
                  disabled={!onReportClassification || classificationLoading}
                  className="rounded-2xl bg-slate-50 px-4 py-4 text-left ring-1 ring-slate-100 transition hover:bg-slate-100 disabled:cursor-wait disabled:opacity-60"
                >
                  <span className="block text-sm font-black text-slate-950">分類錯誤</span>
                  <span className="mt-1 block text-xs font-semibold leading-5 text-slate-500">
                    科目、章節、小節或題目歸類放錯。
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveFlow("issue");
                    setError("");
                  }}
                  className="rounded-2xl bg-amber-50 px-4 py-4 text-left ring-1 ring-amber-100 transition hover:bg-amber-100"
                >
                  <span className="block text-sm font-black text-amber-950">題目有瑕疵</span>
                  <span className="mt-1 block text-xs font-semibold leading-5 text-amber-800">
                    題幹、選項、答案、圖片或表格需要修。
                  </span>
                </button>
              </div>
            ) : (
              <>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {QUESTION_ISSUE_OPTIONS.map((option) => {
                    const selected = issueCategory === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          setIssueCategory(option.value);
                          setError("");
                        }}
                        className={[
                          "rounded-2xl px-3 py-3 text-left text-sm font-bold ring-1 transition",
                          selected
                            ? "bg-amber-100 text-amber-950 ring-amber-300"
                            : "bg-slate-50 text-slate-700 ring-slate-100 hover:bg-slate-100"
                        ].join(" ")}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>

                <label className="mt-4 block text-sm font-bold text-slate-700" htmlFor={`question-issue-note-${question.id}`}>
                  補充理由
                </label>
                <textarea
                  id={`question-issue-note-${question.id}`}
                  value={issueNote}
                  onChange={(event) => setIssueNote(event.target.value)}
                  rows={4}
                  className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-800 outline-none transition focus:border-amber-300 focus:ring-4 focus:ring-amber-100"
                  placeholder="例如：題幹少一段、官方公告 A/B 都給分、C 選項的單位怪怪的..."
                />
              </>
            )}

            {error ? <p className="mt-3 text-sm font-medium text-rose-700">{error}</p> : null}

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              {activeFlow === "issue" ? (
                <button
                  type="button"
                  onClick={() => {
                    setActiveFlow("choice");
                    setError("");
                  }}
                  disabled={isSubmitting}
                  className="min-h-10 rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
                >
                  返回
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setError("");
                }}
                disabled={isSubmitting}
                className="min-h-10 rounded-2xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 disabled:cursor-wait disabled:opacity-60"
              >
                取消
              </button>
              {activeFlow === "issue" ? (
                <button
                  type="button"
                  onClick={() => void handleSubmit()}
                  disabled={isSubmitting || !issueCategory}
                  className="min-h-10 rounded-2xl bg-amber-500 px-4 py-2 text-sm font-black text-white transition hover:bg-amber-600 disabled:cursor-wait disabled:opacity-60"
                >
                  {isSubmitting ? "送出中..." : "送出回報"}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function QuestionIssueReportButton(props: QuestionIssueReportButtonProps) {
  return <QuestionReportButton {...props} />;
}
