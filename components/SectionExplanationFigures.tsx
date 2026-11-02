"use client";
import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
import {safeApprovedMeta} from '@/lib/approvedFigureSecurity';
import {Figure} from './VerifiedExplanationFigures';

type Delivery={sectionFigures:any[];sections:{sectionTitle:string;sectionHash:string}[];imageStatus:string|null;refresh?:()=>void};
const Context=createContext<Delivery|null>(null);
const PreviewContext=createContext<Delivery|null>(null);
export function LocalFigurePreviewProvider({value,children}:{value:Delivery;children:ReactNode}) {return <PreviewContext.Provider value={process.env.NODE_ENV === "development" ? value : null}>{children}</PreviewContext.Provider>;}
export function SectionFiguresProvider({questionId,text,children}:{questionId?:string;text:string;children:ReactNode}){
 const preview=useContext(PreviewContext);
 const [delivery,setDelivery]=useState<Delivery|null>(null);
 useEffect(()=>{
  setDelivery(null);let cancelled=false;
  if(!questionId||process.env.NEXT_PUBLIC_NEW_EXPLANATION_FIGURES_RENDER!=='1')return;
  let timer:ReturnType<typeof setTimeout>;let reads=0;
  const read=async(loop=true)=>{try{
   const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))).map(x=>x.toString(16).padStart(2,'0')).join('');
   const response=await fetch(`/api/approved-figures?questionId=${encodeURIComponent(questionId)}`,{cache:'no-store'});
   if(!response.ok)throw Error('unavailable');const data=await response.json();
   if(cancelled||data.explanationHash!==hash)return;
   const figures=(Array.isArray(data.sectionFigures)?data.sectionFigures:[]).filter(safeApprovedMeta).slice(0,3);
   setDelivery({sectionFigures:figures,sections:(Array.isArray(data.sections)?data.sections:[]).filter((x:any)=>typeof x.sectionTitle==='string').slice(0,3),imageStatus:typeof data.imageStatus==='string'?data.imageStatus:null,refresh:()=>void read(false)});
   if(loop&&figures.length===0&&data.imageStatus&&++reads<12)timer=setTimeout(()=>void read(),5000);
  }catch{if(!cancelled)setDelivery({sectionFigures:[],sections:[],imageStatus:'unavailable',refresh:()=>void read(false)})}};
  const focus=()=>{if(document.visibilityState==='visible')void read(false)};
  void read();window.addEventListener('focus',focus);
  return()=>{cancelled=true;clearTimeout(timer);window.removeEventListener('focus',focus)};
 },[questionId,text]);
 return <Context.Provider value={preview || delivery}>{children}</Context.Provider>;
}
export function SectionFigures({title}:{title?:string}){
 const delivery=useContext(Context);if(!delivery)return null;
 const figures=title?delivery.sectionFigures.filter(x=>x.section_heading===title):[];
 if(figures.length)return <>{figures.map(x=><Figure key={x.id} figure={{asset:typeof x.asset==='string' && ['/terra-trial/carotid-sheath.png','/terra-trial/common-carotid.jpg','/terra-trial/brain-sinuses.jpg'].includes(x.asset) ? x.asset : process.env.NODE_ENV === "development" && typeof x.previewAsset === "string" && x.previewAsset.startsWith("data:image/png;base64,") ? x.previewAsset : `/api/approved-figures/${x.id}`,alt:x.section_title,caption:x.section_title,sourceUrl:x.source_url,licenseUrl:x.license_url,license:x.license,attribution:x.attribution}}/>)}</>;
 const planned=title?delivery.sections.some(x=>x.sectionTitle===title):delivery.sections.length===0;
 if(!planned||!delivery.imageStatus||delivery.imageStatus==='stale')return null;
 return <p className="mt-3 text-sm leading-6 text-slate-600" role="status">{delivery.imageStatus==='unavailable'?'圖片狀態暫時讀不到':delivery.imageStatus==='pending_visual_review'?'配圖核對中':'圖片待補'} · 詳解可先閱讀，之後會在這裡補上合適的圖。{delivery.refresh&&<button type="button" className="ml-2 underline" onClick={delivery.refresh}>重新檢查圖片</button>}</p>;
}
