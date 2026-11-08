export type GenerationPending={operationId:string;startedAt:number};
const key=(id:string)=>`explanation-generation-pending-v1:${id}`;
export function pendingGeneration(id:string):GenerationPending|null{
 try{const v=JSON.parse(localStorage.getItem(key(id))||'null');return v&&typeof v.operationId==='string'&&/^[0-9a-f-]{36}$/i.test(v.operationId)&&Number.isFinite(v.startedAt)?v:null}catch{return null}
}
export function setPendingGeneration(id:string,value:GenerationPending|null){
 // If storage is unavailable, do not start a request whose identity cannot survive navigation.
 if(value){localStorage.setItem(key(id),JSON.stringify(value));if(localStorage.getItem(key(id))!==JSON.stringify(value))throw Error('無法保存請求識別，未開始生成。')}
 else localStorage.removeItem(key(id));
}
export async function recoverGeneration(id:string,token?:string){
 const pending=pendingGeneration(id);if(!pending||!token)return null;
 const r=await fetch('/api/explanation-generation',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({questionId:id,operationId:pending.operationId})});
 if(!r.ok)return null;const data=await r.json();
 if(data.ok&&data.status==='completed'&&typeof data.value?.explanation==='string'){setPendingGeneration(id,null);return {ok:true,sharedSaved:true,...data.value}}
 if(data.ok&&data.status==='not_written'){setPendingGeneration(id,null);return {ok:false,closed:true,code:'generation_not_written',message:'先前生成已結束，沒有寫入或替換詳解。'}}
 // Missing/unknown/temporary errors are never proof that dispatch did not occur.
 return null;
}
