'use strict';
const crypto=require('node:crypto');
const digest=x=>crypto.createHash('sha256').update(x).digest('hex');
const limit=3*1024*1024;
function validate(candidate){
 if(!candidate || !/^[A-Za-z0-9_-]{1,200}$/.test(candidate.questionId)||typeof candidate.explanation!=='string'||!candidate.explanation.trim())throw Error('invalid question or explanation');
 if(!Buffer.isBuffer(candidate.bytes)||!candidate.bytes.length||candidate.bytes.length>limit)throw Error('invalid image bytes');
 const png=candidate.bytes.length>=8&&candidate.bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
 const jpg=candidate.bytes.length>=3&&candidate.bytes[0]===255&&candidate.bytes[1]===216&&candidate.bytes[2]===255;
 const webp=candidate.bytes.length>=12&&candidate.bytes.toString('ascii',0,4)==='RIFF'&&candidate.bytes.toString('ascii',8,12)==='WEBP';
 if(!((png&&candidate.mime==='image/png')||(jpg&&candidate.mime==='image/jpeg')||(webp&&candidate.mime==='image/webp')))throw Error('invalid image type');
 let source,license;try{source=new URL(candidate.sourceUrl);license=new URL(candidate.licenseUrl)}catch{throw Error('invalid source')}
 const paths={'CC BY 4.0':'/licenses/by/4.0/','CC BY-SA 4.0':'/licenses/by-sa/4.0/','CC BY 3.0':'/licenses/by/3.0/','CC BY-SA 3.0':'/licenses/by-sa/3.0/','CC0':'/publicdomain/zero/1.0/'};
 if(source.protocol!=='https:'||source.hostname!=='commons.wikimedia.org'||source.username||source.password||license.protocol!=='https:'||license.hostname!=='creativecommons.org'||license.username||license.password||license.pathname.replace(/\/?$/,'/')!==paths[candidate.license])throw Error('invalid source or licence');
 if(typeof candidate.attribution!=='string'||!candidate.attribution.trim()||candidate.attribution.length>500||typeof candidate.sectionTitle!=='string'||!candidate.sectionTitle.trim()||candidate.sectionTitle.length>80)throw Error('missing attribution or section');
 return {question_id:candidate.questionId,explanation_sha256:digest(candidate.explanation),image_sha256:digest(candidate.bytes),image_bytes:candidate.bytes,image_mime:candidate.mime,source_url:source.href,license_url:license.href,license:candidate.license,attribution:candidate.attribution,section_title:candidate.sectionTitle,status:'pending'};
}
async function stage({candidate,repository,readCommitted}){const row=validate(candidate);const committed=await readCommitted(row.question_id);if(typeof committed!=='string'||digest(committed)!==row.explanation_sha256)throw Error('committed explanation mismatch');return repository.insertPending(row)}
async function review({actor,candidateId,decision,visualConfirmed,repository,readCommitted}){
 if(!actor?.verifiedAdminId)throw Error('admin required');if(!['approved','rejected'].includes(decision))throw Error('invalid decision');if(decision==='approved'&&visualConfirmed!==true)throw Error('visual review required');
 const item=await repository.getPending(candidateId);if(!item||item.status!=='pending')throw Error('not pending');
 const text=await readCommitted(item.question_id);if(typeof text!=='string'||digest(text)!==item.explanation_sha256||digest(item.image_bytes)!==item.image_sha256)throw Error('stale content');
 const checked=validate({questionId:item.question_id,explanation:text,bytes:item.image_bytes,mime:item.image_mime,sourceUrl:item.source_url,licenseUrl:item.license_url,license:item.license,attribution:item.attribution,sectionTitle:item.section_title});if(checked.explanation_sha256!==item.explanation_sha256||checked.image_sha256!==item.image_sha256)throw Error('stale content');
 // Adapter must atomically compare the pending row AND current committed explanation in one database transaction.
 const result=await repository.compareAndSetPendingWithCommittedExplanation(candidateId,{status:decision,reviewer_id:actor.verifiedAdminId,reviewed_at:new Date().toISOString(),expected_explanation:text,expected_explanation_sha256:item.explanation_sha256,expected_image_sha256:item.image_sha256,expected_image_bytes:item.image_bytes});if(!result)throw Error('review conflict');return result;
}
module.exports={validate,stage,review};
