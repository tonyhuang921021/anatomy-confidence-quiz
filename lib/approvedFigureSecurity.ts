export const figureIdPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function safeApprovedMeta(x:any){
 const paths:Record<string,string>={'CC BY 4.0':'/licenses/by/4.0/','CC BY-SA 4.0':'/licenses/by-sa/4.0/','CC BY 3.0':'/licenses/by/3.0/','CC BY-SA 3.0':'/licenses/by-sa/3.0/','CC0':'/publicdomain/zero/1.0/'};
 try{const source=new URL(x.source_url),license=new URL(x.license_url);return typeof x.id==='string'&&figureIdPattern.test(x.id)&&source.protocol==='https:'&&source.hostname==='commons.wikimedia.org'&&!source.username&&!source.password&&license.protocol==='https:'&&license.hostname==='creativecommons.org'&&!license.username&&!license.password&&license.pathname.replace(/\/?$/,'/')===paths[x.license]&&typeof x.attribution==='string'&&x.attribution.trim().length>0&&x.attribution.length<=500&&typeof x.section_title==='string'&&x.section_title.trim().length>0&&x.section_title.length<=80}catch{return false}
}
