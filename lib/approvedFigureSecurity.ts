import {safeFigureSource} from "./figureSourceIdentity.cjs";
export const figureIdPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function safeApprovedMeta(x:any){
 try{return typeof x.id==='string'&&figureIdPattern.test(x.id)&&safeFigureSource(x.source_url,x.license_url,x.license)&&typeof x.attribution==='string'&&x.attribution.trim().length>0&&x.attribution.length<=500&&typeof x.section_title==='string'&&x.section_title.trim().length>0&&x.section_title.length<=80}catch{return false}
}
