import {safeFigureSource} from "./figureSourceIdentity.cjs";
export const figureIdPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// This exact immutable candidate was publicly approved with a misleading caption.
// Withdrawal is presentation-only; keep saved text, source bytes, and the original audit.
const withdrawnPublicFigure = '4d44a0ba-a6fa-4175-8634-eee2dfbfc899'; // SHA-256 03768bfaa35beb8d12fd5bb0228f9db2960ea5553c1d9013eddbc69336ad2526
export function isWithdrawnApprovedFigure(id:unknown){
 return typeof id==='string'&&id.toLowerCase()===withdrawnPublicFigure;
}
export function safeApprovedMeta(x:any){
 try{return typeof x.id==='string'&&figureIdPattern.test(x.id)&&safeFigureSource(x.source_url,x.license_url,x.license)&&typeof x.attribution==='string'&&x.attribution.trim().length>0&&x.attribution.length<=500&&typeof x.section_title==='string'&&x.section_title.trim().length>0&&x.section_title.length<=80}catch{return false}
}
