# 老趙解剖學 GitHub 雙向接力

這套接力讓 Codex 與 OpenAI API 在一個獨立的 Private GitHub repository 協作。網站 repo 是 Public，因此不得把逐字稿、章節草稿或其他私人授權內容提交到網站 repo。

## 接力角色

- **Codex**：下載與轉錄授權影片、建立工作包、記錄計畫與進度、執行本機驗證、擷取板書候選、修正問題。
- **Chat / OpenAI API**：依逐字稿產生章節草稿，並在各檢查點獨立審查 Codex 的計畫、過程、驗證證據與結果。
- **人工審查者**：決定章節與板書是否正確、內容是否可公開，以及是否接受 AI 建議。

Chat 的 `approve` 只表示可以進入下一個私人處理階段，不代表內容已取得公開核准。

## 為什麼使用獨立 Private repo

目前 `tonyhuang921021/anatomy-confidence-quiz` 是 Public。接力 repo 必須隔離以下內容：

- 含時間碼逐字稿。
- 未審核章節草稿。
- Codex 的進度與驗證證據。
- Chat 的監督報告。

原始影片、音訊、板書圖片、OCR、API key 與網站使用者資料仍只留在本機，不進任何 Git repository。

## 首次設定

先在網站 repo 建立本機骨架：

```bash
npm run scaffold:laozhao-handoff
```

預設位置是：

```text
data/laozhao/staging/private-handoff-repo
```

接著在 GitHub 建立 Private repository，例如 `laozhao-content-handoff`，把本機骨架推上去。推送前後都要用 GitHub CLI 驗證：

```bash
gh repo view tonyhuang921021/laozhao-content-handoff --json visibility,isPrivate
```

必須得到 `"visibility":"PRIVATE"` 與 `"isPrivate":true`。

在 GitHub repository 的 `Settings > Secrets and variables > Actions` 新增：

- Secret `OPENAI_API_KEY`。
- Variable `OPENAI_MODEL`，可省略；目前預設 `gpt-5.6-sol`。
- Variable `OPENAI_REASONING_EFFORT`，可省略；目前預設 `high`。

API 呼叫使用 Responses API、strict JSON schema 與 `store: false`。ChatGPT Pro 訂閱不能直接供 GitHub Actions 呼叫；API key 與 API 用量是另一套計費。

## 每部影片的流程

### 1. 匯出私人工作

```bash
npm run export:laozhao-handoff -- --video-id ATFBb25QRNw
```

只會匯出：

- `input/job.json`：影片 ID、長度與來源指紋。
- `input/transcript.private.vtt`：含時間碼逐字稿。
- `progress/010-codex-plan.json`：Codex 的第一個計畫與安全檢查點。

同一份逐字稿會得到相同 `jobId`，不同版本不會互相覆蓋。

### 2. 推送工作並執行分章

將新 job 提交到 Private repo，至 Actions 手動執行 **Draft Lao Zhao chapters**，輸入完整 `jobs/<videoId>/<jobId>` 路徑。

Action 會：

1. 再次確認 repo 是 Private，且 Git 沒有追蹤影片、音訊、圖片或壓縮檔。
2. 呼叫 OpenAI Responses API，要求 strict JSON schema。
3. 驗證影片 ID、逐字稿指紋、章節順序、範圍與板書目標時間。
4. 建立 `chat/<videoId>-<fingerprint>` 分支與 Pull Request。

### 3. 拉回並執行網站端驗證

切到該 PR 分支並拉回後，在網站 repo 執行：

```bash
npm run import:laozhao-handoff -- --video-id ATFBb25QRNw
```

輸出仍在本機私人 staging：

```text
chapters.validated.from-github.private.json
```

同時會把 `evidence/local-validation.json` 與 `progress/030-codex-chapter-validation.json` 寫回 Private repo，讓 Chat 看見本機驗證結果。

### 4. 讓 Chat 監督 Codex

在 Private repo 的 PR 分支執行 **Review Lao Zhao progress**，選擇階段：

- `plan`
- `chapter_validation`
- `board_extraction`
- `final`

只有需要重新核對逐字稿內容時才勾選 `include_transcript`，以降低 API 成本。監督報告會包含：

- `approve`、`changes_requested` 或 `blocked`。
- 已證實的觀察與證據。
- 風險等級與修正建議。
- 下一個檢查點。
- 必須交由人工決定的事項。

報告的 `reviewInputDigest` 綁定當下進度與 artifact。Codex 改過內容後，舊報告不會被誤當成新版本核准。

### 5. 記錄其他處理階段

Codex 可在轉錄、板書擷取與最終驗收後追加結構化進度：

```bash
npm run report:laozhao-handoff -- \
  --video-id ATFBb25QRNw \
  --sequence 40 \
  --stage board_extraction \
  --status completed \
  --summary "已產生板書候選與 contact sheet，尚待人工選圖" \
  --changes "evidence/board-candidate-index.json" \
  --checks "章節指紋一致|無原始影片進 Git" \
  --next "請 Chat 審查流程，再由人工選圖"
```

進度檔只寫檔名、檢查結果與摘要，不保存完整 shell 輸出，以免日誌夾帶 token、電腦路徑或私人內容。

## 費用與資料安全

- 分章與監督都採手動觸發，避免每次 commit 自動花費。
- 監督預設不重送完整逐字稿；需要內容核對時才開啟。
- `store: false` 可避免建立 Responses application state，但 API 的一般濫用監控保留仍依 OpenAI 帳戶資料控制政策處理。
- GitHub Actions secret 不可寫入檔案或 log；Private repo 的協作者也應限制到必要人員。
