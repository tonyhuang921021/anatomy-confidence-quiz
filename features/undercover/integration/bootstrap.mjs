// Server route only. No credential lookup occurs until GAME_ENABLED and explicit
// schema/lifecycle approval are configured. No anon-key fallback or auto key creation.
import {createClient}from'@supabase/supabase-js';
import {waitUntil}from'@vercel/functions';
import {createPersistentGame,createGameRpc,validModelProfile}from'../src/runtime-v2.mjs';
import {installApprovedRuntime}from'./runtime.mjs';
const key=Symbol.for('undercover.v2.bootstrap');
export async function initializeGameRuntime({env=process.env,clientFactory=createClient,schedule=waitUntil}={}){
 if(env.UNDERCOVER_GAME_ENABLED!=='1'||env.UNDERCOVER_LOCAL_TEST==='1'&&!env.VERCEL)return null;
 if(env.UNDERCOVER_RUNTIME_APPROVED!=='v2')throw Error('GAME_SCHEMA_NOT_APPROVED');
 const url=env.NEXT_PUBLIC_SUPABASE_URL,serviceKey=env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||new URL(url).origin!=='https://ejyniduhsyurxocabqqp.supabase.co'||!serviceKey)throw Error('GAME_DB_NOT_CONFIGURED');
 const realModel=env.UNDERCOVER_AI_MODE==='terra';if(!realModel&&env.UNDERCOVER_AI_MODE!=='test')throw Error('GAME_MODE_NOT_CONFIGURED');
 if(realModel&&!env.UNDERCOVER_OPENAI_API_KEY)throw Error('GAME_CREDENTIAL_NOT_CONFIGURED');
 const rpc=createGameRpc(clientFactory(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(url,options)=>fetch(url,{...options,signal:AbortSignal.timeout(5000)})}}));
 const status=await rpc('undercover_v2_budget_status',{});if(!validModelProfile(status))throw Error('GAME_PROFILE_MISMATCH');
 // Configured but expired/paused budgets must still permit cold readers to see
 // existing rooms; the atomic reserve gate alone decides whether dispatch is allowed.
 if(realModel&&(!Number.isSafeInteger(status.capMicro)||status.capMicro<=0||!Number.isFinite(Date.parse(status.until))))throw Error('GAME_BUDGET_NOT_CONFIGURED');
 const game=createPersistentGame({approved:true,rpc,realModel,schedule,credentialProvider:()=>env.UNDERCOVER_OPENAI_API_KEY,onMetrics:event=>console.info('undercover_ai_timing',JSON.stringify(event))});return game;
}
export async function withGameRuntime(request,handler){try{if(process.env.UNDERCOVER_GAME_ENABLED==='1'&&!(process.env.UNDERCOVER_LOCAL_TEST==='1'&&!process.env.VERCEL)){if(!globalThis[key])globalThis[key]=initializeGameRuntime().then(runtime=>{installApprovedRuntime(runtime);return runtime;}).catch(e=>{delete globalThis[key];throw e;});await globalThis[key];}return handler(request);}catch{return Response.json({error:'GAME_NOT_CONFIGURED'},{status:503,headers:{'Cache-Control':'private, no-store','X-Robots-Tag':'noindex'}});}}
