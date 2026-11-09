'use strict';
const {XMLParser,XMLValidator}=require('fast-xml-parser');
const {createHash}=require('node:crypto');
const hash=(value,algorithm='sha256')=>createHash(algorithm).update(value).digest('hex');
const HOST='pmc-oa-opendata.s3.amazonaws.com';
const {LICENSES,safePmcSource,safePmcImage}=require('./figureSourceIdentity.cjs');
const PMCID=/^PMC[0-9]+$/;
const VERSION=/^PMC[0-9]+\.[1-9][0-9]*$/;
const FIGID=/^[A-Za-z_][A-Za-z0-9_.-]{0,127}$/;
const list=v=>v===undefined||v===null?[]:Array.isArray(v)?v:[v];
function decodeXmlText(value){
 return value.replace(/&(?:amp|lt|gt|quot|apos|#x[0-9a-f]+|#[0-9]+);/gi,m=>{
  if(m[1]!=='#')return ({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'"})[m]||m;
  const code=m[2].toLowerCase()==='x'?Number.parseInt(m.slice(3,-1),16):Number(m.slice(2,-1));
  if(!Number.isInteger(code)||code<1||code>0x10ffff||(code>=0xd800&&code<=0xdfff))throw Error('invalid XML character');
  return String.fromCodePoint(code);
 });
}
function text(value){
 if(typeof value==='string'||typeof value==='number')return decodeXmlText(String(value));
 if(Array.isArray(value))return value.map(text).join(' ');
 if(!value||typeof value!=='object')return '';
 return Object.entries(value).filter(([k])=>!k.startsWith('@_')).map(([,v])=>text(v)).join(' ');
}
function plain(value,max=500){return text(value).replace(/&(?:amp|lt|gt|quot|apos);/g,m=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'"})[m]).replace(/\s+/g,' ').trim().slice(0,max)}
function collect(node,key,out=[]){if(!node||typeof node!=='object')return out;for(const [k,v] of Object.entries(node)){if(k===key)out.push(...list(v));if(!k.startsWith('@_'))for(const x of list(v))collect(x,key,out)}return out}
function parseXml(raw){
 if(typeof raw!=='string'||Buffer.byteLength(raw)>2*1024*1024||/<!ENTITY|<!DOCTYPE[^>]*\[|<\s*(?:xi:include|xinclude)\b/i.test(raw)||/&(?!(?:amp|lt|gt|quot|apos);)[A-Za-z][\w.-]*;/.test(raw))throw Error('unsupported XML');
 // No entity expansion, network DTD or XInclude processing. Bound structure
 // before parsing as well as bytes, including XML from cached public sources.
 let depth=0,count=0;
 for(const m of raw.matchAll(/<\/?[A-Za-z_][^>]*>/g)){
  if(++count>25000)throw Error('XML too complex');
  if(m[0].startsWith('</'))depth--;else if(!m[0].endsWith('/>'))depth++;
  if(depth<0||depth>64)throw Error('XML too deep');
 }
 if(XMLValidator.validate(raw)!==true)throw Error('invalid XML');
 return new XMLParser({ignoreAttributes:false,processEntities:false,parseTagValue:false,parseAttributeValue:false,trimValues:true,maxNestedTags:64}).parse(raw);
}
function manifestUrl(value,version,extension){
 if(typeof value!=='string'||!VERSION.test(version))return null;
 try{const u=new URL(value);if(u.protocol!=='s3:'||u.hostname!=='pmc-oa-opendata'||u.username||u.password||u.port||u.hash||!u.pathname.startsWith('/'+version+'/'))return null;
  const filename=u.pathname.slice(version.length+2);
  if(!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,180}$/.test(filename)||filename.includes('..')||!extension.test(filename)||[...u.searchParams.keys()].length!==1||!/^[a-f0-9]{32}$/.test(u.searchParams.get('md5')||''))return null;
  return {url:'https://'+HOST+u.pathname+u.search,filename,md5:u.searchParams.get('md5')};
 }catch{return null}
}
async function requestBytes(url,fetcher=fetch,max=2*1024*1024){
 const u=new URL(url);if(u.protocol!=='https:'||u.username||u.password||u.port||u.hash||!['www.ebi.ac.uk',HOST].includes(u.hostname))throw Error('metadata host rejected');
 const response=await fetcher(u.href,{signal:AbortSignal.timeout(6000),redirect:'error'});
 if(!response.ok||!response.body||Number(response.headers.get('content-length')||0)>max)throw Error('metadata unavailable');
 const reader=response.body.getReader(),chunks=[];let size=0;
 try{while(true){const p=await reader.read();if(p.done)break;size+=p.value.length;if(size>max)throw Error('metadata too large');chunks.push(Buffer.from(p.value))}}finally{await reader.cancel().catch(()=>{});reader.releaseLock()}
 return Buffer.concat(chunks);
}
function searchArticles(raw){
 const data=JSON.parse(raw);if(!data?.resultList||!Array.isArray(data.resultList.result))throw Error('invalid discovery response');
 return data.resultList.result.filter(x=>PMCID.test(x.pmcid||'')&&x.isOpenAccess==='Y'&&/^(?:cc[- ]by(?:[- ]sa)?|cc0)$/i.test(x.license||'')).slice(0,2).map(x=>({pmcid:x.pmcid}));
}
function versions(raw,pmcid){
 const root=parseXml(raw).ListBucketResult;if(!root||root.IsTruncated!=='false')return [];
 const values=list(root.CommonPrefixes).map(x=>x.Prefix).filter(x=>typeof x==='string'&&new RegExp('^'+pmcid+'\\.[1-9][0-9]*/$').test(x));
 // Never assume .1, or choose the highest number as the applicable version.
 return values.length===1?[values[0].slice(0,-1)]:[];
}
function manifestFacts(raw,pmcid,version){
 const data=JSON.parse(raw);
 if(!VERSION.test(version)||!version.startsWith(pmcid+'.')||data.pmcid!==pmcid||data.version!==Number(version.split('.')[1])||data.is_retracted!==false||data.is_manuscript!==false||data.is_pmc_openaccess!==true||!['CC BY','CC BY-SA','CC0'].includes(data.license_code))return null;
 const xml=manifestUrl(data.xml_url,version,/\.xml$/);
 if(!xml||xml.filename!==version+'.xml'||!Array.isArray(data.media_urls)||data.media_urls.length>500)return null;
 const media=data.media_urls.map(x=>manifestUrl(x,version,/\.(?:jpg|jpeg|png|webp)$/)).filter(Boolean);
 if(new Set(media.map(x=>x.filename)).size!==media.length)return null;
 // Cap stored metadata; ambiguous/oversized articles are skipped, not paged.
 if(media.length>20)return null;
 return {pmcid,version,licenseCode:data.license_code,xml,media,manifestHash:hash(raw),retrievedOn:new Date().toISOString().slice(0,10)};
}
function licenseOf(permissions){
 const urls=[];
 function links(n){if(!n||typeof n!=='object')return;for(const[k,v]of Object.entries(n)){if((k==='@_xlink:href'||k==='@_href')&&typeof v==='string')urls.push(v);else if(/^(?:[A-Za-z_][\w.-]*:)?license_ref$/.test(k))urls.push(plain(v));else if(!k.startsWith('@_'))for(const x of list(v))links(x)}}
 links(permissions);
 const canonical=[...new Set(urls.filter(x=>typeof x==='string'&&/^https?:\/\/creativecommons\.org\//.test(x)).map(x=>x.replace(/^http:/,'https:').replace(/\/?$/,'/')))];
 // An ALI license_ref marked textmining alone is not republication permission.
 // The article/figure license paragraph must itself grant a recognized CC license.
 const prose=plain(collect(permissions,'license-p'),3000);
 const namesLicense=/Creative Commons|\bCC0\b/i.test(prose)||canonical.some(url=>prose.includes(url)||prose.includes(url.replace(/^https:/,'http:')));
 const grantsReuse=/distributed|licensed|available|released|dedicated/i.test(prose)||/\bpermits?\b[\s\S]{0,80}\buse\b[\s\S]{0,40}\bdistribution\b[\s\S]{0,40}\breproduction\b/i.test(prose);
 if(canonical.length!==1||!namesLicense||!grantsReuse||/non[- ]commercial|no[- ]derivatives|\bTDM\b|all rights reserved|exclud|prohibit|\brestrict|no redistribution|not (?:permitted|allowed|covered)/i.test(text(permissions)))return null;
 return Object.keys(LICENSES).find(x=>LICENSES[x]===canonical[0])||null;
}
function scopedFigures(node,license,out=[]){
 if(!node||typeof node!=='object')return out;
 if(node.permissions&&licenseOf(node.permissions)!==license)return out;
 // Separate articles/supplements can have their own rightsholders. Do not
 // inherit the parent article's permission across those boundaries.
 for(const [key,value] of Object.entries(node)){
  if(key.startsWith('@_')||['sub-article','response','supplementary-material'].includes(key))continue;
  for(const child of list(value)){
   if(key==='fig'){if(!child?.permissions||licenseOf(child.permissions)===license)out.push(child)}
   else scopedFigures(child,license,out);
  }
 }
 return out;
}
function jatsFigures(raw,facts){
 const article=parseXml(raw).article;if(!article||typeof article!=='object')return [];
 const meta=article.front?.['article-meta'];if(!meta)return [];
 const ids=list(meta['article-id']).filter(x=>['pmc','pmcid'].includes(x?.['@_pub-id-type'])).map(x=>plain(x));
 if(ids.length!==1||ids[0].replace(/^PMC/,'')!==facts.pmcid.slice(3))return [];
 const versionIds=list(meta['article-id']).filter(x=>x?.['@_pub-id-type']==='pmcid-ver').map(x=>plain(x));
 if(versionIds.length!==1||versionIds[0]!==facts.version)return [];
 if(/except|unless|third[- ]party|separate permission|not covered|exclud|prohibit|\brestrict|no redistribution/i.test(text(meta.permissions)))return [];
 const license=licenseOf(meta.permissions);if(!license)return [];
 const family=license==='CC0'?'CC0':license.startsWith('CC BY-SA')?'CC BY-SA':'CC BY';if(family!==facts.licenseCode)return [];
 const title=plain(meta['title-group']?.['article-title'],100);
 const authorList=collect(meta,'contrib').filter(x=>x?.['@_contrib-type']==='author').map(x=>plain(x.name||x['string-name'],60)).filter(Boolean);
 const authors=plain(authorList.slice(0,3).join(', '),100)+(authorList.length>3?' et al.':'');
 const copyright=plain(meta.permissions?.['copyright-statement'],500);
 if(!title||!authors||copyright.length>120)return [];
 const figures=[...scopedFigures(article.body,license),...scopedFigures(article['floats-group'],license)],idsSeen=new Map();for(const fig of figures){const id=fig?.['@_id'];idsSeen.set(id,(idsSeen.get(id)||0)+1)}
 const result=[];
 for(const fig of figures){
  const id=fig?.['@_id'];if(!FIGID.test(id||'')||idsSeen.get(id)!==1)continue;
  const caption=plain(fig.caption,160),label=plain(fig.label,25);if(!caption)continue;
  if(collect(fig,'attrib').length||collect(fig,'credit').length)continue;
  if(/reproduc|adapted|reprint|permission|copyright|courtesy|©/i.test(text(fig)))continue;
  const scoped=collect(fig,'permissions');if(scoped.some(x=>licenseOf(x)!==license))continue;
  const graphics=collect(fig,'graphic').map(x=>x?.['@_xlink:href']||x?.['@_href']).filter(x=>typeof x==='string');
  const media=facts.media.filter(x=>graphics.includes(x.filename));if(media.length!==1)continue;
  // The persisted candidate has a 500-character attribution bound. Keep source
  // witnesses intact instead of silently truncating a digest at the end.
  const witness=`${facts.version}, retrieved ${facts.retrievedOn}; JATS ${hash(raw)}; manifest ${facts.manifestHash}; image ${media[0].md5}; NLM source, no endorsement.`;
  const credit=`${authors}.${copyright?' '+copyright+'.':''}`;
  if(credit.length+1>499-witness.length)continue;
  const detail=plain(`${title}. ${label}: ${caption}.`,498-witness.length-credit.length);
  const attribution=credit+' '+detail+' '+witness;
  result.push({title:`${title}. ${label}: ${caption}`,attribution,license,licenseUrl:LICENSES[license],sourceUrl:`https://pmc.ncbi.nlm.nih.gov/articles/${facts.pmcid}/#${id}`,previewUrl:media[0].url});
  if(result.length===3)break;
 }
 return result;
}
function envelope(kind,identity,value){const result=[{kind,identity,value}];if(Buffer.byteLength(JSON.stringify(result))>12000)throw Error('metadata cache too large');return result}
function unpack(value,kind,identity){if(!Array.isArray(value)||value.length!==1||value[0]?.kind!==kind||value[0]?.identity!==identity)throw Error('metadata cache binding invalid');return value[0].value}
// readMetadata owns the atomic cap/cache reservation for EACH HTTP. A failure
// throws through the worker; no hidden retry or alternate source is dispatched.
async function discoverPmcFigures(query,readMetadata,fetcher=fetch,{excludedSources=[]}={}){
 if(!Array.isArray(excludedSources)||excludedSources.length>3||excludedSources.some(x=>!safePmcSource(x)))throw Error('invalid source exclusions');
 if(typeof query!=='string'||! /^[a-z][a-z -]{1,89}$/.test(query)||query.split(' ').length>8)throw Error('query rejected');
 const cached=async(kind,identity,load)=>unpack(await readMetadata(`pmc-figure-v1:${kind}:${identity}`,async()=>envelope(kind,identity,await load())),kind,identity);
 const articles=await cached('search',query,async()=>{
  const u=new URL('https://www.ebi.ac.uk/europepmc/webservices/rest/search');u.searchParams.set('query',`(${query}) AND OPEN_ACCESS:Y`);u.searchParams.set('format','json');u.searchParams.set('pageSize','3');u.searchParams.set('resultType','core');return searchArticles((await requestBytes(u.href,fetcher,262144)).toString('utf8'));
 });
 if(!Array.isArray(articles)||articles.length>2)throw Error('invalid article cache');
 for(const a of articles){
  if(!PMCID.test(a?.pmcid||''))throw Error('invalid article identity');
  const vs=await cached('versions',a.pmcid,async()=>{const u=new URL('https://'+HOST+'/');u.searchParams.set('list-type','2');u.searchParams.set('prefix',a.pmcid+'.');u.searchParams.set('delimiter','/');u.searchParams.set('max-keys','5');return versions((await requestBytes(u.href,fetcher,32768)).toString('utf8'),a.pmcid)});
  if(!Array.isArray(vs)||vs.length>1)throw Error('invalid version cache');if(!vs.length)continue;const version=vs[0];if(!VERSION.test(version)||!version.startsWith(a.pmcid+'.'))throw Error('version mismatch');
  const facts=await cached('manifest',version,async()=>manifestFacts((await requestBytes(`https://${HOST}/${version}/${version}.json`,fetcher,262144)).toString('utf8'),a.pmcid,version));
  if(!facts)continue;
  const cachedXml=manifestUrl(facts.xml?.url?.replace('https://'+HOST,'s3://pmc-oa-opendata'),version,/\.xml$/);
  if(facts.pmcid!==a.pmcid||facts.version!==version||!cachedXml||cachedXml.filename!==version+'.xml'||cachedXml.filename!==facts.xml.filename||cachedXml.md5!==facts.xml.md5||!['CC BY','CC BY-SA','CC0'].includes(facts.licenseCode)||!/^[a-f0-9]{64}$/.test(facts.manifestHash||'')||!/^\d{4}-\d{2}-\d{2}$/.test(facts.retrievedOn||'')||!Array.isArray(facts.media)||facts.media.length>20||new Set(facts.media.map(m=>m?.filename)).size!==facts.media.length)throw Error('manifest cache mismatch');
  for(const media of facts.media){const parsed=safePmcImage(media?.url);if(!parsed||parsed.version!==version||parsed.filename!==media.filename||parsed.md5!==media.md5)throw Error('manifest media cache mismatch')}
  // The provider can revise a version in place. Bind the derived result to the
  // precise manifest and JATS bytes, not only the PMCID/version label.
  const derived=await cached('jats',`${version}:${facts.manifestHash}:${facts.xml.md5}`,async()=>{const bytes=await requestBytes(facts.xml.url,fetcher);if(hash(bytes,'md5')!==facts.xml.md5)throw Error('JATS digest mismatch');return {jatsSha256:hash(bytes),candidates:jatsFigures(bytes.toString('utf8'),facts)}});
  const candidates=derived?.candidates;
  if(!/^[a-f0-9]{64}$/.test(derived?.jatsSha256||'')||!Array.isArray(candidates)||candidates.length>3)throw Error('invalid figure cache');
  for(const c of candidates){
   const media=facts.media.find(m=>m.url===c?.previewUrl);
   const family=c?.license==='CC0'?'CC0':c?.license?.startsWith('CC BY-SA')?'CC BY-SA':c?.license?.startsWith('CC BY ')?'CC BY':null;
   if(!safePmcSource(c?.sourceUrl)||!c.sourceUrl.startsWith(`https://pmc.ncbi.nlm.nih.gov/articles/${a.pmcid}/#`)||safePmcImage(c.previewUrl)?.version!==version||!media||family!==facts.licenseCode||LICENSES[c.license]!==c.licenseUrl||typeof c.attribution!=='string'||c.attribution.length>500||![version,facts.manifestHash,derived.jatsSha256,media.md5,facts.retrievedOn].every(s=>c.attribution.includes(s)))throw Error('figure cache binding mismatch');
  }
  const unseen=candidates.filter(c=>!excludedSources.includes(c.sourceUrl));
  if(unseen.length)return unseen;
 }
 return [];
}
module.exports={discoverPmcFigures,safePmcSource,safePmcImage,searchArticles,versions,manifestFacts,jatsFigures,parseXml,licenseOf,LICENSES,requestBytes,hash};
