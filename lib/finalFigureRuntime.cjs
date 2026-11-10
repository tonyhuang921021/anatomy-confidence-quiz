'use strict';
const {fundingAllowed}=require('./figureFundingPolicy.cjs');
const {reviewFinalFigure,recoverFinalFigure}=require('./finalFigureSuitability.cjs');
const {createFinalFigureRepository}=require('./finalFigureRepository.cjs');
const {FigureModelError,decodeLunaResponse}=require('./figureModelEvidence.cjs');
async function request(fetcher,url,body,env,phase){
 try{return await fetcher(url,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${env.OPENAI_API_KEY}`},body:JSON.stringify(body),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)})}
 catch(error){throw new FigureModelError(phase,['TimeoutError','AbortError'].includes(error?.name)?'timeout':'network_failed')}
}
async function bodyBytes(response,max,phase){
 if(!response.body)throw new FigureModelError(phase,'body_missing');
 const reader=response.body.getReader(),parts=[];let size=0;
 try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>max)throw new FigureModelError(phase,'body_bound');parts.push(Buffer.from(part.value))}}
 catch(error){if(error instanceof FigureModelError)throw error;throw new FigureModelError(phase,['TimeoutError','AbortError'].includes(error?.name)?'timeout':'body_failed')}
 finally{await reader.cancel().catch(()=>{});reader.releaseLock()}
 return Buffer.concat(parts);
}
// Exactly one count and one Responses request; no transport retry. A complete
// bounded response is durably stored before JSON/usage/decision interpretation.
async function lunaTransport(input,{env,policy,fetcher=fetch,onResponse,beforeRequest}){
 if(!env.OPENAI_API_KEY||typeof onResponse!=='function'||typeof beforeRequest!=='function')throw new FigureModelError('configuration','unavailable');
 if(Buffer.byteLength(JSON.stringify(input.input[1].content[0]))>12000)throw new FigureModelError('configuration','context_bound');
 if(await beforeRequest()!==true)throw new FigureModelError('journal_prepare','unavailable');
 if(policy.model==='gpt-6-luna'){
  if(input.model!==policy.model)throw new FigureModelError('configuration','model_mismatch');
  const counted=await request(fetcher,'https://api.openai.com/v1/responses/input_tokens',{model:input.model,input:input.input},env,'count_request');
  if(!counted.ok){await counted.body?.cancel().catch(()=>{});throw new FigureModelError('count_request','http_failed',{httpStatus:counted.status})}
  const raw=await bodyBytes(counted,4096,'count_body');let count;
  try{count=JSON.parse(raw.toString('utf8'))}catch{throw new FigureModelError('count_parse','invalid_json')}
  if(count.object!=='response.input_tokens'||!Number.isSafeInteger(count.input_tokens)||count.input_tokens<1)throw new FigureModelError('count_validate','invalid_count');
  if(count.input_tokens>policy.maxInputTokens)throw new FigureModelError('count_validate','input_bound');
 }
 if(await beforeRequest()!==true)throw new FigureModelError('journal_prepare','unavailable');
 const response=await request(fetcher,'https://api.openai.com/v1/responses',{...input,...(policy.model==='gpt-6-luna'?{reasoning:{effort:'none'}}:{}),max_output_tokens:policy.maxOutputTokens,service_tier:'default',store:false},env,'response_request');
 const raw=await bodyBytes(response,65536,'response_body');
 try{await onResponse(raw,response.status)}catch{throw new FigureModelError('response_store','journal_unconfirmed')}
 return decodeLunaResponse(raw,response.status,policy);
}
function createFinalFigureReviewer({db,env=process.env,readQuestion,transport}){
 // Always return a reviewer: disabled/missing DB capabilities must HOLD new
 // automatic images, not silently fall back to pretending human approval.
 return async args=>{
  if(env.FIGURE_LUNA_REVIEW_ENABLED!=='1')return {status:'disabled'};
  let policy;try{const result=await db.rpc('figure_model_policy',{});if(result.error)throw Error();policy=result.data}catch{return {status:'configuration_required'}}
  if(!policy?.enabled||!fundingAllowed(policy))return {status:'disabled'};
  if(!args.candidateId)return {status:'configuration_required'};
  return reviewFinalFigure({...args,readQuestion,policy,repository:createFinalFigureRepository(db,args.candidateId),provider:transport||((input,hooks)=>lunaTransport(input,{env,policy,...hooks}))});
 };
}
async function recoverStoredFigureReview({db,operationId,authorize}){return recoverFinalFigure({operationId,authorize,repository:createFinalFigureRepository(db,null)})}
module.exports={createFinalFigureReviewer,lunaTransport,recoverStoredFigureReview};
