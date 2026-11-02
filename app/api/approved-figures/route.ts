import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';
import {createHash} from 'node:crypto';
import {publishedTrialFigure} from '@/lib/publishedTrialFigures';
import {safeApprovedMeta} from '@/lib/approvedFigureSecurity';
export async function GET(request:NextRequest){
 const headers={'Cache-Control':'no-store'};if(process.env.FIGURE_REVIEW_ENABLED!=='1')return NextResponse.json({figures:[]},{headers});
 const id=request.nextUrl.searchParams.get('questionId');if(!id||!/^[A-Za-z0-9_-]{1,200}$/.test(id))return NextResponse.json({figures:[]},{status:400,headers});
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)return NextResponse.json({figures:[]},{status:503,headers});
 try{
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error}=await db.rpc('list_approved_explanation_figures',{p_question:id});
  if(error||!Array.isArray(data))throw Error('unavailable');
  const figures=data.filter(safeApprovedMeta).slice(0,3);
  if(process.env.NEW_EXPLANATION_FIGURES_RENDER!=='1')return NextResponse.json({figures},{headers});
  const saved=await db.from('question_explanation_overrides').select('explanation,figure_status').eq('question_id',id).maybeSingle();
  if(saved.error)throw Error('unavailable');
  if(!saved.data)return NextResponse.json({figures},{headers});
  const hash=createHash('sha256').update(saved.data.explanation).digest('hex');
  const published=publishedTrialFigure(id,hash);
  if(published)return NextResponse.json({figures:[],sectionFigures:[published],explanationHash:hash,imageStatus:'approved',sections:[{sectionTitle:published.section_heading}]},{headers});
  const jobs=await db.from('figure_queue_jobs').select('figure_needs,image_status').eq('question_id',id).eq('explanation_sha256',hash).maybeSingle();
  const bound=await db.from('explanation_figure_candidates').select('id,section_anchor,section_heading,section_sha256').eq('question_id',id).eq('explanation_sha256',hash).eq('status','approved');
  if(jobs.error||bound.error)throw Error('unavailable');
  const sectionFigures=figures.flatMap((x:any)=>{const m=bound.data?.find(y=>y.id===x.id&&y.section_anchor);return m?[{...x,...m}]:[]});
  return NextResponse.json({figures:figures.filter((x:any)=>!sectionFigures.some(y=>y.id===x.id)),sectionFigures,explanationHash:hash,imageStatus:jobs.data?.image_status||saved.data.figure_status,sections:(jobs.data?.figure_needs?.items||[]).map((x:any)=>({sectionTitle:x.sectionTitle,sectionHash:x.sectionHash}))},{headers});
 }catch{return NextResponse.json({figures:[]},{status:503,headers})}
}
