/** Offline-tested candidate worker. No route, scheduler, or credential loading is wired here. */
import { randomUUID } from 'node:crypto';
import { getSandboxTransaction, verifiedPaidState, normalizeSandboxTransaction, classifySandboxTransaction } from './oen-sandbox.mjs';
const API = 'https://payment-api.testing.oen.tw';
const CHECKOUT_ID = /^[A-Za-z0-9]{27}$/;

function sandboxConfiguration(configuration) {
  if (typeof window !== 'undefined') throw new Error('SERVER_ONLY');
  if (!configuration?.enabled || configuration.environment !== 'sandbox' || !configuration.token) throw new Error('CHECKOUT_DISABLED');
}
export async function getSandboxOrderTransactions({ token, orderId }, fetchImpl = fetch) {
  if (typeof window !== 'undefined') throw new Error('SERVER_ONLY');
  if (!token || !/^preview_[a-zA-Z0-9_-]{8,64}$/.test(orderId || '')) throw new Error('INVALID_REQUEST');
  let response;
  try {
    response = await fetchImpl(`${API}/order/${encodeURIComponent(orderId)}/transactions`, {
      method: 'GET', headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error();
    const envelope = await response.json();
    if (envelope?.code !== 'S0000' || !Array.isArray(envelope.data?.transactions)) throw new Error();
    // Return only verification fields; drop paymentInfo, userName/email, invoice and raw errors.
    return envelope.data.transactions.map(normalizeSandboxTransaction);
  } catch { throw new Error('RECONCILIATION_UNAVAILABLE'); }
}

/** Once a creation outcome is uncertain, only GETs are allowed. No retrying POSTs. */
export async function reconcileDurableSandboxOrder({ configuration, store, order, recheckPaid = false }, fetchImpl = fetch) {
  sandboxConfiguration(configuration);
  if (!store?.durable || !order || order.environment !== 'sandbox' || order.currency !== 'TWD' || typeof store.markVerifiedPaid !== 'function') throw new Error('DURABLE_STORE_REQUIRED');
  if (order.state === 'verified_paid' && !recheckPaid) return { paid: true, outcome: 'verified_paid' };
  let durableOrder = order;
  if (!order.checkoutId) {
    const transactions = await getSandboxOrderTransactions({ token: configuration.token, orderId: order.orderId }, fetchImpl);
    if (transactions.length === 0) return { paid: false, outcome: 'no_transaction' };
    // Never guess between retries/duplicate transactions, even if one looks paid.
    if (transactions.length !== 1) return { paid: false, outcome: 'multiple_transactions' };
    const candidate = transactions[0];
    if (!CHECKOUT_ID.test(candidate.transactionId || '') || candidate.orderId !== order.orderId || candidate.amount !== order.amount || candidate.currency !== 'TWD' || candidate.refundAmount === null || (candidate.action && candidate.action !== 'onetime')) return { paid: false, outcome: 'mismatch' };
    durableOrder = await store.saveCheckout(order.orderId, {
      checkoutId: candidate.transactionId,
      // Recovery cannot extend the original checkout lifetime.
      checkoutExpiresAt: order.createdAt + 5 * 60 * 1000,
    });
  }
  const envelope = await getSandboxTransaction({ token: configuration.token, checkoutId: durableOrder.checkoutId }, fetchImpl);
  const classification = classifySandboxTransaction(envelope, durableOrder);
  const suppressionReason = ['refund_pending', 'partial_refund', 'refunded'].includes(classification) ? classification
    : classification === 'mismatch' || (order.state === 'verified_paid' && classification === 'not_paid') ? 'mismatch' : null;
  if (suppressionReason) {
    // A paid-order audit must not claim durable suppression when no persistence exists.
    if (typeof store.suppressDonor === 'function') await store.suppressDonor(durableOrder.orderId, suppressionReason);
    else if (recheckPaid) throw new Error('DURABLE_SUPPRESSION_REQUIRED');
    return { paid: false, outcome: 'mismatch', suppressionReason, needsReview: true,
      suppressionPersisted: typeof store.suppressDonor === 'function' };
  }
  if (!verifiedPaidState(envelope, durableOrder)) return { paid: false, outcome: 'not_verified_paid' };
  await store.markVerifiedPaid(durableOrder.orderId, durableOrder.checkoutId, durableOrder.amount);
  return { paid: true, outcome: 'verified_paid' };
}

/** A bounded invocation for a separately authenticated scheduler. SQL leases survive crashes.
 * Queue generation prevents a late finish from discarding a newer webhook hint.
 * Returning "retry_scheduled" is not a terminal result; the durable runner must return later.
 */
export async function runSandboxReconciliationBatch({ configuration, store, limit = 5, leaseToken = randomUUID() }, fetchImpl = fetch) {
  sandboxConfiguration(configuration);
  if (!store?.durable || typeof store.claim !== 'function' || typeof store.ordersForOwner !== 'function' || typeof store.finish !== 'function') throw new Error('DURABLE_STORE_REQUIRED');
  const orders = await store.claim({ leaseToken, limit });
  const summary = { claimed: orders.length, verifiedPaid: 0, retryScheduled: 0, leaseLost: 0, needsReview: 0 };
  // At most 10 sequential orders; the database gives the batch a five-minute lease.
  for (const order of orders) {
    let result;
    try {
      result = await reconcileDurableSandboxOrder({ configuration, store: store.ordersForOwner(order.ownerId), order }, fetchImpl);
    } catch {
      // Do not persist provider errors, URLs, payloads, tokens, or payment metadata.
      result = { paid: false, outcome: 'unavailable' };
    }
    const finished = await store.finish({
      orderId: order.orderId, leaseToken, generation: order.generation, outcome: result.outcome,
      retryAfterSeconds: Math.min(3600, 30 * 2 ** Math.min(7, Math.max(0, order.attempts - 1))),
    });
    if (['multiple_transactions', 'mismatch'].includes(result.outcome)) summary.needsReview++;
    if (!finished) summary.leaseLost++;
    else if (result.paid) summary.verifiedPaid++;
    else summary.retryScheduled++;
  }
  return summary;
}
