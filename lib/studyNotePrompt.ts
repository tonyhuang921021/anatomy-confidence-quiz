type StudyNotePromptQuestionCandidate = {
  id: string;
  label?: string;
  subject?: string;
  chapter?: string;
  section?: string;
  testedConcept?: string;
  stem: string;
};

type StudyNoteFormatPromptOptions = {
  examQuestionCount?: number;
  detailLevel?: "concise" | "detailed";
};

function normalizeExamQuestionCount(value?: number) {
  if (!Number.isFinite(value)) return 6;
  return Math.min(8, Math.max(0, Math.floor(Number(value))));
}

function formatQuestionCandidates(candidates: StudyNotePromptQuestionCandidate[]) {
  if (candidates.length === 0) return "";

  return `

下面是網站題庫提供的候選題。只有當我明確貼出候選題時，才從這份清單挑出和筆記最相關的國考題題號，填進 note-meta 的 questionLinks。

規則：
- 只能從候選題清單挑題號，不要自己編不存在的題號。
- 如果有高度相關題目，請挑 3-8 題，依相關程度排序。
- 如果真的少於 3 題相關，才可以少於 3 題。
- 不要把題幹或選項貼進正文；網站會用 questionLinks 題號自動帶入題目。
- questionLinks 請固定輸出成一行逗號分隔，例如：
questionLinks: MOEX-110020-1301-Q018, MOEX-101030-1101-Q020

候選題：
${candidates
  .map((question, index) => {
    const scope = [question.label, question.subject, question.chapter, question.section].filter(Boolean).join(" / ");
    const concept = question.testedConcept ? `｜概念：${question.testedConcept}` : "";
    return `${index + 1}. ${question.id}${scope ? `｜${scope}` : ""}${concept}
題幹：${question.stem}`;
  })
  .join("\n\n")}`;
}

export function buildStudyNoteFormatPrompt(
  candidates: StudyNotePromptQuestionCandidate[] = [],
  options: StudyNoteFormatPromptOptions = {}
) {
  const examQuestionCount = normalizeExamQuestionCount(options.examQuestionCount);
  const detailLevel = options.detailLevel ?? "detailed";
  const detailInstruction =
    detailLevel === "concise"
      ? `精簡版排版要求：
- 保留所有必考觀念，但刪掉重複語句、閒聊、過長例子和不必要鋪陳。
- 每個小標底下優先 3-5 個重點。
- 表格優先，段落盡量短。
- 不要犧牲正確性，但可以把延伸補充壓縮成「補充」一小段。`
      : `詳細版排版要求：
- 保留原本解釋脈絡、推理過程、易混淆點和必要補充。
- 可以用較完整的段落說明原因，但仍避免重複。
- 適合需要讀懂整個觀念，而不是只背結論的筆記。`;
  return `請把接下來的內容轉成「網站筆記可以完整還原的 Markdown」。

目標不是重寫，也不是硬套模板；目標是讓我可以直接複製貼上到筆記系統，排版不要跑掉。

請遵守：
1. 最上方一定要先輸出一個 fenced code block，語言名稱必須是 note-meta，讓網站自動分類。不要省略三個反引號。格式固定如下：
\`\`\`note-meta
title: 這篇筆記的清楚標題
subject: 解剖學／組織學／胚胎學／生理學／生物化學／微生物免疫學／寄生蟲學／公共衛生學／藥理學／病理學
collection: 這篇適合放的資料夾或主題分類
summary: 50 字內摘要
tags: tag1, tag2, tag3
questionLinks: 2022-1-1301-Q025, 2020-2-1301-Q021, 2011-1-1301-Q017
\`\`\`
2. note-meta code block 之後才輸出 Markdown 正文。
3. 保留原本內容的邏輯、順序和語氣，不要自行補不存在的段落。
4. 用 Markdown 標題呈現大字到小字的層級，例如 #、##、###、####。如果原文沒有那麼多層，就不要硬補。
5. 保留表格，但請輸出成標準 Markdown table，讓網站能正確顯示。
6. 保留條列、編號、粗體、引用提醒、code block。
7. 在不刪減重點的前提下收緊排版：
- 同一概念盡量合併成短段或短條列，不要每句都換一段。
- 可比較的內容優先用表格，例如位置、功能、臨床表現、易混淆點。
- 請你自行判斷是否適合做「兩欄感」排版；如果適合，請用 Markdown table 做左右對照或雙欄整理，例如「左欄：結構／右欄：重點」、「左欄：易混淆點／右欄：辨認法」。只適合短資訊、小整理、對照表；長段落不要硬拆成兩欄。
- 避免重複解釋同一個定義；必要補充可放在同一條列後面。
- 每個小標底下盡量 3-6 個重點即可，除非原文真的需要更多。
${detailInstruction}
8. 不要輸出 HTML，不要輸出圖片連結，不要包成 JSON。
9. 相關考古題不是靠我提供候選題。請你使用網路搜尋／瀏覽功能，自己查公開的台灣醫師國考或一階醫師國考題目來源，找和這篇筆記高度相關的正式考古題題號，填進 note-meta 的 questionLinks。
10. 這次 questionLinks 目標題數是 ${examQuestionCount} 題，最多 8 題。請優先找最相關的正式考古題；如果實際可確認題目少於 ${examQuestionCount} 題，就只放能確認的題號，不要為了湊數編題號。
11. 如果你目前這個模型或對話不能上網搜尋，請不要輸出整理後筆記，也不要把 questionLinks 留空交差。請只回覆：「目前這個 ChatGPT 對話不能上網查考古題題號，請改用有開啟網路搜尋的 ChatGPT 後再貼一次。」。
12. 搜尋時請用筆記的核心關鍵字搭配「醫師國考」、「一階」、「考選部」、「年份」、「第幾次」、「題號」等字詞查證；不要憑印象亂填題號。
13. questionLinks 只放題號，不要放題幹、選項或詳解；網站會用題號自動帶入本地題庫的題目、選項、答案與詳解。
14. 查證題號時使用的來源、搜尋過程、URL、引用依據只用來幫你判斷題號，不要寫進 Markdown 正文，也不要新增「題號查證來源」「相關考古題來源」「搜尋紀錄」這類段落。題號放在最上方 note-meta 的 questionLinks 就好。
15. 題號格式請優先使用「西元年-第幾次-卷碼-Q題號」，例如 2022-1-1301-Q025。卷碼常見如 1301；如果來源沒有卷碼，才用 2022-1-Q025。不要自己推測或編造 MOEX ID。
16. 只有當公開來源或我貼給你的內容已經明確出現完整 MOEX ID 時，才可以輸出 MOEX-110020-1301-Q026 這種格式；不要把年份、次別、卷碼自行組成 MOEX ID，因為很容易錯。
17. 如果你已經實際上網搜尋，但真的找不到高度相關的正式考古題，questionLinks 可以留空，並在 summary 後補一句「未找到可確認題號」；但不要自己編題號。
18. 如果正文原本有明確題號，而且你確定是網站題庫的題目，可以額外用這個短碼獨立放一行，但這不是必要：
[question-note id="題目ID" title="簡短題目標題"]
19. 不要加「以下是整理後內容」這種開場白。${formatQuestionCandidates(candidates)}

簡單說：請把你的原本好讀排版，轉成乾淨、標準、可貼進網站的 Markdown，並在最上方附上網站看得懂的 note-meta。`;
}

export const STUDY_NOTE_FORMAT_PROMPT = buildStudyNoteFormatPrompt();
