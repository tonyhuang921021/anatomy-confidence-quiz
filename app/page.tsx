import Link from "next/link";
import { AuthPanel } from "@/components/AuthPanel";
import { QuizSetupPanel } from "@/components/QuizSetupPanel";
import { anatomyQuestions } from "@/data/anatomyQuestions";
import { enabledSubjects, subjectRegistry } from "@/data/subjectRegistry";
import { calculateCompletionStats, calculateOverallCompletion } from "@/lib/quizAnalysis";

export default function HomePage() {
  const stats = calculateCompletionStats(anatomyQuestions, []);
  const overall = calculateOverallCompletion(anatomyQuestions, []);
  const availableSubjects = enabledSubjects;
  const upcomingSubjects = Object.values(subjectRegistry).filter((item) => !item.enabled);

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
                href="/quiz?new=1&preset=start"
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
              <Link
                href="/leaderboard"
                className="min-h-12 rounded-2xl bg-slate-100 px-5 py-4 text-center text-sm font-semibold text-slate-800 transition hover:bg-slate-200 active:scale-[0.99]"
              >
                刷題榜
              </Link>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-3xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">目前題庫數量</p>
                <p className="mt-2 text-2xl font-bold text-ink">{anatomyQuestions.length}</p>
              </div>
              <div className="rounded-3xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">已開放科目</p>
                <p className="mt-2 text-lg font-bold text-ink">
                  {availableSubjects.map((subject) => subject.label).join("、")}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] bg-ink p-6 text-white shadow-card">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-200">快速入口</p>
            <div className="mt-4 grid gap-3">
              <Link href="/quiz?new=1&preset=start" className="rounded-2xl bg-white/10 p-4 transition hover:bg-white/15">
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
              <Link href="/leaderboard" className="rounded-2xl bg-white/10 p-4 transition hover:bg-white/15">
                <p className="font-semibold">看刷題榜</p>
                <p className="mt-1 text-sm text-slate-200">依總答題量與正確率查看排名</p>
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

      <section className="mt-6 rounded-[2rem] border border-brand-200 bg-gradient-to-r from-brand-50 via-white to-amber-50 p-6 shadow-card">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">Announcement</p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">醫學（一）題目已上線，整份作答模式同步開放</h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">
              現在除了原本的解剖學刷題，也可以直接選醫學（一）全科，並用模擬考模式寫整份卷。你可以指定真實考古題、隨機抽一整份真實考古題，或讓系統自組一份新模擬卷。
            </p>
          </div>
          <div className="rounded-3xl bg-white px-5 py-4 text-sm text-slate-700 ring-1 ring-brand-100">
            <span className="font-semibold text-ink">新增重點：</span>
            醫學一題庫、整份模考、真實考古卷模式
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-6">
        <AuthPanel />

        <section className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">Subjects</p>
              <h2 className="mt-2 text-2xl font-semibold text-ink">多科目入口</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                目前正式啟用的是解剖學，其他科目已預留結構，之後可以直接接進同一套刷題與進度系統。
              </p>
            </div>
            <div className="rounded-3xl bg-slate-50 px-5 py-4 text-sm text-slate-700">
              已開放 <span className="font-semibold text-ink">{availableSubjects.length}</span> 科
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {Object.values(subjectRegistry).map((subject) => {
              const isAnatomy = subject.subject === "解剖學";
              const questionCount = subject.questions.length;
              return (
                <article
                  key={subject.subject}
                  className={`rounded-3xl border p-5 ${
                    subject.enabled
                      ? "border-brand-200 bg-brand-50"
                      : "border-slate-200 bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-ink">{subject.label}</h3>
                      <p className="mt-1 text-sm text-slate-600">
                        {subject.enabled ? `${questionCount} 題已上線` : "尚未開放，保留未來擴充"}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        subject.enabled
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {subject.enabled ? "已開放" : "即將開放"}
                    </span>
                  </div>

                  {subject.enabled ? (
                    <div className="mt-4 flex flex-wrap gap-3">
                      <Link
                        href={isAnatomy ? "/quiz?new=1&preset=start" : "/"}
                        className="min-h-12 rounded-2xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
                      >
                        開始 {subject.label}
                      </Link>
                      {isAnatomy ? (
                        <Link
                          href="/progress"
                          className="min-h-12 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-800 ring-1 ring-slate-200 transition hover:bg-slate-50"
                        >
                          查看 {subject.label} 進度
                        </Link>
                      ) : null}
                    </div>
                  ) : (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {upcomingSubjects
                        .filter((item) => item.subject === subject.subject)
                        .map((item) => (
                          <span
                            key={item.subject}
                            className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200"
                          >
                            待匯入題庫
                          </span>
                        ))}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>

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
