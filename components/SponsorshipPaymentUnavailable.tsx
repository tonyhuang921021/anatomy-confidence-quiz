import Link from "next/link";
export function SponsorshipPaymentUnavailable() {
  return <main id="main-content" className="shell sponsorship-page"><h1>付款尚未開放</h1><p>目前不會建立贊助訂單或扣款。返回本網站不代表付款成功。</p><Link className="back" href="/sponsorship">← 返回贊助與支出</Link></main>;
}
