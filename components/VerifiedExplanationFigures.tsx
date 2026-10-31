'use client';
import { useEffect, useState } from 'react';
import { safeApprovedMeta } from '@/lib/approvedFigureSecurity';
import { getVerifiedExplanationFigures, type VerifiedExplanationFigure } from '@/lib/verifiedExplanationFigures';

function Figure({ figure }: {figure: VerifiedExplanationFigure}) {
  const [expanded, setExpanded] = useState(false);
  return <figure className="my-4 min-w-0 max-w-full">
    <button type="button" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}
      aria-label={`${expanded ? '縮小' : '放大'}圖片：${figure.alt}`}
      className={`block max-w-full rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700 ${expanded ? 'w-full' : 'w-48 sm:w-80'}`}>
      <img src={figure.asset} alt={figure.alt} className="h-auto w-full max-w-full rounded-xl bg-white" />
    </button>
    <figcaption className="mt-2 text-sm leading-6 text-slate-700">
      {figure.caption} · <a href={figure.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">{figure.attribution}</a> · <a href={figure.licenseUrl} target="_blank" rel="noopener noreferrer" className="underline">{figure.license}</a>
    </figcaption>
  </figure>;
}
export function VerifiedExplanationFigures({questionId}:{questionId:string}) {
  const [approved,setApproved]=useState<VerifiedExplanationFigure[]>([]);
  useEffect(()=>{setApproved([]);if(process.env.NEXT_PUBLIC_FIGURE_REVIEW_RENDER!=='1')return;let cancelled=false;
    fetch(`/api/approved-figures?questionId=${encodeURIComponent(questionId)}`,{cache:'no-store'}).then(r=>r.ok?r.json():{figures:[]}).then(data=>{if(cancelled)return;const items=Array.isArray(data.figures)?data.figures.filter(safeApprovedMeta).slice(0,3):[];setApproved(items.map((x:any)=>({asset:`/api/approved-figures/${x.id}`,alt:x.section_title,caption:x.section_title,sourceUrl:x.source_url,licenseUrl:x.license_url,license:x.license,attribution:x.attribution})))}).catch(()=>{if(!cancelled)setApproved([])});return()=>{cancelled=true};
  },[questionId]);
  return <>{[...getVerifiedExplanationFigures(questionId),...approved].map((figure) => <Figure key={figure.asset} figure={figure}/>)}</>;
}
