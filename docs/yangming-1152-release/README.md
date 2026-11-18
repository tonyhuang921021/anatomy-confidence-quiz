# 115-2 陽明原稿詳解候選

來源：https://sites.google.com/view/ymmedexam/ans ，陽明醫學系 M117，出版日期 2026-11-11。

- 醫學一官方 PDF：https://drive.google.com/file/d/1VCFu53D-1yQdjxku6oqJMJfcq7G3QcRj/view
- 醫學二官方 PDF：https://drive.google.com/file/d/13oPE4kAOrDQ7CiMKxUdret61m5kTFthj/view
- 本次新增 196 題、461 張原稿裁圖，保留作者與校稿署名。
- 醫學一 100 題；醫學二 96 題。醫二 Q061–064 在官方總檔及藥理分冊均缺失，沒有生成或替代原稿。
- canonical ID 使用網站官方題庫 MOEX-115090-1301 / 2301，不使用缺少此期資料的舊 audit 映射。

## 驗證

逐題核對官方題幹（完整包含或字串相似度至少 0.9）；每題裁圖內真實題號表頭只有自己的單一表頭。保留跨頁。醫一三處圖片溢出文字框已擴大裁圖，六張章節封面／封底已排除。原稿全文未逐張人工閱讀，視覺檢查涵蓋異常邊界與代表性裁圖。

`asset-manifest.json` 記錄每張圖片 SHA-256。來源 PDF SHA-256、缺題與統計在 `data/sources/yangming_1152_release.json`。

## 資料保護與部署

此附加 release 與圖片隨程式部署；不寫入 Supabase 詳解表、不切換既有 active version、不覆蓋舊 reviewed release，人工補充沿原有 API 分層讀取。名稱功能的 migration 是另一項待核准變更。

預覽可部署；正式發佈須使用者確認。

測試：`node --test scripts/yangming-1152-release.test.cjs scripts/yangming-reviewed-release.test.cjs`。
