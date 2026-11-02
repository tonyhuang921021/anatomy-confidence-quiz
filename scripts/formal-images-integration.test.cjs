const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const {buildNeeds,approveKnownConcepts,processSavedImages}=require('../lib/newExplanationFigures.cjs');
function load(path,deps={}){const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:m,exports:m.exports,require:x=>deps[x],URL});return m.exports;}
test('trusted topic approval emits fixed general query, never private question text',()=>{
 const needs=buildNeeds('## 構造\n內容',[{sectionTitle:'構造',conceptId:'carotid-sheath',caption:'位置'}]);
 const result=approveKnownConcepts(needs,{stem:'頸動脈鞘考題 with private material'});
 assert.equal(result.items[0].query,'carotid sheath anatomy');assert.equal(result.reviewMethod,'trusted_catalog');
 assert.equal(approveKnownConcepts(needs,{stem:'肺泡題目'}),null);
 assert.equal(approveKnownConcepts({...needs,items:[{...needs.items[0],conceptId:'unverified'}]},{stem:'頸動脈鞘'}),null);
});
test('disabled or failed lookup cannot invoke search or throw away saved text',async()=>{
 let external=0;const args={db:{from(){throw Error('offline')}},question:{id:'Q'},search:async()=>external++,loadImage:async()=>external++};
 assert.equal((await processSavedImages(args)).status,'disabled');assert.equal((await processSavedImages({...args,enabled:true})).status,'awaiting_image');assert.equal(external,0);
});
test('five reviewed image bindings require exact saved text hash and safe metadata',()=>{
 const figures=load('lib/terraTrialFigures.ts');const {publishedTrialFigure}=load('lib/publishedTrialFigures.ts',{'./terraTrialFigures':figures});const {safeApprovedMeta}=load('lib/approvedFigureSecurity.ts');
 const source=fs.readFileSync('lib/publishedTrialFigures.ts','utf8');const bindings=JSON.parse(source.match(/>=({.*});/)[1]);
 assert.equal(Object.keys(bindings).length,5);
 for(const [id,b]of Object.entries(bindings)){assert.ok(safeApprovedMeta(publishedTrialFigure(id,b.hash)));assert.equal(publishedTrialFigure(id,'0'.repeat(64)),null)}assert.equal(publishedTrialFigure('other','0'.repeat(64)),null);
});
