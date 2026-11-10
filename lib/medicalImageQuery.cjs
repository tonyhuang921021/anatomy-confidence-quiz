'use strict';
// Discovery only: these hints never establish source rights or image fit.
// Callers still validate medical intent and keep the original saved caption.
const TCA=['tca cycle','citric acid cycle','krebs cycle'];
const PRESENTATION=/(?: (?:diagram|illustration|schematic|overview))+$/;
const STANDARD=[...TCA,'urea cycle','base excision repair','electron transport chain','inulin clearance'];
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
 const core=coreMedicalTerm(query);
 // Keep standard names as phrases rather than unrelated word matches.
 // Existing cache identities are deliberately unchanged, including unknowns.
 if(core==='tca cycle')return '('+TCA.map(x=>'"'+x+'"').join(' OR ')+') AND OPEN_ACCESS:Y';
 if(core)return '("'+core+'") AND OPEN_ACCESS:Y';
 if(query.split(' ').length<=4)return '("'+query+'") AND OPEN_ACCESS:Y';
 return '('+query.split(' ').join(' AND ')+') AND OPEN_ACCESS:Y';
}
module.exports={coreMedicalTerm,pmcSearchExpression};
