import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { prepareManualPdm, MANUAL_PDM_QUESTION_ID, MANUAL_PDM_IMAGE_SHA } from '@/lib/manualPdmEvidence.cjs';

const reply=(v:unknown,s=200)=>NextResponse.json(v,{status:s,headers:{'Cache-Control':'no-store'}});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function POST(request:NextRequest){
 if(process.env.FIGURE_REVIEW_ENABLED!=='1'||process.env.FIGURE_PDM_MANUAL_ENABLED!=='1')return reply({ok:false,code:'disabled'},503);
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)return reply({ok:false,code:'unavailable'},503);
 let b:any;try{const text=await request.text();if(Buffer.byteLength(text)>4300000)return reply({ok:false,code:'too_large'},413);b=JSON.parse(text)}catch{return reply({ok:false,code:'invalid'},400)}
 if(typeof b?.accessToken!=='string')return reply({ok:false,code:'unauthorized'},401);
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 try{
  const auth=await db.auth.getUser(b.accessToken),user=auth.data?.user;
  const admins=(process.env.NEXT_PUBLIC_ADMIN_EMAILS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
  if(auth.error||!user?.id||!user.email)return reply({ok:false,code:'unauthorized'},401);
  if(!admins.includes(user.email.trim().toLowerCase()))return reply({ok:false,code:'forbidden'},403);
  if(b.action==='revoke'){
   if(!uuid.test(b.id||'')||! /^[0-9a-f]{64}$/.test(b.imageSha||'')||b.confirmRevoke!==true)return reply({ok:false,code:'invalid'},400);
   const scoped=await db.from('explanation_figure_candidates').select('question_id,image_sha256,license').eq('id',b.id).maybeSingle();
   if(scoped.error)throw Error('db');
   if(!scoped.data||scoped.data.question_id!==MANUAL_PDM_QUESTION_ID||scoped.data.image_sha256!==MANUAL_PDM_IMAGE_SHA||b.imageSha!==MANUAL_PDM_IMAGE_SHA||scoped.data.license!=='PDM 1.0')return reply({ok:false,code:'out_of_scope'},403);
   const {data,error}=await db.rpc('figure_revoke_manual_pdm',{p_id:b.id,p_image_sha:b.imageSha,p_actor:user.id});
   if(error)throw Error('db');return reply({ok:data==='revoked',status:data},data==='revoked'?200:409);
  }
  if(b.action!=='stage'||b.questionId!==MANUAL_PDM_QUESTION_ID||b.imageSha!==MANUAL_PDM_IMAGE_SHA)return reply({ok:false,code:'out_of_scope'},403);
  if(typeof b.imageBase64!=='string'||! /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(b.imageBase64))return reply({ok:false,code:'invalid'},400);
  const bytes=Buffer.from(b.imageBase64,'base64');if(!bytes.length||bytes.length>3*1024*1024||bytes.toString('base64')!==b.imageBase64)return reply({ok:false,code:'invalid'},400);
  const {data:old,error}=await db.from('question_explanation_overrides').select('explanation').eq('question_id',b.questionId).maybeSingle();
  if(error)throw Error('db');if(typeof old?.explanation!=='string')return reply({ok:false,code:'missing_text'},409);
  let row:any;try{row=prepareManualPdm({actor:{verifiedAdminId:user.id},questionId:b.questionId,explanation:old.explanation,bytes,mime:b.mime,sourceUrl:b.sourceUrl,imageUrl:b.imageUrl,markUrl:b.markUrl,attribution:b.attribution,sectionTitle:b.sectionTitle,expectedImageSha:b.imageSha,sourceConfirmed:b.sourceConfirmed,markConfirmed:b.markConfirmed,imageConfirmed:b.imageConfirmed})}catch{return reply({ok:false,code:'invalid_evidence'},400)}
  const id=randomUUID(),result=await db.rpc('figure_stage_manual_pdm',{p_id:id,p_question:b.questionId,p_text_sha:row.explanation_sha256,p_image_sha:row.image_sha256,p_mime:b.mime,p_bytes:'\\x'+bytes.toString('hex'),p_source:b.sourceUrl,p_image_url:row.pdm_image_url,p_attribution:b.attribution,p_section:b.sectionTitle,p_actor:user.id});
  if(result.error)throw Error('db');return reply({ok:true,id,status:'pending'});
 }catch{return reply({ok:false,code:'unavailable'},503)}
}
