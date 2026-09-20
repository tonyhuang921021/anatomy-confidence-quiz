import Link from "next/link";
import { QuizSetupPanel } from "@/components/QuizSetupPanel";
import { getQuestionBankBySubjectFilter } from "@/data/med1QuestionBank";
import { calculateCompletionStats } from "@/lib/quizAnalysis";

export default function SimulationPage() {
  const stats = calculateCompletionStats(getQuestionBankBySubjectFilter("全部"), []);

  return (
    <main id="main-content" className="shell workspace-page">
      <section className="surface-card workspace-page-panel workspace-page-header p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="workspace-page-kicker">考古題</p>
            <h1 className="workspace-page-title">模擬考專區</h1>
            <p className="mt-3 text-slate-500">
              這裡只放整份考卷模式，不和一般散題刷題混在一起。
            </p>
          </div>
        </div>
      </section>

      <div className="mt-6">
        <QuizSetupPanel
          stats={stats}
          simulationOnly
          title="整份模擬考設定"
          description="選擇卷別與考卷，即可開始；需要時再調整作答方式。"
        />
      </div>

      <section className="workspace-section simulation-review-strip mt-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-ink">模擬考紀錄與複習</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              結果與待複習題維持獨立題池。
            </p>
          </div>
          <div className="workspace-compact-actions">
            <Link
              href="/simulation-results"
              className="border border-slate-200 bg-white text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              查看模擬考結果
            </Link>
            <Link
              href="/simulation-review"
              className="border border-slate-200 bg-white text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              查看模擬考待複習題
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
