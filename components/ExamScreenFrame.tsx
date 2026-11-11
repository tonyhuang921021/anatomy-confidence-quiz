"use client";
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {isMobileExamClient} from '@/lib/examEntryPolicy';
import {paintExamPixels,pixelBitmapSize,type PixelAssetCache,type PixelStyleCache} from '@/lib/examPixelRenderer';
import styles from './ExamScreenFrame.module.css';
import {createPortal} from 'react-dom';
export function ExamScreenFrame({children,standard=false}:{children:ReactNode;standard?:boolean}){
 const [mobile,setMobile]=useState<boolean|null>(null),[enabled,setEnabled]=useState(false),[size,setSize]=useState(896),[ready,setReady]=useState(false),[editing,setEditing]=useState(false),[failed,setFailed]=useState(false),[revision,setRevision]=useState(0),[requested,setRequested]=useState(0),[box,setBox]=useState({width:1024,height:768});
 const source=useRef<HTMLDivElement>(null),viewport=useRef<HTMLDivElement>(null),canvas=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{if(standard)return;const narrow=matchMedia('(max-width:767px)'),coarse=matchMedia('(pointer:coarse)');const update=()=>setMobile(isMobileExamClient(narrow.matches?767:768,navigator.userAgent,navigator.platform,navigator.maxTouchPoints,coarse.matches));update();narrow.addEventListener('change',update);coarse.addEventListener('change',update);return()=>{narrow.removeEventListener('change',update);coarse.removeEventListener('change',update);};},[standard]);
 useEffect(()=>{
  if(standard||mobile!==false)return;
  const root=document.documentElement,body=document.body;
  const before=[root.style.overflow,body.style.overflow];
  root.style.overflow='hidden';body.style.overflow='hidden';
  return()=>{root.style.overflow=before[0];body.style.overflow=before[1];};
 },[standard,mobile]);
 useEffect(()=>{
  if(standard||mobile!==false||!enabled)return;
  const content=source.current,view=viewport.current,target=canvas.current;if(!content||!view||!target)return;
  let stopped=false,scheduled:ReturnType<typeof setTimeout>|undefined,running=false,wanted=0,broken=false;let cache:PixelStyleCache=new WeakMap();const assets:PixelAssetCache=new Map();setReady(false);setFailed(false);setRevision(0);setRequested(0);
  const render=async()=>{scheduled=undefined;if(stopped||broken||running)return;running=true;const token=wanted;
   try{const painted=await paintExamPixels({source:content,viewport:view,canvas:target,...pixelBitmapSize(size,view.clientWidth,view.clientHeight),styles:cache,assets,current:()=>!stopped&&token===wanted});if(painted){setReady(true);setRevision(token);}}
   catch{if(!stopped){broken=true;setFailed(true);setReady(false);}}
   finally{running=false;if(!stopped&&!broken&&wanted!==token)scheduled=setTimeout(()=>void render(),60);}
  };
  const request=()=>{wanted++;setRequested(wanted);if(!running&&!scheduled&&!broken)scheduled=setTimeout(()=>void render(),60);};
  const measure=()=>{setReady(false);cache=new WeakMap();setBox({width:view.clientWidth,height:view.clientHeight});request();};
  const edit=()=>{const active=document.activeElement,text=active instanceof HTMLTextAreaElement||(active instanceof HTMLInputElement&&!['radio','checkbox','button','submit'].includes(active.type));const entered=Array.from(content.querySelectorAll<HTMLInputElement>('input:not([type=radio]):not([type=checkbox])')).some(x=>x.value.length>0);const selection=getSelection(),selected=Boolean(selection&&!selection.isCollapsed&&selection.anchorNode&&content.contains(selection.anchorNode));setEditing(Boolean(text||entered||selected));request();};
  const sectionKey=()=>content.querySelector('.question-caption h1')?.textContent||(content.querySelector('.review-area')?'overview':content.querySelector('h1,h2')?.textContent)||'';let section=sectionKey();const changed=(records:MutationRecord[])=>{if(records.some(r=>r.type==='attributes'))cache=new WeakMap();const next=sectionKey();if(next!==section){setReady(false);section=next;view.scrollTop=0;view.scrollLeft=0;content.querySelectorAll<HTMLElement>('.question-body,.review-area').forEach(el=>{el.scrollTop=0;el.scrollLeft=0;});}request();};const observer=new MutationObserver(changed);observer.observe(content,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class','style','checked','disabled','open']});
  const scrolled=()=>{setReady(false);request();};
  const resize=new ResizeObserver(measure);resize.observe(view);
  for(const e of ['click','change','input','focusin','focusout','pointerover','pointerout'])content.addEventListener(e,edit);
  content.addEventListener('load',request,true);content.addEventListener('scroll',scrolled,{passive:true,capture:true});document.addEventListener('selectionchange',edit);measure();
  return()=>{stopped=true;wanted++;if(scheduled)clearTimeout(scheduled);observer.disconnect();resize.disconnect();for(const e of ['click','change','input','focusin','focusout','pointerover','pointerout'])content.removeEventListener(e,edit);content.removeEventListener('load',request,true);content.removeEventListener('scroll',scrolled,true);document.removeEventListener('selectionchange',edit);assets.clear();};
 },[enabled,mobile,size,standard]);
 if(standard||mobile===true)return <>{children}</>;
 if(mobile===null)return <p role="status">正在準備模擬畫面…</p>;
 return createPortal(<section className={styles.frame} data-testid="exam-screen-frame" data-pixel-status={failed?'fallback':editing?'editing':enabled&&ready?'ready':enabled?'rendering':'clear'} data-pixel-revision={revision} data-pixel-request={requested} style={{'--exam-screen-height':`${box.height}px`} as React.CSSProperties}>
  <div className={styles.controls}><span>模擬螢幕</span><div><label>顯示方式 <select aria-label="模擬螢幕解析度" value={enabled?size:0} onChange={e=>{const value=Number(e.target.value);setEnabled(value!==0);if(value)setSize(value);}}><option value={896}>稍清晰像素 {pixelBitmapSize(896,box.width,box.height).width} × {pixelBitmapSize(896,box.width,box.height).height}</option><option value={800}>原像素顯示 {pixelBitmapSize(800,box.width,box.height).width} × {pixelBitmapSize(800,box.width,box.height).height}</option><option value={640}>較粗像素 {pixelBitmapSize(640,box.width,box.height).width} × {pixelBitmapSize(640,box.width,box.height).height}</option><option value={0}>清晰顯示</option></select></label></div></div>
  <div className={styles.display}><div className={styles.viewport} ref={viewport} data-testid="exam-screen-viewport"><div ref={source} data-exam-pixel-source>{children}</div></div><canvas ref={canvas} className={styles.bitmap} width={pixelBitmapSize(size,box.width,box.height).width} height={pixelBitmapSize(size,box.width,box.height).height} style={{width:box.width,height:box.height}} hidden={!enabled||!ready||editing||failed} aria-hidden="true" data-testid="exam-pixel-canvas"/></div>
  <p className={styles.status} role="status">{failed?'像素效果暫不可用，已改用清晰畫面。':editing?'輸入或選取文字時暫用清晰畫面。':enabled?'整個模擬畫面以低解析度呈現；可隨時切回清晰顯示。':'清晰顯示；作答與保存方式不變。'}</p>
 </section>,document.body);
}
