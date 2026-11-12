"use client";

import Link from "next/link";
import { Heart } from "lucide-react";
import { useState } from "react";
import expenses from "@/lib/sponsorship/expenses.json";
import { SponsorshipInformation } from "@/components/SponsorshipInformation";
import { SponsorshipDonorListPreview } from "@/components/SponsorshipDonorListPreview";

const money = (amount: number) => `US$ ${amount.toFixed(2)}`;
const twd = (amount: number) => `NT$ ${(amount * expenses.conversion.rate).toLocaleString("zh-TW", {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
const records = [...expenses.records].sort((a, b) => b.date.localeCompare(a.date));

export function SponsorshipPage() {
  const [provider, setProvider] = useState("all");

  return (
    <main id="main-content" className="shell sponsorship-page">
      <div className="breadcrumb"><Link href="/">首頁</Link> / 贊助與支出 <span className="preview-label">付款尚未開放</span></div>
      <section className="donor-first" aria-label="贊助者名單"><SponsorshipDonorListPreview /></section>
      <SponsorshipInformation />
      <section className="support-entry" aria-label="贊助說明與入口">
        <Link className="support-entry-button" href="/sponsorship/support">前往填寫贊助 <span aria-hidden="true">→</span></Link>
        <p className="entry-note">選擇金額與公開設定。付款尚未開放，不會建立訂單或扣款。</p>

      <section className="intro">
        <div><p className="eyebrow">SUPPORT &amp; TRANSPARENCY</p><h1>讓這個練習空間，<br />繼續陪你準備國考。</h1><p className="lead">網站背後有主機、資料庫與持續維護的開銷。<br className="desktop" />在這裡查看歷史支出金額，再決定是否支持。</p><p className="free-service-note">醫師一階國考刷題與複習，原有功能維持免費。<br />贊助不提供額外功能、內容或權限。</p></div>
        <div className="intro-mark" aria-hidden="true"><Heart size={54} strokeWidth={1} /></div>
      </section>
      <div className="preview-note"><span className="dot" /><p>付款尚未開放，不會建立訂單或扣款；支出為截至 2026.10.17 已整理的歷史金額，不代表今日最新或全部可歸屬本站成本。</p></div>
      </section>
      <details className="ledger-accordion" id="expense-information">
        <summary><span><span className="eyebrow">OPEN LEDGER</span><span className="ledger-summary-title">網站支出帳目</span><span className="ledger-summary-note">歷史支出金額 · 展開／收合</span></span><span className="accordion-symbol" aria-hidden="true">＋</span></summary>
        <div className="ledger">
        <section aria-labelledby="expense-title">
          <div className="section-heading"><div><p className="eyebrow">OPEN LEDGER</p><h2 id="expense-title">網站支出紀錄</h2></div><span className="updated">歷史資料截至 {expenses.asOf.replaceAll("-", ".")}</span></div>
          <p className="section-description">台幣為歷史匯率估算，非信用卡實際扣款；不含海外交易費／銀行匯差。採臺灣銀行 2026.10.16 15:33 美元即期賣出匯率 32.43，原始美元金額另列。本版先列出金額，暫不提供憑證圖片或檔案；日期與服務期間分開顯示。</p>
          <p className="section-description"><a href="https://rate.bot.com.tw/xrt?Lang=zh-TW" target="_blank" rel="noopener noreferrer">臺灣銀行匯率來源 ↗</a></p>
          <div className="filters" role="group" aria-label="篩選供應商">{[["all", "全部"], ["Vercel", "Vercel 主機"], ["Supabase", "Supabase 資料庫"]].map(([value, label]) => <button key={value} className={`filter ${provider === value ? "active" : ""}`} aria-pressed={provider === value} onClick={() => setProvider(value)}>{label}</button>)}</div>
          <div aria-live="polite">{records.filter(r => provider === "all" || r.vendor === provider).map(r => <article key={`${r.vendor}-${r.date}`} className="expense">
            <div className="vendor-mark" aria-hidden="true">{r.vendor === "Vercel" ? "▲" : "ϟ"}</div>
            <div><h3>{r.vendor} · {r.vendor === "Vercel" ? "網站主機" : "資料庫"}</h3><p>{r.status === "paid" ? "付款" : "開立發票"}日期 {r.date}</p><p>方案期間 {r.period}</p>{"usagePeriod" in r && r.usagePeriod && <p>用量期間 {r.usagePeriod}</p>}<p>{r.detail}</p><p className="scope">{r.vendor === "Vercel" ? "團隊帳單 · 可能包含其他服務" : "組織帳單 · 可能包含其他服務"}</p></div>
            <div className="cost"><strong>{twd(r.amount)}</strong><small>{money(r.amount)}</small><span className="status">{r.status === "paid" ? "已付款" : "已付款 · 站長確認"}</span></div>
          </article>)}</div>
          <p className="ledger-foot">以上是目前已整理的歷史金額，不代表網站全部歷史支出。缺漏月份、未取得帳單及網站分攤金額，確認後再補入。</p>
        </section>
        <section className="disclosure" aria-labelledby="disclosure-title"><h2 id="disclosure-title">怎麼看這份帳目？</h2>
          <details open><summary>帳單金額不一定等於本網站成本</summary><p>Vercel 是團隊帳單，Supabase 是組織帳單，可能包含其他服務，不能直接當成這個網站的全部成本。</p></details>
          <details><summary>6 月 Supabase 的付款依據是什麼？</summary><p>2026 年 6 月 Supabase US$ 25.00 已由站長確認付款，納入合計。6 月 7 日為發票日期，沒有另填未取得的付款日期。此版不提供憑證檔案。</p></details>
        </section>
      </div></details>
      <footer>一階醫師國考刷題測驗 · 贊助與支出<br /><span>尚未啟用正式收款</span></footer>
    </main>
  );
}
