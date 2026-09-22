import type { OptionKey, Question } from "../types/quiz";

// Original MOEX PDFs were visually checked field by field. Private-use codes
// are font-specific: even within Q029, U+EA86 means both 尿 and 苷.
// Match the entire source field as well as its question ID; never map PUA
// globally or mutate canonical questions / saved answer records.
// Evidence: docs/pdf-source-glyph-repairs.json.
const SOURCE_REPAIRS: readonly {
  questionId: string; field: "stem" | OptionKey; original: string; replacement: string;
}[] = [
  {
    "questionId": "MOEX-100140-1101-Q003",
    "field": "B",
    "original": "伸長肌（extensor hallucis longus）",
    "replacement": "伸踇長肌（extensor hallucis longus）"
  },
  {
    "questionId": "MOEX-100140-1101-Q004",
    "field": "D",
    "original": "屈（flex the great toe）",
    "replacement": "踇屈（flex the great toe）"
  },
  {
    "questionId": "moex-med1-supplement-v5-100140-1101-051",
    "field": "B",
    "original": "疹（herpes）",
    "replacement": "疱疹（herpes）"
  },
  {
    "questionId": "MOEX-112100-1301-Q030",
    "field": "C",
    "original": "屈長肌（flexor hallucis longus）",
    "replacement": "屈踇長肌（flexor hallucis longus）"
  },
  {
    "questionId": "MOEX-100140-1101-Q045",
    "field": "A",
    "original": "單純疹病毒（herpes simplex virus）",
    "replacement": "單純疱疹病毒（herpes simplex virus）"
  },
  {
    "questionId": "MOEX-100140-1101-Q048",
    "field": "A",
    "original": "疹性咽峽炎（herpangina）",
    "replacement": "疱疹性咽峽炎（herpangina）"
  },
  {
    "questionId": "MOEX-100140-1101-Q070",
    "field": "stem",
    "original": "一位患有尋常天瘡（Pemphigus vulgaris）的孕婦，剛剛平安產下 3000 公克的小男嬰，但是隨即發現小男嬰身上及四肢分布有紅斑，有些紅斑上有小水，因此迅速被送入新生兒加護病房治療。他的病因為何？",
    "replacement": "一位患有尋常天疱瘡（Pemphigus vulgaris）的孕婦，剛剛平安產下 3000 公克的小男嬰，但是隨即發現小男嬰身上及四肢分布有紅斑，有些紅斑上有小水疱，因此迅速被送入新生兒加護病房治療。他的病因為何？"
  },
  {
    "questionId": "MOEX-101030-1101-Q031",
    "field": "stem",
    "original": "下列何者與尾畸胎瘤（sacrococcygeal teratoma）的形成有關？",
    "replacement": "下列何者與骶尾畸胎瘤（sacrococcygeal teratoma）的形成有關？"
  },
  {
    "questionId": "MOEX-101030-1101-Q051",
    "field": "stem",
    "original": "單純疹病毒（Herpes simplex virus）之治療藥物樂威素（Acyclovir），其抑制病毒複製之機轉為何？",
    "replacement": "單純疱疹病毒（Herpes simplex virus）之治療藥物樂威素（Acyclovir），其抑制病毒複製之機轉為何？"
  },
  {
    "questionId": "MOEX-101030-1101-Q055",
    "field": "A",
    "original": "單純疹病毒（Herpes simplex virus）",
    "replacement": "單純疱疹病毒（Herpes simplex virus）"
  },
  {
    "questionId": "MOEX-100030-1101-Q039",
    "field": "B",
    "original": "硬（hard palate）",
    "replacement": "硬腭（hard palate）"
  },
  {
    "questionId": "MOEX-100030-1101-Q054",
    "field": "stem",
    "original": "抑制單純疹病毒之藥物acyclovir，其標的為何？",
    "replacement": "抑制單純疱疹病毒之藥物acyclovir，其標的為何？"
  },
  {
    "questionId": "MOEX-100030-1101-Q055",
    "field": "C",
    "original": "單純疹病毒（Herpes simplex virus）",
    "replacement": "單純疱疹病毒（Herpes simplex virus）"
  },
  {
    "questionId": "MOEX-100030-1101-Q057",
    "field": "stem",
    "original": "下列有關疹病毒（Herpesvirus）之敘述，何者錯誤？",
    "replacement": "下列有關疱疹病毒（Herpesvirus）之敘述，何者錯誤？"
  },
  {
    "questionId": "MOEX-100030-1101-Q057",
    "field": "B",
    "original": "唇部疹（cold sore）主要由第一型單純疹病毒（HSV-1）所引起",
    "replacement": "唇部疱疹（cold sore）主要由第一型單純疱疹病毒（HSV-1）所引起"
  },
  {
    "questionId": "MOEX-100030-1101-Q057",
    "field": "D",
    "original": "人類疹病毒第八型（HHV-8）感染產生卡波西氏肉瘤（Kaposi’s sarcoma）",
    "replacement": "人類疱疹病毒第八型（HHV-8）感染產生卡波西氏肉瘤（Kaposi’s sarcoma）"
  },
  {
    "questionId": "MOEX-112020-1301-Q028",
    "field": "C",
    "original": "屈長肌（flexor hallucis longus）",
    "replacement": "屈踇長肌（flexor hallucis longus）"
  },
  {
    "questionId": "MOEX-101030-2101-Q029",
    "field": "stem",
    "original": "去氧（deoxyuridylate, dUMP）轉變為胸（thymidylate, dTMP）之反應需要何種輔參與？",
    "replacement": "去氧尿苷（deoxyuridylate, dUMP）轉變為胸苷（thymidylate, dTMP）之反應需要何種輔參與？"
  },
  {
    "questionId": "MOEX-101030-2101-Q038",
    "field": "stem",
    "original": "下列何種 RNA，具最多的修飾核酸？",
    "replacement": "下列何種 RNA，具最多的修飾核苷酸？"
  },
  {
    "questionId": "MOEX-101110-2101-Q034",
    "field": "A",
    "original": "遺傳密碼子是由二個核酸（nucleotides）所構成",
    "replacement": "遺傳密碼子是由二個核苷酸（nucleotides）所構成"
  },
  {
    "questionId": "MOEX-101110-2101-Q034",
    "field": "B",
    "original": "遺傳密碼子是由核酸重複使用所構成",
    "replacement": "遺傳密碼子是由核苷酸重複使用所構成"
  },
  {
    "questionId": "MOEX-101110-2101-Q035",
    "field": "D",
    "original": "細胞中過多的 dATP 會抑制核酸還原的作用，而無法產生其他的 dNTP",
    "replacement": "細胞中過多的 dATP 會抑制核苷酸還原的作用，而無法產生其他的 dNTP"
  }
];

export function prepareWrongQuestionPdfQuestion(question: Question): Question {
  let prepared = question;
  for (const repair of SOURCE_REPAIRS) {
    if (repair.questionId !== question.id) continue;
    const current = repair.field === "stem" ? question.stem : question.options[repair.field];
    if (current !== repair.original) continue;
    if (prepared === question) prepared = { ...question, options: { ...question.options } };
    if (repair.field === "stem") prepared.stem = repair.replacement;
    else prepared.options[repair.field] = repair.replacement;
  }
  return prepared;
}
