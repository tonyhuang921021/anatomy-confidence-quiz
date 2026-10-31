'use strict';
// Local development only. Optional bounded polling can be restarted after a
// crash; production scheduling requires a separately reviewed deployment.
const {createClient}=require('@supabase/supabase-js');
const {createQueue,runOne}=require('../lib/durableFigureWorker.cjs');
const {createRepository}=require('../lib/figureReviewAdapter.cjs');
const {commonsSearch,readBoundedImage}=require('../lib/localFigureDiscovery.cjs');
async function runLoop(run,{cycles=1,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),report=console.log}={}){
 if(!Number.isInteger(cycles)||cycles<1||cycles>20)throw Error('invalid local cycle count');
 for(let i=0;i<cycles;i++){try{report(JSON.stringify(await run()))}catch{report(JSON.stringify({status:'worker_unavailable'}))}if(i+1<cycles)await wait(15000)}
}
async function main(env=process.env,args=process.argv.slice(2)){
 let endpoint;try{endpoint=new URL(env.NEXT_PUBLIC_SUPABASE_URL)}catch{throw Error('local database URL required')}
 if(env.NODE_ENV==='production'||env.LOCAL_FIGURE_DURABLE_QUEUE!=='1'||env.FIGURE_REVIEW_ENABLED!=='1'||endpoint.protocol!=='http:'||!['localhost','127.0.0.1'].includes(endpoint.hostname)||!env.SUPABASE_SERVICE_ROLE_KEY)throw Error('local-only worker is disabled');
 const db=createClient(endpoint.href,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 await runLoop(()=>runOne({queue:createQueue(db),repository:createRepository(db),search:commonsSearch,loadImage:readBoundedImage}),{cycles:args.includes('--watch')?20:1});
}
if(require.main===module)main().catch(()=>{console.error('local worker unavailable; lease remains held until expiry');process.exitCode=1});
module.exports={main,runLoop};
