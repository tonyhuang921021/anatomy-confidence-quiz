import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { LaozhaoLocalDataPanel } from "@/components/laozhao/local/LaozhaoLocalDataPanel";

export const metadata = {
  title: "影片資料與隱私｜老趙解剖學"
};

export default function LaoZhaoPrivacyPage() {
  return (
    <main className="min-h-screen bg-[var(--bg-base)] text-[var(--ink-main)]">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
        <Link
          href="/courses/laozhao-anatomy"
          className="inline-flex min-h-10 items-center gap-2 text-sm font-bold text-[var(--brand-deep)] underline-offset-4 hover:underline"
        >
          <ArrowLeft aria-hidden="true" size={18} strokeWidth={2} />
          回到影片目錄
        </Link>

        <article className="mt-12 border-t border-slate-200/80 pt-7">
          <p className="text-xs font-bold text-[var(--brand-main)]">影片資料與隱私</p>
          <h1 className="mt-3 text-3xl font-black sm:text-4xl">老趙解剖學影片</h1>

          <div className="mt-8 space-y-8 text-[15px] leading-8 text-[var(--ink-soft)]">
            <section>
              <h2 className="text-lg font-black text-[var(--ink-main)]">影片來源</h2>
              <p className="mt-2">
                影片由 YouTube 官方播放器串流，本站不保存或重新散布影片檔，也不提供離線播放。受保護測試頁會顯示經授權、人工挑選的章節板書截圖；未公開逐字稿、OCR、投影片與參考筆記不會送到瀏覽器。瀏覽影片目錄時，縮圖會從 YouTube 圖片網域載入；點開影片後，瀏覽器會依 YouTube 的服務規則連線到 YouTube 播放器。
              </p>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm font-bold text-[var(--brand-deep)]">
                <a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener" className="inline-flex items-center gap-1 hover:underline">
                  YouTube 服務條款 <ExternalLink aria-hidden="true" size={14} strokeWidth={2} />
                </a>
                <a href="https://policies.google.com/privacy" target="_blank" rel="noopener" className="inline-flex items-center gap-1 hover:underline">
                  Google 隱私權政策 <ExternalLink aria-hidden="true" size={14} strokeWidth={2} />
                </a>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-black text-[var(--ink-main)]">本機資料</h2>
              <p className="mt-2">
                觀看進度、書籤與時間戳筆記會先保存在目前瀏覽器，不會寫入刷題作答紀錄，也不會上傳到帳號或雲端。清除瀏覽器資料或使用無痕模式可能會讓本機資料消失。
              </p>
            </section>

            <section>
              <h2 className="text-lg font-black text-[var(--ink-main)]">資料控制</h2>
              <p className="mt-2">
                你可以在影片區匯出或刪除本機學習資料。這些資料不會和帳號、email 或刷題紀錄合併。
              </p>
            </section>

            <LaozhaoLocalDataPanel className="border-t border-[var(--line-soft)] pt-7" />
          </div>
        </article>
      </div>
    </main>
  );
}
