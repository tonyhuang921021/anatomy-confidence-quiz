import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';
import {IDS,generate,createStore} from '@/lib/terraTrial.cjs';
import {resolveTrustedExplanationQuestion} from '@/lib/trustedQuestionLoader';
import {hasReviewedExplanation} from '@/lib/reviewedExplanations';
import {createOpenAIText,isOpenAIConfigured} from '@/lib/openai';
import {normalizeQuestionExplanationPayload} from '@/lib/questionExplanationFormat';
import {TRIAL_FIGURES} from '@/lib/terraTrialFigures';
export const maxDuration=120;
const reply=(body:any,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(request:NextRequest){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)return reply({ok:false,code:'unavailable'},503);
 try{
  const raw=await request.text();if(Buffer.byteLength(raw)>8192)return reply({ok:false},413);
  const body=JSON.parse(raw);
  // Stopping generation must never hide previously saved, owner-only results.
  if(body.action!=='list'&&process.env.TERRA_FIVE_TRIAL_ENABLED!=='1')return reply({ok:false,code:'disabled'},503);
  if(typeof body.accessToken!=='string')return reply({ok:false},401);
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const auth=await db.auth.getUser(body.accessToken),user=auth.data?.user;
  if(auth.error||!user?.id||!user.email)return reply({ok:false},401);
  if(!(process.env.NEXT_PUBLIC_ADMIN_EMAILS||'').split(',').map(x=>x.trim().toLowerCase()).includes(user.email.toLowerCase()))return reply({ok:false},403);
  const store=createStore(db);
  if(body.action==='list'){
   const result=await db.from('terra_five_trial_items').select('question_id,state,payload,usage,provider,created_at,finished_at');
   const config=await db.from('terra_five_trial_config').select('enabled,calls,held_ceiling_microusd,stop_reason,expires_at').eq('id',true).maybeSingle();
   if(result.error||config.error)throw Error('read unavailable');
   return reply({ok:true,config:config.data,questions:IDS.map(id=>{const q=resolveTrustedExplanationQuestion(id);return {id,question:q.ok?{stem:q.question.stem,options:q.question.options,answer:q.question.answer}:null,figure:TRIAL_FIGURES[id],result:result.data?.find(x=>x.question_id===id)||null}})});
  }
  if(body.action!=='generate'||typeof body.questionId!=='string'||!IDS.includes(body.questionId))return reply({ok:false,code:'out_of_scope'},400);
  if(!isOpenAIConfigured())return reply({ok:false,code:'existing_server_key_unavailable'},503);
  const outcome=await generate({id:body.questionId,actor:user.id,enabled:true,store,provider:createOpenAIText,normalize:normalizeQuestionExplanationPayload,isLocked:hasReviewedExplanation,
   resolve:async(id:string)=>{const q=resolveTrustedExplanationQuestion(id);return q.ok&&!q.requiresContext?q.question:null},
   readExisting:async(id:string)=>{const r=await db.from('question_explanation_overrides').select('question_id').eq('question_id',id).maybeSingle();if(r.error)throw Error('read unavailable');return !!r.data}
  });
  return reply({ok:true,...outcome});
 }catch{return reply({ok:false,code:'state_unavailable_read_before_retry'},503)}
}
