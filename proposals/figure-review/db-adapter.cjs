'use strict';
const crypto=require('node:crypto');
function decodeBytea(value){if(typeof value!=='string'||value.length>6291458||!/^\\x(?:[0-9a-f]{2})+$/i.test(value))throw Error('invalid image bytes');return Buffer.from(value.slice(2),'hex')}
function createRepository(db){
 return {
  async readCommitted(id){const {data,error}=await db.from('question_explanation_overrides').select('explanation').eq('question_id',id).maybeSingle();if(error)throw Error('explanation read failed');return data?.explanation??null},
  async insertPending(row){const {data,error}=await db.from('explanation_figure_candidates').insert({...row,id:crypto.randomUUID(),image_bytes:'\\x'+row.image_bytes.toString('hex')}).select('id').single();if(error)throw Error('candidate save failed');return data},
  async getPending(id){const {data,error}=await db.from('explanation_figure_candidates').select('*').eq('id',id).eq('status','pending').maybeSingle();if(error)throw Error('candidate read failed');return data?{...data,image_bytes:decodeBytea(data.image_bytes)}:null},
  async compareAndSetPendingWithCommittedExplanation(id,x){const {data,error}=await db.rpc('review_explanation_figure',{p_id:id,p_decision:x.status,p_reviewer:x.reviewer_id,p_visual_confirmed:x.status==='approved',p_expected_explanation:x.expected_explanation,p_expected_explanation_sha:x.expected_explanation_sha256,p_expected_image_sha:x.expected_image_sha256,p_expected_image:'\\x'+x.expected_image_bytes.toString('hex')});if(error)throw Error('review failed');return data===x.status?{status:data}:null}
 };
}
module.exports={createRepository,decodeBytea};
