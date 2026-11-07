'use strict';
const {createHash}=require('node:crypto');
const sha=s=>createHash('sha256').update(s).digest('hex');
// No transport/provider dependency here. Caller rechecks existing runtime/window.
function dispatchReplacementImages({enabled,outcome,operationId,question,schedule,processImages}){
 const value=outcome?.value;
 if(!enabled||outcome?.status!==200||outcome.code!=='replaced'||!value?.figureQueued||
 value.replacementRevision!==operationId||typeof value.explanation!=='string'||
 value.figureTextHash!==sha(value.explanation)||!question?.id)return false;
 // Once only at known durable success. No retry when commit/close is unknown.
 try{schedule(Promise.resolve().then(()=>processImages({question,requestId:operationId,explanationHash:value.figureTextHash})).catch(()=>({status:'awaiting_image'})));return true;}
 catch{return false;}
}
module.exports={dispatchReplacementImages,sha};
