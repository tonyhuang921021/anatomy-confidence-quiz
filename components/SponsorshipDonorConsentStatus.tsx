"use client";

import type { SandboxDonorPreferences } from "@/lib/sponsorship/sandbox-ui.mjs";

/** Only accepts a profile confirmed by the authenticated owner-order response. */
export function SponsorshipDonorConsentStatus({ preferences, enabled = false, busy = false, withdrawing = false, message = "", onWithdraw }: {
  preferences: SandboxDonorPreferences | null; enabled?: boolean; busy?: boolean; withdrawing?: boolean; message?: string;
  onWithdraw?: (field: "name" | "amount") => void;
}) {
  return <section className="donor-saved" aria-label="此訂單的公開同意設定">
    <h3>此訂單的公開同意設定</h3>
    {!preferences ? <p>尚未取得已儲存的公開設定；請查詢訂單狀態確認。未取得設定不代表已同意公開。</p> : <>
      <p className="donor-saved-label">伺服器已確認儲存 · 版本 {preferences.revision}</p>
      <dl>
        <div><dt>顯示名稱</dt><dd>{preferences.publishDisplayName ? preferences.displayName : "匿名 · 名稱不公開"}</dd></div>
        <div><dt>金額公開同意</dt><dd>{preferences.publishAmount ? "已同意" : "未同意公開"}</dd></div>
      </dl>
      {!preferences.publishDisplayName && !preferences.publishAmount && <p>兩項均未同意，不列入公開名單。</p>}
      {onWithdraw && (preferences.publishDisplayName || preferences.publishAmount) && <div className="donor-withdraw-actions">
        {preferences.publishDisplayName && <button className="sandbox-secondary" type="button" disabled={!enabled || busy} onClick={() => onWithdraw("name")}>撤回名稱公開同意</button>}
        {preferences.publishAmount && <button className="sandbox-secondary" type="button" disabled={!enabled || busy} onClick={() => onWithdraw("amount")}>撤回金額公開同意</button>}
      </div>}
      {onWithdraw && !enabled && (preferences.publishDisplayName || preferences.publishAmount) && <p>此環境的公開設定管理尚未啟用，請聯絡站長。</p>}
      {withdrawing && <p role="status">正在儲存撤回設定…</p>}
    </>}
    {message && <p role="status">{message}</p>}
    <p className="donor-saved-note">TEST 訂單不會出現在正式公開名單，也不計入正式贊助收入。撤回公開同意不會變更付款狀態或退款。</p>
  </section>;
}
