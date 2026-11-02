'use client';
import { useEffect, useRef, useState } from 'react';
import { safeApprovedMeta } from '@/lib/approvedFigureSecurity';
import { getVerifiedExplanationFigures, type VerifiedExplanationFigure } from '@/lib/verifiedExplanationFigures';

export function Figure({ figure }: {figure: VerifiedExplanationFigure}) {
  const [expanded, setExpanded] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (expanded && !element.open) element.showModal();
    if (!expanded && element.open) { element.close(); trigger.current?.focus({preventScroll:true}); }
    if (!expanded) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [expanded]);
  return <figure className="my-4 min-w-0 max-w-full">
    <button ref={trigger} type="button" onClick={() => setExpanded(true)} aria-expanded={expanded} aria-haspopup="dialog"
      aria-label={`放大圖片：${figure.alt}`}
      className="block w-48 max-w-full rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700 sm:w-80">
      <img src={figure.asset} alt={figure.alt} className="h-auto w-full max-w-full rounded-xl bg-white" />
    </button>
    <figcaption className="mt-2 text-sm leading-6 text-slate-700">
      {figure.caption} · <a href={figure.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">{figure.attribution}</a> · <a href={figure.licenseUrl} target="_blank" rel="noopener noreferrer" className="underline">{figure.license}</a>
    </figcaption>
    <dialog ref={dialog} className="figure-lightbox" aria-label={`圖片放大：${figure.alt}`} onCancel={event => {event.preventDefault();setExpanded(false);}}
      onClick={event => {if(event.target===event.currentTarget)setExpanded(false);}}>
      <div className="figure-lightbox-panel">
        <button type="button" className="figure-lightbox-close" onClick={() => setExpanded(false)} autoFocus>關閉圖片</button>
        <img src={figure.asset} alt={figure.alt} className="figure-lightbox-image" />
        <p className="mt-3 text-sm leading-6">{figure.caption} · <a className="underline" href={figure.sourceUrl} target="_blank" rel="noopener noreferrer">{figure.attribution}</a> · <a className="underline" href={figure.licenseUrl} target="_blank" rel="noopener noreferrer">{figure.license}</a></p>
      </div>
    </dialog>
  </figure>;
}
export function VerifiedExplanationFigures({questionId}:{questionId:string}) {
  const [approved,setApproved]=useState<VerifiedExplanationFigure[]>([]);
  useEffect(()=>{setApproved([]);if(process.env.NEXT_PUBLIC_FIGURE_REVIEW_RENDER!=='1')return;let cancelled=false;
    fetch(`/api/approved-figures?questionId=${encodeURIComponent(questionId)}`,{cache:'no-store'}).then(r=>r.ok?r.json():{figures:[]}).then(data=>{if(cancelled)return;const items=Array.isArray(data.figures)?data.figures.filter(safeApprovedMeta).slice(0,3):[];setApproved(items.map((x:any)=>({asset:`/api/approved-figures/${x.id}`,alt:x.section_title,caption:x.section_title,sourceUrl:x.source_url,licenseUrl:x.license_url,license:x.license,attribution:x.attribution})))}).catch(()=>{if(!cancelled)setApproved([])});return()=>{cancelled=true};
  },[questionId]);
  return <>{[...getVerifiedExplanationFigures(questionId),...approved].map((figure) => <Figure key={figure.asset} figure={figure}/>)}</>;
}
