import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
function getSupabaseServerClient(){const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;return url&&key?createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}):null;}
import {withServerTimeout} from "@/lib/serverTimeout";
import {resolveTrustedExplanationQuestion} from "@/lib/trustedQuestionLoader";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const reply=(value:unknown,status=200)=>NextResponse.json(value,{status,headers:{"Cache-Control":"no-store"}});
// Actor comes only from validated credentials; archives and other actors are never exposed.
export async function POST(request:NextRequest){
 try{
  const raw=await request.text();if(Buffer.byteLength(raw,"utf8")>2048)return reply({ok:false},413);
  const body=JSON.parse(raw);const {questionId,operationId,action,baseVersion}=body;
  if(typeof questionId!=="string"||!resolveTrustedExplanationQuestion(questionId).ok||!["status","restore"].includes(action)||(operationId!=null&&!uuid.test(operationId)))return reply({ok:false,code:"invalid_request"},400);
  const db=getSupabaseServerClient();const token=request.headers.get("authorization")?.replace(/^Bearer /,"");
  if(!db||!token)return reply({ok:false,code:"authentication_required"},401);
  const auth=await withServerTimeout(db.auth.getUser(token),1600,"auth timeout");
  if(auth.error||!auth.data.user?.id||!auth.data.user.email)return reply({ok:false,code:"authentication_required"},401);
  if(action==="restore"&&(!operationId||typeof baseVersion!=="string"||! /^[a-f0-9]{64}$/.test(baseVersion)))return reply({ok:false,code:"invalid_request"},400);
  const result=await withServerTimeout(db.rpc(action==="restore"?"explanation_replacement_restore":"explanation_replacement_status",{p_actor:auth.data.user.id,p_question:questionId,...(action==="restore"?{p_revision:operationId,p_base_version:baseVersion}:{p_operation:operationId??null})}),2000,"replacement outcome unconfirmed");
  if(result.error||!result.data)return reply({ok:false,code:"replacement_unavailable"},503);
  // Whitelist presentation fields; private snapshot/actor/source references never leave SQL.
  let data=result.data;
  if(action==='status'&&operationId&&data.status==='pending'){
   // Durable recovery remains available after new sitewide admission is disabled.
   const recovered=await db.rpc('explanation_sitewide_result_recover',{p_id:operationId,p_actor:auth.data.user.id,p_question:questionId});
   if(!recovered.error&&['completed','not_written'].includes(recovered.data?.status))data=recovered.data;
  }
  if(action==='status'&&operationId&&data.status==='pending'&&process.env.EXPLANATION_RESULT_JOURNAL_ENABLED==='1'){
   // Resume only a previously persisted provider result. This RPC has no network
   // transport or new budget reservation; absent evidence remains pending.
   const recovered=await withServerTimeout(db.rpc('figure_text_result_recover',{p_id:operationId,p_actor:auth.data.user.id}),2000,'result recovery unconfirmed');
   if(!recovered.error&&recovered.data?.status==='replaced'&&recovered.data.value?.question_id===questionId)data={...recovered.data,status:'completed'};
  }
  const row=data.value;
  return reply({ok:true,status:data.status,baseVersion:data.baseVersion,revision:data.revision,canRestore:data.canRestore===true,
   value:row?{explanation:row.explanation,optionAnalysis:row.option_analysis??{},memoryTip:row.memory_tip??"",model:row.model,updatedAt:row.updated_at,replacementRevision:row.replacement_revision??null,readingFormat:row.reading_format??null}:null});
 }catch{return reply({ok:false,code:"replacement_outcome_unconfirmed"},503);}
}
