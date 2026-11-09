'use client';
import {useState} from 'react';
import type {UserProvidedFigure} from '@/lib/userProvidedExplanationFigure.cjs';

export function UserProvidedExplanationFigure({figure}:{figure:UserProvidedFigure}){
 const [expanded,setExpanded]=useState(false);
 return <figure className="my-4 min-w-0 max-w-full" data-user-provided-figure={figure.id}>
  <button type="button" aria-expanded={expanded} aria-label={`${expanded?'縮小':'放大'}圖片：${figure.alt}`} onClick={()=>setExpanded(value=>!value)}
   className={`block max-w-full rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700 ${expanded?'w-[680px]':'w-48 sm:w-80'}`}>
   <img src={figure.asset} alt={figure.alt} width={680} height={587} className="h-auto w-full max-w-full rounded-xl bg-white" />
  </button>
  <figcaption className="mt-2 space-y-2 text-sm leading-6 text-slate-700">
   <p>{figure.caption}</p>
   <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-950">{figure.exampleNote}</p>
   <p className="text-xs text-slate-600">圖片來源：<a href={figure.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">{figure.attribution}</a>（同圖轉載頁）</p>
   <p className="text-xs text-slate-500">{figure.rightsNotice}</p>
  </figcaption>
 </figure>;
}
