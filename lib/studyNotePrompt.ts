type StudyNotePromptQuestionCandidate = {
  id: string;
  label?: string;
  subject?: string;
  chapter?: string;
  section?: string;
  testedConcept?: string;
  stem: string;
};

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

export function buildStudyNoteFormatPrompt(candidates: StudyNotePromptQuestionCandidate[] = []) {
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
questionLinks: 你自行查到且和內容高度相關的題目ID1, 題目ID2, 題目ID3
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
8. 不要輸出 HTML，不要輸出圖片連結，不要包成 JSON。
9. 請你自己上網查公開的台灣醫師國考或一階醫師國考題目來源，找和這篇筆記高度相關的正式考古題題號，填進 note-meta 的 questionLinks。
10. questionLinks 只放題號，不要放題幹、選項或詳解；網站會用題號自動帶入本地題庫的題目、選項、答案與詳解。
11. 題號格式請優先使用網站可辨識的 ID，例如 MOEX-110020-1301-Q018。如果你在公開來源只查到年份、次別和題號，請用「2014-2-Q017」這種清楚格式，並盡量避免含糊描述。
12. 如果你真的找不到高度相關的正式考古題，questionLinks 可以留空，但不要自己編題號。
13. 如果正文原本有明確題號，而且你確定是網站題庫的題目，可以額外用這個短碼獨立放一行，但這不是必要：
[question-note id="題目ID" title="簡短題目標題"]
14. 不要加「以下是整理後內容」這種開場白。${formatQuestionCandidates(candidates)}

簡單說：請把你的原本好讀排版，轉成乾淨、標準、可貼進網站的 Markdown，並在最上方附上網站看得懂的 note-meta。`;
}

export const STUDY_NOTE_FORMAT_PROMPT = buildStudyNoteFormatPrompt();
