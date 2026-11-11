const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const source=fs.readFileSync('components/ExamQuestionReadingArea.tsx','utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
function harness(keys=['A','B','C','D']){
 let cursor=0,refIndex=0,frames=[],effects=[],deps,scrolls=0,observer;
 const states=[], listeners={};
 const view={scrollTop:140,scrollLeft:10,clientHeight:295,getBoundingClientRect:()=>({bottom:635}),addEventListener:(e,fn)=>listeners[e]=fn,removeEventListener:()=>{},scrollBy:({top})=>{scrolls++;view.scrollTop+=top;}};
 const body={getBoundingClientRect:()=>({bottom:800}),addEventListener:()=>{},removeEventListener:()=>{},querySelectorAll:()=>keys.map((key,i)=>({getAttribute:()=>`選項 ${key}`,closest:()=>({getBoundingClientRect:()=>({bottom:490+i*91.5-view.scrollTop})})}))};
 const refs=[{current:view},{current:body}];
 const react={useRef:()=>refs[refIndex++],useState:init=>{const i=cursor++;if(!(i in states))states[i]=init;return[states[i],v=>states[i]=typeof v==='function'?v(states[i]):v]},useEffect:(fn,next)=>{if(!deps||next.join()!==deps.join()){effects.push(fn);deps=next;}}};
 const box={exports:{},React:react,ResizeObserver:class{constructor(fn){observer=fn}observe(){}disconnect(){}},requestAnimationFrame:fn=>{frames.push(fn);return frames.length},cancelAnimationFrame:()=>{},require:n=>n==='react'?react:require(n)};
 vm.runInNewContext(code,box);
 const render=(id='q1',scale=1)=>{cursor=0;refIndex=0;const result=box.exports.ExamQuestionReadingArea({questionId:id,scale,children:'fixture'});effects.splice(0).forEach(fn=>fn());return result};
 const flush=()=>{frames.splice(0).forEach(fn=>fn())};
 return {render,flush,view,resize:()=>observer(),scroll:()=>listeners.scroll(),scrolls:()=>scrolls};
}
function find(root,type){if(!root||typeof root!=='object')return null;if(root.type===type)return root;for(const child of [root.props?.children].flat(Infinity)){const result=find(child,type);if(result)return result}return null}
test('partial C and below-screen D are named, never silently removed',()=>{const h=harness();h.render();h.flush();const button=find(h.render(),'button');assert.equal(button.props.children.join(''),'下方還有 C、D 選項 ↓');});
test('cue scrolls only reading viewport, then disappears when all options are visible',()=>{const h=harness();h.render();h.flush();find(h.render(),'button').props.onClick();assert.equal(h.scrolls(),1);assert.equal(h.view.scrollTop,236);h.scroll();h.flush();assert.equal(find(h.render(),'button'),null)});
test('new question resets scroll, re-render and text scale do not reset reading position',()=>{const h=harness();h.render();assert.equal(h.view.scrollTop,0);assert.equal(h.view.scrollLeft,0);h.view.scrollTop=80;h.render('q1',1.6);assert.equal(h.view.scrollTop,80);h.render('q2');assert.equal(h.view.scrollTop,0);});
test('resize remeasures overflow and handles an existing fifth option',()=>{const h=harness(['A','B','C','D','E']);h.render();h.flush();assert.match(find(h.render(),'button').props.children.join(''),/C、D、E/);h.view.getBoundingClientRect=()=>({bottom:1000});h.resize();h.flush();assert.equal(find(h.render(),'button'),null)});
test('reading wrapper leaves original answer mapping and original mode untouched',()=>{const s=fs.readFileSync('components/ExamLikeSurface.tsx','utf8');assert.match(s,/Object.keys\(question.options\).map/);assert.match(s,/onChange=\{\(\)=>p.onAnswer\(key as OptionKey\)\}/);assert.match(s,/<ExamQuestionReadingArea questionId=\{question.id\} scale=\{p.scale\}>/);});
test('pixel clone preserves font synthesis and scrollbar geometry; scroll invalidates old bitmap',()=>{const s=fs.readFileSync('lib/examPixelRenderer.ts','utf8'),frame=fs.readFileSync('components/ExamScreenFrame.tsx','utf8');assert.match(s,/'font-synthesis'/);assert.match(s,/'scrollbar-gutter'/);assert.match(frame,/const scrolled=\(\)=>\{setReady\(false\);request\(\);\}/);});
