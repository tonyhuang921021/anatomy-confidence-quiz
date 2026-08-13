import type { Metadata } from "next";
import { ClientSectionBoundary } from "@/components/ClientSectionBoundary";
import { LazyFeedbackBoard } from "@/components/LazyFeedbackBoard";

export const metadata: Metadata = {
  title: "留言板｜一階醫師國考刷題測驗",
  description: "查看網站問題、功能建議與回覆。"
};

export default function FeedbackPage() {
  return (
    <main id="main-content" className="shell workspace-page feedback-page-shell">
      <header className="feedback-page-header">
        <p className="workspace-page-kicker">留言板</p>
        <h1 className="workspace-page-title">大家的問題與建議</h1>
        <p>留下網站狀況、題目問題或想許願的功能，也可以直接接著回覆同一串。</p>
      </header>

      <section className="feedback-page-body" aria-label="留言與回覆">
        <ClientSectionBoundary title="留言板">
          <LazyFeedbackBoard eager showHeading={false} />
        </ClientSectionBoundary>
      </section>
    </main>
  );
}
