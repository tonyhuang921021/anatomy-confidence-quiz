const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {runOne,buildNeeds,approveSchemaQueries,sha,cacheKey}=require('../lib/newExplanationFigures.cjs');
const text='## 機轉\n菊糖清除率代表腎絲球濾過率。';
const needs=()=>approveSchemaQueries(buildNeeds(text,[{sectionTitle:'機轉',conceptId:'inulin-clearance',caption:'菊糖清除率',searchScope:'general-medical',medicalDomain:'physiology',searchTerm:'inulin clearance diagram',searchAlternatives:['inulin is freely filtered by the glomerulus']}]));
const commons={sourceUrl:'https://commons.wikimedia.org/wiki/File:Diagram.png',previewUrl:'https://upload.wikimedia.org/diagram.png',license:'CC0',licenseUrl:'https://creativecommons.org/publicdomain/zero/1.0/',attribution:'Synthetic fixture'};
const pmc={sourceUrl:'https://pmc.ncbi.nlm.nih.gov/articles/PMC123456/#fig-1',previewUrl:'https://pmc-oa-opendata.s3.amazonaws.com/PMC123456.1/diagram.jpg?md5=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',license:'CC BY 4.0',licenseUrl:'https://creativecommons.org/licenses/by/4.0/',attribution:'Synthetic attributed figure'};
function fixture({primary=[commons],broader=[pmc],verdicts=['mismatch','display'],stageId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',cacheAck=true,searchError=false,discoverError=false,paused=false,denyKind=null}={}){
 const events=[],cache=new Map();let stages=0,reviews=0,downloads=0;
 const job={request_id:'synthetic-request',question_id:'SYNTHETIC',explanation_sha256:sha(text),attempts:1};
 const store={claim:async()=>job,readText:async()=>text,readNeeds:async()=>needs(),active:async()=>!paused,cacheGet:async key=>cache.has(key)?cache.get(key):null,reserve:async(j,l,key,kind)=>{events.push(['reserve',kind,key]);return kind!==denyKind},cachePut:async(j,l,key,value)=>{events.push(['cache',key]);if(cacheAck)cache.set(key,value);return cacheAck},stage:async()=>{stages++;events.push(['stage']);return stageId},finish:async(j,l,status)=>({status})};
 const search=async q=>{events.push(['commons',q]);if(searchError)throw Error('uncertain');return primary};
 const discover=async(q,read)=>{events.push(['discover',q]);const results=await read('pmc-search:'+q,async()=>{events.push(['pmc-http']);if(discoverError)throw Error('uncertain');return broader});return results};
 const loadImage=async url=>{downloads++;events.push(['download',url]);return {mime:'image/png',bytes:Buffer.from([137,80,78,71,13,10,26,10,downloads])}};
 const finalReview=async()=>{events.push(['review']);const status=reviews<verdicts.length?verdicts[reviews++]:'mismatch';return status===undefined?undefined:{status}};
 return {events,cache,stats:()=>({stages,reviews,downloads}),run:(extra={})=>runOne({store,search,discover,loadImage,finalReview,enabled:true,...extra}),store};
}
test('a committed Commons mismatch advances to PMC, which still requires final visual review',async()=>{const f=fixture();assert.equal((await f.run()).status,'approved');assert.deepEqual(f.stats(),{stages:2,reviews:2,downloads:2});assert.deepEqual(f.events.filter(e=>e[0]==='review').length,2);const net=f.events.findIndex(e=>e[0]==='pmc-http');assert.equal(f.events[net-1][0],'reserve');assert.equal(f.events[net-1][1],'search');assert.equal(f.events[net+1][0],'cache')});
test('empty or ineligible Commons results use existing broader source without visual bypass',async()=>{for(const primary of [[],[{sourceUrl:'https://evil.invalid/image'}]]){const f=fixture({primary,verdicts:['display']});assert.equal((await f.run()).status,'approved');assert.equal(f.stats().reviews,1)}});
test('unknown or held visual results never dispatch another source or candidate',async()=>{for(const status of ['unknown','held',undefined]){const f=fixture({verdicts:[status]});assert.equal((await f.run()).status,'held_for_review');assert.equal(f.events.filter(e=>e[0]==='discover').length,0);assert.equal(f.stats().reviews,1)}});
test('stage must acknowledge a valid UUID before review or next candidate',async()=>{for(const stageId of [null,false,{},undefined,'','candidate']){const f=fixture({stageId:stageId===undefined?null:stageId});assert.equal((await f.run()).status,'held_for_review');assert.equal(f.stats().reviews,0);assert.equal(f.events.filter(e=>e[0]==='discover').length,0)}});
test('uncertain search, failed cache acknowledgement and source errors stop the whole job',async()=>{for(const options of [{searchError:true},{cacheAck:false},{discoverError:true}]){const f=fixture(options);assert.equal((await f.run()).status,'awaiting_image');assert.equal(f.events.filter(e=>e[0]==='commons').length,1);if(!options.discoverError)assert.equal(f.events.filter(e=>e[0]==='discover').length,0)}});
test('pause and cumulative reserve denial prevent external work',async()=>{const paused=fixture({paused:true});assert.equal((await paused.run()).status,'paused_lease_held');assert.equal(paused.events.length,0);const budget=fixture({denyKind:'search'});assert.equal((await budget.run()).status,'awaiting_budget');assert.equal(budget.events.some(e=>['commons','pmc-http','download','review'].includes(e[0])),false)});
test('all three committed mismatch verdicts finish awaiting_image, not pending review',async()=>{const f=fixture({broader:[pmc,{...pmc,previewUrl:pmc.previewUrl.replace('diagram.jpg','another.jpg')}],verdicts:['mismatch','mismatch','mismatch']});assert.equal((await f.run()).status,'awaiting_image');assert.equal(f.stats().reviews,3);assert.equal(f.stats().stages,3)});
test('confirmed empty broader result can try exactly the saved alternate query',async()=>{const f=fixture({primary:[],broader:[]});assert.equal((await f.run()).status,'awaiting_image');assert.deepEqual(f.events.filter(e=>e[0]==='commons').map(e=>e[1]),['inulin clearance diagram','inulin is freely filtered by the glomerulus']);assert.equal(f.events.filter(e=>e[0]==='pmc-http').length,2)});
test('legacy Commons cache identity remains compatible and completed cache avoids network',async()=>{assert.equal(cacheKey('inulin clearance diagram'),sha(JSON.stringify(['commons-cc-visual-v1','inulin clearance diagram'])));const f=fixture({verdicts:['display']});f.cache.set(cacheKey('inulin clearance diagram'),[commons]);assert.equal((await f.run()).status,'approved');assert.equal(f.events.some(e=>e[0]==='commons'),false)});
test('production first/replacement, cron and owner fresh routes explicitly wire the broader adapter',()=>{for(const file of ['app/api/question-explanation/route.ts','app/api/cron/rollup-stats/route.ts','app/api/owner/new-explanation-images/route.ts'])assert.match(fs.readFileSync(file,'utf8'),/discover:discoverPmcFigures/);const src=fs.readFileSync('lib/newExplanationFigures.cjs','utf8');assert.match(src,/trafficAllowed:\(\)=>imageWindowOpen\(process.env\)/)});

function toxinPlan(){return approveSchemaQueries(buildNeeds(text,[{sectionTitle:'機轉',conceptId:'g-protein-toxins',caption:'毒素訊息傳遞',searchScope:'general-medical',medicalDomain:'biochemistry',searchTerm:'cholera pertussis toxin g protein signaling'}]))}
test('confirmed empty long query tries one core mechanism on Commons before PMC, with the same final review',async()=>{const f=fixture({verdicts:['display']});f.store.readNeeds=async()=>toxinPlan();const queries=[];const result=await f.run({search:async q=>{queries.push(q);return queries.length===1?[]:[commons]}});assert.equal(result.status,'approved');assert.deepEqual(queries,['cholera pertussis toxin g protein signaling','cholera toxin mechanism']);assert.equal(f.events.some(x=>x[0]==='discover'),false);assert.equal(f.stats().reviews,1);assert.equal(f.events.filter(x=>x[0]==='reserve'&&x[1]==='search').length,2)});
test('unknown long search or failed durable cache cannot advance to core query or PMC',async()=>{for(const cacheAck of [true,false]){const f=fixture({cacheAck});f.store.readNeeds=async()=>toxinPlan();let calls=0;await f.run({search:async()=>{calls++;if(cacheAck)throw Error('unknown');return []}});assert.equal(calls,1);assert.equal(f.events.some(x=>x[0]==='discover'),false)}});
test('unknown core search stops before PMC, no automatic second attempt',async()=>{const f=fixture();f.store.readNeeds=async()=>toxinPlan();let calls=0;await f.run({search:async()=>{if(++calls===2)throw Error('unknown');return []}});assert.equal(calls,2);assert.equal(f.events.some(x=>x[0]==='discover'),false)});
test('core-query fallback remains bounded, schema-validated, and never changes the image caption or paragraph',()=>{const {shorterMedicalQuery}=require('../lib/newExplanationFigures.cjs'),item=toxinPlan().items[0],before=JSON.stringify(item);assert.equal(shorterMedicalQuery(item),'cholera toxin mechanism');assert.equal(JSON.stringify(item),before);for(const delta of [{catalogRevision:'reviewed-query-v1'},{queryAlternatives:['another query']},{searchScope:'private'},{query:'patient cholera toxin g protein'}])assert.equal(shorterMedicalQuery({...item,...delta}),null)});
test('active marker surrounds actual traffic and is stopped before unknown stage/review without releasing the lease',async()=>{const f=fixture({verdicts:['unknown']});const markers=[];f.store.markActivity=async(j,l,status)=>{markers.push(status);return true};f.store.clearActivity=async()=>markers.push('cleanup-search-only');const result=await f.run();assert.equal(result.status,'held_for_review');assert.deepEqual(markers,['searching','searching','pending_visual_review','cleanup-search-only'])});
test('unconfirmed activity marker prevents new external traffic and preserves unknown state',async()=>{const f=fixture();f.store.markActivity=async()=>false;f.store.clearActivity=async()=>{};assert.equal((await f.run()).status,'paused_lease_held');assert.equal(f.events.some(x=>['commons','discover','download','review'].includes(x[0])),false)});
test('pause during activity marker prevents the immediately following external search',async()=>{const f=fixture();let open=true;f.store.active=async()=>open;f.store.markActivity=async()=>{open=false;return true};assert.equal((await f.run()).status,'paused_lease_held');assert.equal(f.events.some(x=>x[0]==='commons'),false)});
test('two committed PMC mismatches can reach second article within the same three-image cap',async()=>{const f=fixture({primary:[],verdicts:['mismatch','mismatch','display']});const first=[pmc,{...pmc,sourceUrl:pmc.sourceUrl.replace('fig-1','fig-2'),previewUrl:pmc.previewUrl.replace('diagram','diagram2')}],second={...pmc,sourceUrl:pmc.sourceUrl.replace('123456','654321'),previewUrl:pmc.previewUrl.replace('123456','654321')};let calls=0;const result=await f.run({discover:async(q,read,fetcher,{excludedSources})=>{calls++;return excludedSources.length?[second]:first}});assert.equal(result.status,'approved');assert.equal(calls,2);assert.equal(f.stats().reviews,3)});
test('pause during download activity marker prevents download and review',async()=>{const f=fixture();let open=true,n=0;f.store.active=async()=>open;f.store.markActivity=async()=>{if(++n===2)open=false;return true};assert.equal((await f.run()).status,'paused_lease_held');assert.equal(f.events.filter(x=>x[0]==='commons').length,1);assert.equal(f.stats().downloads,0);assert.equal(f.stats().reviews,0)});

test('three figures in the first PMC article cannot consume all checks before the second article',async()=>{
 const f=fixture({primary:[],verdicts:['mismatch','display']});
 const first=[1,2,3].map(i=>({...pmc,sourceUrl:pmc.sourceUrl.replace('fig-1','fig-'+i),previewUrl:pmc.previewUrl.replace('diagram','diagram'+i)}));
 const second={...pmc,sourceUrl:pmc.sourceUrl.replace('123456','654321'),previewUrl:pmc.previewUrl.replace('123456','654321')};
 const result=await f.run({discover:async(q,read,fetcher,{excludedSources})=>excludedSources.length?[second]:first});
 assert.equal(result.status,'approved');assert.equal(f.stats().reviews,2);
 assert.deepEqual(f.events.filter(e=>e[0]==='download').map(e=>e[1]),[first[0].previewUrl,second.previewUrl]);
});
test('BER long medical query has one fixed core fallback after a confirmed empty search',async()=>{
 const f=fixture({verdicts:['display']});f.store.readNeeds=async()=>approveSchemaQueries(buildNeeds(text,[{sectionTitle:'機轉',conceptId:'base-excision-repair',caption:'鹼基切除修復流程',searchScope:'general-medical',medicalDomain:'biochemistry',searchTerm:'base excision repair enzyme sequence'}]));
 const queries=[];assert.equal((await f.run({search:async q=>{queries.push(q);return queries.length===1?[]:[commons]}})).status,'approved');
 assert.deepEqual(queries,['base excision repair enzyme sequence','base excision repair mechanism']);assert.equal(f.stats().reviews,1);
});

test('both real long TCA plans use the standard cycle name after a confirmed first result',async()=>{
 for(const searchTerm of ['citric acid cycle products reaction steps','citric acid cycle intermediates and products']){
  const f=fixture({verdicts:['display']});
  const plan=approveSchemaQueries(buildNeeds(text,[{sectionTitle:'機轉',conceptId:'citric-acid-cycle',caption:'循環中間物與產物',searchScope:'general-medical',medicalDomain:'biochemistry',searchTerm}]));
  f.store.readNeeds=async()=>plan;const before=JSON.stringify(plan),queries=[];
  assert.equal((await f.run({search:async q=>{queries.push(q);return queries.length===1?[]:[commons]}})).status,'approved');
  assert.deepEqual(queries,[searchTerm,'tca cycle']);assert.equal(f.stats().reviews,1);assert.equal(JSON.stringify(plan),before);
  assert.equal(f.events.some(x=>x[0]==='discover'),false);
 }
});
test('generic suffix trimming preserves distinguishing medical terms and exact short queries',()=>{
 const {coreMedicalTerm}=require('../lib/medicalImageQuery.cjs');
 assert.equal(coreMedicalTerm('urea cycle reaction steps'),'urea cycle');
 assert.equal(coreMedicalTerm('glomerular filtration barrier diagram'),'glomerular filtration barrier');
 assert.equal(coreMedicalTerm('tca cycle inhibitor mechanism'),null);
 assert.equal(coreMedicalTerm('reverse tca cycle diagram'),'reverse tca cycle');
 assert.equal(coreMedicalTerm('urea cycle'),null);
 assert.equal(coreMedicalTerm('protein diagram'),null);
 for(const term of ['polymerase chain reaction','pentose phosphate pathway','advanced glycation end products']){
  assert.equal(coreMedicalTerm(term),null);assert.equal(coreMedicalTerm(term+' diagram'),term);
 }
 const {shorterMedicalQuery}=require('../lib/newExplanationFigures.cjs');
 const base=toxinPlan().items[0];
 for(const query of ['base excision repair','electron transport chain','inulin clearance'])assert.equal(shorterMedicalQuery({...base,query,proposedQuery:query}),null);
 for(const query of ['patient tca cycle diagram','john urea cycle steps','https://example.invalid','tca cycle 123'])assert.equal(shorterMedicalQuery({...base,query,proposedQuery:query}),null);
});
test('TCA unknown original, core or failed cache acknowledgement never advances or replays',async()=>{
 for(const failure of ['original','core','cache']){
  const f=fixture({cacheAck:failure!=='cache'});f.store.readNeeds=async()=>approveSchemaQueries(buildNeeds(text,[{sectionTitle:'機轉',conceptId:'tca-cycle',caption:'循環產物',searchScope:'general-medical',medicalDomain:'biochemistry',searchTerm:'citric acid cycle products reaction steps'}]));
  const queries=[];await f.run({search:async q=>{queries.push(q);if(failure==='original'||failure==='core'&&queries.length===2)throw Error('unknown');return []}});
  assert.equal(queries.length,failure==='core'?2:1);assert.equal(f.events.some(x=>x[0]==='discover'),false);assert.equal(f.stats().reviews,0);
 }
});
test('precise query prompt teaches a general selection rule rather than requiring a fixed question',()=>{
 const {IMAGE_PROMPT}=require('../lib/newExplanationFigures.cjs');
 for(const rule of ['根據本題及該段詳解','標準英文名稱或常用縮寫','精準不等於長','不要混入另一個比較概念','具體要標示的產物、位置或步驟寫在caption','不要省略會改變概念的專有名詞'])assert.ok(IMAGE_PROMPT.includes(rule));
 assert.ok(IMAGE_PROMPT.includes('自行判斷'));assert.ok(IMAGE_PROMPT.includes('範例只示範格式'));assert.ok(!IMAGE_PROMPT.includes('通常2至5詞'));
 assert.doesNotMatch(IMAGE_PROMPT,/MOEX-|107020|111100/);
});
