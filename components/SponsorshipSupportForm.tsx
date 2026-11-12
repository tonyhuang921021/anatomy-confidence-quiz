"use client";
import Link from "next/link";
import { useState } from "react";
import { parseSupportAmount } from "@/lib/sponsorship/support-policy.mjs";
import { SponsorshipDonorPreferences } from "@/components/SponsorshipDonorPreferences";

export function SponsorshipSupportForm() {
  const [amount, setAmount] = useState(100);
  const [custom, setCustom] = useState("");
  const [customActive, setCustomActive] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  // The owner confirmed NT$100 minimum. Provider limits remain a launch blocker.
  const previewAmount = customActive ? custom : String(amount);
  const parsedAmount = parseSupportAmount(previewAmount);
  const selectedAmount = parsedAmount ?? 0;
  const validAmount = parsedAmount !== null;

  return <main id="main-content" className="shell sponsorship-page support-page">
    <div className="breadcrumb"><Link href="/">首頁</Link> / <Link href="/sponsorship">贊助與支出</Link> / 填寫贊助 <span className="preview-label">付款尚未開放</span></div>
    <Link className="back form-back" href="/sponsorship">← 返回贊助說明與名單</Link>
    <div className="preview-note"><span className="dot" /><p>贊助完全自願。公開名稱與金額分別取得同意，預設均不公開。</p></div>
      <section className="support support-form" aria-labelledby="support-title"><p className="eyebrow">A LITTLE SUPPORT</p><h1 id="support-title">支持網站維運</h1><p>本贊助為自願、無償支持，款項僅用於本網站維護與營運相關支出，例如主機、資料庫及必要服務費用。</p>
        <fieldset><legend>選擇贊助金額（新台幣）</legend><div className="amounts">{[100, 300, 500].map(n => <button key={n} className={!customActive && amount === n ? "selected" : ""} aria-pressed={!customActive && amount === n} onClick={() => { setAmount(n); setCustom(""); setCustomActive(false); }}>NT$ {n}</button>)}</div><label htmlFor="sponsorship-amount">或輸入其他金額</label><div className="input-wrap"><span>NT$</span><input id="sponsorship-amount" type="text" inputMode="numeric" pattern="[0-9]*" placeholder="自訂金額" value={custom} aria-invalid={customActive && !validAmount} aria-describedby="amount-help amount-error" onChange={e => { setCustom(e.target.value); setCustomActive(true); }} /></div><small id="amount-help">每筆至少 NT$ 100，請輸入新台幣整數金額。</small>{customActive && !validAmount && <p id="amount-error" className="amount-error" role="status">請輸入至少 NT$ 100 的整數金額。</p>}</fieldset>
        <SponsorshipDonorPreferences amount={parsedAmount} />
        <div className="terms-consent"><label htmlFor="sponsorship-terms"><input id="sponsorship-terms" type="checkbox" required checked={termsAccepted} onChange={event => setTermsAccepted(event.target.checked)} aria-describedby="terms-consent-help" /><span>我已閱讀並同意贊助條款、隱私政策與退款政策</span></label><p id="terms-consent-help"><Link href="/sponsorship/terms" target="_blank" rel="noopener noreferrer">閱讀完整條款（另開分頁）</Link>。此同意不包含公開名稱或金額，公開項目請另行選擇。</p></div>
        <button className="checkout" disabled>付款尚未開放</button><p className="safe-note">本網站不收集信用卡資料</p><details className="fees-note"><summary>金流手續費與入帳說明</summary><p>收款費率（含稅）為國內信用卡 3%、國外信用卡 4%；超商代碼每筆 NT$ 38。這些是金流向網站收取的費用，不另加在贊助金額上。</p><p>以 NT$ 100 示意：國內卡扣除收款手續費後約為 NT$ 97，國外卡約為 NT$ 96；未計其他可能費用。上述 3%／4% 是收款費率，不是向贊助者收取的退款費率。</p></details><hr /><p className="small" aria-live="polite">選擇中的金額：<strong>{validAmount ? `NT$ ${selectedAmount.toLocaleString("en-US")}` : "請輸入有效金額"}</strong></p><Link className="back" href="/sponsorship">← 返回贊助說明與名單</Link>
      </section>
    <footer>一階醫師國考刷題測驗 · 填寫贊助<br /><span>付款尚未開放</span></footer>
  </main>;
}
