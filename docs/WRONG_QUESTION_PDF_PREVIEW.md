# 錯題 PDF Preview（2026-09-20）

範圍：獨立 Preview，未發布正式站。由 origin/main 3f835bf 建立；未帶入暫停中的陽明修改。

- `/wrong-question-pdf-preview` 使用現有考題與記憶體中的示範作答，不寫入作答紀錄。
- 結果頁、散題複習、模擬考複習提供共用匯出視窗。結果頁預設本次錯題；歷次範圍包含已載入的所有已完成作答。
- 科別、章節、臺灣作答日期篩選；曾答錯即列入，同題去重，答對低信心、未作答及未完成紀錄不列入。
- A4 直式黑白試卷；0/2/4/6 公分留白、原年度題號、附圖、頁碼。圖片未完成載入時阻止列印。以瀏覽器列印功能另存 PDF，不上傳作答內容。
- 使用既有分類；無細分類時顯示「未細分章節」。無題目內容或缺少日期時顯示未列入數量。

驗證：7 項篩選／序列化單元測試、型別檢查及本機建置通過。Chromium 桌面與 WebKit 360/390 寬度驗證篩選、日期、留白、視窗焦點；三處入口的虛構紀錄於匯出前後相同。6 題範例產出 3 頁 A4，逐頁檢視；6 公分版本為 4 頁。真實帳號完整雲端歷史、實機 Safari 列印尚未驗證；頁碼取決於瀏覽器對 CSS page counters 的支援。

單元測試：

```sh
node node_modules/typescript/bin/tsc --target ES2022 --module commonjs --moduleResolution node --resolveJsonModule --esModuleInterop --skipLibCheck --strict --outDir /private/tmp/wrong-question-pdf-tests lib/wrongQuestionPdf.ts lib/wrongQuestionPdf.test.ts
node --test /private/tmp/wrong-question-pdf-tests/lib/wrongQuestionPdf.test.js
```
