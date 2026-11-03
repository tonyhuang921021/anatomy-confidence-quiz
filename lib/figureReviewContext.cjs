'use strict';
const {createHash}=require('node:crypto');
const sha=x=>createHash('sha256').update(x).digest('hex');
function boundSection(text,item){
 if(typeof text!=='string'||sha(text)!==item.explanation_sha256)return null;
 const starts=[...text.matchAll(/^##[ \t]+(.+)$/gm)];
 const sections=starts.map((m,i)=>({heading:m[1].trim(),text:text.slice(m.index,starts[i+1]?.index??text.length).trim()}));
 const found=sections.filter(s=>sha(s.text)===item.section_sha256&&s.heading===item.section_heading);
 return found.length===1?found[0].text:null;
}
function exactReuse(target,source,targetText,sourceText){
 if(target.status!=='pending'||source.status!=='approved'||target.id===source.id||target.license==='PDM 1.0')return false;
 if(!boundSection(targetText,target)||!boundSection(sourceText,source))return false;
 for(const key of ['image_sha256','image_mime','section_sha256','section_heading','section_title','source_url','license','license_url','attribution'])if(!target[key]||target[key]!==source[key])return false;
 return Buffer.isBuffer(target.image_bytes)&&Buffer.isBuffer(source.image_bytes)&&target.image_bytes.equals(source.image_bytes)&&sha(source.image_bytes)===source.image_sha256;
}
module.exports={boundSection,exactReuse};
