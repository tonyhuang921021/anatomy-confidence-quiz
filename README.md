# Anatomy Confidence Quiz

適合醫學生準備台灣醫師國考一階的解剖學刷題 Web App。系統會結合作答結果、信心程度、錯因、完成度與掌握度，幫你找出最需要補強的 section，並產生可直接貼給 ChatGPT 的 AI 補弱 prompt。

## 安裝與執行

```bash
nvm use
npm install
npm run dev
```

開啟瀏覽器後進入 `http://localhost:3001`。

## 手機最省事的用法

最推薦直接部署到 Vercel。部署後會拿到一個公開網址，手機用 `4G/5G` 或任何網路都能直接打開，不需要跟電腦連同一個 Wi‑Fi，也不用讓電腦一直開著。

## 部署到 Vercel

最簡單做法：

1. 把這個專案上傳到 GitHub
2. 到 [Vercel](https://vercel.com/) 登入
3. 點 `Add New Project`
4. 匯入這個 GitHub repository
5. Framework 保持 `Next.js`
6. 在 Environment Variables 加入：

```bash
OPENAI_API_KEY=你的金鑰
OPENAI_MODEL=gpt-5.2
```

7. 按 `Deploy`

部署完成後，Vercel 會自動給你一個公開網址，手機直接打開就能做題。

官方文件：

- Next.js on Vercel: [https://vercel.com/docs/frameworks/nextjs](https://vercel.com/docs/frameworks/nextjs)
- Next.js 官方部署教學: [https://nextjs.org/learn/pages-router/deploying-nextjs-app-deploy](https://nextjs.org/learn/pages-router/deploying-nextjs-app-deploy)

## 之後更新題庫

如果你之後再補題庫或改介面，只要：

1. 更新專案
2. push 到 GitHub
3. Vercel 會自動重新部署

這樣你的手機網址會繼續沿用，不用重新記新的網址。

## 目前功能

1. 解剖學刷題
2. A-E 答案按鈕 UI
3. 選填信心程度
4. 答錯後錯因標記
5. 弱點分析
6. 完成度追蹤
7. 掌握度 `masteryScore`
8. AI 補弱 prompt 產生
9. 第二版智慧測驗設定
10. 弱點補強 / 隨機刷題 / 錯題複習模式
11. 錯題與高風險題筆記頁
12. OpenAI API 補弱解析入口
13. Next.js API routes
14. AI 題目複查
15. 題目來源標記
16. 答完後才顯示難度標籤
17. 300 題本地題庫

## 技術

- Next.js 14
- React 18
- TypeScript
- Tailwind CSS
- App Router
- `localStorage` 保存 current session 與 completed sessions
- Node 20 LTS（見 `.nvmrc`）

## 頁面

- `/` 首頁
- `/quiz` 測驗頁
- `/results` 結果頁
- `/progress` 進度總覽頁
- `/review` 錯題複習頁

## API Routes

- `GET /api/health`
- `GET /api/questions`
- `POST /api/recommend`
- `POST /api/ai-analysis`
- `POST /api/generate-question`

## 第一版資料策略

- 題庫使用本地 TypeScript 題庫：`data/anatomyQuestions.ts`
- 題目可標示 `MOEX_PAST_EXAM` 或 `AI_GENERATED` 來源
- 歷史紀錄使用 `localStorage`
- 不需登入
- 不串接資料庫
- 可選擇串接 OpenAI API 做題目複查與補弱分析

## 第二版新增

- 首頁可選測驗模式與題數
- 支援聚焦章節 / 小節刷題
- `weakness` 模式會優先抽：
  - 完成度低的小節
  - 掌握度低的小節
  - 曾經答錯或低信心的題目
  - 錯誤自信題
- `review` 模式會優先抽錯題與低信心題
- 新增 `/review` 錯題複習頁，集中顯示高風險題與最近錯因
- 題目順序與選項順序會打亂
- 測驗中不先顯示難度，答完才顯示 `易 / 普 / 難`

## 第三版新增

- 首頁加入穩定版學習儀表板
- 顯示下一輪推薦 section
- 顯示今日複習提醒
- 結果頁可直接呼叫 OpenAI API 生成補弱分析
- 新增 `.env.example` 與 API routes，方便後續接前後端
- 保留 OpenAI API 擴充入口
- 支援題目複查按鈕

## OpenAI API 設定

1. 複製 `.env.example` 成 `.env.local`
2. 填入：

```bash
OPENAI_API_KEY=你的金鑰
OPENAI_MODEL=gpt-5.2
```

未設定金鑰時，結果頁仍可正常使用，只是不會真的呼叫 OpenAI，而是回傳可複製的 prompt。

## 正式版多使用者

這版已加上 `Supabase Auth + 雲端 completed sessions 同步` 的骨架。

### 需要的環境變數

```bash
NEXT_PUBLIC_SUPABASE_URL=你的 Supabase Project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的 Supabase anon key
```

### 需要的資料表

請到 Supabase SQL Editor 執行：

```sql
-- 直接貼上 supabase/schema.sql 內容
```

### 目前正式版已支援

1. 使用 Email / Password 註冊與登入
2. 以使用者分開保存 `current session` 與 `completed sessions`
3. completed sessions 同步到 Supabase
4. 同一帳號在手機與電腦可拉回歷史 completed sessions
5. 首頁可看到目前登入者與同步狀態

### 目前正式版還沒做滿的部分

1. `current session` 仍以本機為主，尚未做即時跨裝置接續
2. 還沒接 Google / Apple / magic link
3. 還沒把所有統計改成完全 server-driven
4. 目前以 `quiz_sessions.session_payload` JSON 同步，後續可再拆成 attempts table

## 題庫與來源說明

- 本專案目前主題庫為本地 300 題題庫
- 題目可帶來源欄位，例如 `MOEX_PAST_EXAM`、`AI_GENERATED`
- 可附 `sourceCitation`、`sourceYear`、`sourceRound`、`originalQuestionNumber`
- MOEX 官方來源清單放在 `data/sources/`

## 未來升級方向

1. 接 Supabase 儲存長期紀錄
2. 接 OpenAI API 自動產生補弱解析
3. 增加登入功能
4. 增加其他科目如生理、生化、藥理、病理、微免
5. 增加依弱點自動抽題
6. 增加 spaced repetition 複習排程
7. 增加錯題本
8. 增加圖像題與解剖標本題
