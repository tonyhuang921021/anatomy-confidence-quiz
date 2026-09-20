import type { Metadata } from "next";
import { WrongQuestionPdfWorkspace } from "@/components/WrongQuestionPdfExport";
import { getCanonicalQuestionBank } from "@/data/med1QuestionBank";
import { getPdfChapter } from "@/lib/wrongQuestionPdf";
import type { OptionKey, Question, QuizSession } from "@/types/quiz";

export const metadata: Metadata = { title: "錯題 PDF 預覽", robots: { index: false, follow: false } };

function makeDemoSession(id: string, questions: Question[], day: string, mode: "simulation" | "random"): QuizSession {
  return {
    id, subject: "醫學（一）", startedAt: `${day}T01:00:00.000Z`, completedAt: `${day}T02:00:00.000Z`,
    settings: { mode, questionCount: questions.length }, questionOrder: questions.map((question) => question.id),
    attempts: questions.map((question, index) => ({
      questionId: question.id,
      selectedAnswer: (["A", "B", "C", "D"] as OptionKey[]).find((key) => key !== question.answer)!,
      correctAnswer: question.answer, isCorrect: false, confidence: 3,
      answeredAt: `${day}T01:${String(index).padStart(2, "0")}:00.000Z`
    }))
  };
}

export default function WrongQuestionPdfPreviewPage() {
  const bank = getCanonicalQuestionBank();
  const chosen: Question[] = [];
  for (const subject of ["解剖學", "生理學", "生物化學"] as const) {
    const pool = bank.filter((question) => question.subject === subject && question.sourceYear === 2026 && question.sourceRound === 1 && getPdfChapter(question) !== "未細分章節");
    chosen.push(...pool.slice(0, 3));
  }
  const imageQuestion = bank.filter((question) => question.stemImage).sort((left, right) => (right.sourceYear ?? 0) - (left.sourceYear ?? 0))[0];
  if (imageQuestion && !chosen.some((question) => question.id === imageQuestion.id)) chosen.push(imageQuestion);
  const currentQuestions = [...chosen.slice(0, 2), ...chosen.slice(3, 5), ...chosen.slice(6, 7), ...(imageQuestion ? [imageQuestion] : [])];
  const currentSession = makeDemoSession("pdf-demo-current", currentQuestions, "2026-09-20", "simulation");
  const olderSession = makeDemoSession("pdf-demo-older", chosen, "2026-09-13", "random");
  return (
    <main id="main-content" className="shell workspace-page">
      <header className="mb-7 border-b border-slate-200 pb-5">
        <p className="workspace-page-kicker">功能預覽</p>
        <h1 className="workspace-page-title">錯題練習單</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">從本次作答或歷次錯題，整理出依科別、章節排列的 A4 練習單。選好留白，就可以印下來寫筆記。</p>
        <p className="mt-2 text-xs text-slate-500">示範資料，不會寫入作答紀錄。使用現有國考題目與示範作答日期；版面參考考選部試卷。</p>
      </header>
      <section className="surface-card p-4 sm:p-6" aria-label="錯題 PDF 匯出設定與預覽">
        <WrongQuestionPdfWorkspace questions={chosen} currentSession={currentSession} sessions={[olderSession, currentSession]} initialScope="current" demo />
      </section>
    </main>
  );
}
