'use strict';
const {safePmcSource,safePmcImage,safeFigureSource}=require('./figureSourceIdentity.cjs');
function classifySource(candidate){
 if(candidate?.license==='PDM 1.0')return 'manual_pdm_evidence_required';
 if(safePmcSource(candidate?.sourceUrl)){
  const media=safePmcImage(candidate.previewUrl),pmcid=new URL(candidate.sourceUrl).pathname.split('/')[2];
  return media&&media.version.startsWith(pmcid+'.')&&safeFigureSource(candidate.sourceUrl,candidate.licenseUrl,candidate.license)&&typeof candidate.attribution==='string'&&candidate.attribution.trim()&&candidate.attribution.length<=500?'pending_visual_review':'rejected_source';
 }
 const paths={'CC BY 4.0':'/licenses/by/4.0/','CC BY-SA 4.0':'/licenses/by-sa/4.0/','CC BY 3.0':'/licenses/by/3.0/','CC BY-SA 3.0':'/licenses/by-sa/3.0/','CC0':'/publicdomain/zero/1.0/'};
 try{
  const source=new URL(candidate.sourceUrl),image=new URL(candidate.previewUrl),license=new URL(candidate.licenseUrl);
  if([source,image,license].some(u=>u.protocol!=='https:'||u.username||u.password||u.port)||source.hostname!=='commons.wikimedia.org'||!/^\/wiki\/File:[^/?#]+/.test(source.pathname)||source.search||source.hash||!['upload.wikimedia.org','thumb.wikimedia.org'].includes(image.hostname)||image.search||image.hash||license.hostname!=='creativecommons.org'||license.search||license.hash||license.pathname!==paths[candidate.license]||typeof candidate.attribution!=='string'||!candidate.attribution.trim()||candidate.attribution.length>500)return 'rejected_source';
  return 'pending_visual_review';
 }catch{return 'rejected_source'}
}
function normalizeCommonsCandidate(candidate){
 try{const image=new URL(candidate.previewUrl),license=new URL(candidate.licenseUrl);
 if(image.protocol!=='https:'||!['upload.wikimedia.org','thumb.wikimedia.org'].includes(image.hostname)||image.username||image.password||image.port)return candidate;
 if([...image.searchParams.keys()].some(k=>!['utm_source','utm_campaign','utm_content'].includes(k)))return candidate;
 image.search='';
 if(license.protocol!=='https:'||license.hostname!=='creativecommons.org'||license.search||license.hash||license.username||license.password||license.port)return candidate;
 license.pathname=license.pathname.replace(/\/?$/,'/');
 return {...candidate,previewUrl:image.href,licenseUrl:license.href};
 }catch{return candidate}
}
module.exports={classifySource,normalizeCommonsCandidate};
