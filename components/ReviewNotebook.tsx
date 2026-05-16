import Link from "next/link";
import { OptionKey, Question, ReviewQuestionItem } from "@/types/quiz";

function formatTime(value?: string) {
  if (!value) return "尚未作答";
  return new Date(value).toLocaleString("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function sortByRecent(items: ReviewQuestionItem[]) {
  return [...items].sort((a, b) => {
    const timeA = a.history.lastAttemptedAt ? new Date(a.history.lastAttemptedAt).getTime() : 0;
    const timeB = b.history.lastAttemptedAt ? new Date(b.history.lastAttemptedAt).getTime() : 0;
    return timeB - timeA || b.riskScore - a.riskScore || b.history.wrong - a.history.wrong;
  });
}

function getOptionKeys(item: ReviewQuestionItem) {
  return (["A", "B", "C", "D", "E"] as OptionKey[]).filter(
    (key) => typeof item.question.options[key] === "string"
  );
}

function getOptionKeysFromQuestion(question: Question) {
  return (["A", "B", "C", "D", "E"] as OptionKey[]).filter(
    (key) => typeof question.options[key] === "string"
  );
}

function getRelatedQuestions(currentQuestion: Question, allQuestions: Question[], limit = 4) {
  const normalizedConcept = currentQuestion.testedConcept.trim().toLowerCase();

  const sameConcept = allQuestions.filter(
    (question) =>
      question.id !== currentQuestion.id &&
      question.testedConcept.trim().toLowerCase() === normalizedConcept
  );

  const sameSection = allQuestions.filter(
    (question) =>
      question.id !== currentQuestion.id &&
      question.section === currentQuestion.section &&
      question.chapter === currentQuestion.chapter &&
      question.testedConcept.trim().toLowerCase() !== normalizedConcept
  );

  return [...sameConcept, ...sameSection].slice(0, limit);
}

function renderQuestionReview(item: ReviewQuestionItem) {
  return (
    <div className="mt-4 space-y-3 leading-7">
      <p>
        <span className="font-semibold">最後錯因：</span>
        {item.history.latestErrorType ?? "未填"}
      </p>
      <div className="grid gap-3">
        {getOptionKeys(item).map((key) => (
          <div key={`${item.question.id}-${key}`} className="rounded-2xl bg-slate-50 p-4">
            <p className="font-semibold text-slate-900">
              {key}. {item.question.options[key]}
            </p>
          </div>
        ))}
      </div>
      <p>
        <span className="font-semibold">正確答案：</span>
        {item.question.answer}
      </p>
      <p>
        <span className="font-semibold">重點解析：</span>
        {item.question.explanation}
      </p>
      {item.question.memoryTip ? (
        <p>
          <span className="font-semibold">快速記憶法：</span>
          {item.question.memoryTip}
        </p>
      ) : null}
    </div>
  );
}

function renderRelatedQuestions(question: Question, allQuestions: Question[]) {
  const relatedQuestions = getRelatedQuestions(question, allQuestions);

  if (relatedQuestions.length === 0) {
    return (
      <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
        目前還找不到同觀念的類似題。
      </div>
    );
  }

  return (
    <div className="mt-4 grid gap-3">
      {relatedQuestions.map((relatedQuestion, index) => (
        <details key={`${question.id}-related-${relatedQuestion.id}`} className="rounded-2xl bg-slate-50 p-4">
          <summary className="cursor-pointer font-semibold text-ink">
            類似題 {index + 1}：{relatedQuestion.chapter} / {relatedQuestion.section}
          </summary>
          <div className="mt-3 space-y-3 text-sm leading-7 text-slate-700">
            <p className="font-semibold text-slate-900">
              {relatedQuestion.chapter} / {relatedQuestion.section}
            </p>
            <p>{relatedQuestion.stem}</p>
            <div className="grid gap-3">
              {getOptionKeysFromQuestion(relatedQuestion).map((key) => (
                <div key={`${relatedQuestion.id}-${key}`} className="rounded-2xl bg-white p-4">
                  <p className="font-semibold text-slate-900">
                    {key}. {relatedQuestion.options[key]}
                  </p>
                </div>
              ))}
            </div>
            <p>
              <span className="font-semibold">正確答案：</span>
              {relatedQuestion.answer}
            </p>
            <p>
              <span className="font-semibold">詳解：</span>
              {relatedQuestion.explanation}
            </p>
            {relatedQuestion.memoryTip ? (
              <p>
                <span className="font-semibold">快速記憶法：</span>
                {relatedQuestion.memoryTip}
              </p>
            ) : null}
          </div>
        </details>
      ))}
    </div>
  );
}

type ReviewNotebookProps = {
  items: ReviewQuestionItem[];
  allQuestions: Question[];
  title?: string;
  description?: string;
  startLabel?: string;
  startHref?: string;
  onStartReview?: () => void;
};

export function ReviewNotebook({
  items,
  allQuestions,
  title = "錯題與低信心題筆記",
  description = "先把錯題和沒信心的題目分開看，每區都依最近作答時間排序。",
  startLabel = "開始錯題複習",
  startHref = "/quiz?new=1",
  onStartReview
}: ReviewNotebookProps) {
  const wrongItems = sortByRecent(items.filter((item) => item.history.wrong > 0));
  const lowConfidenceItems = sortByRecent(items.filter((item) => item.history.lowConfidence > 0));

  return (
    <section className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-ink">{title}</h2>
          <p className="mt-2 text-sm text-slate-500">
            {description}
          </p>
        </div>
        <Link
          href={startHref}
          onClick={onStartReview}
          className="min-h-12 rounded-2xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
        >
          {startLabel}
        </Link>
      </div>

      <div className="mt-6 grid gap-8">
        {items.length === 0 ? (
          <div className="rounded-3xl bg-slate-50 p-5 text-sm text-slate-500">
            目前還沒有累積錯題或低信心題，先去刷一輪題目吧。
          </div>
        ) : (
          <>
            <div>
              <div className="flex items-center gap-3">
                <h3 className="text-xl font-semibold text-ink">錯題區</h3>
                <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-900">
                  {wrongItems.length} 題
                </span>
              </div>
              <div className="mt-4 grid gap-4">
                {wrongItems.length === 0 ? (
                  <div className="rounded-3xl bg-slate-50 p-5 text-sm text-slate-500">
                    目前沒有累積錯題。
                  </div>
                ) : (
                  wrongItems.map((item, index) => (
                    <article
                      key={`wrong-${item.question.id}`}
                      className="rounded-3xl border border-rose-200 bg-rose-50/60 p-5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-900">
                              錯題 {index + 1}
                            </span>
                            <span className="text-sm text-slate-500">
                              {item.question.chapter} / {item.question.section}
                            </span>
                          </div>
                          <h4 className="mt-3 break-words text-lg font-semibold leading-8 text-ink">
                            {item.question.stem}
                          </h4>
                        </div>
                        <div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-700">
                          最近作答 <span className="font-semibold">{formatTime(item.history.lastAttemptedAt)}</span>
                        </div>
                      </div>

                      <details className="mt-4 rounded-2xl bg-white p-4 text-sm text-slate-700">
                        <summary className="cursor-pointer font-semibold text-ink">
                          查看題目、選項與詳解
                        </summary>
                        {renderQuestionReview(item)}
                      </details>

                      <details className="mt-4 rounded-2xl bg-white p-4 text-sm text-slate-700">
                        <summary className="cursor-pointer font-semibold text-ink">
                          看相同觀念類似題
                        </summary>
                        {renderRelatedQuestions(item.question, allQuestions)}
                      </details>
                    </article>
                  ))
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-3">
                <h3 className="text-xl font-semibold text-ink">沒信心題區</h3>
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">
                  {lowConfidenceItems.length} 題
                </span>
              </div>
              <div className="mt-4 grid gap-4">
                {lowConfidenceItems.length === 0 ? (
                  <div className="rounded-3xl bg-slate-50 p-5 text-sm text-slate-500">
                    目前沒有累積低信心題。
                  </div>
                ) : (
                  lowConfidenceItems.map((item, index) => (
                    <article
                      key={`low-${item.question.id}`}
                      className="rounded-3xl border border-amber-200 bg-amber-50/70 p-5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">
                              低信心 {index + 1}
                            </span>
                            <span className="text-sm text-slate-500">
                              {item.question.chapter} / {item.question.section}
                            </span>
                          </div>
                          <h4 className="mt-3 break-words text-lg font-semibold leading-8 text-ink">
                            {item.question.stem}
                          </h4>
                        </div>
                        <div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-700">
                          最近作答 <span className="font-semibold">{formatTime(item.history.lastAttemptedAt)}</span>
                        </div>
                      </div>

                      <details className="mt-4 rounded-2xl bg-white p-4 text-sm text-slate-700">
                        <summary className="cursor-pointer font-semibold text-ink">
                          查看題目、選項與詳解
                        </summary>
                        {renderQuestionReview(item)}
                      </details>

                      <details className="mt-4 rounded-2xl bg-white p-4 text-sm text-slate-700">
                        <summary className="cursor-pointer font-semibold text-ink">
                          看相同觀念類似題
                        </summary>
                        {renderRelatedQuestions(item.question, allQuestions)}
                      </details>
                    </article>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
