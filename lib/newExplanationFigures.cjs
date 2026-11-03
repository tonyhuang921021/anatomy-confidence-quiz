'use strict';
const {createHash,randomUUID}=require('node:crypto');
const {classifySource,normalizeCommonsCandidate}=require('./figureSourcePolicy.cjs');
const {validate}=require('./figureReviewService.cjs');
const sha=s=>createHash('sha256').update(s).digest('hex');
const POLICY='commons-cc-visual-v1';
// Only fixed general terms leave the server. Unknown concepts require review;
// catalog topic matching does not approve image content.
const CATALOG=Object.freeze({'carotid-sheath':{query:'carotid sheath anatomy',revision:'carotid-sheath-v1'},'carotid-sinus':{query:'carotid sinus anatomy OpenStax',revision:'carotid-sinus-v1'},'dural-venous-sinuses':{query:'dural venous sinuses OpenStax',revision:'dural-venous-sinuses-v1'}});
const IMAGE_PROMPT='詳解小標請用 ##。同一次 JSON 的根物件請一併提供 figureNeeds 陣列（最多3項，欄位名固定 figureNeeds，不可放到 explanation 字串內），每項格式：{sectionTitle:完全相同的小標,conceptId:一般醫學概念英文代碼,caption:簡短圖說,searchScope:固定general-medical,medicalDomain:anatomy或physiology或biochemistry或microbiology或pathology或pharmacology,searchTerm:小寫英文一般醫學名詞（優先英文，最多8個詞，不含人名、題文、數值或識別資料）}。只為能幫助理解的段落提圖；無適合圖片則明確給空陣列，勿省略此欄位。結構範例：{"explanation":"## 機轉\\n文字","optionAnalysis":{},"memoryTip":"","figureNeeds":[{"sectionTitle":"機轉","conceptId":"medical-concept","caption":"概念圖","searchScope":"general-medical","medicalDomain":"biochemistry","searchTerm":"citric acid cycle"}]}。範例概念僅示範格式，請換成當題概念。不要產生網址、來源、授權或患者資料。圖片需求失敗不影響完整詳解。';
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
 if(item.searchScope!=='general-medical'||!['anatomy','physiology','biochemistry','microbiology','pathology','pharmacology'].includes(item.medicalDomain))return null;
 return q;
}
function approveSchemaQueries(needs){
 if(!needs?.items?.length)return null;
 const items=needs.items.map(item=>{const query=automaticQuery(item);return query?{...item,query,catalogRevision:'schema-query-v1'}:null});
 if(items.some(x=>!x))return null;
 return {...needs,items,status:'approved',reviewMethod:'schema_query'};
}
function buildNeeds(text,hints){
 if(typeof text!=='string'||!text.trim())return null;
 const matches=[...text.matchAll(/^##\s+([^\n]{1,80})\s*$/gm)];
 const sections=matches.map((m,i)=>({title:m[1].trim(),text:text.slice(m.index,matches[i+1]?.index??text.length).trim()}));
 const items=[];
 for(const hint of (Array.isArray(hints)?hints:hints&&typeof hints==='object'?[hints]:[]).slice(0,3)){
  if(!hint||typeof hint.sectionTitle!=='string'||typeof hint.conceptId!=='string'||! /^[a-z][a-z0-9-]{0,59}$/.test(hint.conceptId)||typeof hint.caption!=='string'||!hint.caption.trim()||hint.caption.length>80)continue;
  const section=sections.filter(s=>s.title===hint.sectionTitle);
  if(section.length!==1||items.some(x=>x.sectionTitle===hint.sectionTitle))continue;
  items.push({sectionTitle:section[0].title,sectionHash:sha(section[0].text),sectionAnchor:'section-'+sections.indexOf(section[0]),conceptId:hint.conceptId,caption:hint.caption.trim(),proposedQuery:safeQuery(hint.searchTerm)||CATALOG[hint.conceptId]?.query||null,searchScope:hint.searchScope,medicalDomain:hint.medicalDomain});
 }
 const explanationHash=sha(text);
 return {explanationHash,items,revision:sha(JSON.stringify({explanationHash,items})),status:items.length?'awaiting_query_review':'awaiting_image_plan'};
}
function buildNeedsWithFallback(text,hints,question){
 const planned=buildNeeds(text,hints);if(planned?.items?.length&&(approveSchemaQueries(planned)||approveKnownConcepts(planned,question)))return planned;
 const domains={'組織學':'anatomy','胚胎學':'anatomy','胚胎及發育生物學':'anatomy','免疫學':'microbiology','寄生蟲學':'microbiology','微生物及免疫學':'microbiology','微生物免疫學':'microbiology','解剖學':'anatomy','生理學':'physiology','生物化學':'biochemistry','微生物學':'microbiology','病理學':'pathology','藥理學':'pharmacology'};
 const domain=domains[question?.subject];if(!domain)return planned;
 const matches=[...text.matchAll(/^##\s+([^\n]{1,80})\s*$/gm)];
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
async function processSavedImages({db,question,actor,search,loadImage,enabled=false}){
 if(!enabled)return {status:'disabled'};
 try{
  const {data:job,error}=await db.from('figure_queue_jobs').select('request_id,figure_needs,needs_state').eq('question_id',question.id).eq('state','pending').maybeSingle();
  if(error||!job)return {status:'no_pending_plan'};
  if(job.needs_state==='awaiting'){
   const approved=approveSchemaQueries(job.figure_needs)||approveKnownConcepts(job.figure_needs,question);if(!approved)return {status:'awaiting_concept_review'};
   const review=await db.rpc('figure_image_review',{p_id:job.request_id,p_revision:approved.revision,p_needs:approved,p_reviewer:null,p_method:approved.reviewMethod});
   if(review.error||review.data!=='approved')return {status:'awaiting_concept_review'};
  }
  return await runOne({store:createStore(db),search,loadImage,enabled:true});
 }catch{return {status:'awaiting_image'}}
}
function imageWindowOpen(env,now=Date.now()){const end=Date.parse(env.NEW_EXPLANATION_IMAGES_RUN_UNTIL||'');return Number.isFinite(end)&&now<end}
function cacheKey(query){return sha(JSON.stringify([POLICY,query]))}
async function runOne({store,search,loadImage,enabled=false,leaseId=randomUUID()}){
 if(!enabled)return {status:'disabled'};
 const job=await store.claim(leaseId);if(!job)return {status:'idle'};
 const finish=(status)=>store.finish(job,leaseId,status);
 try{
  const text=await store.readText(job.question_id);
  if(typeof text!=='string'||sha(text)!==job.explanation_sha256)return await finish('stale');
  const needs=await store.readNeeds(job.request_id);
  if(needs?.status!=='approved'||needs.explanationHash!==sha(text))return await finish('awaiting_concept_review');
  let staged=0,seen=new Set();
  for(const item of needs.items.slice(0,3)){
   const concept=CATALOG[item.conceptId];
   if(!(item.catalogRevision==='schema-query-v1'&&automaticQuery(item)===item.query)&&!(item.catalogRevision==='reviewed-query-v1'&&safeQuery(item.query)===item.query)&&(!concept||concept.query!==item.query||concept.revision!==item.catalogRevision))return await finish('awaiting_concept_review');
   if(!await store.active(job,leaseId))return {status:'paused_lease_held'};
   const key=cacheKey(item.query);let candidates=await store.cacheGet(key);
   if(candidates===null){
    // Atomic reservation and cache lock precede all external traffic. Unknown
    // outcomes consume the cap, including failed requests. No refunds/retries.
    if(!await store.reserve(job,leaseId,key,'search'))return await finish('awaiting_budget');
    candidates=(await search(item.query)).slice(0,3);
    await store.cachePut(job,leaseId,key,candidates);
   }
   for(const rawCandidate of candidates.slice(0,3)){
    const candidate=normalizeCommonsCandidate(rawCandidate);
    if(staged>=3)break;
    if(classifySource(candidate)!=='pending_visual_review')continue;
    const urlKey=sha(candidate.previewUrl);if(seen.has(urlKey))continue;seen.add(urlKey);
    if(!await store.active(job,leaseId))return {status:'paused_lease_held'};
    if(!await store.reserve(job,leaseId,urlKey,'download'))return await finish('awaiting_budget');
    const image=await loadImage(candidate.previewUrl);
    const mime=image.mime||({png:'image/png',jpg:'image/jpeg',webp:'image/webp'})[image.ext];
    const row=validate({questionId:job.question_id,explanation:text,bytes:image.bytes,mime,sourceUrl:candidate.sourceUrl,licenseUrl:candidate.licenseUrl,license:candidate.license,attribution:candidate.attribution,sectionTitle:item.caption});
    if(seen.has(row.image_sha256))continue;seen.add(row.image_sha256);
    await store.stage(job,leaseId,row,item);staged++;
   }
  }
  return await finish(staged?'pending_visual_review':'awaiting_image');
 }catch{return await finish('awaiting_image')}
}
function createStore(db){
 const rpc=async(name,args)=>{const {data,error}=await db.rpc(name,args);if(error)throw Error(name+' unavailable');return data};
 const one=async(table,cols,field,id)=>{const {data,error}=await db.from(table).select(cols).eq(field,id).maybeSingle();if(error)throw Error('read unavailable');return data};
 return {
  async claim(lease){const data=await rpc('figure_queue_claim',{p_lease:lease,p_seconds:600});return Array.isArray(data)?data[0]:data},
  async readText(id){return (await one('question_explanation_overrides','explanation','question_id',id))?.explanation},
  async readNeeds(id){const row=await one('figure_queue_jobs','figure_needs,needs_state','request_id',id);return row?.needs_state==='approved'?row.figure_needs:null},
  active:(job,lease)=>rpc('figure_image_active',{p_id:job.request_id,p_lease:lease}),
  cacheGet:key=>rpc('figure_image_cache_get',{p_key:key}),
  reserve:(job,lease,key,kind)=>rpc('figure_image_reserve',{p_id:job.request_id,p_lease:lease,p_key:key,p_kind:kind}),
  cachePut:(job,lease,key,items)=>rpc('figure_image_cache_put',{p_id:job.request_id,p_lease:lease,p_key:key,p_items:items}),
  stage:(job,lease,row,item)=>rpc('figure_image_stage',{p_request:job.request_id,p_lease:lease,p_id:randomUUID(),p_question:row.question_id,p_text_sha:row.explanation_sha256,p_image_sha:row.image_sha256,p_mime:row.image_mime,p_bytes:'\\x'+row.image_bytes.toString('hex'),p_source:row.source_url,p_license_url:row.license_url,p_license:row.license,p_attribution:row.attribution,p_section:item.caption,p_anchor:item.sectionAnchor,p_section_title:item.sectionTitle,p_section_hash:item.sectionHash}),
  async finish(job,lease,status){const result=await rpc('figure_image_finish',{p_id:job.request_id,p_lease:lease,p_status:status});if(result!=='done')throw Error('finish unconfirmed');return {status}}
 };
}
module.exports={imageWindowOpen,buildNeedsWithFallback,automaticQuery,approveSchemaQueries,safeQuery,approveKnownConcepts,processSavedImages,buildNeeds,approveConcepts,runOne,createStore,CATALOG,IMAGE_PROMPT,cacheKey,sha};
