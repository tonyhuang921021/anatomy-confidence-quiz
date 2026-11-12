/** Server-only TEST transport. Edge mode consumes only public Auth configuration and tester JWTs.
 * The fixed Edge Function independently verifies the JWT, allowlist and order owner.
 * No automatic retry or Postgres fallback is permitted after an Edge request.
 */
import { normalizeDonorPreferences } from './donor-projection.mjs';
import { sandboxRoutesEnabled } from './sandbox-runtime.mjs';
import { readSandboxPublicAuthConfiguration } from './sandbox-test-auth.mjs';
import { readBoundedSandboxJson } from './sandbox-handlers.mjs';
import { parseSandboxCheckout, parseSandboxOrderId, parseSandboxOrderStatus, parseSandboxReconciliation } from './sandbox-ui.mjs';
import { readSandboxFrontendOrigin } from './preview-origin.mjs';

export const SANDBOX_EDGE_URL = 'https://ejyniduhsyurxocabqqp.supabase.co/functions/v1/oen-sandbox';
const OPERATIONS = new Set(['checkout', 'status', 'reconcile', 'donor-consent']);
const ERROR_STATUS = Object.freeze({
  AUTHENTICATION_REQUIRED: 401, ACCESS_DENIED: 403, ORIGIN_DENIED: 403,
  INVALID_REQUEST: 400, INVALID_JSON: 400, JSON_REQUIRED: 415, ENCODING_UNSUPPORTED: 415,
  BODY_TOO_LARGE: 413, BODY_TIMEOUT: 408, METHOD_NOT_ALLOWED: 405,
  ORDER_NOT_FOUND: 404, DONOR_PREFERENCES_NOT_FOUND: 404, IDEMPOTENCY_CONFLICT: 409, RATE_LIMITED: 429,
  PREVIEW_CHECKOUT_DISABLED: 503, SANDBOX_UNAVAILABLE: 503,
});
class ProxyFailure extends Error {
  constructor(code) { super(code); this.code = code; this.status = ERROR_STATUS[code] ?? 503; }
}
function serverOnly() { if (typeof window !== 'undefined') throw new Error('SERVER_ONLY'); }
function fail(code) { throw new ProxyFailure(code); }
function json(status, body) {
  return new Response(JSON.stringify(body), { status, headers: {
    'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', Vary: 'Origin, Authorization',
  } });
}
function error(code = 'SANDBOX_UNAVAILABLE', orderId) {
  return json(ERROR_STATUS[code] ?? 503, { code, ...(parseSandboxOrderId(orderId) ? { orderId } : {}) });
}
function onlyKeys(value, allowed) {
  if (Object.keys(value).some((key) => !allowed.includes(key))) fail('INVALID_REQUEST');
}
async function inputFor(operation, request, origin, donorPreferencesEnabled) {
  const method = operation === 'status' ? 'GET' : 'POST';
  if (request.method !== method) fail('METHOD_NOT_ALLOWED');
  const url = new URL(request.url);
  if (url.origin !== origin || url.username || url.password || url.pathname !== `/api/sponsorship/${operation}`) fail('ORIGIN_DENIED');
  const providedOrigin = request.headers.get('origin');
  const site = request.headers.get('sec-fetch-site');
  if ((method !== 'GET' && providedOrigin !== origin) || (providedOrigin !== null && providedOrigin !== origin) ||
    (site !== null && site !== 'same-origin' && site !== 'none')) fail('ORIGIN_DENIED');
  const bearer = /^Bearer ([^\s]{1,16384})$/i.exec(request.headers.get('authorization') || '');
  if (!bearer) fail('AUTHENTICATION_REQUIRED');
  if (operation === 'status') {
    if ([...url.searchParams.keys()].some((key) => key !== 'orderId') || url.searchParams.getAll('orderId').length !== 1) fail('INVALID_REQUEST');
    const orderId = parseSandboxOrderId(url.searchParams.get('orderId'));
    if (!orderId) fail('INVALID_REQUEST');
    return { method, token: bearer[1], orderId, query: `?orderId=${encodeURIComponent(orderId)}` };
  }
  if (url.search) fail('INVALID_REQUEST');
  const body = await readBoundedSandboxJson(request, operation === 'checkout' ? 2048 : 256);
  if (operation === 'checkout') {
    onlyKeys(body, donorPreferencesEnabled ? ['requestKey', 'amount', 'donorPreferences'] : ['requestKey', 'amount']);
    if (typeof body.requestKey !== 'string' || !/^[A-Za-z0-9_-]{8,100}$/.test(body.requestKey) || !Number.isSafeInteger(body.amount) || body.amount < 1 || body.amount > 100000) fail('INVALID_REQUEST');
    let donorPreferences;
    if (Object.hasOwn(body, 'donorPreferences')) {
      try { donorPreferences = normalizeDonorPreferences(body.donorPreferences); } catch { fail('INVALID_REQUEST'); }
    }
    return { method, token: bearer[1], query: '', body: { requestKey: body.requestKey, amount: body.amount,
      ...(donorPreferences ? { donorPreferences: { ...donorPreferences, displayName: donorPreferences.displayName ?? '' } } : {}) } }; 
  }
  if (operation === 'donor-consent') {
    onlyKeys(body, ['orderId', 'withdrawDisplayName', 'withdrawAmount']);
    const orderId = parseSandboxOrderId(body.orderId);
    if (!orderId || typeof body.withdrawDisplayName !== 'boolean' || typeof body.withdrawAmount !== 'boolean' || !(body.withdrawDisplayName || body.withdrawAmount)) fail('INVALID_REQUEST');
    return { method, token: bearer[1], orderId, query: '', body: { orderId, withdrawDisplayName: body.withdrawDisplayName, withdrawAmount: body.withdrawAmount } };
  }
  onlyKeys(body, ['orderId']);
  const orderId = parseSandboxOrderId(body.orderId);
  if (!orderId) fail('INVALID_REQUEST');
  return { method, token: bearer[1], orderId, query: '', body: { orderId } };
}
async function readResponse(response, signal) {
  if (!/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') || '') || !response.body) fail('SANDBOX_UNAVAILABLE');
  const length = response.headers.get('content-length');
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > 16384)) fail('SANDBOX_UNAVAILABLE');
  const reader = response.body.getReader();
  const abort = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener('abort', abort, { once: true });
  try {
    const chunks = []; let size = 0;
    while (true) {
      if (signal.aborted) fail('SANDBOX_UNAVAILABLE');
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 16384) fail('SANDBOX_UNAVAILABLE');
      chunks.push(value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    if (!data || typeof data !== 'object' || Array.isArray(data)) fail('SANDBOX_UNAVAILABLE');
    return data;
  } finally { signal.removeEventListener('abort', abort); void reader.cancel().catch(() => {}); }
}
function safeResponse(operation, response, data, orderId, requestBody) {
  if (operation === 'checkout' && (response.status === 200 || response.status === 202)) {
    const result = parseSandboxCheckout(data);
    if (!result) return error();
    if (response.status === 202) return data.code === 'RECONCILIATION_PENDING' && !result.checkoutUrl && !result.status ? json(202, { code: 'RECONCILIATION_PENDING', orderId: result.orderId, environment: 'sandbox' }) : error();
    if (result.checkoutUrl) return json(200, { orderId: result.orderId, checkoutUrl: result.checkoutUrl, environment: 'sandbox' });
    if (result.status) return json(200, result.status);
    return error();
  }
  if (operation === 'donor-consent' && response.status === 200) {
    if (data.environment !== 'sandbox' || data.orderId !== orderId || !data.donorPreferences) return error();
    try {
      const prefs = data.donorPreferences;
      if (!Number.isSafeInteger(prefs.revision) || prefs.revision < 1 || prefs.revision > 2147483647 || typeof prefs.publishDisplayName !== 'boolean' || typeof prefs.publishAmount !== 'boolean') return error();
      if ((requestBody?.withdrawDisplayName && prefs.publishDisplayName) || (requestBody?.withdrawAmount && prefs.publishAmount)) return error();
      const normalized = normalizeDonorPreferences({ displayName: prefs.displayName ?? '', publishDisplayName: prefs.publishDisplayName, publishAmount: prefs.publishAmount });
      if (normalized.displayName !== prefs.displayName) return error();
      return json(200, { environment: 'sandbox', orderId, donorPreferences: { ...normalized, revision: prefs.revision } });
    } catch { return error(); }
  }
  if (operation === 'status' && response.status === 200) {
    const status = parseSandboxOrderStatus(data, orderId);
    return status ? json(200, status) : error();
  }
  if (operation === 'reconcile' && (response.status === 200 || response.status === 409 && data.code === 'REVIEW_REQUIRED')) {
    const result = parseSandboxReconciliation(data, orderId);
    if (!result || (response.status === 409) !== result.needsReview) return error();
    return json(response.status, { ...result.order, needsReview: result.needsReview, verification: result.verification, ...(result.needsReview ? { code: 'REVIEW_REQUIRED' } : {}) });
  }
  // Rebuild allowlisted errors. Never forward upstream headers, details, cookies or tokens.
  if (Object.hasOwn(ERROR_STATUS, data.code) && ERROR_STATUS[data.code] === response.status) return error(data.code, operation === 'checkout' ? data.orderId : undefined);
  // Supabase gateway JWT failures may use another body shape; still expose only our code.
  if (response.status === 401) return error('AUTHENTICATION_REQUIRED');
  if (response.status === 403) return error('ACCESS_DENIED');
  return error();
}

export async function handleSandboxEdgeRequest(operation, request, { env = process.env, fetchImpl = globalThis.fetch, timeoutMs = 22000 } = {}) {
  serverOnly();
  if (!OPERATIONS.has(operation)) return error('PREVIEW_CHECKOUT_DISABLED');
  try {
    if (!sandboxRoutesEnabled(env) || env.OEN_SANDBOX_BACKEND !== 'edge') return error('PREVIEW_CHECKOUT_DISABLED');
    if (['checkout', 'reconcile'].includes(operation) && env.OEN_SANDBOX_PAYMENTS_ENABLED !== 'true') return error('PREVIEW_CHECKOUT_DISABLED');
    if (['checkout', 'donor-consent'].includes(operation) && env.OEN_SANDBOX_DONOR_PREFERENCES_ENABLED !== 'true') return error('PREVIEW_CHECKOUT_DISABLED');
    const configuration = readSandboxPublicAuthConfiguration(env);
    if (!configuration || typeof fetchImpl !== 'function' || !Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 22000) return error();
    const origin = readSandboxFrontendOrigin(env);
    const input = await inputFor(operation, request, origin, env.OEN_SANDBOX_DONOR_PREFERENCES_ENABLED === 'true');
    const controller = new AbortController();
    let rejectAborted;
    const aborted = new Promise((_, reject) => { rejectAborted = reject; });
    const abort = () => { controller.abort(); rejectAborted(new ProxyFailure('SANDBOX_UNAVAILABLE')); };
    request.signal.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(abort, timeoutMs);
    try {
      if (request.signal.aborted) return error();
      const work = (async () => {
        const response = await fetchImpl(`${SANDBOX_EDGE_URL}/${operation}${input.query}`, {
          method: input.method, signal: controller.signal, redirect: 'error', cache: 'no-store', credentials: 'omit',
          headers: { Authorization: `Bearer ${input.token}`, apikey: configuration.publishableKey,
            Origin: origin, Accept: 'application/json', ...(input.body ? { 'Content-Type': 'application/json' } : {}) },
          ...(input.body ? { body: JSON.stringify(input.body) } : {}),
        });
        // Native redirect:error handles 3xx. Also reject a misbehaving injected transport.
        if (response.redirected || response.status >= 300 && response.status < 400) return error();
        const data = await readResponse(response, controller.signal);
        return safeResponse(operation, response, data, input.orderId, input.body);
      })();
      return await Promise.race([work, aborted]);
    } finally { clearTimeout(timer); request.signal.removeEventListener('abort', abort); }
  } catch (cause) {
    if (Object.hasOwn(ERROR_STATUS, cause?.code) && ERROR_STATUS[cause.code] === cause.status) return error(cause.code);
    return error();
  }
}

/** Backend selection is deliberate. Unset/unknown stays off; Edge failure never falls back. */
export async function handleConfiguredSandboxRequest(operation, request, dependencies = {}) {
  serverOnly();
  const env = dependencies.env ?? process.env;
  if (!OPERATIONS.has(operation) || !sandboxRoutesEnabled(env)) return error('PREVIEW_CHECKOUT_DISABLED');
  if (['checkout', 'reconcile'].includes(operation) && env.OEN_SANDBOX_PAYMENTS_ENABLED !== 'true') return error('PREVIEW_CHECKOUT_DISABLED');
  if (env.OEN_SANDBOX_BACKEND === 'edge') return handleSandboxEdgeRequest(operation, request, dependencies);
  if (env.OEN_SANDBOX_BACKEND === 'postgres') {
    if (operation === 'checkout' || operation === 'donor-consent') return error('PREVIEW_CHECKOUT_DISABLED');
    const handler = dependencies.postgresHandler ?? (await import('./sandbox-runtime.mjs')).handleSandboxRequest;
    return handler(operation, request, dependencies);
  }
  return error('PREVIEW_CHECKOUT_DISABLED');
}
