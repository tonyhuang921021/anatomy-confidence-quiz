import {apiResponse} from '@/features/undercover/integration/runtime.mjs';
import {withGameRuntime} from '@/features/undercover/integration/bootstrap.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=15;
export function POST(request:Request){return withGameRuntime(request,apiResponse);}
