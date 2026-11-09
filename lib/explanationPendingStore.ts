// Durable paid-request identity. Never dispatch with only an in-memory identity.
// Original localStorage keys remain readable for already-open/older clients.
type PendingRow = {value:string|null;clearedIdentity?:string;ignoredLocalIdentity?:string};
const records=new Map<string,PendingRow>();
const DB='exam-explanation-pending-v1',STORE='pending';
let opening:Promise<IDBDatabase>|null=null;
const unavailable=()=>new Error('無法確認先前請求紀錄，尚未送出新請求。原詳解與作答紀錄都保留。');
const persistError=()=>new Error('無法保存請求識別，尚未開始生成或替換。原詳解與作答紀錄都保留。');
function identity(raw:string|null){try{const v=raw?JSON.parse(raw):null;return v&&typeof v.operationId==='string'?JSON.stringify([v.operationId,v.kind||'generate',v.startedAt,v.clientNonce||'legacy']):null}catch{return null}}
export function explanationPendingIdentity(value:unknown){return identity(typeof value==='string'?value:JSON.stringify(value))||''}
function localValue(key:string){try{return localStorage.getItem(key)}catch{throw unavailable()}}
function authorityKey(key:string){return key.replace(/^explanation-(generation|replacement)-pending-v1:/,'explanation-current-pending-v1:')}
function validValue(key:string,value:string|null){
 if(value===null)return true;
 try{const v=JSON.parse(value);return v&&typeof v.operationId==='string'&&v.operationId.length>0&&v.operationId.length<=128&&Number.isFinite(v.startedAt)&&(key.startsWith('explanation-generation-')?/^[0-9a-f-]{36}$/i.test(v.operationId):['replace','restore'].includes(v.kind))}catch{return false}
}
function choose(key:string,row:PendingRow|undefined,strict=false){
 const local=localValue(key),localIdentity=identity(local);
 if(!row)return local;
 if(row.value!==null){
  if(local&&localIdentity!==identity(row.value)&&localIdentity!==row.ignoredLocalIdentity&&strict)throw unavailable();
  return row.value;
 }
 return local&&localIdentity!==row.clearedIdentity&&localIdentity!==row.ignoredLocalIdentity?local:null;
}
export function cachedExplanationPending(key:string){try{return choose(key,records.get(key))}catch{return records.get(key)?.value??null}}
function hasIndexedDB(){return typeof indexedDB!=='undefined'}
function openDb():Promise<IDBDatabase>{
 if(opening)return opening;
 opening=new Promise((resolve,reject)=>{
  let settled=false;
  const timer=setTimeout(()=>finish(undefined,unavailable()),2500);
  const finish=(db?:IDBDatabase,error?:Error)=>{
   if(settled){db?.close();return}settled=true;clearTimeout(timer);
   if(error){opening=null;reject(error)}else resolve(db!);
  };
  try{
   const request=indexedDB.open(DB,1);
   request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(STORE))request.result.createObjectStore(STORE)};
   request.onerror=()=>finish(undefined,unavailable());request.onblocked=()=>finish(undefined,unavailable());
   request.onsuccess=()=>{request.result.onversionchange=()=>{request.result.close();opening=null};finish(request.result)};
  }catch{finish(undefined,unavailable())}
 });
 const current=opening;void current.catch(()=>{if(opening===current)opening=null});return current;
}
async function transact<T>(mode:IDBTransactionMode,work:(store:IDBObjectStore,set:(value:T)=>void)=>void):Promise<T>{
 const db=await openDb();return new Promise((resolve,reject)=>{
  let settled=false,value:T,tx:IDBTransaction;
  const fail=()=>{if(settled)return;settled=true;clearTimeout(timer);reject(unavailable())};
  const timer=setTimeout(()=>{try{tx?.abort()}catch{}fail()},2500);
  try{tx=db.transaction(STORE,mode);tx.oncomplete=()=>{if(settled)return;settled=true;clearTimeout(timer);resolve(value)};tx.onerror=fail;tx.onabort=fail;work(tx.objectStore(STORE),v=>{value=v})}catch{fail()}
 });
}
function validRow(row:unknown):row is PendingRow{
 const r=row as PendingRow;return Boolean(r&&(typeof r.value==='string'||(r.value===null&&typeof r.clearedIdentity==='string')));
}
async function readRecord(key:string){
 return transact<PendingRow|undefined>('readonly',(store,set)=>{
  const r=store.get(key);r.onsuccess=()=>{if(r.result!==undefined&&!validRow(r.result)){store.transaction.abort();return}set(r.result)};
 });
}
export async function hydrateExplanationPending(keys:string[]){
 for(const key of keys){
  const row=hasIndexedDB()?await readRecord(key):undefined;
  const chosen=choose(key,row,true);if(!validValue(key,chosen))throw unavailable();
  if(row)records.set(key,row);else records.delete(key);
 }
 const anchor=authorityKey(keys[0]);
 let latest:PendingRow|undefined;
 if(hasIndexedDB())latest=await readRecord(anchor);
 else{const raw=localValue(anchor);if(raw){try{latest=JSON.parse(raw)}catch{throw unavailable()}if(!validRow(latest))throw unavailable()}}
 if(latest)records.set(anchor,latest);else records.delete(anchor);
}
export async function writeExplanationPending(key:string,value:string|null,expectedIdentity?:string){
 if(value===null&&!expectedIdentity)throw persistError();
 const current=cachedExplanationPending(key),prior=records.get(key),localIdentity=identity(localValue(key));
 if(current&&identity(current)!==(value===null?expectedIdentity:identity(value)))return false;
 const ignoredLocalIdentity=localIdentity&&(localIdentity===prior?.clearedIdentity||localIdentity===prior?.ignoredLocalIdentity)?localIdentity:undefined;
 const row:PendingRow=value===null?{value:null,clearedIdentity:expectedIdentity!,...(ignoredLocalIdentity?{ignoredLocalIdentity}:{})}:{value,...(ignoredLocalIdentity?{ignoredLocalIdentity}:{})};
 const anchor=authorityKey(key);
 const conflicts=(saved:PendingRow|undefined)=>Boolean(saved&&(value===null?(saved.value!==null?identity(saved.value)!==expectedIdentity:saved.clearedIdentity!==expectedIdentity):saved.value!==null&&identity(saved.value)!==identity(value)));
 if(hasIndexedDB()){
  let conflict=false;
  try{
   await transact<void>('readwrite',store=>{
    const existing=store.get(key);existing.onsuccess=()=>{
     const latest=store.get(anchor);latest.onsuccess=()=>{
      if(conflicts(existing.result)||conflicts(latest.result)){conflict=true;store.transaction.abort();return}
      store.put(row,key);store.put(row,anchor);
     };
    };
   });
   const saved=await readRecord(key),latest=await readRecord(anchor);
   if(JSON.stringify(saved)!==JSON.stringify(row)||JSON.stringify(latest)!==JSON.stringify(row))throw persistError();
   records.set(key,row);records.set(anchor,row);
  }catch{if(conflict)return false;throw persistError()}
  // Only the matching legacy identity can be removed. Failed mirror writes do
  // not invalidate the committed IDB row or its exact terminal tombstone.
  try{if(value===null){if(identity(localStorage.getItem(key))===expectedIdentity)localStorage.removeItem(key)}else localStorage.setItem(key,value)}catch{}
 }else{
  try{
   const latestRaw=localValue(anchor),latest=latestRaw?JSON.parse(latestRaw):undefined;
   if(conflicts(latest))return false;
   if(value===null){if(identity(localStorage.getItem(key))!==expectedIdentity&&localStorage.getItem(key)!==null)return false;localStorage.removeItem(key)}else localStorage.setItem(key,value);
   localStorage.setItem(anchor,JSON.stringify(row));
   if(localStorage.getItem(key)!==value||localStorage.getItem(anchor)!==JSON.stringify(row))throw persistError();
   records.set(key,row);records.set(anchor,row);
  }catch{throw persistError()}
 }
 return true;
}
export const generationPendingKey=(id:string)=>`explanation-generation-pending-v1:${id}`;
export const replacementPendingKey=(id:string)=>`explanation-replacement-pending-v1:${id}`;
export async function hydrateQuestionExplanationPending(id:string){
 await hydrateExplanationPending([generationPendingKey(id),replacementPendingKey(id)]);
 if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('explanation-pending-hydrated',{detail:{id}}));
}
export async function matchesQuestionExplanationOperation(id:string,expectedIdentity:string){
 if(!expectedIdentity)return false;
 await hydrateQuestionExplanationPending(id);
 const keys=[generationPendingKey(id),replacementPendingKey(id)],latest=records.get(authorityKey(keys[0]));
 if(latest&&(latest.value!==null?identity(latest.value):latest.clearedIdentity)!==expectedIdentity)return false;
 if(keys.some(key=>{const value=cachedExplanationPending(key);return value&&identity(value)!==expectedIdentity}))return false;
 return keys.some(key=>identity(cachedExplanationPending(key))===expectedIdentity||records.get(key)?.clearedIdentity===expectedIdentity);
}
