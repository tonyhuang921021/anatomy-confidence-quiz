import {randomBytes} from 'node:crypto';
import {GameError,digest,LIMITS} from './game.mjs';
export const BASE='/games/undercover';
const COOKIE='undercover_device';
export const securityHeaders={
 'Cache-Control':'private, no-store, max-age=0',
 'X-Content-Type-Options':'nosniff',
 'Referrer-Policy':'no-referrer',
 'X-Robots-Tag':'noindex, nofollow, noarchive',
 'Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'self'; form-action 'self'",
};
export function deviceFrom(req){const value=(req.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);return value&&/^[a-f0-9]{64}$/.test(value)?value:null;}
export function ensureDevice(req){return deviceFrom(req)||randomBytes(32).toString('hex');}
export function cookieFor(req,raw){return `${COOKIE}=${raw}; Path=${BASE}; HttpOnly; SameSite=Strict; Max-Age=7200${new URL(req.url).protocol==='https:'?'; Secure':''}`;}
export class RateLimit {
 constructor(now=Date.now){this.now=now;this.buckets=new Map();}
 take(key,limit,ms=60_000){const now=this.now();for(const[k,b]of this.buckets)if(b.until<now)this.buckets.delete(k);if(this.buckets.size>2000)throw new GameError('SERVER_BUSY',429);let b=this.buckets.get(key);if(!b||b.until<now){b={count:0,until:now+ms};this.buckets.set(key,b);}if(++b.count>limit)throw new GameError('RATE_LIMIT',429);}
}
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{...securityHeaders,'Content-Type':'application/json; charset=utf-8'}});
export function makeApi({game,origin,rate=new RateLimit()}){
 return async(req,ip='local')=>{try{
  if(req.method!=='POST')return json({error:'METHOD_NOT_ALLOWED'},405);
  if(req.headers.get('origin')!==origin)throw new GameError('ORIGIN_REJECTED',403);
  if(!req.headers.get('content-type')?.startsWith('application/json'))throw new GameError('JSON_REQUIRED',415);
  const raw=deviceFrom(req);if(!raw)throw new GameError('SESSION_REQUIRED',401);
  const device=digest(raw);rate.take('all:'+digest(ip),600);rate.take('device:'+device,150);
  if(Number(req.headers.get('content-length'))>LIMITS.bodyBytes)throw new GameError('BODY_TOO_LARGE',413);
  // Read a bounded stream; Content-Length is not trusted.
  let text='',bytes=0;const decoder=new TextDecoder('utf-8',{fatal:true}),reader=req.body?.getReader();if(!reader)throw new GameError('BAD_JSON');for(;;){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>LIMITS.bodyBytes){await reader.cancel();throw new GameError('BODY_TOO_LARGE',413);}text+=decoder.decode(value,{stream:true});}text+=decoder.decode();
  let data;try{data=JSON.parse(text);}catch{throw new GameError('BAD_JSON');}
  if(!data||typeof data!=='object'||Array.isArray(data))throw new GameError('BAD_JSON');
  const {action,code,args={},requestId}=data;
  if(!['create','join','admission','view','resume','receipt','sync','configure','start','message','vote','advance','restart','leave'].includes(action))throw new GameError('UNKNOWN_ACTION');
  if(Object.keys(data).some(k=>!['action','code','args','requestId'].includes(k)))throw new GameError('BAD_FIELDS');
  if(!args||typeof args!=='object'||Array.isArray(args))throw new GameError('BAD_FIELDS');
  const fields={create:['name'],join:['name'],admission:[],view:[],resume:[],receipt:[],sync:[],configure:['aiCount','expectedStage'],start:['expectedStage'],message:['text','expectedStage'],vote:['target','expectedStage'],advance:['expectedStage'],restart:['expectedStage'],leave:[]}[action];
  if(Object.keys(args).some(k=>!fields.includes(k)))throw new GameError('BAD_FIELDS');
  if(action!=='view'&&!(typeof requestId==='string'&&/^[\w-]{16,80}$/.test(requestId)))throw new GameError('BAD_REQUEST_ID');
  if(['create','join'].includes(action))rate.take('join:'+digest(ip),12);
  if(action==='admission')rate.take('admission:'+digest(ip),30);
  if(!['view','sync','admission'].includes(action))rate.take('mutation:'+device,40);
  if(action==='create'){const result=await game.create(device,args.name,requestId);return json({state:await game.view(device,result.code)});}
  if(action==='admission')return json({admission:await game.admission(device,code)});
  if(action==='view')return json({state:await game.view(device,code)});
  if(action==='resume'){const ownCode=await game.resume(device);return json({state:ownCode?await game.view(device,ownCode):null});}
  if(action==='receipt')return json({...await game.receipt(device,code,requestId),state:await game.view(device,code)});
  await game.command(device,code,action,args,requestId);
  if(action==='leave')return json({left:true});
  return json({state:await game.view(device,code)});
 }catch(error){if(error instanceof GameError)return json({error:error.code},error.status);return json({error:'INTERNAL_ERROR'},500);}};
}
