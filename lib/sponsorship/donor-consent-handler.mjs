/** Injection-only owner withdrawal handler. No OEN requests or payment creation. */
import { authorizeSandboxTester } from './sandbox-access.mjs';
import { readBoundedSandboxJson } from './sandbox-handlers.mjs';
import { safeStoredDonorPreferences } from './donor-order-store.mjs';
const ORDER = /^preview_[a-zA-Z0-9_-]{8,64}$/;
const json = (status, value) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', Vary: 'Origin, Authorization' } });
export function createSandboxDonorConsentHandler({ configuration, authClient, allowedUserIds, orderStoreForOwner, requestAdmission } = {}) {
  return async function donorConsent(request) {
    try {
      if (!configuration?.enabled || configuration.environment !== 'sandbox' || typeof orderStoreForOwner !== 'function' || typeof requestAdmission !== 'function') return json(503, { code: 'SANDBOX_UNAVAILABLE' });
      if (request.method !== 'POST') return json(405, { code: 'METHOD_NOT_ALLOWED' });
      const trusted = new URL(configuration.origin); const url = new URL(request.url);
      if (trusted.protocol !== 'https:' || trusted.username || trusted.password || trusted.pathname !== '/' || trusted.search || trusted.hash || url.origin !== trusted.origin || url.username || url.password || request.headers.get('origin') !== trusted.origin) return json(403, { code: 'ORIGIN_DENIED' });
      const site = request.headers.get('sec-fetch-site');
      if (site !== null && site !== 'same-origin' && site !== 'none') return json(403, { code: 'ORIGIN_DENIED' });
      if (url.search || url.hash) return json(400, { code: 'INVALID_REQUEST' });
      if (await requestAdmission({ request, scope: 'donor-consent' }) !== true) return json(403, { code: 'ACCESS_DENIED' });
      const match = /^Bearer ([^\s]{1,16384})$/i.exec(request.headers.get('authorization') || '');
      if (!match) return json(401, { code: 'AUTHENTICATION_REQUIRED' });
      const { ownerId } = await authorizeSandboxTester({ authClient, accessToken: match[1], allowedUserIds });
      const body = await readBoundedSandboxJson(request, 1024);
      if (Object.keys(body).some(k => !['orderId', 'withdrawDisplayName', 'withdrawAmount'].includes(k)) || !ORDER.test(body.orderId || '') || typeof body.withdrawDisplayName !== 'boolean' || typeof body.withdrawAmount !== 'boolean' || !(body.withdrawDisplayName || body.withdrawAmount)) return json(400, { code: 'INVALID_REQUEST' });
      const store = orderStoreForOwner(ownerId);
      if (!store?.durable || typeof store.withdrawDonorConsent !== 'function') return json(503, { code: 'SANDBOX_UNAVAILABLE' });
      const preferences = safeStoredDonorPreferences(await store.withdrawDonorConsent(body.orderId, { withdrawDisplayName: body.withdrawDisplayName, withdrawAmount: body.withdrawAmount }));
      if (preferences === null) return json(404, { code: 'DONOR_PREFERENCES_NOT_FOUND' });
      // Verify that the requested withdrawal is reflected in the durable result.
      if ((body.withdrawDisplayName && preferences.publishDisplayName) || (body.withdrawAmount && preferences.publishAmount)) return json(503, { code: 'SANDBOX_UNAVAILABLE' });
      return json(200, { environment: 'sandbox', orderId: body.orderId, donorPreferences: preferences });
    } catch (error) {
      if (error?.message === 'SANDBOX_ACCESS_DENIED') return json(403, { code: 'ACCESS_DENIED' });
      if (error?.message === 'ORDER_NOT_FOUND') return json(404, { code: 'ORDER_NOT_FOUND' });
      if ([400, 408, 413, 415].includes(error?.status) && ['INVALID_REQUEST', 'INVALID_JSON', 'BODY_TIMEOUT', 'BODY_TOO_LARGE', 'JSON_REQUIRED', 'ENCODING_UNSUPPORTED'].includes(error?.code)) return json(error.status, { code: error.code });
      return json(503, { code: 'SANDBOX_UNAVAILABLE' });
    }
  };
}
