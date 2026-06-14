# Codex Current Work

這份檔案是長任務交接單。每次上下文被精簡、重新開工、或任務跨天延續時，先讀這裡，再看程式碼與輸出，不要只靠聊天紀錄重建狀態。

## 工作規則

- 開始長任務前，先讀本檔、看 `git status`，再決定下一步。
- 每完成一個可驗證階段，更新本檔。
- 準備精簡上下文、交接、或可能中斷前，也要先更新本檔。
- 精簡上下文後，第一步固定是重讀本檔，第二步看 `git status` 與相關輸出檔，第三步用一句話確認「現在要做什麼」，再開始執行。
- 如果發現功能已經存在，先查為什麼既有路徑沒有生效，不要直接重做。
- 不要把使用者最新一句抱怨當成完整目標；要用本檔確認目前真正進度。

## 目前長任務

### 陽明詳解

2026-06-15 目前執行狀態：

- 使用者最新指令是「線上直接讀新資料」，並要求可以不要覆蓋舊資料、方便切回。
- 已把新包實際上傳到 Supabase 版本化資料，不覆蓋 legacy：
  - version id：`ym-boundary-full-20260615`
  - DB rows：`5900`
  - Storage assets：`12337`
  - release 狀態：`active`
- 正式站第一次 API 抽查曾回 `陽明詳解版本讀取逾時`，原因在 route 每次先查 `yangming_explanation_releases` 且 timeout 只有 800ms。
- 已修 `app/api/yangming-explanation/route.ts`：active release 查詢改 2500ms、加入 5 分鐘記憶體快取，且版本查詢短暫失敗時不讓整個 API degraded。此修正已通過 `npm run typecheck` 與 `npm run build`，下一步是提交推上線再抽查正式 API 是否回傳 `versions/ym-boundary-full-20260615/...` 的 storagePath。
- 本機 build 驗證時 `.next` 快取再次缺頁面檔，已把舊快取改名為 `.next-stale-20260615-active-release-route` 後重建成功；仍不是功能碼錯誤。
- 已完成 `npm run typecheck`。
- 已完成乾淨 `npm run build`。先前 `.next` 快取缺 `app/api/openai-budget/route.js`，已把舊快取改名為 `.next-stale-20260615-yangming-upload` 後重建成功；不是程式碼錯誤。
- 已完成 dry-run 匯入：
  - rows：`5900`
  - assets：`12337`
  - asset kind：全部 `question_snapshot`
  - storage prefix：`versions/ym-boundary-full-20260615`
  - `YANGMING_SCREENSHOT_ONLY=1` 生效，不會上傳 OCR body 或舊文字 sections。
- 下一步固定是：提交版本化程式碼 -> 套用 schema -> 實際上傳到 Supabase 新版本 -> activate `ym-boundary-full-20260615` -> 用正式站 API 抽查。不要再回去重切題目。

2026-06-15 版本化上傳 checkpoint：

- 目前任務改成「把現有安全包上傳成新版本，線上直接讀新資料，但不覆蓋舊資料」。不要在這個任務中重切、補缺口、重跑 parser。
- 舊 `/private/tmp/ym_safe_v23_full/yangming_safe_rows.json` 不可再當唯一來源；目前要上傳的可用包是專案內檔案：
  - rows：`reports/yangming_import_preview/visual_boundary_full/yangming_visual_consolidated_rows.json`
  - asset root：`reports/yangming_import_preview/visual_boundary_full`
  - dry-run 已知：`5900` rows，`12337` 個 `question_snapshot` assets。
- 版本 id：`ym-boundary-full-20260615`。
- 上傳目標：Supabase Storage prefix `versions/ym-boundary-full-20260615/...` 與 DB table `yangming_question_explanations_versioned`。
- 匯入時必須使用 `YANGMING_ASSET_KIND_FILTER=question_snapshot` 與 `YANGMING_SCREENSHOT_ONLY=1`，避免 OCR body、舊表格文字、文字版 sections 上線。
- Legacy table `yangming_question_explanations` 保留不動。若新包不理想，回復舊版只要執行：`node scripts/set_yangming_explanation_version.js legacy`。
- 啟用新版：`node scripts/set_yangming_explanation_version.js activate ym-boundary-full-20260615`。
- 此 checkpoint 完成後的下一步是：build -> dry-run import -> 套用 schema -> versioned upload -> activate -> 正式站 API 抽查，不是再回頭切圖。

2026-06-15 暫停點：

- 使用者要求「先存檔停掉」，因此目前不要再繼續裁切、重跑 parser、找剩餘缺口或上傳。
- 本輪在讀取 checkpoint 後，尚未完成「把現有 v23 包上傳並確認正式站」；也沒有改 DB、Storage 或正式站資料。
- 下次若使用者要求恢復，第一步仍是先讀本檔與 `YANGMING_MANUAL_RESCUE.md`，再確認最新安全輸出包是否仍存在。不要直接重切。
- 最新可信全量安全輸出仍以本檔記錄的 v23 為準：
  - `/private/tmp/ym_safe_v23_full/yangming_safe_rows.json`
  - 5942 / 6000 題有安全截圖
  - 58 題缺口
  - text-only 0
  - question-number mismatch 0
  - empty shell row 0
- 暫停前正在轉向的任務是「停止長尾救援，先把現有已驗證包打包上傳並確認線上可讀」。此任務尚未完成。

目標：以題目對應的完整詳解截圖為主，避免 OCR 文字、錯配、漏字、表格破碎與圖片未載入造成的錯誤。

已知原則：

- 詳解內容應依題號對應，不可把無關題目當作本題詳解。
- 但原作者放在本題詳解中的相關題、補充題、比較題，不可誤刪。
- 需要先分清問題層：資料缺、asset 缺、API 過濾、storage 圖片不存在、前端顯示失敗。
- 不要只因為單題回報就整包盲目覆蓋；先用本機審計與抽樣確認規則。

下一步：

- 繼續檢查線上 API 回傳的 asset 與本機乾淨資料是否一致。
- 對缺口卷做覆蓋率審計，再針對最大缺口修切圖/對題規則。
- 修完後再推上線，並抽樣確認「不漏前段、不中斷跨頁、不誤吃封面、不誤刪相關題」。

2026-06-14 01:09 CST 進度：

- 已修 `scripts/filter_yangming_safe_snapshots.py` 的陽明表格表頭偵測：同一列被 PDF 拆碎時，會把同水平帶的 `題號 / 題號數字 / 科目 / 撰寫或校稿` 合併判斷，不再只從 `題號` 往後看，避免保留上一題尾巴。
- 已補空白裁切圖過濾：沒有可抽文字且高度很小的尾段、以及幾乎空白的 pixmap 不輸出，避免白片或只有一條表格線的碎圖上線。
- Target 驗證批次：`109-2醫學(二).pdf`、`110-1醫學(一).pdf`、`2-1_醫學二總檔.pdf` 重跑到 `/private/tmp/ym_safe_v14_target5/yangming_safe_rows.json`，296 rows 中 295 rows 有圖，保留 687 張，body 皆應為空。
- 抽查 `MOEX-110020-1301-Q034`：第一張已從本題 `題號 34` 表頭開始，前面上一題尾巴消失；空白第 4 張已移除。
- `MOEX-110020-1301-Q050` 仍無圖，原因不是 filter 誤刪，而是 preview 上游給的 `source_page_regions` 只有 page 32 的小區域，且 page 32 實際是題號 16。這屬於對題/邊界上游錯配，不能用 fallback 硬補。
- 接下來要跑 v14 全量 preview/safe/audit，確認這個規則在 6000 題全域覆蓋率；若缺口集中在特定卷，再修 preview 對題/切區規則。

2026-06-14 進度補充：

- 已修 `scripts/preview_yangming_explanations.py` 的 consolidated row 排序：優先選高 stem/question match、非 TOC/OCR、非 fallback 的候選，避免內容長或圖片多的錯誤 row 蓋掉正確 row。例：`MOEX-101110-1101-Q010` 從 TOC row 改回正確第 10 題 row。
- 已修 `scripts/filter_yangming_safe_snapshots.py` 舊版書籤詳解表頭偵測：舊格式使用 `類別 / 負責人`，不是新版 `科目 / 撰寫 / 校稿`。現在 `find_yangming_row_header_top` 與 current evidence 都支援這兩套格式。
- Target 驗證批次 `/private/tmp/ym_preview_v16_target` + `/private/tmp/ym_safe_v17_target/yangming_safe_rows.json`：1424 rows 中 1419 rows 有圖，2273 張圖全保留；安全拒絕只剩 4 筆 `question_number_mismatch`，`wrong_question_number_in_snapshot` 與 `current_question_starts_late` 都歸零。
- 抽圖確認 `MOEX-101110-1101-Q024`、`MOEX-101110-1101-Q034`、`MOEX-101110-2101-Q005` 已從本題表頭開始，不再吃到上一題尾巴。
- 下一步：用目前規則跑全量 preview/safe/audit，檢查缺口集中在哪些卷，再處理真正的 mismatch/缺圖，不可用錯題或整頁 fallback 硬補。

2026-06-14 進度補充 2：

- 已跑全量 preview v17：`/private/tmp/ym_preview_v17_full/yangming_consolidated_rows.json`，46 份 PDF，抽出 7890 rows，matched 7609，consolidated rows 5817，safe missing 258，uncovered 183。
- 已跑全量 safe filter v17：`/private/tmp/ym_safe_v17_full/yangming_safe_rows.json`，5817 rows 中 5788 rows 有圖，保留 10800 張裁切圖。
- v17 full safe 拒絕原因：`question_number_mismatch` 24、`current_question_starts_late` 23、`wrong_question_number_in_snapshot` 37。這些不應直接放寬，下一步要依來源卷分布修偵測規則。
- 目前重點：跑 coverage audit，找出非 115 卷缺口最大處；另外用同學回報題號對照 v17 full，判斷是「row 缺」、「safe 拒絕」、「圖片路徑未上傳」還是「前端/API 過濾」。

2026-06-14 進度補充 3：

- 已跑 v17 coverage audit：target 6000 題，safe rows 5817，missing_row 270，has_safe_snapshot 5703，question_number_mismatch 23，empty_after_filter 4。
- 最大缺口集中在特定卷，不是全域隨機失敗：
  - `112100-2301`：100 題中 missing_row 70，safe 28，qno_mismatch 2，gap 72。
  - `104090-5301`：missing_row 40，safe 60，gap 40。
  - `104090-6301`：missing_row 34，safe 65，qno_mismatch 1，gap 35。
  - 其後依序是 `107100-1301`、`106020-5301`、`100140-1101`、`106020-6301`、`101030-1101`、`105100-5301`、`108030-1301`。
- v17 safe audit 仍有 84 張被拒絕：`wrong_question_number_in_snapshot` 37、`question_number_mismatch` 24、`current_question_starts_late` 23。來源集中於 106/107/108、105-2、少數書籤/特殊格式，下一步要依卷格式修規則，不可直接放寬。
- 同學回報題號在 v17 full 中的狀態：
  - 多數已找到 safe assets：`MOEX-100030-2101-Q060`、`MOEX-110101-2301-Q054`、`MOEX-101110-2101-Q040`、`MOEX-102030-2101-Q036`、`MOEX-108030-2301-Q002`、`MOEX-103100-1101-Q016`、`MOEX-101110-1101-Q010`、`MOEX-110101-1301-Q020`。
  - 仍可疑：`MOEX-100140-2101-Q064`、`MOEX-100140-2101-Q066`、`MOEX-100140-1101-Q067` 被 consolidated 到 `:: TOC` 低分候選（match_score 約 0.036、0.088、0.118），需要檢查 `yangming_preview_rows.json` 全候選與 row_rank，不可上線錯配。
- 下一步固定：先查 TOC 低分候選為什麼被選，再查最大缺口卷 `112100-2301`、`104090-5301/6301` 的來源格式；修 preview/切圖規則後重跑 target/full，不要只處理單題。

2026-06-14 進度補充 4：

- 已修 `scripts/preview_yangming_explanations.py`：
  - `112-2醫學二.pdf` 加入固定 metadata `112 年第 2 次 醫學（二）`。原因：此 PDF 早期頁面後印刷頁腳會錯寫成 `110 年第二次醫師考試 | 醫師(一)`，若照頁腳判斷會把大量 112-2 醫學二裁切排除。
  - 書籤 TOC 低分候選不再綁到題目：若 `parse_bookmark_toc_rows` 的 `match_score < 0.5`，改標成 `missing_question / bookmark_toc_low_score_rejected`。這會讓 `MOEX-100140-2101-Q064`、`MOEX-100140-2101-Q066` 這類低分 TOC 錯配變成缺圖待補，而不是錯圖上線。
- Target 驗證批次：`112-2醫學二.pdf` + `醫師國考詳解096-100(書籤版).pdf` 跑到 `/private/tmp/ym_preview_v18_target` 與 `/private/tmp/ym_safe_v18_target/yangming_safe_rows.json`。
  - preview：2 份 PDF，890 rows，matched 876，missing question 10，consolidated rows 493。
  - safe filter：493 rows，491 rows 有圖，保留 841 張，只有 2 筆 `question_number_mismatch`。
  - `112100-2301` 從 v17 的 safe 28 題大幅補到 target 批次 matched_question_count 98；目前主要問題不再是整卷解析失敗。
- Target 抽查：
  - `MOEX-112100-2301-Q029`、`Q034`、`Q100` 都有安全裁切圖。
  - `MOEX-112100-2301-Q036` 有 safe asset，但 match score 低，原因是 PDF 題幹抽取漏掉前半段；需視為「低信心但有圖」，不可直接當缺圖。
  - `MOEX-112100-2301-Q075` 在 `112-2醫學二.pdf` 中目前完全找不到題幹文字，搜尋 `鐵（iron）中毒`、`deferoxamine`、`去鐵`、`鐵中毒`、`iron` 都未命中；下一步要看 Q74/Q76 附近頁面影像確認是 PDF 缺題、題幹不可抽取，還是邊界規則漏切。
- `MOEX-100140-1101-Q067` 仍是 `question_number_mismatch`，score 0，safe assets 0；不要用錯配圖硬補，需回到來源頁找正確 crop。
- 下一步固定：先視覺檢查 `112100-2301-Q075` 在 Q74/Q76 之間是否存在，再跑 `104-2醫學(一).pdf`、`104-2醫學(二).pdf` target 批次處理下一個最大缺口。完成 target 後才重跑全量，不要直接推。

2026-06-14 進度補充 5：

- 已修 `scripts/preview_yangming_explanations.py` 的 consolidated ranking：若同題同時有 OCR row 與 visual crop row，優先保留有 `source_page_regions/assets` 的 visual row，不再讓 match score 1.0 但沒有圖的 OCR row 蓋掉可切圖 row。
- 已修 OCR fallback 的定位邏輯：`parse_ocr_pdf` 目前只把 OCR 當作「找題號邊界」的輔助，會用 `ocr_guided_region_patch` 補出原 PDF 的 `source_page_regions`；輸出給網站的 `body` 與 `sections` 清空，避免又把 OCR 文字、破表格或漏字當成正式詳解。
- Target 驗證批次：`104-2醫學(一).pdf`、`104-2醫學(二).pdf` 跑到 `/private/tmp/ym_preview_v20_104` 與 `/private/tmp/ym_safe_v20_104/yangming_safe_rows.json`。
  - preview：2 份 PDF，321 rows，matched 274，consolidated rows 196，safe missing 6，uncovered 4。
  - safe filter：196 rows 中 196 rows 有圖，保留 403 張圖，沒有 rejected assets。
  - 依題庫審計：`104090-5301` 98 題有圖，缺 Q55、Q69；`104090-6301` 98 題有圖，缺 Q54、Q68。
- 這代表 v17 的 `104090-5301 gap 40`、`104090-6301 gap 35` 已在 target level 大幅修好；下一步不是重修 104，而是查這 4 題是否在單檔缺失、書籤總檔可補，或題庫/檔案題序不同。
- 下一步固定：先找 `104090-5301` Q55/Q69、`104090-6301` Q54/Q68 的題幹，搜尋 `104-2醫學(一).pdf`、`104-2醫學(二).pdf`、`醫師國考詳解101-104(書籤版).pdf`，確認是來源缺題還是規則漏切；若書籤版可補，再跑 104+書籤 target，不可直接用整頁 fallback。

2026-06-14 進度補充 6：

- 已修 `scripts/preview_yangming_explanations.py` 的 `recover_missing_rows_by_stem`：若題幹 stem 因 PDF 文字亂碼找不到，會退一步使用同卷 `find_table_starts` 偵測到的「題號表頭」作為 start boundary；下一題邊界也同樣可用題號表頭補上。這不是整頁 fallback，後續仍由 safe filter 驗證裁切圖是否屬於本題。
- Target 診斷確認：
  - 修前 `104-2醫學(一).pdf` raw/recovered 都是 61 rows，Q55/Q68/Q69 找不到；修後 recovered 100 rows，Q55、Q68、Q69 都用 `stem_region_recovery` 補出。
  - 修前 `104-2醫學(二).pdf` raw/recovered 都是 66 rows，Q54/Q68 找不到；修後 recovered 101 rows，Q54、Q68 都補出。
- Target 驗證批次：`104-2醫學(一).pdf`、`104-2醫學(二).pdf` 跑到 `/private/tmp/ym_preview_v21_104` 與 `/private/tmp/ym_safe_v21_104/yangming_safe_rows.json`。
  - preview：2 份 PDF，395 rows，matched 348，low confidence 47，missing question 0，consolidated rows 200，safe missing 2，uncovered 0。
  - safe filter：200 rows 中 200 rows 有圖，保留 410 張圖，沒有 rejected assets。
- v21 coverage 對 104 醫學一仍顯示 2 個缺口，但初步判斷是題庫 canonical ID 不一致，不是裁切缺圖：coverage target 期待 `missing-2015-2-104090-5301-q025` 與 `moex-med1-supplement-v5-104090-5301-070`，而 safe rows 可能使用 MOEX 格式 ID。下一步要先釐清 Q25/Q70 的 `question_id` 對應，避免匯入後線上用 canonical id 查不到。
- 下一步固定：查 v21 104 safe rows 裡 Q25/Q70 的實際 `question_id`，對照題庫 canonical id；若只是 ID mapping 問題，修 preview/matching 讓裁切 row 使用題庫現有 id。之後再重跑全量 v21 audit，接續最大缺口卷，不要把 104 target 當結案。

2026-06-14 進度補充 7：

- 已修 `scripts/preview_yangming_explanations.py` 的題庫 ID 對照：`data/sources/question_bank_audit_detailed.csv` 只保留作為年份/卷別 metadata 來源，每題實際 `question_id` 與題幹會再用網站目前的 `canonicalQuestionBank` 覆蓋。原因：104 醫學一 Q25/Q70 在舊 audit CSV 是 MOEX id，但網站題庫實際 id 是 `missing-2015-2-104090-5301-q025` 與 `moex-med1-supplement-v5-104090-5301-070`，若不覆蓋，上線後會變成「本機有圖、網站查不到」。
- 已重跑 target 驗證批次 `/private/tmp/ym_preview_v22_104` 與 `/private/tmp/ym_safe_v22_104/yangming_safe_rows.json`：
  - preview：2 份 PDF，395 rows，matched 348，missing question 0，consolidated rows 200。
  - safe filter：200 rows 中 200 rows 有圖，保留 410 張圖，沒有 rejected assets。
  - coverage：`104090-5301` 與 `104090-6301` 都是 gap 0、safe 100、missing 0、mismatch 0。
- 抽查確認：
  - `104090-5301` Q25 現在輸出 `question_id = missing-2015-2-104090-5301-q025`，2 張圖。
  - `104090-5301` Q70 現在輸出 `question_id = moex-med1-supplement-v5-104090-5301-070`，1 張圖。
- 下一步固定：用 v22 規則跑全量 preview/safe/audit，重新量化非 115 卷缺口；不要再回頭重修 104，除非全量結果顯示 104 又退步。

2026-06-14 進度補充 8：

- 已跑全量 v22：
  - preview：`/private/tmp/ym_preview_v22_full/yangming_consolidated_rows.json`，46 份 PDF，8417 extracted rows，7854 matched，172 low confidence，391 missing question，5963 consolidated rows，safe missing 53，uncovered 37。
  - safe filter：`/private/tmp/ym_safe_v22_full/yangming_safe_rows.json`，5963 rows，5948 rows with assets，保留 11836 張裁切圖；拒絕 206 張候選，其中 `wrong_question_number_in_snapshot` 172、`current_question_starts_late` 23、`question_number_mismatch` 11。
  - coverage：target 6000，missing_row 37，has_safe_snapshot 5948，text_only 0，low_confidence_empty 0，question_number_mismatch 11，empty_after_filter 4，orphan import rows 0。
- v22 相較 v17 已大幅改善：v17 是 5703 題有 safe screenshot、missing_row 270；v22 是 5948 題有 safe screenshot、missing_row 37。
- v22 最大缺口已縮成小洞：
  - `102110-1101` gap 7。
  - `100140-2101` gap 5。
  - `102030-2101` gap 5。
  - `106020-5301`、`106020-6301`、`108100-1301` gap 4。
  - `100140-1101`、`107020-6301` gap 3。
- 同學回報題號在 v22 狀態：
  - 已有 safe assets：`MOEX-100030-2101-Q060`、`MOEX-101110-2101-Q040`、`MOEX-102030-2101-Q036`、`MOEX-108030-2301-Q002`、`MOEX-103100-1101-Q016`、`MOEX-101110-1101-Q010`、`MOEX-110101-1301-Q020`。
  - `MOEX-110101-2301-Q054` 是查詢別名問題：題庫 canonical id 為 `MOEX-110101_2301-Q054`，v22 row 已有 2 張圖，來源 `110-2醫學(二).pdf`。
  - 仍需修：`MOEX-100140-2101-Q064`、`MOEX-100140-2101-Q066` 目前 missing row；`MOEX-100140-1101-Q067` 目前 question_number_mismatch。
- 下一步固定：先處理最大缺口與回報交集：`100140-2101`、`100140-1101`、`102110-1101`。不要回退到 OCR 文字或完整原頁 fallback；要找出 per-question crop 為何缺或為何被安全濾掉。

2026-06-14 進度補充 9：

- 已對 v22 剩餘缺口做第一輪分類，重點不是全量重跑，而是找出「缺圖/錯配」是哪一層：
  - `100140-2101`：Q40 missing_row、Q41 question_number_mismatch（extract q 2, matched q 41）、Q42 missing_row、Q64 missing_row、Q66 missing_row。
  - `100140-1101`：Q65 missing_row、Q66 missing_row、Q67 question_number_mismatch（extract q 1, matched q 67）。
  - `102110-1101`：Q79 mismatch extract 80、Q80 mismatch extract 1、Q84/Q85/Q98/Q99/Q100 missing_row。
  - `102030-2101`：Q31-Q35 all missing_row。
  - `106020-5301`：Q37 mismatch extract 38、Q39 missing、Q40 mismatch extract 33、Q70 empty_after_filter。
  - `106020-6301`：Q37 missing、Q38 mismatch extract 39、Q40 mismatch extract 4、Q77 missing。
  - `108100-1301`：Q33 missing、Q38 mismatch extract 47、Q48 missing、Q75 missing。
- 初步檢查 `100140` 顯示：舊 `醫師國考詳解096-100(書籤版).pdf` 的 TOC/書籤來源可能有卷別或題幹對應混淆。低分 TOC rows 已不應上線；下一步要確認是來源 PDF 缺題、paper_questions 選錯，或 `parse_bookmark_toc_rows`/section metadata 混到醫學一與醫學二。
- `100140-1101` Q67 有非 TOC direct row，但 stem 是 `The diagnosis of tetanus...`，明顯不像該題；safe filter 擋掉是合理的，不可放寬。要回來源找正確 crop。
- 下一步固定：查 canonical question stems（100140/102110 等）與 preview/safe row 對應，再檢查 `parse_bookmark_toc_rows` 與 caller 如何傳入 `paper_questions`。若修規則，先跑 target，不直接全量或推上線。

2026-06-14 進度補充 10：

- 已修 `scripts/filter_yangming_safe_snapshots.py`：如果 row 因 `question_number_mismatch` 被安全檢查拒絕，或最後沒有任何 `kept_assets`，就只寫入 audit，不再輸出到 import JSON。目的：避免線上出現「此題有陽明詳解但內容空白/圖片讀不到」的假陽明 row，也避免空殼 row 覆蓋原本正確資料。
- Target 驗證舊書籤檔：`醫師國考詳解096-100(書籤版).pdf` 跑到 `/private/tmp/ym_preview_v23_096100` 與 `/private/tmp/ym_safe_v23_096100b/yangming_safe_rows.json`。
  - preview：1 份 PDF，789 extracted rows，774 matched，393 consolidated rows。
  - safe filter 修後：391 rows，391 rows with assets，保留 585 張圖；先前會輸出的 2 筆空殼 mismatch row 已被移除。
  - 抽查：`MOEX-100140-2101-Q064`、`MOEX-100140-2101-Q065`、`MOEX-100140-2101-Q066`、`MOEX-100140-1101-Q065`、`MOEX-100140-1101-Q066`、`MOEX-100140-1101-Q067` 在這批安全輸出中都不再有假 row。這些題仍要回來源找正確 crop，不能用錯配或空白資料硬補。
- 已重測 `load_runtime_canonical_question_slots()`：目前可在約 1 秒載入 6200 筆 canonical 題號。先前 preview warning 的 45 秒 timeout 應是當時全量/I/O 壓力造成的暫時現象；若後續全量又出現 timeout，再提高 timeout 或改成快取。
- 下一步固定：接著處理最大缺口卷與回報交集，不要再用完整原頁 fallback 或 OCR 文字。優先找 `102110-1101`、`102030-2101`、`106020-5301/6301`、`108100-1301` 缺口；每個 target 修完先跑 safe/audit，再決定是否全量重跑。

2026-06-14 進度補充 11：

- 已修 `scripts/preview_yangming_explanations.py`：`page.find_tables()` 改成 `find_tables_with_timeout()`，預設每頁表格偵測最多 2 秒，避免 PyMuPDF 在少數頁面的 table detection/color counting 卡死整個全量 preview。
- 已修 `scripts/filter_yangming_safe_snapshots.py`：`pixmap_has_visible_content()` 改為最多抽樣 4096 像素並提早返回，避免全量重裁圖時逐像素檢查成為主要瓶頸。
- 已完成 v23 全量 preview：`/private/tmp/ym_preview_v23_full/yangming_consolidated_rows.json`。
  - 結果：46 PDFs，8424 extracted rows，7848 matched，173 low confidence，403 missing question，5958 consolidated rows，safe missing 59，uncovered 42。
- 已完成 v23 screenshot-first safe filter：`/private/tmp/ym_safe_v23_full/yangming_safe_rows.json`。
  - 結果：5942 rows，5942 rows_with_assets，11825 kept assets。
  - audit reasons：generated_region_snapshot 12020，kept 11825，question_number_mismatch 12，current_question_starts_late 23，wrong_question_number_in_snapshot 172，dropped_empty_safe_row 4。
  - audit files：`/private/tmp/ym_safe_v23_full/yangming_safe_audit.json`、`/private/tmp/ym_safe_v23_full/yangming_safe_audit.csv`。
- 這是目前最新安全存檔點；尚未推上線，尚未上傳正式 DB/Storage。下一步固定先跑 coverage audit：
  - `node scripts/audit_yangming_coverage.js --rows /private/tmp/ym_safe_v23_full/yangming_safe_rows.json --out /private/tmp/ym_safe_v23_full/coverage`
- coverage 後再依剩餘缺口處理，優先看回報交集與最大洞：`MOEX-100140-2101-Q064`、`MOEX-100140-2101-Q066`、`MOEX-100140-1101-Q067`、`102110-1101`、`102030-2101`。不可跳過審計直接上傳。

### 忘記密碼

已完成：

- `redteaomg@gmail.com` 已由 Supabase Admin 設強臨時密碼。
- 忘記密碼信已改導向 `/reset-password`。
- `/reset-password` 頁面已新增。
- `AuthProvider` 已補 recovery route 判斷，避免重設密碼流程被 bootstrap 洗掉。
- 已推上 `main`：`df32d52 Fix password reset flow`。

### 版本更新公告

規則：

- 只要是使用者看得到的更新，就要寫進首頁版本更新公告。
- 私有數據頁、後台內部修補、只跟站長有關的內容不要放。

2026-06-14 進度補充 12：

- 已完成 v23 coverage audit：
  - 指令：`node scripts/audit_yangming_coverage.js --rows /private/tmp/ym_safe_v23_full/yangming_safe_rows.json --out /private/tmp/ym_safe_v23_full/coverage`
  - 結果：6000 題中 5942 題有安全裁切圖，58 題 `missing_row`。
  - `text_only`、`question_number_mismatch`、`empty_after_filter` 都是 0，代表目前安全輸出沒有 OCR 文字版、錯題號圖或空殼 row 混進來。
- 最大剩餘缺口：
  - `102110-1101` 缺 7 題。
  - `100140-2101` 缺 6 題。
  - `102030-2101` 缺 6 題。
  - `106020-5301`、`106020-6301`、`108100-1301` 各缺 4 題。
  - `100140-1101`、`107020-6301` 各缺 3 題。
- 已抽 missing list，重點缺口包含：
  - `MOEX-100140-1101-Q065`、`Q066`、`Q067`
  - `MOEX-100140-2101-Q040`、`Q041`、`Q042`、`Q064`、`Q065`、`Q066`
  - `MOEX-102030-2101-Q031`、`Q032`、`Q033`、`Q034`、`Q035`
  - `MOEX-102110-1101-Q079`、`Q080`、`Q084`、`Q085`、`Q098`、`Q099`、`Q100`
- 初步判讀：
  - 舊書籤檔 `100140` 多數缺口是 `bookmark_toc_low_score_rejected` 或 `bookmark_low_score_exact_qno_rejected`，而抽出的題幹明顯不是該題；這表示低分拒絕是正確保護，不能為了補覆蓋率放寬。
  - `102030-2101` 的 Q31-Q35 屬於 `adjacent_gap`，鄰近 Q29/Q30/Q36/Q37 有抓到，較像邊界/parser 漏掉連續 row，需要針對來源頁面與題號表頭修。
- 下一步固定：
  - 用 focused diagnostic 檢查 `100140`、`102030-2101`、`102110-1101` 的 preview rows 與 gap audit，不要用大範圍 `rg` 淹沒輸出。
  - 先找「正確來源 row 是否存在但沒合併／被 safe filter 丟掉／根本沒抽到」，再改 parser。
  - 不可放寬低分錯配，不可回到完整原頁 fallback，不可重加 OCR 文字版。

2026-06-14 進度補充 13：

- 已接回 v23 存檔點，先檢查 `102110-1101` 最大缺口之一 Q79/Q80。
- 根因確認：`醫師國考詳解101-104(書籤版).pdf` 中 101 年第 2 次醫學（一）Q79 是「哪些寄生蟲幼蟲可穿過皮膚感染」，Q80 是「寄生蟲與症狀/疾病配對錯誤」；但網站 canonical 題庫目前 `MOEX-102110-1101-Q079` / `Q080` 兩題題幹正好對調。
- 這會讓 preview/safe 出現看似 `question_number_mismatch` 或低分拒絕；不能靠放寬 safe filter 解決，應先修題庫文字對應，再重跑 target 驗證。
- 下一步固定：用 `data/med1QuestionBank.ts` 既有 `questionTextOverrides` 做最小覆蓋修正 Q79/Q80，然後重新檢查 canonical 題幹與該卷 target coverage。

2026-06-14 進度補充 14：

- 已修 `scripts/preview_yangming_explanations.py` 的題幹來源優先序：`load_question_stems()` 現在會讀取 `data/med1QuestionBank.ts` 裡的 `questionTextOverrides`，並覆蓋 stale source JSON 的題幹。原因是 Q79/Q80 雖然在網站 runtime 已修正，但 preview hydrate 階段仍可能用舊 JSON 題幹蓋回去，導致安全切圖誤判。
- 已同步修 `hydrate_paper_questions()`：若 source JSON 沒有題幹，不再把 runtime canonical stem 清成空字串，而是保留 `question.stem`。
- 驗證：
  - `load_question_stems()` 讀到 `MOEX-102110-1101-Q079` =「下列那些寄生蟲的幼蟲可穿過皮膚進入人體而造成感染？...」。
  - `load_question_stems()` 讀到 `MOEX-102110-1101-Q080` =「下列寄生蟲與其在人體導致的症狀或疾病之配對中，何者錯誤？」。
  - `PYTHONPYCACHEPREFIX=/private/tmp/codex-pycache python3 -m py_compile scripts/preview_yangming_explanations.py` 已通過。
- 下一步固定：重跑 `醫師國考詳解101-104(書籤版).pdf` target preview/safe/coverage，確認 `102110-1101` 缺口是否下降；若仍缺，才檢查該卷 bookmark boundary 或 source page regions，不可回到 OCR 文字或完整原頁 fallback。

2026-06-14 進度補充 15：

- 已重跑 target 批次 `醫師國考詳解101-104(書籤版).pdf`：
  - preview：`/private/tmp/ym_preview_v24_101104b/yangming_consolidated_rows.json`，2761 extracted rows，2361 matched，1381 consolidated rows。
  - safe：`/private/tmp/ym_safe_v24_101104b/yangming_safe_rows.json`，1380 rows 全部有圖，保留 2213 張圖，只有 1 張 `question_number_mismatch` 被擋。
  - coverage：此為局部批次，不可用全站 gap；針對 `102110-1101` 看，已從 v23 缺 7 題降到缺 5 題，safe 95 題。
- 驗證 Q79/Q80 已回來：
  - `MOEX-102110-1101-Q079`：FOUND，1 張圖，來源 `醫師國考詳解101-104(書籤版).pdf :: 102(二)醫學一[書籤版] :: TOC`，match_score 0.872。
  - `MOEX-102110-1101-Q080`：FOUND，2 張圖，來源 `醫師國考詳解101-104(書籤版).pdf :: 102(二)醫學一[書籤版]`，match_score 0.827。
- `102110-1101` 剩餘缺口：`MOEX-102110-1101-Q084`、`Q085`、`Q098`、`Q099`、`Q100`。這些已不是 Q79/Q80 題幹對調問題，下一步要查 source rows/TOC/boundary 是否根本沒抽到。
- 另確認 `.codex/runtime_canonical_question_slots.json` 目前不存在，target preview 時 runtime canonical export 又 timeout 120 秒。這是流程穩定性問題：後續應建立穩定 cache 或更輕量本地解析，避免每次長跑都重新 import 完整 TypeScript 題庫。

2026-06-14 進度補充 16：

- 已針對 `102110-1101` 剩餘缺口做 focused diagnostic：
  - preview raw rows 裡 `102(二)醫學一[書籤版]` 的 Q84/Q85/Q98/Q99/Q100 都被標成 `missing_question / bookmark_toc_low_score_rejected`。
  - 這些 rejected row 的題幹分別是「統計指標較不受極端值影響」、「兩種抗生素治療淋病效果」、「總體醫療保健支出」、「菸品健康捐」、「預防注射可根絕的傳染病」。
  - 用題庫查證後，這些題幹屬於 `102030-1101`（102 年第 1 次醫學一）Q84/Q85/Q98/Q99/Q100，不是 `102110-1101`（102 年第 2 次醫學一）的 canonical 題幹。
- 結論：這 5 題不是 safe filter 太嚴，也不是圖片上傳問題；目前更像 `醫師國考詳解101-104(書籤版).pdf` 的書籤/頁面區間在 102(二) 後段混到 102(一)，或 parser 的 section boundary / `paper_meta` round mapping 有錯。
- 不可為了補這 5 題而放寬 `bookmark_toc_low_score_rejected`，否則會把第一回詳解錯掛到第二回題目。
- 另發現 `load_question_stems()` 若直接 import/讀完整 `data/sources/*.json` 會在目前 repo 狀態下很慢；後續長跑前應建立穩定 canonical cache 或避免重複讀大型來源。
- 下一步固定：檢查 `醫師國考詳解101-104(書籤版).pdf` 的 top-level TOC、102(一)/102(二) page range、以及 `parse_titled_meta` / `load_audit` 的 round mapping，先判斷是來源 PDF 混卷還是 parser 邊界錯。

2026-06-14 進度補充 17：

- 使用者指出：上下文精簡後一直重切同一批題目，這是目前最大流程問題。已新增 durable checkpoint：`.codex/YANGMING_MANUAL_RESCUE.md`。
- 接下來的正確策略已改為「剩餘長尾逐題救援」：
  - 不再把最後五十幾題主要交給全量規則反覆掃。
  - 每題用 canonical 題幹與題號去來源 PDF 定位。
  - 把確認過的 page/bbox 寫進 `data/sources/yangming_manual_regions.json`。
  - 用 `scripts/apply_yangming_manual_regions.py` 產生 screenshot-only row。
  - 再用 `scripts/filter_yangming_safe_snapshots.py` 生成安全截圖並抽圖確認。
- 已確認 `scripts/apply_yangming_manual_regions.py` 存在，這是現成的手動 region rescue 管線，不要重寫。
- 目前正在處理 106 target 缺口，不要精簡後又從頭查：
  - `MOEX-106020-5301-Q037/Q039/Q040`
  - `MOEX-106020-6301-Q037/Q038/Q040`
- 已視覺檢查：
  - `106-1醫學(一)-p036.png` 是 PDF page 37，包含 Q37 並在底部露出 Q38；Q37 crop 必須停在 Q38 表頭前。
  - `106-1醫學(一)-p037.png` 是 PDF page 38，上方是 Q38 continuation，下方開始 Q39。
  - `106-1醫學(二)-p033.png` 是 PDF page 34，Q37 開始並延續。
  - `106-1醫學(二)-p034.png` 是 PDF page 35，上方 Q37 tail，中段 Q38，下方 Q39。
- 下一步固定：不要再重看以上已確認內容；直接建立/更新 `data/sources/yangming_manual_regions.json`，先填 Q37/Q39/Q40 等已確認頁面，跑 v35 safe，抽圖驗證。

2026-06-14 進度補充 17：

- 已針對 `102030-2101` Q31-Q35 做 focused diagnostic。網站 canonical 題目分別是 SREBP、restriction endonuclease、coding sequence mutation、Klenow fragment、細菌 RNA polymerase core enzyme。
- 可用來源目前只有 `/Users/huangguanlun/Downloads/陽明詳解/醫師國考詳解101-104(書籤版).pdf`，沒有獨立 `102030_2101` 或同名單檔。
- 檢查 `102(一)醫學二[書籤版]` 對應頁面後，PDF 內容在 Q30 後直接跳到 Q36，TOC 也缺 Q31-Q35；關鍵字搜尋只命中其他年份/卷別的相關題（例如 103 醫師一），不可拿來替代。
- 層級分類：這不是 API filter、storage、前端渲染或 safe filter 問題，而是目前來源 PDF/書籤段落本身沒有這 5 題的正確詳解 row。先保持 missing，等找到真正來源再補。
- 下一步固定：不要再回頭硬補 `102030-2101` Q31-Q35；接著查下一個最大缺口 `100140-2101`，同樣先分類是來源缺題、preview 沒抽到、safe 拒絕、還是 ID 對不上。

2026-06-14 進度補充 17：

- 已檢查 `醫師國考詳解101-104(書籤版).pdf` 的 TOC 與頁面文字：
  - top-level `102(二)醫學一[書籤版]` page range 是 368-456，回次 mapping 正常，`102` 醫學（一）round 1 = `102030-1101`，round 2 = `102110-1101`。
  - PDF 第 441、455、456 頁本身就包含 `102030-1101` 那組後段題幹（極端值、抗生素 A/B、總體醫療保健支出、菸品健康捐、預防注射根除疾病）。
  - 反向搜尋 `102110-1101` 真正 Q84/Q85/Q98/Q99/Q100 的關鍵詞（住院日數、醫療倫理、無過失補償、健康保險制度）在這本 PDF 內找不到。
- 結論：`102110-1101` 這 5 題目前可判定為來源書籤版內容/書籤後段混入第一回題，並非 parser round mapping 錯，也不是 safe filter 誤殺。先保留缺口，不用錯圖補。
- 已中止先前卡住的 `git status` 背景 session；目前檔案系統/I/O 偶爾很慢，後續以 focused diagnostic 為主，避免整 repo 掃描。
- 下一步固定：改查 `102030-2101` Q31-Q35 連續缺口，這批鄰近題有抓到，較可能是可修的 page/row boundary 漏切。

2026-06-14 進度補充 18：

- 已針對 `100140-2101` 缺口 Q40/Q41/Q42/Q64/Q65/Q66 做 focused diagnostic。
- canonical 題幹：
  - Q40：肝臟粒線體內 HMG-CoA synthase 合成酶的主要功能。
  - Q41：脂肪組織之脂肪代謝何者錯誤。
  - Q42：何種營養素無法直接提供能量。
  - Q64：直接抑制骨骼肌細胞內鈣離子自肌漿網釋出造成肌肉鬆弛的神經肌肉阻斷劑。
  - Q65：農藥中毒、胸悶、瞳孔縮小、唾液過多應給藥。
  - Q66：胃部壁細胞調節胃酸分泌受體例外。
- 可用來源目前只有 `/Users/huangguanlun/Downloads/陽明詳解/醫師國考詳解096-100(書籤版).pdf`。在該 PDF 的 `100(二)醫學二[書籤版]` 區段附近，頁面 981-990 與 1001-1006 的題幹和 canonical 題幹對不上：
  - 該區段 Q40 是 zonula adherens，不是 HMG-CoA synthase。
  - 該區段 Q42 是神經元細胞體位置，不是營養素供能。
  - 該區段 Q64 是免疫球蛋白/EAC rosette 類題，不是 dantrolene/神經肌肉阻斷。
  - Q65/Q66 也對不到 canonical 農藥中毒/壁細胞題。
- keyword search 雖找到 HMG-CoA、脂肪代謝、dantrolene、瞳孔縮小、壁細胞等詞，但分散在不同年份/不同題號頁面，不能當成 `100140-2101` 的正確詳解。
- preview 只有 Q41 產生一筆低分候選，且該候選實際 `extracted_question_no=2`、safe audit 以 `question_number_mismatch` 擋掉；這是正確保護，不能放寬。
- 層級分類：目前 `100140-2101` 這 6 題屬於來源版本/題號不匹配或缺正確來源，不是 DB row missing 可直接補、不是 storage object missing、不是 API filter、也不是前端 render failure。
- 下一步固定：先不要硬補 `100140-2101`；接著查下一個最大缺口 `106020-5301/6301` 或 `108100-1301`，找出是否有可修 boundary/crop 規則。

2026-06-14 進度補充 19：

- 已修 `scripts/preview_yangming_explanations.py` 的 stem recovery 起點：過去 `find_question_start_by_stem()` 若 5-item window 從上一題詳解尾端開始但後面碰到本題 stem，會把 crop 錨在上一題尾巴。現在會 refine 到真正含本題 stem 的文字 item，並往回找同題題號列。
- 已修 `scripts/filter_yangming_safe_snapshots.py` 的 region snapshot 上下邊界：
  - 上邊界：若往上擴張 90px 後 prefix 內沒有本題 metadata/題號起點，就切回原始本題起點，不再保留上一題尾巴。
  - 下邊界：新增 `find_table_question_row_top()`，偵測同一陽明表格內下一題的「題號 + 題目」列，避免底部露出下一題表頭。
- Target 驗證批次：`106-1醫學(一).pdf` 跑到 `/private/tmp/ym_preview_v26_1061_med1` 與 `/private/tmp/ym_safe_v29_1061_med1/yangming_safe_rows.json`。
  - safe filter：97 rows、97 rows_with_assets、166 assets；只有 1 筆 `question_number_mismatch`，沒有 `current_question_starts_late`。
  - `MOEX-106020-5301-Q070` 的 source region 從舊的 `y=213.89` 修到 preview `y=307.52`；safe asset bbox 現為 `[0, 307.52, 595.32, 515.46]`，視覺確認不再含上一題尾巴或下一題表頭。
  - 抽看 `MOEX-106020-5301-Q071` 仍完整，沒有被新下邊界規則切壞。
- 下一步固定：用這個規則重跑 `106020-5301/6301` target coverage，確認 Q70 類缺口下降；若 target OK，再納入下一輪全量 safe，而不是只上線單題。

2026-06-14 進度補充 20：

- 電腦當機後已接回目前狀態；`/private/tmp/ym_safe_v31_1061_med12` 這類暫存輸出可能被清掉，但程式碼修正仍在 workspace。
- 已修 `scripts/preview_yangming_explanations.py` 的 `find_table_starts()`：某些 PDF 會把 `題目 ...` 與題號 `77.` / `78.` 拆成同一行但不同極窄文字盒，舊的 `item_bbox()` 因寬度太小回傳 `None`，導致 standalone 題號無法被認出，Q77/Q78 可能被上一題吞掉。
- 修法是只在 table-start detection 內新增 `loose_bbox()`，允許窄題號盒參與同列判斷；這不是放寬 safe filter，也不是把錯配圖硬塞進去，後續仍由 safe filter 檢查題號與裁切內容。
- 當機前已驗證 `106-1醫學(二).pdf`：修前 70-80 題附近只看到 Q70-Q76、Q79-Q80，漏 Q77/Q78；修後 Q77/Q78 已被 `find_table_starts()` 認出。
- 當機前 target 批次結果：`MOEX-106020-6301-Q077` 已有 2 張安全裁切圖，第一張從第 77 題表頭開始，第二張接跨頁尾段並在下一題前切斷；`106020-6301` 缺口從 Q37/Q38/Q40/Q77 改善為 Q37/Q38/Q40。
- 下一步固定：先用 `PYTHONPYCACHEPREFIX=/private/tmp/codex-pycache` 重新編譯，再重跑 `106-1醫學(一).pdf` + `106-1醫學(二).pdf` target preview/safe/audit，恢復當機前輸出；之後檢查同批剩餘缺口 `106020-5301` Q37/Q39/Q40 與 `106020-6301` Q37/Q38/Q40。

2026-06-15 進度補充 21：

- 使用者明確要求先停止繼續救援/重切陽明詳解，改成「把現有題庫打包上傳，確認網上能看到」。
- 目前已確認舊 checkpoint 提到的 v23 暫存路徑不存在：
  - `/private/tmp/ym_safe_v23_full/yangming_safe_rows.json`
  - `/private/tmp/ym_safe_v23_full/assets`
- 目前可用的完整本機候選包在專案內：
  - rows：`reports/yangming_import_preview/visual_boundary_full/yangming_visual_consolidated_rows.json`
  - asset root：`reports/yangming_import_preview/visual_boundary_full`
  - dry run 結果：`5900` rows、`12337` 個 `question_snapshot` assets。
  - 上傳策略：`YANGMING_ASSET_KIND_FILTER=question_snapshot` + `YANGMING_SCREENSHOT_ONLY=1`，也就是只保留截圖資產，清掉 OCR body 與 legacy sections，避免再把文字/表格混上線。
- 目前可用的小型補包：
  - rows：`/private/tmp/ym_safe_v34_1061_med12/yangming_safe_rows.json`
  - asset root：`/private/tmp/ym_preview_v34_1061_med12`
  - dry run 結果：`194` rows、`326` 個 `question_snapshot` assets。
- 已確認 `scripts/import_yangming_explanations.js` 會從 `.env.production.local` 讀到 Supabase URL 與 service role key；不要印出密鑰。
- 已 dry-run 成功的正式上傳命令如下，但尚未執行成功：
  - `/usr/bin/env YANGMING_ASSET_KIND_FILTER=question_snapshot YANGMING_SCREENSHOT_ONLY=1 YANGMING_ASSET_ROOT=reports/yangming_import_preview/visual_boundary_full node scripts/import_yangming_explanations.js reports/yangming_import_preview/visual_boundary_full/yangming_visual_consolidated_rows.json`
  - `/usr/bin/env YANGMING_ASSET_KIND_FILTER=question_snapshot YANGMING_SCREENSHOT_ONLY=1 YANGMING_ASSET_ROOT=/private/tmp/ym_preview_v34_1061_med12 node scripts/import_yangming_explanations.js /private/tmp/ym_safe_v34_1061_med12/yangming_safe_rows.json`
- 重要：正式遠端寫入因為會覆蓋 production Supabase 的 `5900` rows 並上傳 `12337` assets，被安全審查擋下。這不是技術錯誤，而是 production blast radius 太大。
- 下一步固定：不要繞過審查、不要改用其他方式偷偷上傳。需要使用者明確批准，例如：「我明確同意覆蓋正式 Supabase 陽明詳解資料，請上傳 visual_boundary_full 5900 題 + v34 194 題補包。」收到後再跑正式上傳，接著用正式站 API 抽查線上是否讀得到。

2026-06-15 進度補充 22：

- 使用者要求「線上直接讀新資料」。目前不是重切圖，也不是重新上傳資料，而是讓 production API 正確讀已上傳且已啟用的 versioned release。
- 已確認 Supabase active release 正常：
  - `ym-boundary-full-20260615`
  - `rows_count=5900`
  - `assets_count=12337`
  - `storage_prefix=versions/ym-boundary-full-20260615`
- 已確認 DB 中 `MOEX-110101-1301-Q020` 在 versioned table 裡存在，且有 3 張 `question_snapshot` asset、3 個 image section。
- 根因：`app/api/yangming-explanation/route.ts` 舊的 `shouldDropAssetForQuestion()` 只允許 `per_file/` 或 `/per_file/` 路徑；新上傳包的 asset path 是 `versions/ym-boundary-full-20260615/assets/...`，因此 production route 讀到 row 後把新圖全部誤殺，回傳 `explanation:null`。
- 已修 route：`question_snapshot` 現在允許 `versions/` 路徑，但仍擋 `fallback`、`page_snapshot`、`full_page` 與非 `question_snapshot`。這是讓線上直接讀新版本包，不是放寬到完整頁 fallback。
- 已加診斷欄位：沒有 row 或 assets 被過濾空時，也會回 `activeVersionId`，方便判斷 API 是否讀到 active release。
- 驗證：`npm run typecheck` 通過；`npm run build` 通過。
- 下一步固定：只提交 `app/api/yangming-explanation/route.ts` 和 `.codex/CURRENT_WORK.md`，推上線後抽查正式 API 是否回 `activeVersionId: ym-boundary-full-20260615` 且 Q020 有 assets。
