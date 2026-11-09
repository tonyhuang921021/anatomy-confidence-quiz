'use strict';
// Shared server/display identity checks. No transport or Node-only imports.
const LICENSES=Object.freeze({'CC BY 4.0':'https://creativecommons.org/licenses/by/4.0/','CC BY-SA 4.0':'https://creativecommons.org/licenses/by-sa/4.0/','CC BY 3.0':'https://creativecommons.org/licenses/by/3.0/','CC BY-SA 3.0':'https://creativecommons.org/licenses/by-sa/3.0/','CC0':'https://creativecommons.org/publicdomain/zero/1.0/'});
function safePmcSource(value){try{const u=new URL(value);return u.protocol==='https:'&&u.hostname==='pmc.ncbi.nlm.nih.gov'&&!u.username&&!u.password&&!u.port&&!u.search&&/^\/articles\/PMC[0-9]+\/$/.test(u.pathname)&&/^#[A-Za-z_][A-Za-z0-9_.-]{0,127}$/.test(u.hash)}catch{return false}}
function safePmcImage(value){try{const u=new URL(value),m=/^\/(PMC[0-9]+\.[1-9][0-9]*)\/([A-Za-z0-9][A-Za-z0-9_.-]{0,180}\.(?:jpg|jpeg|png|webp))$/.exec(u.pathname);return u.protocol==='https:'&&u.hostname==='pmc-oa-opendata.s3.amazonaws.com'&&!u.username&&!u.password&&!u.port&&!u.hash&&m&&!m[2].includes('..')&&[...u.searchParams.keys()].length===1&&/^[a-f0-9]{32}$/.test(u.searchParams.get('md5')||'')?{version:m[1],filename:m[2],md5:u.searchParams.get('md5')}:null}catch{return null}}
function safeFigureSource(sourceUrl,licenseUrl,license){
 try{const source=new URL(sourceUrl),uri=new URL(licenseUrl);
  if([source,uri].some(u=>u.protocol!=='https:'||u.username||u.password||u.port)||source.search||uri.search||uri.hash)return false;
  if(license==='PDM 1.0')return source.hostname==='commons.wikimedia.org'&&!source.hash&&/^\/wiki\/File:[^?#]+\.(?:png|jpe?g|webp|svg)$/i.test(source.pathname)&&licenseUrl==='https://creativecommons.org/publicdomain/mark/1.0/';
  if(uri.href.replace(/\/?$/,'/')!==LICENSES[license])return false;
  return (source.hostname==='commons.wikimedia.org'&&!source.hash&&/^\/wiki\/File:[^/?#]+/.test(source.pathname))||safePmcSource(sourceUrl);
 }catch{return false}
}
module.exports={LICENSES,safePmcSource,safePmcImage,safeFigureSource};
