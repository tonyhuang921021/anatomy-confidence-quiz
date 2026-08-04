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

## 6. 人工選定完整板書

每章從 `contact-sheet.jpg` 與原始候選中挑出最完整的真實板書狀態，寫入：

```text
data/laozhao/staging/<videoId>/review-package/board-selection.preview.private.json
```

選圖原則：

- 以老師擦除或改圖前的完整狀態為優先，不以單純「人影最少」取代完整性判斷。
- 同一章若先後完成兩張不同圖，可保留多張；每章最多三張。
- 沒有具辨識價值的板書時明確留空，不勉強發布老師遮住或未完成的圖。
- candidate ID、來源相對路徑、時間碼與章節 ID 都要保留，之後才能回到原影片核對。

## 7. 私人參考筆記對照

若有其他筆記可協助確認板書完整性，另建私人對照檔：

```text
data/laozhao/staging/<videoId>/review-package/reference-notes.private.json
```

逐張記錄板書 ID、章節 ID、影片時間碼、來源 PDF 指紋、PDF 實際頁碼、頁內圖示位置與吻合構造。這份資料不只靠檔名，因此 PDF 或截圖重新命名後仍可核對。

```bash
npm run validate:laozhao-reference -- \
  --reference data/laozhao/staging/<videoId>/review-package/reference-notes.private.json \
  --board-selection data/laozhao/staging/<videoId>/review-package/board-selection.preview.private.json
```

網站必須以 `boardFrameId` 對應 `referenceImageId`，再讀取 PDF 頁碼與 `pageRegion`；不可依檔名、陣列順序或相近時間自行猜測。

筆記尚未取得公開授權時，完整頁面只能放在管理員專用、受密碼保護的 Preview。建立時必須同時提供來源 PDF、讓 SHA-256 與私人對照檔完全吻合，並明確加入 `--confirm-reference-preview`；正式站與一般訪客仍然不可讀取。若未來要正式公開，仍須另外確認公開授權，不能把 Preview 的確認視為正式公開許可。

建立含完整板書與筆記頁的受保護 Preview 資料：

```bash
npm run build:laozhao-preview -- \
  --transcript data/laozhao/staging/<videoId>/review-package/transcript.private.json \
  --chapters data/laozhao/staging/<videoId>/review-package/chapters.validated.preview.private.json \
  --board-selection data/laozhao/staging/<videoId>/review-package/board-selection.preview.private.json \
  --reference-map data/laozhao/staging/<videoId>/review-package/reference-notes.private.json \
  --reference-pdf "/私人來源/參考筆記.pdf" \
  --confirm-reference-preview \
  --confirm-authorized-preview
```

產製器只輸出對照檔列出的完整頁面，不自動裁切或輸出整份 PDF；頁面與板書都受同一個 Preview 權限閘門保護。

目前 Preview 不得直接 promote 到正式站。只要 `data/laozhao/previewContent.generated.json` 或 `public/laozhao-preview/` 仍含測試教材，production build 必須失敗；即使 Preview deployment 被誤 promote，middleware 也會依正式網域封鎖課程頁與板書靜態資產。正式公開前應另建經審核的 production 內容契約並重新建置。

## 8. 單片可重跑流程

每支影片都使用相同目錄與檔名。先執行不發布版本：

```bash
npm run process:laozhao-video -- --video-id ATFBb25QRNw
```

它會重新驗證章節、板書選擇與可選的私人筆記對照，並把目前閘門狀態寫到忽略的 `pipeline-status.private.json`。沒有明確確認時，不會產生網站素材。

需要重新抽板書候選時才加：

```bash
npm run process:laozhao-video -- \
  --video-id ATFBb25QRNw \
  --extract-board
```

人工選圖完成、內容權利也再次確認後，才能建立受保護 Preview：

```bash
npm run process:laozhao-video -- \
  --video-id ATFBb25QRNw \
  --reference-pdf "/私人來源/參考筆記.pdf" \
  --confirm-reference-preview \
  --confirm-authorized-preview
```

流程只更新該 video ID 的 Preview 內容與專用圖片目錄，不會公開原始影片、逐字稿、未選候選圖或私人參考筆記。Production 另有環境閘門，不能靠這個指令開啟。

## 9. 校對完整字幕

網站字幕一律使用臺灣繁體中文。Whisper 產出的簡體字、中文同音誤辨與英文醫學術語近音拼錯，不能直接靠字典全自動取代；先建立包含全部章節脈絡、時間碼與字幕 ID 的校對包：

```bash
npm run package:laozhao-subtitles -- --video-id ATFBb25QRNw
```

輸出位置：

```text
data/laozhao/staging/ATFBb25QRNw/review-package/subtitle-proofreading-package.private.md
```

把整份 Markdown 交給 ChatGPT Pro。它只能回傳需要修改的字幕 ID，不可改時間碼、重排、合併或拆分字幕；不確定的醫學英文要放進 `unresolved`，不可猜測。將回傳的純 JSON 存入私人 staging 後套用：

```bash
npm run apply:laozhao-subtitles -- \
  --video-id ATFBb25QRNw \
  --review data/laozhao/staging/ATFBb25QRNw/review-package/subtitle-proofreading.chat.private.json
```

最後執行：

```bash
npm run check:laozhao-subtitles
```

校對回覆的字幕指紋、video ID、修正 ID 或格式不一致時會拒絕套用；任何仍可轉成臺灣繁體的字幕也會阻擋 Preview build。`unresolved` 仍須人工看影片確認，不能把不確定術語直接發布。

## 10. 整理可核對的列點講義

字幕完成校對後，建立給 ChatGPT Pro 的完整列點講義工作包：

```bash
npm run package:laozhao-lecture-notes -- --video-id ATFBb25QRNw
```

輸出位置：

```text
data/laozhao/staging/ATFBb25QRNw/review-package/lecture-notes-package.private.md
```

工作包會附上全部章節與全部校對字幕。老師實際講授與必要補充分成兩種來源：

- `provenance: "teacher"`：只能整理老師講過的內容。所有字幕必須從第一段到最後一段連續涵蓋，不能跳段、重疊或跨章；每個區塊最多涵蓋 14 段字幕，避免把整章過度濃縮。
- `provenance: "supplement"`：可補上理解所需的背景、名詞或比較，但必須以 `afterBlockId` 接在特定老師講授區塊後，網站會明確顯示「補充」，不可冒充老師原話。

Chat 應逐段確認老師講到的定義、數字、步驟、因果、比較、例子、口訣、例外、否定、提醒、自我修正與考試提示都已寫入。比較、分類或流程可使用表格；其他內容使用列點。任何無法確認的內容必須放進 `unresolved`，不能猜測。

將 Chat 回傳的純 JSON 放入私人 staging，再執行：

```bash
npm run apply:laozhao-lecture-notes -- \
  --video-id ATFBb25QRNw \
  --review data/laozhao/staging/ATFBb25QRNw/review-package/lecture-notes.chat.private.json
```

驗證通過後會產生 `lecture-notes.validated.private.json` 並套入受保護 Preview。任何字幕缺口、重疊、跨章、過長區塊、無來源補充或未解疑點都會停止匯入。後續用單片流程重建時，會自動沿用這份已驗證講義；如果字幕版本變更，舊講義會因指紋不一致而被拒絕，必須重新校對。

## 11. 交回內容

交回以下內容即可：

1. Chat 原始回傳 JSON，或已驗證的 `chapters.validated.private.json`。
2. `board-candidates/index.private.json`。
3. 每章最後選定的 candidate ID；若某章都不理想，註明要重新擷取的時間範圍。
4. 私人參考筆記的對照 JSON、來源 PDF 指紋與授權狀態；原始 PDF 只在本機產製受保護頁面，不提交 Git。
5. Chat 字幕校對回傳的純 JSON，以及仍需看影片確認的 `unresolved` 清單。
6. Chat 列點講義回傳的純 JSON；若有補充內容，確認每一項都清楚標為 `supplement`。

Codex 會再次核對章節、時間、圖片與權利狀態。受保護 Preview 可顯示仍標為 `draft` 的人工校訂內容；正式站只接受 `reviewed`。逐字稿來源資料、OCR、原始影片、未選板書與未獲公開授權的參考筆記都不會公開。
