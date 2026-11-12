/** Server-only. No process.env values are read at module load or sent to clients. */
export function readSandboxConfiguration(env) {
  if (typeof window !== 'undefined') throw new Error('Server only');
  if (env.OEN_CHECKOUT_MODE !== 'sandbox') return { enabled: false, reason: 'disabled' };
  if (!env.OEN_SANDBOX_TOKEN || !env.OEN_PREVIEW_ORIGIN) return { enabled: false, reason: 'missing_secure_configuration' };
  const origin = new URL(env.OEN_PREVIEW_ORIGIN);
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) throw new Error('Invalid trusted preview origin');
  return { enabled: true, token: env.OEN_SANDBOX_TOKEN, origin: origin.origin, merchantId: 'sinjmed', environment: 'sandbox' };
}
