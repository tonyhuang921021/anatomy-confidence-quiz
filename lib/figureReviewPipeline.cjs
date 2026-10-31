'use strict';
const {discoverAfterSaved}=require('./postSaveFigureDiscovery.cjs');
const {commonsSearch,readBoundedImage}=require('./localFigureDiscovery.cjs');
const {stage}=require('./figureReviewService.cjs');
const {createRepository}=require('./figureReviewAdapter.cjs');
async function afterCommitted({outcome,questionId,db,search=commonsSearch,loadImage=readBoundedImage}){
 if(outcome?.status!==200||outcome.code!=='inserted')return {status:'not_started',count:0};
 const found=await discoverAfterSaved({outcome,search});if(!found.candidates.length)return {status:found.status,count:0};
 const repo=createRepository(db);let count=0;
 for(const item of found.candidates.slice(0,3))try{
  const image=await loadImage(item.previewUrl),mime=image.ext==='jpg'?'image/jpeg':image.ext==='png'?'image/png':image.ext==='webp'?'image/webp':'';
  await stage({candidate:{questionId,explanation:outcome.value.explanation,bytes:image.bytes,mime,sourceUrl:item.sourceUrl,licenseUrl:item.licenseUrl,license:item.license,attribution:item.attribution,sectionTitle:item.query},repository:repo,readCommitted:repo.readCommitted});count++;
 }catch{/* Saved text stays unchanged; a candidate may be unavailable or stale. */}
 return {status:count?'saved_pending_review':'no_saved_candidates',count};
}
module.exports={afterCommitted};
