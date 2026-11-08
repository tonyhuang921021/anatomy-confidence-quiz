const test=require('node:test'),assert=require('node:assert/strict');
const {handleExplanation}=require('../lib/explanation-orchestrator.cjs');
const {createGenerationJournal,outcome}=require('../lib/generationResultJournal.cjs');
const id='10000000-0000-4000-8000-000000000001';
const value={explanation:'完整機轉',optionAnalysis:{A:'理由 A',B:'理由 B'}};
function fixture(overrides={}){
 const events=[],q={id:'Q1',stem:'trusted',options:{A:'a',B:'b'},answer:'A'};
 const deps={generationJournal:true,isReviewed:async()=>false,auth:async()=>({id:'actor'}),resolveTrusted:async()=>q,
 readGeneration:async()=>null,recoverGeneration:async()=>({state:'pending'}),readShared:async()=>null,
 reserve:async args=>{events.push(['reserve',args]);return {ok:true,leaseId:id,fence:id,maxCalls:1,model:'gpt-6.1-terra',mode:'default'}},
 start:async()=>{events.push('start');return true},callProvider:async()=>{events.push('provider');return {value,rawText:JSON.stringify(value),responseId:'resp-1',model:'gpt-6.1-terra',usage:{inputTokens:10,outputTokens:20}}},
 checkpointGeneration:async()=>{events.push('checkpoint');return true},settle:async()=>{events.push('settle');return true},
 insertIfAbsentFenced:async()=>{events.push('commit');return {inserted:true,winner:value}},close:async()=>{events.push('close')},markUnknown:async()=>{events.push('unknown');return true},...overrides};
 return {events,deps,request:{question:{id:q.id},operationId:id}};
}
test('first generation saves exact response before settlement and commit, one provider call',async()=>{
 const f=fixture();assert.equal((await handleExplanation(f.request,f.deps)).code,'inserted');
 assert.equal(f.events[0][1].generationOperationId,id);assert.deepEqual(f.events.slice(1),['start','provider','checkpoint','settle','commit','close']);
});
test('missing operation id fails before auth, reserve or provider',async()=>{const f=fixture();delete f.request.operationId;assert.equal((await handleExplanation(f.request,f.deps)).code,'generation_journal_required');assert.deepEqual(f.events,[])});
test('unavailable durable capability holds before reserve',async()=>{const f=fixture({readGeneration:async()=>{throw Error('missing RPC')}});assert.equal((await handleExplanation(f.request,f.deps)).code,'generation_journal_unavailable');assert.deepEqual(f.events,[])});
test('pending generation recovers exact saved result without provider replay',async()=>{const f=fixture({readGeneration:async()=>({state:'pending'}),recoverGeneration:async()=>({state:'completed',value})});assert.deepEqual((await handleExplanation(f.request,f.deps)).value,value);assert.deepEqual(f.events,[])});
test('unknown, missing recovery and lost recovery ACK remain held',async()=>{for(const recovery of [async()=>null,async()=>({state:'pending'}),async()=>{throw Error('ACK lost')}]){const f=fixture({readGeneration:async()=>({state:'pending'}),recoverGeneration:recovery});assert.equal((await handleExplanation(f.request,f.deps)).code,'generation_pending');assert.deepEqual(f.events,[])}});
test('closed operation never gets resent even when no shared result exists',async()=>{const f=fixture({readGeneration:async()=>({state:'not_written'})});assert.equal((await handleExplanation(f.request,f.deps)).code,'generation_not_written');assert.deepEqual(f.events,[])});
test('lost checkpoint ACK never settles, commits or retries',async()=>{const f=fixture({checkpointGeneration:async()=>{throw Error('ACK lost')}});assert.equal((await handleExplanation(f.request,f.deps)).code,'result_checkpoint_unconfirmed_held');assert.equal(f.events.filter(x=>x==='provider').length,1);assert.ok(!f.events.includes('settle'))});
test('journalled grant cannot enable multiple model calls',async()=>{const f=fixture({reserve:async()=>({ok:true,leaseId:id,fence:id,maxCalls:2,model:'gpt-6.1-terra',mode:'default'})});assert.equal((await handleExplanation(f.request,f.deps)).code,'invalid_grant_held');assert.deepEqual(f.events,[])});
test('provider timeout preserves unknown and no checkpoint/retry',async()=>{const f=fixture({callProvider:async()=>{throw Error('timeout')}});assert.equal((await handleExplanation(f.request,f.deps)).code,'provider_unknown_held');assert.ok(f.events.includes('unknown'));assert.ok(!f.events.includes('checkpoint'))});
test('adapter binds actor and question, does not expose arbitrary database fields',async()=>{
 const calls=[],db={rpc:async(name,args)=>{calls.push([name,args]);return {data:{status:'completed',value:{question_id:'Q1',explanation:'saved',option_analysis:{A:'a'},actor_id:'private',rawText:'private'}}}}};
 const journal=createGenerationJournal({db});const out=await journal.readGeneration({operationId:id,actorId:'actor',questionId:'Q1'});
 assert.equal(out.value.explanation,'saved');assert.equal(out.value.actor_id,undefined);assert.equal(out.value.rawText,undefined);
 assert.deepEqual(calls[0][1],{p_id:id,p_actor:'actor',p_question:'Q1'});
 assert.deepEqual(outcome({status:'completed',value:{question_id:'other',explanation:'wrong'}},'Q1'),{state:'pending'});
});
test('adapter refuses second sequence and missing authenticated actor',async()=>{let n=0;const j=createGenerationJournal({db:{rpc:async()=>{n++;return {data:'saved'}}}});assert.equal(await j.checkpointGeneration({leaseId:id,actorId:'actor'},2,{}),false);assert.equal(await j.checkpointGeneration({leaseId:id},1,{}),false);assert.equal(n,0)});
test('feature rollback cannot silently convert a known operation to a fresh legacy dispatch',async()=>{const f=fixture({generationJournal:false});assert.equal((await handleExplanation(f.request,f.deps)).code,'generation_journal_unavailable');assert.deepEqual(f.events,[])});
test('unknown usage preserves the returned response before marking unknown',async()=>{const f=fixture({callProvider:async()=>({rawText:'exact raw response',usage:null})});assert.equal((await handleExplanation(f.request,f.deps)).code,'usage_unknown_held');assert.ok(f.events.indexOf('checkpoint')<f.events.indexOf('unknown'));assert.ok(!f.events.includes('settle'))});
test('optional image-planning failure cannot prevent text checkpoint',async()=>{let saved;const j=createGenerationJournal({db:{rpc:async(name,args)=>{saved=args;return {data:'saved'}}},needsFor:async()=>{throw Error('image unavailable')}});assert.equal(await j.checkpointGeneration({leaseId:id,actorId:'actor',requiredOptions:['A','B']},1,{rawText:'exact'}),true);assert.equal(saved.p_response.rawText,'exact');assert.equal(saved.p_response.needs,null)});
