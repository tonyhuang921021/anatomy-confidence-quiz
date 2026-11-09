// Read-only presentation of the exact saved explanation's image job.
// A missing image or an old `awaiting_image` value alone is never progress.
export type ImageActivity = {phase:'queued'|'searching'|'reviewing'|'stopped'|'complete';ttlMs:number};
export function imageActivityForJob(job:any,hasFigure:boolean,now=Date.now()):ImageActivity|null {
 if(hasFigure)return {phase:'complete',ttlMs:0};
 if(!job)return null;
 if(job.state==='pending')return {phase:'queued',ttlMs:0};
 const remaining=Date.parse(job.lease_until||'')-now;
 // Only an acknowledged short-lived search marker is activity evidence.
 // A leftover lease or a pending visual decision is not a running worker.
 const runtimeRemaining=Date.parse(job.updated_at||'')+15_000-now;
 if(job.state==='leased'&&job.image_status==='searching'&&remaining>0&&runtimeRemaining>0)return {phase:'searching',ttlMs:Math.min(15_000,remaining,runtimeRemaining)};
 return {phase:'stopped',ttlMs:0};
}
export function imageActivityCopy(activity:ImageActivity|null|undefined,receivedAt:number,now=Date.now()) {
 if(!activity||activity.phase==='complete')return null;
 const live=(activity.phase==='searching'||activity.phase==='reviewing')&&Number.isFinite(activity.ttlMs)&&activity.ttlMs>0&&now-receivedAt<Math.min(15_000,activity.ttlMs);
 if(live)return {active:true,label:activity.phase==='reviewing'?'正在確認配圖':'詳解已完成，還在找圖',caption:'可以先閱讀詳解，圖片確認後會出現。'};
 if(activity.phase==='queued')return {active:false,label:'詳解已完成，配圖待處理',caption:'尚未開始找圖，可以先閱讀詳解。'};
 return {active:false,label:'詳解已完成，配圖暫未完成',caption:'目前沒有可顯示的配圖。已保留結果，不會自動重送未確認的搜尋。'};
}
