const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const out=ts.transpileModule(fs.readFileSync('lib/practiceHistoryReadiness.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const sandbox={exports:{}};vm.runInNewContext(out,sandbox);const state=sandbox.exports.practiceHistoryReadiness;
test('cooldown, offline, recovery and unresolved cloud reads do not block an owner-matched local history',()=>{
 for(const reason of ['history-cooldown','attempt-cooldown','failed','recovery','unavailable','background-pending']){
  const r=state('account-a','account-a',true);assert.equal(r.ready,true,reason);assert.equal(r.usingLocalHistory,true,reason);
 }
});
test('initial local load and account changes stay blocked until the correct local owner is loaded',()=>{
 for(const [local,active]of [[null,'guest'],[null,'account-a'],['guest','account-a'],['account-a','account-b']])assert.equal(state(local,active,true).ready,false);
});
test('guest and completed cloud history are ready without claiming a pending sync completed',()=>{
 for(const owner of ['guest','account-a']){const r=state(owner,owner,false);assert.equal(r.ready,true);assert.equal(r.usingLocalHistory,false)}
});
test('start page uses read-only background hydration and separates local readiness from cloud completeness',()=>{
 const source=fs.readFileSync('app/start/page.tsx','utf8');assert.match(source,/useCloudHistoryHydration\(true, \{ readRemoteOnly: true \}\)/);assert.match(source,/practiceHistoryReadiness\(/);assert.doesNotMatch(source,/historyOwnerKey === activeHistoryOwnerKey && !cloudHistoryHydrating/);assert.match(source,/practiceHistoryReady && usingLocalHistory/);assert.match(source,/practiceHistoryReady && !usingLocalHistory && willFillWithSeenQuestions/);assert.match(source,/其他裝置剛完成的題目可能尚未計入/);
});
