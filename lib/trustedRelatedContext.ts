import type { Question, OptionKey } from '@/types/quiz';
import { buildRelatedQuestionIndex, getRelatedQuestions } from '@/lib/relatedQuestions';
import { CURATED } from '@/lib/reviewedRelatedLinks';

// Internal teaching context only: these links do not feed public recommendation UI.
const TEACHING_LINKS: typeof CURATED = {
  // Exact drug/target, virus and cell-type matches reviewed in the canonical
  // corpus. Keep source stems and official scoring (including negation) intact;
  // a same-subject label or a shared distractor is not sufficient evidence.
  'MOEX-100030-2101-Q059': {sourceFragment:'治療乳癌藥物',sourceAnswer:'B',links:[
    {id:'MOEX-109020-2301-Q026',expectedAnswer:'A',stemFragments:['trastuzumab','breast cancer']}
  ]},
  'MOEX-105100-5301-Q055': {sourceFragment:'不屬於腸病毒屬',sourceAnswer:'B',links:[
    {id:'MOEX-113020-2301-Q015',expectedAnswer:'A',stemFragments:['托育中心','水瀉並嘔吐']},
    {id:'MOEX-097050-1101-Q054',expectedAnswer:'A',stemFragments:['Rotavirus','Norwalk']}
  ]},
  'MOEX-100030-2101-Q076': {sourceFragment:'Alzheimer 第二型星狀細胞',sourceAnswer:'C',links:[
    {id:'MOEX-C101-095140-S2001-HIGHGENERAL-Q099',expectedAnswer:'A',stemFragments:['Alzheimer typeⅡ','何者無關']}
  ]},
};

// High-precision anchors, not subject names or neighboring question numbers.
// Extend only with independently reviewed clinical concept/synonym groups.
const CONCEPTS: readonly (readonly string[])[] = [
  ['髖關節','臀關節','hip joint'], ['屈曲','屈肌','flexion'], ['伸展','伸肌','extension'],
  ['黑色素','melanin','melanocyte'], ['酵素','酶','tyrosinase'], ['紫外線','日曬','陽光','曬太陽','ultraviolet'],
  ['血液','血漿','blood','plasma'], ['淋巴','lymph'], ['結締組織','connective tissue'],
  ['胰島素','insulin'], ['葡萄糖','glucose'], ['甲狀腺','thyroid'], ['腎上腺','adrenal'],
  ['膽固醇','cholesterol'], ['脂蛋白','lipoprotein'], ['肝臟','肝細胞','hepatocyte'],
  ['腎小球','glomerul'], ['腎小管','renal tubule'], ['抗體','immunoglobulin','antibody'],
  ['抗原','antigen'], ['細菌','bacteri'], ['病毒','virus','viral'], ['受體','receptor'],
  ['鈣離子','calcium'], ['鉀離子','potassium'], ['鈉離子','sodium'], ['神經肌肉','neuromuscular'],
  ['粒線體','mitochondri'], ['細胞凋亡','apoptosis'], ['血小板','platelet'], ['凝血','coagulation'],
  ['白血球','leukocyte'], ['巨噬細胞','macrophage'], ['淋巴球','lymphocyte'], ['發炎','inflammation'],
  ['細胞週期','cell cycle'], ['細胞膜','cell membrane'], ['基因突變','mutation'], ['基因轉錄','transcription'],
  ['腫瘤','tumor','tumour'], ['血管','blood vessel'], ['心肌','myocard'], ['肺泡','alveol'],
  ['神經傳導物','neurotransmitter'], ['血壓','blood pressure'], ['肌肉','muscle'], ['骨骼','skeletal'],
];
function normalize(value: string) { return value.normalize('NFKC').toLowerCase(); }
function matchedConcepts(text: string): Set<number> {
  const value=normalize(text); const out=new Set<number>();
  CONCEPTS.forEach((aliases,i)=>{if(aliases.some(alias=>value.includes(normalize(alias)))) out.add(i)});
  return out;
}
function acceptedKeys(q: Question): OptionKey[] {
  if (q.answerCreditType === 'all_credit') return [];
  const keys=(q.acceptedAnswers?.length ? q.acceptedAnswers : [q.answer]).filter((key): key is OptionKey => typeof key==='string');
  return keys.length>0 && keys.every(key=>/^[A-E]$/.test(key) && Boolean(q.options?.[key]?.trim())) ? keys : [];
}
function focusedText(q:Question,keys:OptionKey[]) {return [q.stem,...keys.map(k=>q.options[k])].join(' ')}

// Generic text evidence complements the reviewed synonym anchors. Never let a
// subject/tag or matching distractor alone authorize background context.
const TEXT_STOP=/下列|何者|正確|錯誤|敘述|關於|何項|何種|有關|存在|產生|影響|之一/;
const LATIN_STOP=new Set(['which','following','correct','incorrect','about','with','that','this','from','other','enzyme','cells','cell','protein','receptor','blood','dehydrogenase','synthase','kinase','phosphatase','activity','concentration','vmax','kcat','nerve','artery','vein','muscle','joint','membrane','nucleus','factor','chain','cycle']);
function evidenceTerms(text:string) {
 const value=normalize(text).replace(/[性型](?=抑制)/g,'').replace(/[的為之可會與及和是則但而且所該其]/g,' '); const out=new Set<string>();
 for(const m of value.matchAll(/\b[a-z][a-z0-9-]{3,}\b/g))if(!LATIN_STOP.has(m[0]))out.add(m[0]);
 for(const m of value.matchAll(/[\u3400-\u9fff]{4,}/g))for(let n=4;n<=Math.min(7,m[0].length);n++)for(let i=0;i+n<=m[0].length;i++){const term=m[0].slice(i,i+n);if(!TEXT_STOP.test(term))out.add(term)}
 return out;
}
function textSupported(current:Question,candidate:Question,currentKeys:OptionKey[],keys:OptionKey[]) {
 const currentTerms=evidenceTerms(focusedText(current,currentKeys)),other=evidenceTerms(focusedText(candidate,keys)),stem=evidenceTerms(current.stem);
 const shared=[...currentTerms].filter(t=>other.has(t)).sort((a,b)=>b.length-a.length);
 const independent:string[]=[];
 for(const term of shared)if(!independent.some(t=>t.includes(term)||term.includes(t)))independent.push(term);
 const answerTerms=new Set([...evidenceTerms(currentKeys.map(k=>current.options[k]).join(' '))].filter(t=>![...stem].some(s=>t.includes(s)||s.includes(t))));
 const answerSupported=!answerTerms.size||[...answerTerms].some(t=>other.has(t));
 return independent.length>=2&&independent.some(t=>stem.has(t))&&answerSupported;
}
function identity(q:Question){return normalize(q.stem).replace(/\s+/g,'')+'\u0000'+Object.values(q.options||{}).filter(Boolean).map(v=>normalize(v!).replace(/\s+/g,'')).sort().join('|')}
const conflictsCache=new WeakMap<readonly Question[],Set<string>>();
function conflictingContent(corpus:readonly Question[]) {
 const cached=conflictsCache.get(corpus);if(cached)return cached;
 const answers=new Map<string,string>(),bad=new Set<string>();
 for(const q of corpus){if(q.sourceType!=='MOEX_PAST_EXAM')continue;const id=identity(q),keys=acceptedKeys(q).map(k=>normalize(q.options[k]||'').replace(/\s+/g,'')).sort().join('|');if(!keys)continue;const previous=answers.get(id);if(previous&&previous!==keys)bad.add(id);else answers.set(id,keys)}
 conflictsCache.set(corpus,bad);return bad;
}
function isUsableOfficial(q: Question, conflictingIds: ReadonlySet<string>): boolean {
  return q.needsHumanReview!==true && q.answerConfidence!=='low' && !conflictingIds.has(q.id) && !/待核|無法辨識|缺漏/.test((q.officialSource?.transcriptionNotice||'')+' '+(q.officialSource?.displayNotice||'')) && q.sourceType==='MOEX_PAST_EXAM' && Boolean(q.stem?.trim()) &&
    !/^\s*[（(【\[]?\s*承上題/.test(q.stem) && !q.stemImage && !Object.values(q.optionImages??{}).some(Boolean) && acceptedKeys(q).length>0;
}
export function findTrustedRelatedQuestions(current: Question, corpus: readonly Question[], conflictingIds: ReadonlySet<string>, limit=3): Question[] {
  const currentKeys=acceptedKeys(current); const contentConflicts=conflictingContent(corpus); if (!currentKeys.length||conflictingIds.has(current.id)||contentConflicts.has(identity(current))) return [];
  const curated=TEACHING_LINKS[current.id]??CURATED[current.id];
  let reviewed: Question[] = [];
  if(curated) {
    if(currentKeys.length!==1 || currentKeys[0]!==curated.sourceAnswer || !normalize(current.stem).includes(normalize(curated.sourceFragment))) return [];
    const byId = new Map(corpus.map(q=>[q.id,q]));
    reviewed = curated.links.flatMap(link=>{
      const q=byId.get(link.id); if(!q || (!isUsableOfficial(q,conflictingIds)||contentConflicts.has(identity(q)))) return [];
      const keys=acceptedKeys(q);
      if(keys.length!==1 || keys[0]!==link.expectedAnswer || !link.stemFragments.every(fragment=>normalize(q.stem).includes(normalize(fragment)))) return [];
      return [q];
    });
  }
  const max = Math.max(0, Math.min(limit, 3));
  if (reviewed.length >= max) return reviewed.slice(0,max);
  const stemConcepts=matchedConcepts(current.stem);
  const answerConcepts=matchedConcepts(currentKeys.map(k=>current.options[k]).join(' '));
  const focus=matchedConcepts(focusedText(current,currentKeys)); 
  const seen=new Set<string>(reviewed.map(identity)), candidates:{q:Question;score:number}[]=[];
  // Reuse the website ranking, then apply the stricter server-side evidence checks.
  const ranked = getRelatedQuestions(current, buildRelatedQuestionIndex(corpus as Question[]), corpus.length);
  const rankedIds = new Set(ranked.map(item => item.id));
  // Preserve existing high-precision concept fallback when the website ranking misses synonyms.
  const candidatesInOrder = focus.size>=2 ? [...ranked, ...corpus.filter(item => !rankedIds.has(item.id))] : ranked;
  for(const q of candidatesInOrder) {
    if(q.id===current.id || q.subject!==current.subject || reviewed.some(item=>item.id===q.id) || (!isUsableOfficial(q,conflictingIds)||contentConflicts.has(identity(q)))) continue;
    const keys=acceptedKeys(q);
    const concepts=matchedConcepts(focusedText(q,keys)); let score=0; for(const x of focus) if(concepts.has(x)) score++;
    const stemMatch=[...stemConcepts].some(x=>concepts.has(x));
    const answerMatch=!answerConcepts.size || [...answerConcepts].some(x=>concepts.has(x));
    const reviewedAnchors=score>=2&&stemMatch&&answerMatch;
    const genericEvidence=rankedIds.has(q.id)&&textSupported(current,q,currentKeys,keys);
    if(!reviewedAnchors&&!genericEvidence)continue;
    const fingerprint=identity(q);
    if(seen.has(fingerprint)) continue;seen.add(fingerprint); candidates.push({q,score});
    if(reviewed.length+candidates.length>=max)break;
  }
  return [...reviewed, ...candidates.map(x=>x.q)].slice(0,max);
}
