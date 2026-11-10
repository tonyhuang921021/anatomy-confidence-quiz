const {test}=require('node:test'),assert=require('node:assert/strict');const {commonsSearch,readBoundedImage}=require('../lib/commonsFigureSource.cjs');
const response=s=>new Response(s,{headers:{'content-type':'application/json'}});
test('metadata search bounded and fixed host; never accepts redirects',async()=>{let called;assert.deepEqual(await commonsSearch('carotid sheath anatomy',async(url,options)=>{called={url,options};return response('{"query":{"pages":[]}}')}),[]);assert.equal(new URL(called.url).hostname,'commons.wikimedia.org');assert.equal(called.options.redirect,'error');await assert.rejects(commonsSearch('carotid sheath anatomy',async()=>response(' '.repeat(262145))))});
test('download refuses external host and non-raster bytes',async()=>{let calls=0;await assert.rejects(readBoundedImage('https://evil.invalid/a',async()=>{calls++}));assert.equal(calls,0);await assert.rejects(readBoundedImage('https://upload.wikimedia.org/a.png',async()=>new Response('<svg>',{headers:{'content-type':'image/png'}})))});
const policy=require('../lib/figureSourcePolicy.cjs');
test('Commons tracking metadata normalizes without permitting arbitrary query parameters',()=>{const c={sourceUrl:'https://commons.wikimedia.org/wiki/File:Cycle.svg',previewUrl:'https://thumb.wikimedia.org/path.png?utm_source=commons.wikimedia.org&utm_campaign=imageinfo',licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0',license:'CC BY-SA 4.0',attribution:'Author'};const n=policy.normalizeCommonsCandidate(c);assert.equal(n.previewUrl,'https://thumb.wikimedia.org/path.png');assert.equal(policy.classifySource(n),'pending_visual_review');assert.equal(policy.classifySource(policy.normalizeCommonsCandidate({...c,previewUrl:c.previewUrl+'&token=private'})),'rejected_source')});

function page(n,license='CC BY 4.0'){
 return {title:'File:Medical-'+n+'.png',imageinfo:[{mime:'image/png',url:'https://upload.wikimedia.org/medical-'+n+'.png',descriptionurl:'https://commons.wikimedia.org/wiki/File:Medical-'+n+'.png',extmetadata:{Artist:{value:'Fixture Author'},LicenseShortName:{value:license},LicenseUrl:{value:license==='Public domain'?'https://creativecommons.org/publicdomain/mark/1.0/':'https://creativecommons.org/licenses/by/4.0/'}}}]};
}
test('ten bounded metadata results are source-filtered before choosing three',async()=>{
 let requested,diagnostic;
 const pages=[page(1,'Public domain'),{title:'File:Missing'},page(3,'Copyright'),page(4),page(5),page(6),page(7)];
 const result=await commonsSearch('medical concept',async url=>{requested=new URL(url);return response(JSON.stringify({query:{pages}}))},d=>diagnostic=d);
 assert.equal(requested.searchParams.get('gsrlimit'),'10');assert.equal(requested.searchParams.get('iiextmetadatafilter'),'LicenseUrl|LicenseShortName|Artist');
 assert.deepEqual(result.map(x=>x.title),['File:Medical-4.png','File:Medical-5.png','File:Medical-6.png']);
 assert.equal(diagnostic.reasons.manual_pdm_evidence_required,1);assert.equal(diagnostic.eligible,4);assert.doesNotMatch(JSON.stringify(diagnostic),/Author|http|File:/);
});
test('Commons over-limit or error responses never become a confirmed empty search',async()=>{
 await assert.rejects(commonsSearch('medical concept',async()=>response(JSON.stringify({query:{pages:Array.from({length:11},(_,i)=>page(i))}}))),/too many pages/);
 await assert.rejects(commonsSearch('medical concept',async()=>response('{"error":{"code":"upstream"}}')),/API error/);
});
