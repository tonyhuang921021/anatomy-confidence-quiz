"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { SponsorshipTestStatus } from "@/components/SponsorshipTestStatus";
import { SponsorshipDonorPreferences } from "@/components/SponsorshipDonorPreferences";
import { SponsorshipDonorListPreview } from "@/components/SponsorshipDonorListPreview";
import { SponsorshipDonorConsentStatus } from "@/components/SponsorshipDonorConsentStatus";
import { createSandboxAutoReconciler, type SandboxAutoReconciler, type SandboxAutoReconcileState, type SandboxAutoReconcileOutcome } from "@/lib/sponsorship/sandbox-auto-reconcile.mjs";
import {
  parseSandboxAmount, parseSandboxCheckout, parseSandboxOrderId, parseSandboxOrderStatus,
  parseSandboxPublicConfig, parseSandboxReconciliation, parseSandboxDonorConsent, sandboxErrorMessage,
  type SandboxOrderStatus, type SandboxPublicConfig, type SandboxReconciliation, type SandboxDonorPreferenceInput, type SandboxDonorPreferences,
} from "@/lib/sponsorship/sandbox-ui.mjs";

type Session = { accessToken: string; expiresAt: number };
type Action = "login" | "checkout" | "status" | "reconcile" | "auto-reconcile" | "withdraw";
type Props = { mode?: "test" | "return" | "failure"; initialOrderId?: string | null };
class RequestFailure extends Error {
  constructor(public code: string, public status = 0) { super(code); }
}

async function apiRequest(path: string, signal: AbortSignal, token?: string, body?: object) {
  const response = await fetch(path, {
    method: body ? "POST" : "GET", signal: AbortSignal.any([signal, AbortSignal.timeout(35000)]), cache: "no-store", redirect: "error",
    credentials: "same-origin", referrerPolicy: "no-referrer",
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  return { response, data };
}

export function SponsorshipTestPanel({ mode = "test", initialOrderId = null }: Props) {
  const [config, setConfig] = useState<SandboxPublicConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [busy, setBusy] = useState<Action | null>(null);
  const [error, setError] = useState("");
  const [amount, setAmount] = useState("100");
  const [acknowledged, setAcknowledged] = useState(false);
  const [orderInput, setOrderInput] = useState(initialOrderId ?? "");
  const [order, setOrder] = useState<SandboxOrderStatus | null>(null);
  const [checkout, setCheckout] = useState<{ orderId: string; checkoutUrl: string | null; donorPreferences?: SandboxDonorPreferences | null } | null>(null);
  const [reconciliation, setReconciliation] = useState<SandboxReconciliation | null>(null);
  const [attempt, setAttempt] = useState<{ requestKey: string; amount: number; donorPreferences?: SandboxDonorPreferenceInput } | null>(null);
  const [donorDraft, setDonorDraft] = useState<SandboxDonorPreferenceInput | null>({ displayName: "", publishDisplayName: false, publishAmount: false });
  const [consentMessage, setConsentMessage] = useState("");
  const [autoOrderId, setAutoOrderId] = useState<string | null>(null);
  const [autoState, setAutoState] = useState<SandboxAutoReconcileState>("stopped");
  const request = useRef<{ id: number; controller: AbortController } | null>(null);
  const generation = useRef(0);
  const loginForm = useRef<HTMLFormElement>(null);
  const reviewWarnings = useRef(new Map<string, SandboxReconciliation>());
  const savedConsents = useRef(new Map<string, SandboxDonorPreferences>());
  const automatic = useRef<SandboxAutoReconciler | null>(null);
  const autoRun = useRef<(orderId: string) => Promise<SandboxAutoReconcileOutcome>>(async () => "blocked");
  autoRun.current = (orderId) => reconcileOrder(true, orderId);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    void apiRequest("/api/sponsorship/test-config", controller.signal).then(({ response, data }) => {
      if (!active) return;
      const parsed = response.ok ? parseSandboxPublicConfig(data) : null;
      if (parsed) setConfig(parsed);
      else setError(sandboxErrorMessage(typeof data?.code === "string" ? data.code : "SANDBOX_UNAVAILABLE"));
    }).catch(() => { if (active) setError("目前無法載入測試設定，測試登入與付款保持關閉。"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); request.current?.controller.abort(); generation.current++; };
  }, []);

  function clearSession(message = "") {
    generation.current++;
    request.current?.controller.abort(); request.current = null;
    setSession(null); setBusy(null); setOrder(null); setReconciliation(null); setCheckout(null);
    setAttempt(null); setAcknowledged(false); setError(message);
    setDonorDraft({ displayName: "", publishDisplayName: false, publishAmount: false }); setConsentMessage("");
    automatic.current?.cancel(); setAutoOrderId(null); setAutoState("stopped");
    reviewWarnings.current.clear();
    savedConsents.current.clear();
    loginForm.current?.reset();
  }

  useEffect(() => {
    if (!session) return;
    const timer = window.setTimeout(() => clearSession("測試登入已到期，請重新登入。"), Math.max(0, session.expiresAt - Date.now()));
    return () => window.clearTimeout(timer);
    // Session lifetime is fixed; there is no refresh token or persistent login.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  useEffect(() => {
    if (!autoOrderId || !session || !config?.checkoutEnabled) return;
    const loop = createSandboxAutoReconciler({ run: () => autoRun.current(autoOrderId), onState: setAutoState,
      setTimer: (callback, delay) => window.setTimeout(callback, delay), clearTimer: (timer) => window.clearTimeout(timer) });
    automatic.current = loop;
    const resume = () => { if (document.visibilityState === "hidden") loop.pause(); else loop.resume(); };
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", resume);
    resume();
    return () => { loop.cancel(); window.removeEventListener("focus", resume); document.removeEventListener("visibilitychange", resume); if (automatic.current === loop) automatic.current = null; };
    // A stable per-order/session budget; renders and focus never reset the attempt count.
  }, [autoOrderId, session, config?.checkoutEnabled]);

  function begin(action: Action) {
    if (request.current) return null;
    const task = { id: ++generation.current, controller: new AbortController() };
    request.current = task; setBusy(action); setError("");
    return task;
  }
  const current = (task: { id: number }) => generation.current === task.id;
  function finish(task: { id: number }) {
    if (current(task)) { request.current = null; setBusy(null); }
  }
  function failed(error: unknown, task: { id: number }) {
    if (!current(task)) return;
    const code = error instanceof RequestFailure ? error.code : "SANDBOX_UNAVAILABLE";
    if (error instanceof RequestFailure && [401, 403].includes(error.status)) clearSession(sandboxErrorMessage(code));
    else setError(sandboxErrorMessage(code));
  }
  async function fetchStatus(orderId: string, token: string, signal: AbortSignal) {
    const { response, data } = await apiRequest(`/api/sponsorship/status?orderId=${encodeURIComponent(orderId)}`, signal, token);
    if (!response.ok) throw new RequestFailure(data?.code, response.status);
    const status = parseSandboxOrderStatus(data, orderId);
    if (!status) throw new RequestFailure("INVALID_STATUS");
    return status;
  }
  function acceptStatus(status: SandboxOrderStatus) {
    const previous = savedConsents.current.get(status.orderId);
    const preferences = status.donorPreferences;
    if (preferences && (!previous || preferences.revision > previous.revision)) savedConsents.current.set(status.orderId, preferences);
    setOrder({ ...status, donorPreferences: savedConsents.current.get(status.orderId) ?? preferences });
    // A later unknown/null review flag must not erase an earlier in-session warning.
    if (status.status === "verified_paid" && status.needsReview === false) reviewWarnings.current.delete(status.orderId);
    setReconciliation(reviewWarnings.current.get(status.orderId) ?? null);
    if (status.status === "verified_paid" || status.needsReview === true) setCheckout(null);
    if (status.orderId === autoOrderId && (status.status === "verified_paid" || status.needsReview === true || reviewWarnings.current.has(status.orderId))) automatic.current?.stop();
  }

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!config) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    const email = String(fields.get("email") ?? "").trim();
    const password = String(fields.get("password") ?? "");
    if (!email || !password) return;
    const task = begin("login"); if (!task) return;
    const passwordField = form.elements.namedItem("password");
    if (passwordField instanceof HTMLInputElement) passwordField.value = "";
    try {
      const { createClient } = await import("@supabase/supabase-js");
      if (!current(task)) return;
      // A fresh, isolated, memory-only client. Never import the quiz AuthProvider/client.
      const auth = createClient(config.supabaseUrl, config.publishableKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: "oen-test-memory-only" },
        global: { fetch: (input, init = {}) => {
          const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
          if (url.origin !== config.supabaseUrl || !url.pathname.startsWith("/auth/v1/")) throw new Error("AUTH_TARGET_DENIED");
          return fetch(input, { ...init, signal: AbortSignal.any([task.controller.signal, AbortSignal.timeout(12000)]), credentials: "omit", cache: "no-store", redirect: "error", referrerPolicy: "no-referrer" });
        } },
      }).auth;
      const result = await auth.signInWithPassword({ email, password }).finally(() => auth.stopAutoRefresh());
      if (!current(task)) return;
      if (result.error || !result.data.session?.access_token || !result.data.session.expires_at) {
        throw new RequestFailure("AUTHENTICATION_REQUIRED");
      }
      const accessToken = result.data.session.access_token;
      const expiresAt = result.data.session.expires_at * 1000;
      if (!Number.isFinite(expiresAt) || expiresAt <= Date.now() || expiresAt - Date.now() > 86400000) throw new RequestFailure("AUTHENTICATION_REQUIRED");
      const { response, data } = await apiRequest("/api/sponsorship/test-session", task.controller.signal, accessToken, {});
      if (!response.ok) throw new RequestFailure(data?.code, response.status);
      if (data?.environment !== "sandbox" || data.authenticated !== true) throw new RequestFailure("ACCESS_DENIED");
      if (!current(task)) return;
      setSession({ accessToken, expiresAt });
      form.reset();
      const orderId = parseSandboxOrderId(orderInput);
      if (orderId) {
        const status = await fetchStatus(orderId, accessToken, task.controller.signal);
        if (current(task)) { acceptStatus(status); if (mode !== "test" && status.status === "pending" && status.needsReview !== true) setAutoOrderId(orderId); }
      }
    } catch (error) { failed(error, task); }
    finally { finish(task); }
  }

  async function checkStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const orderId = parseSandboxOrderId(orderInput);
    if (!session || !orderId) { setError("請輸入完整的 preview_ 測試訂單編號。"); return; }
    const task = begin("status"); if (!task) return;
    setOrder(null); setConsentMessage("");
    try { const status = await fetchStatus(orderId, session.accessToken, task.controller.signal); if (current(task)) { acceptStatus(status); if (mode !== "test" && status.status === "pending" && status.needsReview !== true && !reviewWarnings.current.has(orderId)) setAutoOrderId(orderId); } }
    catch (error) { failed(error, task); }
    finally { finish(task); }
  }

  async function withdrawConsent(field: "name" | "amount") {
    if (!config?.donorPreferencesEnabled || !session || !order?.donorPreferences) return;
    const before = order.donorPreferences;
    if (field === "name" ? !before.publishDisplayName : !before.publishAmount) return;
    const task = begin("withdraw"); if (!task) return;
    setConsentMessage("");
    try {
      const { response, data } = await apiRequest("/api/sponsorship/donor-consent", task.controller.signal, session.accessToken, { orderId: order.orderId, withdrawDisplayName: field === "name", withdrawAmount: field === "amount" });
      if (!response.ok) throw new RequestFailure(data?.code, response.status);
      const result = parseSandboxDonorConsent(data, order.orderId);
      const saved = result?.donorPreferences;
      if (!saved || saved.revision < before.revision || (!before.publishDisplayName && saved.publishDisplayName) || (!before.publishAmount && saved.publishAmount) || (saved.publishDisplayName && saved.displayName !== before.displayName) || (field === "name" ? saved.publishDisplayName : saved.publishAmount)) throw new RequestFailure("INVALID_DONOR_CONSENT");
      if (!current(task)) return;
      savedConsents.current.set(order.orderId, saved);
      setOrder({ ...order, donorPreferences: saved });
      if (checkout?.orderId === order.orderId) setCheckout({ ...checkout, donorPreferences: saved });
      setConsentMessage(field === "name" ? "名稱公開同意已撤回，伺服器已確認儲存。" : "金額公開同意已撤回，伺服器已確認儲存。");
    } catch (error) {
      if (!current(task)) return;
      if (error instanceof RequestFailure && [401, 403].includes(error.status)) failed(error, task);
      else setConsentMessage("尚無法確認撤回是否儲存。請重新查詢訂單後再試；不會重新付款。");
    } finally { finish(task); }
  }

  async function reconcileOrder(isAutomatic = false, expectedOrderId?: string): Promise<SandboxAutoReconcileOutcome> {
    const targetOrderId = expectedOrderId ?? order?.orderId;
    if (!config?.checkoutEnabled || !session || !targetOrderId || session.expiresAt <= Date.now()) return "blocked";
    if (order?.orderId === targetOrderId && order.status === "verified_paid") return "terminal";
    if (isAutomatic && ((order?.orderId === targetOrderId && order.needsReview === true) || reviewWarnings.current.has(targetOrderId))) return "terminal";
    const task = begin(isAutomatic ? "auto-reconcile" : "reconcile"); if (!task) return "busy";
    try {
      const { response, data } = await apiRequest("/api/sponsorship/reconcile", task.controller.signal, session.accessToken, { orderId: targetOrderId });
      if (!response.ok && !(response.status === 409 && data?.code === "REVIEW_REQUIRED")) throw new RequestFailure(data?.code, response.status);
      const result = parseSandboxReconciliation(data, targetOrderId);
      if (!result) throw new RequestFailure("INVALID_RECONCILIATION");
      if (!current(task)) return "blocked";
      if (result.needsReview) reviewWarnings.current.set(result.order.orderId, result);
      if (result.order.status === "verified_paid") reviewWarnings.current.delete(result.order.orderId);
      acceptStatus(result.order); setReconciliation(reviewWarnings.current.get(result.order.orderId) ?? result);
      if (result.needsReview || result.order.status === "verified_paid") setCheckout(null);
      return result.needsReview || result.order.status === "verified_paid" ? "terminal" : "pending";
    } catch (error) {
      failed(error, task);
      return error instanceof RequestFailure && ([401, 403, 404].includes(error.status) || error.code === "PREVIEW_CHECKOUT_DISABLED") ? "blocked" : "pending";
    }
    finally { finish(task); }
  }

  async function createCheckout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = parseSandboxAmount(amount);
    if (!config?.checkoutEnabled || !config.donorPreferencesEnabled || !session || !acknowledged || !value || checkout || mode !== "test" || !donorDraft) return;
    const task = begin("checkout"); if (!task) return;
    try {
      const nextAttempt = attempt ?? { requestKey: `test_${crypto.randomUUID().replaceAll("-", "")}`, amount: value, donorPreferences: { ...donorDraft } };
      setAttempt(nextAttempt);
      const { response, data } = await apiRequest("/api/sponsorship/checkout", task.controller.signal, session.accessToken, nextAttempt);
      if (!current(task)) return;
      const capturedOrder = parseSandboxOrderId(data?.orderId);
      if (capturedOrder) { setOrderInput(capturedOrder); setCheckout({ orderId: capturedOrder, checkoutUrl: null }); if (data?.checkoutUrl === undefined) setAutoOrderId(capturedOrder); }
      if (!response.ok) throw new RequestFailure(data?.code, response.status);
      const result = parseSandboxCheckout(data);
      if (!result) throw new RequestFailure("INVALID_CHECKOUT");
      setCheckout({ orderId: result.orderId, checkoutUrl: result.checkoutUrl, donorPreferences: result.donorPreferences });
      if (result.donorPreferences) savedConsents.current.set(result.orderId, result.donorPreferences);
      setOrderInput(result.orderId); setReconciliation(null);
      if (result.status) acceptStatus(result.status);
    } catch (error) { failed(error, task); }
    finally { finish(task); }
  }

  const validOrder = parseSandboxOrderId(orderInput);
  const title = mode === "return" ? "已返回網站，等待核對" : mode === "failure" ? "測試付款流程未完成" : "受控金流測試";
  return <main id="main-content" className="shell sandbox-page">
    <div className="sandbox-breadcrumb"><Link href="/sponsorship">贊助與支出</Link><span aria-hidden="true"> / </span><span>OEN TEST</span></div>
    <header className="sandbox-header"><div><p className="sandbox-eyebrow">CONTROLLED PREVIEW</p><h1>{title}</h1><p className="sandbox-lead">僅限已獲准的測試帳號。正式贊助付款仍未開放。</p></div><span className="sandbox-badge">TEST ONLY</span></header>
    <div className="sandbox-notice">
      <strong>回跳網址不代表付款成功</strong>
      <p>{mode === "failure" ? "金流流程可能取消、中斷或失敗；網址上的錯誤訊息不會被當成交易結論。請登入原帳號查詢，再決定下一步。" : "付款結果只採用伺服器核對的訂單狀態。請勿輸入真實卡號，也不要因回跳或逾時就重複建立付款。"}</p>
    </div>
    {loading && <p role="status">正在確認此環境的測試權限…</p>}
    {config && !config.checkoutEnabled && <div className="sandbox-notice" role="status">登入與狀態查詢已開放，建立付款尚未啟用<p>OEN TEST 付款與後端核對已完成驗證。新版公開設定仍待儲存功能啟用，目前保留登入與已存訂單查詢，暫停建立及核對新交易。</p></div>}
    {error && <div className="sandbox-notice sandbox-error" role="alert">{error}</div>}
    {!loading && !config && <section className="sandbox-card"><h2>測試入口尚未啟用</h2><p>此頁保持關閉，直到站長完成受保護 Preview 的設定與啟用。</p><button type="button" disabled>測試登入未開放</button></section>}
    {config && !session && <section className="sandbox-card sandbox-login"><p className="sandbox-eyebrow">EXISTING TESTER ACCOUNT</p><h2>測試者登入</h2>
      <p>請使用既有的網站帳號。登入後仍會由伺服器確認測試名單；此處不提供註冊、重設密碼或寄信。</p>
      {(mode !== "test" || initialOrderId) && <p className="sandbox-help">測試登入只保留在本頁記憶體。從 OEN 返回或重新整理後，需要重新登入。</p>}
      <form ref={loginForm} onSubmit={signIn} autoComplete="off">
        <label htmlFor="sandbox-email">Email</label><input id="sandbox-email" name="email" type="email" autoComplete="off" required maxLength={254} disabled={Boolean(busy)} spellCheck={false} autoCapitalize="none" />
        <label htmlFor="sandbox-password">密碼</label><input id="sandbox-password" name="password" type="password" autoComplete="off" required maxLength={1024} disabled={Boolean(busy)} />
        <p className="sandbox-help">登入資訊送至既有 Supabase 身分驗證服務。本測試頁不儲存密碼或登入憑證，也不會登入刷題主頁。</p>
        <button type="submit" disabled={Boolean(busy)}>{busy === "login" ? "登入與確認權限中…" : "登入測試區"}</button>
        {busy === "login" && <button type="button" className="sandbox-secondary" onClick={() => clearSession()}>取消登入</button>}
      </form>
    </section>}
    {session && <>
      <div className="sandbox-session"><span>已通過測試名單驗證 · 僅本頁有效</span><button type="button" className="sandbox-secondary" onClick={() => clearSession()}>結束測試登入</button></div>
      <div className={`sandbox-grid ${mode !== "test" ? "sandbox-single" : ""}`}>
        <section className="sandbox-card"><p className="sandbox-eyebrow">YOUR TEST ORDER</p><h2>查詢自己的測試訂單</h2>
          <p>只會顯示目前登入帳號持有的訂單。</p>
          <form onSubmit={checkStatus}><label htmlFor="sandbox-order">測試訂單編號</label><input id="sandbox-order" value={orderInput} onChange={(event) => { automatic.current?.cancel(); setAutoOrderId(null); setAutoState("stopped"); setOrderInput(event.target.value); setOrder(null); setReconciliation(null); setConsentMessage(""); }} maxLength={72} placeholder="preview_…" autoComplete="off" spellCheck={false} disabled={Boolean(busy)} aria-describedby="sandbox-order-help" />
            <p id="sandbox-order-help" className="sandbox-help">{mode === "failure" && !initialOrderId ? "失敗返回頁不一定帶有訂單編號。請貼上建立測試時顯示的編號；不要重新建立付款。" : "完整編號以 preview_ 開頭。此編號不是付款成功證明。"}</p>
            <button type="submit" disabled={Boolean(busy) || !validOrder}>{busy === "status" ? "查詢中…" : "查詢伺服器狀態"}</button>
          </form>
          <SponsorshipTestStatus order={order} reconciliation={reconciliation} />
          {autoOrderId && config?.checkoutEnabled && autoState !== "stopped" && <p className="sandbox-help" role="status">{autoState === "exhausted" ? "自動核對已暫停。這不代表付款失敗；可查詢狀態或使用手動核對，請勿重新付款。" : autoState === "paused" ? "返回此頁後會繼續核對，最多自動嘗試 5 次。" : autoState === "running" ? "正在向 OEN TEST 自動核對既有訂單…" : "將自動核對既有訂單，最多 5 次；不會建立新的付款。"}</p>}
          {order && order.status !== "verified_paid" && <button type="button" className="sandbox-secondary" disabled={!config?.checkoutEnabled || Boolean(busy)} onClick={() => reconcileOrder()}>{!config?.checkoutEnabled ? "手動核對尚未啟用" : busy === "reconcile" || busy === "auto-reconcile" ? "向 OEN TEST 核對中…" : "手動核對這筆測試訂單"}</button>}
          {order && order.status !== "verified_paid" && <p className="sandbox-help">{config?.checkoutEnabled ? "手動核對只查驗既有測試交易，不會建立新的付款。" : "目前可讀取已儲存的訂單狀態；不會啟動交易核對或更改付款狀態。"}</p>}
          {order && <SponsorshipDonorConsentStatus preferences={order.donorPreferences} enabled={config?.donorPreferencesEnabled} busy={Boolean(busy)} withdrawing={busy === "withdraw"} message={consentMessage} onWithdraw={withdrawConsent} />}
        </section>
        {mode === "test" && <section className="sandbox-card"><p className="sandbox-eyebrow">NEW SANDBOX CHECKOUT</p><h2>建立一筆 TEST 付款</h2><p>僅前往 sinjmed.testing.oen.tw 測試結帳頁。</p>
          <form onSubmit={createCheckout}><label htmlFor="sandbox-amount">自訂測試金額（新台幣整數）</label><input id="sandbox-amount" type="number" inputMode="numeric" min={1} max={100000} step={1} value={amount} onChange={(event) => setAmount(event.target.value)} disabled={Boolean(busy) || Boolean(attempt)} aria-invalid={parseSandboxAmount(amount) === null} aria-describedby="sandbox-amount-help" /><p id="sandbox-amount-help" className="sandbox-help">NT$ 1–100,000，只接受整數；不接受小數或科學記號。</p>
            {!checkout && <SponsorshipDonorPreferences amount={parseSandboxAmount(amount)} disabled={Boolean(busy) || Boolean(attempt)} testOnly saveWithCheckout={Boolean(config?.donorPreferencesEnabled)} submitted={Boolean(attempt)} onChange={setDonorDraft} />}
            <label className="sandbox-check"><input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} disabled={!config?.checkoutEnabled || Boolean(busy) || Boolean(attempt)} /><span>我確認這是受控 TEST 測試，只使用核准的測試資料，不輸入真實卡號</span></label>
            <button type="submit" disabled={!config?.checkoutEnabled || !config.donorPreferencesEnabled || Boolean(busy) || Boolean(checkout) || Boolean(order?.status === "verified_paid") || !acknowledged || !parseSandboxAmount(amount) || !donorDraft}>{!config?.checkoutEnabled || !config.donorPreferencesEnabled ? "建立付款尚未啟用" : busy === "checkout" ? "建立測試訂單中…" : attempt && !checkout ? "重試同一筆測試請求" : checkout ? "已建立測試訂單" : "建立 TEST 結帳連結"}</button>
          </form>
          {attempt && !checkout && <p className="sandbox-help">若網路中斷，重試會使用同一筆請求與金額。請保留本頁，避免重新整理後另建付款。</p>}
          {checkout && <div className="sandbox-checkout"><p>測試訂單編號</p><strong>{checkout.orderId}</strong><p className="sandbox-help">請先保存編號。返回網站後需重新登入查詢。</p>
            {config?.donorPreferencesEnabled && order?.orderId !== checkout.orderId && <SponsorshipDonorConsentStatus preferences={checkout.donorPreferences ?? null} />}
            {checkout.checkoutUrl ? <><a className="sandbox-button" href={checkout.checkoutUrl} target="_blank" rel="noopener noreferrer" onClick={() => setAutoOrderId(checkout.orderId)}>前往 OEN TEST 結帳 ↗</a><p className="sandbox-help">新分頁開啟，保留本頁自動核對。請勿關閉或重新整理本頁；返回此頁即可繼續核對。</p></> : <p className="sandbox-help">結帳結果仍待核對。請使用左側訂單查詢，暫勿另建付款。</p>}
          </div>}
        </section>}
      </div>
      {mode === "test" && <SponsorshipDonorListPreview id="test-donor-list-heading" />}
    </>}
    <footer className="sandbox-footer"><Link href="/sponsorship">返回贊助與支出</Link><p>本頁不公開付款人資料，也不計入正式贊助收入。</p></footer>
  </main>;
}
