import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';
import {safeApprovedMeta} from '@/lib/approvedFigureSecurity';
export async function GET(request:NextRequest){
 const headers={'Cache-Control':'no-store'};if(process.env.FIGURE_REVIEW_ENABLED!=='1')return NextResponse.json({figures:[]},{headers});
 const id=request.nextUrl.searchParams.get('questionId');if(!id||!/^[A-Za-z0-9_-]{1,200}$/.test(id))return NextResponse.json({figures:[]},{status:400,headers});
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)return NextResponse.json({figures:[]},{status:503,headers});
 try{const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});const {data,error}=await db.rpc('list_approved_explanation_figures',{p_question:id});if(error||!Array.isArray(data))throw Error('unavailable');return NextResponse.json({figures:data.filter(safeApprovedMeta).slice(0,3)},{headers})}catch{return NextResponse.json({figures:[]},{status:503,headers})}
}
