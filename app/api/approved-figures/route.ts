import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';
import {createHash} from 'node:crypto';
import {imageActivityForJob} from '@/lib/explanationImageActivity';
import {publishedTrialFigure} from '@/lib/publishedTrialFigures';
import {safeApprovedMeta} from '@/lib/approvedFigureSecurity';
import {userProvidedExplanationFigure} from '@/lib/userProvidedExplanationFigure.cjs';
export async function GET(request:NextRequest){
 const headers={'Cache-Control':'no-store'};if(process.env.FIGURE_REVIEW_ENABLED!=='1')return NextResponse.json({figures:[]},{headers});
 const id=request.nextUrl.searchParams.get('questionId');if(!id||!/^[A-Za-z0-9_-]{1,200}$/.test(id))return NextResponse.json({figures:[]},{status:400,headers});
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)return NextResponse.json({figures:[]},{status:503,headers});
 try{
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error}=await db.rpc('list_approved_explanation_figures',{p_question:id});
  if(error||!Array.isArray(data))throw Error('unavailable');
  let figures=data.filter(safeApprovedMeta).slice(0,3);
  const saved=await db.from('question_explanation_overrides').select('explanation,figure_status,replacement_revision').eq('question_id',id).maybeSingle();
  if(saved.error)throw Error('unavailable');
  if(!saved.data)return NextResponse.json({figures},{headers});
  // A replacement may only display images bound to its exact saved text.
  // Old generic/reviewed images stay in storage and reappear after a restore.
  const versioned=Boolean(saved.data.replacement_revision);
  if(process.env.NEW_EXPLANATION_FIGURES_RENDER!=='1')return NextResponse.json({figures:versioned?[]:figures},{headers});
  const hash=createHash('sha256').update(saved.data.explanation).digest('hex');
  const userProvided=userProvidedExplanationFigure(id,hash,saved.data.replacement_revision);
  if(userProvided)return NextResponse.json({figures:[],sectionFigures:[],explanationHash:hash,replacementRevision:saved.data.replacement_revision,userProvidedFigureId:userProvided.id,imageStatus:'user_provided',sections:[{sectionTitle:userProvided.sectionTitle}]},{headers});
  const published=publishedTrialFigure(id,hash);
  if(published)return NextResponse.json({figures:[],sectionFigures:[published],explanationHash:hash,imageStatus:'approved',sections:[{sectionTitle:published.section_heading}]},{headers});
  const jobs=await db.from('figure_queue_jobs').select('figure_needs,image_status,state,lease_until,updated_at').eq('question_id',id).eq('explanation_sha256',hash).maybeSingle();
  const bound=await db.from('explanation_figure_candidates').select('id,section_anchor,section_heading,section_sha256,status,explanation_sha256').eq('question_id',id).limit(100);
  if(jobs.error||bound.error)throw Error('unavailable');
  const sectionFigures=figures.flatMap((x:any)=>{const m=bound.data?.find(y=>y.id===x.id&&y.explanation_sha256===hash&&y.status==='approved'&&y.section_anchor);return m?[{...x,...m}]:[]});
  // Read-only, current quota evidence. An unavailable/old database never
  // becomes a fabricated 'quota exceeded' cause and never hides saved images.
  let capacity:any=null;
  if(jobs.data?.state==='done'&&jobs.data.image_status==='awaiting_budget'){
   try{const quota=await db.rpc('figure_search_capacity');
    if(!quota.error&&quota.data?.mode==='taipei_daily_v1')capacity=quota.data;
   }catch{/* Keep saved images and neutral status if the optional read fails. */}
  }
  let imageStatus=jobs.data?.image_status||saved.data.figure_status;
  if(imageStatus==='pending_visual_review'&&!sectionFigures.length&&!bound.data?.some(x=>x.explanation_sha256===hash&&x.status==='pending'))imageStatus='awaiting_image';
  return NextResponse.json({figures:versioned?[]:figures.filter((x:any)=>bound.data?.some(y=>y.id===x.id&&y.explanation_sha256===hash&&y.status==='approved')&&!sectionFigures.some(y=>y.id===x.id)),sectionFigures,explanationHash:hash,imageStatus,imageActivity:imageActivityForJob(jobs.data,figures.some((x:any)=>bound.data?.some(y=>y.id===x.id&&y.explanation_sha256===hash&&y.status==='approved')),Date.now(),capacity),sections:(jobs.data?.figure_needs?.items||[]).map((x:any)=>({sectionTitle:x.sectionTitle,sectionHash:x.sectionHash}))},{headers});
 }catch{return NextResponse.json({figures:[]},{status:503,headers})}
}
