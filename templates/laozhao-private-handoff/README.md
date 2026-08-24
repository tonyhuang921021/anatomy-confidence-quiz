# 老趙解剖學私人 AI 接力

這個 repository 只用來讓 Codex、OpenAI API 與人工審查接力處理已授權的老趙解剖學內容。

## 不可省略的安全規則

- GitHub repository 必須是 **Private**。工作流程會再次檢查，公開 repo 會直接停止。
- 只提交逐字稿、章節草稿、進度快照與審查報告。
- 不提交原始影片、音訊、板書圖片、API key、`.env` 或網站使用者資料。
- OpenAI API key 只能放在 GitHub Actions secret `OPENAI_API_KEY`。
- API 呼叫固定使用 `store: false`；仍應依 OpenAI 帳戶的資料控制設定評估授權內容是否適合送出。
- AI 的 `approve` 只是流程建議。公開章節與圖片仍須由內容權利人及人工審查確認。

## 工作方式

1. Codex 從網站 repo 匯出一份帶來源指紋的工作到 `jobs/<videoId>/<jobId>/`。
2. 在 Actions 執行 **Draft Lao Zhao chapters**，OpenAI 只輸出符合 JSON schema 的章節草稿。
3. Action 把結果放到獨立分支並建立 Pull Request。
4. Codex 把計畫、進度、驗證與結果寫入同一份 PR 的 `progress/`。
5. 在 PR 分支執行 **Review Lao Zhao progress**，OpenAI 會回傳通過、需修改或阻擋，以及風險與下一步建議。
6. Codex 修正後再次記錄進度；最終結果拉回本機，仍須通過網站 repo 的章節驗證器。

## GitHub 設定

在 repository 的 `Settings > Secrets and variables > Actions` 設定：

- Secret：`OPENAI_API_KEY`
- Variable（選填）：`OPENAI_MODEL`，未設定時使用 `gpt-5.6-sol`
- Variable（選填）：`OPENAI_REASONING_EFFORT`，未設定時使用 `high`

Actions 的兩個工作都只能手動執行，避免每次小改動都產生 API 成本。
