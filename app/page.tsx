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
      <section className="surface-card overflow-hidden p-6 sm:p-8 lg:p-10">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.25fr)_360px] lg:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="eyebrow">Board Prep Lab</p>
              <span className="stat-chip">醫學一</span>
              <span className="stat-chip">醫學二</span>
            </div>
            <h1 className="display-title mt-4 max-w-4xl text-5xl leading-[1.02] sm:text-6xl">
              一階醫師國考刷題測驗
            </h1>
            <p className="body-soft mt-5 max-w-2xl text-sm leading-7 sm:text-base">
              用答題結果、信心程度與完成度，找出你的一階醫師國考弱點。
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/start" className="primary-pill">
                開始測驗
              </Link>
              <Link href="/simulation" className="secondary-pill">
                開始模擬考
              </Link>
              <Link href="/results" className="secondary-pill">
                查看結果
              </Link>
            </div>
          </div>

          <div className="grid gap-3">
            <ExamCountdown />
            <div className="surface-card-muted p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">常用入口</p>
              <div className="mt-4 grid gap-2">
                <Link href="/review" className="secondary-pill justify-between px-4">
                  錯題複習
                  <span className="text-slate-400">→</span>
                </Link>
                <Link href="/search" className="secondary-pill justify-between px-4">
                  題目搜尋
                  <span className="text-slate-400">→</span>
                </Link>
                <Link href="/leaderboard" className="secondary-pill justify-between px-4">
                  刷題榜
                  <span className="text-slate-400">→</span>
                </Link>
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
            className="secondary-pill min-h-11 px-4 py-2"
          >
            自訂卷模式
          </Link>
        </div>
      </div>
    </main>
  );
}
