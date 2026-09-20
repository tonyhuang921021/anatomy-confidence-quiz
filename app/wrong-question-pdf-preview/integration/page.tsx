import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createWrongQuestionPdfDemo } from "@/lib/wrongQuestionPdfDemo";
import { IntegrationPreview } from "./IntegrationPreview";

export const metadata: Metadata = {
  title: "錯題 PDF · 頁面入口預覽",
  robots: { index: false, follow: false }
};

export default function WrongQuestionPdfIntegrationPage({ searchParams }: { searchParams: { view?: string | string[] } }) {
  const { questions, currentSession, sessions } = createWrongQuestionPdfDemo();
  return (
    <main id="main-content" className="shell workspace-page">
      <header className="mb-6 border-b border-slate-200 pb-5">
        <Link href="/wrong-question-pdf-preview" className="mb-4 inline-flex min-h-10 items-center gap-1.5 text-sm text-slate-500 transition hover:text-brand-700 focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"><ArrowLeft size={15} aria-hidden="true" />返回 PDF 版面預覽</Link>
        <p className="workspace-page-kicker">入口預覽</p>
        <h1 className="workspace-page-title">錯題 PDF 匯出入口</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">結果頁匯出這次答錯的題目，錯題複習頁整理歷次錯題。兩個入口使用同一份簡單設定。</p>
        <p className="mt-2 text-xs leading-5 text-slate-500">畫面使用示範作答，匯出設定可直接操作，不會寫入作答紀錄。</p>
      </header>
      <IntegrationPreview questions={questions} currentSession={currentSession} sessions={sessions} initialContext={searchParams.view === "review" ? "review" : "results"} />
    </main>
  );
}
