/** Lazy Node-only TEST wiring. No environment reads or connections at module load.
 * Runtime credentials are consumed only after deliberate Preview activation.
 */
import { X509Certificate } from 'node:crypto';
import { readSandboxConfiguration } from './configuration.mjs';
import { createSandboxHandlers } from './sandbox-handlers.mjs';
import { createSandboxPostgresRpcClient } from './postgres-rpc-transport.mjs';
import { createSupabaseSandboxOrderStore, createSupabaseSandboxReconciliationStore } from './supabase-order-store.mjs';

const PROJECT = 'ejyniduhsyurxocabqqp';
const ROLE = 'oen_sandbox_runtime';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const OPERATIONS = new Set(['checkout', 'status', 'reconcile']);
function serverOnly() { if (typeof window !== 'undefined') throw new Error('SERVER_ONLY'); }
function unavailable() { throw new Error('SANDBOX_UNAVAILABLE'); }
function isPublicAuthKey(key) {
  if (typeof key !== 'string' || key.length > 16384) return false;
  if (/^sb_publishable_[A-Za-z0-9_-]{16,256}$/.test(key)) return true;
  if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(key)) return false;
  try {
    // Classification only: decoded claims are NOT proof of user authentication.
    // getUser still validates every tester token with the exact project's Auth API.
    const claims = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString('utf8'));
    return claims?.role === 'anon' && claims.ref === PROJECT;
  } catch { return false; }
}
function response(code = 'SANDBOX_UNAVAILABLE') {
  return new Response(JSON.stringify({ code }), { status: 503, headers: {
    'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
  } });
}

/** Only nonsecret switches are inspected here. Configuration alone cannot activate checkout. */
export function sandboxRoutesEnabled(env = process.env) {
  serverOnly();
  return env.VERCEL_ENV === 'preview' && env.OEN_CHECKOUT_MODE === 'sandbox' &&
    env.OEN_SANDBOX_ROUTES_ENABLED === 'true' &&
    env.OEN_SANDBOX_ACCESS_POLICY === 'protected-tester-only';
}

/** Parse into explicit fields so URL SSL options cannot replace verified TLS. */
export function sandboxPostgresOptions(connectionString, caPem) {
  serverOnly();
  try {
    if (typeof connectionString !== 'string' || connectionString.length > 8192) unavailable();
    const url = new URL(connectionString);
    const user = decodeURIComponent(url.username);
    const password = decodeURIComponent(url.password);
    const port = url.port || '5432';
    const direct = url.hostname === `db.${PROJECT}.supabase.co` && user === ROLE && port === '5432';
    const pooled = /^[a-z0-9-]+\.pooler\.supabase\.com$/.test(url.hostname) &&
      user === `${ROLE}.${PROJECT}` && ['5432', '6543'].includes(port);
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.pathname !== '/postgres' ||
        url.hash || !password || !(direct || pooled)) unavailable();
    for (const [key, value] of url.searchParams) {
      // require / verify-full are safely strengthened to certificate verification below.
      if (key !== 'sslmode' || !['require', 'verify-full'].includes(value)) unavailable();
    }
    if (url.searchParams.getAll('sslmode').length > 1) unavailable();
    let ca;
    if (caPem !== undefined && caPem !== '') {
      if (typeof caPem !== 'string' || caPem.length > 32768 || /PRIVATE KEY/.test(caPem)) unavailable();
      ca = caPem.trim();
      if (!/^-----BEGIN CERTIFICATE-----[A-Za-z0-9+/=\r\n]+-----END CERTIFICATE-----$/.test(ca)) unavailable();
      const certificate = new X509Certificate(ca);
      if (!certificate.ca) unavailable();
      // Only a CA obtained from this project's official SSL Configuration panel
      // may be configured by the owner. Hostname/certificate verification stays on.
    }
    return { host: url.hostname, port: Number(port), user, password, database: 'postgres',
      ssl: { rejectUnauthorized: true, ...(ca ? { ca } : {}) }, max: 1, connectionTimeoutMillis: 1500,
      idleTimeoutMillis: 1000, statement_timeout: 3000, query_timeout: 4500,
      application_name: 'oen-sandbox-preview', allowExitOnIdle: true };
  } catch { unavailable(); }
}

/** Dependency injection exists for offline tests; production dependencies are loaded lazily. */
export async function createSandboxRuntime({ env = process.env, PoolClass, createAuthClient, fetchImpl = globalThis.fetch } = {}) {
  serverOnly();
  if (!sandboxRoutesEnabled(env)) return null;
  let pool;
  try {
    const configuration = readSandboxConfiguration(env);
    if (!configuration.enabled || typeof fetchImpl !== 'function') unavailable();
    const authUrl = env.OEN_SUPABASE_URL;
    if (authUrl !== `https://${PROJECT}.supabase.co`) unavailable();
    const publishableKey = env.OEN_SUPABASE_PUBLISHABLE_KEY;
    // Existing project-bound legacy anon keys are also public Auth configuration.
    // Never accept a service-role JWT or sb_secret key.
    if (!isPublicAuthKey(publishableKey)) unavailable();
    const allowlist = env.OEN_SANDBOX_ALLOWED_USER_IDS;
    if (typeof allowlist !== 'string' || allowlist.length > 4096) unavailable();
    const allowedUserIds = [...new Set(allowlist.split(',').map((id) => id.trim()))];
    if (!allowedUserIds.length || allowedUserIds.length > 20 || allowedUserIds.some((id) => !UUID.test(id))) unavailable();
    const poolOptions = sandboxPostgresOptions(env.OEN_SANDBOX_DATABASE_URL, env.OEN_DATABASE_CA_CERT);
    const Pool = PoolClass ?? (await import('pg')).Pool;
    const createClient = createAuthClient ?? (await import('@supabase/supabase-js')).createClient;
    const authFetch = (url, options = {}) => {
      const signal = options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(8000)]) : AbortSignal.timeout(8000);
      return fetchImpl(url, { ...options, signal, cache: 'no-store', redirect: 'error' });
    };
    const client = createClient(authUrl, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: authFetch },
    });
    if (typeof client?.auth?.getUser !== 'function') unavailable();
    pool = new Pool(poolOptions);
    // Idle connection failures are handled without dumping sensitive driver errors.
    pool.on('error', () => {});
    const rpc = createSandboxPostgresRpcClient(pool);
    const handlers = createSandboxHandlers({ configuration, authClient: client.auth, allowedUserIds,
      orderStoreForOwner: (ownerId) => createSupabaseSandboxOrderStore(rpc, { ownerId }),
      reconciliationStore: createSupabaseSandboxReconciliationStore(rpc),
      // This is an explicit protected TEST admission policy, not a distributed limiter.
      // Vercel deployment protection must remain on; verified allowlist auth follows.
      // New order creation is separately capped atomically by the database RPC.
      requestAdmission: async ({ scope }) => OPERATIONS.has(scope),
      reconciliationMode: 'owned', reviewDelivery: 'interactive', fetchImpl,
    });
    return Object.freeze({ handlers, close: async () => { await pool.end(); } });
  } catch {
    if (pool) { try { await pool.end(); } catch { /* Never emit credentials/driver errors. */ } }
    unavailable();
  }
}

/** No webhook or scheduler route is activated by this dispatcher. */
export async function handleSandboxRequest(operation, request, dependencies = {}) {
  if (!OPERATIONS.has(operation) || operation === 'checkout') return response('PREVIEW_CHECKOUT_DISABLED');
  const env = dependencies.env ?? process.env;
  if (!sandboxRoutesEnabled(env) || (operation !== 'status' && env.OEN_SANDBOX_PAYMENTS_ENABLED !== 'true')) return response('PREVIEW_CHECKOUT_DISABLED');
  let runtime;
  try {
    runtime = await createSandboxRuntime(dependencies);
    if (!runtime) return response('PREVIEW_CHECKOUT_DISABLED');
    return await runtime.handlers[operation](request);
  } catch { return response(); }
  finally { if (runtime) { try { await runtime.close(); } catch { /* No raw errors. */ } } }
}
