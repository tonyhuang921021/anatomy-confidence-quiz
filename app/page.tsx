import Link from "next/link";
import type { CSSProperties } from "react";
import { ContinueQuizButton } from "@/components/ContinueQuizButton";
import { ClientSectionBoundary } from "@/components/ClientSectionBoundary";
import { ExamCountdown } from "@/components/ExamCountdown";
import { LazyAuthPanel } from "@/components/LazyAuthPanel";
import { LazyFeedbackBoard } from "@/components/LazyFeedbackBoard";
import { HomeToneBanner } from "@/components/HomeToneBanner";
import { OwnerOnlyNotesLink } from "@/components/OwnerOnlyNotesLink";
import { PreExamSprintSurvey } from "@/components/PreExamSprintSurvey";
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
    time: "07/11",
    title: "各科進度可以拆開看",
    body: "進度總覽能展開每科的全部考點區塊，直接看完成度與答對率；原本不直覺的掌握度分數也先拿掉了。"
  },
  {
    time: "07/11",
    title: "陽明截圖續頁補回來",
    body: "幾題被截掉、貼錯頁或少補充的陽明詳解已重切成原始截圖；找不到相符來源的題目會先保留待大家留言補圖。"
  },
  {
    time: "07/11",
    title: "弱點排行點了就能補",
    body: "十科弱點會一次整理好；結果頁的弱點排行也能直接開刷，類似題會先看同考點再比題目關鍵字。"
  },
  {
    time: "07/10",
    title: "大型複習題池也能開",
    body: "上千題的待複習清單改用壓縮交接；全題庫科目與考點也統一採用新分類，不再被舊標籤拉錯科。"
  },
  {
    time: "07/10",
    title: "儲存題目可以一路刷",
    body: "上方按鈕會把待練題接成一整輪；每題會顯示答對幾次，答完一題也能中途結束。"
  },
  {
    time: "07/10",
    title: "考點分類重新整理",
    body: "考古題會顯示新的考點標籤；結果頁的弱點排行也改用同一套分類，補強方向更容易看懂。"
  },
  {
    time: "07/10",
    title: "跨裝置紀錄不再忽多忽少",
    body: "手機和平板同步大量舊紀錄時會等完整批次讀完；網路短暫卡住也不會把空結果誤認成已同步。"
  },
  {
    time: "07/09",
    title: "類似題可以先試答",
    body: "詳解列裡的類似題現在會先讓你選答案，再顯示紅綠判斷、正解和解析；看到值得回頭看的題也能直接儲存。"
  },
  {
    time: "07/09",
    title: "陽明詳解再補一輪",
    body: "幾題貼錯頁或少下一頁的陽明截圖已重切；找不到來源的題目會先收掉錯圖，等留言區救援。"
  },
  {
    time: "07/09",
    title: "題庫回報清掉一批",
    body: "幾題題面符號和空格已補正；陽明詳解也換回原始截圖，找不到來源的題目會先收掉錯圖。"
  },
  {
    time: "07/08",
    title: "結果頁也會牽類似題",
    body: "散題與模擬考結果的詳解列也能看相同觀念類似題；配題改看題幹和選項，題面斷字與下標也一起修好。"
  },
  {
    time: "07/08",
    title: "題庫回報再掃一輪",
    body: "補回幾題題面跑版字樣；一批陽明詳解也換成原始截圖，少頁、貼錯頁和被切掉的狀況再少一點。"
  },
  {
    time: "07/08",
    title: "錯題複習不再迷路",
    body: "待複習題池太大時會用安全交接，不會突然掉回解剖 10 題；藥理、微免和自訂卷錯題會守住原本題池。"
  },
  {
    time: "07/07",
    title: "同步舊紀錄補強",
    body: "重度刷題帳號按立即同步時，會把更早的本機完成紀錄分批補上；錯題完成區也一起讀完整紀錄。"
  },
  {
    time: "07/07",
    title: "題幹和陽明截圖再補一批",
    body: "兩題跑版題幹已修正；多題被切掉或貼錯頁的陽明詳解改回原始整頁截圖。"
  },
  {
    time: "07/07",
    title: "類似題收進詳解列",
    body: "錯題複習的相同觀念類似題移到詳解按鈕旁，只看考古題；也補上 2022 醫學二 Q94 題圖。"
  },
  {
    time: "07/06",
    title: "模擬考多了兩小時倒數",
    body: "每份模擬考右側會顯示兩小時倒數，可暫停；時間到不會自動交卷，結果頁也會留下作答時間。"
  },
  {
    time: "07/06",
    title: "打叉排除看得到了",
    body: "模擬考結果頁會在選項旁用 × 標出當時排除過的選項，回頭檢查思路更清楚。"
  },
  {
    time: "07/06",
    title: "陽明跨頁補充補回來",
    body: "幾題貼錯頁或被類似題切斷的陽明詳解已換回原始截圖；補充跨頁也會一起留住。"
  },
  {
    time: "07/06",
    title: "複習完成條件可調",
    body: "設定裡可以選錯題與沒信心題答對一次或兩次才進完成區，想快一點或嚴格一點都可以。"
  },
  {
    time: "07/06",
    title: "待複習回合更順",
    body: "錯題和沒信心題仍分開整理，但開始複習時可以一起做；題目也會邊做邊補，不再被 40 題卡住。"
  },
  {
    time: "07/06",
    title: "陽明錯圖不硬貼",
    body: "一題被貼到下一題的陽明詳解已改成找不到提示；有原圖再交給留言區救援。"
  },
  {
    time: "07/05",
    title: "送分題標示更清楚",
    body: "官方一律給分的題目會把所有選項都標成可採計，複製題目時也不再只帶出代表答案。"
  },
  {
    time: "07/05",
    title: "線上名單數字對齊",
    body: "點開線上同學時，按鈕人數會和下拉名單用同一份資料，不再一邊多一邊少。"
  },
  {
    time: "07/05",
    title: "單科抽題更穩",
    body: "寄生蟲這種小科不會因分類同步慢或題池異常跳去別科；科目修正也會背景補載。"
  },
  {
    time: "07/05",
    title: "題庫回報補圖修字",
    body: "修正幾題題幹與選項跑版，並補上一題肺癌組織圖；看到回報有料，我們就把它補進題庫。"
  },
  {
    time: "07/05",
    title: "結果頁詳解更清爽",
    body: "本題狀態與信心移到答案旁邊；AI 詳解先留核心與選項解析，其餘延伸內容可按 AI 詳解再展開。"
  },
  {
    time: "07/04",
    title: "錯題完成區再收穩",
    body: "移去完成區會立刻排在前面，也會同步影響開始待複習的題庫；顯示更多題時不再把完成狀態看起來弄丟。"
  },
  {
    time: "07/04",
    title: "HTML 資源不重開",
    body: "資源交流區的 HTML 預覽切到別的視窗再回來，會保留原本 iframe，不再因登入刷新整頁重載。"
  },
  {
    time: "07/04",
    title: "錯題複習入口修正",
    body: "開始散題待複習會把錯題池直接帶進網址；就算瀏覽器暫存慢半拍，也不會跳成一般散題。"
  },
  {
    time: "07/04",
    title: "跨頁紀錄補穩",
    body: "登入後切到錯題、結果與進度頁時，會一起讀同裝置暫存紀錄；錯題移到完成區也不會因瀏覽器儲存失敗白屏。"
  },
  {
    time: "07/04",
    title: "作答紀錄再加保險",
    body: "完成回合會先留在待上傳備份；要等雲端真的讀回完整題數，才會清掉本機保護，切頁後比較不怕紀錄倒退。"
  },
  {
    time: "07/04",
    title: "陽明詳解續頁補齊",
    body: "今天補上一批少頁、截斷與貼錯頁的陽明原頁截圖；CO₂ 題的上標亂碼也整理回可讀格式。"
  },
  {
    time: "07/04",
    title: "資源分享 HTML 不白跑",
    body: "看過的 HTML 附件會在同一個分頁內暫存；回到同一份資源時少一次重載，切頁比較穩。"
  },
  {
    time: "07/03",
    title: "考前回饋小問卷",
    body: "首頁新增考前衝刺快速問卷；先看全站與自己的刷題小回顧，再告訴我考前最該守住哪些功能。"
  },
  {
    time: "07/03",
    title: "詳解截圖補到更完整",
    body: "一批被切掉、貼錯頁或多帶空白頁的陽明詳解已換成原頁截圖；疑義給分題也同步補上可採計答案。"
  },
  {
    time: "07/03",
    title: "Safari 作答減壓",
    body: "作答中仍會本機即時存，但雲端改成較輕的 checkpoint；Safari 切題時少做背景同步，比較不拖手感。"
  },
  {
    time: "07/03",
    title: "AI 詳解不倒退",
    body: "新補的詳解會用更新時間保護；100 題結果頁後段題目也會分批讀到新版詳解，不再卡在舊短版。"
  },
  {
    time: "07/02",
    title: "結果頁展開不跳走",
    body: "模擬考回顧仍最多展開兩題；點下方題目時，畫面會穩穩留在剛點的那一題。"
  },
  {
    time: "07/02",
    title: "Safari 模擬考更順",
    body: "模擬考切題時減少 Safari 的重繪負擔，題號導覽和作答功能維持原本的用法。"
  },
  {
    time: "07/02",
    title: "雲端紀錄時間補正",
    body: "修正完成紀錄的雲端更新時間，進度瀏覽比較不會突然跳回幾個小時前的狀態。"
  },
  {
    time: "07/02",
    title: "模擬考多兩個小工具",
    body: "設定裡可以開方向鍵切題；模擬考也能在選項右側打叉，結果與 AI Prompt 會一起帶出。"
  },
  {
    time: "07/02",
    title: "暗夜模式補對比",
    body: "藥理翻卡與半透明卡片在暗夜模式下改成深色底；首頁開始測驗按鈕切換模式後也不會反白。"
  },
  {
    time: "07/02",
    title: "錯題完成判定再收緊",
    body: "錯題測驗會用最近一次答錯後連續答對兩次判定完成；開始待複習也不會把完成區題目塞回去。"
  },
  {
    time: "07/02",
    title: "藥理卡可以反向滑",
    body: "設定裡新增藥理卡滑動方向；預設維持左會右不會，也可以改成左不會右會。"
  },
  {
    time: "07/02",
    title: "詳解圖又補一輪",
    body: "幾題貼錯或被切掉的陽明詳解已換成原頁截圖；找不到來源的題目會直接標出，等大家留言救援。"
  },
  {
    time: "07/02",
    title: "散題進度跟抽題池對齊",
    body: "開始頁會套用最新分類修正再算未做題，快刷完時比較不會看到剩幾題卻一直抽不到。"
  },
  {
    time: "07/01",
    title: "抗焦慮版變溫柔了",
    body: "首頁抗焦慮版新增一批比較像每日提醒的小長文；打開題目之前，先讓腦袋少一點自責。"
  },
  {
    time: "07/01",
    title: "快收尾的科目更會收尾",
    body: "散題快刷完時，開始頁看到的未做題會優先帶進下一回；刷題榜也會補上自己的名次，不會因為不在前 50 就像沒同步。"
  },
  {
    time: "07/01",
    title: "詳解少一個雜訊",
    body: "每題詳解不再顯示題庫內部的 testedConcept 標籤，畫面會直接進入答案、解析與選項說明。"
  },
  {
    time: "07/01",
    title: "信心度總覽可下載",
    body: "模擬考結果頁的信心度總覽新增截圖按鈕，可以直接下載乾淨版圖片，方便存起來或分享。"
  },
  {
    time: "07/01",
    title: "快刷完時不再偷跑",
    body: "散題進題前會先等登入紀錄同步好；承上題多補一題時也會真的答完再結算，剩幾題比較不會卡住。"
  },
  {
    time: "07/01",
    title: "找不到的詳解會直接講",
    body: "少數確定貼錯又找不到原圖的陽明詳解，現在會標出「找不到這題」，也請手上有圖的人來留言區救援。"
  },
  {
    time: "07/01",
    title: "題庫回報再清一輪",
    body: "修正一題化學式跑版，並補回一批陽明詳解截圖；少一點猜字，多一點看原圖。"
  },
  {
    time: "07/01",
    title: "剩幾題卡住再補一刀",
    body: "散題與進度頁會一起合併登入、暫存與待上傳紀錄；熟練狀態也改成不會誤會成 100% 刷完的說法。"
  },
  {
    time: "06/30",
    title: "剩幾題現在比較不玄學",
    body: "散題未做數會合併本機、雲端與待同步紀錄；做完一輪後下一輪會重新刷新，先把真的未做題抓出來。"
  },
  {
    time: "06/30",
    title: "模擬考多看一眼及格把握",
    body: "信心校準新增正式考 100 題、60 分及格機率估計，也會顯示預估分數與可能範圍。"
  },
  {
    time: "06/30",
    title: "AI 詳解更好讀",
    body: "單題 AI 詳解會分段講本題核心、判斷邏輯、相近概念和常見混淆；需要比較時也能生成表格，眼睛不用橫跨整片螢幕。"
  },
  {
    time: "06/30",
    title: "AI 補弱改看題目本身",
    body: "複製給 AI 的補弱 Prompt 不再餵題庫概念標籤，改用題幹、選項、正解與詳解線索推真正考點。"
  },
  {
    time: "06/30",
    title: "巔峰賽先下架",
    body: "巔峰賽模式已從入口與後端移除，網站先回到散題、模擬考、自訂卷與錯題複習這幾條主線。"
  },
  {
    time: "06/30",
    title: "手機登入更努力留下",
    body: "登入狀態改成多層保存，手機切去查資料再回來時，會更努力延續同一個帳號。"
  },
  {
    time: "06/30",
    title: "模擬考信心可自己決定",
    body: "設定裡可以開關模擬考信心校準；散題仍會記錄信心，低信心題照常進複習。"
  },
  {
    time: "06/29",
    title: "真實掌握看得更清楚",
    body: "結果頁新增校準後掌握指數、錯誤自信與猜對風險提醒，最後一題的信心也會一起算進去。"
  },
  {
    time: "06/29",
    title: "模擬考信心地圖",
    body: "模擬考結果頁新增信心度總覽，100 題一眼看出哪幾題不穩，也能直接看到每題答對或答錯。"
  },
  {
    time: "06/29",
    title: "散題選科更快",
    body: "開始測驗的醫學一、醫學二區塊各自多了全選按鈕，想混刷整包不用再一科一科點。"
  },
  {
    time: "06/29",
    title: "AI 補弱 Prompt 可選長短",
    body: "結果頁複製給 AI 時可以選簡略或詳細；詳細版會把相近錯題串成一段區塊複習，模擬考信心按鈕也不再殘留上一題。"
  },
  {
    time: "06/29",
    title: "手機登入比較黏了",
    body: "帳號區新增記住 Email，手機切去查資料再回來時也會主動刷新登入狀態，不再一下就被丟回訪客。"
  },
  {
    time: "06/29",
    title: "AI 模擬卷結果修正",
    body: "AI 原創卷做完後，結果頁會用試卷 key 自動補回題目；就算雲端只先回傳答題紀錄，也不會看不到解析。"
  },
  {
    time: "06/29",
    title: "回報題庫又補了一輪",
    body: "修正 2 題題目文字格式，並把一批陽明詳解改回原始截圖；該看圖的地方就讓圖自己說話。"
  },
  {
    time: "06/29",
    title: "模擬考多一格 AI 出題",
    body: "整份模擬考新增 AI 原創卷來源，醫學（一）進階 B 卷和醫學（二）進階卷都能直接開寫。"
  },
  {
    time: "06/28",
    title: "同步變輕一點",
    body: "作答中改成較少、較小包的雲端同步，完成紀錄照樣即時保護；資料要穩，帳單也要冷靜。"
  },
  {
    time: "06/28",
    title: "線上名單不再被壓住",
    body: "點開線上人數時，名單改成浮在最上層；不用再從被卡住的半張小紙條猜誰在線。"
  },
  {
    time: "06/28",
    title: "最後幾題不再躲貓貓",
    body: "單科快刷完時，弱點補強會先抓沒做過的題目，再用舊題補滿；差幾題滿進度的人可以停止跟系統互相懷疑。"
  },
  {
    time: "06/28",
    title: "題目可以先按書籤",
    body: "散題、模擬考、結果和錯題複習都能儲存題目，首頁也多了儲存題目入口；想到要補的題不用再靠腦內便利貼。"
  },
  {
    time: "06/28",
    title: "同步紀錄多一層保險",
    body: "跨裝置合併更偏向保留完整作答明細，錯題答對兩次也會乖乖進完成區；首頁入口順手重排，不再空一塊。"
  },
  {
    time: "06/28",
    title: "陽明截圖跟題目補洞",
    body: "補上一批陽明詳解原圖，也把缺圖、下標跑位和官方給分修正整理好；少一點猜圖，多一點刷題。"
  },
  {
    time: "06/25",
    title: "題目表格跟陽明圖補班",
    body: "補齊一批陽明詳解截圖，也把幾題跑版的下標、血紅素式和公衛表格整理好；看題目不用先破譯。"
  },
  {
    time: "06/25",
    title: "模擬考題號會看臉色",
    body: "右側已作答題號會照信心變色：紅橘黃一路提醒你哪題心虛；還沒答的先維持白色，不亂假裝很穩。"
  },
  {
    time: "06/25",
    title: "同學補充變好讀",
    body: "同學補充改吃筆記同款排版，標題、表格、圖片和字級都比較像正經讀書資料，不再像臨時貼的小紙條。"
  },
  {
    time: "06/25",
    title: "結果頁答對率補齊",
    body: "回顧一整份結果時，全站答對率改成分批補完，不再只有前面幾題有徽章、後面開始裝失憶。"
  },
  {
    time: "06/25",
    title: "線上同學省流回歸",
    body: "頂端可以看現在幾個人在線，點一下才抓名單；不用即時查勤燒錢，也能知道誰還在跟國考互毆。"
  },
  {
    time: "06/25",
    title: "藥理詳解不再裝熟",
    body: "修正 sirolimus 詳解，順手把酵素效率和甲狀腺素選項的下標排版抓回來。"
  },
  {
    time: "06/24",
    title: "交流區手機不要橫著逃跑",
    body: "資源分享和 HTML 預覽補上手機寬度保護，長檔名、表格和神祕 HTML 先乖乖待在螢幕裡。"
  },
  {
    time: "06/24",
    title: "交流區開始認暱稱",
    body: "發文和留言會優先顯示你設定的暱稱，不再像資料庫點名一樣冷冰冰。"
  },
  {
    time: "06/24",
    title: "HTML 資源直接開全螢幕",
    body: "交流區的 HTML 不再變原始碼瀑布，點開就是互動頁；不用先考古 <style> 才能讀書。"
  },
  {
    time: "06/24",
    title: "交流區終於像交流區",
    body: "口訣、考點提醒可以直接發，檔案改成附件；不用每次都把一句話包成大型上傳儀式。"
  },
  {
    time: "06/24",
    title: "資源分享區開張",
    body: "講義、PDF、圖片和 HTML 都可以丟進交流區；不匿名，按讚留言自己承擔學術熱情。"
  },
  {
    time: "06/24",
    title: "網站少一點自燃",
    body: "背景資料和同學補充先吃快取，搜尋框也不要每打一字就叫醒半個題庫；省流量，也省資料庫的命。"
  },
  {
    time: "06/24",
    title: "題目搜尋不要邊打邊昏倒",
    body: "搜尋框先專心找題，詳解和同學補充等你展開再載；不再每打一字就叫醒半個題庫。"
  },
  {
    time: "06/24",
    title: "陽明詳解補回正確截圖",
    body: "補齊 16 題被切錯、頁面不對或缺頁的陽明詳解；該看圖的地方現在不再考驗想像力。"
  },
  {
    time: "06/24",
    title: "表格跟缺字不再裝謎語",
    body: "補回 IVIG、IL-10、寄生蟲宿主和診斷表格的掉字；選項不用再像被 PDF 咬過。"
  },
  {
    time: "06/23",
    title: "模擬考別再改名叫自己",
    body: "考古卷名稱會抓回年份、醫學一二和卷別；做過幾次也不再因為叫模擬考就假裝失憶。"
  },
  {
    time: "06/23",
    title: "考古卷紀錄找回來",
    body: "雲端作答紀錄會帶回是哪一份考古卷，模擬考清單不用再裝失憶；本機滿到寫不進去也先保留可讀紀錄。"
  },
  {
    time: "06/23",
    title: "細菌寄生蟲換新版",
    body: "細菌複習升到彈窗堆疊版，寄生蟲補上中英蟲名連結；點名不再像在背失散親戚。"
  },
  {
    time: "06/23",
    title: "模擬考結果不再少半截",
    body: "雲端一次抓很多作答紀錄時不會再被 1000 筆上限切掉；醫學一醫學二不用集體停在 67 題。"
  },
  {
    time: "06/23",
    title: "把帳單怪獸關小聲",
    body: "全站不再把靜態檔當即拋用品，首頁統計和同學補充也會短暫快取；省錢順便讓 Safari 少發作。"
  },
  {
    time: "06/23",
    title: "作答紀錄跨裝置補齊",
    body: "同步不只喊已同步，現在也會把雲端作答場次補進列表；第 67 筆卡住的劇情先下架。"
  },
  {
    time: "06/23",
    title: "少一張表格補回來",
    body: "醫學二那題病例對照研究的列聯表已補圖，現在不用靠通靈判斷要用哪個檢定。"
  },
  {
    time: "06/23",
    title: "同步鍵不再一拳打爆",
    body: "手動同步改成短時限補傳最近紀錄，雲端慢就先留本機；不用按一下就跟資料庫互毆。"
  },
  {
    time: "06/23",
    title: "疑義題給分不裝沒事",
    body: "補上兩題官方開放給分，順手把幾個選項 OCR 空格抓回來；Spearman 和 A型人格不用再自己腦補。"
  },
  {
    time: "06/23",
    title: "自由測驗先別整包扛",
    body: "自由測驗改成先掛 10 題，快做完才偷偷補下一批；雲端補傳也更勤快，不用每次自己去拜託它上傳。"
  },
  {
    time: "06/22",
    title: "模擬考信心可以反悔",
    body: "信心按錯不用跟它結婚，再按一次就取消；國考前先練習健康的反悔能力。"
  },
  {
    time: "06/22",
    title: "Safari 開站先別自爆",
    body: "Safari 如果留了很肥的本機紀錄，首頁會先降載再慢慢同步，不再一開就重整到懷疑人生。"
  },
  {
    time: "06/22",
    title: "電腦刷題載入中會自救",
    body: "某台電腦如果留到壞掉的暫存卷，現在會自動清醒重開，不再對著載入中發呆。"
  },
  {
    time: "06/22",
    title: "題目空格被抓回來",
    body: "修掉幾題 OCR 把英文和公式拆成碎片的問題，Broca 和 kcat/Km 不再像被鍵盤打散。"
  },
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
                    <p className="eyebrow text-[10px]">Next Step</p>
                    <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-ink">今天直接進題目</h2>
                  </div>
                  <PreExamSprintSurvey />
                </div>
                <div className="mt-6 grid gap-4">
                  <ExamCountdown />
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
                  </div>
                </div>
              </div>
            </div>

            <div className="grid auto-rows-max items-start gap-3 sm:grid-cols-2">
              <div className="home-entry-card home-study-card sm:col-span-2">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-3">
                    <ClientSectionBoundary title="學習筆記入口">
                      <OwnerOnlyNotesLink />
                    </ClientSectionBoundary>
                    <Link href="/resources" prefetch={false} className="secondary-pill home-study-link px-4">
                      資源分享
                    </Link>
                  </div>
                  <div className="grid gap-3">
                    <Link href="/pharmacology-review" prefetch={false} className="secondary-pill home-study-link px-4">
                      藥理複習
                    </Link>
                    <Link href="/saved-questions" prefetch={false} className="secondary-pill home-study-link px-4">
                      儲存題目
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="home-reveal home-reveal-late mt-6 grid gap-6">
        <ClientSectionBoundary title="帳號區塊">
          <LazyAuthPanel />
        </ClientSectionBoundary>

        <ClientSectionBoundary title="留言板">
          <LazyFeedbackBoard />
        </ClientSectionBoundary>
      </div>
    </main>
  );
}
