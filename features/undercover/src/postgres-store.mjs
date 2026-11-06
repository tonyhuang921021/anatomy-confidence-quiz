// Inject a SERVER-ONLY RPC transport after schema approval. No env/key lookup here.
// CAS conflicts are known-not-applied and may be recomputed. A transport exception
// is an UNKNOWN write outcome and is never silently retried.
export class PostgresStore {
 constructor({rpc,approved=false}={}){if(typeof rpc!=='function')throw Error('RPC_REQUIRED');this.rpc=rpc;this.productionReady=approved;}
 async read(fn){const row=await this.rpc('undercover_state_read_v1',{});return structuredClone(fn(row.payload));}
 async transaction(fn){for(let n=0;n<5;n++){const row=await this.rpc('undercover_state_read_v1',{}),next=structuredClone(row.payload),value=fn(next);const result=await this.rpc('undercover_state_cas_v1',{p_expected:row.revision,p_payload:next});if(result.applied)return structuredClone(value);}throw Error('GAME_STORE_BUSY');}
}
