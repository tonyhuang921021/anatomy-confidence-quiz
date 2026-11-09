const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const {userProvidedExplanationFigure:lookup}=require('../lib/userProvidedExplanationFigure.cjs');
const id='MOEX-111020-1301-Q068',hash='662447cf9e1d422207794b3866ba9597f9947eb5bc428bf7e6d925ba61e0859f',revision='9380baa3-1948-4709-9ac5-352d52b81e6e';
test('only exact question text and replacement version may display supplied textbook image',()=>{
 assert.ok(lookup(id,hash,revision));
 for(const args of [['MOEX-111020-1301-Q069',hash,revision],[id,'0'.repeat(64),revision],[id,hash,'another-version'],[id,hash,null],[id,hash,undefined]])assert.equal(lookup(...args),null);
});
test('asset is the unmodified supplied JPEG with pinned content digest',()=>{
 const f=lookup(id,hash,revision),bytes=fs.readFileSync('public'+f.asset);
 assert.equal(bytes.length,50128);assert.deepEqual([...bytes.subarray(0,3)],[255,216,255]);
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),f.imageSha256);
 assert.ok(Object.isFrozen(f));assert.match(f.asset,/^\/user-provided-explanations\/[a-f0-9]{64}\.jpg$/);
});
test('citation and example warning do not mislabel the user supplied image as openly licensed',()=>{
 const f=lookup(id,hash,revision);assert.match(f.attribution,/Guyton and Hall.*12.*27-19/);assert.equal(f.sourceUrl,'https://medizzy.com/feed/40870936');assert.match(f.exampleNote,/125 mL\/min.*84 mL\/min/);assert.match(f.exampleNote,/未提供各段腎小管的實測濃度/);assert.doesNotMatch(f.rightsNotice,/CC BY|CC0|public domain|開放授權/);assert.match(f.rightsNotice,/未修改/);
});
test('server reads saved text and revision; client matches exact hash and trusted manifest',()=>{
 const api=fs.readFileSync('app/api/approved-figures/route.ts','utf8'),ui=fs.readFileSync('components/SectionExplanationFigures.tsx','utf8');
 assert.match(api,/userProvidedExplanationFigure\(id,hash,saved\.data\.replacement_revision\)/);
 assert.match(ui,/data\.explanationHash!==hash/);assert.match(ui,/userProvidedExplanationFigure\(questionId,hash,data\.replacementRevision\)/);assert.match(ui,/data\.userProvidedFigureId===supplied\.id/);
 assert.doesNotMatch(api,/\.update\(\{|\.insert\(\{|\.delete\(/);
});
test('automatic discovery whitelist stays separate and user-supplied image never calls a model',()=>{
 const security=fs.readFileSync('lib/approvedFigureSecurity.ts','utf8');assert.doesNotMatch(security,/medizzy|user.provided/);
 const ui=fs.readFileSync('components/UserProvidedExplanationFigure.tsx','utf8');assert.doesNotMatch(ui,/fetch\(|rpc\(|openai|generate/i);assert.match(ui,/圖片來源/);
});
