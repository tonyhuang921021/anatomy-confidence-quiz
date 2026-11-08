import {resolveTrustedExplanationQuestion} from "@/lib/trustedQuestionLoader";
import {createFinalFigureReviewer} from "@/lib/finalFigureRuntime.cjs";
import {figureCaptureAllowed,guardFigureTraffic} from "@/lib/figureCaptureGate.cjs";
import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';
import {boundedImageTarget,imageWindowOpen,buildNeeds,approveConcepts,createStore,runOne,CATALOG} from '@/lib/newExplanationFigures.cjs';
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
  if(body.action==='list'){
   const {data,error}=await db.from('figure_queue_jobs').select('request_id,question_id,figure_needs,needs_state,image_status,state,attempts').in('state',['pending','done','failed']).order('created_at').limit(20);
   if(error)throw error;
   const unplanned=await db.from('question_explanation_overrides').select('question_id').in('figure_status',['awaiting_image_plan','awaiting_image']).limit(20);
   if(unplanned.error)throw unplanned.error;
   return reply({ok:true,jobs:data,catalog:CATALOG,unplanned:unplanned.data});
  }
  if(['run_one','retry_image','plan_saved'].includes(body.action) && (!imageWindowOpen(process.env)||process.env.NEW_EXPLANATION_FIGURES_CAPTURE!=='1'||!await figureCaptureAllowed(db)))return reply({ok:false,code:'worker_disabled'},503);
  if(body.action==='plan_saved'){
   const target=boundedImageTarget(process.env);
   if(target&&body.questionId!==target.questionId)return reply({ok:false,code:'outside_single_batch'},403);
   if(typeof body.questionId!=='string'||! /^[A-Za-z0-9_-]{1,200}$/.test(body.questionId))return reply({ok:false},400);
   const saved=await db.from('question_explanation_overrides').select('explanation,figure_status').eq('question_id',body.questionId).maybeSingle();
   if(saved.error||!saved.data?.figure_status)return reply({ok:false},404);
   const needs=buildNeeds(saved.data.explanation,body.hints);
   if(target&&needs?.explanationHash!==target.textHash)return reply({ok:false,code:'stale_single_batch'},409);
   if(!needs?.items?.length)return reply({ok:false,code:'heading_not_found'},400);
   const result=await db.rpc('figure_image_plan_saved',{p_question:body.questionId,p_needs:needs});
   return reply({ok:!result.error&&['awaiting','existing'].includes(result.data)});
  }
  if(['run_one','retry_image','plan_saved'].includes(body.action)&&!imageWindowOpen(process.env))return reply({ok:false,code:'worker_disabled'},503);
  if(body.action==='run_one'){
   if(process.env.NEW_EXPLANATION_FIGURES_WORKER!=='1')return reply({ok:false,code:'worker_disabled'},503);
   return reply({ok:true,...await runOne({finalReview:createFinalFigureReviewer({db,readQuestion:(id:string)=>{const result=resolveTrustedExplanationQuestion(id);return result.ok?result.question:null}}),store:createStore(db),search:guardFigureTraffic(db,commonsSearch,()=>imageWindowOpen(process.env)),loadImage:guardFigureTraffic(db,readBoundedImage,()=>imageWindowOpen(process.env)),enabled:true})});
  }
  if(typeof body.id!=='string'||! /^[0-9a-f-]{36}$/i.test(body.id))return reply({ok:false},400);
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
