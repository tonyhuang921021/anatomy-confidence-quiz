// ISOLATED CANDIDATE ONLY. Requires reviewed shared-route-ledger installer and verified pricing.
import { createHash, randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createOpenAIText, getOpenAIModel } from '@/lib/openai';

type Kind = 'custom_search' | 'classification' | 'owner_neuro';
type Client = { rpc: (name:string, args:Record<string,unknown>) => PromiseLike<{data:any; error:any}> };
const OUTPUT_LIMITS: Record<Kind, number[]> = {custom_search:[500,900],classification:[600],owner_neuro:[1200]};
const MAX_PROMPT_BYTES = 100_000;
const TIMEOUT_MS = 2000;
async function rpc(db:Client,name:string,args:Record<string,unknown>) {
  let timer:ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([Promise.resolve(db.rpc(name,args)),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('guard_timeout')),TIMEOUT_MS)})]); }
  finally { if(timer) clearTimeout(timer); }
}
export async function withSharedPaidGuard<T>(args:{db:Client;actorId:string;kind:Kind;actionIdentity:string;work:(call:(prompt:string,maxOutputTokens:number)=>Promise<Awaited<ReturnType<typeof createOpenAIText>>>)=>Promise<T>}):Promise<T> {
  const {db,actorId,kind} = args;
  const model=getOpenAIModel();
  const revision=process.env.AI_SHARED_PRICING_REVISION;
  const inRate=Number(process.env.AI_SHARED_INPUT_MICROUSD_PER_MILLION);
  const outRate=Number(process.env.AI_SHARED_OUTPUT_MICROUSD_PER_MILLION);
  if (!revision || !Number.isSafeInteger(inRate) || inRate<=0 || !Number.isSafeInteger(outRate) || outRate<=0) throw new Error('guard_configuration_unavailable');
  const id=randomUUID();
  const actionHash=createHash('sha256').update(args.actionIdentity).digest('hex');
  const reserved=await rpc(db,'ai_guard_reserve_route',{p_id:id,p_actor:actorId,p_kind:kind,p_action_hash:actionHash});
  if (reserved.error || reserved.data !== 'reserved') {
    const reason = ['budget','action_busy','actor_busy','busy','cooldown','rate'].includes(reserved.data) ? reserved.data : 'unavailable';
    throw new Error(`paid_guard:${reason}`);
  }
  const info=await rpc(db,'ai_guard_read_reservation',{p_id:id,p_actor:actorId});
  const row=Array.isArray(info.data) ? info.data[0] : info.data;
  const ceiling=Number(row?.per_call_ceiling_microusd);
  const highest=Math.max(...OUTPUT_LIMITS[kind]);
  const sum=MAX_PROMPT_BYTES*inRate+highest*outRate;
  const worst=Math.ceil(sum/1_000_000);
  if (info.error || !row || row.model!==model || row.pricing_revision!==revision || Number(row.call_limit)!==OUTPUT_LIMITS[kind].length || !Number.isSafeInteger(sum) || !Number.isSafeInteger(ceiling) || ceiling<worst) throw new Error('guard_reservation_held');
  let seq=0, unresolved=false, inFlight=false;
  const stop=async (n:number) => {
    try { const result=await rpc(db,'ai_guard_mark_unknown',{p_id:id,p_seq:n}); if (!result.error && result.data==='disabled_held') return; } catch {}
    // A lost settlement response can leave the call settled; an independent global stop is required.
    try { const result=await rpc(db,'ai_guard_disable',{p_reason:'provider_unknown'}); if (!result.error && result.data==='disabled') return; } catch {}
    throw new Error('global_stop_unconfirmed_held');
  };
  const call=async (prompt:string,maxOutputTokens:number) => {
    if (unresolved || inFlight || OUTPUT_LIMITS[kind][seq]!==maxOutputTokens || Buffer.byteLength(prompt,'utf8')>MAX_PROMPT_BYTES) throw new Error('guard_call_not_authorized');
    inFlight=true; const n=++seq;
    try {
      const started=await rpc(db,'ai_guard_start_route',{p_id:id,p_seq:n});
      if (started.error || started.data!=='started') { unresolved=true; throw new Error('guard_start_unconfirmed_held'); }
    } catch { unresolved=true; throw new Error('guard_start_unconfirmed_held'); }
    try {
      const result=await createOpenAIText(prompt,maxOutputTokens,model);
      if (!result.usageKnown || result.usage.inputTokens>MAX_PROMPT_BYTES || result.usage.outputTokens>maxOutputTokens) throw new Error('usage_unknown');
      const settled=await rpc(db,'ai_guard_settle_call',{p_id:id,p_seq:n,p_cost:ceiling,p_input:result.usage.inputTokens,p_output:result.usage.outputTokens});
      if (settled.error || settled.data!=='settled') throw new Error('guard_settle_unconfirmed');
      inFlight=false; return result;
    } catch { unresolved=true; await stop(n); throw new Error('guard_dispatch_unresolved'); }
  };
  try {
    const result=await args.work(call);
    if (unresolved || inFlight) throw new Error('guard_dispatch_unresolved');
    const closed=await rpc(db,'ai_guard_close',{p_id:id});
    if (closed.error || closed.data!=='closed') throw new Error('guard_close_unconfirmed');
    return result;
  } catch (err) {
    if (!unresolved && !inFlight && seq>0) { try { await rpc(db,'ai_guard_close',{p_id:id}); } catch {} }
    throw err;
  }
}

// Only controlled reason codes are exposed; existing non-AI flows retain their error behavior.
export function sharedPaidGuardResponse(error:unknown) {
 const message=error instanceof Error ? error.message : '';
 if (!message.startsWith('paid_guard:') && !message.startsWith('guard_') && message!=='global_stop_unconfirmed_held' && message!=='usage_unknown') return null;
 const reason=message.startsWith('paid_guard:') ? message.slice('paid_guard:'.length) : 'unavailable';
 const busy=['action_busy','actor_busy','busy','cooldown','rate'].includes(reason);
 const text=reason==='budget' ? '目前生成額度不足，既有詳解與作答仍可使用。' : busy ? '已有請求處理中或使用太頻繁，請稍後再試。' : 'AI 服務暫時無法使用，既有內容與作答不受影響。';
 return NextResponse.json({ok:false,code:reason,message:text,recoverable:true},{status:reason==='budget'||busy ? 429 : 503,headers:{'Cache-Control':'no-store'}});
}
