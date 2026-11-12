/** Server-side additive TEST profile adapter. Requires the reviewed donor SQL first. */
import { createSupabaseSandboxOrderStore } from './supabase-order-store.mjs';
import { normalizeDonorPreferences } from './donor-projection.mjs';
const ORDER = /^preview_[a-zA-Z0-9_-]{8,64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SAFE_ERRORS = new Set(['ORDER_NOT_FOUND', 'IDEMPOTENCY_CONFLICT', 'RATE_LIMITED', 'INVALID_REQUEST']);
export function safeStoredDonorPreferences(value) {
  if (value === null) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k => !['displayName', 'publishDisplayName', 'publishAmount', 'revision'].includes(k)) || !Number.isSafeInteger(value.revision) || value.revision < 1 || value.revision > 2147483647) throw Error('INVALID_STORE_RESPONSE');
  const normalized = normalizeDonorPreferences({ displayName: value.displayName ?? '', publishDisplayName: value.publishDisplayName, publishAmount: value.publishAmount });
  if (normalized.displayName !== value.displayName || normalized.publishDisplayName !== value.publishDisplayName || normalized.publishAmount !== value.publishAmount) throw Error('INVALID_STORE_RESPONSE');
  return Object.freeze({ ...normalized, revision: value.revision });
}
export function createSupabaseSandboxDonorOrderStore(client, { ownerId, donorPreferences } = {}) {
  if (typeof document !== 'undefined' || !UUID.test(ownerId || '') || !client || typeof client.rpc !== 'function') throw Error('DURABLE_STORE_REQUIRED');
  if (donorPreferences !== undefined && (!donorPreferences || typeof donorPreferences !== 'object' || Array.isArray(donorPreferences))) throw Error('INVALID_DONOR_PREFERENCES');
  const preferences = normalizeDonorPreferences(donorPreferences === undefined ? {} : { ...donorPreferences, displayName: donorPreferences?.displayName ?? '' });
  const base = createSupabaseSandboxOrderStore(client, { ownerId });
  const owned = orderId => {
    if (typeof orderId !== 'string' || !ORDER.test(orderId)) throw Error('INVALID_REQUEST');
    return { p_owner_id: ownerId, p_order_id: orderId };
  };
  const rpc = async (name, parameters) => {
    let result;
    try { result = await client.rpc(name, parameters); } catch { throw Error('STORE_UNAVAILABLE'); }
    if (result?.error) throw Error(SAFE_ERRORS.has(result.error.message) ? result.error.message : 'STORE_UNAVAILABLE');
    if (!result || !Object.hasOwn(result, 'data')) throw Error('INVALID_STORE_RESPONSE');
    return result.data;
  };
  async function getDonorPreferences(orderId) {
    return safeStoredDonorPreferences(await rpc('sponsorship_sandbox_get_donor_preferences', owned(orderId)));
  }
  return Object.freeze({ ...base,
    async reserve(input) {
      let storedPreferences;
      const atomic = createSupabaseSandboxOrderStore({ rpc: async (name, args) => {
        if (name !== 'sponsorship_sandbox_reserve') throw Error('INVALID_REQUEST');
        let data;
        try { data = await rpc('sponsorship_sandbox_reserve_donor_order', { ...args, p_display_name: preferences.displayName, p_publish_display_name: preferences.publishDisplayName, p_publish_amount: preferences.publishAmount }); }
        catch (error) { if (SAFE_ERRORS.has(error?.message)) return { data: null, error: { message: error.message } }; throw error; }
        storedPreferences = safeStoredDonorPreferences(data?.donorPreferences);
        if (!storedPreferences || storedPreferences.revision !== 1 || storedPreferences.displayName !== preferences.displayName || storedPreferences.publishDisplayName !== preferences.publishDisplayName || storedPreferences.publishAmount !== preferences.publishAmount) throw Error('INVALID_STORE_RESPONSE');
        return { data };
      } }, { ownerId });
      const reserved = await atomic.reserve(input);
      return { ...reserved, order: { ...reserved.order, donorPreferences: storedPreferences } };
    },
    async getOrder(orderId) {
      const order = await base.getOrder(orderId);
      return order === null ? null : { ...order, donorPreferences: await getDonorPreferences(orderId) };
    },
    getDonorPreferences,
    async withdrawDonorConsent(orderId, value) {
      if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k => !['withdrawDisplayName', 'withdrawAmount'].includes(k)) || typeof value.withdrawDisplayName !== 'boolean' || typeof value.withdrawAmount !== 'boolean' || !(value.withdrawDisplayName || value.withdrawAmount)) throw Error('INVALID_REQUEST');
      return safeStoredDonorPreferences(await rpc('sponsorship_sandbox_withdraw_donor_consent', { ...owned(orderId), p_withdraw_display_name: value.withdrawDisplayName, p_withdraw_amount: value.withdrawAmount }));
    },
  });
}
