import Link from "next/link";
import { AuthPanel } from "@/components/AuthPanel";
import { ExamCountdown } from "@/components/ExamCountdown";
import { FeedbackBoard } from "@/components/FeedbackBoard";
import { subjectRegistry } from "@/data/subjectRegistry";

export default function HomePage() {
  const totalQuestionCount = new Set(
    Object.values(subjectRegistry)
      .filter((subject) => subject.subject !== "醫學（一）" && subject.subject !== "醫學（二）")
      .flatMap((subject) => subject.questions.map((question) => question.id))
  ).size;

  return (
    <main className="shell">
      <section className="rounded-[2rem] bg-white/90 p-6 shadow-card ring-1 ring-white/70 backdrop-blur sm:p-8">
        <div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">
              Medical Board Step 1 Quiz
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-ink sm:text-5xl">
              一階醫師國考刷題測驗
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
              用答題結果、信心程度與完成度，找出你的一階醫師國考弱點。
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/start"
                className="min-h-12 rounded-2xl bg-brand-600 px-5 py-4 text-center text-sm font-semibold text-white transition hover:bg-brand-700 active:scale-[0.99]"
              >
                開始測驗
              </Link>
              <Link
                href="/simulation"
                className="min-h-12 rounded-2xl bg-amber-100 px-5 py-4 text-center text-sm font-semibold text-amber-950 transition hover:bg-amber-200 active:scale-[0.99]"
              >
                開始模擬考
              </Link>
              <Link
                href="/results"
                className="min-h-12 rounded-2xl bg-slate-100 px-5 py-4 text-center text-sm font-semibold text-slate-800 transition hover:bg-slate-200 active:scale-[0.99]"
              >
                查看結果頁
              </Link>
              <Link
                href="/review"
                className="min-h-12 rounded-2xl bg-slate-100 px-5 py-4 text-center text-sm font-semibold text-slate-800 transition hover:bg-slate-200 active:scale-[0.99]"
              >
                錯題複習
              </Link>
              <Link
                href="/leaderboard"
                className="min-h-12 rounded-2xl bg-slate-100 px-5 py-4 text-center text-sm font-semibold text-slate-800 transition hover:bg-slate-200 active:scale-[0.99]"
              >
                刷題榜
              </Link>
              <Link
                href="/search"
                className="min-h-12 rounded-2xl bg-slate-100 px-5 py-4 text-center text-sm font-semibold text-slate-800 transition hover:bg-slate-200 active:scale-[0.99]"
              >
                題目搜尋
              </Link>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <ExamCountdown />
              <div className="rounded-3xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">目前題庫數量</p>
                <p className="mt-2 text-2xl font-bold text-ink">{totalQuestionCount}</p>
              </div>
              <div className="rounded-3xl bg-slate-50 p-4 sm:col-span-2">
                <p className="text-sm text-slate-500">已開放科目</p>
                <p className="mt-2 text-lg font-bold text-ink">醫學一、醫學二</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-6">
        <AuthPanel />

        <FeedbackBoard />

        <div className="flex justify-start">
          <Link
            href="/custom-papers"
            className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-200"
          >
            自訂卷模式
          </Link>
        </div>

      </div>
    </main>
  );
}
