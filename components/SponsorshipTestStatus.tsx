import type { SandboxOrderStatus, SandboxReconciliation } from "@/lib/sponsorship/sandbox-ui.mjs";

export function SponsorshipTestStatus({ order, reconciliation }: {
  order: SandboxOrderStatus | null;
  reconciliation: SandboxReconciliation | null;
}) {
  const needsReview = order?.needsReview === true || reconciliation?.needsReview === true;
  return <div className="sandbox-status" aria-live="polite" aria-atomic="true">
    {needsReview && <div className="sandbox-notice sandbox-review" role="alert">
      <strong>需要人工檢查 · needsReview</strong>
      <p>核對資料出現不一致。請勿再次付款，並將訂單編號交給站長。此結果不會列為已付款。</p>
    </div>}
    {order && <section className={`sandbox-result ${order.status === "verified_paid" && !needsReview ? "is-verified" : ""}`} aria-label="伺服器訂單狀態">
      <p className="sandbox-eyebrow">SERVER-VERIFIED · TEST ONLY</p>
      <h3>{needsReview ? "待人工檢查" : order.status === "verified_paid" ? "已核實測試付款" : "尚未核實付款"}</h3>
      <dl>
        <div><dt>測試訂單</dt><dd>{order.orderId}</dd></div>
        <div><dt>測試金額</dt><dd>NT$ {order.amount.toLocaleString("zh-TW")}</dd></div>
        <div><dt>環境</dt><dd>OEN TEST · 非正式收款</dd></div>
        {order.status === "verified_paid" && !needsReview && <div><dt>核實時間</dt><dd>{order.verifiedPaidAt}</dd></div>}
      </dl>
      <p>{order.status === "verified_paid" && !needsReview ? "這個狀態來自伺服器核對的測試交易，不代表正式贊助收入。" : "回到本網站、金流通知或網址參數，都不會直接當成付款成功。"}</p>
    </section>}
    {reconciliation && !needsReview && <p className="sandbox-help">{reconciliation.verification === "no_transaction" ? "本次尚未找到對應測試交易，請稍後查詢；請勿因此再次付款。" : reconciliation.verification === "not_verified_paid" ? "本次核對仍未確認付款，請稍後再查詢。" : "這筆測試訂單已完成伺服器核對。"}</p>}
  </div>;
}
