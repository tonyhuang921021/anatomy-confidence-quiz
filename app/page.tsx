import Link from "next/link";
import type { CSSProperties } from "react";
import { AuthPanel } from "@/components/AuthPanel";
import { ContinueQuizButton } from "@/components/ContinueQuizButton";
import { ClientSectionBoundary } from "@/components/ClientSectionBoundary";
import { ExamCountdown } from "@/components/ExamCountdown";
import { FeedbackBoard } from "@/components/FeedbackBoard";
import { HomeToneBanner } from "@/components/HomeToneBanner";
import { HomeWeaknessInsight } from "@/components/HomeWeaknessInsight";
import { OwnerOnlyNotesLink } from "@/components/OwnerOnlyNotesLink";
import { isSupabaseRecoveryMode } from "@/lib/supabase/recoveryMode";

type HomeAnimationStyle = CSSProperties & {
  "--home-delay"?: string;
};

const HERO_ACTIONS = [
  {
    href: "/start",
    label: "開始測驗",
    description: "平常散題刷題",
    tone: "primary"
  },
  {
    href: "/simulation",
    label: "開始一份考古題",
    description: "整回計時練習",
    tone: "light"
  },
  {
    href: "/results",
    label: "查看結果",
    description: "回顧每次作答",
    tone: "light"
  }
] as const;

const QUICK_ENTRIES = [
  {
    href: "/review",
    title: "錯題複習",
    body: "把散題錯題與低信心題拉回來補。",
    mark: "01"
  },
  {
    href: "/search",
    title: "題目搜尋",
    body: "用關鍵字、科目與年份回查考點。",
    mark: "02"
  },
  {
    href: "/custom-papers",
    title: "自訂卷模式",
    body: "主題卷、公開卷與 JSON 匯入都放這裡。",
    mark: "03"
  },
  {
    href: "/leaderboard",
    title: "刷題榜",
    body: "看大家的節奏，也校準自己的進度。",
    mark: "04"
  }
] as const;

export default function HomePage() {
  if (isSupabaseRecoveryMode()) {
    return (
      <main className="shell home-shell">
        <section className="surface-card overflow-hidden p-6 sm:p-8 lg:p-10">
          <p className="eyebrow">Recovery Mode</p>
          <h1 className="display-title mt-4 max-w-4xl text-[3rem] leading-[1] sm:text-6xl lg:text-[5rem]">
            雲端同步維護中
          </h1>
          <p className="body-soft mt-5 max-w-3xl text-base leading-8 sm:text-lg">
            目前先暫停登入、留言板、跨裝置同步與雲端筆記，讓作答頁維持順暢。你仍然可以用訪客模式刷題，本機紀錄會留在這台裝置。
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Link href="/start" className="home-action-card home-action-primary">
              <span className="text-sm font-bold">開始測驗</span>
              <span className="mt-2 text-xs opacity-75">本機散題刷題</span>
            </Link>
            <Link href="/simulation" className="home-action-card">
              <span className="text-sm font-bold">開始一份考古題</span>
              <span className="mt-2 text-xs opacity-75">整回練習</span>
            </Link>
            <Link href="/results" className="home-action-card">
              <span className="text-sm font-bold">查看本機結果</span>
              <span className="mt-2 text-xs opacity-75">先看此裝置紀錄</span>
            </Link>
            <Link href="/search" className="home-action-card">
              <span className="text-sm font-bold">題目搜尋</span>
              <span className="mt-2 text-xs opacity-75">查題與複習</span>
            </Link>
          </div>
          <div className="mt-8 rounded-[2rem] bg-amber-50/80 p-5 text-sm font-semibold leading-7 text-amber-900 ring-1 ring-amber-100">
            如果你原本已經開著舊分頁，那個分頁可能仍會嘗試連雲端；從這個首頁重新進入會使用新的維護模式。
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="shell home-shell">
      <section className="home-hero surface-card overflow-hidden p-5 sm:p-7 lg:p-10">
        <div className="home-orb home-orb-one" />
        <div className="home-orb home-orb-two" />
        <div className="home-grain" />

        <div className="relative z-10 grid gap-8 xl:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)] xl:items-stretch">
          <div className="home-reveal flex min-w-0 flex-col justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="eyebrow">Board Prep Lab</p>
                <span className="stat-chip home-chip">醫學一</span>
                <span className="stat-chip home-chip">醫學二</span>
                <span className="stat-chip home-chip">雲端紀錄</span>
              </div>
              <h1 className="display-title mt-4 max-w-4xl text-[3.4rem] leading-[0.95] sm:text-7xl lg:text-[5.8rem]">
                一階醫師國考
                <span className="home-title-accent block">刷題測驗</span>
              </h1>
              <p className="body-soft mt-6 max-w-2xl text-base leading-8 sm:text-lg">
                用答題結果、信心程度與完成度，把模糊的焦慮拆成能處理的下一題。
              </p>
              <ClientSectionBoundary title="首頁提示">
                <HomeToneBanner />
              </ClientSectionBoundary>

              <div className="mt-7 grid gap-3 sm:grid-cols-3">
                {HERO_ACTIONS.map((action, index) => (
                  <Link
                    key={action.href}
                    href={action.href}
                    className={action.tone === "primary" ? "home-action-card home-action-primary" : "home-action-card"}
                    style={{ "--home-delay": `${120 + index * 80}ms` } as HomeAnimationStyle}
                  >
                    <span className="text-sm font-bold">{action.label}</span>
                    <span className="mt-2 text-xs opacity-75">{action.description}</span>
                  </Link>
                ))}
              </div>

              <div className="mt-3">
                <ClientSectionBoundary title="繼續測驗">
                  <ContinueQuizButton />
                </ClientSectionBoundary>
              </div>
            </div>

            <div className="home-mini-strip mt-8 grid gap-3 sm:grid-cols-3">
              <div>
                <p className="text-2xl font-black text-ink">6,000+</p>
                <p className="body-soft mt-1 text-xs font-semibold">考古題題池</p>
              </div>
              <div>
                <p className="text-2xl font-black text-ink">錯題</p>
                <p className="body-soft mt-1 text-xs font-semibold">依模式分流</p>
              </div>
              <div>
                <p className="text-2xl font-black text-ink">筆記</p>
                <p className="body-soft mt-1 text-xs font-semibold">連回相關題</p>
              </div>
            </div>
          </div>

          <div className="home-reveal home-reveal-late grid min-w-0 gap-4">
            <div className="home-device-card">
              <div className="home-device-top">
                <span />
                <span />
                <span />
              </div>
              <div className="home-device-screen">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="eyebrow text-[10px]">Today Focus</p>
                    <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-ink">先補最會漏的洞</h2>
                  </div>
                </div>
                <div className="mt-6 grid gap-3">
                  <ClientSectionBoundary title="首頁弱點判讀">
                    <HomeWeaknessInsight />
                  </ClientSectionBoundary>
                  <ExamCountdown />
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {QUICK_ENTRIES.map((entry, index) => (
                <Link
                  key={entry.href}
                  href={entry.href}
                  className="home-entry-card"
                  style={{ "--home-delay": `${220 + index * 70}ms` } as HomeAnimationStyle}
                >
                  <span className="home-entry-mark">{entry.mark}</span>
                  <span className="mt-4 block text-lg font-black tracking-[-0.03em] text-ink">{entry.title}</span>
                  <span className="body-soft mt-2 block text-sm leading-6">{entry.body}</span>
                  <span className="mt-4 inline-flex text-sm font-bold text-brand-700">前往 →</span>
                </Link>
              ))}
              <div className="home-entry-card sm:col-span-2">
                <ClientSectionBoundary title="學習筆記入口">
                  <OwnerOnlyNotesLink />
                </ClientSectionBoundary>
                <p className="body-soft mt-3 text-sm leading-6">如果你開放筆記入口，這裡會直接連到整理好的十科大文件。</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="home-reveal home-reveal-late mt-6 grid gap-6">
        <ClientSectionBoundary title="帳號區塊">
          <AuthPanel />
        </ClientSectionBoundary>

        <ClientSectionBoundary title="留言板">
          <FeedbackBoard />
        </ClientSectionBoundary>
      </div>
    </main>
  );
}
