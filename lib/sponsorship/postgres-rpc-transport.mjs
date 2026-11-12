/** Injection-only pg Pool/Client adapter. No driver import or credential handling.
 * All SQL identifiers/types are fixed below; user strings become bound parameters.
 */
const RPC = Object.freeze({
  sponsorship_sandbox_reserve: [['p_owner_id', 'uuid'], ['p_request_key', 'text'], ['p_amount', 'integer'], ['p_order_id', 'text'], ['p_idempotency_key', 'text']],
  sponsorship_sandbox_save_checkout: [['p_owner_id', 'uuid'], ['p_order_id', 'text'], ['p_checkout_id', 'text'], ['p_checkout_expires_at', 'timestamptz']],
  sponsorship_sandbox_mark_uncertain: [['p_owner_id', 'uuid'], ['p_order_id', 'text']],
  sponsorship_sandbox_get_order: [['p_owner_id', 'uuid'], ['p_order_id', 'text']],
  sponsorship_sandbox_mark_verified_paid: [['p_owner_id', 'uuid'], ['p_order_id', 'text'], ['p_checkout_id', 'text'], ['p_expected_amount', 'integer']],
  sponsorship_sandbox_queue_hint: [['p_checkout_id', 'text']],
  sponsorship_sandbox_claim: [['p_lease_token', 'uuid'], ['p_limit', 'integer']],
  sponsorship_sandbox_finish: [['p_order_id', 'text'], ['p_lease_token', 'uuid'], ['p_generation', 'bigint'], ['p_outcome', 'text'], ['p_retry_after_seconds', 'integer']],
});
const SAFE = new Set(['IDEMPOTENCY_CONFLICT', 'ORDER_CONFLICT', 'ORDER_NOT_FOUND', 'RATE_LIMITED']);
export function createSandboxPostgresRpcClient(queryClient) {
  if (typeof window !== 'undefined') throw new Error('SERVER_ONLY');
  if (typeof queryClient?.query !== 'function') throw new Error('DATABASE_TRANSPORT_REQUIRED');
  return Object.freeze({
    async rpc(name, parameters) {
      if (typeof window !== 'undefined') throw new Error('SERVER_ONLY');
      if (typeof name !== 'string' || !Object.hasOwn(RPC, name) || !parameters || typeof parameters !== 'object' || Array.isArray(parameters)) return { data: null, error: { message: 'RPC_NOT_ALLOWED' } };
      const fields = RPC[name];
      if (Object.keys(parameters).length !== fields.length || fields.some(([field]) => !Object.hasOwn(parameters, field) || parameters[field] === undefined)) return { data: null, error: { message: 'RPC_NOT_ALLOWED' } };
      const sql = `select public.${name}(${fields.map(([, type], index) => `$${index + 1}::${type}`).join(', ')}) as data`;
      try {
        const result = await queryClient.query(sql, fields.map(([field]) => parameters[field]));
        if (!Array.isArray(result?.rows) || result.rows.length !== 1 || !Object.hasOwn(result.rows[0], 'data')) throw new Error();
        return { data: result.rows[0].data, error: null };
      } catch (error) {
        return { data: null, error: { message: SAFE.has(error?.message) ? error.message : 'STORE_UNAVAILABLE' } };
      }
    },
  });
}
