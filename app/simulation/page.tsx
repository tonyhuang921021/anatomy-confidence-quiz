import Link from "next/link";
import { QuizSetupPanel } from "@/components/QuizSetupPanel";
import { getQuestionBankBySubjectFilter } from "@/data/med1QuestionBank";
import { calculateCompletionStats } from "@/lib/quizAnalysis";

export default function SimulationPage() {
  const stats = calculateCompletionStats(getQuestionBankBySubjectFilter("全部"), []);

  return (
    <main className="shell">
      <section className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">
              Simulation
            </p>
            <h1 className="mt-2 text-3xl font-bold text-ink sm:text-4xl">模擬考專區</h1>
            <p className="mt-3 text-slate-500">
              這裡只放整份考卷模式，不和一般散題刷題混在一起。
            </p>
          </div>
          <Link
            href="/"
            className="min-h-12 rounded-2xl bg-slate-100 px-5 py-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-200"
          >
            返回首頁
          </Link>
        </div>
      </section>

      <section className="mt-6 rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">
              Simulation Review
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">模擬考錯題複習</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              這裡的錯題庫只整理整份模擬考做出來的錯題與低信心題，不會和平常散題刷題混在一起。
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/simulation-results"
              className="min-h-12 rounded-2xl bg-emerald-600 px-5 py-4 text-sm font-semibold text-white transition hover:bg-emerald-700"
            >
              查看模擬考結果
            </Link>
            <Link
              href="/simulation-review"
              className="min-h-12 rounded-2xl bg-amber-500 px-5 py-4 text-sm font-semibold text-white transition hover:bg-amber-600"
            >
              查看模擬考待複習題
            </Link>
          </div>
        </div>
      </section>

      <div className="mt-6">
        <QuizSetupPanel
          stats={stats}
          simulationOnly
          title="整份模擬考設定"
          description="可指定真實考古卷、隨機抽一整份真實考古卷，或讓系統依真實卷分布模擬整份考卷。"
        />
      </div>
    </main>
  );
}
