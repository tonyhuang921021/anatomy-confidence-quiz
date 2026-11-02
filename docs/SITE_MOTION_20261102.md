# 全站共用動效候選（2026-11-02）

整合基準：`849eaebd76ce2ccfb649e3723286f79dadc2da8c`。這是父任務指定的正式基準，已確認該 commit 可由 GitHub 讀取；GitHub 預設 main 是較舊的 `6cd397f`，沒有以 main 取代指定基準。本候選在全新獨立部分 clone 製作，未讀寫原 writer 工作樹、未 push、未部署、未讀取金鑰或連接正式 DB。只有原 writer 整合後才能宣稱正式站完成。

## 技術與風格

已讀原專案交接所引用的 [Animate UI 官方固定版 SKILL](https://github.com/imskyleen/animate-ui/blob/e6cea6b5ae5a4985d3bf3cc0ebea173555eafd72/skills/animate-ui/SKILL.md)、catalog、tokens、rules、feel 及相關 recipes。現有 Next 14、React 18、Tailwind 3、自製元件，沒有 shadcn components.json 或 Radix／Base UI，因此延用 path C 的 CSS tween fallback 與原生 WAAPI，不安裝新動畫 runtime、不執行 CLI/codemod、不升級框架。

採克制風格，延續既有米白／深綠與閱讀密度。共享 swap 150ms/ease.out、menu 220ms/ease.soft、color 200ms/ease、choice scale .985。高頻作答／分頁立即更新，沒有等待退出才顯示新資料；不做數字計數、逐字顯示、整頁滑出、長文高度動畫或模糊正文。圖片仍沿既有原地放大，不改成燈箱。

## 共用覆蓋

| 層級 | 實作與目的 |
| --- | --- |
| `app/motion.css`、layout | 所有站內頁與 portal 共用 tokens、press、色彩、表面進場；保留既有焦點框即時顯示；列印靜態。 |
| `QuizRuntimeShell` | 移除只有學習頁的白名單；設定、留言、榜單、管理、密碼復原與預覽也共用動效。路由切換只對現有 app-content 短淡入，不重建、截取或等待頁面。 |
| `siteMotion`、`useSurfaceTransition`、`useQuestionChangeFeedback` | CSS 與 JS 共用 timing；快速切換從目前 opacity retarget，保留題目 DOM 與原有切題焦點修復。 |
| `useMotionPresence` | 續作、導覽、帳號選單、帳號設定與題目更多操作保留 150ms 視覺退出；關閉立即 inert、aria-hidden 與 pointer-transparent，既有 owner 立即還原焦點／捲動。重開沿用同一 DOM，取消移除，不排隊。 |
| `UserStatusBar` | 抽屜與帳號設定使用獨立 ref，避免兩個表面交接時，舊表面退出清掉新表面的焦點 ref。認證、送出與資料邏輯不變。 |
| `QuestionExplanationTabs`、原生 details | 展開短淡入；長文／長圖收合立即完成，不用高度動畫改動閱讀位置。更多操作有可中斷退出。 |
| `search` | 結果與分頁從目前透明度短淡入，沿用原結果標題焦點與捲動，不延後資料更新。 |
| 圖片與閱讀 | 既有詳解圖片與 Figure 的 expanded 狀態短淡入；不 tween width/height，不新增裁圖容器，不改讀者原圖或縮放定位程式。 |
| 其他 overlay | 線上人數、通知、分享編輯與陽明回報外層加進場；不改原本 modality、認證或送出行為。 |
| 載入 | 單一 observer 暫停 offscreen 的 aria-busy／spinner／pulse 動畫；隱藏分頁暫停 CSS 動畫，原狀態文字保留。沒有新增 JS 動畫循環。 |
| 手機 | Tailwind 3 `hoverOnlyWhenSupported` 統一 hover variants，避免觸控留下 hover；獨立 scale 不覆寫 Tailwind 定位 transform。 |
| Reduced motion | 移除新增位移／按壓縮放，以及既有裝飾循環；表面仍可短淡入與變色。即時偏好與新載入畫面皆使用 media query；不在 render 讀取 matchMedia，避免 hydration 差異。 |

## 路由與驗證邊界

40 個 page route 全數盤點。37 個固定路由，加 3 個動態路由樣本，桌面 1280×900 與手機 390×844 共 80 次巡檢，全部通過共享 shell、沒有 application error 與水平溢出檢查。逐頁 requested／resolved URL 在 `routes-desktop.json`、`routes-mobile.json`。

既有導向保留：`/settings` → `/?settings=1`、`/simulation-results` → `/results?scope=simulation`、`/post-exam-preview` → `/post-exam`。動態樣本為 `/notes/motion-local-fixture`、`/notes/subject/解剖學`、`/resources/motion-local-fixture`，驗空資料／錯誤狀態，沒有建立私人內容。

登入、owner 與分享頁的巡檢包含可公開呈現的介面／權限狀態；未登入正式帳號、未驗真實管理寫入、付款、生成、上傳或 DB。藥理來源的部分 public/data 與題目原圖不在稀疏副本，因此其巡檢不代表素材完整性驗收。既有 PDF／owner 外部 HTML 的內部正文不改動，父頁與控制項使用同一共用規則。未宣稱 Safari、Firefox 或實體 iPhone 已驗收。

## 測試結果

- 修改前 typecheck 通過；修改後 typecheck 通過。
- 桌面／手機 40 路由各一次：2 個批次測試、80 次巡檢通過。
- 視窗快速重開、關閉立即 inert、ESC、設定交接、焦點／body scroll 還原、返回導覽、offscreen loading、鍵盤按壓中間影格：10/10 通過。
- 虛構題作答、快速前後切題、refresh 保存完整答案、長詳解閱讀位置、reduced motion：8/8 通過（沿既有 study-motion regression，未改產品判分／儲存）。
- 既有已審詳解圖片 Enter 放大／縮小、完整圖片 frame、焦點不丟失、搜尋分頁標題焦點、手機 hover、深色閱讀：6/6 通過。
- 共 26 個瀏覽器案例通過，沒有新增 skip。失敗的早期測試有保留記錄：跨頁前一頁 redirect 會中斷下一次 goto，已改每路由新頁；搜尋先等既有 shell-ready；圖片 locator 改用穩定節點，因 accessible label 會正確從放大變縮小。沒有放寬功能斷言。
- 原 `npm run test:quiz-analysis` 命令因既有 CJS `@/data` 別名失敗（207 pass、1 harness failure）。在獨立 `/tmp/quiz-animation-analysis-tests` outDir，為編譯輸出加入資料 alias 後，全部 244 項通過，產品程式未為測試改寫。
- 全量 `npm run lint` 在未修改的 `manualPdmEvidence.d.cts`、`newExplanationFigures.d.cts`、`terraTrial.d.cts` 有既有 parser errors；所有修改與新增產品 TS／TSX 檔的定向 lint exit 0（仍有既有 hook/img warnings）。沒有關閉 lint 規則。
- 第一輪 production build 通過；最終 build 與 typecheck 結果見打包的 final logs。

## 整合方式

將 patch 套在原 writer 的最新整合分支，先以 `git apply --check` 或三方套用檢查，再比對原 writer 的新詳解變更。主要交集只有 layout 一行 import、search 的 import／ref／key，以及共用元件的 presence 和 data attribute；沒有 API、生成、審圖、帳務、DB schema 或題庫差異。若有衝突，優先保留原 writer 最新詳解邏輯，僅合入這些動畫接點。`app/motion.css` 須在 globals.css 後載入。

後續新增頁面／元件須走這套共享 tokens 與原生語意，並補跨頁、手機與 reduced-motion 驗收，不只更新首頁。部署與正式站最後驗收由唯一 writer 執行；本候選不做遠端發布。
