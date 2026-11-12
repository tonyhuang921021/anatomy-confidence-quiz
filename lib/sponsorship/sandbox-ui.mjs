/** Browser-safe presentation validation. Redirects never establish payment state. */
import { normalizeDonorPreferences } from './donor-projection.mjs';
export const SANDBOX_AUTH_URL = 'https://ejyniduhsyurxocabqqp.supabase.co';
const ORDER = /^preview_[A-Za-z0-9_-]{8,64}$/;
const CHECKOUT = /^https:\/\/sinjmed\.testing\.oen\.tw\/checkout\/[A-Za-z0-9]{27}$/;
export function parseSandboxOrderId(value) {
  return typeof value === 'string' && ORDER.test(value) ? value : null;
}
export function readSandboxReturnOrder(params) {
  const values = params.getAll('order');
  return values.length === 1 ? parseSandboxOrderId(values[0]) : null;
}
export function parseSandboxAmount(value) {
  if (typeof value !== 'string' || !/^[0-9]{1,6}$/.test(value)) return null;
  const amount = Number(value);
  return Number.isSafeInteger(amount) && amount >= 1 && amount <= 100000 ? amount : null;
}
export function parseSandboxPublicConfig(value) {
  if (value?.environment !== 'sandbox' || value.supabaseUrl !== SANDBOX_AUTH_URL || typeof value.publishableKey !== 'string' || value.publishableKey.length > 16384) return null;
  // The server classifies the key and binds legacy anon keys to the exact project.
  if (!/^sb_publishable_[A-Za-z0-9_-]{16,256}$/.test(value.publishableKey) && !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value.publishableKey)) return null;
  if (value.checkoutEnabled !== undefined && typeof value.checkoutEnabled !== 'boolean') return null;
  if (value.donorPreferencesEnabled !== undefined && typeof value.donorPreferencesEnabled !== 'boolean') return null;
  return { environment: 'sandbox', supabaseUrl: SANDBOX_AUTH_URL, publishableKey: value.publishableKey, checkoutEnabled: value.checkoutEnabled === true, donorPreferencesEnabled: value.donorPreferencesEnabled === true };
}
export function parseSandboxDonorPreferences(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !Number.isSafeInteger(value.revision) || value.revision < 1 || value.revision > 2147483647 || typeof value.publishDisplayName !== 'boolean' || typeof value.publishAmount !== 'boolean') return null;
  try {
    const normalized = normalizeDonorPreferences({ displayName: value.displayName ?? '', publishDisplayName: value.publishDisplayName, publishAmount: value.publishAmount });
    if (normalized.displayName !== value.displayName) return null;
    return { ...normalized, revision: value.revision };
  } catch { return null; }
}
export function parseSandboxDonorConsent(value, expectedOrderId) {
  if (!parseSandboxOrderId(expectedOrderId) || value?.orderId !== expectedOrderId || value.environment !== 'sandbox') return null;
  const donorPreferences = parseSandboxDonorPreferences(value.donorPreferences);
  return donorPreferences ? { environment: 'sandbox', orderId: expectedOrderId, donorPreferences } : null;
}
export function parseSandboxOrderStatus(value, expectedOrderId) {
  if (!parseSandboxOrderId(expectedOrderId) || value?.orderId !== expectedOrderId || value.environment !== 'sandbox' || value.currency !== 'TWD' || !Number.isSafeInteger(value.amount) || value.amount < 1 || value.amount > 100000) return null;
  if (!['pending', 'verified_paid'].includes(value.status)) return null;
  const paid = value.status === 'verified_paid';
  if ((paid && (typeof value.verifiedPaidAt !== 'string' || !Number.isFinite(Date.parse(value.verifiedPaidAt)))) || (!paid && value.verifiedPaidAt !== null)) return null;
  if (value.needsReview !== undefined && value.needsReview !== null && typeof value.needsReview !== 'boolean') return null;
  if (paid && value.needsReview === true) return null;
  const donorPreferences = value.donorPreferences == null ? null : parseSandboxDonorPreferences(value.donorPreferences);
  if (value.donorPreferences != null && !donorPreferences) return null;
  return { orderId: expectedOrderId, amount: value.amount, currency: 'TWD', environment: 'sandbox', status: value.status, verifiedPaidAt: value.verifiedPaidAt, needsReview: value.needsReview ?? null, donorPreferences };
}
export function parseSandboxCheckout(value) {
  if (value?.environment !== 'sandbox' || !parseSandboxOrderId(value.orderId)) return null;
  const donorPreferences = value.donorPreferences == null ? null : parseSandboxDonorPreferences(value.donorPreferences);
  if (value.donorPreferences != null && !donorPreferences) return null;
  if (value.checkoutUrl !== undefined) {
    if (typeof value.checkoutUrl !== 'string' || !CHECKOUT.test(value.checkoutUrl) || value.status !== undefined) return null;
    return { orderId: value.orderId, checkoutUrl: value.checkoutUrl, status: null, donorPreferences };
  }
  if (value.code === 'RECONCILIATION_PENDING') return { orderId: value.orderId, checkoutUrl: null, status: null, donorPreferences };
  const status = parseSandboxOrderStatus(value, value.orderId);
  return status ? { orderId: value.orderId, checkoutUrl: null, status, donorPreferences } : null;
}
export function parseSandboxReconciliation(value, expectedOrderId) {
  const order = parseSandboxOrderStatus(value, expectedOrderId);
  if (!order || typeof value.needsReview !== 'boolean' || !['verified_paid', 'not_verified_paid', 'no_transaction', 'multiple_transactions', 'mismatch'].includes(value.verification)) return null;
  if (value.needsReview !== ['multiple_transactions', 'mismatch'].includes(value.verification)) return null;
  if ((value.verification === 'verified_paid') !== (order.status === 'verified_paid')) return null;
  return { order, needsReview: value.needsReview, verification: value.verification };
}
export function sandboxErrorMessage(code) {
  const labels = {
    AUTHENTICATION_REQUIRED: '登入已失效，請重新登入後再查詢。',
    ACCESS_DENIED: '此帳號未獲准使用測試區，或登入已失效。請聯絡站長確認測試名單。',
    ORDER_NOT_FOUND: '找不到這個帳號的測試訂單。請確認訂單編號與登入帳號。',
    RATE_LIMITED: '已達測試請求上限，請稍後再試。',
    IDEMPOTENCY_CONFLICT: '這筆請求的金額不一致，已停止建立訂單。請先確認原訂單。',
    PREVIEW_CHECKOUT_DISABLED: '此環境尚未啟用受控測試。公開贊助付款仍未開放。',
    REVIEW_REQUIRED: '核對結果需要人工檢查，請勿重新付款，並將測試訂單編號交給站長。',
  };
  return Object.hasOwn(labels, code) ? labels[code] : '目前無法完成測試請求。付款狀態尚未確認，請稍後查詢；請勿因此另建付款。';
}
