'use strict';
// Discovery only: these hints never establish source rights or image fit.
// Callers still validate medical intent and keep the original saved caption.
const TCA=['tca cycle','citric acid cycle','krebs cycle'];
const PRESENTATION=/(?: (?:diagram|illustration|schematic|overview))+$/;
const STANDARD=[...TCA,'urea cycle','base excision repair','electron transport chain','inulin clearance','polymerase chain reaction','pentose phosphate pathway','advanced glycation end products'];
const DESCRIPTION=/^(?:(?:products|intermediates|reaction|reactions|steps|sequence|mechanism|pathway|and)(?: |$))+$/;
function coreMedicalTerm(query){
 if(typeof query!=='string'||!/^[a-z][a-z -]{1,89}$/.test(query)||query.split(' ').length>8)return null;
 // Presentation words are safe to trim generically. Words like "reaction"
 // and "pathway" can be part of a medical name, so require a standard anchor
 // before dropping them. Never discard an unknown distinguishing modifier.
 const core=query.replace(PRESENTATION,'');
 const standard=STANDARD.find(term=>core===term||core.startsWith(term+' ')&&DESCRIPTION.test(core.slice(term.length+1)));
 if(standard)return TCA.includes(standard)?'tca cycle':standard===query?null:standard;
 if(core===query||core.length<3||core.split(' ').length>5||/^(?:cell|protein|organ|medical|anatomy|physiology|biochemistry|pathology)$/.test(core))return null;
 return core;
}
function pmcSearchExpression(query){
 if(typeof query!=='string'||!/^[a-z][a-z -]{1,89}$/.test(query)||query.split(' ').length>8)throw Error('query rejected');
 const core=coreMedicalTerm(query),effective=core||query;
 // Preserve genuine names/abbreviations, but do not require every descriptive
 // modifier to appear next to the name in a published article. One request,
 // unchanged cache identity: a completed/unknown old query is never repeated.
 const anchor=STANDARD.filter(term=>effective===term||effective.startsWith(term+' ')).sort((a,b)=>b.length-a.length)[0];
 if(anchor){
  const phrase=TCA.includes(anchor)?'('+TCA.map(x=>'"'+x+'"').join(' OR ')+')':'("'+anchor+'")';
  const rest=effective.slice(anchor.length).trim();
  return phrase+(rest?' AND '+rest.split(' ').join(' AND '):'')+' AND OPEN_ACCESS:Y';
 }
 return '('+effective.split(' ').join(' AND ')+') AND OPEN_ACCESS:Y';
}
module.exports={coreMedicalTerm,pmcSearchExpression};
