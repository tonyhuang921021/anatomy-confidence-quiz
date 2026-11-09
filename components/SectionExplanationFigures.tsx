"use client";
import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
import {safeApprovedMeta} from '@/lib/approvedFigureSecurity';
import {Figure} from './VerifiedExplanationFigures';
import {userProvidedExplanationFigure,type UserProvidedFigure} from '@/lib/userProvidedExplanationFigure.cjs';
import {ExplanationProgressCat} from './ExplanationProgressCat';
import {imageActivityCopy,type ImageActivity} from '@/lib/explanationImageActivity';
import statusStyles from './ExplanationGenerationStatus.module.css';
import {UserProvidedExplanationFigure} from './UserProvidedExplanationFigure';

type Delivery={imageActivity?:ImageActivity|null;activityReceivedAt?:number;sectionFigures:any[];sections:{sectionTitle:string;sectionHash:string}[];imageStatus:string|null;userProvidedFigure?:UserProvidedFigure|null;refresh?:()=>void};
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
   const supplied=userProvidedExplanationFigure(questionId,hash,data.replacementRevision);
   const userProvidedFigure=supplied&&data.userProvidedFigureId===supplied.id?supplied:null;
   setDelivery({imageActivity:data.imageActivity??null,activityReceivedAt:Date.now(),sectionFigures:figures,userProvidedFigure,sections:(Array.isArray(data.sections)?data.sections:[]).filter((x:any)=>typeof x.sectionTitle==='string').slice(0,3),imageStatus:typeof data.imageStatus==='string'?data.imageStatus:null,refresh:()=>void read(false)});
   if(loop&&!userProvidedFigure&&(figures.length===0||['searching','reviewing'].includes(data.imageActivity?.phase))&&data.imageStatus&&++reads<60)timer=setTimeout(()=>void read(),reads<12?5000:15000);
  }catch{if(!cancelled)setDelivery({sectionFigures:[],sections:[],imageStatus:'unavailable',refresh:()=>void read(false)})}};
  const focus=()=>{if(document.visibilityState==='visible')void read(false)};
  void read();window.addEventListener('focus',focus);document.addEventListener('visibilitychange',focus);
  return()=>{cancelled=true;clearTimeout(timer);window.removeEventListener('focus',focus);document.removeEventListener('visibilitychange',focus)};
 },[questionId,text]);
 return <Context.Provider value={preview || delivery}><ExplanationImageActivity delivery={preview || delivery}/>{children}</Context.Provider>;
}
export function SectionFigures({title}:{title?:string}){
 const delivery=useContext(Context);if(!delivery)return null;
 if(delivery.userProvidedFigure&&delivery.userProvidedFigure.sectionTitle===title)return <UserProvidedExplanationFigure figure={delivery.userProvidedFigure}/>;
 const figures=title?delivery.sectionFigures.filter(x=>x.section_heading===title):[];
 if(figures.length)return <>{figures.map(x=><Figure key={x.id} figure={{asset:typeof x.asset==='string' && ['/terra-trial/carotid-sheath.png','/terra-trial/common-carotid.jpg','/terra-trial/brain-sinuses.jpg'].includes(x.asset) ? x.asset : process.env.NODE_ENV === "development" && typeof x.previewAsset === "string" && x.previewAsset.startsWith("data:image/png;base64,") ? x.previewAsset : `/api/approved-figures/${x.id}`,alt:x.section_title,caption:x.section_title,sourceUrl:x.source_url,licenseUrl:x.license_url,license:x.license,attribution:x.attribution}}/>)}</>;
 return null;
}

function ExplanationImageActivity({delivery}:{delivery:Delivery|null}) {
 const [now,setNow]=useState(Date.now());
 const activity=delivery?.imageActivity,receivedAt=delivery?.activityReceivedAt??0;
 useEffect(()=>{setNow(Date.now());if(!activity||!['searching','reviewing'].includes(activity.phase))return;const timer=setTimeout(()=>setNow(Date.now()),Math.max(0,Math.min(15_000,activity.ttlMs)-(Date.now()-receivedAt))+20);return()=>clearTimeout(timer)},[activity,receivedAt]);
 const copy=imageActivityCopy(activity,receivedAt,now);if(!copy)return null;
 if(!copy.active)return <p className="my-2 text-xs leading-6 text-slate-600" role="status">{copy.label}。{copy.caption}</p>;
 return <div className={statusStyles.status} data-phase="loading" role="status" aria-live="polite" aria-busy="true"><ExplanationProgressCat/><div className={statusStyles.copy}><span className={statusStyles.label}>{copy.label}</span><span className={statusStyles.caption}>{copy.caption}</span></div></div>;
}
