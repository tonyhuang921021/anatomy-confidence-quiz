# 重置停止檢查點（115/10/26）

收到父線停止通知後，未再執行作者工作、測試、建置、push或部署。此檢查點為未驗收WIP，不能作為發布候選。

## 已落檔，尚未驗收

- 使用者已批准最小新增細分類／定義，保留原大科與舊名稱ID階層／舊題映射。
- 在ad1b70a基礎新增3個細標籤：PUBH_MEDICAL_HISTORY、MIM_PATHOGEN_IMMUNE_EVASION、BIOC_CLINICAL_CHEMISTRY_MARKERS；15個既有標籤只追加舊制名目學科整合例外欄位，原definition/include/exclude/名稱/ID未覆寫。
- 21題CSV及生成JSON已落檔，現800題細標籤、0細標籤待核；這是資料填入完成，不是驗收完成。生成器成功檢查原文指紋、鎖定大科、來源頁與同科標籤；尚未執行新回歸。
- 全部800題的教學chapter/section映射仍未實作；執行時仍保留官方來源占位值。不能宣稱章節已完成。
- 既有779題章節映射的獨立工作尚未落檔；僅已閱讀schema、UI消費端與109個已有標籤解剖題幹，尚無審定映射。

## 已保存續作材料

- docs/moex-98-99/taxonomy-extensions.json：3新增及15例外完整清單。
- docs/moex-98-99/classification-review.csv：800題逐題綁定原題指紋。
- reports/maintenance-20261025/classification/placement-baseline.json：未改前6730個既有非98/99 canonical題目SHA-256 ebc49d69a64ab40c0860f7e0e2e657d099fd8d27c8f59bba2e3b2aaae625e574，既有subject/chapter/section配對與見證題ID，原anatomyOutline。
- reports/maintenance-20261025/classification/complete-learning-placement.py：本輪已執行的taxonomy及21題資料更新腳本（不是章節映射，重跑會因保護assert停止，勿重跑）。

## 下次必做（須新的使用者續作指示）

1. 審查新增3細類和15例外是否最小合理，確認21題完整題意；既有所有題目映射不可變。
2. 依舊章節見證完成800題獨立learning placement；不改官方來源JSON，不直接把primaryTag去前綴當章節。解剖Outline固定、其他科動態章節，必須驗證新題可由適用章節選取。必要新增小節應保留舊節點順序及名稱。
3. 原8項契約測試目前仍預期21題待核且taxonomy整檔hash未變；需改為有意義的0缺口、原taxonomy核心／舊ID名稱及6730題不變、800章節覆蓋與同科測試，不能單純刪防護。尚未修改或執行這些測試。
4. 更新Q093瀏覽器期望（待核→同科職業醫學基礎整合）與首頁／範圍待核0文案，跑必要桌面手機作答／搜尋／章節入口，build後才可發布。
5. 重新核實正式main、保留rollback，僅限已授權維護變更；排除贊助、97/更早、老趙、另案詳解。正式Ready後實際驗證，不能把本WIP當通過版本。

## 狀態

沒有push或部署在途；沒有工具拒絕或結果不明。正式站仍為先前c13852b版，本批維護未上線。Library v3仍是ad1b70a審閱包，沒有將本未驗收WIP冒稱更新交付。停止原因為父線指出週用量已重置，遵守不自動耗新週；不因較晚舊顯示與新配額讀值差異自行恢復。
