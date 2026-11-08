import type {Question} from '@/types/quiz';

// Lexical entities come from the existing official bank's concise options and
// bilingual terminology, not from generated explanations or a new model call.
const STOP=new Set(('a an the of and or to in on for by with without from that which correct incorrect disease diseases syndrome cell cells protein proteins receptor receptors virus viruses nerve artery vein muscle joint membrane nucleus factor chain cycle enzyme blood plasma activity concentration type normal response increased decreased increase decrease male female adult child young left right anterior posterior lateral medial common central peripheral treatment clinical patient human body tissue tissues antibody antibodies tumor cancer lymphoma acid rate level structure function thumb hand forearm brain heart lung liver kidney breast opposition adduction flexion extension ventilation perfusion clearance inhibitor inhibition substrate').split(' '));
const norm=(s:string)=>s.normalize('NFKC').toLowerCase().replace(/[’‘]/g,"'").replace(/[–—]/g,'-').replace(/\b([a-z]+)'s (?=disease|syndrome|lymphoma)/g,'$1 ').replace(/\b([a-z]*)viruses\b/g,'$1virus').replace(/\binhibitors\b/g,'inhibitor').replace(/\s+/g,' ').trim();
const keys=(q:Question)=>q.acceptedAnswers?.length?q.acceptedAnswers:[q.answer];
function phrase(value:string){
 const s=norm(value).replace(/^genus\s+/,'').replace(/[.;:]$/,'');
 if(s.length<4||s.length>75||s.split(' ').length>6||! /^[a-z][a-z0-9' -]*$/.test(s)||!s.split(/[ -]/).some(w=>w.length>=4&&!STOP.has(w)))return null;
 return s;
}
type Evidence={stem:Set<string>;answer:Set<string>;all:Set<string>};
type Index={evidence:Map<string,Evidence>;postings:Map<string,Question[]>;size:number;ambiguous:Set<string>};
const cache=new WeakMap<readonly Question[],Index>();
function indexFor(corpus:readonly Question[]):Index {
 const cached=cache.get(corpus);if(cached)return cached;
 const official=corpus.filter(q=>q.sourceType==='MOEX_PAST_EXAM'&&!q.needsHumanReview&&q.answerConfidence!=='low'&&q.answerCreditType!=='all_credit');
 const vocabulary=new Set<string>(),glosses=new Map<string,Set<string>>(),entityGlosses=new Map<string,Set<string>>();
 for(const q of official){
  const values=[q.stem,...keys(q).map(k=>q.options[k]||'')];
  for(const value of values)for(const m of value.normalize('NFKC').matchAll(/\(([A-Za-z][A-Za-z0-9'’ ,;-]{2,90})\)/g)){const p=phrase(m[1].split(/[,;]/)[0]);if(p)vocabulary.add(p)}
  for(const value of values)for(const m of value.normalize('NFKC').matchAll(/([\u3400-\u9fff]{2,16})\s*\(([A-Za-z][A-Za-z0-9'’ -]{2,75})\)/g)){const p=phrase(m[2]);if(!p)continue;const set=entityGlosses.get(p)||new Set<string>();set.add(m[1]);entityGlosses.set(p,set)}
  for(const k of keys(q)){
   const value=(q.options[k]||'').normalize('NFKC').trim(),p=phrase(value);if(p)vocabulary.add(p);
   const m=value.match(/^([\u3400-\u9fff]{3,16})\s*\(([A-Za-z][A-Za-z0-9'’ -]{2,75})\)$/);if(!m)continue;
   const entity=phrase(m[2]);if(!entity)continue;const aliases=glosses.get(m[1])||new Set<string>();aliases.add(entity);glosses.set(m[1],aliases);
  }
 }
 const aliases=new Map<string,string>();for(const [cn,entities] of glosses)if(entities.size===1)aliases.set(cn,[...entities][0]);
 // A bare head noun cannot link two incompatible bilingual meanings merely
 // because one question has an old spelling such as 鼠疫(plaque).
 for(const [entity,glosses] of [...entityGlosses]){if(!entity.includes(' '))continue;const head=entity.split(' ').at(-1)!;if(!vocabulary.has(head)||STOP.has(head))continue;const set=entityGlosses.get(head)||new Set<string>();for(const gloss of glosses)set.add(gloss);entityGlosses.set(head,set)}
 const ambiguous=new Set<string>();for(const [entity,glosses] of entityGlosses){if(entity.includes(' '))continue;const groups:string[]=[];for(const gloss of glosses){if(!groups.some(old=>[...old].some(ch=>gloss.includes(ch))))groups.push(gloss)}if(groups.length>1)ambiguous.add(entity)}
 // Bounded token windows avoid a corpus-sized alternation regex on the request
 // path. Whole tokens retain non-/anti- and subtype qualifiers.
 const terms=(s:string)=>{const value=norm(s),out=new Set<string>(),words=[...value.matchAll(/[a-z][a-z0-9'-]*/g)];
  for(let i=0;i<words.length;i++){let text='';for(let j=i;j<Math.min(i+6,words.length);j++){if(j>i&&!/^\s+$/.test(value.slice(words[j-1].index!+words[j-1][0].length,words[j].index)))break;text+=(j>i?' ':'')+words[j][0];if(vocabulary.has(text))out.add(text)}}
  for(const run of value.matchAll(/[\u3400-\u9fff]+/g))for(let i=0;i<run[0].length;i++){if(i>0&&run[0][i-1]==='非')continue;for(let n=3;n<=Math.min(16,run[0].length-i);n++){const entity=aliases.get(run[0].slice(i,i+n));if(entity)out.add(entity)}}
  return out;
 };
 const evidence=new Map<string,Evidence>(),postings=new Map<string,Question[]>();
 for(const q of official){const primaryStem=norm(q.stem).replace(/(?:較|比)\s*[a-z][a-z0-9 -]{2,70}\s*(?:安全|有效|強|弱|高|低)/g,' '),stem=terms(primaryStem),answer=new Set<string>();
  if(!/無關|關係最少|不相關/.test(q.stem))for(const key of keys(q)){const value=(q.options[key]||'').normalize('NFKC').trim();const bilingualLabel=/^[^()。；，,;]{1,35}\s*\([A-Za-z][A-Za-z0-9'’ ,;-]{2,90}\)$/.test(value)&&!/使用|治療|前者|後者|可使|將使|可以|不會|不受|具有|會使/.test(value.split('(')[0]);if(phrase(value)||bilingualLabel||aliases.has(value))for(const t of terms(value))answer.add(t)}
  const all=new Set([...stem,...answer]);evidence.set(q.id,{stem,answer,all});for(const entity of all){const list=postings.get(entity)||[];list.push(q);postings.set(entity,list)}}
 const result={evidence,postings,size:official.length,ambiguous};cache.set(corpus,result);return result;
}
export function getTeachingEntityCandidates(current:Question,corpus:readonly Question[]){
 const index=indexFor(corpus),e=index.evidence.get(current.id);if(!e)return [];
 const scores=new Map<string,{question:Question;score:number;primary:number;entities:string[]}>();
 for(const entity of e.all){const rows=index.postings.get(entity)||[];
  // A generic frequent word cannot independently authorize background context.
  if(rows.length<2||rows.length>Math.max(12,Math.floor(index.size*.01)))continue;
  for(const q of rows){if(q.id===current.id)continue;const other=index.evidence.get(q.id)!;
   if(index.ambiguous.has(entity)&&![...e.all].some(t=>t!==entity&&other.all.has(t)&&!index.ambiguous.has(t)))continue;
   if(/\b(cycle|pathway|metabolism|system)$/.test(entity)&&e.answer.size&&![...e.answer].some(t=>other.all.has(t)))continue;
   const value=scores.get(q.id)||{question:q,score:0,primary:0,entities:[]};
   value.primary=Math.max(value.primary,e.stem.has(entity)?1:0);value.entities.push(entity);value.score+=Math.log2(index.size/rows.length)+(e.answer.has(entity)&&other.answer.has(entity)?2:0)+(other.answer.has(entity)?3:0)+(e.stem.has(entity)&&other.stem.has(entity)?1:0);scores.set(q.id,value);
  }
 }
 return [...scores.values()].sort((a,b)=>b.primary-a.primary||b.score-a.score||Number(b.question.subject===current.subject)-Number(a.question.subject===current.subject)||a.question.id.localeCompare(b.question.id));
}
export function teachingEntityQualifierConflict(a:Question,b:Question,corpus:readonly Question[]){
 const index=indexFor(corpus),x=index.evidence.get(a.id)?.all,y=index.evidence.get(b.id)?.all;if(!x||!y)return false;
 // Sharing a different entity cannot erase a subtype contradiction. A question
 // explicitly comparing both forms is not treated as claiming just one form.
 return [...x].some(t=>!t.startsWith('non-') ? !x.has('non-'+t)&&y.has('non-'+t)&&!y.has(t) : !x.has(t.slice(4))&&y.has(t.slice(4))&&!y.has(t));
}
