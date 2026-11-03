export type MathNode={tag:'mrow'|'mfrac'|'msub'|'msup'|'msubsup'|'msqrt'|'mover'|'mi'|'mn'|'mo'|'mtext';text?:string;children?:MathNode[]};
const commands:Record<string,string>={alpha:'α',beta:'β',gamma:'γ',delta:'δ',Delta:'Δ',mu:'μ',sigma:'σ',theta:'θ',pi:'π',times:'×',cdot:'⋅',pm:'±',le:'≤',leq:'≤',ge:'≥',geq:'≥',approx:'≈',neq:'≠',to:'→',rightarrow:'→',infty:'∞'};
/** A small bounded grammar, never HTML/MathML supplied by the model. */
export function parseSafeMath(source:string):MathNode|null {
 if(!source.trim()||source.length>512||/[<>]|\\(?:html|href|url|include|begin|end|style|class|def|newcommand)\b/i.test(source))return null;
 let i=0,nodes=0;
 const node=(tag:MathNode['tag'],children?:MathNode[],text?:string):MathNode=>{if(++nodes>256)throw Error('limit');return {tag,children,text}};
 const space=()=>{while(i<source.length){if(/\s/.test(source[i])){i++;continue}const gap=source.slice(i).match(/^\\(?:[,;! ]|quad\b|qquad\b|left\b|right\b)/);if(gap){i+=gap[0].length;continue}break}};
 const group=(depth:number):MathNode=>{space();if(source[i++]!=='{')throw Error('group');return sequence(depth+1,'}')};
 const atom=(depth:number,allowScripts=true):MathNode=>{
  if(depth>12)throw Error('depth');space();let value:MathNode;const ch=source[i];
  if(ch==='\\'){
   i++;const m=source.slice(i).match(/^[A-Za-z]+/);if(!m)throw Error('command');i+=m[0].length;const command=m[0];
   if(command==='frac')value=node('mfrac',[group(depth),group(depth)]);
   else if(command==='sqrt')value=node('msqrt',[group(depth)]);
   else if(command==='dot'||command==='bar'||command==='overline')value=node('mover',[group(depth),node('mo',undefined,command==='dot'?'˙':'¯')]);
   else if(command==='mathrm'||command==='text'){space();if(source[i++]!=='{')throw Error('text');const end=source.indexOf('}',i);if(end<0)throw Error('text');const text=source.slice(i,end);if(!text.length||text.length>80||/[<>\\{}\x00-\x1f]/.test(text))throw Error('text');i=end+1;value=node('mtext',undefined,text)}
   else if(commands[command])value=node(/[α-ωΑ-Ω]/u.test(commands[command])?'mi':'mo',undefined,commands[command]);
   else throw Error('unsupported');
  }else if(ch==='{'){i++;value=sequence(depth+1,'}')}
  else if(ch==='('||ch==='['){i++;const close=ch==='('?')':']';value=node('mrow',[node('mo',undefined,ch),sequence(depth+1,close),node('mo',undefined,close)])}
  else {const number=source.slice(i).match(/^(?:\d+(?:\.\d*)?|\.\d+)/),word=source.slice(i).match(/^[A-Za-zα-ωΑ-Ω]+/u);
   if(number){i+=number[0].length;value=node('mn',undefined,number[0])}
   else if(word){i+=word[0].length;value=word[0]==='Km'?node('msub',[node('mi',undefined,'K'),node('mi',undefined,'m')]):word[0]==='Vmax'?node('msub',[node('mi',undefined,'V'),node('mtext',undefined,'max')]):node(word[0].length>1?'mtext':'mi',undefined,word[0])}
   else if(ch&&'=+-−×⋅±≤≥≈≠→∞,:'.includes(ch)){i++;value=node('mo',undefined,ch==='-'?'−':ch)}else throw Error('token');
  }
  space();let sub:MathNode|undefined,sup:MathNode|undefined;
  while(allowScripts&&(source[i]==='_'||source[i]==='^')){const kind=source[i++];space();const script=source[i]==='{'?group(depth):atom(depth+1,false);if(kind==='_'){if(sub)throw Error('duplicate');sub=script}else{if(sup)throw Error('duplicate');sup=script}space()}
  return sub&&sup?node('msubsup',[value,sub,sup]):sub?node('msub',[value,sub]):sup?node('msup',[value,sup]):value;
 };
 function sequence(depth:number,stop?:string):MathNode {
  if(depth>12)throw Error('depth');const children:MathNode[]=[];space();
  while(i<source.length&&source[i]!==stop){let value=atom(depth);space();while(source[i]==='/'){i++;value=node('mfrac',[value,atom(depth+1)]);space()}children.push(value)}
  if(stop){if(source[i++]!==stop)throw Error('incomplete')}
  if(!children.length)throw Error('empty');return node('mrow',children);
 }
 try{const value=sequence(0);return i===source.length?value:null}catch{return null}
}
export type MathPart={text:string;math?:MathNode;display?:boolean};
/** Only this exact legacy equation is inferred. Doses, ratios and units are untouched. */
export function legacyMathSource(text:string):string|null {
 const m=text.trim().match(/^1\/([vV])\s*=\s*\(K_?m\s*\/\s*V_?max\)\s*(?:[×*⋅]\s*)?(?:\(1\/\[S\]\)|1\/\[S\])\s*\+\s*1\/V_?max\.?$/);
 return m?`\\frac{1}{${m[1]}} = \\frac{K_m}{V_{max}} \\cdot \\frac{1}{[S]} + \\frac{1}{V_{max}}`:null;
}
export function splitExplanationMath(text:string):MathPart[] {
 const inferred=legacyMathSource(text);if(inferred){const math=parseSafeMath(inferred);if(math)return [{text,math,display:true}]}
 const result:MathPart[]=[];let start=0,search=0;
 while(search<text.length){const at=text.indexOf('$',search);if(at<0)break;if(at>0&&text[at-1]==='\\'){search=at+1;continue}const display=text.startsWith('$$',at),delimiter=display?'$$':'$',end=text.indexOf(delimiter,at+delimiter.length);if(end<0)break;
  if(at>start)result.push({text:text.slice(start,at)});const raw=text.slice(at,end+delimiter.length),source=text.slice(at+delimiter.length,end),math=parseSafeMath(source);result.push(math?{text:raw,math,display}:{text:raw});start=end+delimiter.length;search=start;
 }
 if(start<text.length)result.push({text:text.slice(start)});return result.length?result:[{text}];
}
