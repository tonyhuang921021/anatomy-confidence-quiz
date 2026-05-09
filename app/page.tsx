import Link from "next/link";
import { QuizSetupPanel } from "@/components/QuizSetupPanel";
import { anatomyQuestions } from "@/data/anatomyQuestions";
import { calculateCompletionStats, calculateOverallCompletion } from "@/lib/quizAnalysis";

export default function HomePage() {
  const stats = calculateCompletionStats(anatomyQuestions, []);
  const overall = calculateOverallCompletion(anatomyQuestions, []);

  return (
    <main className="shell">
      <section className="rounded-[2rem] bg-white/90 p-6 shadow-card ring-1 ring-white/70 backdrop-blur sm:p-8">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">
              Anatomy Confidence Quiz
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-ink sm:text-5xl">
              解剖學醫師國考信心測驗
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
              用答題結果、信心程度與完成度，找出你的解剖國考弱點。
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/quiz?new=1"
                className="min-h-12 rounded-2xl bg-brand-600 px-5 py-4 text-center text-sm font-semibold text-white transition hover:bg-brand-700 active:scale-[0.99]"
              >
                開始測驗
              </Link>
              <Link
                href="/progress"
                className="min-h-12 rounded-2xl bg-slate-100 px-5 py-4 text-center text-sm font-semibold text-slate-800 transition hover:bg-slate-200 active:scale-[0.99]"
              >
                進度總覽
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
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-3xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">目前題庫數量</p>
                <p className="mt-2 text-2xl font-bold text-ink">{anatomyQuestions.length}</p>
              </div>
              <div className="rounded-3xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">考古題佔比</p>
                <p className="mt-2 text-lg font-bold text-ink">
                  {anatomyQuestions.filter((question) => question.sourceType === "MOEX_PAST_EXAM").length} 題
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] bg-ink p-6 text-white shadow-card">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-200">快速入口</p>
            <div className="mt-4 grid gap-3">
              <Link href="/quiz?new=1" className="rounded-2xl bg-white/10 p-4 transition hover:bg-white/15">
                <p className="font-semibold">立即開始 10 題測驗</p>
                <p className="mt-1 text-sm text-slate-200">直接進入答題流程</p>
              </Link>
              <Link href="/progress" className="rounded-2xl bg-white/10 p-4 transition hover:bg-white/15">
                <p className="font-semibold">看解剖學進度地圖</p>
                <p className="mt-1 text-sm text-slate-200">檢查 completionRate 與 masteryScore</p>
              </Link>
              <Link href="/review" className="rounded-2xl bg-white/10 p-4 transition hover:bg-white/15">
                <p className="font-semibold">看錯題與高風險題</p>
                <p className="mt-1 text-sm text-slate-200">集中複習曾答錯或低信心題目</p>
              </Link>
              <div className="rounded-2xl bg-white/10 p-4">
                <p className="font-semibold">API 已新增</p>
                <p className="mt-1 text-sm text-slate-200">
                  `GET /api/health`、`GET /api/questions`、`POST /api/recommend`、`POST /api/ai-analysis`
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-6">
        <section className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">Quick Stats</p>
              <h2 className="mt-2 text-2xl font-semibold text-ink">這版會重新打亂，並混入正式考古題</h2>
            </div>
            <div className="rounded-3xl bg-slate-50 px-5 py-4 text-sm text-slate-700">
              整體 completionRate <span className="font-semibold text-ink">{Math.round(overall.completionRate)}%</span>
            </div>
          </div>
        </section>

        <QuizSetupPanel stats={stats} />
      </div>
    </main>
  );
}
