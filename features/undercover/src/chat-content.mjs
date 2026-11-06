// Shared browser/server validator. Do not use Emoji property alone: digits,
// # and * can participate in emoji sequences but ordinary text must stay legal.
const pictograph=/\p{Extended_Pictographic}/u;
const presentation=/\p{Emoji_Presentation}|\p{Emoji_Modifier}|\p{Regional_Indicator}/u;
const punctuation=/\p{Punctuation}/u;
const textSymbols=new Set(['©','®','™']);
export function containsEmoji(value){
 if(typeof value!=='string')return false;
 if(/[0-9#*]\uFE0F?\u20E3/u.test(value)||/[\u{E0020}-\u{E007F}]/u.test(value))return true;
 const chars=[...value];
 return chars.some((char,i)=>presentation.test(char)||(pictograph.test(char)&&(!(punctuation.test(char)||textSymbols.has(char))||chars[i+1]==='\uFE0F')));
}
// Bopomofo letters, including the extended block. Tone marks alone and ordinary
// punctuation/digits are not banned: their meaning is not exclusively Zhuyin.
export function containsZhuyin(value){return typeof value==='string'&&/[\u3100-\u312F\u31A0-\u31BF]/u.test(value);}
