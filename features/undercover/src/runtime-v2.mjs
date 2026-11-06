// SERVER ONLY. Inject a reviewed RPC and one game credential provider; no env/key reads.
import {digest,validateAiContext,AI_GAME_INSTRUCTIONS,Game,TestAiAdapter,GameError}from'./game.mjs';
export const TERRA_MODEL='gpt-6.1-terra';
export const PRICE_REVISION='terra-standard-conservative-20261106';
export const RESERVATION_MICRO=48768;
export const LUNA_MODEL='gpt-6-luna';
export const LUNA_PRICE_REVISION='luna-standard-conservative-20261106';
export const MODEL_PROFILES=Object.freeze({[TERRA_MODEL]:Object.freeze({model:TERRA_MODEL,pricingRevision:PRICE_REVISION,reservationMicro:48768}),[LUNA_MODEL]:Object.freeze({model:LUNA_MODEL,pricingRevision:LUNA_PRICE_REVISION,reservationMicro:4877})});
export const validModelProfile=s=>!!(MODEL_PROFILES[s?.model]&&MODEL_PROFILES[s.model].pricingRevision===s.pricingRevision);

export class RoomPostgresStore{
 constructor({rpc,approved=false}={}){if(typeof rpc!=='function')throw Error('RPC_REQUIRED');this.rpc=rpc;this.productionReady=approved;}
 async read(fn){const row=await this.rpc('undercover_v2_snapshot',{});return structuredClone(fn(row.payload));}
 async transaction(fn){for(let n=0;n<8;n++){const row=await this.rpc('undercover_v2_snapshot',{}),draft={...structuredClone(row.payload),confirmedResults:structuredClone(row.confirmedResults||{})},value=fn(draft),changes={};for(const code of new Set([...Object.keys(row.payload.rooms),...Object.keys(draft.rooms)]))if(JSON.stringify(row.payload.rooms[code])!==JSON.stringify(draft.rooms[code]))changes[code]=draft.rooms[code]??null;const{rooms,confirmedResults,...meta}=draft;const{rooms:previousRooms,...previousMeta}=row.payload;if(Object.keys(changes).length===0&&JSON.stringify(meta)===JSON.stringify(previousMeta))return structuredClone(value);const result=await this.rpc('undercover_v2_commit',{p_expected:row.revision,p_versions:row.versions,p_changes:changes,p_meta:meta});if(result.applied)return structuredClone(value);await new Promise(resolve=>setTimeout(resolve,Math.min(150,20*(n+1))+Math.floor(Math.random()*25)));}throw Error('GAME_STORE_BUSY');}
}
export class GameBudget{
 constructor(rpc){this.rpc=rpc;}
 reserve(id,fingerprint,profile=MODEL_PROFILES[TERRA_MODEL]){return this.rpc('undercover_v2_reserve',{p_id:id,p_fingerprint:fingerprint,p_model:profile.model,p_pricing:profile.pricingRevision});}
 markSent(id){return this.rpc('undercover_v2_mark_sent',{p_id:id});}
 settle(id,usage){return this.rpc(usage.result?'undercover_v2_settle_result':'undercover_v2_settle',{p_id:id,p_outcome:'success',p_input:usage.inputTokens,p_output:usage.outputTokens,p_model:usage.model,...(usage.result?{p_result:usage.result}:{})});}
 unknown(id){return this.rpc('undercover_v2_settle',{p_id:id,p_outcome:'unknown',p_input:null,p_output:null,p_model:TERRA_MODEL});}
 status(){return this.rpc('undercover_v2_budget_status',{});}
}
function schema(c){return c.task==='chat'?{type:'object',properties:{text:{type:'string',minLength:1,maxLength:c.maxChars}},required:['text'],additionalProperties:false}:{type:'object',properties:{target:{type:'string',enum:c.allowedVotes}},required:['target'],additionalProperties:false};}
export function terraRequest(input,model=TERRA_MODEL){if(!MODEL_PROFILES[model])throw Error('UNSUPPORTED_GAME_MODEL');const c=validateAiContext(input);if(c.task==='vote'&&!c.allowedVotes.length)throw Error('NO_VOTE_TARGET');const body={model,input:[{role:'developer',content:AI_GAME_INSTRUCTIONS},{role:'user',content:JSON.stringify(c)}],reasoning:{effort:'none'},max_output_tokens:128,prompt_cache_options:{mode:'explicit'},service_tier:'default',store:false,tools:[],text:{format:{type:'json_schema',name:c.task==='chat'?'game_chat':'game_vote',strict:true,schema:schema(c)}}};if(Buffer.byteLength(JSON.stringify(body))>24000)throw Error('INPUT_BYTES_EXCEEDED');return body;}
async function boundedJson(response){if(!response.ok)throw Error('PROVIDER_HTTP_'+response.status);const reader=response.body?.getReader();if(!reader)throw Error('PROVIDER_EMPTY');let size=0,text='';const d=new TextDecoder();for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>65536){await reader.cancel();throw Error('PROVIDER_TOO_LARGE');}text+=d.decode(value,{stream:true});}return JSON.parse(text+d.decode());}
export class GameModelAdapter{
 constructor({approved=false,budget,credentialProvider,fetchImpl=globalThis.fetch,timeoutMs=8000,onMetrics=null}={}){
  if(!approved||!budget||typeof budget.status!=='function'||typeof credentialProvider!=='function'||typeof fetchImpl!=='function')throw Error('REAL_AI_NOT_CONFIGURED');
  this.mode='real';this.budget=budget;this.credentialProvider=credentialProvider;this.fetchImpl=fetchImpl;this.timeoutMs=Math.min(timeoutMs,8000);this.onMetrics=onMetrics;
 }
 async complete(input,options={}){
  const c=validateAiContext(input),started=Date.now(),timing={},abort=new AbortController(),stop=()=>abort.abort();let lease,attempted=false,body,profile;
  const report=event=>{try{this.onMetrics?.(event);}catch{}};
  const timer=setTimeout(stop,this.timeoutMs);options.signal?.addEventListener('abort',stop,{once:true});if(options.signal?.aborted)stop();
  const bounded=async task=>{if(abort.signal.aborted)throw Error('AI_ABORTED');let rejectAbort;const cancelled=new Promise((_,reject)=>{rejectAbort=()=>reject(Error('AI_ABORTED'));abort.signal.addEventListener('abort',rejectAbort,{once:true});});try{return await Promise.race([task(),cancelled]);}finally{abort.signal.removeEventListener('abort',rejectAbort);}};
  const readProfile=async()=>{const status=await bounded(()=>this.budget.status());if(!validModelProfile(status)){const e=Error('GAME_PROFILE_NOT_SUPPORTED');e.knownNotSent=true;throw e;}return MODEL_PROFILES[status.model];};
  try{
   profile=await readProfile();this.model=profile.model;
   for(let attempt=0;attempt<2;attempt++){
    body=terraRequest(c,profile.model);lease=undefined;
    lease=await bounded(()=>{attempted=true;return this.budget.reserve(options.requestId,digest(JSON.stringify(body)),profile);});
    if(lease?.fresh===true)break;
    // This is an explicit no-insert profile race, not a provider retry. Existing
    // steps, busy/guard/unknown results never take this branch.
    if(attempt===0&&lease?.reason==='profile_changed'){profile=await readProfile();this.model=profile.model;continue;}
    const e=Error('GAME_AI_NOT_DISPATCHED');e.knownNotSent=true;throw e;
   }
   if(lease?.fresh!==true){const e=Error('GAME_AI_NOT_DISPATCHED');e.knownNotSent=true;throw e;}
   const sent=await bounded(()=>this.budget.markSent(options.requestId));if(!sent?.sent||!Number.isFinite(Date.parse(sent.until)))throw Error('AI_SEND_NOT_CONFIRMED');
   const until=Date.parse(sent.until),key=await bounded(()=>this.credentialProvider());if(typeof key!=='string'||!key)throw Error('GAME_CREDENTIAL_UNAVAILABLE');
   const request=async(endpoint,payload)=>{if(Date.now()>=until)throw Error('AI_WINDOW_ENDED');return bounded(async()=>{const response=await this.fetchImpl('https://api.openai.com/v1/'+endpoint,{method:'POST',redirect:'error',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify(payload),signal:abort.signal});if(!response.ok)report({type:'provider_error',model:profile.model,endpoint,status:response.status,totalMs:Date.now()-started});return boundedJson(response);});};
   const countAt=Date.now(),count=await request('responses/input_tokens',{model:body.model,input:body.input,reasoning:body.reasoning,text:body.text,tools:body.tools});timing.counterMs=Date.now()-countAt;
   if(count.object!=='response.input_tokens'||!Number.isSafeInteger(count.input_tokens)||count.input_tokens<0||count.input_tokens>16000)throw Error('INPUT_TOKENS_EXCEEDED');
   const genAt=Date.now(),data=await request('responses',body);timing.generationMs=Date.now()-genAt;const u=data.usage;
   if(data.model!==profile.model)report({type:'model_mismatch',model:profile.model,returnedModel:typeof data.model==='string'&&/^[A-Za-z0-9._-]{1,96}$/.test(data.model)?data.model:'unrecognized',totalMs:Date.now()-started});
   if(data.status!=='completed'||data.model!==profile.model||!u||!Number.isSafeInteger(u.input_tokens)||!Number.isSafeInteger(u.output_tokens)||u.input_tokens<0||u.input_tokens>16000||u.input_tokens!==count.input_tokens||u.output_tokens<0||u.output_tokens>128)throw Error('PROVIDER_USAGE_UNKNOWN');
   const texts=(data.output||[]).filter(x=>x.type==='message'&&x.role==='assistant').flatMap(x=>x.content||[]);if(texts.length!==1||texts[0].type!=='output_text')throw Error('PROVIDER_OUTPUT_INVALID');const value=JSON.parse(texts[0].text);
   if(!value||Array.isArray(value)||Object.keys(value).length!==1)throw Error('PROVIDER_OUTPUT_INVALID');if(c.task==='chat'?(typeof value.text!=='string'||!value.text.trim()||[...value.text].length>c.maxChars):!c.allowedVotes.includes(value.target))throw Error('PROVIDER_OUTPUT_INVALID');if(abort.signal.aborted)throw Error('PROVIDER_UNKNOWN');
   const settled=await bounded(()=>this.budget.settle(options.requestId,{inputTokens:u.input_tokens,outputTokens:u.output_tokens,model:data.model,result:value}));if(settled?.state!=='success')throw Error('SETTLEMENT_NOT_CONFIRMED');
   report({type:'success',model:data.model,task:c.task,opening:!!c.opening,counterMs:timing.counterMs,generationMs:timing.generationMs,totalMs:Date.now()-started,inputTokens:u.input_tokens,outputTokens:u.output_tokens});return value;
  }catch(error){if(error?.knownNotSent)throw error;if(lease?.fresh||attempted&&!lease){try{let cleanup;await Promise.race([this.budget.unknown(options.requestId),new Promise((_,reject)=>{cleanup=setTimeout(()=>reject(Error('UNKNOWN_HOLD_PENDING')),500);})]).finally(()=>clearTimeout(cleanup));}catch{}}throw Error('GAME_AI_HELD');}
  finally{clearTimeout(timer);options.signal?.removeEventListener('abort',stop);}
 }
}
// Historical export retained for existing tests and callers; profile comes from
// the private money guard for every step, never from a browser parameter.
export const TerraAiAdapter=GameModelAdapter;

// Does not discover credentials, read env, install SQL, or enable paid calls.
// The caller must explicitly approve the store/lifecycle and inject ONE game key.
export function createGameRpc(client){if(typeof client?.rpc!=='function')throw Error('RPC_CLIENT_REQUIRED');return async(name,args)=>{if(!/^undercover_v2_(snapshot|commit|budget_status|reserve|mark_sent|settle|settle_result)$/.test(name))throw Error('RPC_NOT_ALLOWED');const result=await client.rpc(name,args);if(result.error){if(result.error.code==='P0001'&&result.error.message==='PREVIEW_ROOM_CAP')throw new GameError('SERVER_FULL',429);throw Error('GAME_DB_UNAVAILABLE');}return result.data;};}
export function createPersistentGame({approved=false,rpc,credentialProvider,realModel=false,schedule,fetchImpl,now,onMetrics}={}){if(!approved||typeof schedule!=='function')throw Error('PERSISTENT_RUNTIME_NOT_APPROVED');const store=new RoomPostgresStore({rpc,approved:true}),budget=new GameBudget(rpc),ai=realModel?new GameModelAdapter({approved:true,budget,credentialProvider,fetchImpl,onMetrics}):new TestAiAdapter();const game=new Game({store,ai,now});if(realModel)game.checkPlayable=async()=>{const s=await budget.status();if(!validModelProfile(s)||!s.enabled||s.paused||!Number.isFinite(Date.parse(s.until))||Date.parse(s.until)<=(now||Date.now)()||s.capMicro-s.spentCeilingMicro-s.reservedMicro<MODEL_PROFILES[s.model].reservationMicro)throw new GameError('TRIAL_UNAVAILABLE',503);};game.workerApproved=true;game.scheduleBackground=()=>{schedule(game.tick().catch(()=>{}));};return game;}
