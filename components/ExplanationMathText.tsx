'use client';
import {createElement} from 'react';
import {splitExplanationMath,type MathNode} from '@/lib/explanationMath';
function mathElement(node:MathNode,key:string):React.ReactNode{return createElement(node.tag,{key},node.text??node.children?.map((child,i)=>mathElement(child,key+'-'+i)))}
export function ExplanationMathText({text}:{text:string}){
 return <>{splitExplanationMath(text).map((part,i)=>part.math?<span key={i} tabIndex={part.display?0:undefined} className={part.display?'my-2 block max-w-full overflow-x-auto overscroll-x-contain py-2':'inline-block max-w-full overflow-x-auto align-middle'}>{createElement('math',{xmlns:'http://www.w3.org/1998/Math/MathML',display:part.display?'block':'inline','aria-label':part.text,style:{fontSize:part.display?'1.18em':'1em',whiteSpace:'nowrap',margin:0}},mathElement(part.math,'m'+i))}</span>:part.text)}</>;
}
