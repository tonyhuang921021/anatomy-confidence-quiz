# 全站動效覆蓋與合併發布交接

## 範圍與版本

本機分支 `codex/animate-ui-local-20261020`，基底 `b0ce345ba371729929bdff002c5bda422b8029ed`。37 個實際 page route 已盤點，清單見 `evidence/motion/journey/route-inventory.txt`。既有刷題動效與使用者工作全部保留。

使用者後續明確要求首頁及完整核心流程，並授權「動畫＋已完成詳解」合併發布。此文件記錄動效實作；目前已依作者四份 SHA-256 核對來源整合 112 年第二次 200 題詳解，詳見 REVIEWED_READERS_RELEASE.md。新詳解已移除 AI 產生／更換按鈕，保留簡解／詳解切換、人工補充與舊題原有功能。

發布前已唯讀確認：GitHub main 仍為 b0ce345，正式域名 `anatomy-confidence-quiz.vercel.app` 對應 Vercel Ready `dpl_4f5xgRykMF1n93Tfjz7jEUPUCxad`，project `prj_SrlcE3pvvhFFinApTJe15s4r7olH`。GitHub CLI 已連線正確帳號。這是發布前基準；本次發布的確切 commit 與線上驗收另記於交付結果。

## 覆蓋清單

| 真實頁面／元件 | 動效與保留的行為 | 驗證方式 |
| --- | --- | --- |
| 首頁 `/`、HomePageMotion、HomeToneBanner | 主標即時可讀；照片淡入，入口 300ms／80ms 分組輕移，更新／留言標題僅首次進視窗回應；沒有循環、模糊或等待 JS 才顯示的樣式 | 桌機／手機原尺寸截圖、進場中間影格、自然流程錄影 |
| 首頁主要入口與工具 | 色彩與箭頭導向回饋、按下 0.985；滑鼠 hover 僅限 fine pointer，鍵盤 focus 同樣有回饋，觸控不留下 hover | Space 按壓、Enter 導覽、焦點框、窄螢幕與 reduced motion |
| 繼續作答 ContinueQuizButton | 面板 220ms 輕移淡入；立即關閉；增加開啟焦點、Tab 圈限、Esc 返回原觸發鈕；不改讀取／續作／刪除資料邏輯 | 空清單焦點／快速開關＋既有 13 題完整續作回歸 |
| 共用 UserStatusBar 導覽 | 桌機／手機入口按壓，抽屜與帳號選單 220ms；更多內容短淡入；沿用原焦點、關閉與路由機制 | 導覽開關、更多、設定返回焦點、手機底欄既有測試 |
| `/start`、FreePracticeSetup | 選科／按鈕選取回饋；步驟 150ms 淡入且 DOM 不重建；設定展開淡入及箭頭轉向；現有步驟標題焦點、記憶設定與選科資料不變 | 選科→下一步→展開／收合設定→開始 10 題；一般與 reduced motion |
| `/simulation`、QuizSetupPanel | 共用選項按壓／選取色、頁面短淡入；不改整卷題池與計時 | 頁面 smoke＋既有模考流程回歸 |
| `/quiz`、QuestionCard／QuizClient | 保留原選項回饋、150ms 切題、進度 transform 與焦點修復 | 10 題實際完成、既有快速切題／refresh／正誤完整性測試 |
| QuestionExplanationTabs、解析 | 共用 150ms 淡入、展開語意、收合即移除；不讓長文高度動畫推移閱讀位置 | 陽明假 API 長文、觸發鈕位移 <3px、焦點保留；新詳解 200 題於桌機與手機逐題切換驗收通過 |
| `/results`、`/simulation-results`、ResultSummary | 成績直接顯示真值並淡入，沒有從 0 計數；錯題／沒信心／全部篩選 150ms 不重建控件；詳解開合淡入 | 10 題結果計數、全部 10 題、鍵盤展開／收合、既有 full-screen／紀錄合併測試 |
| `/review`、`/simulation-review`、`/saved-questions` | 共用頁面、已存在選擇與按鈕回饋，保留閱讀內容靜止 | 公開頁面 smoke＋既有回顧測試 |
| `/search`、`/custom-papers`、`/progress` 及其學習子頁 | 共用表面短淡入與選擇／primary、secondary 操作回饋；不逐題延遲或將搜尋清單整批重排動畫 | 公開頁面 smoke、既有搜尋／組卷／進度選科回歸 |
| `/pharmacology-review`、`/pharmacology-review/library`、`/notes`、`/resources` 及閱讀子頁 | 共用操作回饋；閱讀正文不逐行動畫 | 列表入口 smoke、藥理既有資料／手機回歸；動態內容頁未逐筆寫入或驗證 |
| `/leaderboard`、`/post-exam` | 保留既有內容與特有圖表，使用共用導覽回饋，未增加數字迴圈 | 兩引擎頁面 smoke |
| `/settings`、`/feedback` | 沿用既有首頁設定／留言入口與共用面板，不改認證或留言送出 | 既有設定、留言、通知回歸 |
| owner 管理頁、reset-password、PDF/integration、post-exam-preview | 盤點但不加入新內容動畫；這些不是此次核心學習動效改版範圍 | 不宣稱完整業務測試或新功能覆蓋 |

## 實作取捨

沿用官方 Animate UI 自訂元件路徑 C；React 18 與既有框架不升級，無新增動畫 runtime。使用 reveal 300ms、swap 150ms、menu 220ms、color 200ms、choice 0.985；CSS tween 是已說明的相容 fallback。進場位移只有 8px，導向箭頭 4px；首頁主標不動畫。高頻路由／篩選只淡入，不等退出動畫。原生 details 與設定收合立即移除互動範圍，避免透明內容攔截鍵盤。

Safari 原先全面停用首頁動畫的規則仍存在；只有本輪具名、已驗證的首頁效果以窄範圍規則覆蓋，不撤除其他 Safari 保護。所有新位移／縮放在 reduced motion 下移除，保留淡入與色彩；同步修掉原首頁提示在 reduced motion 下仍位移的遺漏。

`useSurfaceTransition` 只對現有節點做 opacity；快速觸發取消前次並接續當前透明度，不設 React 每影格 state、不複製題目、不延遲資料更新。成績、題庫、同步與答案儲存程式沒有改寫。

## 驗證進度

- 修改前 typecheck 通過；233 項 quiz-analysis 再次通過。
- 第一輪新增 8 案例：7 通過，1 個 reduced motion 檢查抓到舊 HomeToneBanner 位移，已修正。
- 最新正式 build 與 102 個完整瀏覽器案例完成：97 通過、5 個既有條件略過、0 失敗（5.8 分鐘）。包含兩引擎的正常／reduced motion 首頁→選科→10 題→解析→結果流程。
- build 後 typecheck、lint 與 git diff --check 通過；lint 保留 38 個既有警告，沒有新增警告。完整原始結果為 `evidence/motion/journey/full-results.json`。
- 主流程使用真正本機題庫、隔離訪客儲存、假遠端 API；未寫正式資料。截圖及影片不是 mock 網頁或圖片合成。

## 可播放交付

- 桌面：`evidence/motion/journey/anatomy-journey-chromium-desktop.mp4`，H.264、1280×900、15.12 秒，Library `libfile_2ec2b7ce90148191b115384378a9e1d3`。
- 手機：`evidence/motion/journey/anatomy-journey-webkit-mobile.mp4`，H.264、390×844、12.314 秒，Library `libfile_f05fe1b7c08c8191bf09645fa9c3993b`。
- 兩份影片均由完整真實瀏覽器錄影直接轉碼，未加速、裁切畫面或插入合成 UI；已檢查逐秒接觸表、原尺寸關鍵截圖與影片媒體資料。
- 首頁桌面／手機截圖分別為 Library `libfile_6aab8326f0108191932851f39eace978`、`libfile_64cd8ff2cbe4819193da8731f6f43757`；上傳 manifest 為 `evidence/motion/journey/library-attachments.json`。
- 這些是新詳解交接前的動效驗收錄影，不代表合併新版詳解已上線。合併後仍需專門驗證新版內容、切換與更換按鈕條件。
