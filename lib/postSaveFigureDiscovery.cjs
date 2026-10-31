'use strict';
// Candidate selection is deliberately separate from publication. It must be
// called only after a newly generated explanation is durably committed.
const MAX_SECTIONS = 3;
const MAX_QUERY_LENGTH = 80;
function figureQueries(explanation) {
  if (typeof explanation !== 'string') return [];
  return [...new Set(explanation.split(/\r?\n/).map(x => x.match(/^#{2,4}\s+(.+?)\s*$/)?.[1]?.replace(/[*_`\[\]<>]/g,'').trim())
    .filter(x => x && x.length >= 3 && x.length <= MAX_QUERY_LENGTH))].slice(0,MAX_SECTIONS);
}
function publicHttps(value) {
  try { const u=new URL(value); return u.protocol==='https:' && !u.username && !u.password; } catch { return false; }
}
function eligibleMetadata(candidate) {
  const licensePaths={'CC BY 4.0':'/licenses/by/4.0/','CC BY-SA 4.0':'/licenses/by-sa/4.0/','CC BY 3.0':'/licenses/by/3.0/','CC BY-SA 3.0':'/licenses/by-sa/3.0/','CC0':'/publicdomain/zero/1.0/'};
  if (!candidate || typeof candidate.title!=='string' || !candidate.title.trim() || typeof candidate.attribution!=='string' || !candidate.attribution.trim() || !publicHttps(candidate.sourceUrl) || !publicHttps(candidate.licenseUrl)) return false;
  const expected=licensePaths[candidate.license]; if(!expected)return false;
  const license=new URL(candidate.licenseUrl);return license.hostname==='creativecommons.org' && license.pathname.replace(/\/?$/, '/')===expected;
}
async function discoverAfterSaved({outcome, search}) {
  if (outcome?.status!==200 || outcome.code!=='inserted' || !outcome.value?.explanation) return {status:'not_started',candidates:[]};
  // A complete comparison table is required before searching for visuals.
  if (!/^\s*\|.+\|\s*\n\s*\|\s*:?-{3,}/m.test(outcome.value.explanation)) return {status:'no_table',candidates:[]};
  const queries=figureQueries(outcome.value.explanation); if(!queries.length) return {status:'no_queries',candidates:[]};
  if(typeof search!=='function') return {status:'search_unavailable',candidates:[]};
  const candidates=[];
  for(const query of queries) {
    try { const found=await search(query); if(!Array.isArray(found)) continue;
      for(const item of found.slice(0,5)) if(eligibleMetadata(item)) candidates.push({...item,query,reviewStatus:'needs_visual_review'});
    } catch { /* Preserve committed explanation; never retry generation. */ }
  }
  return {status:candidates.length?'pending_visual_review':'no_candidates',candidates};
}
module.exports={figureQueries,eligibleMetadata,discoverAfterSaved};
