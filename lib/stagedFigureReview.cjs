'use strict';
// No search, download, lease reset or provider retry dependency is available here.
async function reviewStagedFigure({db,candidateId,targets,reviewer}){
 const one=async(table,columns,key,value)=>{const r=await db.from(table).select(columns).eq(key,value).maybeSingle();if(r.error)throw Error('staged read unavailable');return r.data};
 const status=await db.rpc('figure_model_candidate_status',{p_candidate:candidateId});
 if(status.error) return {status:'status_unavailable'};
 if(status.data) return {status:'existing_operation',review:status.data};
 const row=await one('explanation_figure_candidates','id,question_id,explanation_sha256,image_sha256,image_bytes,image_mime,source_url,license_url,license,attribution,section_title,section_heading,section_sha256,section_anchor,status','id',candidateId);
 if(!row||row.status!=='pending'||!targets.some(t=>t.questionId===row.question_id&&t.textHash===row.explanation_sha256))return {status:'outside_batch'};
 const result=await db.from('figure_queue_jobs').select('request_id,question_id,explanation_sha256,figure_needs,needs_state,state,attempts').eq('question_id',row.question_id).eq('explanation_sha256',row.explanation_sha256).limit(2);
 if(result.error||result.data?.length!==1)return {status:'ambiguous_request'};
 const job=result.data[0];
 if(job.state!=='leased'||job.attempts!==1||job.needs_state!=='approved')return {status:'invalid_request'};
 const items=(job.figure_needs?.items||[]).filter(x=>x.sectionHash===row.section_sha256&&x.sectionTitle===row.section_heading&&x.sectionAnchor===row.section_anchor&&x.caption===row.section_title);
 if(items.length!==1)return {status:'stale_or_invalid'};
 const saved=await one('question_explanation_overrides','explanation','question_id',row.question_id);
 if(!saved?.explanation)return {status:'stale_or_invalid'};
 if(typeof row.image_bytes==='string'&&/^\\x(?:[a-f0-9]{2})+$/i.test(row.image_bytes))row.image_bytes=Buffer.from(row.image_bytes.slice(2),'hex');
 if(!Buffer.isBuffer(row.image_bytes))return {status:'stale_or_invalid'};
 // Original controller verifies exact text/section/image/source and trusted
 // question. Original SQL owns atomic budget/uniqueness; this read is not a lock.
 return reviewer({job,row,item:items[0],text:saved.explanation,candidateId,stagedContinuation:true});
}
module.exports={reviewStagedFigure};
