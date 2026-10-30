import type { Question, OptionKey } from '@/types/quiz';
import { buildRelatedQuestionIndex, getRelatedQuestions } from '@/lib/relatedQuestions';

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

type CuratedLink = { id: string; expectedAnswer: OptionKey; stemFragments: readonly string[] };
// Independently reviewed concept links. Each target must still match its source text and scoring data.
const CURATED: Readonly<Record<string, {sourceFragment:string; sourceAnswer:OptionKey; links:readonly CuratedLink[]}>> = {
  'MOEX-C217-091030-S4004-STAGE1-Q001': {sourceFragment:'臀關節的屈曲動作',sourceAnswer:'B',links:[
    {id:'MOEX-114090-1301-Q028',expectedAnswer:'D',stemFragments:['大腿前肌群','何動作']}
  ]},
  'MOEX-114090-1301-Q028': {sourceFragment:'大腿前肌群',sourceAnswer:'D',links:[
    {id:'MOEX-C217-091030-S4004-STAGE1-Q001',expectedAnswer:'B',stemFragments:['臀關節的屈曲動作']}
  ]},
  'MOEX-C217-091030-S4004-STAGE1-Q002': {sourceFragment:'陽光照射下皮膚會變黑',sourceAnswer:'D',links:[
    {id:'MOEX-101030-2101-Q048',expectedAnswer:'A',stemFragments:['黑色素合成','曬太陽']}
  ]},
  'MOEX-C217-091030-S4004-STAGE1-Q003': {sourceFragment:'血液與淋巴屬於',sourceAnswer:'B',links:[
    {id:'MOEX-106100-1301-Q038',expectedAnswer:'D',stemFragments:['纖維軟骨','規則緻密結締組織']},
    {id:'MOEX-098140-1101-Q037',expectedAnswer:'D',stemFragments:['結締組織中','製造並分泌基質']}
  ]}
};
function isUsableOfficial(q: Question, conflictingIds: ReadonlySet<string>): boolean {
  return !conflictingIds.has(q.id) && q.sourceType==='MOEX_PAST_EXAM' && Boolean(q.stem?.trim()) &&
    !/^\s*[（(【\[]?\s*承上題/.test(q.stem) && !q.stemImage && !Object.values(q.optionImages??{}).some(Boolean) && acceptedKeys(q).length>0;
}
export function findTrustedRelatedQuestions(current: Question, corpus: readonly Question[], conflictingIds: ReadonlySet<string>, limit=3): Question[] {
  const currentKeys=acceptedKeys(current); if (!currentKeys.length) return [];
  const curated=CURATED[current.id];
  let reviewed: Question[] = [];
  if(curated) {
    if(currentKeys.length!==1 || currentKeys[0]!==curated.sourceAnswer || !normalize(current.stem).includes(normalize(curated.sourceFragment))) return [];
    const byId = new Map(corpus.map(q=>[q.id,q]));
    reviewed = curated.links.flatMap(link=>{
      const q=byId.get(link.id); if(!q || !isUsableOfficial(q,conflictingIds)) return [];
      const keys=acceptedKeys(q);
      if(keys.length!==1 || keys[0]!==link.expectedAnswer || !link.stemFragments.every(fragment=>normalize(q.stem).includes(normalize(fragment)))) return [];
      return [q];
    });
  }
  const max = Math.max(0, Math.min(limit, 3));
  if (reviewed.length >= max) return reviewed.slice(0,max);
  const stemConcepts=matchedConcepts(current.stem);
  const answerConcepts=matchedConcepts(currentKeys.map(k=>current.options[k]).join(' '));
  const focus=matchedConcepts(focusedText(current,currentKeys)); if(focus.size<2 || !stemConcepts.size) return reviewed.slice(0,max);
  const seen=new Set<string>(), candidates:{q:Question;score:number}[]=[];
  // Reuse the website ranking, then apply the stricter server-side evidence checks.
  const ranked = getRelatedQuestions(current, buildRelatedQuestionIndex(corpus as Question[]), corpus.length);
  const rankedIds = new Set(ranked.map(item => item.id));
  // Preserve existing high-precision concept fallback when the website ranking misses synonyms.
  const candidatesInOrder = [...ranked, ...corpus.filter(item => !rankedIds.has(item.id))];
  for(const q of candidatesInOrder) {
    if(q.id===current.id || reviewed.some(item=>item.id===q.id) || !isUsableOfficial(q,conflictingIds)) continue;
    const keys=acceptedKeys(q);
    const concepts=matchedConcepts(focusedText(q,keys)); let score=0; for(const x of focus) if(concepts.has(x)) score++;
    const stemMatch=[...stemConcepts].some(x=>concepts.has(x));
    const answerMatch=!answerConcepts.size || [...answerConcepts].some(x=>concepts.has(x));
    if(score<2 || !stemMatch || !answerMatch) continue;
    const fingerprint=normalize(q.stem)+'\u0000'+keys.map(k=>normalize(q.options[k]??'')).sort().join('\u0000');
    if(seen.has(fingerprint)) continue;seen.add(fingerprint); candidates.push({q,score});
  }
  return [...reviewed, ...candidates.map(x=>x.q)].slice(0,max);
}
