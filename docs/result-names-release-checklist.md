# 作答紀錄命名發布檢查

## 範圍
- 散題、搜尋私人練習、弱點練習與模考共用結果頁的「其他操作 → 作答紀錄名稱」。最多 80 字，清空後回到原本預設／舊模考名稱。
- 結果標題、結果頁歷史清單與信心圖輸出使用名稱；不改題目、答案、mode、settings、歷史回合或 completion receipt。
- 訪客名稱單獨保留在此瀏覽器，不自動併入登入帳號。登入名稱經伺服器驗證使用者和已完成紀錄歸屬後，寫獨立 metadata。
- 名稱為低風險標籤，兩裝置同時明確儲存時，最後成功寫入者生效。回到分頁時重新讀取。背景讀取不能蓋掉正在儲存的名稱或使用者正在輸入的文字。

## 上線前需核准
候選 migration：`supabase/migrations/20261119000100_add_quiz_session_names.sql`。
新增 `quiz_session_names` 表及索引，開啟 RLS、撤銷 anon/authenticated 存取，只由既有 service-role 伺服器路由讀寫。既有正式表不改欄位或內容；新表以外鍵連結已完成回合，刪除回合時其標籤隨之刪除。

未套用 migration 的 preview 仍可驗證訪客命名及失敗提示；不能宣稱登入名稱的真實跨裝置同步已完成。正式部署與套用 migration 皆待核准。

## 已做檢查
- `node --test scripts/session-names.test.cjs`：6/6，驗證 bearer 身分驗證、owner filtering、未完成紀錄拒絕、資料庫失敗不報成功、只寫 metadata、名稱限制及重設。
- 現有 storage.completed-history + resultReviewNavigation 測試：45/45。
- 新 SQL 在隔離 PGlite fixture 成功套用。正式 id 類型與主鍵只讀確認為 text primary key。
- 實際 React hook renderer 測試：訪客持久保存、帳號隔離、兩 renderer mocked 跨裝置、失敗保留原名、清空和 focus 重讀、穩定依賴（6 次讀取，無迴圈）。不等同真實 Supabase 跨裝置測試。
- `scripts/session-names.browser-test.cjs` 為 Chromium hook integration 測試；此環境 socket 限制使 Chromium 無法啟動，尚未通過。

## 核准後驗收
1. 在可用的預覽資料庫套用 migration，兩個不同測試帳號各建立完成回合。
2. A 命名散題、模考、搜尋／弱點練習；重整與另一裝置確認一致。舊模考名稱仍保留。
3. B 不能取得或改 A 的名稱；登出切換不顯示前帳號名稱。
4. 同一回合命名前後比對 question_order、attempts、settings、completion receipt 不變。
5. 測名稱空白、80 字、過長、網路失敗、雲端尚無該回合；不得錯誤顯示已同步。
6. 正式部署前由使用者確認候選版本與 migration。
