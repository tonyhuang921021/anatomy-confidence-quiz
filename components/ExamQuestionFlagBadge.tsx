import type {ExamFlag} from '@/lib/examSessionSync';
const flags={triangle:{label:'咖啡色三角形註記',color:'#92400e'},circle:{label:'紅色圓形註記',color:'#dc2626'},square:{label:'藍色正方形註記',color:'#237ca8'}};
export function ExamQuestionFlagBadge({value}:{value:ExamFlag}){
 if(!value)return null;const f=flags[value];
 return <svg role="img" aria-label={f.label} width="12" height="12" viewBox="0 0 12 12" style={{display:'inline-block',flexShrink:0,verticalAlign:'-1px'}}><title>{f.label}</title>{value==='triangle'?<path d="M6 1 L11 11 H1 Z" fill={f.color}/>:value==='circle'?<circle cx="6" cy="6" r="5" fill={f.color}/>:<rect x="1" y="1" width="10" height="10" fill={f.color}/>}</svg>;
}
