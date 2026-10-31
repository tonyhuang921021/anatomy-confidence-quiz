'use strict';
const crypto=require('node:crypto');
function decodeBytea(value){if(typeof value!=='string'||value.length>6291458||!/^\\x(?:[0-9a-f]{2})+$/i.test(value))throw Error('invalid image bytes');return Buffer.from(value.slice(2),'hex')}
function createRepository(db,lease=null){
 return {
  forLease(requestId,leaseId){return createRepository(db,{requestId,leaseId})},
  async readCommitted(id){const {data,error}=await db.from('question_explanation_overrides').select('explanation').eq('question_id',id).maybeSingle();if(error)throw Error('explanation read failed');return data?.explanation??null},
  async insertPending(row){if(lease){const {data,error}=await db.rpc('figure_queue_stage',{p_request:lease.requestId,p_lease:lease.leaseId,p_id:crypto.randomUUID(),p_question:row.question_id,p_text_sha:row.explanation_sha256,p_image_sha:row.image_sha256,p_mime:row.image_mime,p_bytes:'\\x'+row.image_bytes.toString('hex'),p_source:row.source_url,p_license_url:row.license_url,p_license:row.license,p_attribution:row.attribution,p_section:row.section_title});if(error||!data)throw Error('fenced candidate save failed');return {id:data}}const {data,error}=await db.from('explanation_figure_candidates').insert({...row,id:crypto.randomUUID(),image_bytes:'\\x'+row.image_bytes.toString('hex')}).select('id').single();if(!error)return data;if(error.code!=='23505')throw Error('candidate save failed');const existing=await db.from('explanation_figure_candidates').select('id').eq('question_id',row.question_id).eq('explanation_sha256',row.explanation_sha256).eq('image_sha256',row.image_sha256).maybeSingle();if(existing.error||!existing.data)throw Error('candidate conflict unconfirmed');return {...existing.data,duplicate:true}},
  async getPending(id){const {data,error}=await db.from('explanation_figure_candidates').select('*').eq('id',id).eq('status','pending').maybeSingle();if(error)throw Error('candidate read failed');return data?{...data,image_bytes:decodeBytea(data.image_bytes)}:null},
  async compareAndSetPendingWithCommittedExplanation(id,x){const {data,error}=await db.rpc('review_explanation_figure',{p_id:id,p_decision:x.status,p_reviewer:x.reviewer_id,p_visual_confirmed:x.status==='approved',p_expected_explanation:x.expected_explanation,p_expected_explanation_sha:x.expected_explanation_sha256,p_expected_image_sha:x.expected_image_sha256,p_expected_image:'\\x'+x.expected_image_bytes.toString('hex')});if(error)throw Error('review failed');return data===x.status?{status:data}:null}
 };
}
module.exports={createRepository,decodeBytea};
