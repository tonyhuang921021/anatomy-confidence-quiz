import type {ExamFlag} from '@/lib/examSessionSync';
const flags={triangle:{symbol:'▲',label:'黃色三角註記',color:'#a36a00'},circle:{symbol:'●',label:'橘色圓形註記',color:'#c85e16'},square:{symbol:'■',label:'藍色方塊註記',color:'#237ca8'}};
export function ExamQuestionFlagBadge({value}:{value:ExamFlag}){if(!value)return null;const f=flags[value];return <span role="img" aria-label={f.label} title={f.label} style={{color:f.color,fontSize:12,lineHeight:1,display:'inline-block',flexShrink:0}}>{f.symbol}</span>}
