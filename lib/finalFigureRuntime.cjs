'use strict';
const {fundingAllowed}=require('./figureFundingPolicy.cjs');
const {createHash}=require('node:crypto');
const {reviewFinalFigure}=require('./finalFigureSuitability.cjs');
const {createFinalFigureRepository}=require('./finalFigureRepository.cjs');
const sha=x=>createHash('sha256').update(x).digest('hex');
// Existing API project credential, never a new key/provider fallback. Exactly one
// fetch; HTTP failure, truncation, refusal, timeout and usage mismatch are holds.
async function lunaTransport(input,{env,policy,fetcher=fetch}){
 if(!env.OPENAI_API_KEY)throw Error('provider unavailable');
 if(Buffer.byteLength(JSON.stringify(input.input[1].content[0]))>12000)throw Error('context exceeds reviewed bound');
 // Exact image-inclusive count for the production model. This is not a model
 // generation; failure holds the durable reservation rather than guessing or
 // retrying. The very same immutable model/input is used for generation.
 if(policy.model==='gpt-6-luna'){
  if(input.model!==policy.model)throw Error('model mismatch');
  const counted=await fetcher('https://api.openai.com/v1/responses/input_tokens',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${env.OPENAI_API_KEY}`},body:JSON.stringify({model:input.model,input:input.input}),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});
  if(!counted.ok||!counted.body)throw Error('input count unavailable');
  const r=counted.body.getReader();let raw='',size=0;
  try{while(true){const part=await r.read();if(part.done)break;size+=part.value.length;if(size>4096)throw Error('input count bound');raw+=Buffer.from(part.value).toString('utf8')}}finally{await r.cancel().catch(()=>{});r.releaseLock()}
  const count=JSON.parse(raw);
  if(count.object!=='response.input_tokens'||!Number.isSafeInteger(count.input_tokens)||count.input_tokens<1||count.input_tokens>policy.maxInputTokens)throw Error('input count exceeds reserved bound');
 }
 const response=await fetcher('https://api.openai.com/v1/responses',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${env.OPENAI_API_KEY}`},body:JSON.stringify({...input,...(policy.model==='gpt-6-luna'?{reasoning:{effort:'none'}}:{}),max_output_tokens:policy.maxOutputTokens,service_tier:'default',store:false}),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});
 if(!response.ok||!response.body)throw Error('provider outcome unconfirmed');
 const reader=response.body.getReader(),parts=[];let size=0;
 try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>65536)throw Error('response bound');parts.push(Buffer.from(part.value))}}finally{await reader.cancel().catch(()=>{});reader.releaseLock()}
 const raw=Buffer.concat(parts),value=JSON.parse(raw.toString('utf8')),u=value.usage;
 if(value.status!=='completed'||value.model!==policy.model||typeof value.id!=='string'||!u||!Number.isSafeInteger(u.input_tokens)||!Number.isSafeInteger(u.output_tokens)||u.input_tokens<0||u.output_tokens<0||u.input_tokens>policy.maxInputTokens||u.output_tokens>policy.maxOutputTokens)throw Error('model or usage unknown');
 const cost=Math.ceil((u.input_tokens*policy.inputRate+u.output_tokens*policy.outputRate)/1000000);
 if(!Number.isSafeInteger(cost)||cost>policy.reserveMicroUsd)throw Error('price ceiling');
 const outputText=(value.output||[]).filter(x=>x.type==='message').flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join('');
 return {status:'completed',outputText,id:value.id,responseSha:sha(raw),costMicroUsd:cost};
}
function createFinalFigureReviewer({db,env=process.env,readQuestion,transport}){
 // Always return a reviewer: disabled/missing DB capabilities must HOLD new
 // automatic images, not silently fall back to pretending human approval.
 return async args=>{
  if(env.FIGURE_LUNA_REVIEW_ENABLED!=='1')return {status:'disabled'};
  let policy;try{const result=await db.rpc('figure_model_policy',{});if(result.error)throw Error();policy=result.data}catch{return {status:'configuration_required'}}
  if(!policy?.enabled||!fundingAllowed(policy))return {status:'disabled'};
  if(!args.candidateId)return {status:'configuration_required'};
  return reviewFinalFigure({...args,readQuestion,policy,repository:createFinalFigureRepository(db,args.candidateId),provider:transport||((input)=>lunaTransport(input,{env,policy}))});
 };
}
module.exports={createFinalFigureReviewer,lunaTransport};
