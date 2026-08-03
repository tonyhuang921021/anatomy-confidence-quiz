# 老趙解剖學私人內容協作流程

這套流程只處理已取得授權的影片。YouTube Data API 只同步官方清單與 metadata；私人下載工具則依指定 video ID 逐部取得授權來源，不會在網頁瀏覽時下載影片。

所有中間產物預設放在 `data/laozhao/staging/`，該目錄已被 Git 忽略，不會進入 Vercel 或公開網站。

本機可在 `.env.local` 設定既有工具位置，避免把私人電腦路徑寫進文件：

```bash
LAOZHAO_PYTHON=/你的工具位置/.venv/bin/python3
LAOZHAO_TRANSCRIBE_TOOL=/你的工具位置/transcribe_lecture_mlx.py
LAOZHAO_CAPTURE_TOOL=/你的工具位置/capture_slides.py
```

同步 YouTube 清單前，還必須由有權限的人確認內容可嵌入，並在本機設定 `LAOZHAO_CONTENT_RIGHTS_CONFIRMED=true`。未設定時同步程式會直接停止。

每次準備發布老趙影片區時，先執行專用 freshness 檢查：

```bash
npm run check:laozhao-manifest
```

超過 30 天會阻擋老趙內容發布，但不會讓刷題網站的其他緊急修正無法建置。

第一次處理前先確認現有 Python 環境可載入轉錄與影像套件：

```bash
npm run check:laozhao-tools
```

若尚未建立專用環境，可用 Python 3.10 以上建立 repo 內的忽略目錄，再安裝固定依賴：

```bash
python3 -m venv .venv-laozhao
.venv-laozhao/bin/python3 -m pip install -r scripts/laozhao/requirements.txt
```

## 1. 準備一支授權原始影片

先從 `data/laozhao/courseManifest.generated.json` 找到相對應的 YouTube video ID。原始影片可放在電腦上任意私人位置，建議檔名直接使用 video ID，例如：

```text
ATFBb25QRNw.mp4
```

取得授權後，也可以直接從官方播放清單逐部下載：

```bash
npm run download:laozhao -- --video-id ATFBb25QRNw
```

下載工具會拒絕未出現在官方 manifest 的影片、未確認授權的環境，以及整份播放清單一次下載。預設最高抓到 1080p；若來源最高只有 720p，就保留 720p。輸出固定放在：

```text
data/laozhao/staging/ATFBb25QRNw/source/ATFBb25QRNw.mp4
```

不要把原始影片放進 Git、Vercel 或公開分享區。

## 2. 產生含時間戳的逐字稿

沿用既有 MLX Whisper 工具，但改用解剖學提示詞：

```bash
npm run transcribe:laozhao -- \
  "/你的私人影片位置/ATFBb25QRNw.mp4" \
  "data/laozhao/staging/ATFBb25QRNw/whisper.raw.json" \
  --video-id ATFBb25QRNw \
  --tool "$LAOZHAO_TRANSCRIBE_TOOL"
```

這一步可能花較久時間，完成後會得到私人 Whisper JSON，並加入來源影片的 SHA-256、video ID、檔名與大小。程式不會下載 YouTube 影片，也不會修改既有轉錄工具。

## 3. 建立給 Chat 的分章工作包

```bash
npm run package:laozhao-transcript -- \
  --video-id ATFBb25QRNw \
  --transcript data/laozhao/staging/ATFBb25QRNw/whisper.raw.json
```

輸出位置：

```text
data/laozhao/staging/ATFBb25QRNw/review-package/
```

其中：

- `transcript.private.json`：正規化後的私人逐字稿。
- `transcript.private.vtt`：方便人工校對的字幕格式。
- `chat-chapter-package.md`：可直接交給 Chat，內含規則、JSON 格式與完整時間碼。
- `chapter-draft.template.json`：空白格式參考。
- `warnings.txt`：時間重疊或無效片段等提醒。

## 4. 讓 Chat 整理章節

把 `chat-chapter-package.md` 交給 Chat。它必須只回傳 JSON，不能自行新增逐字稿沒有支持的內容，也不能把 `reviewStatus` 改成 `reviewed`。

將 Chat 回傳內容存成 JSON 後執行：

```bash
npm run validate:laozhao-chapters -- \
  --transcript data/laozhao/staging/ATFBb25QRNw/review-package/transcript.private.json \
  --draft "/Chat 回傳檔案的位置/chapter-draft.from-chat.json"
```

驗證會檢查：

- video ID 與逐字稿版本指紋是否完全一致。
- 章節是否依時間排序、互不重疊且沒有超出影片。
- 板書目標時間是否真的落在該章節。
- Chat 是否擅自宣告內容已審核。

通過後會產生 `chapters.validated.private.json`，仍然只是草稿。

## 5. 依章節擷取板書候選

```bash
npm run extract:laozhao-board -- \
  "/你的私人影片位置/ATFBb25QRNw.mp4" \
  data/laozhao/staging/ATFBb25QRNw/review-package/chapters.validated.private.json \
  --capture-tool "$LAOZHAO_CAPTURE_TOOL"
```

程式會沿用既有的投影片／板書範圍偵測，並在每個章節內：

- 評估清晰度、內容量、瞬間移動與相對遮擋。
- 優先保留老師移開後、內容較完整的真實影格。
- 每章保留多張候選，不讓單一自動判定直接決定發布圖。
- 產出 `contact-sheet.jpg` 供快速人工比較。
- 不做 AI 補畫、不做 inpainting，也不拼接不同板書狀態。

輸出仍在私人目錄：

```text
data/laozhao/staging/ATFBb25QRNw/review-package/board-candidates/
```

`sceneResidualEstimate` 是畫面變動與局部殘差的估計，不是人體辨識結果，因此每張圖都必須人工確認。

## 6. 交回 Codex

交回以下內容即可：

1. Chat 原始回傳 JSON，或已驗證的 `chapters.validated.private.json`。
2. `board-candidates/index.private.json`。
3. 每章最後選定的 candidate ID；若某章都不理想，註明要重新擷取的時間範圍。

Codex 會再次核對章節、時間、圖片與權利狀態。只有你明確確認、且改成 `reviewed` 的章節才會進公開 manifest；逐字稿、OCR、原始影片與未選板書不會公開。
