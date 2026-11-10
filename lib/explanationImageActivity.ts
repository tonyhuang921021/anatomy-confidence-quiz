// Read-only presentation of the exact saved explanation's image job.
// A missing image or an old `awaiting_image` value alone is never progress.
export type ImageActivity = {phase:'queued'|'searching'|'reviewing'|'stopped'|'budget_blocked'|'complete';ttlMs:number;limitKind?:'daily_search'|'downloads'|'download_bytes'|'new_jobs'};
export function imageActivityForJob(job:any,hasFigure:boolean,now=Date.now(),capacity?:any):ImageActivity|null {
 if(hasFigure)return {phase:'complete',ttlMs:0};
 if(!job)return null;
 // awaiting_budget was historically also used for locks, leases and paused
 // capture. Only current authoritative capacity can support quota wording.
 if(job.state==='done'&&job.image_status==='awaiting_budget'&&capacity?.mode==='taipei_daily_v1'){
  const limitKind=capacity.searchExhausted===true?'daily_search':capacity.downloadExhausted===true?'downloads':capacity.downloadBytesExhausted===true?'download_bytes':null;
  if(limitKind)return {phase:'budget_blocked',ttlMs:0,limitKind};
 }
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
 if(activity.phase==='budget_blocked')return {active:false,
  label:activity.limitKind==='daily_search'?'詳解已完成，今日找圖額度已達上限':'詳解已完成，圖片下載額度已達上限',
  caption:activity.limitKind==='daily_search'?'搜尋以台灣時間每日 00:00 換日計算。已停止的工作不會自動重送，詳解已保存。':'搜尋次數與圖片下載額度分開計算。找圖目前停止，詳解已保存。'};
 return {active:false,label:'詳解已完成，配圖暫未完成',caption:'目前沒有可顯示的配圖，處理已停止。已保留狀態；未確認的請求不會自動重送。'};
}
