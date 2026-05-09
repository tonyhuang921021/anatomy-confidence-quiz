import Link from "next/link";
import { ReviewQuestionItem } from "@/types/quiz";

function formatTime(value?: string) {
  if (!value) return "尚未作答";
  return new Date(value).toLocaleString("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

type ReviewNotebookProps = {
  items: ReviewQuestionItem[];
};

export function ReviewNotebook({ items }: ReviewNotebookProps) {
  return (
    <section className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-ink">錯題與高風險題筆記</h2>
          <p className="mt-2 text-sm text-slate-500">優先整理曾答錯、低信心或高風險的題目。</p>
        </div>
        <Link
          href="/quiz"
          className="min-h-12 rounded-2xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
        >
          開始錯題複習
        </Link>
      </div>

      <div className="mt-5 grid gap-4">
        {items.length === 0 ? (
          <div className="rounded-3xl bg-slate-50 p-5 text-sm text-slate-500">
            目前還沒有累積錯題或低信心題，先去刷一輪題目吧。
          </div>
        ) : (
          items.map((item, index) => (
            <article key={item.question.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-900">
                      風險 {index + 1}
                    </span>
                    <span className="text-sm text-slate-500">
                      {item.question.chapter} / {item.question.section}
                    </span>
                  </div>
                  <h3 className="mt-3 text-lg font-semibold leading-8 text-ink">{item.question.stem}</h3>
                </div>
                <div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-700">
                  riskScore <span className="font-semibold">{item.riskScore}</span>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <p className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-700">
                  wrong <span className="font-semibold">{item.history.wrong}</span>
                </p>
                <p className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-700">
                  lowConfidence <span className="font-semibold">{item.history.lowConfidence}</span>
                </p>
                <p className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-700">
                  overconfidence <span className="font-semibold">{item.history.overconfidence}</span>
                </p>
                <p className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-700">
                  最近作答 <span className="font-semibold">{formatTime(item.history.lastAttemptedAt)}</span>
                </p>
              </div>

              <div className="mt-4 rounded-2xl bg-white p-4 text-sm leading-7 text-slate-700">
                <p>
                  <span className="font-semibold">testedConcept：</span>
                  {item.question.testedConcept}
                </p>
                <p className="mt-2">
                  <span className="font-semibold">最後錯因：</span>
                  {item.history.latestErrorType ?? "未填"}
                </p>
                <p className="mt-2">
                  <span className="font-semibold">重點解析：</span>
                  {item.question.explanation}
                </p>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
