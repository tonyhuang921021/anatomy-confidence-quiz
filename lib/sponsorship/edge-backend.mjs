/** Portable, injection-only Supabase Edge backend. No environment reads at import. */
import { createSandboxHandlers } from './sandbox-handlers.mjs';
import { authorizeSandboxTester } from './sandbox-access.mjs';
import { createSupabaseSandboxOrderStore } from './supabase-order-store.mjs';
import { createSupabaseSandboxDonorOrderStore } from './donor-order-store.mjs';
const PROJECT = 'ejyniduhsyurxocabqqp';
const PROJECT_URL = `https://${PROJECT}.supabase.co`;
const FUNCTION_PATHS = ['/functions/v1/oen-sandbox/', '/oen-sandbox/'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const OPERATIONS = Object.freeze({ checkout: 'POST', status: 'GET', reconcile: 'POST', 'donor-consent': 'POST' });
const RPC = Object.freeze({
  sponsorship_sandbox_reserve_donor_order: ['p_owner_id', 'p_request_key', 'p_amount', 'p_order_id', 'p_idempotency_key', 'p_display_name', 'p_publish_display_name', 'p_publish_amount'],
  sponsorship_sandbox_get_donor_preferences: ['p_owner_id', 'p_order_id'],
  sponsorship_sandbox_withdraw_donor_consent: ['p_owner_id', 'p_order_id', 'p_withdraw_display_name', 'p_withdraw_amount'],
  sponsorship_sandbox_reserve: ['p_owner_id', 'p_request_key', 'p_amount', 'p_order_id', 'p_idempotency_key'],
  sponsorship_sandbox_save_checkout: ['p_owner_id', 'p_order_id', 'p_checkout_id', 'p_checkout_expires_at'],
  sponsorship_sandbox_mark_uncertain: ['p_owner_id', 'p_order_id'],
  sponsorship_sandbox_get_order: ['p_owner_id', 'p_order_id'],
  sponsorship_sandbox_mark_verified_paid: ['p_owner_id', 'p_order_id', 'p_checkout_id', 'p_expected_amount'],
  sponsorship_sandbox_queue_hint: ['p_checkout_id'],
  sponsorship_sandbox_claim: ['p_lease_token', 'p_limit'],
  sponsorship_sandbox_finish: ['p_order_id', 'p_lease_token', 'p_generation', 'p_outcome', 'p_retry_after_seconds'],
});
const SAFE_ERRORS = new Set(['IDEMPOTENCY_CONFLICT', 'ORDER_CONFLICT', 'ORDER_NOT_FOUND', 'RATE_LIMITED']);
function reply(status, code) {
  return new Response(JSON.stringify({ code }), { status, headers: {
    'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer', Vary: 'Origin, Authorization',
  } });
}
function unavailable() { throw Error('SANDBOX_UNAVAILABLE'); }
function boundedValue(value) { return typeof value === 'string' && value.length > 0 && value.length <= 16384; }
function builtinKey(getEnv, legacyName, dictionaryName) {
  const legacy = getEnv(legacyName);
  if (boundedValue(legacy)) return legacy;
  const dictionary = getEnv(dictionaryName);
  if (typeof dictionary !== 'string' || dictionary.length > 65536) unavailable();
  const key = JSON.parse(dictionary)?.default;
  if (!boundedValue(key)) unavailable();
  return key;
}

/** Exact server RPC allowlist only; no generic proxy or suppression endpoint. An owner-scoped instance further denies queue RPCs. */
export function createEdgeSandboxRpcClient(client, { ownerId } = {}) {
  if (typeof client?.rpc !== 'function' || (ownerId !== undefined && !UUID.test(ownerId))) unavailable();
  return Object.freeze({
    async rpc(name, parameters) {
      if (typeof name !== 'string' || !Object.hasOwn(RPC, name) || !parameters || typeof parameters !== 'object' || Array.isArray(parameters)) return { data: null, error: { message: 'RPC_NOT_ALLOWED' } };
      const fields = RPC[name];
      if (Object.keys(parameters).length !== fields.length || fields.some((key) => {
        if (!Object.hasOwn(parameters, key)) return true;
        if (['p_publish_display_name', 'p_publish_amount', 'p_withdraw_display_name', 'p_withdraw_amount'].includes(key)) return typeof parameters[key] !== 'boolean';
        if (key === 'p_display_name') return parameters[key] !== null && typeof parameters[key] !== 'string';
        return !['string', 'number'].includes(typeof parameters[key]);
      })) return { data: null, error: { message: 'RPC_NOT_ALLOWED' } };
      if (ownerId !== undefined && (!fields.includes('p_owner_id') || parameters.p_owner_id !== ownerId)) return { data: null, error: { message: 'RPC_NOT_ALLOWED' } };
      try {
        const result = await client.rpc(name, parameters);
        if (result?.error) return { data: null, error: { message: SAFE_ERRORS.has(result.error.message) ? result.error.message : 'STORE_UNAVAILABLE' } };
        if (!result || !Object.hasOwn(result, 'data')) unavailable();
        return { data: result.data, error: null };
      } catch { return { data: null, error: { message: 'STORE_UNAVAILABLE' } }; }
    },
  });
}

/** Restrict both destination and operation; do not follow redirects with credentials. */
export function createEdgeBoundedFetch(fetchImpl, kind) {
  return async (input, options = {}) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
    const method = (options.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    let allowed = false;
    if (kind === 'auth') allowed = url.origin === PROJECT_URL && url.pathname === '/auth/v1/user' && method === 'GET';
    if (kind === 'rpc') allowed = url.origin === PROJECT_URL && url.pathname.startsWith('/rest/v1/rpc/') && Object.hasOwn(RPC, url.pathname.slice('/rest/v1/rpc/'.length)) && method === 'POST';
    if (kind === 'oen') allowed = url.origin === 'https://payment-api.testing.oen.tw' && (
      (url.pathname === '/checkout' && method === 'POST') ||
      (/^\/transactions\/[A-Za-z0-9]{27}$/.test(url.pathname) && method === 'GET') ||
      (/^\/order\/preview_[A-Za-z0-9_-]{8,64}\/transactions$/.test(url.pathname) && method === 'GET'));
    if (!allowed || url.search || url.hash || url.username || url.password || typeof fetchImpl !== 'function') unavailable();
    const timeout = AbortSignal.timeout(kind === 'oen' ? 8000 : 4000);
    const sourceSignal = options.signal || (input instanceof Request ? input.signal : null);
    const signal = sourceSignal ? AbortSignal.any([sourceSignal, timeout]) : timeout;
    const result = await fetchImpl(input, { ...options, signal, redirect: 'error', cache: 'no-store' });
    if (!result?.body || typeof result.body.getReader !== 'function') unavailable();
    const reader = result.body.getReader(); const chunks = []; let size = 0;
    try {
      while (true) {
        const read = reader.read();
        const { value, done } = await new Promise((resolve, reject) => {
          const abort = () => reject(Error('SANDBOX_UNAVAILABLE'));
          if (signal.aborted) { abort(); return; }
          signal.addEventListener('abort', abort, { once: true });
          read.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
        });
        if (done) break;
        size += value.byteLength;
        if (size > 131072) unavailable();
        chunks.push(value);
      }
      const bytes = new Uint8Array(size); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      return new Response(bytes, { status: result.status, headers: { 'Content-Type': 'application/json' } });
    } finally { void reader.cancel().catch(() => {}); }
  };
}

/** getEnv is called only during a request; disabled gates precede every secret/auth/DB read. */
export function createEdgeSandboxHandler({ getEnv, createClient, fetchImpl } = {}) {
  return async (request) => {
    try {
      if (typeof getEnv !== 'function' || getEnv('OEN_CHECKOUT_MODE') !== 'sandbox' ||
          getEnv('OEN_SANDBOX_ROUTES_ENABLED') !== 'true' ||
          getEnv('OEN_SANDBOX_ACCESS_POLICY') !== 'protected-tester-only') return reply(503, 'PREVIEW_CHECKOUT_DISABLED');
      const url = new URL(request.url);
      // The gateway can strip /functions/v1 while retaining the function name.
      const prefix = FUNCTION_PATHS.find((value) => url.pathname.startsWith(value));
      const operation = prefix ? url.pathname.slice(prefix.length) : '';
      // req.url may carry an internal gateway origin. It is never authority or an outbound destination.
      if (!['https:', 'http:'].includes(url.protocol) || !Object.hasOwn(OPERATIONS, operation) || url.hash || url.username || url.password) return reply(404, 'NOT_FOUND');
      if (request.method !== OPERATIONS[operation]) return reply(405, 'METHOD_NOT_ALLOWED');
      // Routes can be opened for controlled Auth/status checks while checkout stays off.
      // This separate gate precedes every credential read and Auth/RPC/OEN operation.
      if (['checkout', 'reconcile'].includes(operation) && getEnv('OEN_SANDBOX_PAYMENTS_ENABLED') !== 'true') return reply(503, 'PREVIEW_CHECKOUT_DISABLED');
      const donorPreferencesEnabled = getEnv('OEN_SANDBOX_DONOR_PREFERENCES_ENABLED') === 'true';
      if (['checkout', 'donor-consent'].includes(operation) && !donorPreferencesEnabled) return reply(503, 'PREVIEW_CHECKOUT_DISABLED');
      if (url.search.length > 256) return reply(400, 'INVALID_REQUEST');
      const origin = new URL(getEnv('OEN_PREVIEW_ORIGIN'));
      if (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) unavailable();
      if (request.headers.get('origin') !== origin.origin) return reply(403, 'ORIGIN_DENIED');
      const site = request.headers.get('sec-fetch-site');
      if (site !== null && site !== 'same-origin' && site !== 'none') return reply(403, 'ORIGIN_DENIED');
      const match = /^Bearer ([^\s]{1,16384})$/i.exec(request.headers.get('authorization') || '');
      if (!match) return reply(401, 'AUTHENTICATION_REQUIRED');
      const allowlist = getEnv('OEN_SANDBOX_ALLOWED_USER_IDS');
      if (typeof allowlist !== 'string' || allowlist.length > 4096) unavailable();
      const allowedUserIds = [...new Set(allowlist.split(',').map((id) => id.trim()))];
      if (!allowedUserIds.length || allowedUserIds.length > 20 || allowedUserIds.some((id) => !UUID.test(id))) unavailable();
      if (getEnv('SUPABASE_URL') !== PROJECT_URL || typeof createClient !== 'function') unavailable();
      const options = (kind) => ({ auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: createEdgeBoundedFetch(fetchImpl, kind) } });
      const authClient = createClient(PROJECT_URL, builtinKey(getEnv, 'SUPABASE_ANON_KEY', 'SUPABASE_PUBLISHABLE_KEYS'), options('auth'));
      let ownerId;
      try { ({ ownerId } = await authorizeSandboxTester({ authClient: authClient.auth, accessToken: match[1], allowedUserIds })); }
      catch { return reply(403, 'ACCESS_DENIED'); }
      // Built-in broad key stays inside Supabase. Do not set a caller Authorization header.
      const serviceKey = builtinKey(getEnv, 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEYS');
      const token = operation === 'donor-consent' ? undefined : getEnv('OEN_SANDBOX_TOKEN');
      if (operation !== 'donor-consent' && !boundedValue(token)) unavailable();
      const rpc = createEdgeSandboxRpcClient(createClient(PROJECT_URL, serviceKey, options('rpc')), { ownerId });
      const handlers = createSandboxHandlers({ configuration: { enabled: true, environment: 'sandbox', merchantId: 'sinjmed', origin: origin.origin, token },
        // Reuse only this request's already remotely verified identity; never decoded claims.
        authClient: { getUser: async (candidate) => candidate === match[1] ? { data: { user: { id: ownerId } } } : { error: true } }, allowedUserIds,
        donorPreferencesEnabled,
        orderStoreForOwner: (requestedOwner, donorPreferences) => {
          if (requestedOwner !== ownerId) unavailable();
          return donorPreferencesEnabled ? createSupabaseSandboxDonorOrderStore(rpc, { ownerId, donorPreferences }) : createSupabaseSandboxOrderStore(rpc, { ownerId });
        },
        requestAdmission: async ({ scope }) => Object.hasOwn(OPERATIONS, scope), reconciliationMode: 'owned', reviewDelivery: 'interactive',
        fetchImpl: createEdgeBoundedFetch(fetchImpl, 'oen'),
      });
      const headers = new Headers();
      for (const name of ['authorization', 'origin', 'content-type', 'content-length', 'content-encoding', 'sec-fetch-site']) {
        const value = request.headers.get(name); if (value !== null) headers.set(name, value);
      }
      // Normalize only after checking the function path, fixed configured project and trusted Origin.
      const normalized = new Request(`${origin.origin}/api/sponsorship/${operation}${url.search}`, {
        method: request.method, headers, signal: request.signal,
        ...(request.method === 'POST' ? { body: request.body, duplex: 'half' } : {}),
      });
      return await handlers[operation](normalized);
    } catch { return reply(503, 'SANDBOX_UNAVAILABLE'); }
  };
}
