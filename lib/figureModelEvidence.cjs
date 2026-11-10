'use strict';
const {createHash}=require('node:crypto');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const DECODER_REVISION='figure-response-v1';
const PHASES=new Set(['configuration','journal_prepare','count_request','count_body','count_parse','count_validate','response_request','response_body','response_store','response_parse','response_validate','decision_parse','commit','recovery_read']);
const CODES=new Set(['unavailable','context_bound','network_failed','timeout','http_failed','body_missing','body_bound','body_failed','invalid_json','invalid_count','input_bound','incomplete_response','model_mismatch','missing_response_id','usage_invalid','usage_bound','cost_bound','invalid_decision','journal_unconfirmed','commit_unconfirmed','invalid_evidence','unexpected']);
class FigureModelError extends Error {
 constructor(phase,code,details={}){super('figure review held');this.phase=PHASES.has(phase)?phase:'configuration';this.code=CODES.has(code)?code:'unexpected';if(Number.isInteger(details.httpStatus)&&details.httpStatus>=100&&details.httpStatus<=599)this.httpStatus=details.httpStatus;}
}
function failure(phase,error){return error instanceof FigureModelError?error:new FigureModelError(phase,['TimeoutError','AbortError'].includes(error?.name)?'timeout':'unexpected');}
function diagnostic(error,phase,started=Date.now()){
 const e=failure(phase,error);
 return {phase:e.phase,code:e.code,...(e.httpStatus?{httpStatus:e.httpStatus}:{}),elapsedMs:Math.max(0,Math.min(3600000,Date.now()-started))};
}
function decodeLunaResponse(raw,httpStatus,policy){
 if(!Buffer.isBuffer(raw)||raw.length>65536||!raw.length)throw new FigureModelError('response_body','body_bound');
 if(httpStatus<200||httpStatus>=300)throw new FigureModelError('response_request','http_failed',{httpStatus});
 let value;try{value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw))}catch{throw new FigureModelError('response_parse','invalid_json')}
 if(value?.status!=='completed'||value.error!=null||value.incomplete_details!=null)throw new FigureModelError('response_validate','incomplete_response');
 if(value.model!==policy.model)throw new FigureModelError('response_validate','model_mismatch');
 if(typeof value.id!=='string'||value.id.length<1||value.id.length>200)throw new FigureModelError('response_validate','missing_response_id');
 const u=value.usage;
 if(!u||![u.input_tokens,u.output_tokens].every(n=>Number.isSafeInteger(n)&&n>=0))throw new FigureModelError('response_validate','usage_invalid');
 if(u.total_tokens!==undefined&&(!Number.isSafeInteger(u.total_tokens)||u.total_tokens!==u.input_tokens+u.output_tokens))throw new FigureModelError('response_validate','usage_invalid');
 if(u.input_tokens>policy.maxInputTokens||u.output_tokens>policy.maxOutputTokens)throw new FigureModelError('response_validate','usage_bound');
 const cost=Math.ceil((u.input_tokens*policy.inputRate+u.output_tokens*policy.outputRate)/1000000);
 if(!Number.isSafeInteger(cost)||cost<0||cost>policy.reserveMicroUsd)throw new FigureModelError('response_validate','cost_bound');
 if(!Array.isArray(value.output))throw new FigureModelError('response_validate','invalid_evidence');
 if(value.output.some(x=>x?.type==='message'&&((x.status!==undefined&&x.status!=='completed')||(Array.isArray(x.content)&&x.content.some(c=>c?.type==='refusal')))))throw new FigureModelError('response_validate','incomplete_response');
 const outputText=value.output.filter(x=>x?.type==='message').flatMap(x=>Array.isArray(x.content)?x.content:[]).filter(x=>x?.type==='output_text'&&typeof x.text==='string').map(x=>x.text).join('');
 return {status:'completed',outputText,id:value.id,responseSha:sha(raw),costMicroUsd:cost};
}
function policySnapshot(policy){return Object.fromEntries(['model','pricingRevision','reserveMicroUsd','maxInputTokens','maxOutputTokens','inputRate','outputRate'].map(key=>[key,policy[key]]));}
module.exports={DECODER_REVISION,FigureModelError,failure,diagnostic,decodeLunaResponse,policySnapshot,sha};
