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
 const source=fs.readFileSync('app/start/page.tsx','utf8');assert.match(source,/useCloudHistoryHydration\(true, \{ readRemoteOnly: true \}\)/);assert.match(source,/practiceHistoryReadiness\(/);assert.doesNotMatch(source,/historyOwnerKey === activeHistoryOwnerKey && !cloudHistoryHydrating/);assert.match(source,/practiceHistoryReady && usingLocalHistory/);assert.match(source,/practiceHistoryReady && !usingLocalHistory && !localHistoryReadWarning && willFillWithSeenQuestions/);assert.match(source,/其他裝置剛完成的題目可能尚未計入/);
});


test('actual start-page local read isolates malformed copies, keeps usable question IDs and unlocks only the active owner',()=>{
 const source=fs.readFileSync('app/start/page.tsx','utf8');
 const start=source.indexOf('    const refreshAttemptedQuestionIds = () => {');
 const end=source.indexOf('\n\n    refreshAttemptedQuestionIds();',start);
 const code=ts.transpileModule(source.slice(start,end)+'\nglobalThis.run=refreshAttemptedQuestionIds;', {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 for(const failure of ['none','malformed-current','current-throws','history-throws']){
  let ids,warning,owner,failed;
  const ctx={Set,user:{id:'fixture-owner'},activeHistoryOwnerKey:'fixture-owner',loadCompletedHistorySessionsForUser:()=>{if(failure==='history-throws')throw Error('bad history');return [{attempts:[{questionId:'completed-q'}]}]},loadCurrentSessionReadResultForUser:()=>{if(failure==='current-throws')throw Error('bad current');return {session:{attempts:[{questionId:'current-q'}]},hasUnreadableCopies:failure==='malformed-current'}},setAttemptedQuestionIds:v=>ids=v,setLocalHistoryReadWarning:v=>warning=v,setLocalHistoryReadError:v=>failed=v,setHistoryOwnerKey:v=>owner=v};
  vm.runInNewContext(code,ctx);ctx.run();
  const hardError=failure.endsWith('throws');assert.equal(owner,hardError?null:'fixture-owner');assert.equal(failed,hardError);assert.equal(warning,failure==='malformed-current');
  if(failure!=='history-throws')assert(ids.has('completed-q'));
  if(failure!=='current-throws')assert(ids.has('current-q'));
 }
 assert.match(source,/部分本機紀錄無法讀取，原始資料仍保留/);
});


test('quiz initialization read failures preserve saved current-session copies',()=>{
 const source=fs.readFileSync('app/quiz/QuizClient.tsx','utf8');
 const start=source.indexOf('      } catch {',source.indexOf('async function initializeSession'));
 const end=source.indexOf('      } finally {',start);
 assert(start>=0&&end>start);const handler=source.slice(start,end);
 assert.doesNotMatch(handler,/clearCurrentSession|removeItem|discardCurrentSession/);
 assert.match(handler,/原始作答進度仍保留/);
});
