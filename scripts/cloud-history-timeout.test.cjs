const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const ROOT=require('node:path').resolve(__dirname,'..');
const ts=require(ROOT+'/node_modules/typescript');
const source=fs.readFileSync(ROOT+'/lib/cloudSync.ts','utf8');
const part=source.slice(source.indexOf('async function withAbortableClientTimeout'),source.indexOf('async function fetchWithClientTimeout'));
const ctx={AbortController,setTimeout,clearTimeout,Error,Promise};
vm.createContext(ctx);vm.runInContext(ts.transpileModule(part,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,ctx);
const call=(task,ms=5)=>ctx.withAbortableClientTimeout(task,ms,'TEST_HISTORY_TIMEOUT');
const observe=async p=>Promise.race([p.then(value=>({status:'resolved',value}),error=>({status:'rejected',message:error.message})),new Promise(r=>setTimeout(()=>r({status:'still-pending'}),50))]);
test('history read deadline settles even when the SDK waits before fetch and ignores abort',async()=>{
 let signal;const result=await observe(call(s=>{signal=s;return new Promise(()=>{})}));
 assert.equal(signal.aborted,true);assert.deepEqual(result,{status:'rejected',message:'TEST_HISTORY_TIMEOUT'});
});
test('late success cannot turn a timed-out history read into success',async()=>{
 let finish;const result=await observe(call(()=>new Promise(r=>finish=r)));
 finish(['late data']);assert.deepEqual(result,{status:'rejected',message:'TEST_HISTORY_TIMEOUT'});
});
test('normal successful reads preserve their result',async()=>{
 const result=await observe(call(async()=>['confirmed history']));assert.deepEqual(result,{status:'resolved',value:['confirmed history']});
});
test('real failures before the deadline preserve their error',async()=>{
 const result=await observe(call(async()=>{throw Error('network failed')}));assert.deepEqual(result,{status:'rejected',message:'network failed'});
});
test('actual provider background task releases its read lock and returns read failure without changing write sync state',async()=>{
 const auth=fs.readFileSync(ROOT+'/components/AuthProvider.tsx','utf8');
 const begin=auth.indexOf('    syncTask = (async (): Promise<CloudRefreshResult> => {');
 const end=auth.indexOf('\n    activeSyncRef.current = syncTask;',begin);
 assert(begin>=0&&end>begin);
 const state={status:'syncing',error:'',version:0};let writes=0;
 const box={syncTask:null,activeSyncRef:{current:null},sessionRef:{current:{user:{id:'fixture-user'}}},userId:'fixture-user',effectiveUser:{},hydrateRemoteHistory:true,uploadAllPending:false,readRemoteOnly:true,explicitOptions:{automatic:false},isHistoryHydration:true,HISTORY_CLOUD_SYNC_ATTEMPT_COOLDOWN_MS:90000,
    resolveLiveAuthSessionForOwner:async()=>({user:{id:'fixture-user'}}),getSupabaseBrowserClient:()=>({}),
    setSession:()=>{},setUser:()=>{},saveAuthSessionSnapshot:()=>{},getErrorMessage:e=>e.message,
  syncLocalCompletedSessionsForCurrentUser:()=>call(()=>new Promise(()=>{})),syncLeaderboardProfileForCurrentUser:async()=>{writes++},syncCurrentSessionForCurrentUser:async()=>{writes++},
  setSyncError:v=>state.error=v,setSyncStatus:v=>state.status=v,setSyncVersion:fn=>state.version=fn(state.version),markLocalSyncFallback:e=>{state.error=e.message;state.status='ready'},console};
 vm.createContext(box);vm.runInContext(ts.transpileModule(auth.slice(begin,end),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,box);
 box.activeSyncRef.current=box.syncTask;
 const result=await box.syncTask;
 assert.equal(result.status,'failed');assert.equal(box.activeSyncRef.current,null);assert.equal(result.message,'TEST_HISTORY_TIMEOUT');assert.equal(state.status,'syncing');assert.equal(state.error,'');assert.equal(writes,0);
});
