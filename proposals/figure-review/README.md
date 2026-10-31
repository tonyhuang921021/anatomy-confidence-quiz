# 尚未上線的圖片審核方案

這是候選，不是 migration，不得對正式庫執行。先以專案 CLI 建立正式 migration，獨立安全審查及使用者批准後，才可考慮安裝。

方案新增 public.explanation_figure_candidates，一筆候選含圖片 bytes（每張上限 3 MiB）、內容與圖片 SHA256、來源授權、段落、待審／核准／拒絕狀態。RLS 啟用；只撤銷本表及三個相關函數上 PUBLIC/anon/authenticated 權限，授予 service_role 本表 select/insert/update 與相關 security invoker 函數 execute；不更改全域 schema 權限。既有 explanation 表需要 service_role 原有 select/update 才能鎖定原文，安裝前要核權限。既有 owner API 模式是 auth.getUser 後比對管理員 allowlist；候選服務目前只接受由伺服器核驗後的 actor，不可把 client actor 原樣傳入。

核准前必須由管理員實際看圖並核來源授權，且比較已存文字與圖片 hash；函數鎖定詳解列，原子比較待審狀態、原文、兩個 hash 及圖片 bytes。候選不改寫詳解，不允許瀏覽者取得待審圖。下述本機管理路由、adapter 和呈現候選已寫好；隔離與 mock 通過不能代替正式真實身份／權限驗證。

本機 SQL 在獨立 PostgreSQL 17.11 測試資料庫測得 RLS 開啟、匿名和 authenticated 不可讀寫/執行，service_role 可寫及執行；無圖面確認、舊文字、不同圖片與重複核准均拒絕，合法核准通過。另以兩個隔離連線驗證並行改文後審核等待並拒絕舊版。此測試不能替代 Supabase 真實角色、runtime 授權及回滾測試。容量上限需另由使用者批准；例如 3 張各 3 MiB 最多增加 13 MiB/題，索引及備份另計，不代表實際費率或用量。

人工核對樣本：Commons 的 Melanin Development in Melanocytes 圖面實見 UV、MC1R、TYR/黑色素體；來源頁標 CamrynKnights、CC BY 4.0。1901 Composition of Blood 圖面實見 plasma、buffy coat、紅血球分層；來源頁標 OpenStax College、CC BY 3.0。兩者是既有已審素材的重核，不是新搜尋管線成功的證據。

## 後續本機實作

本候選新增 service-role adapter、管理員 API/頁面及已核圖讀取 API/原位顯示；管理員 API 用既有 auth.getUser 加 allowlist 驗證，頁面要求看圖與確認，圖片讀取函數每次比較已存詳解與圖片 SHA。基礎 SQL 草案為一表、三個 security-invoker 函數；只供隔離環境測試，未正式安裝。自動搜尋預設關閉；本機必須明確開啟旗標且目標為 loopback，正式候選須同時開啟下述獨立旗標。未批准不得修改正式環境旗標或權限。

瀏覽器 mock：管理員待審預覽、來源、勾選確認及核准，在390/1280均通過；一般讀者頁模擬已核圖顯示與原位展縮、待審不顯示，在兩尺寸通過。隔離 PostgreSQL 17.11 已測待審不列出/不提供圖片，核准後可讀，原文修改後不再顯示，以及匿名角色不得執行讀取函數。所有資料為測試資料，不是真 JWT/PostgREST 或正式 DB 端到端驗收。

## 持久工作候選（僅隔離）

`durable-queue-proposal.sql` 另新增二表 `figure_queue_config`、`figure_queue_jobs`，一個候選圖片容量觸發器及八個受限函數：`figure_guard_reserve`、`figure_guard_commit`、`figure_guard_cancel_if_cached`、`figure_guard_close`、`figure_queue_claim`、`figure_queue_finish`、`figure_queue_stage`、`figure_queue_prune`。計費 guard 的原函數不修改；wrapper 在同一交易中先預留容量、保存新詳解並把保留槽轉為待處理。容量滿在呼叫模型前拒絕並回滾原預算預留；命中既有詳解不排入。`capture_new` 與工作者 `enabled` 分開，暫停工作者但仍擷取時，新工作不遺失。變更擷取狀態前須排空舊版在途 writer，以免缺少預留槽導致提交回滾。

工作者每次領取具期限／獨立 token 的租約，最多三次；失敗或程序終止後不重新生成文字，過期租約可恢復；舊租約不能寫入圖片。資料庫以鎖序和上限限制每版本至多三張待審／已核圖及全表圖片 bytes。管理員拒絕圖片時，同交易清除該縮圖 bytes，保留來源、授權、原圖 hash 及審核紀錄；已核圖、待審圖和詳解不刪。工作槽滿時，新預留可回收最舊的 done／cancelled／failed 紀錄，並持久累加各狀態計數；這會失去該終態工作逐筆明細，須納入正式批准。reserved／pending／leased 不回收；若全為在途工作則在模型派發前拒絕。30 天以上 done/cancelled 亦可由操作員有界清除。未知模型請求的原預算與佇列保留槽不自動釋放。保留槽如因程式中斷未安全關閉，需依既有 guard 對帳後處理，不能逕自猜測釋放。示例設定值不是正式授權額度。

本機 `LOCAL_FIGURE_DURABLE_QUEUE=1` 僅在 development 與 loopback URL 啟用 wrapper；`scripts/local-figure-worker.cjs` 只允許相同本機環境，一次處理一件，`--watch` 可限次輪詢並在暫時錯誤後續跑。進程意外終止後，租約到期會保留工作，重新啟動 worker 才恢復；不承諾自動重啟。候選另接現有每五分鐘統計 cron：驗過既有 CRON_SECRET 與 recovery 後，僅在 `FIGURE_REVIEW_ENABLED=1` 且 `FIGURE_REVIEW_WORKER_ENABLED=1` 時以 `waitUntil` 處理最多一件；工作超時後由後續 cron 回收租約，錯誤不改既有統計回應。正式詳解 route 只有 `FIGURE_REVIEW_ENABLED=1` 且 `FIGURE_REVIEW_QUEUE_CAPTURE=1` 時切換兩個 guard wrapper；預設全關閉。正式仍需確認現有 cron 配置、額外運算／流量、環境旗標和資料庫權限並完成真實 JWT/PostgREST 驗收，不能將候選視為已上線。關閉資料庫 `capture_new` 時新文不建立圖工作；只暫停資料庫 `enabled` 則新文仍安全入列。

隔離 PG17 實測了真實 guard 預留／啟動／結算／提交／關閉、容量滿回滾、未知請求仍持有、同交易回滾、兩個 worker 並行不重複、程序死亡及租約恢復、第三次逾期終止、過期 token 拒絕圖片寫入、圖片總量競態、暫停期間仍保存工作、終態回收及並行槽位保護、拒絕圖片釋放 bytes 並保留來源雜湊，以及未授權角色拒絕。實際新搜尋的 `File:Hip flexor strain.svg` 經圖面與 Commons 授權頁人工核查，僅對應本機合成的髖屈肌群與拉傷說明；InjuryMap，CC BY-SA 4.0。搜尋→保存待審→人工核准→讀取 bytes→390/1280 真 React 元件顯示、原位展縮均在隔離環境完成；零模型呼叫。這不代表任意自動取得圖片已被人工核准。

正式提案涉及合併基本圖像 SQL 與佇列 SQL、新增三表（候選／工作／設定）、十一個一般函數及一個觸發函數、觸發器、僅指定角色的最小表及函數權限；不修改全域 PUBLIC schema 權限。另須核對 `service_role` 的原詳解讀取與列鎖權限、原 guard 介面與鎖順序、容量和排程費用、失敗復原與 rollback。所有這些仍待具體批准，未在正式資料庫執行。

公開搜尋的新候選 Flexion illustration 01.png 經視讀是肘關節屈曲而非髖關節；來源 Sheldahl CC BY-SA 4.0，雖授權可核對但不適合本題，故不核准。圖片下載操作被中止，未重試。Commons API 在本機 DNS ENOTFOUND，瀏覽工具也無法取 API，因此真正新搜尋→暫存→核圖→呈現的完整鏈尚未完成，不得說已通。
