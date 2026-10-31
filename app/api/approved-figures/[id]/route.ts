import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';
import {createHash} from 'node:crypto';
import {decodeBytea} from '@/lib/figureReviewAdapter.cjs';
import {figureIdPattern} from '@/lib/approvedFigureSecurity';
export async function GET(_request:NextRequest,{params}:{params:{id:string}}){
 const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};if(process.env.FIGURE_REVIEW_ENABLED!=='1'||!figureIdPattern.test(params.id))return new NextResponse(null,{status:404,headers});
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)return new NextResponse(null,{status:503,headers});
 try{const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});const {data,error}=await db.rpc('read_approved_explanation_figure',{p_id:params.id});const row=Array.isArray(data)?data[0]:null;if(error||!row)return new NextResponse(null,{status:404,headers});const bytes=decodeBytea(row.image_bytes);if(bytes.length>3145728||!['image/png','image/jpeg','image/webp'].includes(row.image_mime)||createHash('sha256').update(bytes).digest('hex')!==row.image_sha256)return new NextResponse(null,{status:404,headers});return new NextResponse(bytes,{headers:{...headers,'Content-Type':row.image_mime}})}catch{return new NextResponse(null,{status:503,headers})}
}
