/** Injection-only HTTP handlers. Dependencies are supplied by the gated server runtime.
 * Dependencies must be constructed server-side after approved credential setup.
 * No environment/credential reads, scheduler, default network transport, or logging.
 */
import { randomUUID } from 'node:crypto';
import { safeStoredDonorPreferences } from './donor-order-store.mjs';
import { normalizeDonorPreferences } from './donor-projection.mjs';
import { createSandboxDonorConsentHandler } from './donor-consent-handler.mjs';
import { authorizeSandboxTester } from './sandbox-access.mjs';
import { requestSandboxCheckout } from './checkout-service.mjs';
import { reconcileDurableSandboxOrder, runSandboxReconciliationBatch } from './durable-reconciliation.mjs';
const ORDER = /^preview_[a-zA-Z0-9_-]{8,64}$/;
const CHECKOUT = /^[A-Za-z0-9]{27}$/;
const STATES = new Set(['reserved', 'pending', 'uncertain', 'verified_paid']);
class HttpFailure extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code; }
}
const fail = (status, code) => { throw new HttpFailure(status, code); };
function json(status, data, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', Vary: 'Origin, Authorization', ...extraHeaders },
  });
}
function errorResponse(error, knownOrderId) {
  if (error instanceof HttpFailure) return json(error.status, { code: error.code });
  const codes = { SANDBOX_ACCESS_DENIED: [403, 'ACCESS_DENIED'], IDEMPOTENCY_CONFLICT: [409, 'IDEMPOTENCY_CONFLICT'], RATE_LIMITED: [429, 'RATE_LIMITED'] };
  const known = Object.hasOwn(codes, error?.message) ? codes[error.message] : null;
  if (known) return json(known[0], { code: known[1] });
  if (error?.message === 'RECONCILIATION_REQUIRED' && ORDER.test(knownOrderId || '')) {
    return json(202, { code: 'RECONCILIATION_PENDING', orderId: knownOrderId, environment: 'sandbox' });
  }
  return json(503, { code: 'SANDBOX_UNAVAILABLE', ...(ORDER.test(knownOrderId || '') ? { orderId: knownOrderId } : {}) });
}

/** Enforce bytes while streaming, not only attacker-supplied Content-Length. */
export async function readBoundedSandboxJson(request, maxBytes, timeoutMs = 2500) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') || '')) fail(415, 'JSON_REQUIRED');
  const encoding = request.headers.get('content-encoding');
  if (encoding && encoding.toLowerCase() !== 'identity') fail(415, 'ENCODING_UNSUPPORTED');
  const length = request.headers.get('content-length');
  if (length !== null && !/^\d+$/.test(length)) fail(400, 'INVALID_REQUEST');
  if (length !== null && Number(length) > maxBytes) fail(413, 'BODY_TOO_LARGE');
  if (!request.body) fail(400, 'INVALID_REQUEST');
  const reader = request.body.getReader();
  const chunks = []; let size = 0; let timer;
  const reading = (async () => {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) fail(413, 'BODY_TOO_LARGE');
      chunks.push(value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    let body;
    try { body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
    catch { fail(400, 'INVALID_JSON'); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) fail(400, 'INVALID_REQUEST');
    return body;
  })();
  try {
    return await Promise.race([reading, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new HttpFailure(408, 'BODY_TIMEOUT')), timeoutMs);
    })]);
  } finally {
    clearTimeout(timer);
    // Do not await an attacker-controlled cancel operation or retain the body.
    void reader.cancel().catch(() => {});
  }
}
function onlyKeys(value, allowed) {
  if (Object.keys(value).some((key) => !allowed.includes(key))) fail(400, 'INVALID_REQUEST');
}
function safeOrder(order, ownerId, orderId) {
  if (!order || order.ownerId !== ownerId || order.orderId !== orderId || order.environment !== 'sandbox' || order.currency !== 'TWD' || !STATES.has(order.state) || !Number.isSafeInteger(order.amount) || order.amount < 1 || order.amount > 100000) fail(503, 'SANDBOX_UNAVAILABLE');
  const paid = order.state === 'verified_paid';
  if (paid && !Number.isFinite(order.verifiedPaidAt)) fail(503, 'SANDBOX_UNAVAILABLE');
  return { orderId, amount: order.amount, currency: 'TWD', environment: 'sandbox',
    status: paid ? 'verified_paid' : 'pending',
    verifiedPaidAt: paid ? new Date(order.verifiedPaidAt).toISOString() : null,
    // null means no durable review conclusion; it must not clear a visible warning.
    ...(Object.hasOwn(order, 'donorPreferences') ? { donorPreferences: safeStoredDonorPreferences(order.donorPreferences) } : {}),
    needsReview: paid ? false : ['multiple_transactions', 'mismatch'].includes(order.lastOutcome) ? true : null };
}

export function createSandboxHandlers({
  configuration, authClient, allowedUserIds, orderStoreForOwner, reconciliationStore, donorPreferencesEnabled = false,
  rateLimit, requestAdmission, authorizeReconciler, notifyReview, reviewDelivery = 'sink', reconciliationMode = 'batch', fetchImpl,
} = {}) {
  if (typeof window !== 'undefined') throw new Error('SERVER_ONLY');
  let trustedOrigin = null;
  try {
    const url = new URL(configuration?.origin);
    if (url.protocol === 'https:' && !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash) trustedOrigin = url.origin;
  } catch { /* Invalid or missing configuration stays disabled. */ }
  async function gate(request, scope, method, interactive = false) {
    if (!configuration?.enabled || configuration.environment !== 'sandbox' || configuration.merchantId !== 'sinjmed' || !configuration.token || !trustedOrigin || typeof (requestAdmission ?? rateLimit) !== 'function') fail(503, 'SANDBOX_UNAVAILABLE');
    if (request.method !== method) fail(405, 'METHOD_NOT_ALLOWED');
    let url;
    try { url = new URL(request.url); } catch { fail(400, 'INVALID_REQUEST'); }
    if (url.origin !== trustedOrigin || url.username || url.password) fail(403, 'ORIGIN_DENIED');
    if (interactive) {
      const origin = request.headers.get('origin');
      if ((method !== 'GET' && origin !== trustedOrigin) || (origin !== null && origin !== trustedOrigin)) fail(403, 'ORIGIN_DENIED');
      const site = request.headers.get('sec-fetch-site');
      if (site !== null && site !== 'same-origin' && site !== 'none') fail(403, 'ORIGIN_DENIED');
    }
    // Public deployments need a real limiter. A deliberate protected TEST mode may
    // instead inject an admission policy; it is not described as a rate limiter.
    if (requestAdmission) {
      if (await requestAdmission({ request, scope }) !== true) fail(403, 'ACCESS_DENIED');
    } else if (await rateLimit({ request, scope }) !== true) fail(429, 'RATE_LIMITED');
    return url;
  }
  async function tester(request) {
    const authorization = request.headers.get('authorization') || '';
    const match = /^Bearer ([^\s]{1,16384})$/i.exec(authorization);
    if (!match) fail(401, 'AUTHENTICATION_REQUIRED');
    return authorizeSandboxTester({ authClient, accessToken: match[1], allowedUserIds });
  }
  function ownedStore(ownerId, donorPreferences) {
    if (typeof orderStoreForOwner !== 'function') fail(503, 'SANDBOX_UNAVAILABLE');
    const store = orderStoreForOwner(ownerId, donorPreferences);
    if (!store?.durable) fail(503, 'SANDBOX_UNAVAILABLE');
    return store;
  }
  return Object.freeze({
    'donor-consent': donorPreferencesEnabled === true
      ? createSandboxDonorConsentHandler({ configuration, authClient, allowedUserIds, orderStoreForOwner, requestAdmission: requestAdmission ?? rateLimit })
      : async () => json(503, { code: 'PREVIEW_CHECKOUT_DISABLED' }),
    async checkout(request) {
      let captured;
      try {
        const url = await gate(request, 'checkout', 'POST', true);
        if (url.search) fail(400, 'INVALID_REQUEST');
        if (typeof fetchImpl !== 'function') fail(503, 'SANDBOX_UNAVAILABLE');
        const { ownerId } = await tester(request);
        const body = await readBoundedSandboxJson(request, 2048);
        onlyKeys(body, donorPreferencesEnabled === true ? ['requestKey', 'amount', 'donorPreferences'] : ['requestKey', 'amount']);
        if (typeof body.requestKey !== 'string' || !/^[A-Za-z0-9_-]{8,100}$/.test(body.requestKey) || !Number.isSafeInteger(body.amount) || body.amount < 1 || body.amount > 100000) fail(400, 'INVALID_REQUEST');
        let donorPreferences;
        if (donorPreferencesEnabled === true) {
          try { donorPreferences = normalizeDonorPreferences(body.donorPreferences); }
          catch { fail(400, 'INVALID_REQUEST'); }
        }
        const store = ownedStore(ownerId, donorPreferences);
        const capturingStore = {
          durable: true,
          reserve: async (input) => {
            const result = await store.reserve(input);
            safeOrder(result?.order, ownerId, result?.order?.orderId);
            if (!ORDER.test(result.order.orderId || '')) fail(503, 'SANDBOX_UNAVAILABLE');
            captured = result.order;
            return result;
          },
          saveCheckout: (...args) => store.saveCheckout(...args),
          markUncertain: (...args) => store.markUncertain(...args),
        };
        const result = await requestSandboxCheckout({ configuration, store: capturingStore,
          requestKey: body.requestKey, amount: body.amount,
          orderId: `preview_${randomUUID().replaceAll('-', '')}`,
          idempotencyKey: `preview_${randomUUID().replaceAll('-', '')}`,
        }, fetchImpl);
        if (!CHECKOUT.test(result?.checkoutId || '') || result.url !== `https://sinjmed.testing.oen.tw/checkout/${result.checkoutId}`) fail(503, 'SANDBOX_UNAVAILABLE');
        return json(200, { orderId: captured.orderId, checkoutUrl: result.url, environment: 'sandbox' });
      } catch (error) {
        if (captured?.state === 'verified_paid' && error?.message === 'RECONCILIATION_REQUIRED') return json(200, safeOrder(captured, captured.ownerId, captured.orderId));
        return errorResponse(error, captured?.orderId);
      }
    },
    async status(request) {
      try {
        const url = await gate(request, 'status', 'GET', true);
        const { ownerId } = await tester(request);
        if ([...url.searchParams.keys()].some((key) => key !== 'orderId') || url.searchParams.getAll('orderId').length !== 1) fail(400, 'INVALID_REQUEST');
        const orderId = url.searchParams.get('orderId');
        if (!ORDER.test(orderId || '')) fail(400, 'INVALID_REQUEST');
        const result = await ownedStore(ownerId).getOrder(orderId);
        if (result === null) fail(404, 'ORDER_NOT_FOUND');
        return json(200, safeOrder(result, ownerId, orderId));
      } catch (error) { return errorResponse(error); }
    },
    async webhook(request) {
      try {
        const url = await gate(request, 'webhook', 'POST');
        if (url.search) fail(400, 'INVALID_REQUEST');
        if (!reconciliationStore?.durable || typeof reconciliationStore.queueHint !== 'function') fail(503, 'SANDBOX_UNAVAILABLE');
        const body = await readBoundedSandboxJson(request, 8192);
        if (body.purpose !== 'charge' || !CHECKOUT.test(body.id || '') || (body.action !== undefined && body.action !== 'onetime')) fail(400, 'INVALID_NOTIFICATION');
        // All provider/user-supplied amount/status/name/card fields are ignored.
        // No provider call or background promise is started before acknowledgment.
        const accepted = await reconciliationStore.queueHint({ checkoutId: body.id });
        if (accepted !== true) fail(503, 'NOTIFICATION_NOT_DURABLE');
        return json(200, { accepted: true });
      } catch (error) { return errorResponse(error); }
    },
    async reconcile(request) {
      try {
        const url = await gate(request, 'reconcile', 'POST', reconciliationMode === 'owned');
        if (url.search) fail(400, 'INVALID_REQUEST');
        if (reconciliationMode === 'owned') {
          const { ownerId } = await tester(request);
          const body = await readBoundedSandboxJson(request, 256);
          onlyKeys(body, ['orderId']);
          if (!ORDER.test(body.orderId || '')) fail(400, 'INVALID_REQUEST');
          if (typeof fetchImpl !== 'function') fail(503, 'SANDBOX_UNAVAILABLE');
          const store = ownedStore(ownerId);
          const order = await store.getOrder(body.orderId);
          if (order === null) fail(404, 'ORDER_NOT_FOUND');
          safeOrder(order, ownerId, body.orderId);
          // Manual verification never claims a global queue item or retries checkout POST.
          // Checkout binding and paid writes remain immutable/monotonic under concurrency.
          const verified = await reconcileDurableSandboxOrder({ configuration, store, order }, fetchImpl);
          const latest = await store.getOrder(body.orderId);
          const safe = safeOrder(latest, ownerId, body.orderId);
          const needsReview = safe.status !== 'verified_paid' && ['multiple_transactions', 'mismatch'].includes(verified.outcome);
          return json(needsReview ? 409 : 200, { ...safe, needsReview,
            verification: safe.status === 'verified_paid' ? 'verified_paid' : verified.outcome,
            ...(needsReview ? { code: 'REVIEW_REQUIRED' } : {}) });
        }
        if (typeof authorizeReconciler !== 'function' || await authorizeReconciler(request) !== true) fail(401, 'AUTHENTICATION_REQUIRED');
        // A foreground TEST request can surface review directly to its authenticated caller.
        // Unattended work still requires an explicit review sink.
        if ((reviewDelivery !== 'interactive' && typeof notifyReview !== 'function') || typeof fetchImpl !== 'function') fail(503, 'SANDBOX_UNAVAILABLE');
        const body = await readBoundedSandboxJson(request, 256);
        onlyKeys(body, []);
        const result = await runSandboxReconciliationBatch({ configuration, store: reconciliationStore, limit: 1 }, fetchImpl);
        const summary = {};
        for (const field of ['claimed', 'verifiedPaid', 'retryScheduled', 'leaseLost', 'needsReview']) {
          if (!Number.isSafeInteger(result[field]) || result[field] < 0) fail(503, 'SANDBOX_UNAVAILABLE');
          summary[field] = result[field];
        }
        if (summary.needsReview > 0) {
          if (reviewDelivery === 'interactive') return json(409, { code: 'REVIEW_REQUIRED', environment: 'sandbox', ...summary });
          if (await notifyReview(summary) !== true) fail(503, 'REVIEW_ALERT_UNAVAILABLE');
        }
        return json(200, { environment: 'sandbox', ...summary });
      } catch (error) { return errorResponse(error); }
    },
  });
}
