# 錯題 PDF Preview（2026-09-20）

範圍：獨立 Preview，未發布正式站。由 origin/main 3f835bf 建立；未帶入暫停中的陽明修改。

- `/wrong-question-pdf-preview` 使用現有考題與記憶體中的示範作答，不寫入作答紀錄。
- 結果頁、散題複習、模擬考複習提供共用匯出視窗。結果頁固定本次錯題；錯題頁固定歷次錯題，包含已載入的所有已完成作答。
- 科別、章節、臺灣作答日期篩選；曾答錯即列入，同題去重，答對低信心、未作答及未完成紀錄不列入。
- A4 直式黑白試卷；0/2/4/6 公分留白、原年度題號、附圖、頁碼。圖片未完成載入時阻止列印。以瀏覽器列印功能另存 PDF，不上傳作答內容。
- 使用既有分類；無細分類時顯示「未細分章節」。無題目內容或缺少日期時顯示未列入數量。

驗證：7 項篩選／序列化單元測試、型別檢查及本機建置通過。Chromium 桌面與 WebKit 360/390 寬度驗證篩選、日期、留白、視窗焦點；三處入口的虛構紀錄於匯出前後相同。6 題範例產出 3 頁 A4，逐頁檢視；6 公分版本為 4 頁。真實帳號完整雲端歷史、實機 Safari 列印尚未驗證；頁碼取決於瀏覽器對 CSS page counters 的支援。

單元測試：

```sh
node node_modules/typescript/bin/tsc --target ES2022 --module commonjs --moduleResolution node --resolveJsonModule --esModuleInterop --skipLibCheck --strict --outDir /private/tmp/wrong-question-pdf-tests lib/wrongQuestionPdf.ts lib/wrongQuestionPdf.test.ts
node --test /private/tmp/wrong-question-pdf-tests/lib/wrongQuestionPdf.test.js
```

## 入口情境預覽

`/wrong-question-pdf-preview/integration?view=results` 與 `?view=review` 展示真正結果頁／錯題頁的桌面及手機截圖。截圖中的匯出按鈕可操作，開啟同一個匯出元件；其他畫面是示範截圖。結果頁固定本次 6 題，錯題頁固定歷次 10 題並顯示日期篩選。共用 fixture 的本次作答為 10 題、4 對、6 錯。

`demoSessions` 直接使用記憶體中的示範紀錄，不讀取匯出元件的個人歷史或訂閱歷史更新。已用另一份既有紀錄確認不混入匯出、操作前後儲存內容相同；桌面 Chromium／390px WebKit 的按鈕定位、預設範圍、日期篩選、關閉返回焦點及分頁鍵盤操作通過。正式頁面的按鈕位置與原有資料流程未再變更。

## 科序與入口範圍修正

共用網站既有醫學一／醫學二科序。同科依年度、次數由新到舊，同卷按原題號遞增；章節保留標示，不再優先於題號。缺題號置於同卷最後。科序 constants 抽至 `data/subjectOrder.ts`，既有 registry 維持原本 export。

結果頁與錯題頁移除匯出範圍切換。結果頁僅使用本次 session，匯出視窗不再讀取歷次紀錄；錯題頁保留科別、章節、日期及留白設定。獨立預覽固定本次，可由入口情境預覽查看歷次設定。

本次驗證：12 項單元測試及型別檢查通過；115-2 醫學二 100 題完整核對預設科序與各科原題號。Chromium 1280／WebKit 360 驗證三處正式頁面入口的固定範圍、日期欄位、題數、關閉焦點與作答紀錄未變；情境 Preview 兩入口的預覽／列印稿排序一致。
