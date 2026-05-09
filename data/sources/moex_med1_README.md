# MOEX 醫師一階醫學（一）考古題來源清單

這份清單先整理官方考選部公開 PDF 直連，用來後續抽出解剖相關題。

檔案：
- `moex_med1_source_manifest.json`：官方來源 URL 清單
- `download_moex_med1.py`：在本機下載 PDF 的腳本

使用方式：
```bash
python download_moex_med1.py
```

下載後會產生 `moex_med1_pdfs/`，包含各年份醫學（一）試題、標準答案、更正答案。

後續轉題庫流程：
1. 下載 PDF
2. 解析題目與答案
3. 篩選解剖、組織、胚胎中偏解剖題
4. 標註 chapter / section / testedConcept
5. 重新撰寫 explanation
6. 輸出 `data/anatomyQuestions.ts`
