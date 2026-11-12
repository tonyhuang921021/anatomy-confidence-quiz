/** Server-only frontend origin resolution. Never derive trust from request headers. */
export function readSandboxFrontendOrigin(env = process.env) {
  if (typeof window !== 'undefined') throw new Error('SERVER_ONLY');
  const configured = env.OEN_PREVIEW_ORIGIN;
  if (configured !== undefined && configured !== '') {
    if (typeof configured !== 'string' || configured.length > 2048) throw new Error('SANDBOX_UNAVAILABLE');
    const url = new URL(configured);
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('SANDBOX_UNAVAILABLE');
    return url.origin;
  }
  // VERCEL_URL is set by the platform for this immutable deployment. The Edge
  // backend separately pins the resulting exact origin before accepting traffic.
  if (env.VERCEL_ENV !== 'preview' || env.OEN_SANDBOX_BACKEND !== 'edge') throw new Error('SANDBOX_UNAVAILABLE');
  const hostname = env.VERCEL_URL;
  if (typeof hostname !== 'string' || hostname.length > 253 || !/^[a-z0-9-]+\.vercel\.app$/.test(hostname)) throw new Error('SANDBOX_UNAVAILABLE');
  return `https://${hostname}`;
}
