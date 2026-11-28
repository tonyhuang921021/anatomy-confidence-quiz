'use strict';
const {createHash}=require('node:crypto');
const sha=value=>createHash('sha256').update(value).digest('hex');
const sourceId='MOEX-C217-094042-S5001-STAGE1-Q020';
const sourceCrop='/question-media/moex-94-1-stage1-med2/MOEX-C217-094042-S5001-STAGE1-Q020.webp';
// Visual review of the official crop: complete text-only Q20, no figure or visual choices.
// Match the exact trusted transcription, official source and crop identity. Never use client/OCR hints.
function hasUnresolvedPrimaryImage(q){
 if(Object.values(q.optionImages??{}).some(Boolean))return true;
 if(!q.stemImage)return false;
 return !(q.id===sourceId &&
  q.sourceType==='MOEX_PAST_EXAM' &&
  q.stemImage===sourceCrop && q.officialSource?.image===sourceCrop &&
  q.officialSource?.questionUrl==='https://wwwq.moex.gov.tw/exam/wHandExamQandA_File.ashx?t=Q&code=094042&c=217&s=5001&q=1' &&
  sha(q.stem)==='a7b6bbbb3ff1a2ef13d06db8e999251cb502e2213645f6bbcef30288a98f12df' &&
  sha(JSON.stringify(q.options))==='2a28a3aea381135b454e9b72bdd0ba87bbadb6b6df0320269bfae86f9f312af0' &&
  q.answer==='A' && q.answerCreditType==='standard' &&
  q.acceptedAnswers?.length===1 && q.acceptedAnswers[0]==='A');
}
module.exports={hasUnresolvedPrimaryImage};
