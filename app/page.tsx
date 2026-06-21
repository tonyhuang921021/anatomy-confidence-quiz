import Link from "next/link";
import type { CSSProperties } from "react";
import { ContinueQuizButton } from "@/components/ContinueQuizButton";
import { ClientSectionBoundary } from "@/components/ClientSectionBoundary";
import { ExamCountdown } from "@/components/ExamCountdown";
import { AuthPanel } from "@/components/AuthPanel";
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
    tone: "primary"
  },
  {
    href: "/simulation",
    label: "開始一份考古題",
    tone: "light"
  },
  {
    href: "/results",
    label: "查看結果",
    tone: "light"
  }
] as const;

const QUICK_ENTRIES = [
  {
    href: "/review",
    title: "錯題複習"
  },
  {
    href: "/search",
    title: "題目搜尋"
  },
  {
    href: "/custom-papers",
    title: "自訂卷模式"
  },
  {
    href: "/leaderboard",
    title: "刷題榜"
  }
] as const;

const HOME_RELEASE_NOTES = [
  {
    time: "06/21",
    title: "焦慮模式嘴力上修",
    body: "首頁焦慮文案新增一批網感碎念，會依題量和時間換嘴法；今天沒刷題，首頁會很有意見。"
  },
  {
    time: "06/21",
    title: "首頁留言板收回短版",
    body: "留言照樣自動抓，但不再一路把首頁撐長；首頁是拿來開始刷題的，不是拿來考古留言地層的。"
  },
  {
    time: "06/21",
    title: "Safari 捲首頁不再露底",
    body: "Safari 首頁改成先求穩：關掉首輪重繪容易翻車的背景層、淡入和閃光骨架，讓滑動不要突然只剩一片背景。"
  },
  {
    time: "06/21",
    title: "首頁不再假裝大家都 0 題",
    body: "留言、焦慮數字和弱點判讀改成先顯示舊資料再更新；資料庫慢一下，不會整頁開始裝失憶。"
  },
  {
    time: "06/21",
    title: "陽明詳解不再一慢就躺",
    body: "陽明詳解遇到慢查會自動補踹一次，紅字也多了重試鍵；不是沒詳解，只是它偶爾需要被叫醒。"
  },
  {
    time: "06/21",
    title: "承上題不再孤兒開局",
    body: "隨機抽到承上題時，系統會先把上一題排進來做完，再接續下一題；題庫劇情不再從第二集開始播。"
  },
  {
    time: "06/21",
    title: "搜尋頁可以囤題了",
    body: "題目搜尋右下多了收藏題庫，看到想補的題先丟進去；答對兩次就變綠，不再把會的題抓回來陪跑。"
  },
  {
    time: "06/21",
    title: "細菌整理補類鼻疽",
    body: "細菌複習換新版，非發酵 G- 桿菌補上類鼻疽；字卡裡的小標籤也不再躲到夾層玩隱身術。"
  },
  {
    time: "06/21",
    title: "不要了按鈕搬家",
    body: "「這題我們不要了」從補充卡片裡搬到同學補充旁邊，這種共識按鈕不用混在筆記堆裡裝乖。"
  },
  {
    time: "06/21",
    title: "刷題榜不再少算半場",
    body: "有些場次明明 payload 裡有完整題目，明細卻只同步一半；現在改抓最完整紀錄，榜單別再裝失憶。"
  },
  {
    time: "06/21",
    title: "首頁不再偷搬全站",
    body: "入口先別急著預抓整包網站，帳號和留言也改成滑近才載；Safari 少一點卡頓，多一點做人。"
  },
  {
    time: "06/21",
    title: "刷題榜改看雲端病歷",
    body: "排行榜改由雲端作答明細重算，不再被某台瀏覽器的本機記憶牽著走；榜一被傳送走這種事先收工。"
  },
  {
    time: "06/21",
    title: "答錯不再假裝綠燈",
    body: "送出答案後，錯選會紅、正解會綠；腦袋想偷懶滑下一題，現在比較難裝沒看到。"
  },
  {
    time: "06/21",
    title: "待複習題庫可以收納了",
    body: "散題和模擬考右下多了編輯鍵，會了就丟完成區；突然覺得自己太囂張，也能再移回來。"
  },
  {
    time: "06/21",
    title: "年份設定回到西元宇宙",
    body: "開始測驗不再拿民國年去篩西元年題庫；以前存到 100 到 115 的設定也會自動翻譯成人話。"
  },
  {
    time: "06/21",
    title: "題目瑕疵回報有回音",
    body: "修掉一題 O2/CO2 下標亂跑，也把開放 A/D 給分的腎臟生理題補上；看到怪題回報，真的會有人去撿。"
  },
  {
    time: "06/21",
    title: "補充數字先露臉",
    body: "同學補充有幾張不用先點開才知道；首頁底下那排假裝很有資訊量的統計也收掉了。"
  },
  {
    time: "06/21",
    title: "Safari 滑首頁少喘一點",
    body: "Safari 版首頁少算一些玻璃霧面和重陰影，先把滑動救順，特效不要在旁邊偷吃效能。"
  },
  {
    time: "06/21",
    title: "首頁更新區收短",
    body: "最近網站更新只留最前面幾則，首頁是拿來開始刷題的，不是拿來讀站史。"
  },
  {
    time: "06/20",
    title: "首頁不要半路變背景",
    body: "帳號和留言改成靠近就自動載入，先用穩定卡片佔位，順手收掉漂浮特效和重陰影；滑首頁不用再等它補畫面。"
  },
  {
    time: "06/20",
    title: "首頁先別搬整包題庫",
    body: "帳號區不再為了年份選單拖整包題庫，弱點判讀也改成首屏穩住後自動整理；手機先順，焦慮再來。"
  },
  {
    time: "06/20",
    title: "首頁不要再排隊",
    body: "帳號、弱點判讀和留言板改回進頁就載；少一點神祕等待，多一點正常網站。"
  },
  {
    time: "06/20",
    title: "AI 詳解按鈕醒了",
    body: "重新替換詳解改成真的重寫，也不再被單一模型名字綁死；AI 如果又想裝死，現在比較難躲在按鈕後面。"
  },
  {
    time: "06/20",
    title: "首頁少喘一點",
    body: "更新列表只留最近幾則，手機背景特效也收斂；首頁先像網站，不要像在開期末總複習包。"
  },
  {
    time: "06/20",
    title: "首頁入口不用通關密語",
    body: "帳號區和留言板不再塞手動載入按鈕，進首頁就自己處理；少一層儀式，多一點乾脆。"
  },
  {
    time: "06/20",
    title: "同步狀態少嚇人",
    body: "登入後雲端如果整理比較久，現在會留在同步中而不是直接喊本機備戰；網站少一點狼來了。"
  },
  {
    time: "06/20",
    title: "手機首頁先不要自爆",
    body: "首頁減少重排和奇怪等待，Safari 不用一邊滑一邊懷疑人生。"
  },
  {
    time: "06/20",
    title: "焦慮模式開始盯人",
    body: "焦慮版首頁會看你今天、昨天和近 7 天刷幾題，還會隨時間換句話催你；不是被罵，是被國考前的自己提醒。"
  },
  {
    time: "06/20",
    title: "首頁入口比較像樣了",
    body: "按鈕保留短標題，但加上層次、角標和乾淨的卡片節奏；不再像白紙上貼幾塊豆腐。"
  },
  {
    time: "06/20",
    title: "首頁少講一點廢話",
    body: "同步狀態統一成三種人話，入口卡片只留標題，留言板滑到附近才載；首頁終於不再像期末共筆全部貼第一頁。"
  },
  {
    time: "06/20",
    title: "題目旁長出同學補充",
    body: "陽明詳解旁新增同學補充卡片，可貼解法、拖圖片進去、評價有沒有幫助，還能把最近補過的題目拖進筆記；讀書便利貼正式上工。"
  },
  {
    time: "06/20",
    title: "題目瑕疵可以寫病史",
    body: "回報題目有瑕疵時，可以先選題幹跑版、多重答案、選項問題等原因，再補一句主訴；站長終於不用靠通靈修題。"
  },
  {
    time: "06/20",
    title: "進度答對率重新算帳",
    body: "醫學一、醫學二答對率改用總答對題數除以總作答題數，不再把各科百分比直接平均；統計學終於少雷一點。"
  },
  {
    time: "06/19",
    title: "AI 詳解不再吐 JSON",
    body: "GPT 詳解會先講整題、再講各選項；不再把程式骨架直接噴出來，畫面終於比較像人寫的，不像資料庫在告解。"
  },
  {
    time: "06/19",
    title: "GPT 詳解可以重抽",
    body: "已替換的 GPT 詳解現在能再替換一次；不再被原本題庫爛詳解拉去同化，看到怪怪的就再按一次讓它重做人。"
  },
  {
    time: "06/19",
    title: "陽明詳解回報清倉",
    body: "把一大批被同學抓出來的陽明詳解缺圖、截斷、貼錯題整理掉；找不到可信原圖的題目，展開後會直接說沒有詳解。"
  },
  {
    time: "06/19",
    title: "手機藥理卡變好滑",
    body: "藥理卡手機版只在明顯橫滑時抓卡，往下看表格不再被攔胡；超長藥名會自動縮字，不再衝出卡片逃亡。"
  },
  {
    time: "06/18",
    title: "藥理卡開始滑起來",
    body: "藥理複習改成左滑會、右滑不會，還會照重要度和不熟程度抽卡；剛刷過先冷卻，不讓短期記憶出來假會。"
  },
  {
    time: "06/18",
    title: "錯題庫改名不再誤會",
    body: "散題和模考的上方統計改叫待複習題，錯題歸錯題、低信心歸低信心，不再像統計學在陰人。"
  },
  {
    time: "06/18",
    title: "112-2 疊字退散",
    body: "2023 第二次醫學（一）有些題目把「下列何者」念成咒語，已把 OCR 疊字壓回正常人類語言。"
  },
  {
    time: "06/18",
    title: "登出不再裝死",
    body: "Safari 如果跟 Supabase 眉來眼去太久，現在也會先把本機登出；刷題榜載太慢會給重試，不再原地發呆。"
  },
  {
    time: "06/18",
    title: "陽明詳解修圖不卡文字",
    body: "修正版如果只是刪掉多餘截圖，現在不用硬湊一篇作文；有原文字就保留，純圖片也能乖乖修圖。"
  },
  {
    time: "06/18",
    title: "作答紀錄比較不喘",
    body: "今天一番賞抽到顎之巨人，所以順手優化做題、送出答案和改信心的速度。希望國考也能像這抽運一樣讓我過。"
  },
  {
    time: "06/17",
    title: "回報題目瑕疵更順手",
    body: "因應劉人豪敲碗：題目旁新增「題目有瑕疵」回報，陽明詳解也把原始版面碎碎念收起來，只留圖片本體，少一點廢話多一點活路。"
  },
  {
    time: "06/15",
    title: "微免小科選題修正",
    body: "微生物免疫選病毒、細菌或免疫時，現在會用精簡設定重新建立題池，避免本機容量滿時沿用上一輪科目。"
  },
  {
    time: "06/15",
    title: "藥理卡 ABCDE 分級更新",
    body: "藥理複習卡已改用新版官方考古題重排分級，A/B 高頻藥會更常抽到，D/E 低頻藥仍會保留補洞。"
  },
  {
    time: "06/15",
    title: "藥理複習卡補強",
    body: "藥卡會依常考等級提高高頻藥物出現率，翻面會用顏色提示重要性，並把同分類表格移到下方加入作用與適應症。"
  },
  {
    time: "06/15",
    title: "修正微生物選科",
    body: "開始測驗只選微生物免疫時，題池會立即切到微生物，不會沿用上一輪藥理或其他科目。"
  },
  {
    time: "06/15",
    title: "藥理卡不再提前破梗",
    body: "同分類藥物會在翻開藥理複習卡後才顯示，下一張卡會重新隱藏。"
  },
  {
    time: "06/15",
    title: "新增藥理複習卡",
    body: "主頁新增藥理複習入口，可以隨機抽藥、翻卡看分類機轉口訣，並快速複製藥名。"
  },
  {
    time: "06/15",
    title: "全站答對率背景載入",
    body: "作答紀錄與錯題筆記會先顯示題目，全站答對率再分批補上，回看大量紀錄時比較順。"
  },
  {
    time: "06/15",
    title: "作答紀錄展開更順",
    body: "題目回顧改成點開才載入內容，整回模擬考或大量作答紀錄回看時比較不卡。"
  },
  {
    time: "06/15",
    title: "題目分類回報會同步套用",
    body: "管理員確認同學回報後，新的科目與章節分類會同步到開始測驗、題目搜尋與結果回顧。"
  },
  {
    time: "06/13",
    title: "忘記密碼連結修正",
    body: "重設密碼信現在會直接進到設定新密碼頁，不會再只回到首頁讓人找不到入口。"
  },
  {
    time: "06/13",
    title: "陽明詳解改成依題裁切",
    body: "陽明詳解會保留原始版面並裁到本題詳解區塊，也會留下作者補充的相關題，避免文字抽取跑版或混到隔壁題。"
  },
  {
    time: "06/13",
    title: "劉人豪忘記密碼",
    body: "我幫他補了忘記密碼功能，現在可以用 Email 收重設密碼信。"
  },
  {
    time: "06/12 晚上",
    title: "陽明詳解截圖修正",
    body: "修正部分詳解抓到封面、跨頁混到下一題、原頁截圖讀不到的問題，先回補 112-2 醫學一與 110-2 醫學一。"
  },
  {
    time: "06/12",
    title: "複製題目更乾淨",
    body: "複製給 AI 時不再附上網站舊詳解與標記觀念，避免 AI 被錯誤內容帶歪。"
  },
  {
    time: "06/12",
    title: "進度統計更準",
    body: "進度總覽與完成度統計改以正式題庫為主，不再把 AI 題算進總題數。"
  },
  {
    time: "06/12",
    title: "複製題目給 AI 更方便",
    body: "作答後、結果、錯題、筆記相關題與搜尋題目都能快速複製題目與答案；也新增極速做題模式。"
  },
  {
    time: "06/11 11:45",
    title: "陽明詳解讀取更穩",
    body: "修正部分考古題題號格式不同導致找不到詳解的問題。"
  },
  {
    time: "06/11 11:40",
    title: "做題同步減壓",
    body: "作答時先快速存到本機，再延遲同步到雲端，減少按下一題卡住。"
  },
  {
    time: "06/11 11:30",
    title: "陽明詳解截圖再檢查",
    body: "移除容易切到下一題的截圖，避免詳解混到隔壁題。"
  },
  {
    time: "06/09",
    title: "陽明詳解開放查看",
    body: "有詳解的題目可另外展開陽明詳解，也可以回報內容問題。"
  },
  {
    time: "06/05",
    title: "學習筆記連回考古題",
    body: "筆記右側可查看相關題目，讀筆記時能順手回到題庫練習。"
  }
] as const;

const VISIBLE_HOME_RELEASE_NOTES = HOME_RELEASE_NOTES.slice(0, 4);

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
            <Link href="/start" prefetch={false} className="home-action-card home-action-primary">
              <span className="text-sm font-bold">開始測驗</span>
            </Link>
            <Link href="/simulation" prefetch={false} className="home-action-card">
              <span className="text-sm font-bold">開始一份考古題</span>
            </Link>
            <Link href="/results" prefetch={false} className="home-action-card">
              <span className="text-sm font-bold">查看本機結果</span>
            </Link>
            <Link href="/search" prefetch={false} className="home-action-card">
              <span className="text-sm font-bold">題目搜尋</span>
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
                    prefetch={false}
                    className={action.tone === "primary" ? "home-action-card home-action-primary" : "home-action-card"}
                    style={{ "--home-delay": `${120 + index * 80}ms` } as HomeAnimationStyle}
                  >
                    <span className="home-action-mark" aria-hidden="true" />
                    <span className="home-action-title">{action.label}</span>
                  </Link>
                ))}
              </div>

              <div className="mt-3">
                <ClientSectionBoundary title="繼續測驗">
                  <ContinueQuizButton />
                </ClientSectionBoundary>
              </div>
            </div>

            <section className="home-release-notes mt-5" aria-labelledby="home-release-title">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="eyebrow text-[10px]">Updates</p>
                  <h2 id="home-release-title" className="mt-1 text-sm font-black tracking-[-0.02em] text-ink">
                    最近網站更新
                  </h2>
                </div>
              </div>
              <div className="home-release-scroll mt-3 space-y-2 pr-1">
                {VISIBLE_HOME_RELEASE_NOTES.map((note) => (
                  <article key={`${note.time}-${note.title}`} className="home-release-item">
                    <time className="text-[11px] font-black text-brand-700">{note.time}</time>
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-black text-ink">{note.title}</h3>
                      <p className="mt-0.5 text-xs font-semibold leading-5 text-slate-500">{note.body}</p>
                    </div>
                  </article>
                ))}
              </div>
            </section>

          </div>

          <div className="home-reveal home-reveal-late grid min-w-0 content-start gap-4 self-start">
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

            <div className="grid auto-rows-max items-start gap-3 sm:grid-cols-2">
              {QUICK_ENTRIES.map((entry, index) => (
                <Link
                  key={entry.href}
                  href={entry.href}
                  prefetch={false}
                  className="home-entry-card"
                  style={{ "--home-delay": `${220 + index * 70}ms` } as HomeAnimationStyle}
                >
                  <span className="home-entry-icon" aria-hidden="true" />
                  <span className="home-entry-title">{entry.title}</span>
                </Link>
              ))}
              <div className="home-entry-card home-study-card sm:col-span-2">
                <div className="grid gap-3 sm:grid-cols-2">
                  <ClientSectionBoundary title="學習筆記入口">
                    <OwnerOnlyNotesLink />
                  </ClientSectionBoundary>
                  <Link href="/pharmacology-review" prefetch={false} className="secondary-pill home-study-link px-4">
                    藥理複習
                  </Link>
                </div>
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
