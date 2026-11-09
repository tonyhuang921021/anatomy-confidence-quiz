const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const transpile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const exported={};
vm.runInNewContext(transpile(fs.readFileSync('lib/authSessionRecovery.ts','utf8')),{exports:exported,Date,Error,Object,Number});
const source=fs.readFileSync('components/AuthProvider.tsx','utf8');
const authFunctions=source.slice(source.indexOf('function isAuthSessionExpiring('),source.indexOf('function saveAuthSessionSnapshot('));
const valid=()=>({user:{id:'fixture-user'},access_token:'test-only',expires_at:Date.now()/1000+3600});
const expired=()=>({...valid(),expires_at:Date.now()/1000-60});
function harness(snapshot=null){
  const ctx={...exported,Date,Error,JSON,Number,window:{localStorage:{},sessionStorage:{}},AUTH_SESSION_SNAPSHOT_KEY:'test',AUTH_SESSION_REFRESH_LEEWAY_MS:90000,AUTH_SESSION_REFRESH_TIMEOUT_MS:6000,AUTH_REFRESH_FALLBACK_MESSAGE:'refresh timeout',safeGetStorage:()=>snapshot?JSON.stringify(snapshot):null,withTimeout:p=>p};
  vm.createContext(ctx);vm.runInContext(transpile(authFunctions),ctx);return ctx;
}
test('only unexpired sessions with an owner and expiry are usable',()=>{
  assert.equal(exported.isUsableAuthSession(valid()),true);
  for(const s of [null,expired(),{...valid(),expires_at:undefined},{...valid(),expires_at:NaN},{...valid(),user:null}])assert.equal(exported.isUsableAuthSession(s),false);
});
test('completed SDK null never resurrects a saved session',async()=>{
  const ctx=harness(valid());let refresh=0;
  assert.equal(await ctx.resolveBrowserAuthSession({auth:{getSession:async()=>({data:{session:null},error:null}),refreshSession:async()=>{refresh++}}},100,'timeout'),null);
  assert.equal(refresh,0);
});
test('refresh uses SDK current state rather than a potentially rotated snapshot',async()=>{
  const ctx=harness();let args;
  const fresh=valid(),candidate={...valid(),expires_at:Date.now()/1000+10};
  const result=await ctx.refreshAuthSessionIfNeeded({auth:{refreshSession:async(...a)=>{args=a;return {data:{session:fresh},error:null}}}},candidate);
  assert.equal(result,fresh);assert.deepEqual(args,[]);
});
test('terminal refresh rejection never retains even an unexpired old candidate',async()=>{
  const ctx=harness(valid());
  await assert.rejects(ctx.refreshAuthSessionIfNeeded({auth:{refreshSession:async()=>({data:{session:null},error:{code:'refresh_token_already_used'}})}},{...valid(),expires_at:Date.now()/1000+10}),/重新登入同一帳號/);
});
test('network failure can retain a valid candidate, never an expired candidate',async()=>{
  const ctx=harness(),sdk={auth:{refreshSession:async()=>{throw Error('offline')}}};
  const candidate={...valid(),expires_at:Date.now()/1000+10};
  assert.equal(await ctx.refreshAuthSessionIfNeeded(sdk,candidate),candidate);
  await assert.rejects(ctx.refreshAuthSessionIfNeeded(sdk,expired()),/offline/);
});
test('read timeout fallback accepts only unexpired snapshots',async()=>{
  const sdk={auth:{getSession:async()=>{throw Error('read timeout')}}};
  assert.equal((await harness(valid()).resolveBrowserAuthSession(sdk,100,'timeout')).user.id,'fixture-user');
  await assert.rejects(harness(expired()).resolveBrowserAuthSession(sdk,100,'timeout'),/read timeout/);
});
test('terminal SDK error cannot be masked by a valid-looking snapshot',async()=>{
  await assert.rejects(harness(valid()).resolveBrowserAuthSession({auth:{getSession:async()=>({data:{session:null},error:{code:'refresh_token_not_found'}})}},100,'timeout'),/重新登入同一帳號/);
});
test('cooldown branches do not clear failed sync state without a completed sync',()=>{
  for(const reason of ['history-cooldown','attempt-cooldown','automatic-cooldown']){
    const end=source.indexOf(`reason: "${reason}"`),begin=source.lastIndexOf(') {',end);
    assert(begin>0);assert.doesNotMatch(source.slice(begin,end),/setSyncError|setSyncStatus/);
  }
  assert.match(source,/if \(isTerminalAuthError\(error\)\) return AUTH_RELOGIN_MESSAGE/);
});
test('server sync token lookup is bounded and refuses expired tokens before writes',async()=>{
  const cloud=fs.readFileSync('lib/cloudSync.ts','utf8');
  const part=cloud.slice(cloud.indexOf('async function getCloudSessionSyncAccessToken()'),cloud.indexOf('async function syncSessionsThroughServer('));
  let timed=0;
  const ctx={...exported,Date,Error,FEEDBACK_AUTH_REFRESH_TIMEOUT_MS:6000,getSupabaseBrowserClient:()=>({auth:{getSession:async()=>({data:{session:expired()},error:null})}}),withClientTimeout:async(p,ms)=>{assert.equal(ms,6000);timed++;return p}};
  vm.createContext(ctx);vm.runInContext(transpile(part),ctx);
  await assert.rejects(ctx.getCloudSessionSyncAccessToken(),/重新登入同一帳號/);assert.equal(timed,1);
});
