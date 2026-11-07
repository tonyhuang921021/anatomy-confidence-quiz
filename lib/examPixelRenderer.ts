// Local presentation only: trusted DOM -> in-memory low-resolution bitmap.
// Never serializes decorative text-input values or fetches remote/client URLs.
const PROPS=['display','position','inset','top','right','bottom','left','z-index','box-sizing','width','height','min-width','max-width','min-height','max-height','margin','padding','border','border-top','border-right','border-bottom','border-left','border-radius','border-collapse','border-spacing','table-layout','box-shadow','background-color','background-image','background-position','background-size','background-repeat','color','opacity','font-family','font-size','font-weight','font-style','font-variant-numeric','line-height','letter-spacing','word-spacing','text-align','text-indent','text-decoration','text-shadow','text-transform','white-space','word-break','overflow-wrap','vertical-align','list-style','float','clear','flex','flex-direction','flex-wrap','flex-grow','flex-shrink','flex-basis','align-items','align-self','align-content','justify-content','order','gap','row-gap','column-gap','grid-template-columns','grid-template-rows','grid-column','grid-row','overflow','overflow-x','overflow-y','object-fit','object-position','transform','transform-origin','outline','outline-offset','visibility','appearance','accent-color','clip','clip-path'] as const;
export type PixelStyleCache=WeakMap<Element,{key:string;css:string}>;
export type PixelAssetCache=Map<string,{data:string;size:number}>;
const MAX_CACHE=16*1024*1024,MAX_FILE=8*1024*1024;
export function trustedPixelAssetPath(raw:string,origin:string):string|null {
 try{if(/(?:^|[\/\\])\.\.(?:[\/\\]|$)/.test(decodeURIComponent(raw)))return null;const u=new URL(raw,origin);return u.origin===origin&&!u.search&&!u.hash&&!u.username&&!u.password&&/^\/(exam-legacy|question-media)\/[A-Za-z0-9_.\/-]+$/.test(u.pathname)&&!u.pathname.split('/').includes('..')?u.href:null;}catch{return null;}
}
function styleFor(el:Element,cache:PixelStyleCache){
 const h=el as HTMLElement,key=[el.getAttribute('class'),el.getAttribute('style'),h.clientWidth,h.clientHeight,el.matches(':hover'),el.matches(':focus'),el.matches(':focus-visible'),el.matches(':focus-within'),el.matches(':active'),el.hasAttribute('disabled')].join('|'),old=cache.get(el);
 if(old?.key===key)return old.css;
 const computed=getComputedStyle(el),css=PROPS.map(p=>{const v=computed.getPropertyValue(p);return p==='background-image'&&/url\(/i.test(v)?`${p}:none;`:`${p}:${v};`;}).join('');cache.set(el,{key,css});return css;
}
function pseudoText(el:Element,which:'::before'|'::after'){
 const c=getComputedStyle(el,which).content;if(!c||c==='none'||c==='normal')return '';
 try{return c.startsWith('"')?JSON.parse(c):c.startsWith("'")?c.slice(1,-1):'';}catch{return '';}
}
async function imageData(raw:string,cache:PixelAssetCache):Promise<string>{
 const url=trustedPixelAssetPath(raw,location.origin);if(!url)throw Error('unsupported_asset');const saved=cache.get(url);if(saved)return saved.data;
 const response=await fetch(url,{credentials:'same-origin',cache:'force-cache'});if(!response.ok)throw Error('asset_unavailable');const blob=await response.blob();if(blob.size>MAX_FILE||!/^image\/(png|jpeg|webp|gif|svg\+xml)$/.test(blob.type))throw Error('unsupported_asset');
 const data=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(Error('asset_unavailable'));reader.readAsDataURL(blob);});
 const size=data.length*2;let total=Array.from(cache.values()).reduce((n,v)=>n+v.size,0);while(cache.size&&total+size>MAX_CACHE){const key=cache.keys().next().value!;total-=cache.get(key)!.size;cache.delete(key);}if(size<=MAX_CACHE)cache.set(url,{data,size});return data;
}
export async function paintExamPixels(input:{source:HTMLElement;viewport:HTMLElement;canvas:HTMLCanvasElement;width:number;height:number;styles:PixelStyleCache;assets:PixelAssetCache;current:()=>boolean}){
 const {source,viewport,canvas,width,height,styles,assets,current}=input;
 const viewRect=viewport.getBoundingClientRect();const originals=[source,...Array.from(source.querySelectorAll('*'))];if(originals.length>3000)throw Error('complex_view');
 const clone=source.cloneNode(true) as HTMLElement,copies=[clone,...Array.from(clone.querySelectorAll('*'))],tasks:Promise<void>[]=[];let assetBytes=0;
 for(let i=0;i<originals.length;i++){
  const el=originals[i],copy=copies[i] as HTMLElement;copy.setAttribute('style',/^(COL|COLGROUP)$/.test(el.tagName)?((el as HTMLElement).getAttribute('style')||''):styleFor(el,styles));
  for(const a of Array.from(copy.attributes))if(/^on/i.test(a.name))copy.removeAttribute(a.name);
  if(/^(SCRIPT|LINK|IFRAME|OBJECT|EMBED|VIDEO|AUDIO|CANVAS)$/.test(el.tagName)){copy.style.display='none';copy.replaceChildren();continue;}
  if(el instanceof HTMLInputElement){copy.removeAttribute('value');if(el.type==='radio'||el.type==='checkbox'){if(el.checked)copy.setAttribute('checked','checked');else copy.removeAttribute('checked');}else(copy as HTMLInputElement).value='';}
  if(el instanceof HTMLTextAreaElement)copy.textContent='';
  if(el instanceof HTMLSelectElement)for(let o=0;o<el.options.length;o++){const option=(copy as unknown as HTMLSelectElement).options[o];if(el.options[o].selected)option.setAttribute('selected','selected');else option.removeAttribute('selected');}
  if(el instanceof HTMLImageElement){const r=el.getBoundingClientRect();if(!r.width||!r.height||r.bottom<viewRect.top||r.top>viewRect.bottom||el.closest('details:not([open])')){copy.removeAttribute('src');copy.removeAttribute('srcset');copy.style.visibility='hidden';}else tasks.push(imageData(el.currentSrc||el.src,assets).then(data=>{assetBytes+=data.length*2;if(assetBytes>MAX_CACHE)throw Error('complex_view');copy.setAttribute('src',data);copy.removeAttribute('srcset');copy.removeAttribute('loading');}));}
  for(const [pseudo,position] of [['::before','afterbegin'],['::after','beforeend']] as const){const text=pseudoText(el,pseudo);if(text){const span=document.createElement('span');span.textContent=text;span.style.cssText='display:inline;white-space:pre;';copy.insertAdjacentElement(position,span);}}
 }
 await Promise.all(tasks);if(!current())return false;
 const host=document.createElement('div');host.setAttribute('xmlns','http://www.w3.org/1999/xhtml');host.style.cssText=`width:${viewport.clientWidth}px;height:${viewport.clientHeight}px;overflow:hidden;background:#fff;position:relative;`;
 clone.style.margin='0';clone.style.width=`${viewport.clientWidth}px`;clone.style.transform=`translate(${-viewport.scrollLeft}px,${-viewport.scrollTop}px)`;clone.style.transformOrigin='0 0';host.append(clone);
 const xml=new XMLSerializer().serializeToString(host),svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" preserveAspectRatio="none" viewBox="0 0 ${viewport.clientWidth} ${viewport.clientHeight}"><foreignObject width="100%" height="100%">${xml}</foreignObject></svg>`;
 const image=new Image();await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(Error('raster_unavailable'));image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);});if(!current())return false;
 const context=canvas.getContext('2d',{alpha:false});if(!context)throw Error('raster_unavailable');canvas.width=width;canvas.height=height;context.fillStyle='#fff';context.fillRect(0,0,width,height);context.drawImage(image,0,0,width,height);return true;
}
