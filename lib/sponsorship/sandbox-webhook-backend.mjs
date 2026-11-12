/** Isolated unsigned TEST charge notifications. Never trust notification financial fields. */
import { classifySandboxTransaction } from './oen-sandbox.mjs';
export const WEBHOOK_PROJECT_URL = 'https://ejyniduhsyurxocabqqp.supabase.co';
export const WEBHOOK_OWNER_ID = '2a82b68a-74c0-4deb-b433-fc38ca0155e9';
const API = 'https://payment-api.testing.oen.tw';
const CHECKOUT = /^[A-Za-z0-9]{27}$/;
const ORDER = /^preview_[A-Za-z0-9_-]{8,64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RPC_FIELDS = Object.freeze({
  sponsorship_sandbox_get_order_by_checkout: ['p_owner_id', 'p_checkout_id'],
  sponsorship_sandbox_mark_verified_paid: ['p_owner_id', 'p_order_id', 'p_checkout_id', 'p_expected_amount'],
  sponsorship_sandbox_finish: ['p_order_id', 'p_lease_token', 'p_generation', 'p_outcome', 'p_retry_after_seconds'],
  sponsorship_sandbox_suppress_donor: ['p_owner_id', 'p_order_id', 'p_reason'],
});
function fail() { throw Error('WEBHOOK_UNAVAILABLE'); }
function response(status, code) {
  return new Response(JSON.stringify({ environment: 'sandbox', code }), { status, headers: {
    'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
  } });
}
function validKey(value) { return typeof value === 'string' && value.length > 0 && value.length <= 16384; }
function serviceKey(getEnv) {
  const key = getEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (validKey(key)) return key;
  const dictionary = getEnv('SUPABASE_SECRET_KEYS');
  if (typeof dictionary !== 'string' || dictionary.length > 65536) fail();
  const fallback = JSON.parse(dictionary)?.default;
  if (!validKey(fallback)) fail();
  return fallback;
}
function beforeAbort(promise, signal) {
  return new Promise((resolve, reject) => {
    const abort = () => reject(Error('WEBHOOK_UNAVAILABLE'));
    if (signal.aborted) { reject(Error('WEBHOOK_UNAVAILABLE')); return; }
    signal.addEventListener('abort', abort, { once: true });
    Promise.resolve(promise).then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}
async function boundedJson(body, maxBytes, signal) {
  if (!body || typeof body.getReader !== 'function') fail();
  const reader = body.getReader(); const chunks = []; let size = 0;
  try {
    while (true) {
      const { value, done } = await beforeAbort(reader.read(), signal);
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) fail();
      chunks.push(value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } finally { void reader.cancel().catch(() => {}); }
}
/** Fixed endpoints, exact RPC field allowlist, one shared deadline including response bodies. */
export function createSandboxWebhookTransport({ fetchImpl, key, signal }) {
  if (typeof fetchImpl !== 'function' || !validKey(key) || !signal) fail();
  async function request(url, options) {
    if (signal.aborted) fail();
    const result = await beforeAbort(fetchImpl(url, { ...options, signal, redirect: 'error', cache: 'no-store' }), signal);
    if (!result?.ok) fail();
    return boundedJson(result.body, 131072, signal);
  }
  return Object.freeze({
    async rpc(name, parameters) {
      const fields = RPC_FIELDS[name];
      if (!fields || !parameters || typeof parameters !== 'object' || Array.isArray(parameters) ||
          Object.keys(parameters).length !== fields.length || fields.some((field) => !Object.hasOwn(parameters, field)) ||
          (fields.includes('p_owner_id') && parameters.p_owner_id !== WEBHOOK_OWNER_ID)) fail();
      return request(`${WEBHOOK_PROJECT_URL}/rest/v1/rpc/${name}`, { method: 'POST',
        headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(parameters) });
    },
    async transaction(checkoutId, token) {
      if (typeof checkoutId !== 'string' || !CHECKOUT.test(checkoutId) || !validKey(token)) fail();
      return request(`${API}/transactions/${checkoutId}`, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
    },
  });
}
function validateOrder(row, checkoutId, claimed) {
  if (!row || row.owner_id !== WEBHOOK_OWNER_ID || row.environment !== 'sandbox' || row.currency !== 'TWD' ||
      typeof row.order_id !== 'string' || !ORDER.test(row.order_id) || row.checkout_id !== checkoutId ||
      !Number.isSafeInteger(row.amount) || row.amount < 1 || row.amount > 100000 ||
      !['pending', 'uncertain', 'verified_paid'].includes(row.state)) fail();
  if (claimed && (typeof row.lease_token !== 'string' || !UUID.test(row.lease_token) ||
      !Number.isSafeInteger(row.reconciliation_generation) || row.reconciliation_generation < 1 ||
      !Number.isSafeInteger(row.reconciliation_attempts) || row.reconciliation_attempts < 1 || row.reconciliation_attempts > 30)) fail();
  return { ownerId: row.owner_id, orderId: row.order_id, checkoutId, amount: row.amount, currency: 'TWD', environment: 'sandbox' };
}
/** No startup work. Disabled configuration precedes all credential reads and network calls. */
export function createSandboxWebhookHandler({ getEnv, fetchImpl, deadlineMs = 8000 } = {}) {
  // Smaller deadline injection is only for offline tests. Production cannot raise the 8-second ceiling.
  if (!Number.isInteger(deadlineMs) || deadlineMs < 1 || deadlineMs > 8000) throw Error('INVALID_DEADLINE');
  return async (request) => {
    let transport; let claimed; let finishAttempted = false;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), deadlineMs);
    const signal = controller.signal;
    const finish = async (outcome) => {
      finishAttempted = true;
      const result = await transport.rpc('sponsorship_sandbox_finish', {
        p_order_id: claimed.order_id, p_lease_token: claimed.lease_token,
        p_generation: claimed.reconciliation_generation, p_outcome: outcome, p_retry_after_seconds: 30,
      });
      if (result !== true) fail();
    };
    try {
      if (typeof getEnv !== 'function' || getEnv('OEN_CHECKOUT_MODE') !== 'sandbox' || getEnv('OEN_SANDBOX_WEBHOOK_ENABLED') !== 'true') return response(503, 'WEBHOOK_DISABLED');
      const url = new URL(request.url);
      // Gateway hostname may be internal. It is never used as an outbound destination.
      if (!['https:', 'http:'].includes(url.protocol) || !['/oen-sandbox-webhook', '/oen-sandbox-webhook/', '/functions/v1/oen-sandbox-webhook', '/functions/v1/oen-sandbox-webhook/'].includes(url.pathname) || url.search || url.hash || url.username || url.password) return response(404, 'NOT_FOUND');
      if (request.method !== 'POST') return response(405, 'METHOD_NOT_ALLOWED');
      if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers.get('content-type') || '') ||
          ![null, 'identity'].includes(request.headers.get('content-encoding'))) return response(400, 'INVALID_NOTIFICATION');
      const length = request.headers.get('content-length');
      if (length !== null && (!/^\d+$/.test(length) || Number(length) > 16384)) return response(413, 'NOTIFICATION_TOO_LARGE');
      let notification;
      try { notification = await boundedJson(request.body, 16384, signal); }
      catch { return response(signal.aborted ? 503 : 400, 'INVALID_NOTIFICATION'); }
      if (!notification || typeof notification !== 'object' || Array.isArray(notification) || notification.purpose !== 'charge' ||
          notification.merchantId !== 'sinjmed' || typeof notification.id !== 'string' || !CHECKOUT.test(notification.id) ||
          notification.transactionId !== notification.id || (notification.action !== undefined && notification.action !== 'onetime')) return response(400, 'INVALID_NOTIFICATION');
      const checkoutId = notification.id;
      // Discard every callback financial/payer field. Only its validated checkout hint survives.
      notification = null;
      if (getEnv('SUPABASE_URL') !== WEBHOOK_PROJECT_URL) fail();
      transport = createSandboxWebhookTransport({ fetchImpl, key: serviceKey(getEnv), signal });
      const admission = await transport.rpc('sponsorship_sandbox_get_order_by_checkout', { p_owner_id: WEBHOOK_OWNER_ID, p_checkout_id: checkoutId });
      if (admission?.outcome === 'unknown') return response(404, 'NOT_FOUND');
      if (admission?.outcome === 'busy') return response(503, 'VERIFICATION_BUSY');
      if (admission?.outcome === 'rate_limited') return response(429, 'VERIFICATION_LIMIT_REACHED');
      if (!['claimed', 'already_verified'].includes(admission?.outcome)) fail();
      const order = validateOrder(admission.order, checkoutId, admission.outcome === 'claimed');
      if (admission.outcome === 'already_verified') {
        if (admission.order.state !== 'verified_paid') fail();
        // Charge-only replay optimization. This is explicitly not refund-event monitoring.
        return response(200, 'ACCEPTED');
      }
      claimed = admission.order;
      const envelope = await transport.transaction(checkoutId, getEnv('OEN_SANDBOX_TOKEN'));
      if (envelope?.code !== 'S0000' || !envelope.data || typeof envelope.data !== 'object' || Array.isArray(envelope.data)) fail();
      const classification = classifySandboxTransaction(envelope, order);
      if (classification === 'paid') {
        const saved = await transport.rpc('sponsorship_sandbox_mark_verified_paid', {
          p_owner_id: WEBHOOK_OWNER_ID, p_order_id: order.orderId, p_checkout_id: checkoutId, p_expected_amount: order.amount,
        });
        validateOrder(saved, checkoutId, false);
        if (saved.state !== 'verified_paid' || saved.amount !== order.amount || saved.order_id !== order.orderId) fail();
        await finish('verified_paid');
        return response(200, 'ACCEPTED');
      }
      if (classification !== 'not_paid') {
        const suppressed = await transport.rpc('sponsorship_sandbox_suppress_donor', {
          p_owner_id: WEBHOOK_OWNER_ID, p_order_id: order.orderId, p_reason: classification,
        });
        if (suppressed !== true) fail();
        await finish('mismatch');
        return response(200, 'ACCEPTED');
      }
      await finish('not_verified_paid');
      return response(503, 'VERIFICATION_PENDING');
    } catch {
      // Release promptly when budget remains, allowing the vendor's short retry window.
      // A terminated process instead leaves the 10-second durable lease to expire.
      if (claimed && transport && !signal.aborted && !finishAttempted) {
        try { await finish('unavailable'); } catch { /* no raw response/error logging */ }
      }
      return response(503, 'VERIFICATION_UNAVAILABLE');
    } finally { clearTimeout(timer); }
  };
}
