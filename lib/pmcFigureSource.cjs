'use strict';
const {pmcSearchExpression,coreMedicalTerm}=require('./medicalImageQuery.cjs');
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
class PmcMetadataError extends Error {
 constructor(code,status){super(code);this.code=code;if(Number.isInteger(status)&&status>=100&&status<=599)this.httpStatus=status;}
}
function metadataFailure(error){
 // External error text can contain request URLs, headers or response bodies.
 // Emit only a fixed classification and an optional numeric HTTP status.
 if(error instanceof PmcMetadataError)return {code:error.code,...(error.httpStatus?{httpStatus:error.httpStatus}:{})};
 if(error?.name==='TimeoutError'||error?.name==='AbortError')return {code:'metadata_timeout'};
 if(error instanceof SyntaxError)return {code:'metadata_parse_failed'};
 return {code:'metadata_processing_failed'};
}
async function requestBytes(url,fetcher=fetch,max=2*1024*1024){
 const u=new URL(url);if(u.protocol!=='https:'||u.username||u.password||u.port||u.hash||!['www.ebi.ac.uk',HOST].includes(u.hostname))throw new PmcMetadataError('metadata_host_rejected');
 let response;
 try{response=await fetcher(u.href,{signal:AbortSignal.timeout(6000),redirect:'error'})}catch(error){
  if(error?.name==='TimeoutError'||error?.name==='AbortError')throw new PmcMetadataError('metadata_timeout');
  throw new PmcMetadataError('metadata_network_failed');
 }
 if(!response.ok){await response.body?.cancel().catch(()=>{});throw new PmcMetadataError('metadata_http_failed',response.status)}
 if(!response.body)throw new PmcMetadataError('metadata_body_missing');
 if(Number(response.headers.get('content-length')||0)>max){await response.body.cancel().catch(()=>{});throw new PmcMetadataError('metadata_too_large')}
 const reader=response.body.getReader(),chunks=[];let size=0;
 try{while(true){const p=await reader.read();if(p.done)break;size+=p.value.length;if(size>max)throw new PmcMetadataError('metadata_too_large');chunks.push(Buffer.from(p.value))}}
 catch(error){if(error instanceof PmcMetadataError)throw error;if(error?.name==='TimeoutError'||error?.name==='AbortError')throw new PmcMetadataError('metadata_timeout');throw new PmcMetadataError('metadata_body_failed')}
 finally{await reader.cancel().catch(()=>{});reader.releaseLock()}
 return Buffer.concat(chunks);
}
const DISCOVERY_WORDS=new Set(['diagram','illustration','schematic','overview','mechanism','pathway','histology','figure','image','and','of','the']);
function relevantArticleScore(article,query){
 const effective=(coreMedicalTerm(query)||query).replace(/\b(?:citric acid|krebs) cycle\b/g,'tca cycle');
 const words=effective.split(/[ -]+/),terms=[...new Set(words.filter(x=>x&&!DISCOVERY_WORDS.has(x)))];
 const canonical=value=>typeof value==='string'?value.toLowerCase().replace(/\b(?:citric acid|krebs) cycle\b/g,'tca cycle'):'';
 const title=canonical(article.title),abstract=canonical(article.abstractText);
 if(!terms.length||!title&&!abstract)return 0;
 const present=(content,term)=>new RegExp('\\b'+term+'(?:s|es)?\\b','i').test(content);
 const content=title+' '+abstract;
 // Single letters distinguish hepatitis B/C and T/B-cell receptors. Bind
 // the letter to its adjacent medical word rather than matching any letter.
 for(const [i,term]of words.entries())if(term.length===1){
  const phrase=i>0?words[i-1]+' '+term:term+' '+(words[i+1]||'');
  if(!present(content,phrase.replace(/ /g,'[ -]+')))return 0;
 }
 const matches=terms.filter(term=>present(content,term)).length;
 // Avoid spending one of three visual reviews on a completely unrelated
 // article. This is only a retrieval filter, never an image-fit decision.
 const required=terms.length===1?1:Math.max(2,Math.ceil(terms.length/2));
 if(matches<required||!present(title+' '+abstract,terms[0]))return 0;
 return matches+terms.filter(term=>present(title,term)).length*3+(title.includes(query)?10:0);
}
function searchArticles(raw,query,onDiagnostic){
 const data=JSON.parse(raw);if(!data?.resultList||!Array.isArray(data.resultList.result))throw Error('invalid discovery response');
 const rows=data.resultList.result;if(rows.length>10)throw Error('too many discovery results');
 const reasons={},eligible=[];
 for(const [index,x]of rows.entries()){
  let reason=null;
  if(!PMCID.test(x.pmcid||''))reason='missing_pmcid';
  else if(x.isOpenAccess!=='Y'||!/^(?:cc[- ]by(?:[- ]sa)?|cc0)$/i.test(x.license||''))reason='source_rights_ineligible';
  const score=query?relevantArticleScore(x,query):1;
  if(!reason&&score===0)reason=!x.title&&!x.abstractText?'topic_metadata_missing':'topic_not_established';
  if(reason){reasons[reason]=(reasons[reason]||0)+1;continue}
  eligible.push({pmcid:x.pmcid,score,index});
 }
 const selected=eligible.sort((a,b)=>b.score-a.score||a.index-b.index).filter((x,i,a)=>a.findIndex(y=>y.pmcid===x.pmcid)===i).slice(0,2).map(x=>({pmcid:x.pmcid}));
 if(typeof onDiagnostic==='function')onDiagnostic({received:rows.length,eligible:eligible.length,selected:selected.length,reasons});
 return selected;
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
function resolveGraphicMedia(graphics,media){
 if(!Array.isArray(graphics)||!graphics.length||graphics.some(x=>typeof x!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,180}$/.test(x)||x.includes('..')))return [];
 const matches=[];
 for(const ref of new Set(graphics)){
  const exact=media.filter(x=>x.filename===ref);
  const found=exact.length?exact:ref.includes('.')?[]:media.filter(x=>x.filename.replace(/\.(?:jpg|jpeg|png|webp)$/i,'')===ref);
  if(found.length!==1)return [];
  matches.push(found[0]);
 }
 return [...new Set(matches)];
}
function jatsFigures(raw,facts,onDiagnostic){
 const diagnostic={policy:'jats-selection-v1',figures:0,selected:0,reasons:{}};
 const reject=reason=>{diagnostic.reasons[reason]=(diagnostic.reasons[reason]||0)+1};
 const finish=(result,reason)=>{if(reason)reject(reason);diagnostic.selected=result.length;if(typeof onDiagnostic==='function')onDiagnostic(diagnostic);return result};
 const article=parseXml(raw).article;if(!article||typeof article!=='object')return finish([],'missing_article');
 const meta=article.front?.['article-meta'];if(!meta)return finish([],'missing_article_meta');
 const ids=list(meta['article-id']).filter(x=>['pmc','pmcid'].includes(x?.['@_pub-id-type'])).map(x=>plain(x));
 if(ids.length!==1||ids[0].replace(/^PMC/,'')!==facts.pmcid.slice(3))return finish([],'article_identity_mismatch');
 const versionIds=list(meta['article-id']).filter(x=>x?.['@_pub-id-type']==='pmcid-ver').map(x=>plain(x));
 if(versionIds.length!==1||versionIds[0]!==facts.version)return finish([],'version_identity_mismatch');
 if(/except|unless|third[- ]party|separate permission|not covered|exclud|prohibit|\brestrict|no redistribution/i.test(text(meta.permissions)))return finish([],'article_rights_exception');
 const license=licenseOf(meta.permissions);if(!license)return finish([],'article_license_unproven');
 const family=license==='CC0'?'CC0':license.startsWith('CC BY-SA')?'CC BY-SA':'CC BY';if(family!==facts.licenseCode)return finish([],'manifest_license_mismatch');
 const title=plain(meta['title-group']?.['article-title'],100);
 const authorList=collect(meta,'contrib').filter(x=>x?.['@_contrib-type']==='author').map(x=>plain(x.name||x['string-name'],60)).filter(Boolean);
 const authors=plain(authorList.slice(0,3).join(', '),100)+(authorList.length>3?' et al.':'');
 const copyright=plain(meta.permissions?.['copyright-statement'],500);
 if(!title||!authors||copyright.length>120)return finish([],'attribution_incomplete_or_oversize');
 const figures=[...scopedFigures(article.body,license),...scopedFigures(article['floats-group'],license)],idsSeen=new Map();for(const fig of figures){const id=fig?.['@_id'];idsSeen.set(id,(idsSeen.get(id)||0)+1)}
 diagnostic.figures=figures.length;if(!figures.length)reject('no_scoped_figures');
 const result=[];
 for(const fig of figures){
  const id=fig?.['@_id'];if(!FIGID.test(id||'')||idsSeen.get(id)!==1){reject('figure_id_ambiguous');continue}
  const caption=plain(fig.caption,160),label=plain(fig.label,25);if(!caption){reject('caption_missing');continue}
  if(collect(fig,'attrib').length||collect(fig,'credit').length){reject('figure_credit_requires_review');continue}
  if(/reproduc|adapted|reprint|permission|copyright|courtesy|©/i.test(text(fig))){reject('figure_rights_requires_review');continue}
  const scoped=collect(fig,'permissions');if(scoped.some(x=>licenseOf(x)!==license)){reject('figure_license_mismatch');continue}
  const graphics=collect(fig,'graphic').map(x=>x?.['@_xlink:href']||x?.['@_href']).filter(x=>typeof x==='string');
  // JATS permits extensionless local graphic references. Resolve only a
  // unique exact filename/stem inside this verified manifest, never a path,
  // URL, prefix guess, or a different article/version.
  const media=resolveGraphicMedia(graphics,facts.media);
  if(media.length!==1){reject('graphic_manifest_binding_missing_or_ambiguous');continue}
  // The persisted candidate has a 500-character attribution bound. Keep source
  // witnesses intact instead of silently truncating a digest at the end.
  const witness=`${facts.version}, retrieved ${facts.retrievedOn}; JATS ${hash(raw)}; manifest ${facts.manifestHash}; image ${media[0].md5}; NLM source, no endorsement.`;
  const credit=`${authors}.${copyright?' '+copyright+'.':''}`;
  if(credit.length+1>499-witness.length){reject('attribution_witness_oversize');continue}
  const detail=plain(`${title}. ${label}: ${caption}.`,498-witness.length-credit.length);
  const attribution=credit+' '+detail+' '+witness;
  result.push({title:`${title}. ${label}: ${caption}`,attribution,license,licenseUrl:LICENSES[license],sourceUrl:`https://pmc.ncbi.nlm.nih.gov/articles/${facts.pmcid}/#${id}`,previewUrl:media[0].url});
  if(result.length===3)break;
 }
 return finish(result);
}
function envelope(kind,identity,value){const result=[{kind,identity,value}];if(Buffer.byteLength(JSON.stringify(result))>12000)throw Error('metadata cache too large');return result}
function unpack(value,kind,identity){if(!Array.isArray(value)||value.length!==1||value[0]?.kind!==kind||value[0]?.identity!==identity)throw Error('metadata cache binding invalid');return value[0].value}
// readMetadata owns the atomic cap/cache reservation for EACH HTTP. A failure
// throws through the worker; no hidden retry or alternate source is dispatched.
async function discoverPmcFigures(query,readMetadata,fetcher=fetch,{excludedSources=[]}={}){
 if(!Array.isArray(excludedSources)||excludedSources.length>3||excludedSources.some(x=>!safePmcSource(x)))throw Error('invalid source exclusions');
 if(typeof query!=='string'||! /^[a-z][a-z -]{1,89}$/.test(query)||query.split(' ').length>8)throw Error('query rejected');
 const cached=async(kind,identity,load)=>unpack(await readMetadata(`pmc-figure-v1:${kind}:${identity}`,async()=>{
  const started=Date.now();
  try{return envelope(kind,identity,await load())}
  catch(error){console.warn('pmc_metadata_failed',{kind,...metadataFailure(error),elapsedMs:Math.max(0,Date.now()-started)});throw error}
 }),kind,identity);
 const articles=await cached('search',query,async()=>{
  const u=new URL('https://www.ebi.ac.uk/europepmc/webservices/rest/search');u.searchParams.set('query',pmcSearchExpression(query));u.searchParams.set('format','json');u.searchParams.set('pageSize','10');u.searchParams.set('resultType','core');return searchArticles((await requestBytes(u.href,fetcher,262144)).toString('utf8'),query,diagnostic=>console.info('pmc_discovery_result',diagnostic));
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
  const derived=await cached('jats',`${version}:${facts.manifestHash}:${facts.xml.md5}`,async()=>{const bytes=await requestBytes(facts.xml.url,fetcher);if(hash(bytes,'md5')!==facts.xml.md5)throw Error('JATS digest mismatch');let diagnostic;const candidates=jatsFigures(bytes.toString('utf8'),facts,value=>{diagnostic=value});console.info('pmc_jats_selection',diagnostic);return {jatsSha256:hash(bytes),candidates,diagnostic}});
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
module.exports={discoverPmcFigures,safePmcSource,safePmcImage,searchArticles,relevantArticleScore,versions,manifestFacts,jatsFigures,resolveGraphicMedia,parseXml,licenseOf,LICENSES,requestBytes,metadataFailure,hash};
