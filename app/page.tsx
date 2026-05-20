import Link from "next/link";
import { AuthPanel } from "@/components/AuthPanel";
import { ExamCountdown } from "@/components/ExamCountdown";
import { FeedbackBoard } from "@/components/FeedbackBoard";
import {
  enabledSubjects,
  HIDDEN_MULTI_ENTRY_SUBJECTS,
  subjectRegistry
} from "@/data/subjectRegistry";

export default function HomePage() {
  const availableSubjects = enabledSubjects.filter(
    (subject) => !HIDDEN_MULTI_ENTRY_SUBJECTS.includes(subject.subject)
  );
  const totalQuestionCount = new Set(
    Object.values(subjectRegistry)
      .filter((subject) => subject.subject !== "醫學（一）" && subject.subject !== "醫學（二）")
      .flatMap((subject) => subject.questions.map((question) => question.id))
  ).size;
  const upcomingSubjects = Object.values(subjectRegistry).filter((item) => !item.enabled);

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
              <ExamCountdown />
              <div className="rounded-3xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">目前題庫數量</p>
                <p className="mt-2 text-2xl font-bold text-ink">{totalQuestionCount}</p>
              </div>
              <div className="rounded-3xl bg-slate-50 p-4 sm:col-span-2">
                <p className="text-sm text-slate-500">已開放科目</p>
                <p className="mt-2 text-lg font-bold text-ink">
                  {availableSubjects.map((subject) => subject.label).join("、")}
                </p>
              </div>
            </div>
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
            </div>
            <div className="rounded-3xl bg-slate-50 px-5 py-4 text-sm text-slate-700">
              已開放 <span className="font-semibold text-ink">{availableSubjects.length}</span> 科
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {availableSubjects.map((subject) => {
              const isAnatomy = subject.subject === "解剖學";
              const isMed1 = subject.subject === "醫學（一）";
              const isMed2 = subject.subject === "醫學（二）";
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
                        href={
                          isAnatomy
                            ? `/quiz?new=1&subject=${encodeURIComponent(subject.subject)}`
                            : isMed1
                              ? "/quiz?new=1&preset=med1"
                              : isMed2
                                ? "/quiz?new=1&preset=med2"
                                : `/quiz?new=1&subject=${encodeURIComponent(subject.subject)}`
                        }
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

        <FeedbackBoard />

      </div>
    </main>
  );
}
