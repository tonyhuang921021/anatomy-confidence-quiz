import {pageResponse} from '@/features/undercover/integration/runtime.mjs';
import {html} from '@/features/undercover/page.mjs';
import {withGameRuntime} from '@/features/undercover/integration/bootstrap.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export function GET(request:Request){return withGameRuntime(request,req=>pageResponse(req,html));}
