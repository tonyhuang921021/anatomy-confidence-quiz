"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { QuestionExplanationTabs } from "@/components/QuestionExplanationTabs";
import { QuestionOptionBlock, QuestionStemBlock } from "@/components/QuestionMediaBlock";
import { QuestionPrimaryTagBadge } from "@/components/QuestionPrimaryTagBadge";
import { SavedQuestionButton } from "@/components/SavedQuestionButton";
import { StructuredExplanationText } from "@/components/StructuredExplanationText";
import { useSavedAISimulationQuestions } from "@/components/useSavedAISimulationQuestions";
import {
  applyQuestionClassificationOverride,
  getCanonicalQuestionBank
} from "@/data/med1QuestionBank";
import { getAISimulationPaperKeyFromQuestionId } from "@/lib/savedQuestionBank";
import { loadConfirmedQuestionClassificationOverrides } from "@/lib/cloudSync";
import {
  isAcceptedSavedQuestionAnswer,
  isSavedQuestionCompleted,
  recordSavedQuestionAnswer,
  removeSavedQuestionRecord,
  useSavedQuestionRecords
} from "@/lib/savedQuestions";
import {
  loadQuestionExplanationOverrides,
  mergeQuestionExplanationOverrides,
  saveQuizSettings
} from "@/lib/storage";
import { shouldDisplaySubjectBesidePrimaryTag } from "@/lib/analysisPrimaryTag";
import { buildNewQuizHref } from "@/lib/startSettingsUrl";
import { buildSavedQuestionReviewSettings } from "@/lib/savedQuestionReview";
import {
  OptionKey,
  Question,
  QuestionClassificationOverride,
  QuestionExplanationOverride,
  SavedQuestionRecord
} from "@/types/quiz";

type SavedQuestionItem = {
  question: Question;
  record: SavedQuestionRecord;
};

type SavedQuestionFeedback = {
  questionId: string;
  answer: OptionKey;
  isCorrect: boolean;
};

const OPTION_KEYS = ["A", "B", "C", "D", "E"] as OptionKey[];

function applyLocalExplanationOverride(
  question: Question,
  override?: QuestionExplanationOverride
) {
  if (!override) return question;

  return {
    ...question,
    explanation: override.explanation || question.explanation,
    optionAnalysis: override.optionAnalysis ?? question.optionAnalysis,
    memoryTip: override.memoryTip ?? question.memoryTip
  };
}

function getOptionKeys(question: Question) {
  return OPTION_KEYS.filter((key) => typeof question.options[key] === "string");
}

function formatSavedDate(value?: string) {
  if (!value) return "尚未作答";
  return new Date(value).toLocaleString("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getSourceLabel(question: Question) {
  if (question.sourceType === "MOEX_PAST_EXAM") {
    return [
      question.sourceYear,
      question.sourceRound ? `第 ${question.sourceRound} 次` : "",
      question.originalQuestionNumber ? `第 ${question.originalQuestionNumber} 題` : ""
    ].filter(Boolean).join(" ");
  }

  if (question.sourceType === "AI_GENERATED" || question.source === "ai-generated") {
    return getAISimulationPaperKeyFromQuestionId(question.id) ? "AI 模擬卷" : "AI 補題";
  }

  return "本地題庫";
}

export default function SavedQuestionsPage() {
  const { session } = useAuth();
  const savedQuestionRecords = useSavedQuestionRecords(session?.access_token);
  const [classificationOverrides, setClassificationOverrides] = useState<Record<string, QuestionClassificationOverride>>({});
  const [explanationOverrides, setExplanationOverrides] = useState<Record<string, QuestionExplanationOverride>>({});
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<OptionKey | null>(null);
  const [feedback, setFeedback] = useState<SavedQuestionFeedback | null>(null);
  const savedQuestionIds = useMemo(
    () => Object.keys(savedQuestionRecords),
    [savedQuestionRecords]
  );
  const {
    questions: savedAISimulationQuestions,
    isLoading: savedAISimulationQuestionsLoading
  } = useSavedAISimulationQuestions(savedQuestionIds);

  useEffect(() => {
    setExplanationOverrides((current) =>
      mergeQuestionExplanationOverrides(current, loadQuestionExplanationOverrides())
    );
  }, []);

  useEffect(() => {
    void loadConfirmedQuestionClassificationOverrides()
      .then((overrides) => setClassificationOverrides(overrides))
      .catch(() => {
        // Keep static bank if classification override fetch fails.
      });
  }, []);

  const questionById = useMemo(() => {
    const questions = [
      ...getCanonicalQuestionBank(classificationOverrides),
      ...savedAISimulationQuestions
    ];
    return new Map(
      questions.map((question) => [
        question.id,
        applyLocalExplanationOverride(
          applyQuestionClassificationOverride(question, classificationOverrides[question.id]),
          explanationOverrides[question.id]
        )
      ] as const)
    );
  }, [classificationOverrides, explanationOverrides, savedAISimulationQuestions]);

  const savedItems = useMemo<SavedQuestionItem[]>(
    () =>
      Object.values(savedQuestionRecords)
        .map((record) => {
          const question = questionById.get(record.questionId);
          return question ? { question, record } : null;
        })
        .filter((item): item is SavedQuestionItem => Boolean(item))
        .sort((left, right) => {
          const leftDone = isSavedQuestionCompleted(left.record);
          const rightDone = isSavedQuestionCompleted(right.record);
          if (leftDone !== rightDone) return leftDone ? 1 : -1;
          return right.record.addedAt.localeCompare(left.record.addedAt);
        }),
    [questionById, savedQuestionRecords]
  );

  const missingQuestionCount = savedAISimulationQuestionsLoading
    ? 0
    : Math.max(0, Object.keys(savedQuestionRecords).length - savedItems.length);
  const activeItems = useMemo(
    () => savedItems.filter((item) => !isSavedQuestionCompleted(item.record)),
    [savedItems]
  );
  const savedRecordList = useMemo(
    () => Object.values(savedQuestionRecords),
    [savedQuestionRecords]
  );
  const completedRecordCount = useMemo(
    () => savedRecordList.filter(isSavedQuestionCompleted).length,
    [savedRecordList]
  );
  const activeRecordCount = savedRecordList.length - completedRecordCount;
  const savedQuestionReviewSettings = useMemo(
    () => buildSavedQuestionReviewSettings(activeItems.map((item) => item.question)),
    [activeItems]
  );
  const savedQuestionReviewHref = useMemo(
    () => buildNewQuizHref(savedQuestionReviewSettings),
    [savedQuestionReviewSettings]
  );
  const selectedItem = useMemo(
    () =>
      savedItems.find((item) => item.question.id === selectedQuestionId) ??
      activeItems[0] ??
      savedItems[0] ??
      null,
    [activeItems, savedItems, selectedQuestionId]
  );

  useEffect(() => {
    if (!selectedItem) {
      setSelectedQuestionId(null);
      setSelectedAnswer(null);
      setFeedback(null);
      return;
    }

    if (selectedQuestionId !== selectedItem.question.id) {
      setSelectedQuestionId(selectedItem.question.id);
      setSelectedAnswer(null);
      setFeedback(null);
    }
  }, [selectedItem, selectedQuestionId]);

  function handleSelectQuestion(questionId: string) {
    setSelectedQuestionId(questionId);
    setSelectedAnswer(null);
    setFeedback(null);
  }

  function handleSubmitAnswer() {
    if (!selectedItem || !selectedAnswer) return;
    const isCorrect = isAcceptedSavedQuestionAnswer(selectedItem.question, selectedAnswer);
    recordSavedQuestionAnswer(selectedItem.question.id, isCorrect, session?.access_token);
    setFeedback({
      questionId: selectedItem.question.id,
      answer: selectedAnswer,
      isCorrect
    });
  }

  function handleRemoveQuestion(questionId: string) {
    removeSavedQuestionRecord(questionId, session?.access_token);
    if (selectedQuestionId === questionId) {
      setSelectedQuestionId(null);
      setSelectedAnswer(null);
      setFeedback(null);
    }
  }

  return (
    <main id="main-content" className="shell workspace-page">
      <section className="surface-card workspace-page-panel workspace-page-header p-5 sm:p-7">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="min-w-0">
            <p className="workspace-page-kicker">題庫</p>
            <h1 className="workspace-page-title">儲存題目</h1>
            <p className="mt-3 text-sm leading-7 text-slate-500">
              {activeRecordCount > 0
                ? `還有 ${activeRecordCount} 題待練，${completedRecordCount} 題已答對兩次。`
                : savedRecordList.length > 0
                  ? "目前儲存題都答對兩次了。"
                  : "看到想補的題目，就按書籤放進來。"}
            </p>
          </div>
          <div className="workspace-compact-actions w-full justify-end sm:w-auto">
            <Link
              href={savedQuestionReviewHref}
              onClick={(event) => {
                if (activeItems.length === 0 || savedAISimulationQuestionsLoading) {
                  event.preventDefault();
                  return;
                }
                saveQuizSettings(savedQuestionReviewSettings);
              }}
              aria-disabled={activeItems.length === 0 || savedAISimulationQuestionsLoading}
              className={`w-full text-center text-sm font-semibold transition ${
                activeItems.length === 0 || savedAISimulationQuestionsLoading
                  ? "pointer-events-none bg-slate-200 text-slate-500"
                  : "bg-brand-600 text-white hover:bg-brand-700"
              }`}
            >
              {savedAISimulationQuestionsLoading ? "正在整理儲存題目" : "開始儲存題目複習"}
            </Link>
          </div>
        </div>
      </section>

      <section className="saved-summary-strip mt-5">
        <article className="saved-summary-item">
          <p className="text-sm font-semibold text-slate-500">全部儲存</p>
          <p className="mt-2 text-3xl font-bold text-ink">{savedRecordList.length}</p>
        </article>
        <article className="saved-summary-item text-amber-900">
          <p className="text-sm font-semibold">待練題目</p>
          <p className="mt-2 text-3xl font-bold">{activeRecordCount}</p>
        </article>
        <article className="saved-summary-item text-emerald-900">
          <p className="text-sm font-semibold">已答對兩次</p>
          <p className="mt-2 text-3xl font-bold">{completedRecordCount}</p>
        </article>
      </section>

      {missingQuestionCount > 0 ? (
        <section className="mt-5 rounded-[10px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
          有 {missingQuestionCount} 題暫時不在目前題庫版本裡，先保留儲存紀錄。
        </section>
      ) : null}

      <section className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          {selectedItem ? (
            <article className="workspace-section saved-practice-panel">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap gap-2 text-xs font-semibold">
                    {shouldDisplaySubjectBesidePrimaryTag(selectedItem.question) ? (
                      <span className="rounded-full bg-brand-100 px-3 py-1 text-brand-800">
                        {selectedItem.question.subject}
                      </span>
                    ) : null}
                    <QuestionPrimaryTagBadge question={selectedItem.question} />
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                      {getSourceLabel(selectedItem.question)}
                    </span>
                    <span className="rounded-full bg-white px-3 py-1 text-slate-600 ring-1 ring-slate-200">
                      答對 {selectedItem.record.correctCount} / 2
                    </span>
                  </div>
                  <p className="mt-3 text-xs font-semibold text-slate-400">{selectedItem.question.id}</p>
                </div>
                <SavedQuestionButton questionId={selectedItem.question.id} source="saved" showLabel />
              </div>

              <div className="mt-5">
                <QuestionStemBlock question={selectedItem.question} className="text-base font-semibold leading-8 text-ink" />
              </div>

              <div className="mt-5 grid gap-3">
                {getOptionKeys(selectedItem.question).map((key) => {
                  const selected = selectedAnswer === key;
                  const feedbackForThisQuestion =
                    feedback?.questionId === selectedItem.question.id ? feedback : null;
                  const isCorrectOption = isAcceptedSavedQuestionAnswer(selectedItem.question, key);
                  const isWrongSelected = feedbackForThisQuestion?.answer === key && !feedbackForThisQuestion.isCorrect;
                  const showCorrect = Boolean(feedbackForThisQuestion) && isCorrectOption;
                  const optionClassName = isWrongSelected
                    ? "border-rose-300 bg-rose-50"
                    : showCorrect
                      ? "border-emerald-300 bg-emerald-50"
                      : selected
                        ? "border-slate-900 bg-white"
                        : "border-slate-200 bg-white hover:border-brand-200 hover:bg-brand-50/40";

                  return (
                    <button
                      key={`${selectedItem.question.id}-saved-${key}`}
                      type="button"
                      onClick={() => {
                        setSelectedAnswer(key);
                        setFeedback(null);
                      }}
                      className={`w-full rounded-2xl border text-left transition ${optionClassName}`}
                    >
                      <QuestionOptionBlock
                        question={selectedItem.question}
                        optionKey={key}
                        wrapperClassName="px-3 py-3"
                        labelClassName={`mt-0.5 inline-flex min-w-8 justify-center rounded-full px-2 py-1 text-xs font-semibold ring-1 ${
                          isWrongSelected
                            ? "bg-rose-600 text-white ring-rose-600"
                            : showCorrect
                              ? "bg-emerald-600 text-white ring-emerald-600"
                              : "bg-white text-slate-700 ring-slate-200"
                        }`}
                        trailingContent={
                          isWrongSelected ? (
                            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">
                              你的答案
                            </span>
                          ) : showCorrect ? (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                              正解
                            </span>
                          ) : null
                        }
                      />
                    </button>
                  );
                })}
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleSubmitAnswer}
                  disabled={!selectedAnswer}
                  className="min-h-12 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
                >
                  送出答案
                </button>
                {feedback?.questionId === selectedItem.question.id ? (
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      feedback.isCorrect
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-rose-100 text-rose-800"
                    }`}
                  >
                    {feedback.isCorrect ? "答對，進度 +1" : "答錯，這題先留著"}
                  </span>
                ) : null}
              </div>

              {feedback?.questionId === selectedItem.question.id ? (
                <div className="mt-6 space-y-4 rounded-3xl bg-slate-50 p-4 text-sm leading-7 text-slate-700">
                  <p>
                    <span className="font-semibold">正確答案：</span>
                    {(selectedItem.question.answerCreditType === "multiple_accepted" ||
                      selectedItem.question.answerCreditType === "multiple_answers") &&
                    selectedItem.question.acceptedAnswers?.length
                      ? `${selectedItem.question.acceptedAnswers.join("/")} 皆可`
                      : selectedItem.question.answerCreditType === "all_credit"
                        ? "本題一律給分"
                        : selectedItem.question.answer}
                  </p>
                  <StructuredExplanationText text={selectedItem.question.explanation} label="詳解" compact />
                  <QuestionExplanationTabs question={selectedItem.question} compact className="mt-3" />
                  {selectedItem.question.memoryTip ? (
                    <div className="memory-tip-box">
                      <span className="font-semibold">快速記憶法：</span>
                      {selectedItem.question.memoryTip}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </article>
          ) : (
            <section className="workspace-empty-state">
              目前還沒有儲存題目。
            </section>
          )}
        </div>

        <aside className="workspace-section saved-list-panel h-fit xl:sticky xl:top-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-ink">全部儲存</h2>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                {savedItems.length} 題
              </p>
            </div>
          </div>

          <div className="mt-4 grid max-h-[70vh] gap-3 overflow-y-auto pr-1">
            {savedItems.length === 0 ? (
              <div className="workspace-empty-state">
                儲存清單是空的。
              </div>
            ) : (
              savedItems.map(({ question, record }) => {
                const completed = isSavedQuestionCompleted(record);
                const selected = selectedItem?.question.id === question.id;
                return (
                  <article
                    key={`saved-list-${question.id}`}
                    className={`saved-list-row border p-3 transition ${
                      selected
                        ? "border-slate-900 bg-white"
                        : completed
                          ? "border-emerald-200 bg-emerald-50"
                          : "border-slate-200 bg-white"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                      <span
                        className={`rounded-full px-2 py-0.5 ${
                          completed
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {completed ? "已完成" : `答對 ${record.correctCount} / 2`}
                      </span>
                      <span className="text-slate-400">{getSourceLabel(question)}</span>
                      <span className="text-slate-400">{question.subject}</span>
                    </div>
                    <p className="mt-2 line-clamp-2 break-words text-sm font-semibold leading-6 text-slate-800">
                      {question.stem}
                    </p>
                    <p className="mt-2 text-xs font-medium text-slate-400">
                      最近：{formatSavedDate(record.lastAnsweredAt)}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleSelectQuestion(question.id)}
                        className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-black"
                      >
                        做這題
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveQuestion(question.id)}
                        className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-rose-50 hover:text-rose-700"
                      >
                        移除
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </aside>
      </section>
    </main>
  );
}
