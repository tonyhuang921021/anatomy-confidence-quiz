/** Server-only bootstrap for the isolated tester UI. No OEN/database configuration reads. */
import { sandboxRoutesEnabled } from './sandbox-runtime.mjs';
import { authorizeSandboxTester } from './sandbox-access.mjs';
import { readBoundedSandboxJson } from './sandbox-handlers.mjs';
import { SANDBOX_AUTH_URL } from './sandbox-ui.mjs';
import { readSandboxFrontendOrigin } from './preview-origin.mjs';
const PROJECT = 'ejyniduhsyurxocabqqp';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
function serverOnly() { if (typeof window !== 'undefined') throw new Error('SERVER_ONLY'); }
function publicKey(key) {
  if (typeof key !== 'string' || key.length > 16384) return false;
  if (/^sb_publishable_[A-Za-z0-9_-]{16,256}$/.test(key)) return true;
  if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(key)) return false;
  try {
    const claims = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString('utf8'));
    return claims?.role === 'anon' && claims.ref === PROJECT;
  } catch { return false; }
}
function allowedUsers(env) {
  const raw = env.OEN_SANDBOX_ALLOWED_USER_IDS;
  if (typeof raw !== 'string' || raw.length > 4096) throw new Error('SANDBOX_UNAVAILABLE');
  const ids = [...new Set(raw.split(',').map((id) => id.trim()))];
  if (!ids.length || ids.length > 20 || ids.some((id) => !UUID.test(id))) throw new Error('SANDBOX_UNAVAILABLE');
  return ids;
}
export function readSandboxPublicAuthConfiguration(env = process.env) {
  serverOnly();
  if (!sandboxRoutesEnabled(env)) return null;
  if (env.OEN_SUPABASE_URL !== SANDBOX_AUTH_URL || !publicKey(env.OEN_SUPABASE_PUBLISHABLE_KEY)) throw new Error('SANDBOX_UNAVAILABLE');
  allowedUsers(env);
  const donorPreferencesEnabled = env.OEN_SANDBOX_DONOR_PREFERENCES_ENABLED === 'true' && env.OEN_SANDBOX_BACKEND === 'edge';
  return { environment: 'sandbox', supabaseUrl: SANDBOX_AUTH_URL, publishableKey: env.OEN_SUPABASE_PUBLISHABLE_KEY,
    checkoutEnabled: env.OEN_SANDBOX_PAYMENTS_ENABLED === 'true' && donorPreferencesEnabled,
    donorPreferencesEnabled };
}
function json(status, body) {
  return new Response(JSON.stringify(body), { status, headers: {
    'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
    Vary: 'Origin, Authorization',
  } });
}
/** Public configuration is not authorization. Session preflight verifies the real user remotely. */
export async function handleSandboxTestAuth(operation, request, { env = process.env, createAuthClient, fetchImpl = globalThis.fetch } = {}) {
  serverOnly();
  if (!['config', 'session'].includes(operation)) return json(404, { code: 'NOT_FOUND' });
  try {
    const configuration = readSandboxPublicAuthConfiguration(env);
    if (!configuration) return json(503, { code: 'PREVIEW_CHECKOUT_DISABLED' });
    const origin = new URL(readSandboxFrontendOrigin(env));
    const url = new URL(request.url);
    const method = operation === 'config' ? 'GET' : 'POST';
    if (request.method !== method) return json(405, { code: 'METHOD_NOT_ALLOWED' });
    if (url.search || url.origin !== origin.origin || url.username || url.password) return json(403, { code: 'ORIGIN_DENIED' });
    const requestOrigin = request.headers.get('origin');
    const site = request.headers.get('sec-fetch-site');
    if ((operation === 'session' && requestOrigin !== origin.origin) ||
      (requestOrigin !== null && requestOrigin !== origin.origin) ||
      (site !== null && site !== 'same-origin' && site !== 'none')) return json(403, { code: 'ORIGIN_DENIED' });
    if (operation === 'config') return json(200, configuration);
    const match = /^Bearer ([^\s]{1,16384})$/i.exec(request.headers.get('authorization') || '');
    if (!match) return json(401, { code: 'AUTHENTICATION_REQUIRED' });
    const body = await readBoundedSandboxJson(request, 256);
    if (Object.keys(body).length) return json(400, { code: 'INVALID_REQUEST' });
    const createClient = createAuthClient ?? (await import('@supabase/supabase-js')).createClient;
    const client = createClient(configuration.supabaseUrl, configuration.publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: (target, options = {}) => {
        const targetUrl = new URL(typeof target === 'string' ? target : target.url ?? target.href);
        if (targetUrl.origin !== SANDBOX_AUTH_URL || !targetUrl.pathname.startsWith('/auth/v1/')) throw new Error('SANDBOX_ACCESS_DENIED');
        const signal = AbortSignal.any([request.signal, AbortSignal.timeout(8000), ...(options.signal ? [options.signal] : [])]);
        return fetchImpl(target, { ...options, signal, cache: 'no-store', redirect: 'error' });
      } },
    });
    await authorizeSandboxTester({ authClient: client.auth, accessToken: match[1], allowedUserIds: allowedUsers(env) });
    return json(200, { environment: 'sandbox', authenticated: true });
  } catch (error) {
    if (error?.message === 'SANDBOX_ACCESS_DENIED') return json(403, { code: 'ACCESS_DENIED' });
    return json(503, { code: 'SANDBOX_UNAVAILABLE' });
  }
}
