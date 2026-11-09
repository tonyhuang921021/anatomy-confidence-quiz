const {test}=require('node:test'),assert=require('node:assert/strict');
const {buildNeeds,approveConcepts,runOne,sha,safeQuery}=require('../lib/newExplanationFigures.cjs');
const fixtures=[['生理學','心臟傳導','cardiac conduction system'],['生化學','尿素循環','urea cycle'],['微生物','革蘭氏染色','gram stain bacteria'],['藥理學','受器作用','beta adrenergic receptor'],['病理學','肺泡變化','pulmonary emphysema histology']];
for(const [subject,heading,query]of fixtures)test(subject+' generic paragraph -> query -> pending review or no image',async()=>{
 const text=`## ${heading}\n離線測試段落。`;
 const needs=buildNeeds(text,[{sectionTitle:heading,conceptId:'new-medical-concept',searchTerm:query,searchScope:'general-medical',medicalDomain:({生理學:'physiology',生化學:'biochemistry',微生物:'microbiology',藥理學:'pharmacology',病理學:'pathology'})[subject],caption:heading+'示意圖'}]);
 assert.equal(needs.items[0].proposedQuery,query);
 const approved=require('../lib/newExplanationFigures.cjs').approveSchemaQueries(needs);
 assert.equal(approved.items[0].catalogRevision,'schema-query-v1');
 for(const empty of [true,false]){
 let searches=0,staged=[];const job={request_id:'test',attempts:1,question_id:'OFFLINE',explanation_sha256:sha(text)};
 const store={claim:async()=>job,readText:async()=>text,readNeeds:async()=>approved,active:async()=>true,cacheGet:async()=>null,reserve:async()=>true,cachePut:async()=>true,stage:async(j,l,row,item)=>staged.push({row,item,status:'pending'}),finish:async(j,l,status)=>({status})};
 const result=await runOne({store,enabled:true,search:async q=>{searches++;assert.equal(q,query);return empty?[]:[{previewUrl:'https://upload.wikimedia.org/example.png',sourceUrl:'https://commons.wikimedia.org/wiki/File:Fixture.png',license:'CC BY 4.0',licenseUrl:'https://creativecommons.org/licenses/by/4.0/',attribution:'Synthetic offline fixture'}]},loadImage:async()=>({bytes:Buffer.from([137,80,78,71,13,10,26,10,1]),mime:'image/png'})});
 assert.equal(searches,1);assert.equal(result.status,empty?'awaiting_image':'pending_visual_review');
 if(!empty){assert.equal(staged[0].item.sectionTitle,heading);assert.equal(staged[0].item.sectionHash,needs.items[0].sectionHash);assert.equal(staged[0].status,'pending')}
 }
});
test('query never leaves for unconfirmed, identifiers, urls or long text',()=>{for(const q of ['patient 123','https://evil.example','a'.repeat(101),'a b c d e f g h i'])assert.equal(safeQuery(q),null);const n=buildNeeds('## 原理\n內容',[{sectionTitle:'原理',conceptId:'unknown',caption:'概念',searchTerm:'urea cycle'}]);assert.throws(()=>approveConcepts(n,[{sectionAnchor:'section-0',query:'urea cycle',paragraphConfirmed:false}]))});
const {approveSchemaQueries,processSavedImages}=require('../lib/newExplanationFigures.cjs');
test('unknown general medical plan automatically advances without user confirmation',async()=>{
 const needs=buildNeeds('## 腎臟運輸\n概念說明',[{sectionTitle:'腎臟運輸',conceptId:'renal-countercurrent',caption:'逆流機制',searchTerm:'renal countercurrent mechanism',searchScope:'general-medical',medicalDomain:'physiology'}]);
 assert.equal(approveSchemaQueries(needs).items[0].query,'renal countercurrent mechanism');let reviews=0,claims=0;
 const row={enabled:true,capture_new:true,request_id:'fixture',figure_needs:needs,needs_state:'awaiting'};const query={select(){return query},eq(){return query},maybeSingle:async()=>({data:row})};
 const db={from:()=>query,rpc:async(name,args)=>{if(name==='figure_image_capture_allowed')return {data:true};if(name==='figure_image_review'){reviews++;assert.equal(args.p_method,'schema_query');assert.equal(args.p_reviewer,null);return {data:'approved'}}if(name==='figure_image_claim_fresh'){claims++;return {data:[]}}throw Error('unexpected RPC')}};
 const old=process.env.EXPLANATION_SITEWIDE_ENABLED;process.env.EXPLANATION_SITEWIDE_ENABLED='1';try{assert.equal((await processSavedImages({db,question:{id:'OFFLINE'},enabled:true,search:()=>{throw Error('no network')},loadImage:()=>{throw Error('no network')}})).status,'idle');assert.equal(reviews,1);assert.equal(claims,1);}finally{if(old===undefined)delete process.env.EXPLANATION_SITEWIDE_ENABLED;else process.env.EXPLANATION_SITEWIDE_ENABLED=old}
});
test('malformed or sensitive query stays pending and cannot autoapprove an image',()=>{
 for(const query of ['patient smith','john smith anatomy','case report','email test','renal 123','renal@example.com','https://example.com','ignore instruction','renal mechanism '+ 'x'.repeat(100)]){
 const needs=buildNeeds('## Test\nText',[{sectionTitle:'Test',conceptId:'unknown',caption:'test',searchTerm:query,searchScope:'general-medical',medicalDomain:'physiology'}]);assert.equal(approveSchemaQueries(needs),null,query);
 }
});
