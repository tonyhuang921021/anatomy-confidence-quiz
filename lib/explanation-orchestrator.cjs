'use strict';
// Candidate service contract only. Inject trusted, transactional adapters; no network or DB here.
// Exceptions from reservation/start/settle/commit are never interpreted as permission.
function formatAcceptedAnswer(question) {
  if (question?.answerCreditType === 'all_credit') return '本題一律給分；不宣稱單一正確選項';
  if (question?.answerCreditType === 'multiple_accepted' || question?.answerCreditType === 'multiple_answers') {
    const answers = question.acceptedAnswers;
    if (!Array.isArray(answers) || !answers.length || new Set(answers).size !== answers.length ||
        answers.some(key => typeof key !== 'string' || !/^[A-E]$/.test(key) ||
          typeof question.options?.[key] !== 'string' || !question.options[key].trim())) {
      throw new Error('invalid accepted answers');
    }
    return answers.join(' / ');
  }
  return question?.answer || '';
}
async function handleExplanation(request, deps) {
  const action = request?.action ?? 'generate';
  if (action === 'sync_override' || action === 'sync_overrides') return {status:409, code:'shared_sync_paused', recoverable:true};
  if (action !== 'generate' && action !== 'replace') return {status:400, code:'unsupported_action'};
  const replacing = action === 'replace';
  const journalled = !replacing && deps.generationJournal === true;
  if(!replacing && request?.operationId && !journalled)return {status:503,code:'generation_journal_unavailable'};
  if (journalled && (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(request?.operationId || '') ||
    typeof deps.readGeneration !== 'function' || typeof deps.recoverGeneration !== 'function' || typeof deps.checkpointGeneration !== 'function')) return {status:503,code:'generation_journal_required'};
  if (replacing && (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(request?.operationId || '') ||
    typeof request?.baseVersion !== 'string' || !request.baseVersion || request.baseVersion.length > 200)) return {status:400,code:'invalid_replacement'};
  const id = request?.question?.id;
  if (typeof id !== 'string' || !id || id !== id.trim() || id.length > 200) return {status:400,code:'invalid_id'};
  if (!replacing && await deps.isReviewed(id)) return {status:409,code:'reviewed_explanation_protected'};
  const actor = await deps.auth(request?.accessToken);
  if (!actor?.id) return {status:401,code:'authentication_required'};
  const question = await deps.resolveTrusted(id);
  if (!question || question.id !== id) return {status:404,code:'untrusted_question'};
  // previousQuestion/previousOverride, user input text, options, answer and attempt
  // are untrusted and never forwarded. Context must be explicit in trusted record.
  if (replacing && (!deps.reserveReplacement || !deps.commitReplacement || !deps.readReplacement)) return {status:503,code:'replacement_unavailable'};
  if (journalled) {
    const identity={operationId:request.operationId,actorId:actor.id,questionId:id};
    let prior;try{prior=await deps.readGeneration(identity)}catch{return {status:503,code:'generation_journal_unavailable'};}
    if(prior?.state==='completed')return {status:200,code:'existing',value:prior.value};
    if(prior?.state==='not_written')return {status:409,code:'generation_not_written'};
    if(prior){
      let recovered;try{recovered=await deps.recoverGeneration(identity)}catch{}
      if(recovered?.state==='completed')return {status:200,code:'existing',value:recovered.value};
      if(recovered?.state==='not_written')return {status:409,code:'generation_not_written'};
      return {status:409,code:'generation_pending'};
    }
  }
  if (replacing) {
    // Recovery is bound to the original operation, not any old saved text.
    const prior = await deps.readReplacement({operationId:request.operationId,actorId:actor.id,questionId:id});
    if (prior?.state === 'completed') return {status:200,code:'replaced',value:prior.value};
    if (prior?.state==='not_written') return {status:409,code:'replacement_not_written'};
    if (prior && deps.recoverResult) {
      const recovered=await deps.recoverResult({operationId:request.operationId,actorId:actor.id,questionId:id});
      if(recovered?.state==='completed')return {status:200,code:'replaced',value:recovered.value};
      if(recovered?.state==='not_written')return {status:409,code:'replacement_not_written'};
    }
    if (prior) return {status:409,code:'replacement_pending'};
  } else {
    const existing = await deps.readShared(id);
    if (existing) return {status:200,code:'existing',value:existing};
  }
  if (question.requiresContext && !question.trustedContext) return {status:422,code:'trusted_context_missing'};
  if (question.hasUncertainSource) return {status:422,code:'trusted_question_incomplete'};
  if (question.hasUnresolvedImage) return {status:422,code:'source_image_not_supported'};
  const options = Object.entries(question.options || {}).filter(([k,v]) => /^[A-E]$/.test(k) && typeof v === 'string' && v.trim());
  if (!question.stem || !options.length || !question.answer) return {status:422,code:'trusted_question_incomplete'};
  try { formatAcceptedAnswer(question); } catch { return {status:422,code:'trusted_question_incomplete'}; }
  if (deps.prepare && !await deps.prepare(question)) return {status:422,code:'trusted_question_incomplete'};
  const grant = replacing
    ? await deps.reserveReplacement({actorId:actor.id,questionId:id,operationId:request.operationId,baseVersion:request.baseVersion})
    : await deps.reserve({actorId:actor.id, questionId:id,...(journalled?{generationOperationId:request.operationId}:{})});
  if (!grant?.ok || !grant.leaseId || !grant.fence) return {status:503,code:grant?.code || 'reservation_unavailable'};
  if (((replacing||journalled) && grant.maxCalls !== 1) || !Number.isInteger(grant.maxCalls) || grant.maxCalls < 1 || grant.maxCalls > 5 || !['gpt-6.1-sol','gpt-6.1-terra'].includes(grant.model) || !['low','default'].includes(grant.mode) || (grant.model === 'gpt-6.1-terra' && grant.mode !== 'default')) return {status:503,code:'invalid_grant_held'};
  const afterLock = replacing ? null : await deps.readShared(id);
  if (afterLock) {
    // Explicit, actor-bound zero-call cancellation only when DB confirms the
    // same shared winner exists under lock. Unknown/started requests stay held.
    if (!await deps.cancelIfShared(grant)) return {status:503,code:'cancel_unconfirmed_held'};
    const current = await deps.readShared(id);
    return current ? {status:200,code:'existing',value:current} : {status:503,code:'winner_changed'};
  }
  const q = {id:question.id,stem:question.stem,options:Object.fromEntries(options),answer:question.answer,
    acceptedAnswers:question.acceptedAnswers,answerCreditType:question.answerCreditType,
    trustedContext:question.trustedContext || null,subject:question.subject,chapter:question.chapter,section:question.section,testedConcept:question.testedConcept};
  let result = null;
  // Bound is server-derived in grant, never provided by client. Each call is
  // started before network, settled before any retry; unknown means held.
  for (let seq=1;seq<=grant.maxCalls;seq++) {
    if (!await deps.start(grant,seq)) return {status:503,code:'start_failed_held'};
    let response;
    try { response = await deps.callProvider({question:q, previousResult:result, mode:grant.mode, model:grant.model}); }
    catch {
      try { if (!await deps.markUnknown(grant,seq)) return {status:503,code:'global_stop_unconfirmed_held'}; }
      catch { return {status:503,code:'global_stop_unconfirmed_held'}; }
      return {status:503,code:'provider_unknown_held'};
    }
    // Preserve returned bytes even when usage/model validation later fails.
    // Recovery may inspect this evidence, but unknown accounting still cannot publish.
    if(journalled){
      let durable=false;try{durable=await deps.checkpointGeneration({...grant,actorId:actor.id,requiredOptions:options.map(([key])=>key)},seq,response)}catch{}
      if(!durable)return {status:503,code:'result_checkpoint_unconfirmed_held'};
    }
    if(replacing && deps.checkpointBeforeUsage===true){
      let durable=false;try{durable=await deps.checkpointResult({...grant,actorId:actor.id,requiredOptions:options.map(([key])=>key)},seq,response)}catch{}
      if(!durable)return {status:503,code:'result_checkpoint_unconfirmed_held'};
    }
    if (!response?.usage || !Number.isSafeInteger(response.usage.inputTokens) || response.usage.inputTokens < 0 ||
        !Number.isSafeInteger(response.usage.outputTokens) || response.usage.outputTokens < 0) {
      try { if (!await deps.markUnknown(grant,seq)) return {status:503,code:'global_stop_unconfirmed_held'}; }
      catch { return {status:503,code:'global_stop_unconfirmed_held'}; }
      return {status:503,code:'usage_unknown_held'};
    }
    // Save the exact returned result before settlement/commit. A lost DB ACK
    // is a hold; next recovery reads the same immutable result, never provider.
    if(replacing && deps.checkpointResult && deps.checkpointBeforeUsage!==true){
      let durable=false;try{durable=await deps.checkpointResult(grant,seq,response)}catch{}
      if(!durable)return {status:503,code:'result_checkpoint_unconfirmed_held'};
    }
    let settled = false;
    try { settled = await deps.settle(grant,seq,response.usage); } catch { /* settlement outcome is unknown */ }
    if (!settled) {
      try { if (!await deps.markUnknown(grant,seq)) return {status:503,code:'global_stop_unconfirmed_held'}; }
      catch { return {status:503,code:'global_stop_unconfirmed_held'}; }
      return {status:503,code:'settlement_failed_held'};
    }
    result = response.value;
    const complete = !!result?.explanation && options.every(([k])=>typeof result.optionAnalysis?.[k] === 'string' && result.optionAnalysis[k].trim());
    if (complete) break;
  }
  if (!result?.explanation || !options.every(([k])=>typeof result.optionAnalysis?.[k] === 'string' && result.optionAnalysis[k].trim())) {
    await deps.close(grant); return {status:502,code:'incomplete_explanation'};
  }
  // Must atomically validate fencing token and insert-if-absent; returns the
  // existing winner if another trusted process already inserted the row.
  const saved = replacing ? await deps.commitReplacement(grant,id,result) : await deps.insertIfAbsentFenced(grant,id,result);
  if (replacing && saved?.conflict) { await deps.close(grant); return {status:409,code:'replacement_version_changed'}; }
  if (!saved?.winner) return {status:503,code:'commit_unconfirmed_held'};
  await deps.close(grant);
  return {status:200,code:replacing?'replaced':saved.inserted?'inserted':'existing',value:saved.winner};
}
module.exports = {handleExplanation,formatAcceptedAnswer};
