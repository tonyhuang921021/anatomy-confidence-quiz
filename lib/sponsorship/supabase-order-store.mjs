/** Server-only repository candidate. Inject an authorized server Supabase client.
 * No credentials or environment variables are read here. The SQL proposal must be
 * applied and database concurrency/privilege tests passed before route activation.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ORDER_ID = /^preview_[a-zA-Z0-9_-]{8,64}$/;
const CHECKOUT_ID = /^[A-Za-z0-9]{27}$/;
const STATES = new Set(['reserved', 'pending', 'uncertain', 'verified_paid']);
const SAFE_ERRORS = new Set(['IDEMPOTENCY_CONFLICT', 'ORDER_CONFLICT', 'ORDER_NOT_FOUND', 'RATE_LIMITED']);

function serverOnly() {
  if (typeof window !== 'undefined') throw new Error('SERVER_ONLY');
}
function validId(value, pattern) {
  if (typeof value !== 'string' || !pattern.test(value)) throw new Error('INVALID_REQUEST');
  return value;
}
function validAmount(amount) {
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > 100000) throw new Error('INVALID_REQUEST');
  return amount;
}
function timestamp(value, nullable = false) {
  if (nullable && value === null) return null;
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new Error('INVALID_STORE_RESPONSE');
  return Date.parse(value);
}
function mapOrder(row, expectedOwner) {
  if (!row || row.environment !== 'sandbox' || row.currency !== 'TWD' || !STATES.has(row.state)) throw new Error('INVALID_STORE_RESPONSE');
  if (expectedOwner && row.owner_id !== expectedOwner) throw new Error('ORDER_NOT_FOUND');
  const ownerId = validId(row.owner_id, UUID);
  const orderId = validId(row.order_id, ORDER_ID);
  const checkoutId = row.checkout_id === null ? null : validId(row.checkout_id, CHECKOUT_ID);
  const checkoutExpiresAt = timestamp(row.checkout_expires_at, true);
  if (Boolean(checkoutId) !== (checkoutExpiresAt !== null)) throw new Error('INVALID_STORE_RESPONSE');
  return {
    ownerId, orderId, requestKey: row.request_key,
    idempotencyKey: validId(row.idempotency_key, /^preview_[a-zA-Z0-9_-]{8,100}$/),
    amount: validAmount(row.amount), currency: 'TWD', environment: 'sandbox', state: row.state,
    checkoutId,
    // A paid order must never return an active pay-again URL.
    checkoutUrl: checkoutId && row.state !== 'verified_paid' ? `https://sinjmed.testing.oen.tw/checkout/${checkoutId}` : null,
    checkoutExpiresAt,
    createdAt: timestamp(row.created_at),
    verifiedPaidAt: timestamp(row.verified_paid_at, true),
    attempts: row.reconciliation_attempts,
    generation: row.reconciliation_generation,
    leaseToken: row.lease_token,
    // Only a bounded verification outcome is exposed internally, never raw errors.
    lastOutcome: ['verified_paid', 'not_verified_paid', 'unavailable', 'no_transaction', 'multiple_transactions', 'mismatch'].includes(row.last_outcome) ? row.last_outcome : null,
  };
}
function rpcCaller(client) {
  serverOnly();
  if (!client || typeof client.rpc !== 'function') throw new Error('DURABLE_STORE_REQUIRED');
  return async (name, parameters) => {
    serverOnly();
    let result;
    try { result = await client.rpc(`sponsorship_sandbox_${name}`, parameters); }
    catch { throw new Error('STORE_UNAVAILABLE'); }
    if (result?.error) {
      // Never leak PostgREST detail/hint, a connection string, or response body.
      const message = result.error.message;
      throw new Error(SAFE_ERRORS.has(message) ? message : 'STORE_UNAVAILABLE');
    }
    if (!result || !Object.hasOwn(result, 'data')) throw new Error('INVALID_STORE_RESPONSE');
    return result.data;
  };
}

/** ownerId must come from server auth.getUser(), never from request JSON. */
export function createSupabaseSandboxOrderStore(client, { ownerId } = {}) {
  const rpc = rpcCaller(client);
  validId(ownerId, UUID);
  const owned = (orderId) => ({ p_owner_id: ownerId, p_order_id: validId(orderId, ORDER_ID) });
  return Object.freeze({
    durable: true,
    async reserve({ requestKey, amount, orderId, idempotencyKey, environment }) {
      if (environment !== 'sandbox') throw new Error('INVALID_REQUEST');
      const result = await rpc('reserve', {
        ...owned(orderId), p_request_key: validId(requestKey, /^[a-zA-Z0-9_-]{8,100}$/),
        p_amount: validAmount(amount), p_idempotency_key: validId(idempotencyKey, /^preview_[a-zA-Z0-9_-]{8,100}$/),
      });
      if (typeof result?.created !== 'boolean') throw new Error('INVALID_STORE_RESPONSE');
      return { created: result.created, order: mapOrder(result.order, ownerId) };
    },
    async saveCheckout(orderId, { checkoutId, checkoutExpiresAt }) {
      validId(checkoutId, CHECKOUT_ID);
      if (!Number.isSafeInteger(checkoutExpiresAt) || checkoutExpiresAt < 0) throw new Error('INVALID_REQUEST');
      const row = await rpc('save_checkout', {
        ...owned(orderId), p_checkout_id: checkoutId, p_checkout_expires_at: new Date(checkoutExpiresAt).toISOString(),
      });
      return mapOrder(row, ownerId);
    },
    async markUncertain(orderId) {
      return mapOrder(await rpc('mark_uncertain', owned(orderId)), ownerId);
    },
    async getOrder(orderId) {
      const row = await rpc('get_order', owned(orderId));
      return row === null ? null : mapOrder(row, ownerId);
    },
    async markVerifiedPaid(orderId, checkoutId, expectedAmount) {
      // Only the authenticated-GET worker calls this with its durable order amount.
      const row = await rpc('mark_verified_paid', {
        ...owned(orderId), p_checkout_id: validId(checkoutId, CHECKOUT_ID), p_expected_amount: validAmount(expectedAmount),
      });
      const order = mapOrder(row, ownerId);
      if (order.state !== 'verified_paid') throw new Error('INVALID_STORE_RESPONSE');
      return order;
    },
  });
}

/** Privileged worker interface. Never expose this client or returned rows to a browser. */
export function createSupabaseSandboxReconciliationStore(client) {
  const rpc = rpcCaller(client);
  return Object.freeze({
    durable: true,
    ordersForOwner(ownerId) { return createSupabaseSandboxOrderStore(client, { ownerId }); },
    async queueHint({ checkoutId }) {
      // No webhook amount/status or raw payload is accepted. Unknown IDs cannot create orders.
      return (await rpc('queue_hint', { p_checkout_id: validId(checkoutId, CHECKOUT_ID) })) === true;
    },
    async claim({ leaseToken, limit = 5 } = {}) {
      validId(leaseToken, UUID);
      if (!Number.isInteger(limit) || limit < 1 || limit > 10) throw new Error('INVALID_REQUEST');
      const rows = await rpc('claim', { p_lease_token: leaseToken, p_limit: limit });
      if (!Array.isArray(rows) || rows.length > limit) throw new Error('INVALID_STORE_RESPONSE');
      return rows.map((row) => {
        const order = mapOrder(row);
        if (order.leaseToken !== leaseToken || !Number.isSafeInteger(order.generation) || !Number.isSafeInteger(order.attempts)) throw new Error('INVALID_STORE_RESPONSE');
        return order;
      });
    },
    async finish({ orderId, leaseToken, generation, outcome, retryAfterSeconds = 60 }) {
      validId(orderId, ORDER_ID); validId(leaseToken, UUID);
      if (!Number.isSafeInteger(generation) || generation < 1 || !['verified_paid', 'not_verified_paid', 'unavailable', 'no_transaction', 'multiple_transactions', 'mismatch'].includes(outcome)) throw new Error('INVALID_REQUEST');
      if (!Number.isSafeInteger(retryAfterSeconds) || retryAfterSeconds < 30 || retryAfterSeconds > 3600) throw new Error('INVALID_REQUEST');
      return (await rpc('finish', {
        p_order_id: orderId, p_lease_token: leaseToken, p_generation: generation,
        p_outcome: outcome, p_retry_after_seconds: retryAfterSeconds,
      })) === true;
    },
  });
}
