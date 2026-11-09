import {discoverPmcFigures} from '@/lib/pmcFigureSource.cjs';
import {runNewImageContinuation} from '@/lib/newExplanationImageContinuation.cjs';
import {enqueueSavedPlan} from '@/lib/savedExplanationImagePlan.cjs';
import {continueFigure,createContinuationRepository} from '@/lib/figureContinuation.cjs';
import {resolveTrustedExplanationQuestion} from "@/lib/trustedQuestionLoader";
import {createFinalFigureReviewer} from "@/lib/finalFigureRuntime.cjs";
import {reviewStagedFigure} from "@/lib/stagedFigureReview.cjs";
import {figureCaptureAllowed,guardFigureTraffic} from "@/lib/figureCaptureGate.cjs";
import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';
import {boundedImageTargets,boundedImageTarget,imageWindowOpen,buildNeeds,approveConcepts,automaticQuery,createStore,runOne,CATALOG} from '@/lib/newExplanationFigures.cjs';
import {commonsSearch,readBoundedImage} from '@/lib/commonsFigureSource.cjs';
const reply=(x:any,status=200)=>NextResponse.json(x,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(request:NextRequest){
 if(process.env.NEW_EXPLANATION_FIGURES_ADMIN!=='1')return reply({ok:false,code:'disabled'},503);
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)return reply({ok:false},503);
 try{
  const raw=await request.text();if(Buffer.byteLength(raw)>8192)return reply({ok:false},413);
  const body=JSON.parse(raw),db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  if(typeof body.accessToken!=='string')return reply({ok:false},401);
  const auth=await db.auth.getUser(body.accessToken),u=auth.data?.user;
  const allowed=(process.env.NEXT_PUBLIC_ADMIN_EMAILS||'').split(',').map(x=>x.trim().toLowerCase());
  if(auth.error||!u?.id||!u.email||!allowed.includes(u.email.toLowerCase()))return reply({ok:false},403);
  const pilotTargets=boundedImageTargets(process.env);
  const sitewide=process.env.EXPLANATION_SITEWIDE_ENABLED==='1';
  if(process.env.EXPLANATION_SITEWIDE_ENABLED!=='1'&&process.env.NEW_EXPLANATION_IMAGES_SINGLE_BATCH&&!pilotTargets.length)return reply({ok:false,code:'invalid_pilot'},503);
  if(pilotTargets.length>1&&(!process.env.NEW_EXPLANATION_IMAGES_OPERATOR_ID||u.id!==process.env.NEW_EXPLANATION_IMAGES_OPERATOR_ID))return reply({ok:false,code:'pilot_operator'},403);
  if(['continuation_open','continuation_run','continuation_status'].includes(body.action)){
   if(!sitewide&&(!pilotTargets.length||u.id!==process.env.NEW_EXPLANATION_IMAGES_OPERATOR_ID))return reply({ok:false,code:'pilot_operator'},403);
   if(typeof body.id!=='string'||! /^[0-9a-f-]{36}$/i.test(body.id))return reply({ok:false,code:'invalid_operation'},400);
   if(body.action==='continuation_status'){const r=await db.rpc('figure_continuation_status',{p_id:body.id,p_actor:u.id});return r.error?reply({ok:false,code:'continuation_unavailable'},503):reply({ok:true,value:r.data?{operation:r.data.operation,steps:(r.data.steps||[]).map((x:any)=>({kind:x.kind,key:x.key,state:x.state}))}:null});}
   if(process.env.NEW_EXPLANATION_FIGURES_WORKER!=='1'||!imageWindowOpen(process.env)||!await figureCaptureAllowed(db))return reply({ok:false,code:'worker_disabled'},503);
   if(body.action==='continuation_open'){
    const parent=await db.from('figure_queue_jobs').select('question_id,explanation_sha256,figure_needs,state').eq('request_id',body.parentId).maybeSingle();
    const parentRow=parent.data;
    if(parent.error||!parentRow||(!sitewide&&!pilotTargets.some(t=>t.questionId===parentRow.question_id&&t.textHash===parentRow.explanation_sha256)))return reply({ok:false,code:'outside_batch'},403);
    if(sitewide){const allowed=await db.rpc('explanation_sitewide_request_allowed',{p_id:body.parentId,p_actor:u.id});if(allowed.error||allowed.data!==true)return reply({ok:false,code:'outside_batch'},403);}
    const item=parentRow.figure_needs?.items?.find((x:any)=>x.sectionAnchor===body.sectionAnchor);
    if(!item||typeof body.query!=='string'||! /^[A-Za-z][A-Za-z0-9 -]{2,99}$/.test(body.query))return reply({ok:false,code:'invalid_query'},400);
    if(sitewide&&!automaticQuery({...item,proposedQuery:body.query}))return reply({ok:false,code:'invalid_query'},400);
    const r=await db.rpc('figure_continuation_open',{p_id:body.id,p_actor:u.id,p_parent:body.parentId,p_text_sha:parentRow.explanation_sha256,p_item:{...item,query:body.query,proposedQuery:body.query,catalogRevision:'reviewed-query-v1'}});
    return r.error?reply({ok:false,code:'continuation_unavailable'},503):reply({ok:true,...r.data});
   }
   const repository=createContinuationRepository(db,u.id);
   const snapshot=await repository.read(body.id);
   if(!snapshot?.operation||(!sitewide&&!pilotTargets.some(t=>t.questionId===snapshot.operation.question_id&&t.textHash===snapshot.operation.text_sha)))return reply({ok:false,code:'outside_batch'},403);
   if(sitewide){const allowed=await db.rpc('explanation_sitewide_request_allowed',{p_id:snapshot.operation.parent_request,p_actor:u.id});if(allowed.error||allowed.data!==true)return reply({ok:false,code:'outside_batch'},403);}
   return reply({ok:true,...await continueFigure({id:body.id,repository,discover:discoverPmcFigures,trafficAllowed:async()=>imageWindowOpen(process.env)&&await figureCaptureAllowed(db),readText:async(id:string)=>{const r=await db.from('question_explanation_overrides').select('explanation').eq('question_id',id).maybeSingle();if(r.error)throw Error('read unavailable');return r.data?.explanation},search:guardFigureTraffic(db,commonsSearch,()=>imageWindowOpen(process.env)),loadImage:guardFigureTraffic(db,readBoundedImage,()=>imageWindowOpen(process.env)),review:createFinalFigureReviewer({db,readQuestion:(id:string)=>{const r=resolveTrustedExplanationQuestion(id);return r.ok?r.question:null}})})});
  }
  if(body.action==='list'){
   const {data,error}=await db.from('figure_queue_jobs').select('request_id,question_id,explanation_sha256,figure_needs,needs_state,image_status,state,attempts').in('state',['pending','leased','done','failed']).order('created_at',{ascending:false}).limit(20);
   if(error)throw error;
   const unplanned=await db.from('question_explanation_overrides').select('question_id').in('figure_status',['awaiting_image_plan','awaiting_image']).limit(20);
   if(unplanned.error)throw unplanned.error;
   // A bounded saved-text pilot may add a fresh plan without regenerating text
   // or reopening any previous attempted job. No general catalog expansion.
   const available=[...(unplanned.data||[])].filter(x=>!pilotTargets.length||pilotTargets.some(t=>t.questionId===x.question_id));
   for(const target of pilotTargets){
    const old=await db.from('figure_queue_jobs').select('request_id').eq('question_id',target.questionId).limit(1);
    const saved=await db.from('question_explanation_overrides').select('question_id,explanation,figure_status').eq('question_id',target.questionId).maybeSingle();
    if(old.error||saved.error)throw Error('target lookup failed');
    const eligible=await db.rpc('ai_guard_image_eligible',{p_question:target.questionId,p_text_sha:target.textHash});
    if(!eligible.error&&eligible.data===true&&!old.data?.length&&saved.data?.explanation&&buildNeeds(saved.data.explanation,[])?.explanationHash===target.textHash&&!available.some(x=>x.question_id===target.questionId))available.push({question_id:target.questionId});
   }
   let pendingQuery=db.from('explanation_figure_candidates').select('id,question_id,explanation_sha256,section_title,source_url').eq('status','pending');
   if(pilotTargets.length)pendingQuery=pendingQuery.in('question_id',pilotTargets.map(t=>t.questionId));
   const pending=sitewide||pilotTargets.length?await pendingQuery.order('created_at',{ascending:false}).limit(20):{data:[],error:null};
   if(pending.error)throw pending.error;
   const staged=[];
   for(const candidate of pending.data||[]){
    if(!sitewide){if(pilotTargets.some(t=>t.questionId===candidate.question_id&&t.textHash===candidate.explanation_sha256))staged.push(candidate);continue;}
    const matches=(data||[]).filter(j=>j.question_id===candidate.question_id&&j.explanation_sha256===candidate.explanation_sha256&&j.state==='leased'&&j.attempts===1);
    if(matches.length!==1)continue;
    const admitted=await db.rpc('explanation_sitewide_request_allowed',{p_id:matches[0].request_id,p_actor:u.id});
    if(!admitted.error&&admitted.data===true)staged.push(candidate);
   }
   return reply({ok:true,operatorId:u.id,jobs:data,catalog:CATALOG,unplanned:available,staged});
  }
  if(['run_one','retry_image','plan_saved'].includes(body.action) && (!imageWindowOpen(process.env)||process.env.NEW_EXPLANATION_FIGURES_CAPTURE!=='1'||!await figureCaptureAllowed(db)))return reply({ok:false,code:'worker_disabled'},503);
  if(body.action==='plan_saved'){
   const target=boundedImageTarget(process.env,body.questionId);
   if(pilotTargets.length&&!target)return reply({ok:false,code:'outside_single_batch'},403);
   if(typeof body.questionId!=='string'||! /^[A-Za-z0-9_-]{1,200}$/.test(body.questionId))return reply({ok:false},400);
   const saved=await db.from('question_explanation_overrides').select('explanation,figure_status,replacement_revision').eq('question_id',body.questionId).maybeSingle();
   if(saved.error||!saved.data?.explanation)return reply({ok:false},404);
   const needs=buildNeeds(saved.data.explanation,body.hints);
   if(target&&needs?.explanationHash!==target.textHash)return reply({ok:false,code:'stale_single_batch'},409);
   if(!needs?.items?.length)return reply({ok:false,code:'heading_not_found'},400);
   const eligible=await db.rpc('ai_guard_image_eligible',{p_question:body.questionId,p_text_sha:needs.explanationHash});
   if(eligible.error||eligible.data!==true)return reply({ok:false,code:'saved_text_not_eligible'},409);
   if(process.env.EXPLANATION_SITEWIDE_ENABLED==='1'){
    const result=await enqueueSavedPlan({db,requestId:body.requestId,actorId:u.id,questionId:body.questionId,replacementRevision:saved.data.replacement_revision,needs});
    return reply({ok:result.ok,code:result.code},result.httpStatus);
   }
   const result=await db.rpc('figure_image_plan_saved',{p_question:body.questionId,p_needs:needs});
   return reply({ok:!result.error&&['awaiting','existing'].includes(result.data)});
  }
  if(['run_one','retry_image','plan_saved'].includes(body.action)&&!imageWindowOpen(process.env))return reply({ok:false,code:'worker_disabled'},503);
  if(body.action==='run_one'){
   if(process.env.NEW_EXPLANATION_FIGURES_WORKER!=='1')return reply({ok:false,code:'worker_disabled'},503);
   if(process.env.EXPLANATION_SITEWIDE_ENABLED==='1')return reply({ok:true,...await runNewImageContinuation({discover:discoverPmcFigures,env:process.env,db,search:commonsSearch,loadImage:readBoundedImage,finalReview:createFinalFigureReviewer({db,readQuestion:(id:string)=>{const result=resolveTrustedExplanationQuestion(id);return result.ok?result.question:null}})})});
   return reply({ok:true,...await runOne({discover:discoverPmcFigures,trafficAllowed:()=>imageWindowOpen(process.env),finalReview:createFinalFigureReviewer({db,readQuestion:(id:string)=>{const result=resolveTrustedExplanationQuestion(id);return result.ok?result.question:null}}),store:createStore(db),search:guardFigureTraffic(db,commonsSearch,()=>imageWindowOpen(process.env)),loadImage:guardFigureTraffic(db,readBoundedImage,()=>imageWindowOpen(process.env)),enabled:true})});
  }
  if(typeof body.id!=='string'||! /^[0-9a-f-]{36}$/i.test(body.id))return reply({ok:false},400);
  if(body.action==='review_staged'){
   if(!sitewide&&(!pilotTargets.length||u.id!==process.env.NEW_EXPLANATION_IMAGES_OPERATOR_ID))return reply({ok:false,code:'pilot_operator'},403);
   if(process.env.NEW_EXPLANATION_FIGURES_WORKER!=='1'||process.env.FIGURE_LUNA_REVIEW_ENABLED!=='1'||!imageWindowOpen(process.env)||!await figureCaptureAllowed(db))return reply({ok:false,code:'worker_disabled'},503);
   return reply({ok:true,...await reviewStagedFigure({db,candidateId:body.id,targets:pilotTargets,sitewide,actorId:u.id,reviewer:createFinalFigureReviewer({db,readQuestion:(id:string)=>{const r=resolveTrustedExplanationQuestion(id);return r.ok?r.question:null}})})});
  }
  if(body.action==='model_status'){const result=await db.rpc('figure_model_candidate_status',{p_candidate:body.id});return result.error?reply({ok:false,code:'unavailable'},503):reply({ok:true,review:result.data});}
  if(body.action==='retry_image')return reply({ok:false,code:'prior_attempt_requires_review'},409);
  const found=await db.from('figure_queue_jobs').select('figure_needs,question_id').eq('request_id',body.id).maybeSingle();
  if(found.error||!found.data)return reply({ok:false},404);
  if(body.action==='inspect'){
   const saved=await db.from('question_explanation_overrides').select('explanation').eq('question_id',found.data.question_id).maybeSingle();
   if(saved.error)throw saved.error;return reply({ok:true,explanation:saved.data?.explanation});
  }
  if(body.action==='approve_concepts'){
   const needs=approveConcepts(found.data.figure_needs,body.choices);
   const result=await db.rpc('figure_image_review',{p_id:body.id,p_revision:body.revision,p_needs:needs,p_reviewer:u.id});
   if(result.error||result.data!=='approved')return reply({ok:false,code:'stale_review'},409);
   return reply({ok:true});
  }
  return reply({ok:false},400);
 }catch{return reply({ok:false,code:'unavailable'},503)}
}
