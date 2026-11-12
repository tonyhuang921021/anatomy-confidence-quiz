import {createSandboxCheckout,getSandboxTransaction,verifiedPaidState} from './oen-sandbox.mjs';
/** A durable transactional repository is REQUIRED; never substitute an in-memory store in a deployed route.
 * reserve must atomically persist a unique requestKey/orderId/idempotencyKey BEFORE the remote call,
 * return {created,order}, enforce requestKey uniqueness and reject same-key changed amounts.
 * saveCheckout must use a compare-and-set transaction; markVerifiedPaid must be monotonic and idempotent.
 * This service is intentionally not wired to the public preview route until a real repository is approved.
 */
export async function requestSandboxCheckout({configuration,store,requestKey,amount,orderId,idempotencyKey},fetchImpl=fetch){
 if(!configuration?.enabled)throw new Error('CHECKOUT_DISABLED');
 if(!store?.durable||!['reserve','saveCheckout','markUncertain'].every(k=>typeof store[k]==='function'))throw new Error('DURABLE_STORE_REQUIRED');
 if(!Number.isSafeInteger(amount)||amount<1||amount>100000||!/^[a-zA-Z0-9_-]{8,100}$/.test(requestKey||''))throw new Error('INVALID_REQUEST');
 const reserved=await store.reserve({requestKey,amount,orderId,idempotencyKey,environment:'sandbox'});
 const order=reserved.order;
 if(order.amount!==amount||order.environment!=='sandbox')throw new Error('IDEMPOTENCY_CONFLICT');
 if(!reserved.created){
  if(order.checkoutUrl&&order.checkoutExpiresAt>Date.now())return {checkoutId:order.checkoutId,url:order.checkoutUrl};
  throw new Error('RECONCILIATION_REQUIRED');
 }
 const startedAt=Date.now();
 try{
  const checkout=await createSandboxCheckout({token:configuration.token,origin:configuration.origin,amount:order.amount,orderId:order.orderId,idempotencyKey:order.idempotencyKey},fetchImpl);
  await store.saveCheckout(order.orderId,{checkoutId:checkout.checkoutId,checkoutUrl:checkout.url,checkoutExpiresAt:startedAt+5*60*1000});
  return checkout;
 }catch{
  await store.markUncertain(order.orderId);
  // Includes failure to persist a successful remote response: never create a new charge attempt blindly.
  throw new Error('RECONCILIATION_REQUIRED');
 }
}
/** Legacy one-order verifier; prefer the leased worker in durable-reconciliation.mjs.
 * Only call after a webhook hint has been durably queued, or from scheduled reconciliation.
 * Never trust amount/status from the unsigned webhook. Read OEN via authenticated server GET.
 */
export async function reconcileSandboxOrder({configuration,store,order},fetchImpl=fetch){
 if(!configuration?.enabled||!store?.durable||typeof store.markVerifiedPaid!=='function')throw new Error('DURABLE_STORE_REQUIRED');
 if(!order?.checkoutId)throw new Error('ORDER_QUERY_REQUIRED');
 const envelope=await getSandboxTransaction({token:configuration.token,checkoutId:order.checkoutId},fetchImpl);
 if(!verifiedPaidState(envelope,order))return {paid:false,status:'not_verified_paid'};
 await store.markVerifiedPaid(order.orderId,order.checkoutId,order.amount);return {paid:true,status:'verified_paid'};
}
