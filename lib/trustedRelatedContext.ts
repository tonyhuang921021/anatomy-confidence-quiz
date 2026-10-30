import type { Question, OptionKey } from '@/types/quiz';

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
export function findTrustedRelatedQuestions(current: Question, corpus: readonly Question[], conflictingIds: ReadonlySet<string>, limit=3): Question[] {
  const currentKeys=acceptedKeys(current); if (!currentKeys.length) return [];
  const stemConcepts=matchedConcepts(current.stem);
  const answerConcepts=matchedConcepts(currentKeys.map(k=>current.options[k]).join(' '));
  const focus=matchedConcepts(focusedText(current,currentKeys)); if(focus.size<2 || !stemConcepts.size) return [];
  const seen=new Set<string>(), candidates:{q:Question;score:number}[]=[];
  for(const q of corpus) {
    if(q.id===current.id || conflictingIds.has(q.id) || q.sourceType!=='MOEX_PAST_EXAM' || !q.stem?.trim() || /^\s*[（(【\[]?\s*承上題/.test(q.stem) || q.stemImage || Object.values(q.optionImages??{}).some(Boolean)) continue;
    const keys=acceptedKeys(q);if(!keys.length) continue;
    const concepts=matchedConcepts(focusedText(q,keys)); let score=0; for(const x of focus) if(concepts.has(x)) score++;
    const stemMatch=[...stemConcepts].some(x=>concepts.has(x));
    const answerMatch=!answerConcepts.size || [...answerConcepts].some(x=>concepts.has(x));
    if(score<2 || !stemMatch || !answerMatch) continue;
    const fingerprint=normalize(q.stem)+'\u0000'+keys.map(k=>normalize(q.options[k]??'')).sort().join('\u0000');
    if(seen.has(fingerprint)) continue;seen.add(fingerprint); candidates.push({q,score});
  }
  return candidates.sort((a,b)=>b.score-a.score || a.q.id.localeCompare(b.q.id)).slice(0,Math.max(0,Math.min(limit,3))).map(x=>x.q);
}
