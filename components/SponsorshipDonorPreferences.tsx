"use client";

import { useId, useState } from "react";
import { normalizeDonorDisplayName, normalizeDonorPreferences, MAX_DISPLAY_NAME_CODEPOINTS } from "@/lib/sponsorship/donor-projection.mjs";
import type { SandboxDonorPreferenceInput } from "@/lib/sponsorship/sandbox-ui.mjs";

type Preferences = { displayName: string | null; publishDisplayName: boolean; publishAmount: boolean };

/** A private, unsaved display preview. It never represents a donor-list record. */
export function SponsorshipDonorDraft({ preferences, amount, invalid, submitted = false }: {
  preferences: Preferences; amount: number | null; invalid: boolean; submitted?: boolean;
}) {
  const visible = preferences.publishDisplayName || preferences.publishAmount;
  return <div className="donor-draft" aria-live="polite" aria-atomic="true">
    <p className="donor-draft-label">{submitted ? "本次請求的顯示選擇 · 尚未收到儲存結果" : "你的顯示預覽 · 尚未送出"}</p>
    {invalid ? <p>請先確認名稱與金額，才能預覽顯示方式。</p> : visible ? <div className="donor-draft-entry">
      <strong>{preferences.publishDisplayName ? preferences.displayName : "匿名支持者"}</strong>
      <span>{preferences.publishAmount && amount !== null ? `NT$ ${amount.toLocaleString("zh-TW")}` : "金額不公開"}</span>
    </div> : <p>不列入公開名單</p>}
    <small>這是你目前的選擇，不是已完成的贊助紀錄。</small>
  </div>;
}

export function SponsorshipDonorPreferences({ amount, disabled = false, testOnly = false, saveWithCheckout = false, submitted = false, onChange }: {
  amount: number | null; disabled?: boolean; testOnly?: boolean; saveWithCheckout?: boolean; submitted?: boolean;
  onChange?: (preferences: SandboxDonorPreferenceInput | null) => void;
}) {
  const id = useId();
  const [anonymous, setAnonymous] = useState(true);
  const [displayName, setDisplayName] = useState("");
  const [publishDisplayName, setPublishDisplayName] = useState(false);
  const [publishAmount, setPublishAmount] = useState(false);
  let normalizedName = "";
  let nameInvalid = false;
  try { normalizedName = normalizeDonorDisplayName(displayName); }
  catch { nameInvalid = true; }
  const visibleName = !anonymous && publishDisplayName;
  let preferences: Preferences = { displayName: null, publishDisplayName: false, publishAmount };
  let invalid = visibleName && (nameInvalid || !normalizedName);
  if (!invalid) {
    try { preferences = normalizeDonorPreferences({ displayName: visibleName ? displayName : "", publishDisplayName: visibleName, publishAmount }); }
    catch { invalid = true; }
  }
  if (publishAmount && amount === null) invalid = true;

  function update(next: { anonymous: boolean; displayName: string; publishDisplayName: boolean; publishAmount: boolean }) {
    if (disabled) return;
    setAnonymous(next.anonymous); setDisplayName(next.displayName);
    setPublishDisplayName(next.publishDisplayName); setPublishAmount(next.publishAmount);
    try {
      const shareName = !next.anonymous && next.publishDisplayName;
      const normalized = normalizeDonorPreferences({ displayName: shareName ? next.displayName : "", publishDisplayName: shareName, publishAmount: next.publishAmount });
      onChange?.({ ...normalized, displayName: normalized.displayName ?? "" });
    } catch { onChange?.(null); }
  }
  const draft = { anonymous, displayName, publishDisplayName, publishAmount };
  function chooseAnonymous(value: boolean) {
    update({ ...draft, anonymous: value, ...(value ? { displayName: "", publishDisplayName: false } : {}) });
  }

  return <section className="donor-preferences" aria-labelledby={`${id}-heading`}>
    <div className="donor-preferences-heading"><h3 id={`${id}-heading`}>你想怎麼被看見？</h3><span>{saveWithCheckout ? "建立訂單時儲存" : "設定預覽"}</span></div>
    <p className="donor-preferences-note">公開名稱與金額分開決定，預設都不公開。兩項都未勾選時，這筆贊助不會出現在公開名單。</p>
    <fieldset className="donor-identity" disabled={disabled}>
      <legend>顯示身分</legend>
      <label><input type="radio" name={`${id}-identity`} checked={anonymous} onChange={() => chooseAnonymous(true)} />匿名</label>
      <label><input type="radio" name={`${id}-identity`} checked={!anonymous} onChange={() => chooseAnonymous(false)} />自訂顯示名稱</label>
    </fieldset>
    {!anonymous && <div className="donor-name-field">
      <label htmlFor={`${id}-name`}>顯示名稱</label>
      <input id={`${id}-name`} type="text" value={displayName} onChange={(event) => update({ ...draft, displayName: event.target.value })} maxLength={MAX_DISPLAY_NAME_CODEPOINTS * 2} autoComplete="off" spellCheck={false} disabled={disabled} placeholder="可用暱稱，不必填真實姓名" aria-invalid={nameInvalid} aria-describedby={`${id}-name-help`} />
      <small id={`${id}-name-help`}>{nameInvalid ? "最多 40 個字元；請移除換行與不可見的控制字元。" : `${Array.from(normalizedName).length} / 40 個字元 · 以純文字顯示，不會帶入帳號姓名或 Email`}</small>
    </div>}
    <fieldset className="donor-consents" disabled={disabled}>
      <legend>個別選擇公開項目</legend>
      <label><input type="checkbox" checked={visibleName} onChange={(event) => update({ ...draft, publishDisplayName: event.target.checked })} disabled={anonymous || (!publishDisplayName && (nameInvalid || !normalizedName))} /><span>我同意在公開贊助者名單顯示上方名稱</span></label>
      <label><input type="checkbox" checked={publishAmount} onChange={(event) => update({ ...draft, publishAmount: event.target.checked })} /><span>我另外同意公開這筆贊助金額</span></label>
    </fieldset>
    <SponsorshipDonorDraft preferences={preferences} amount={amount} invalid={invalid} submitted={submitted} />
    <p className="donor-preferences-note">{testOnly ? "非正式付款不會列入公開贊助名單或收入。" : "公開名單僅列入已核實、且經本人同意公開的正式贊助。"}</p>
    <p className="donor-preview-only">{submitted ? "這些選擇已隨本次請求送出，是否已儲存以伺服器回覆為準。重試只會重送同一筆請求，請勿另建付款。" : saveWithCheckout ? "目前尚未儲存。建立訂單時會一併儲存這些選擇；可在自己的訂單中分別撤回名稱或金額公開同意。非正式付款的選擇不會用於公開名單。" : "公開設定預覽，尚未儲存。目前只在本頁預覽，不會送出或公開。重新整理頁面後會恢復預設。"}</p>
  </section>;
}
