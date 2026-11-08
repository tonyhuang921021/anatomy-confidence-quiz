'use client';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import { Figure } from '@/components/VerifiedExplanationFigures';
import { useCallback, useEffect, useState } from 'react';
type Candidate={id:string;question_id:string;section_title:string;status:string};
type Preview={id:string;status:string;questionId:string;question:{stem:string;options:Record<string,string>;answer:string;sharedContext:string|null}|null;section:string|null;explanation:string|null;mime:string;imageBase64:string;imageSha:string;sourceUrl:string;licenseUrl:string;license:string;attribution:string;sectionTitle:string;reuseSource:{id:string;questionId:string}|null};
export function FigureReviewWorkspace({accessToken}:{accessToken?:string}){
 const [items,setItems]=useState<Candidate[]>([]),[active,setActive]=useState(''),[previews,setPreviews]=useState<Record<string,Preview>>({}),[confirmed,setConfirmed]=useState<Record<string,boolean>>({}),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[showApproved,setShowApproved]=useState(false),[previewRevision,setPreviewRevision]=useState(0);
 const request=useCallback(async(body:Record<string,unknown>)=>{if(!accessToken)throw Error('請先登入管理員帳號');const r=await fetch('/api/owner/figure-review',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...body,accessToken})});const x=await r.json();if(!r.ok||!x.ok)throw Error(x.status==='reuse_not_exact'?'內容已變更，不能重用，請重新核對。':'未能完成，請重新整理核對目前狀態。');return x},[accessToken]);
 const load=useCallback(async()=>{setBusy(true);try{const x=await request({action:'list'});setItems(x.candidates);setActive(old=>x.candidates.some((i:Candidate)=>i.question_id===old)?old:x.candidates[0]?.question_id||'');setPreviewRevision(v=>v+1);setConfirmed({});setMessage('')}catch(e){setMessage((e as Error).message)}finally{setBusy(false)}},[request]);
 useEffect(()=>{if(accessToken)void load()},[accessToken,load]);
 const visible=items.filter(x=>showApproved||x.status==='pending');
 const groups=[...new Set(visible.map(x=>x.question_id))];
 const current=visible.filter(x=>x.question_id===active);
 useEffect(()=>{let canceled=false;setPreviews({});setConfirmed({});if(!active||!accessToken)return;void(async()=>{for(const item of current){try{const x=await request({action:'preview',id:item.id});if(canceled)return;setPreviews(old=>({...old,[item.id]:x}))}catch(e){if(!canceled)setMessage((e as Error).message)}}})();return()=>{canceled=true};
 // Re-fetch only when selected question or candidate membership changes.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[active,accessToken,request,previewRevision,current.map(x=>x.id).join(',')]);
 const context=current.map(x=>previews[x.id]).find(Boolean);
 async function decide(p:Preview,action:'approve'|'reject'|'revoke'|'reuse'){
  setBusy(true);try{await request(action==='revoke'?{action:'revoke',id:p.id,imageSha:p.imageSha,confirmRevoke:true}:action==='reuse'?{action:'reuse',id:p.id,visualConfirmed:confirmed[p.id]===true}:{action:'review',id:p.id,decision:action==='approve'?'approved':'rejected',visualConfirmed:confirmed[p.id]===true});await load();setMessage(action==='revoke'?'已撤回此圖及依它重用的圖片，紀錄保留。':action==='reject'?'已拒絕，紀錄保留。':'已核准，回到題目即可讀取。')}catch(e){setMessage((e as Error).message)}finally{setBusy(false)}
 }
 return <section aria-label="集中審圖工作區" className="mt-6 space-y-4">
 <div className="flex flex-wrap gap-4 items-center"><button type="button" disabled={busy} onClick={()=>void load()}>重新整理候選</button><label><input type="checkbox" checked={showApproved} onChange={e=>{setShowApproved(e.target.checked);setActive('')}}/> 同時查看最近已核准圖片</label><span>待審 {items.filter(x=>x.status==='pending').length} 張</span></div>
 <p className="text-sm">待審優先，最多顯示 60 張待審及最近 30 張已核准圖。每張分別核對，沒有整批核准。</p>{message&&<p role="status">{message}</p>}
 <nav aria-label="待核對題目" className="flex flex-wrap gap-2">{groups.map(id=><button type="button" key={id} aria-pressed={active===id} onClick={()=>setActive(id)}>{id} · {visible.filter(x=>x.question_id===id).length} 張</button>)}</nav>
 {!groups.length&&<p>目前沒有待審圖片。</p>}
 {active&&current.length>0&&<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
 <section aria-label="本題內容" className="min-w-0 rounded-xl border p-4 lg:sticky lg:top-4 lg:self-start"><h2 className="font-bold">{active}</h2>{context?context.question?<><p className="whitespace-pre-wrap">{context.question.sharedContext}</p><p className="whitespace-pre-wrap mt-3">{context.question.stem}</p><ul>{Object.entries(context.question.options).map(([k,v])=><li className="my-2" key={k}>{k}. {v}</li>)}</ul><p>標準答案：{context.question.answer}</p></>:<p>無法取得可信題幹，請先確認題目來源再審核。</p>:<p role="status">載入題目與圖片…</p>}</section>
 <div className="space-y-6 min-w-0">{current.map(item=>{const p=previews[item.id];return <article key={item.id} aria-label={`候選圖 ${item.section_title}`} className="rounded-xl border p-4 space-y-3"><h3 className="font-bold">{item.section_title} · {item.status==='pending'?'待審':'已核准'}</h3>{!p?<p role="status">讀取原圖與已保存段落…</p>:<><details open><summary>對應詳解段落</summary><div className="space-y-3 break-words"><ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]} components={{img:()=>null,table:({children})=><div className="overflow-x-auto"><table className="w-full text-sm border-separate border-spacing-2">{children}</table></div>}}>{p.section||p.explanation||''}</ReactMarkdown></div></details><Figure figure={{asset:`data:${p.mime};base64,${p.imageBase64}`,alt:`待核對：${p.sectionTitle}`,caption:p.sectionTitle,sourceUrl:p.sourceUrl,licenseUrl:p.licenseUrl,license:p.license,attribution:p.attribution}}/>{p.reuseSource&&<p className="text-sm">已找到 {p.reuseSource.questionId} 核准的相同圖檔、段落、用途與授權，可免重複審圖。仍需確認本題適用。</p>}<label className="block"><input type="checkbox" checked={confirmed[p.id]||false} onChange={e=>setConfirmed(x=>({...x,[p.id]:e.target.checked}))}/> {p.status==='approved'?'我已核對這張圖片，確認要撤回；原審核紀錄保留。':'我已核對本題、段落、圖面與來源授權，確認用途相符。'}</label><div className="flex flex-wrap gap-3">{p.status==='approved'?<button type="button" disabled={busy||!confirmed[p.id]} onClick={()=>void decide(p,'revoke')}>撤回這張圖片</button>:<>{p.reuseSource?<button type="button" disabled={busy||!confirmed[p.id]||!p.question} onClick={()=>void decide(p,'reuse')}>重用已核准的相同用途</button>:<button type="button" disabled={busy||!confirmed[p.id]||!p.question} onClick={()=>void decide(p,'approve')}>核准這張圖片</button>}<button type="button" disabled={busy} onClick={()=>void decide(p,'reject')}>拒絕這張圖片</button></>}</div></>}</article>})}</div></div>}
 </section>
}
