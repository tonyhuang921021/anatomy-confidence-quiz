const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const source=fs.readFileSync('lib/cloudSync.ts','utf8');
const start=source.indexOf('export async function syncLocalCompletedSessionsForCurrentUser(');
const end=source.indexOf('export async function syncCurrentSessionForCurrentUser(',start);
const code=ts.transpileModule(source.slice(start,end),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
test('partial remote history merges usable records, preserves local/pending and never reports complete',async()=>{
 const stats={writes:0,ack:0,cloud:null,local:null,history:null};
 const local={id:'local',completedAt:'2026-01-01',attempts:[]},pending={id:'pending',completedAt:'2026-01-02',attempts:[]},remote={id:'remote',completedAt:'2026-01-03',attempts:[]},cached={id:'cached',completedAt:'2026-01-04',attempts:[]};
 const merge=(...lists)=>[...new Map(lists.flat().map(x=>[x.id,x])).values()];
 const exports={};const box={exports,console:{warn:()=>{}},Error,Set,Map,Math,
  getCompletedSessionSourceUserIds:()=>['fixture-owner'],getCompletedSessionsStorageLengthForUser:()=>0,
  canonicalizeSessionsForUser:(_,xs)=>xs,mergeSessionLists:lists=>merge(...lists),isCompletedQuizSession:s=>Boolean(s.completedAt),
  loadPendingCompletedSessionUploadsForUser:()=>[pending],isSupabaseRecoveryMode:()=>false,isSupabaseConfigured:()=>true,
  withAbortableClientTimeout:task=>task({}),fetchResolvedQuizSessionsForUser:async()=>({sessions:[remote],unresolvedCompletedSessionIds:['missing-attempts']}),
  loadCloudCompletedSessionsForUser:()=>[cached],mergeSessions:merge,
  getConfirmedPendingSessions:()=>{stats.ack++;return [pending]},commitUploadedCompletedSessionsForUser:()=>{stats.ack++},
  loadRecentLocalCompletedSessionsForUploadForUser:()=>[],loadRecentCompletedSessionHandoffForUser:()=>[],loadCompletedSessionsForUser:()=>[local],
  getRecentSessionsWithinUploadBudget:xs=>xs,sessionFreshnessValue:s=>s.id,
  saveCloudCompletedSessionsForUser:(_,xs)=>stats.cloud=xs,saveCompletedSessionsForUser:(_,xs)=>stats.local=xs,mergeCompletedQuestionHistoryFromSessionsForUser:(_,xs)=>stats.history=xs,
  upsertSessionsForUserInBatches:async()=>stats.writes++,
  CLOUD_HEAVY_LOCAL_HISTORY_READ_LIMIT:1000,CLOUD_HEAVY_LOCAL_HISTORY_RECOVERY_LIMIT:25,CLOUD_COMPLETED_HISTORY_READ_TIMEOUT_MS:20000,CLOUD_LIGHT_COMPLETED_SESSION_UPLOAD_LIMIT:10,CLOUD_LIGHT_COMPLETED_ATTEMPT_UPLOAD_LIMIT:100};
 vm.runInNewContext(code,box);
 await assert.rejects(exports.syncLocalCompletedSessionsForCurrentUser('fixture-owner',{readRemoteOnly:true,hydrateRemoteHistory:true}),/部分雲端紀錄尚未完整讀取（1 回）/);
 assert.deepEqual(stats.cloud.map(x=>x.id).sort(),['cached','remote']);
 assert.deepEqual(stats.local.map(x=>x.id).sort(),['local','pending','remote']);
 assert.equal(stats.ack,0);assert.equal(stats.writes,0);assert.equal(stats.history.length,3);
});
