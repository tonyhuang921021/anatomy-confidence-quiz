const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync('components/AuthProvider.tsx', 'utf8');
const begin = source.indexOf('    syncTask = (async () => {');
const end = source.indexOf('\n    syncInFlightRef.current = syncTask;', begin);
assert(begin >= 0 && end > begin, 'background sync task must be found');
const task = source.slice(begin, end);
async function runTest(fail) {
  const state = { error: '雲端同步仍在背景整理，可先使用本機紀錄。', status: 'syncing', version: 0 };
  const ctx = {
    syncTask: null, syncInFlightRef: {current: null}, userId:'test-user', effectiveUser:{},
    hydrateRemoteHistory:true, uploadAllPending:false, readRemoteOnly:false,
    explicitOptions:{automatic:false}, isHistoryHydration:false,
    syncLocalCompletedSessionsForCurrentUser: async () => { if (fail) throw Error('read failed'); return []; },
    syncLeaderboardProfileForCurrentUser: async () => {}, syncCurrentSessionForCurrentUser: async () => {},
    setSyncError: x => {state.error=x}, setSyncStatus:x=>{state.status=x},
    setSyncVersion: fn => {state.version=fn(state.version)},
    markLocalSyncFallback: err=>{state.error=err.message;state.status='ready';state.version++},
    writeHistoryCloudSyncMarker:()=>{}, clearHistoryCloudSyncAttemptMarker:()=>{}, console
  };
  vm.createContext(ctx);
  vm.runInContext(task,ctx);
  await ctx.syncTask;
  return state;
}
(async () => {
  const success=await runTest(false);
  assert.equal(success.error,''); assert.equal(success.status,'ready'); assert.equal(success.version,1);
  const failure=await runTest(true);
  assert.equal(failure.error,'read failed'); assert.equal(failure.status,'ready');
  console.log('PASS actual background task clears stale notice on success and retains real failure');
})().catch(e=>{console.error(e);process.exit(1)});
