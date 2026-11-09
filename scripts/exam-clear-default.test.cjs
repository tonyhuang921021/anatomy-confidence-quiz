const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const source=fs.readFileSync('components/ExamScreenFrame.tsx','utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
function harness(mobile=false){
 let cursor=0;const states=[];
 const react={useState:init=>{const i=cursor++;if(!(i in states))states[i]=i===0?mobile:init;return[states[i],v=>states[i]=typeof v==='function'?v(states[i]):v]},useRef:()=>({current:null}),useEffect:()=>{}};
 const box={exports:{},document:{body:{}},require:name=>name==='react'?react:name==='react/jsx-runtime'?require('react/jsx-runtime'):name==='react-dom'?{createPortal:x=>x}:name.includes('examPixelRenderer')?{paintExamPixels:()=>{throw Error('unexpected render')},pixelBitmapSize:()=>({width:896,height:672})}:name.includes('examEntryPolicy')?{isMobileExamClient:()=>mobile}:{default:{}}};
 vm.runInNewContext(code,box);return()=>{cursor=0;return box.exports.ExamScreenFrame({children:'fixture'})};
}
function find(root,type){if(!root||typeof root!=='object')return null;if(root.type===type)return root;for(const child of [root.props?.children].flat(Infinity)){const match=find(child,type);if(match)return match}return null}
test('desktop mock-exam starts clear with no canvas overlay',()=>{
 const tree=harness()();assert.equal(tree.props['data-pixel-status'],'clear');assert.equal(find(tree,'select').props.value,0);assert.equal(find(tree,'canvas').props.hidden,true);
});
test('all pixel choices remain available and can be switched back manually',()=>{
 const render=harness();let tree=render();const select=find(tree,'select');
 assert.deepEqual(Array.from(select.props.children,x=>x.props.value),[896,800,640,0]);
 for(const value of [896,800,640,0]){find(tree,'select').props.onChange({target:{value:String(value)}});tree=render();assert.equal(find(tree,'select').props.value,value)}
 assert.equal(find(tree,'canvas').props.hidden,true);
});
test('a fresh mount starts clear again and mobile retains the ordinary renderer',()=>{
 const render=harness();find(render(),'select').props.onChange({target:{value:'800'}});assert.equal(find(render(),'select').props.value,800);
 assert.equal(find(harness()(),'select').props.value,0);assert.equal(harness(true)().props.children,'fixture');
});
