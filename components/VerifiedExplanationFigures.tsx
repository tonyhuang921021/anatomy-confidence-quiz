'use client';
import { useState } from 'react';
import { getVerifiedExplanationFigures, type VerifiedExplanationFigure } from '@/lib/verifiedExplanationFigures';

function Figure({ figure }: {figure: VerifiedExplanationFigure}) {
  const [expanded, setExpanded] = useState(false);
  return <figure className="my-4 min-w-0 max-w-full">
    <button type="button" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}
      aria-label={`${expanded ? '縮小' : '放大'}圖片：${figure.alt}`}
      className={`block max-w-full rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700 ${expanded ? 'w-full' : 'w-48 sm:w-80'}`}>
      <img src={figure.asset} alt={figure.alt} className="h-auto w-full max-w-full rounded-xl" />
    </button>
    <figcaption className="mt-2 text-sm leading-6 text-slate-700">
      {figure.caption} · <a href={figure.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">{figure.attribution}</a> · {figure.license}
    </figcaption>
  </figure>;
}
export function VerifiedExplanationFigures({questionId}:{questionId:string}) {
  return <>{getVerifiedExplanationFigures(questionId).map((figure) => <Figure key={figure.asset} figure={figure}/>)}</>;
}
