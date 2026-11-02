'use strict';
const crypto=require('node:crypto');const {validate}=require('./figureReviewService.cjs');
const MANUAL_PDM_QUESTION_ID='MOEX-100030-1101-Q003';
const MANUAL_PDM_IMAGE_SHA='8ba98dd824b009e08d7cc0e95d5b7891bfe2b29eb7f84e6b083e374c42f3aace';
const PDM='https://creativecommons.org/publicdomain/mark/1.0/';
function prepareManualPdm({actor,questionId,explanation,bytes,mime,sourceUrl,imageUrl,markUrl,attribution,sectionTitle,expectedImageSha,sourceConfirmed,markConfirmed,imageConfirmed}){
 if(questionId!==MANUAL_PDM_QUESTION_ID||expectedImageSha!==MANUAL_PDM_IMAGE_SHA)throw Error('out of scope');
 if(!actor?.verifiedAdminId||sourceConfirmed!==true||markConfirmed!==true||imageConfirmed!==true)throw Error('owner evidence confirmation required');
 if(markUrl!==PDM||!/^([0-9a-f]{64})$/.test(expectedImageSha||''))throw Error('invalid evidence');
 let source,image;try{source=new URL(sourceUrl);image=new URL(imageUrl)}catch{throw Error('invalid evidence URL')}
 if(source.protocol!=='https:'||source.hostname!=='commons.wikimedia.org'||source.port||source.username||source.password||source.search||source.hash||!/^\/wiki\/File:[^/?#]+\.(?:png|jpe?g|webp)$/i.test(source.pathname))throw Error('invalid source');
 if(image.protocol!=='https:'||image.hostname!=='upload.wikimedia.org'||image.port||image.username||image.password||image.search||image.hash||!/^\/wikipedia\/commons\/[0-9a-f]\/[0-9a-f]{2}\/[^/?#]+\.(?:png|jpe?g|webp)$/i.test(image.pathname))throw Error('invalid original image URL');
 let sourceName,imageName;try{sourceName=decodeURIComponent(source.pathname.slice('/wiki/File:'.length));imageName=decodeURIComponent(image.pathname.split('/').pop())}catch{throw Error('invalid filename')}
 if(sourceName.includes('/')||imageName.includes('/')||sourceName.replace(/_/g,' ')!==imageName.replace(/_/g,' '))throw Error('source and image mismatch');
 const filename=imageName.replace(/ /g,'_'),digest=crypto.createHash('md5').update(filename,'utf8').digest('hex'),parts=image.pathname.split('/');
 if(parts[3]!==digest[0]||parts[4]!==digest.slice(0,2))throw Error('invalid Commons file path');
 if(!Buffer.isBuffer(bytes)||crypto.createHash('sha256').update(bytes).digest('hex')!==expectedImageSha)throw Error('image hash mismatch');
 const row=validate({questionId,explanation,bytes,mime,sourceUrl,licenseUrl:PDM,license:'PDM 1.0',attribution,sectionTitle});
 return {...row,pdm_image_url:image.href,pdm_evidence_by:actor.verifiedAdminId};
}
module.exports={prepareManualPdm,PDM,MANUAL_PDM_QUESTION_ID,MANUAL_PDM_IMAGE_SHA};
