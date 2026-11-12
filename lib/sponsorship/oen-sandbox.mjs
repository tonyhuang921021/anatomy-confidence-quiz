/** Server-only sandbox adapter. Runtime activation is separately gated.
 * No browser import, no credential logging, no production endpoint.
 * Caller must persist the order and idempotency key before calling.
 * Requires separate authorization, secure token setup and durable reconciliation before enabling.
 */
const API='https://payment-api.testing.oen.tw';
export function checkoutPayload({amount,orderId,origin}){
 if(!Number.isSafeInteger(amount)||amount<1||amount>100000)throw new Error('Invalid amount');
 if(typeof orderId!=='string'||!/^preview_[a-zA-Z0-9_-]{8,64}$/.test(orderId))throw new Error('Invalid order ID');
 const u=new URL(origin);if(u.protocol!=='https:'||u.username||u.password||u.pathname!=='/'||u.search||u.hash)throw new Error('Invalid HTTPS origin');
 return {merchantId:'sinjmed',currency:'TWD',amount,orderId,successUrl:`${u.origin}/payment-return?order=${encodeURIComponent(orderId)}`,failureUrl:`${u.origin}/payment-failure`,productDetails:[{productionCode:'website-support',description:'國考刷題網站單次贊助（測試）',quantity:1,unit:'次',unitPrice:amount}]};
}
export async function createSandboxCheckout({token,idempotencyKey,...input},fetchImpl=fetch){
 if(typeof window!=='undefined')throw new Error('Server only');
 if(!token||!/^preview_[a-zA-Z0-9_-]{8,100}$/.test(idempotencyKey||''))throw new Error('Secure configuration required');
 const body=checkoutPayload(input);
 let response;try{response=await fetchImpl(`${API}/checkout`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json','Idempotency-Key':idempotencyKey},body:JSON.stringify(body),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(8000)});}catch{throw new Error('Checkout uncertain; reconcile order before retry');}
 if(!response.ok)throw new Error('Checkout unavailable; reconcile before retry');
 const result=await response.json();const id=result?.data?.id;if(result?.code!=='S0000'||typeof id!=='string'||!/^[A-Za-z0-9]{27}$/.test(id))throw new Error('Invalid checkout response; reconcile before retry');
 return {checkoutId:id,url:`https://sinjmed.testing.oen.tw/checkout/${id}`};
}
const TRANSACTION_STATUSES = new Set(['initiated','charging','authorized','charged','claimed','failed','cancelled','refunding','refunded','refundedPostPayout']);
/** Transaction GET omits currency by documented contract; Payment API is TWD-only.
 * An explicit conflicting currency is never silently overwritten. Raw payer fields are discarded.
 */
export function normalizeSandboxTransaction(data) {
 if(!data||typeof data!=='object'||Array.isArray(data))throw new Error('INVALID_TRANSACTION');
 const currency=data.currency===undefined?'TWD':typeof data.currency==='string'&&data.currency.toUpperCase()==='TWD'?'TWD':'unsupported';
 const refundAmount=data.refundAmount===undefined?0:data.refundAmount;
 return {transactionId:data.transactionId,orderId:data.orderId,amount:data.amount,
  status:TRANSACTION_STATUSES.has(data.status)?data.status:'unknown',
  action:data.action===undefined?undefined:['onetime','subscription'].includes(data.action)?data.action:'unknown',
  currency,refundAmount:Number.isSafeInteger(refundAmount)&&refundAmount>=0?refundAmount:null};
}
export function classifySandboxTransaction(envelope,order) {
 if(envelope?.code!=='S0000'||!order||order.environment!=='sandbox'||order.currency!=='TWD'||!Number.isSafeInteger(order.amount)||order.amount<1||order.amount>100000)return 'mismatch';
 let transaction;try{transaction=normalizeSandboxTransaction(envelope.data);}catch{return 'mismatch';}
 if(transaction.transactionId!==order.checkoutId||transaction.orderId!==order.orderId||transaction.amount!==order.amount||transaction.currency!=='TWD'||transaction.refundAmount===null||transaction.refundAmount>order.amount||(transaction.action&&transaction.action!=='onetime'))return 'mismatch';
 if(transaction.status==='refunding')return 'refund_pending';
 if(transaction.refundAmount>0)return transaction.refundAmount<order.amount?'partial_refund':'refunded';
 if(['refunded','refundedPostPayout'].includes(transaction.status))return 'refunded';
 if(['charged','claimed'].includes(transaction.status))return 'paid';
 return transaction.status==='unknown'?'mismatch':'not_paid';
}
export function verifiedPaidState(envelope,order){
 // Caller must obtain this envelope from authenticated fixed TEST GET, never a webhook.
 return classifySandboxTransaction(envelope,order)==='paid';
}
export async function getSandboxTransaction({token,checkoutId},fetchImpl=fetch){
 if(typeof window!=='undefined')throw new Error('Server only');
 if(!token||!/^[A-Za-z0-9]{27}$/.test(checkoutId||''))throw new Error('Secure configuration required');
 try {
  const response=await fetchImpl(`${API}/transactions/${checkoutId}`,{method:'GET',headers:{Authorization:`Bearer ${token}`},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(8000)});
  if(!response.ok)throw new Error();
  const envelope=await response.json();if(envelope?.code!=='S0000'||!envelope.data||typeof envelope.data!=='object')throw new Error();
  const data=envelope.data;
  // Verification only. Do not retain payer/card/invoice fields or provider error text.
  return {code:'S0000',data:normalizeSandboxTransaction(data)};
 } catch { throw new Error('Reconciliation unavailable'); }
}
