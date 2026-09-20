import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { WrongQuestionPdfWorkspace } from "@/components/WrongQuestionPdfExport";
import { createWrongQuestionPdfDemo } from "@/lib/wrongQuestionPdfDemo";

export const metadata: Metadata = { title: "錯題 PDF 預覽", robots: { index: false, follow: false } };

export default function WrongQuestionPdfPreviewPage() {
  const { questions, currentSession, sessions } = createWrongQuestionPdfDemo();
  return (
    <main id="main-content" className="shell workspace-page">
      <header className="mb-7 border-b border-slate-200 pb-5">
        <p className="workspace-page-kicker">功能預覽</p>
        <h1 className="workspace-page-title">錯題練習單</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">從本次作答或歷次錯題，整理出依科別、章節排列的 A4 練習單。選好留白，就可以印下來寫筆記。</p>
        <p className="mt-2 text-xs text-slate-500">示範資料，不會寫入作答紀錄。使用現有國考題目與示範作答日期；版面參考考選部試卷。</p>
        <Link href="/wrong-question-pdf-preview/integration" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-brand-700 transition hover:border-brand-500 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2">查看結果頁／錯題頁入口<ArrowUpRight size={16} aria-hidden="true" /></Link>
      </header>
      <section className="surface-card p-4 sm:p-6" aria-label="錯題 PDF 匯出設定與預覽">
        <WrongQuestionPdfWorkspace questions={questions} currentSession={currentSession} sessions={sessions} initialScope="current" demo />
      </section>
    </main>
  );
}
