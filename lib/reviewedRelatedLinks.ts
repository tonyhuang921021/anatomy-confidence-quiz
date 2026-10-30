import type { OptionKey } from '@/types/quiz';

type CuratedLink = { id: string; expectedAnswer: OptionKey; stemFragments: readonly string[] };
// Independently reviewed concept links. Each target must still match its source text and scoring data.
export const CURATED: Readonly<Record<string, {sourceFragment:string; sourceAnswer:OptionKey; links:readonly CuratedLink[]}>> = {
  'MOEX-C217-091030-S4004-STAGE1-Q001': {sourceFragment:'臀關節的屈曲動作',sourceAnswer:'B',links:[
    {id:'MOEX-114090-1301-Q028',expectedAnswer:'D',stemFragments:['大腿前肌群','何動作']}
  ]},
  'MOEX-114090-1301-Q028': {sourceFragment:'大腿前肌群',sourceAnswer:'D',links:[
    {id:'MOEX-C217-091030-S4004-STAGE1-Q001',expectedAnswer:'B',stemFragments:['臀關節的屈曲動作']}
  ]},
  'MOEX-C217-091030-S4004-STAGE1-Q002': {sourceFragment:'陽光照射下皮膚會變黑',sourceAnswer:'D',links:[
    {id:'MOEX-101030-2101-Q048',expectedAnswer:'A',stemFragments:['黑色素合成','曬太陽']}
  ]},
  'MOEX-C217-091030-S4004-STAGE1-Q003': {sourceFragment:'血液與淋巴屬於',sourceAnswer:'B',links:[
    {id:'MOEX-106100-1301-Q038',expectedAnswer:'D',stemFragments:['纖維軟骨','規則緻密結締組織']},
    {id:'MOEX-098140-1101-Q037',expectedAnswer:'D',stemFragments:['結締組織中','製造並分泌基質']}
  ]}
};
