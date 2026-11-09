'use strict';
const {authorizationWindow}=require('./authorizationWindow.cjs');
const {figureCaptureAllowed,guardFigureTraffic}=require('./figureCaptureGate.cjs');
const {createHash,randomUUID}=require('node:crypto');
const {classifySource,normalizeCommonsCandidate}=require('./figureSourcePolicy.cjs');
const {validate}=require('./figureReviewService.cjs');
const sha=s=>createHash('sha256').update(s).digest('hex');
const POLICY='commons-cc-visual-v1';
// Only fixed general terms leave the server. Unknown concepts require review;
// catalog topic matching does not approve image content.
const CATALOG=Object.freeze({'carotid-sheath':{query:'carotid sheath anatomy',revision:'carotid-sheath-v1'},'carotid-sinus':{query:'carotid sinus anatomy OpenStax',revision:'carotid-sinus-v1'},'dural-venous-sinuses':{query:'dural venous sinuses OpenStax',revision:'dural-venous-sinuses-v1'}});
const IMAGE_PROMPT='詳解小標請用 ##。同一次 JSON 的根物件請一併提供 figureNeeds 陣列（最多3項，欄位名固定 figureNeeds，不可放到 explanation 字串內），每項格式：{sectionTitle:完全相同的小標,conceptId:一般醫學概念英文代碼,caption:簡短圖說,searchScope:固定general-medical,medicalDomain:anatomy或physiology或biochemistry或microbiology或pathology或pharmacology,searchTerm:小寫英文一般醫學名詞（優先英文，最多8個詞，不含人名、題文、數值或識別資料）}。只為能幫助理解的段落提圖；無適合圖片則明確給空陣列，勿省略此欄位。結構範例：{"explanation":"## 機轉\\n文字","optionAnalysis":{},"memoryTip":"","figureNeeds":[{"sectionTitle":"機轉","conceptId":"medical-concept","caption":"概念圖","searchScope":"general-medical","medicalDomain":"biochemistry","searchTerm":"citric acid cycle"}]}。範例概念僅示範格式，請換成當題概念。不要產生網址、來源、授權或患者資料。搜尋詞應包含核心學名與本題機制或關係，不要只用器官或大分類。可選擇提供 searchAlternatives 陣列，最多一個不同角度的小寫英文醫學描述（同樣最多8詞、不含人名、數值或識別資料）；例如 inulin clearance diagram 與 inulin is freely filtered by the glomerulus。先找直接解釋本題的圖，再考慮延伸圖；不要把沒有完整延伸圖等同沒有適用圖片。圖片需求失敗不影響完整詳解。';
function safeQuery(value){
 if(typeof value!=='string')return null;
 const q=value.trim().replace(/\s+/g,' ');
 return q.length>=2&&q.length<=100&&q.split(' ').length<=8&&/^[A-Za-z\u3400-\u9fff ()-]+$/.test(q)?q:null;
}
// Queries come only from the saved explanation plan, never client question text.
// Require explicit general-medical intent; reject identifiers, person-specific
// requests and prose before any external transport is allowed.
function automaticQuery(item){
 const q=safeQuery(item?.proposedQuery);
 if(!q||! /^[a-z][a-z -]{1,89}$/.test(q)||q.split(' ').length>8)return null;
 if(/\b(patient|name|john|jane|smith|doe|address|email|phone|record|hospital|clinic|case|password|token|secret|key|ignore|instruction|upload|download|send|search|find|my|his|her|our|your|mr|mrs|dr)\b/i.test(q))return null;
 if(/^(core concepts?|key concepts?|option analysis|answer analysis|extended learning|further learning|summary|introduction|conclusion|overview)$/.test(q))return null;
 if(item.searchScope!=='general-medical'||!['anatomy','physiology','biochemistry','microbiology','pathology','pharmacology'].includes(item.medicalDomain))return null;
 return q;
}
// One deterministic core concept, only from an already validated medical query.
// This is a discovery hint, never image approval. The original caption and
// paragraph still go through the same language, rights and final fit review.
function shorterMedicalQuery(item){
 if(item?.catalogRevision!=='schema-query-v1'||automaticQuery(item)!==item.query||item.query.split(' ').length<5||(item.queryAlternatives||[]).length)return null;
 const words=new Set(item.query.split(' '));
 const anchors=['cholera toxin','pertussis toxin','guanylyl cyclase','adenylyl cyclase','electron transport chain','inulin clearance','cystic fibrosis','base excision repair'];
 const anchor=anchors.find(value=>value.split(' ').every(word=>words.has(word)));
 if(!anchor)return null;
 const query=anchor+' mechanism';
 return query!==item.query&&automaticQuery({...item,proposedQuery:query})===query?query:null;
}
function approveSchemaQueries(needs){
 if(!needs?.items?.length)return null;
 const items=needs.items.map(item=>{const query=automaticQuery(item),alternatives=item.proposedAlternatives===undefined?[]:item.proposedAlternatives;
  if(!query||!Array.isArray(alternatives)||alternatives.length>1||alternatives.some(q=>automaticQuery({...item,proposedQuery:q})!==q))return null;
  return {...item,query,catalogRevision:'schema-query-v1',...(alternatives.length?{queryAlternatives:alternatives}:{} )};});
 if(items.some(x=>!x))return null;
 return {...needs,items,status:'approved',reviewMethod:'schema_query'};
}
function buildNeeds(text,hints){
 if(typeof text!=='string'||!text.trim())return null;
 const matches=[...text.matchAll(/^#{2,3}\s+([^\n]{1,80})\s*$/gm)];
 const sections=matches.map((m,i)=>({title:m[1].trim(),text:text.slice(m.index,matches[i+1]?.index??text.length).trim()}));
 const items=[];
 for(const hint of (Array.isArray(hints)?hints:hints&&typeof hints==='object'?[hints]:[]).slice(0,3)){
  if(!hint||typeof hint.sectionTitle!=='string'||typeof hint.conceptId!=='string'||! /^[a-z][a-z0-9-]{0,59}$/.test(hint.conceptId)||typeof hint.caption!=='string'||!hint.caption.trim()||hint.caption.length>80)continue;
  const section=sections.filter(s=>s.title===hint.sectionTitle);
  if(section.length!==1||items.some(x=>x.sectionTitle===hint.sectionTitle))continue;
  items.push({sectionTitle:section[0].title,sectionHash:sha(section[0].text),sectionAnchor:'section-'+sections.indexOf(section[0]),conceptId:hint.conceptId,caption:hint.caption.trim(),proposedQuery:safeQuery(hint.searchTerm)||CATALOG[hint.conceptId]?.query||null,searchScope:hint.searchScope,medicalDomain:hint.medicalDomain,...(Array.isArray(hint.searchAlternatives)&&hint.searchAlternatives.length?{proposedAlternatives:hint.searchAlternatives.slice(0,1).map(safeQuery)}:{})});
 }
 const explanationHash=sha(text);
 return {explanationHash,items,revision:sha(JSON.stringify({explanationHash,items})),status:items.length?'awaiting_query_review':'awaiting_image_plan'};
}
function buildNeedsWithFallback(text,hints,question){
 // A broad renal keyword loses the substance and relationship being taught.
 // This deterministic repair applies to the medical concept, never a fixed ID.
 if(typeof text==='string'&&/菊糖|\binulin\b/i.test(question?.stem||'')){
  const sections=[...text.matchAll(/^#{2,3}\s+([^\n]{1,80})\s*$/gm)].map((m,i,all)=>({title:m[1].trim(),text:text.slice(m.index,all[i+1]?.index??text.length)})).filter(s=>/菊糖|\binulin\b/i.test(s.text));
  const chosen=sections.find(s=>/生理意義|機轉|原理|清除率/.test(s.title))||sections[0];
  const existing=buildNeeds(text,hints);
  const specific=existing?.items?.some(x=>/\binulin\b/.test(x.proposedQuery||'')&&(x.proposedQuery||'').split(' ').length>1);
  if(chosen&&!specific){
   const concentration=/(?:各|不同).{0,6}(?:腎小管|腎元)|TF.?P|tubular.*concentration/i.test(question.stem);
   return buildNeeds(text,[{sectionTitle:chosen.title,conceptId:concentration?'inulin-tubular-concentration':'inulin-clearance',caption:concentration?'菊糖在腎小管液中的濃度變化':'菊糖清除率、濾過量與排出量',searchTerm:concentration?'inulin tubular fluid concentration nephron':'inulin clearance diagram',searchAlternatives:[concentration?'inulin concentration nephron graph':'inulin is freely filtered by the glomerulus'],searchScope:'general-medical',medicalDomain:'physiology'}]);
  }
 }
 const planned=buildNeeds(text,hints);if(planned?.items?.length&&(approveSchemaQueries(planned)||approveKnownConcepts(planned,question)))return planned;
 const domains={'組織學':'anatomy','胚胎學':'anatomy','胚胎及發育生物學':'anatomy','免疫學':'microbiology','寄生蟲學':'microbiology','微生物及免疫學':'microbiology','微生物免疫學':'microbiology','解剖學':'anatomy','生理學':'physiology','生物化學':'biochemistry','微生物學':'microbiology','病理學':'pathology','藥理學':'pharmacology'};
 const domain=domains[question?.subject];if(!domain)return planned;
 const matches=[...text.matchAll(/^#{2,3}\s+([^\n]{1,80})\s*$/gm)];
 const sections=matches.map((m,i)=>({title:m[1].trim(),text:text.slice(m.index,matches[i+1]?.index??text.length)}));
 const headings=sections.map(x=>x.title);
 for(const m of String(question?.stem||'').matchAll(/([\u3400-\u9fff]{2,16})[（(]([A-Za-z][A-Za-z -]{1,89})[）)]/g)){
  const term=m[2].toLowerCase().trim();if(!automaticQuery({proposedQuery:term,searchScope:'general-medical',medicalDomain:domain}))continue;
  const matching=headings.filter(h=>{for(let n=Math.min(m[1].length,8);n>=2;n--)if(h.includes(m[1].slice(-n)))return true;return false});
  if(matching.length===0){const containing=sections.filter(s=>s.text.includes(m[1]));if(containing.length===1)matching.push(containing[0].title);else if(containing.length>1){const ranked=containing.map(s=>({...s,occurrences:s.text.split(m[1]).length-1})).sort((a,b)=>b.occurrences-a.occurrences||b.text.length-a.text.length);if(ranked[0].occurrences>ranked[1].occurrences||ranked[0].text.length>ranked[1].text.length*2)matching.push(ranked[0].title)}}
  if(matching.length!==1)continue;
  return buildNeeds(text,[{sectionTitle:matching[0],conceptId:'saved-paragraph-concept',caption:m[1]+'示意圖',searchTerm:term,searchScope:'general-medical',medicalDomain:domain}]);
 }
 return planned;
}
function approveConcepts(needs,choices){
 if(!needs?.items?.length||!Array.isArray(choices)||choices.length!==needs.items.length)throw Error('review every proposed paragraph');
 const items=needs.items.map((item,i)=>{
  const choice=choices[i],concept=Object.hasOwn(CATALOG,choice?.conceptId||'')?CATALOG[choice.conceptId]:null;
  const query=safeQuery(choice?.query)||concept?.query;
  if(!query||choice.sectionAnchor!==item.sectionAnchor||choice.paragraphConfirmed!==true)throw Error('trusted concept review required');
  return {...item,query,catalogRevision:concept&&query===concept.query?concept.revision:'reviewed-query-v1'};
 });
 return {...needs,items,status:'approved'};
}
function approveKnownConcepts(needs,question){
 if(!needs?.items?.length||!question?.stem)return null;
 const rules={'carotid-sheath':/頸動脈鞘|carotid sheath/i,'carotid-sinus':/頸動脈竇|carotid sinus/i,'dural-venous-sinuses':/靜脈竇|venous sinus|sigmoid sinus/i};
 if(!needs.items.every(x=>rules[x.conceptId]?.test(question.stem)))return null;
 return {...needs,status:'approved',reviewMethod:'trusted_catalog',items:needs.items.map(x=>({...x,query:CATALOG[x.conceptId].query,catalogRevision:CATALOG[x.conceptId].revision}))};
}
async function processSavedImages({db,question,actor,search,loadImage,discover=null,finalReview=null,enabled=false,requestId=null,explanationHash=null}){
 if(!enabled || !imageWindowOpen(process.env) || !await figureCaptureAllowed(db))return {status:'disabled'};
 search=guardFigureTraffic(db,search,()=>imageWindowOpen(process.env));
 loadImage=guardFigureTraffic(db,loadImage,()=>imageWindowOpen(process.env));
 try{
  // Old leases and uncertain traffic remain inspectable, without blocking new jobs.
  let query=db.from('figure_queue_jobs').select('request_id,figure_needs,needs_state').eq('question_id',question.id).eq('state','pending').eq('attempts',0);
  if(requestId)query=query.eq('request_id',requestId);
  if(explanationHash)query=query.eq('explanation_sha256',explanationHash);
  const {data:job,error}=await query.maybeSingle();
  if(error||!job)return {status:'no_pending_plan'};
  if(job.needs_state==='awaiting'){
   const approved=approveSchemaQueries(job.figure_needs)||approveKnownConcepts(job.figure_needs,question);if(!approved)return {status:'awaiting_concept_review'};
   const review=await db.rpc('figure_image_review',{p_id:job.request_id,p_revision:approved.revision,p_needs:approved,p_reviewer:null,p_method:approved.reviewMethod});
   if(review.error||review.data!=='approved')return {status:'awaiting_concept_review'};
  }
  return await runOne({store:createStore(db,{requestId:job.request_id}),search,loadImage,discover,trafficAllowed:()=>imageWindowOpen(process.env),finalReview,enabled:true});
 }catch{return {status:'awaiting_image'}}
}
function boundedImageTargets(env){
 if(env.EXPLANATION_SITEWIDE_ENABLED==='1')return [];
 const raw=env.NEW_EXPLANATION_IMAGES_SINGLE_BATCH||'';
 if(!raw)return [];
 const entries=raw.split(',');if(entries.length>3)return [];
 const targets=[];
 for(const entry of entries){const match=/^(MOEX-(?:[0-9]{6}-[0-9]{4}|C[0-9]+-[0-9]{6}-S[0-9]+-STAGE[0-9]+)-Q[0-9]{3}):([0-9a-f]{64})$/.exec(entry);
  if(!match||targets.some(x=>x.questionId===match[1]))return [];
  targets.push({questionId:match[1],textHash:match[2]});
 }
 return targets;
}
function boundedImageTarget(env,questionId){const targets=boundedImageTargets(env);return (questionId?targets.find(x=>x.questionId===questionId):targets[0])||null}
function imageWindowOpen(env,now=Date.now()){if(env.EXPLANATION_SITEWIDE_ENABLED==='1')return true;if(env.NEW_EXPLANATION_IMAGES_SINGLE_BATCH)return boundedImageTargets(env).length>0;return authorizationWindow(env.NEW_EXPLANATION_IMAGES_RUN_UNTIL,now)==='open'}
function cacheKey(query){return sha(JSON.stringify([POLICY,query]))}
async function runOne({store,search,loadImage,discover=null,trafficAllowed=()=>true,finalReview=null,enabled=false,leaseId=randomUUID()}){
 if(!enabled)return {status:'disabled'};
 const job=await store.claim(leaseId);if(!job)return {status:'idle'};
 if(job.attempts!==1)return {status:'held_for_review'};
 const finish=status=>store.finish(job,leaseId,status);
 let phase='read';
 try{
  const text=await store.readText(job.question_id);
  if(typeof text!=='string'||sha(text)!==job.explanation_sha256)return await finish('stale');
  const needs=await store.readNeeds(job.request_id);
  if(needs?.status!=='approved'||needs.explanationHash!==sha(text))return await finish('awaiting_concept_review');
  let staged=0,pending=0;const seen=new Set();
  const active=async()=>trafficAllowed()&&await store.active(job,leaseId)&&trafficAllowed();
  const readMetadata=async(key,load)=>{
   if(!await active())throw Object.assign(Error('paused'),{workerStatus:'paused_lease_held'});
   let value=await store.cacheGet(key);
   if(value===null){
    // Reservation, including the cache's unknown lock, precedes EVERY external
    // search/metadata request. No retry or second provider on ambiguous results.
    if(!await store.reserve(job,leaseId,key,'search'))throw Object.assign(Error('budget'),{workerStatus:'awaiting_budget'});
    if(!await active())throw Object.assign(Error('paused'),{workerStatus:'paused_lease_held'});
    if(store.markActivity&&await store.markActivity(job,leaseId,'searching')!==true)throw Object.assign(Error('activity unconfirmed'),{workerStatus:'paused_lease_held'});
    if(!await active())throw Object.assign(Error('paused'),{workerStatus:'paused_lease_held'});
    phase='search';value=await load();phase='cache_write';
    if(await store.cachePut(job,leaseId,key,value)!==true)throw Error('cache acknowledgement unconfirmed');
   }
   return value;
  };
  const processCandidates=async(candidates,item,limit)=>{
   if(!Array.isArray(candidates)||candidates.length>3)throw Error('invalid source result');
   let taken=0;
   for(const rawCandidate of candidates){
    if(staged>=3||taken>=limit)break;
    const candidate=normalizeCommonsCandidate(rawCandidate);
    if(classifySource(candidate)!=='pending_visual_review')continue;
    const urlKey=sha(candidate.previewUrl);if(seen.has(urlKey))continue;seen.add(urlKey);
    if(!await active())return {status:'paused_lease_held'};
    if(!await store.reserve(job,leaseId,urlKey,'download'))return await finish('awaiting_budget');
    if(!await active())return {status:'paused_lease_held'};
    if(store.markActivity&&await store.markActivity(job,leaseId,'searching')!==true)return {status:'paused_lease_held'};
    if(!await active())return {status:'paused_lease_held'};
    phase='download';const image=await loadImage(candidate.previewUrl);
    phase='image_validation';
    const mime=image.mime||({png:'image/png',jpg:'image/jpeg',webp:'image/webp'})[image.ext];
    const row=validate({questionId:job.question_id,explanation:text,bytes:image.bytes,mime,sourceUrl:candidate.sourceUrl,licenseUrl:candidate.licenseUrl,license:candidate.license,attribution:candidate.attribution,sectionTitle:item.caption});
    if(seen.has(row.image_sha256))continue;seen.add(row.image_sha256);
    if(store.markActivity&&await store.markActivity(job,leaseId,'pending_visual_review')!==true)return {status:'paused_lease_held'};
    phase='stage';const candidateId=await store.stage(job,leaseId,row,item);
    // Uncertain staging may already have persisted the image. Hold instead of
    // sending another model request or staging a second copy.
    if(typeof candidateId!=='string'||!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(candidateId))return {status:'held_for_review',failurePhase:'stage'};
    staged++;taken++;
    if(finalReview){
     phase='model_review';const verdict=await finalReview({job,row,item,text,candidateId});
     if(verdict?.status==='mismatch')continue;
     if(verdict?.status==='display')return {status:'approved'};
     return {status:'held_for_review'};
    }
    pending++;
   }
   return null;
  };
  for(const item of needs.items.slice(0,3)){
   const concept=CATALOG[item.conceptId];
   if(!(item.catalogRevision==='schema-query-v1'&&automaticQuery(item)===item.query)&&!(item.catalogRevision==='reviewed-query-v1'&&safeQuery(item.query)===item.query)&&(!concept||concept.query!==item.query||concept.revision!==item.catalogRevision))return await finish('awaiting_concept_review');
   const alternatives=item.queryAlternatives||[];
   if(!Array.isArray(alternatives)||alternatives.length>1||alternatives.some(q=>item.catalogRevision!=='schema-query-v1'||!item.proposedAlternatives?.includes(q)||automaticQuery({...item,proposedQuery:q})!==q))return await finish('awaiting_concept_review');
   for(const query of [...new Set([item.query,...alternatives])]){
    if(staged>=3)break;
    const candidates=await readMetadata(cacheKey(query),async()=>(await search(query)).slice(0,3));
    // Keep the legacy Commons cache identity. When the broader source is
    // enabled, reserve two of the three visual checks for alternate candidates.
    const broader=typeof discover==='function'&&typeof finalReview==='function'&&/^[a-z][a-z -]{1,89}$/.test(query.toLowerCase())&&query.split(' ').length<=8;
    const result=await processCandidates(candidates,item,broader?1:3);
    if(result)return result;
    if(pending)break;
    // Only a confirmed result can reach this bounded short-query fallback.
    // An unknown search/cache/review exits above and never tries another route.
    const shorter=query===item.query?shorterMedicalQuery(item):null;
    if(shorter&&staged<3){
     const core=await readMetadata(cacheKey(shorter),async()=>(await search(shorter)).slice(0,3));
     const coreResult=await processCandidates(core,item,broader?1:3-staged);
     if(coreResult)return coreResult;
     if(pending)break;
    }
    if(broader&&staged<3){
     const excludedSources=[],deferred=[];
     // Continue to the second already-bounded article only after confirmed
     // mismatches/ineligible candidates from the first. Unknown still exits.
     for(let article=0;article<2&&staged<3;article++){
      const fromPmc=await discover(query.toLowerCase(),(identity,load)=>readMetadata(sha(identity),load),undefined,{excludedSources});
      if(!fromPmc.length)break;
      const fresh=fromPmc.filter(x=>!excludedSources.includes(x.sourceUrl));if(!fresh.length)break;
      const reviewed=await processCandidates(fresh,item,1);if(reviewed)return reviewed;
      deferred.push(...fresh);
      excludedSources.push(...fresh.map(x=>x.sourceUrl));
     }
     // Try one candidate per article first. Only then spend any remaining
     // visual checks on other already-discovered figures, never over three.
     const remainder=await processCandidates(deferred.slice(0,3),item,3-staged);if(remainder)return remainder;
    }
    // Only completed empty/ineligible results or committed mismatch verdicts
    // reach the next source/query. Unknown outcomes exit the whole job.
   }
  }
  return await finish(pending?'pending_visual_review':'awaiting_image');
 }catch(error){
  if(error?.workerStatus==='paused_lease_held')return {status:'paused_lease_held'};
  if(error?.workerStatus==='awaiting_budget')return await finish('awaiting_budget');
  console.warn('figure_worker_failed',JSON.stringify({requestId:job.request_id,phase}));
  return {...await finish('awaiting_image'),failurePhase:phase};
 }finally{
  // Presentation only: never clear the lease, unknown operation or reservation.
  try{await store.clearActivity?.(job,leaseId)}catch{/* A short activity TTL still expires. */}
 }
}
function createStore(db,{requestId=null,target,targets=target?[target]:boundedImageTargets(process.env)}={}){
 const rpc=async(name,args)=>{const {data,error}=await db.rpc(name,args);if(error)throw Error(name+' unavailable');return data};
 const one=async(table,cols,field,id)=>{const {data,error}=await db.from(table).select(cols).eq(field,id).maybeSingle();if(error)throw Error('read unavailable');return data};
 return {
  async claim(lease){
   if(!await figureCaptureAllowed(db))return null;
   let exactRequest=requestId;
   if(process.env.EXPLANATION_SITEWIDE_ENABLED==='1'&&!exactRequest){exactRequest=await rpc('explanation_sitewide_next_image',{});if(!exactRequest)return null;}
   // New RPC must be installed first. Missing/old RPC fails closed; no fallback
   // to reclaiming an expired lease or resetting an attempt counter.
   if(process.env.EXPLANATION_SITEWIDE_ENABLED!=='1'&&process.env.NEW_EXPLANATION_IMAGES_SINGLE_BATCH&&!targets.length)return null;
   for(const target of (targets.length?targets:[null])){
    const data=await rpc('figure_image_claim_fresh',{p_lease:lease,p_seconds:600,p_request:exactRequest,p_question:target?.questionId??null,p_text_sha:target?.textHash??null});
    const job=Array.isArray(data)?data[0]:data;
    if(!job)continue;
    if(job.attempts!==1 || (exactRequest&&job.request_id!==exactRequest) || (target&&(job.question_id!==target.questionId||job.explanation_sha256!==target.textHash)))return null;
    return job;
   }
   return null;
  },
  async markActivity(job,lease,status){
   if(!['searching','pending_visual_review'].includes(status))return false;
   const {data,error}=await db.from('figure_queue_jobs').update({image_status:status,updated_at:new Date().toISOString()}).eq('request_id',job.request_id).eq('explanation_sha256',job.explanation_sha256).eq('state','leased').eq('lease_id',lease).gt('lease_until',new Date().toISOString()).select('request_id').maybeSingle();
   return !error&&data?.request_id===job.request_id;
  },
  async clearActivity(job,lease){
   await db.from('figure_queue_jobs').update({image_status:'awaiting_image'}).eq('request_id',job.request_id).eq('explanation_sha256',job.explanation_sha256).eq('state','leased').eq('lease_id',lease).eq('image_status','searching');
  },
  async readText(id){return (await one('question_explanation_overrides','explanation','question_id',id))?.explanation},
  async readNeeds(id){const row=await one('figure_queue_jobs','figure_needs,needs_state','request_id',id);return row?.needs_state==='approved'?row.figure_needs:null},
  active:async(job,lease)=>await figureCaptureAllowed(db) && rpc('figure_image_active',{p_id:job.request_id,p_lease:lease}),
  cacheGet:key=>rpc('figure_image_cache_get',{p_key:key}),
  reserve:async(job,lease,key,kind)=>await figureCaptureAllowed(db) && rpc('figure_image_reserve',{p_id:job.request_id,p_lease:lease,p_key:key,p_kind:kind}),
  cachePut:(job,lease,key,items)=>rpc('figure_image_cache_put',{p_id:job.request_id,p_lease:lease,p_key:key,p_items:items}),
  stage:(job,lease,row,item)=>rpc('figure_image_stage',{p_request:job.request_id,p_lease:lease,p_id:randomUUID(),p_question:row.question_id,p_text_sha:row.explanation_sha256,p_image_sha:row.image_sha256,p_mime:row.image_mime,p_bytes:'\\x'+row.image_bytes.toString('hex'),p_source:row.source_url,p_license_url:row.license_url,p_license:row.license,p_attribution:row.attribution,p_section:item.caption,p_anchor:item.sectionAnchor,p_section_title:item.sectionTitle,p_section_hash:item.sectionHash}),
  async finish(job,lease,status){const result=await rpc('figure_image_finish',{p_id:job.request_id,p_lease:lease,p_status:status});if(result!=='done')throw Error('finish unconfirmed');return {status}}
 };
}
module.exports={shorterMedicalQuery,boundedImageTargets,boundedImageTarget,imageWindowOpen,buildNeedsWithFallback,automaticQuery,approveSchemaQueries,safeQuery,approveKnownConcepts,processSavedImages,buildNeeds,approveConcepts,runOne,createStore,CATALOG,IMAGE_PROMPT,cacheKey,sha};
