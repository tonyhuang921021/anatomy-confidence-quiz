"use strict";
// No cache: a pause must be observed at each dispatch boundary. Read failures
// are image-only failures and must never cause paid text generation to retry.
async function figureCaptureAllowed(db, timeoutMs=1200) {
 if(!db || typeof db.from!=="function")return false;
 let timer;
 try {
  const result=await Promise.race([
   Promise.resolve().then(()=>db.from("figure_queue_config").select("enabled,capture_new").eq("id",true).maybeSingle()),
   new Promise(resolve=>{timer=setTimeout(()=>resolve(null),timeoutMs)})
  ]);
  return !result?.error && result?.data?.enabled===true && result?.data?.capture_new===true;
 }catch{return false}finally{clearTimeout(timer)}
}
function guardFigureTraffic(db,fn,windowAllowed=()=>true){
 return async(...args)=>{
  if(!windowAllowed() || !await figureCaptureAllowed(db) || !windowAllowed())throw Error("figure capture paused");
  return fn(...args);
 };
}
module.exports={figureCaptureAllowed,guardFigureTraffic};
