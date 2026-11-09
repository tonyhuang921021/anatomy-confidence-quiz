import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';
import {createGenerationJournal,validOperationId} from '@/lib/generationResultJournal.cjs';
import {resolveTrustedExplanationQuestion} from '@/lib/trustedQuestionLoader';
import {withServerTimeout} from '@/lib/serverTimeout';
const reply=(value:unknown,status=200)=>NextResponse.json(value,{status,headers:{'Cache-Control':'no-store'}});
// Recover only a saved response from this actor/question/operation. No provider,
// new reservation, source search, permission grant or unknown replay is possible.
export async function POST(request:NextRequest){
 try{
  const raw=await request.text();if(Buffer.byteLength(raw)>2048)return reply({ok:false},413);
  const {questionId,operationId}=JSON.parse(raw);
  if(!validOperationId(operationId)||typeof questionId!=='string'||!resolveTrustedExplanationQuestion(questionId).ok)return reply({ok:false,code:'invalid_request'},400);
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)return reply({ok:false,code:'generation_journal_unavailable'},503);
  const token=request.headers.get('authorization')?.replace(/^Bearer /,'');if(!token)return reply({ok:false,code:'authentication_required'},401);
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const auth=await withServerTimeout(db.auth.getUser(token),1600,'authentication unavailable');
  if(auth.error||!auth.data.user?.id||!auth.data.user.email)return reply({ok:false,code:'authentication_required'},401);
  const journal=createGenerationJournal({db}),identity={questionId,operationId,actorId:auth.data.user.id};
  let result:any=await withServerTimeout(journal.readGeneration(identity),2000,'status unavailable');
  if(result?.state==='pending'||result?.state==='completed'){
   try{result=await withServerTimeout(journal.recoverGeneration(identity),2500,'recovery unavailable')}
   catch(error){if(result?.state!=='completed')throw error; /* Keep already confirmed text if optional queue repair fails. */}
  }
  if(result?.state==='completed')return reply({ok:true,status:'completed',value:result.value});
  return reply({ok:true,status:result?.state==='not_written'?'not_written':'pending'});
 }catch{return reply({ok:false,code:'generation_pending'},503)}
}
