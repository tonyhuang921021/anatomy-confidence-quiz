# 國考刷題網站：本機動效版本

本文件保留第一階段作答動效驗收。後續首頁、共用導覽與完整旅程覆蓋、最新測試及合併發布狀態，請見 [STUDY_MOTION_COVERAGE.md](./STUDY_MOTION_COVERAGE.md)。

## 基底與隔離

- 正式網站：https://anatomy-confidence-quiz.vercel.app
- GitHub：https://github.com/tonyhuang921021/anatomy-confidence-quiz
- 固定基底：`b0ce345ba371729929bdff002c5bda422b8029ed`，已由 GitHub `main` 與正式版交叉核對。
- 本機分支：`codex/animate-ui-local-20261020`。
- 路徑：`/Users/huangguanlun/Documents/Codex/2026-10-20/task/anatomy-quiz-motion`。
- 使用乾淨的新 clone；未覆寫原專案、歷史工作目錄或其 dirty work。沒有推送、合併或部署。

盤點結果：原 `/Users/huangguanlun/Projects/anatomy-confidence-quiz` 在 `codex/laozhao-anatomy-preview`、`fef78d3`，有 API、陽明解析、題庫與腳本等未提交修改；redesign 工作樹在 `04c7446`。歷史 `2026-10-11/task/implementation` 在 `codex/explanation-quality-first-batch`、`15cb010`，且 origin 指向舊本機專案。另找到 `2026-10-11/task/yangming-release`，其 `codex/yangming-reviewed-release` 指向正式版 `b0ce345`。兩個歷史目錄的狀態檢查發生 I/O 逾時，因此沒有把它們當作乾淨工作基底。新 clone 的分支與初始 dirty state 已實際核對。

已閱讀全域 `~/.codex/AGENTS.md`、`~/.codex/workflows/anatomy-quiz.md` 及直接相關的發布、答題不變條件與 UI 驗證指引；固定正式版沒有額外專案 `AGENTS.md`。

## 官方 skill 與相容性

依據 [官方 Animate UI skill 固定版本](https://github.com/imskyleen/animate-ui/tree/e6cea6b5ae5a4985d3bf3cc0ebea173555eafd72/skills/animate-ui)，已讀 SKILL、catalog、rules、tokens、feel、press、disclosure 與 swap 參考。個人 skill 的資訊由父任務確認；本執行環境未列出該項，故直接讀取同一官方固定版本。

專案是 Next 14.2.35、React 18.3.1、Tailwind 3.4.17、TypeScript 5.8.3、Node 20，使用自製 React 元件，沒有 `components.json`、Radix、Base UI 或 React Aria。官方 npm registry 的 `@animate-ui/react` 2.0.0 要求 React/React DOM `^19.0.0`，Motion 14.4.0 支援 React 18/19。為保留既有框架，採用 **C：自訂元件的 CSS 規則與 tokens**，另用瀏覽器原生 Web Animations API 淡入切題。未加入動畫 runtime、未執行 CLI、migrate 或 codemod。

## 實際互動

| 位置 | 行為 | 相關檔案 |
| --- | --- | --- |
| 選項 | 按下縮至 0.985，選取色與正誤色柔和變化；鍵盤焦點立即可見，hover 僅適用滑鼠 | `QuestionCard.tsx`、`globals.css` |
| 答後回饋 | 狀態與答案標記短淡入，保留既有正誤文字與判分 | `QuizClient.tsx`、`QuestionCard.tsx` |
| 切題 | 150ms、0.75→1 的可讀淡入；保留 DOM，快速操作延續目前透明度，不排隊、不保留舊題 | `useQuestionChangeFeedback.ts` |
| 解析展開 | 150ms 淡入；觸發鈕保留焦點，標示展開狀態及對應區域；收合立即移除內容 | `QuestionExplanationTabs.tsx` |
| 進度 | 使用整條 bar 的 translateX，避免每幀改寬度或拉伸圓角；增加 progressbar 語意 | `QuizClient.tsx` |

切題若讓原本取得焦點的下一題按鈕消失，焦點立即回到新題目的非操作閱讀區，使用 `preventScroll`；不把焦點直接交給答案按鈕，避免連按 Enter 誤作答。初始題目不隱藏、不等 hydration 後才淡入。

使用 `transition.swap`（150ms / ease.out）、`transition.color`（200ms / ease）、`transition.menu`（220ms / ease.soft）與 `scale.choice`（0.985）。與 skill 預設的差異：CSS press／progress 使用官方 tween fallback；高頻解析只淡入，不做 350ms 高度動畫或 blur，避免長圖文重排及閱讀干擾；退出立即完成，不留下可聚焦的透明內容。

Reduced motion 保留狀態色與淡入，取消 press scale、進度位移動畫及平滑捲動。沒有新增動畫迴圈、React 每幀 state、延遲送出或動畫完成後才更新資料的流程。

## 驗證與證據

本機實作與驗收收尾完成。HEAD 仍為 `b0ce345`；全部成果保留在本分支未提交差異中，沒有提交、推送、合併或部署。

| 檢查 | 實際結果 |
| --- | --- |
| typecheck | 基準、產品修改後及本次測試修改後均通過；`evidence/motion/final-typecheck.log` |
| lint | 通過，38 個既有 hook／img 警告；沿用同版產品程式的 `lint.log` |
| quiz-analysis | 233/233 通過；沿用同版產品程式的 `quiz-analysis.log` |
| build | 修改後產品程式已成功建置；本輪沿用同一 prebuilt，沒有產品程式變更。`initial-build.log` 是前一輪直接 build 日誌，並非最後一輪完整建置日誌 |
| 剩餘失敗定向回歸 | 通知與解析共 4/4 通過，`targeted.log`、`targeted-results.json` |
| 完整 site-shell | 92 案例：87 通過、5 個原有範圍限定略過、0 失敗、0 flaky；`final-site-shell.log`、`final-site-shell-results.json` |
| 動效驗收 | 原 10 案例＋自然速度錄影 2 案例，12/12 通過；沒有新增 skip 或放寬斷言 |
| Worker 根因對照 | Chromium/WebKit 共 2/2 診斷通過；`worker-diagnostic-*.json`、`worker-diagnostic.spec.ts` |

5 個略過皆為原有測試範圍設計，並非這次為通過而略過，也不代表所有平台都已覆蓋：

- Chromium 桌機略過 4 項手機專用測試：藥理水平裁切、底部更多導覽、回顧快速導覽不被底欄遮住、滿版回顧焦點圈限／Esc。這 4 項皆在 WebKit 手機通過。
- WebKit 略過 1 項「藥理資料列出的每一題都能對應站內題庫」：純資料完整性只執行一次，已在 Chromium project 通過。

### 影格取樣與實際限制

完整回歸的 600ms 取樣中，Chromium 中位數 16.7ms、最大 16.8ms；WebKit 中位數 16ms、最大曾達 124ms。為避免忽略異常，另做兩引擎各 3 次隔離短取樣，6/6 操作案例通過：Chromium 三次最大均 16.8ms；WebKit 最大分別為 38、27、26ms，中位數均 17ms。每次原始資料均附在 `frame-samples-results.json`，摘要見 `frame-samples-summary.json`，完整回歸 WebKit 原始取樣另保存在 `full-suite-webkit-interaction.json`。

這些資料未證明 124ms 是動畫造成或已消除；沒有同等負載的基準對照，不能宣稱正式站或實體 iPhone 保證 60fps。Chromium 短取樣未觀測到 Long Task；WebKit 不支援該 API，不能由空清單推論沒有長任務。視覺與功能驗收通過，正式裝置／網路效能仍須在發布授權後另驗。

### 三個失敗的根因與修復

通知的兩個引擎案例原先漏開「通知與手機主畫面」details。測試補上真實使用者的展開操作後通過，沒有改認證或通知程式。

WebKit 解析失敗已用受控對照確認：worker 啟用並控制頁面時，API route mock 命中 0 次，請求落到假服務環境的實際 API，回傳 503「Supabase 尚未設定」；相同瀏覽器在 `serviceWorkers: "block"` 時命中 1 次、回傳預期 200 fixture。Chromium 在兩種情況均正常。`public/sw.js` 只有推播事件，沒有 fetch handler；問題是 WebKit／Playwright 在 worker 控制下的請求攔截邊界，並非正式解析 API 的資料錯誤。

只在 `study-motion.spec.ts` 假資料測試關閉 Service Worker，既有 PWA worker 安裝與控制測試仍正常啟用且兩引擎通過。保留原本斷言，新增 12 段長解析、自然速度錄影及長文展開後觸發鈕 Y 位移小於 3px 的檢查。

錄影腳本首次誤找本頁沒有顯示的 AI 按鈕，已改成實際的陽明解析入口後定向與完整測試均通過。這是測試腳本修正，未變動產品行為。

### 可直接開啟的交付附件

自然錄影來自隔離 Playwright 瀏覽器的真實互動，使用虛構題目與假 API，正常時間播放，沒有暫停動畫、變速或以圖片合成。桌機為 1280×900／9.76 秒；手機為 390×844／10.005 秒。以 ffmpeg 將 VP8 WebM 轉成 H.264 MP4，保留尺寸與時間，方便直接播放。

| Library 附件 | library_file_id | 說明 |
| --- | --- | --- |
| anatomy-motion-desktop.mp4 | `libfile_b052f5abc1f08191941db4ec5b0aaead` | 桌機自然互動，769,409 bytes |
| anatomy-motion-mobile.mp4 | `libfile_271c30514618819199b0a282bcfb6a2a` | 手機自然互動，313,870 bytes |
| anatomy-motion-desktop-feedback.png | `libfile_5f8365d544188191846a9e74419305e8` | 桌機影片 8.1 秒的正誤回饋影格，Library version 1 |
| anatomy-motion-mobile-feedback.png | `libfile_ee7950ee415481918d6f4d29a785f441` | 手機影片 8.2 秒的正誤回饋影格 |

Library 回傳全部成功，兩段影片另外讀回核對持久化 metadata；`library-attachments.json` 保存確切 file ID、Library ID 與版本，原檔均已寫入回傳 xattr。沒有外部 connector 分享或公開發佈。本機副本、原始 WebM、逐秒影格總覽、媒體尺寸／長度／SHA-256 均在 `evidence/motion/`。

已實看桌機／手機的原尺寸回饋、長解析截圖與錄影影格序列；文字、正誤標示與操作控制可讀。瀏覽器開啟本機 `file://.../review-recordings.html` 被 URL 安全政策拒絕，因只允許 http/https；沒有重試、改協定繞過或變更安全設定，因此不宣稱透過該瀏覽器完整播放驗收。錄影本身已成功擷取、轉碼並交付 Library；本機影格檢視不需要被拒絕的瀏覽器操作。

### 工具補齊與資料保護

既有 `npm run lint` 缺設定與依賴，已補 ESLint 8.57.1、eslint-config-next 14.2.35 與 `.eslintrc.json`。藥理頁既有 `Today's` 改為 `Today&apos;s`，顯示不變。根層 runtime dependencies 未改；lint 依賴解析將 hasown 2.0.3 更新至 2.0.4，lockfile 已通過 clean npm ci。沒有動畫 runtime 依賴，也沒有 React 主版本升級。

沒有執行中的本次測試、伺服器或待處理批准。歷史目錄 status I/O 逾時與先前 ps 沙盒拒絕沒有被繞過，不影響本隔離目錄成果。

### 資料邊界

`data/`、`types/`、既有 `lib/`、API、Supabase schema/migrations、認證程式、判分與紀錄儲存程式均無差異。未接觸贊助返回頁、收款、題庫或新 AI 詳解的發布狀態。正式資料的 API 內容未替換；僅在隔離測試中提供虛構詳解。

## 使用方式

在上述路徑執行 `nvm use`，再執行 `npm run dev`，開啟 `http://localhost:3001`。不需要複製正式站憑證即可使用訪客本機題庫。

一般驗證：`npm run typecheck`、`npm run lint`、`npm run test:quiz-analysis`、`npm run test:site-shell`。site-shell 預設會先 build，使用 127.0.0.1:3004 與假服務；相同版本已建置完成時，可用 `SITE_SHELL_PREBUILT=1 npm run test:site-shell` 避免重複建置。新增動效案例可指定 `e2e/site-shell/study-motion.spec.ts`。

`evidence/motion/`、`test-results/` 與 Playwright 報告已加入忽略規則；本機證據仍保留在檔案系統。是否發布須另行授權。
