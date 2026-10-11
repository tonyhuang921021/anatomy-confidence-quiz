本次發布只整合已驗收原稿：636 題、1,087 張原圖及 36 題缺稿提示。新的 AI 教學稿、七題 AI 修復、模型與生成流程、社群原子修訂 migration、原 dirty checkout 的其他功能都不在本次範圍。

發布基底為遠端 main 15cb010e08f39f39fbba5ecd90984598dbba37f4。672 個來源題號（27 個既有別名）已對到現行題庫；636 題包含 555 replacement_ready、81 keep_existing。原始 PNG 的 SHA256 全不變，存入既有 public bucket yangming-explanations 的新路徑 reviewed-releases/ym-reviewed-20261011-3d79439e6190。沒有覆寫或刪除舊圖，沒有改正式 DB 版本、資料列或 schema。

36 題包括 20 個候選頁錯題、15 題在已查原稿段落缺題、1 題只有後年引用。原稿分頁顯示具體缺稿原因，不顯示已否決候選圖；現有 AI 分頁、人工筆記與有效人工整理圖獨立保留。結論限定已查原稿，不宣稱所有作者版本皆不存在。

legacy 與 active 兩層人工正文即時讀取、另列呈現；五筆正文 SHA256 與交接、正式唯讀核對皆相同。同步失敗才使用最近核對快照並標示；成功讀取尊重使用者刪空正文。原作者署名保留在未改原圖，可可靠對應同頁的現有姓名另列，顯示來源檔名與 PDF 頁碼。115-1醫學一實為長庚117級，不統一猜標陽明作者。補稿、內容調整、署名或撤除保留一般回報入口；原稿不允許直接改寫，舊客戶端對驗收圖發出的即時修訂也會被擋下，避免錯寫原 DB 行。

Q036 原稿答案欄 A、正文 D，考選部正式及更正答案均 D。只新增差異提示和官方連結，不改評分答案、原稿與原圖。

可重現檢查：Node20.20.2 用 --experimental-websocket 啟動現有 Supabase SDK；線上沿用既有 Vercel Node24。node --test scripts/yangming-reviewed-release.test.cjs 是純 mock、不連正式 DB；另執行 npm run typecheck、npm run build。UI 腳本支援 BASE_URL，普通回報只開啟、不送出。上傳腳本要求明確來源與既有 credential 目錄，--dry-run 不寫入，實際模式只寫新 prefix、upsert=false，每圖下載重算 SHA。builder 沿用既有驗收映射，不重做 OCR 或付費 AI。

回復：保留舊部署 dpl_2DQKYpgM3VTNai4fBhHkGkmExi7i（production READY，15cb010）。若發現問題，以既有 Vercel rollback 切回舊部署，再用正常提交撤回這次讀取／呈現改動；不要刪新增圖或人工紀錄。舊 Storage 路徑、active release ym-boundary-full-20260615 及 DB 行全未變，舊 reader 可直接恢復。若日後要清理圖片，需另取得明確刪除授權。

已完成 typecheck、production build、6 項 mock 資料／API 測試。局部 lint 零 error，三項既有 warning。Storage receipt、部署 READY、正式 commit、真實 API 及桌機／手機驗證將在本任務 release-proof 另存，push 成功不等於發布完成。
