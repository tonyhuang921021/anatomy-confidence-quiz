import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import { createRepository } from '@/lib/figureReviewAdapter.cjs';
import { resolveTrustedExplanationQuestion } from '@/lib/trustedQuestionLoader';
import { boundSection, exactReuse } from '@/lib/figureReviewContext.cjs';
import { review, validate } from '@/lib/figureReviewService.cjs';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const response=(value:unknown,status=200)=>NextResponse.json(value,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(request:NextRequest){
 if(process.env.FIGURE_REVIEW_ENABLED!=='1')return response({ok:false,code:'disabled'},503);
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)return response({ok:false,code:'unavailable'},503);
 let body:any;try{const text=await request.text();if(Buffer.byteLength(text)>8192)return response({ok:false,code:'too_large'},413);body=JSON.parse(text)}catch{return response({ok:false,code:'invalid'},400)}
 if(typeof body?.accessToken!=='string')return response({ok:false,code:'unauthorized'},401);
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 try{
  const auth=await db.auth.getUser(body.accessToken),user=auth.data?.user;
  const allowed=(process.env.NEXT_PUBLIC_ADMIN_EMAILS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
  if(auth.error||!user?.id||!user.email)return response({ok:false,code:'unauthorized'},401);
  if(!allowed.includes(user.email.trim().toLowerCase()))return response({ok:false,code:'forbidden'},403);
  if(body.action==='list'){
   const fields='id,question_id,section_title,section_heading,source_url,license_url,license,attribution,status,created_at';
   const [pending,approved]=await Promise.all([
    db.from('explanation_figure_candidates').select(fields).eq('status','pending').order('created_at',{ascending:true}).limit(60),
    db.from('explanation_figure_candidates').select(fields).eq('status','approved').order('reviewed_at',{ascending:false}).limit(30)
   ]);
   if(pending.error||approved.error)throw Error('unavailable');
   return response({ok:true,candidates:[...(pending.data||[]),...(approved.data||[])],pendingLimit:60,approvedLimit:30});
  }
  if(typeof body.id!=='string'||!uuid.test(body.id))return response({ok:false,code:'invalid'},400);
  const repo=createRepository(db),item=await repo.getPending(body.id)||await repo.getApproved(body.id);if(!item)return response({ok:false,code:'not_pending'},404);
  if(body.action==='preview'){
   const text=await repo.readCommitted(item.question_id);if(typeof text!=='string')return response({ok:false,code:'stale'},409);
   const checked=validate({questionId:item.question_id,explanation:text,bytes:item.image_bytes,mime:item.image_mime,sourceUrl:item.source_url,licenseUrl:item.license_url,license:item.license,attribution:item.attribution,sectionTitle:item.section_title});
   if(checked.explanation_sha256!==item.explanation_sha256||checked.image_sha256!==item.image_sha256||createHash('sha256').update(item.image_bytes).digest('hex')!==item.image_sha256)return response({ok:false,code:'stale'},409);
   const resolved=resolveTrustedExplanationQuestion(item.question_id);
   const question=resolved.ok?{stem:resolved.question.stem,options:resolved.question.options,answer:resolved.question.answer,sharedContext:resolved.sharedContext}:null;
   const section=boundSection(text,item);
   let reuseSource:null|{id:string;questionId:string}=null;
   if(item.status==='pending'&&section&&item.license!=='PDM 1.0'){
    const sources=await db.from('explanation_figure_candidates').select('id').eq('status','approved').eq('image_sha256',item.image_sha256).eq('section_sha256',item.section_sha256).order('reviewed_at',{ascending:false}).limit(20);
    if(sources.error)throw Error('unavailable');
    for(const row of sources.data||[]){const source=await repo.getApproved(row.id);if(!source)continue;const saved=await repo.readCommitted(source.question_id);if(exactReuse(item,source,text,saved)){reuseSource={id:source.id,questionId:source.question_id};break}}
   }
   return response({ok:true,questionId:item.question_id,question,section,explanation:section?null:text,reuseSource,imageSha:item.image_sha256,id:body.id,status:item.status,mime:item.image_mime,imageBase64:item.image_bytes.toString('base64'),sourceUrl:item.source_url,licenseUrl:item.license_url,license:item.license,attribution:item.attribution,sectionTitle:item.section_title,pdmImageUrl:item.pdm_image_url||null,pdmEvidenceAt:item.pdm_evidence_at||null});
  }
  if(body.action==='reuse'){
   if(item.status!=='pending'||body.visualConfirmed!==true)return response({ok:false,code:'invalid'},400);
   const text=await repo.readCommitted(item.question_id);
   const result=await db.rpc('review_explanation_figure',{p_id:item.id,p_decision:'reuse',p_reviewer:user.id,p_visual_confirmed:true,p_expected_explanation:text,p_expected_explanation_sha:item.explanation_sha256,p_expected_image_sha:item.image_sha256,p_expected_image:'\\x'+item.image_bytes.toString('hex')});
   return response({ok:!result.error&&result.data==='approved',status:result.data});
  }
  if(body.action==='revoke'){
   if(item.status!=='approved'||body.confirmRevoke!==true||body.imageSha!==item.image_sha256)return response({ok:false,code:'invalid'},400);
   const text=await repo.readCommitted(item.question_id);
   const result=await db.rpc('review_explanation_figure',{p_id:item.id,p_decision:'rejected',p_reviewer:user.id,p_visual_confirmed:false,p_expected_explanation:text,p_expected_explanation_sha:item.explanation_sha256,p_expected_image_sha:item.image_sha256,p_expected_image:'\\x'+item.image_bytes.toString('hex')});
   return response({ok:!result.error&&result.data==='rejected',status:result.data});
  }
  if(body.action==='review'){
   if(!['approved','rejected'].includes(body.decision))return response({ok:false,code:'invalid'},400);
   const result=await review({actor:{verifiedAdminId:user.id},candidateId:body.id,decision:body.decision,visualConfirmed:body.visualConfirmed===true,repository:repo,readCommitted:repo.readCommitted});
   return response({ok:true,status:result.status});
  }
  return response({ok:false,code:'invalid'},400);
 }catch{return response({ok:false,code:'review_unavailable'},503)}
}
