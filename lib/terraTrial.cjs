'use strict';
const crypto=require('node:crypto');
const IDS=Object.freeze(['MOEX-111020-1301-Q010','MOEX-C217-093030-S4001-STAGE1-Q019','MOEX-097140-1101-Q028','MOEX-097140-1101-Q004','MOEX-108100-1301-Q018']);
const MODEL='gpt-6.1-terra';
function prompt(q){
 const concept=IDS.indexOf(q.id)<3?'頸動脈鞘的構造':q.id===IDS[3]?'頸動脈竇的位置':'靜脈竇的回流路徑';
 return ['請用清楚的臺灣繁體中文講解這道醫師國考題；依官方採計答案說明理由，逐一分析每個選項，指出必要的適用條件。不編造來源、網址或題目資訊。',
 '只回傳 JSON：{"explanation":"以 ## 小標分段的完整詳解，含一個有助鑑別的精簡 Markdown 表格","optionAnalysis":{"A":"...","B":"...","C":"...","D":"..."},"memoryTip":"...","imageSectionTitle":"適合配圖的既有小標；若不適合留空"}。',
 `可用的已核對真實圖片主題：${concept}。圖片只示範此主題，不要假設圖片展示未列出的構造或神經傳導。imageSectionTitle 必須是 explanation 中完全相同的小標。`,
 JSON.stringify({id:q.id,stem:q.stem,options:q.options,answer:q.answer,acceptedAnswers:q.acceptedAnswers||[],answerCreditType:q.answerCreditType||'standard'})].join('\n');
}
function parse(text,q,normalize){
 let raw;try{raw=JSON.parse(text.trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,''))}catch{return null}
 const value=normalize(raw);if(!value?.explanation||Object.keys(q.options).some(k=>q.options[k]&&!value.optionAnalysis[k]))return null;
 if(Buffer.byteLength(JSON.stringify(value))>80000)return null;
 const titles=[...value.explanation.matchAll(/^##[ \t]+([^\n]{1,80})$/gm)].map(m=>m[1].trim());
 const imageSectionTitle=typeof raw.imageSectionTitle==='string'&&titles.filter(x=>x===raw.imageSectionTitle).length===1?raw.imageSectionTitle:null;
 return {...value,imageSectionTitle,model:MODEL};
}
async function generate({id,actor,resolve,isLocked,readExisting,store,provider,normalize,enabled=false}){
 if(!enabled||!IDS.includes(id))return {code:'disabled_or_out_of_scope'};
 if(await isLocked(id))return {code:'locked'};
 const previous=await store.read(id);if(previous)return {code:'already_attempted',item:previous};
 if(await readExisting(id))return {code:'existing_explanation'};
 const q=await resolve(id);if(!q||q.id!==id||q.stemImage||q.optionImages)return {code:'untrusted_question'};
 const input=prompt(q);if(Buffer.byteLength(input)>16000)return {code:'input_limit'};
 const attempt=crypto.randomUUID();
 if(await store.begin(id,attempt,actor)!=='started')return {code:'not_started'};
 // The started record is permanent. Exceptions/unknown results cannot retry.
 let response;try{response=await provider(input,2400,MODEL,'default')}catch{await store.unknown(id,attempt,actor);return {code:'provider_unknown'}};
 const u=response.usage;
 if(response.servedModel!==MODEL||!response.usageKnown||!Number.isSafeInteger(u?.inputTokens)||u.inputTokens<0||u.inputTokens>16000||!Number.isSafeInteger(u.outputTokens)||u.outputTokens<0||u.outputTokens>2400){await store.unknown(id,attempt,actor);return {code:'usage_unknown'}};
 const payload=parse(response.text,q,normalize),status=payload?'complete':'invalid_output';
 try{
  const result=await store.finish(id,attempt,actor,status,payload,u,{requestId:response.requestId||null,responseId:response.responseId||null,servedModel:response.servedModel});
  if(result!==status)throw Error('finish unconfirmed');
 }catch{
  const saved=await store.read(id).catch(()=>null);
  if(saved?.attempt_id===attempt&&['complete','invalid_output'].includes(saved.state))return {code:saved.state,item:saved};
  await store.unknown(id,attempt,actor);return {code:'save_unknown'};
 }
 return {code:status,item:await store.read(id)};
}
function createStore(db){
 const rpc=async(name,args)=>{const {data,error}=await db.rpc(name,args);if(error)throw Error('trial state unavailable');return data};
 return {
  async read(id){const {data,error}=await db.from('terra_five_trial_items').select('question_id,attempt_id,state,payload,usage,provider,created_at,finished_at').eq('question_id',id).maybeSingle();if(error)throw Error('trial read unavailable');return data},
  begin:(id,attempt,actor)=>rpc('terra_five_trial_begin',{p_question:id,p_attempt:attempt,p_actor:actor}),
  finish:(id,attempt,actor,status,payload,usage,provider)=>rpc('terra_five_trial_finish',{p_question:id,p_attempt:attempt,p_actor:actor,p_status:status,p_payload:payload,p_usage:usage,p_provider:provider}),
  unknown:(id,attempt,actor)=>rpc('terra_five_trial_unknown',{p_question:id,p_attempt:attempt,p_actor:actor})
 };
}
module.exports={IDS,MODEL,prompt,parse,generate,createStore};
