'use strict';
const {runOne,createQueue}=require('./durableFigureWorker.cjs');
const {createRepository}=require('./figureReviewAdapter.cjs');
const {commonsSearch,readBoundedImage}=require('./localFigureDiscovery.cjs');
function captureEnabled(env,url){
 if(env.NODE_ENV==='production')return env.FIGURE_REVIEW_ENABLED==='1'&&env.FIGURE_REVIEW_QUEUE_CAPTURE==='1';
 try{const u=new URL(url);return env.LOCAL_FIGURE_DURABLE_QUEUE==='1'&&u.protocol==='http:'&&['localhost','127.0.0.1'].includes(u.hostname)}catch{return false}
}
function scheduleFigureWorker({env,db,waitUntil,run=runOne,report=()=>{}}){
 if(env.FIGURE_REVIEW_ENABLED!=='1'||env.FIGURE_REVIEW_WORKER_ENABLED!=='1'||!db||typeof waitUntil!=='function')return false;
 // At most one leased item per authenticated existing cron invocation. The
 // durable lease survives a function timeout and is reclaimed on a later tick.
 const task=Promise.resolve().then(()=>run({queue:createQueue(db),repository:createRepository(db),search:commonsSearch,loadImage:readBoundedImage})).catch(()=>{report('figure_worker_unavailable')});
 try{waitUntil(task);return true}catch{task.catch(()=>{});return false}
}
module.exports={captureEnabled,scheduleFigureWorker};
