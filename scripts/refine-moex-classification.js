const fs = require("fs");
const vm = require("vm");

const file = "/Users/huangguanlun/Documents/New project/data/anatomyQuestions.ts";

const anatomyOutline = [
  {
    chapter: "神經解剖",
    sections: [
      "腦神經",
      "腦幹核區",
      "視覺路徑",
      "聽覺與前庭路徑",
      "丘腦與基底核",
      "小腦",
      "脊髓傳導路徑",
      "自律神經"
    ]
  },
  {
    chapter: "頭頸部",
    sections: ["顏面神經與三叉神經", "頸動脈鞘", "咽喉解剖", "舌與味覺", "甲狀腺與副甲狀腺"]
  },
  {
    chapter: "胸腔",
    sections: ["心臟與冠狀動脈", "縱膈", "肺與胸膜", "橫膈"]
  },
  {
    chapter: "腹部",
    sections: ["腹膜關係", "胃腸道血管", "肝膽胰脾", "腎臟與後腹腔", "門脈系統"]
  },
  {
    chapter: "骨盆與會陰",
    sections: ["骨盆血管", "泌尿生殖", "直腸與肛管", "會陰三角"]
  },
  {
    chapter: "上肢",
    sections: ["臂神經叢", "肩胛區", "前臂屈伸肌", "手部肌肉", "上肢血管"]
  },
  {
    chapter: "下肢",
    sections: ["腰薦神經叢", "臀區", "大腿前內後區", "小腿肌群", "足部", "下肢血管"]
  }
];

const sectionToChapter = new Map(
  anatomyOutline.flatMap((item) => item.sections.map((section) => [section, item.chapter]))
);

const sectionRules = {
  "腦神經": [
    "腦神經", "cranial nerve", "動眼神經", "滑車神經", "外展神經", "舌咽神經", "副神經",
    "舌下神經", "睫狀神經節", "翼腭神經節", "耳神經節", "下頜下神經節"
  ],
  "腦幹核區": [
    "疑核", "孤束核", "舌下神經核", "顏面丘", "第四腦室底", "動眼神經副核", "edinger",
    "脊髓三叉核", "前庭神經核", "外展神經核", "腦幹核"
  ],
  "視覺路徑": [
    "視神經", "視交叉", "視束", "視放射", "optic chiasm", "optic tract", "optic radiation",
    "meyer", "雙顳側偏盲", "同向偏盲", "外側膝狀體", "枕葉", "距狀裂"
  ],
  "聽覺與前庭路徑": [
    "耳蝸", "蝸牛", "前庭", "vestibular", "cochlear", "上橄欖", "下丘", "內側膝狀體",
    "內耳道", "聽神經瘤", "前庭眼反射", "聽覺"
  ],
  "丘腦與基底核": [
    "丘腦", "vpl", "vpm", "vl", "va", "基底核", "尾狀核", "被殼", "蒼白球", "黑質",
    "subthalamic", "hemiballismus", "內囊"
  ],
  "小腦": [
    "小腦", "cerebell", "ataxia", "dysmetria", "意向性震顫", "小腦腳", "flocculonodular",
    "spinocerebellar", "前庭小腦"
  ],
  "脊髓傳導路徑": [
    "脊髓丘腦", "spinothalamic", "背柱", "後索", "gracile", "cuneate", "皮質脊髓",
    "corticospinal", "brown-s", "半側脊髓", "posterolateral sulcus", "脊髓傳導", "脊髓損傷"
  ],
  "自律神經": [
    "horner", "交感", "副交感", "白交通枝", "灰交通枝", "頸上神經節", "交感幹",
    "腹腔神經節", "骨盆內臟神經", "pelvic splanchnic", "自律神經"
  ],
  "顏面神經與三叉神經": [
    "顏面神經", "面神經", "三叉神經", "trigeminal", "腮腺", "parotid", "角膜反射",
    "v1", "v2", "v3", "顏面", "上頜神經", "下頜神經", "眼神經"
  ],
  "頸動脈鞘": [
    "頸動脈鞘", "carotid sheath", "頸動脈竇", "頸動脈小體", "頸內靜脈", "頸總動脈",
    "頸內動脈", "頸外動脈", "迷走神經位於"
  ],
  "咽喉解剖": [
    "喉", "lary", "聲帶", "聲門", "喉返神經", "recurrent laryngeal", "環甲", "杓",
    "咽", "pharynx", "gag reflex", "吞嚥", "會厭", "甲狀軟骨", "環狀軟骨"
  ],
  "舌與味覺": [
    "舌", "味覺", "鼓索", "舌神經", "舌前", "舌後", "舌乳頭", "vallate", "fungiform",
    "filiform", "genioglossus", "hyoglossus", "styloglossus"
  ],
  "甲狀腺與副甲狀腺": [
    "甲狀腺", "thyroid", "副甲狀腺", "parathyroid", "甲狀腺上動脈", "甲狀腺下動脈"
  ],
  "心臟與冠狀動脈": [
    "心臟", "冠狀動脈", "coronary", "lad", "rca", "circumflex", "冠狀竇", "心瓣膜",
    "房室結", "竇房結", "心室", "心房", "papillary muscle"
  ],
  "縱膈": [
    "縱膈", "mediast", "胸導管", "thoracic duct", "奇靜脈", "azygos", "食道", "esophagus",
    "氣管分叉", "胸腺", "後縱膈", "前縱膈", "中縱膈"
  ],
  "肺與胸膜": [
    "肺", "lung", "支氣管", "bronch", "肺門", "hilum", "胸膜", "pleura", "肋膈隱窩",
    "thoracentesis", "葉間裂", "肺葉", "肺段"
  ],
  "橫膈": [
    "橫膈", "diaphragm", "膈神經", "phrenic nerve", "t8", "t10", "t12", "食道裂孔",
    "主動脈裂孔", "腔靜脈裂孔"
  ],
  "腹膜關係": [
    "腹膜", "peritone", "小網膜", "大網膜", "網膜囊", "lesser sac", "greater sac",
    "次發性後腹膜", "mesentery", "腸繫膜", "腹膜後"
  ],
  "胃腸道血管": [
    "腹腔幹", "celiac", "上腸繫膜", "下腸繫膜", "superior mesenteric", "inferior mesenteric",
    "空腸", "迴腸", "結腸", "盲腸", "闌尾", "appendix", "中腸", "前腸", "後腸"
  ],
  "肝膽胰脾": [
    "肝", "hepat", "膽", "gallbladder", "胰", "pancre", "脾", "splenic", "cystic",
    "portal triad", "肝十二指腸韌帶"
  ],
  "腎臟與後腹腔": [
    "腎", "renal", "輸尿管", "ureter", "腎門", "vap", "後腹腔", "retroperitone", "腎上腺"
  ],
  "門脈系統": [
    "門靜脈", "portal vein", "portosystemic", "食道靜脈曲張", "caput medusae", "脾靜脈",
    "上腸繫膜靜脈", "下腸繫膜靜脈"
  ],
  "骨盆血管": [
    "髂內動脈", "internal iliac", "閉孔動脈", "obturator artery", "陰部內動脈", "internal pudendal",
    "骨盆血管", "superior vesical", "uterine artery", "middle rectal"
  ],
  "泌尿生殖": [
    "子宮", "uterus", "卵巢", "ovary", "輸卵管", "子宮頸", "子宮圓韌帶", "卵巢韌帶",
    "懸韌帶", "精索", "輸精管", "前列腺", "攝護腺", "精囊", "陰莖", "陰蒂", "睪丸",
    "附睪", "生殖", "膀胱"
  ],
  "直腸與肛管": [
    "直腸", "rectum", "肛管", "anal canal", "齒狀線", "dentate", "痔", "hemorrhoid",
    "肛門外括約肌", "肛門內括約肌", "inferior rectal", "superior rectal"
  ],
  "會陰三角": [
    "會陰", "perine", "骨盆橫膈", "pelvic diaphragm", "提肛肌", "levator ani", "尾骨肌",
    "尿生殖三角", "肛門三角", "會陰淺橫肌", "會陰深橫肌", "bulbospongiosus",
    "ischiocavernosus", "deep perineal pouch", "superficial perineal pouch"
  ],
  "臂神經叢": [
    "臂神經叢", "brachial plexus", "erb", "klumpke", "musculocutaneous", "median nerve",
    "ulnar nerve", "radial nerve", "axillary nerve", "long thoracic nerve"
  ],
  "肩胛區": [
    "肩胛", "scap", "旋轉肌袖", "rotator cuff", "四角形空間", "quadrangular space",
    "三角間隙", "肩關節", "glenohumeral", "肩峰", "喙突", "肩胛棘"
  ],
  "前臂屈伸肌": [
    "前臂", "forearm", "屈腕", "伸腕", "旋前", "旋後", "肱橈肌", "橈側屈腕肌",
    "尺側屈腕肌", "指淺屈肌", "指深屈肌", "旋前圓肌", "旋後肌", "extensor digitorum"
  ],
  "手部肌肉": [
    "手部", "手掌", "掌骨間", "骨間肌", "蚓狀肌", "lumbrical", "thenar", "hypothenar",
    "魚際", "小魚際", "腕隧道", "carpal tunnel", "掌腱膜"
  ],
  "上肢血管": [
    "腋動脈", "axillary artery", "肱動脈", "brachial artery", "橈動脈", "radial artery",
    "尺動脈", "ulnar artery", "掌淺弓", "掌深弓", "上肢血管", "cephalic vein", "basilic vein"
  ],
  "腰薦神經叢": [
    "腰薦神經叢", "lumbosacral plexus", "股神經", "femoral nerve", "閉孔神經", "obturator nerve",
    "坐骨神經", "sciatic", "腓總神經", "common fibular", "脛神經", "tibial nerve", "隱神經"
  ],
  "臀區": [
    "臀", "glute", "梨狀肌", "piriformis", "上臀神經", "下臀神經", "臀大肌", "臀中肌",
    "臀小肌", "坐骨大孔", "坐骨小孔"
  ],
  "大腿前內後區": [
    "大腿", "thigh", "股四頭肌", "quadriceps", "hamstring", "內收", "adductor", "縫匠肌",
    "股薄肌", "半腱肌", "半膜肌", "股二頭肌", "股三角", "收肌管"
  ],
  "小腿肌群": [
    "小腿", "leg", "前區隔", "anterior compartment", "後區隔", "posterior compartment",
    "外側區隔", "lateral compartment", "脛前肌", "脛後肌", "腓骨長肌", "腓骨短肌",
    "足下垂", "foot drop", "跟腱", "阿基里斯"
  ],
  "足部": [
    "足弓", "足底", "趾", "hallux", "plantar aponeurosis", "蹠骨", "楔骨", "足內翻",
    "足外翻", "第一趾與第二趾", "第一趾蹼"
  ],
  "下肢血管": [
    "股動脈", "femoral artery", "膕動脈", "popliteal artery", "足背動脈", "dorsalis pedis",
    "pedis dorsalis", "脛後動脈", "posterior tibial artery", "大隱靜脈", "great saphenous",
    "小隱靜脈", "femoral vein"
  ]
};

const suspiciousPatterns = [
  "隱翅蟲", "愛滋病", "衛生教育", "心理健康", "死亡率", "保險套", "病媒", "流行病學", "預防教育"
];

function parseQuestionsFile(sourceText) {
  const startMarker = "export const anatomyQuestions: Question[] = ";
  const outlineMarker = "\n\nexport const anatomyOutline = ";
  const start = sourceText.indexOf(startMarker);
  const outlineStart = sourceText.indexOf(outlineMarker);

  if (start === -1 || outlineStart === -1) {
    throw new Error("Could not parse anatomyQuestions.ts");
  }

  const questionsLiteral = sourceText
    .slice(start + startMarker.length, outlineStart)
    .trim()
    .replace(/;$/, "");
  const outlineLiteral = sourceText.slice(outlineStart + "\n\nexport const anatomyOutline = ".length).trim();

  return {
    questions: vm.runInNewContext(questionsLiteral),
    outlineLiteral
  };
}

function normalize(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/[（）()]/g, " ")
    .replace(/[，、；：]/g, " ")
    .trim()
    .toLowerCase();
}

function getSearchText(question) {
  return normalize(
    [
      question.stem,
      ...Object.values(question.options ?? {}),
      question.explanation,
      question.testedConcept,
      question.sourceCitation
    ].join(" ")
  );
}

function scoreSection(text, section) {
  const patterns = sectionRules[section] ?? [];
  let score = 0;

  for (const pattern of patterns) {
    if (text.includes(normalize(pattern))) {
      score += pattern.length >= 6 ? 3 : 2;
    }
  }

  if (text.includes(normalize(section))) {
    score += 4;
  }

  return score;
}

function classifyQuestion(question) {
  const text = getSearchText(question);
  const ranked = Object.keys(sectionRules)
    .map((section) => ({ section, score: scoreSection(text, section) }))
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  const second = ranked[1];
  const hasSuspiciousText = suspiciousPatterns.some((pattern) => text.includes(normalize(pattern)));
  const confident = best && best.score >= 4 && best.score >= (second?.score ?? 0) + 1;

  if (!confident) {
    return {
      chapter: question.chapter,
      section: question.section,
      changed: false,
      reason: hasSuspiciousText ? "suspicious-kept" : "low-confidence-kept"
    };
  }

  const chapter = sectionToChapter.get(best.section);

  if (!chapter) {
    return {
      chapter: question.chapter,
      section: question.section,
      changed: false,
      reason: "missing-chapter-map"
    };
  }

  const changed = question.chapter !== chapter || question.section !== best.section;
  return {
    chapter,
    section: best.section,
    changed,
    reason: hasSuspiciousText ? "suspicious-reclassified" : "reclassified"
  };
}

const sourceText = fs.readFileSync(file, "utf8");
const { questions, outlineLiteral } = parseQuestionsFile(sourceText);

let changed = 0;
let kept = 0;
let suspicious = 0;
const sampledChanges = [];
const sampledSuspicious = [];

for (const question of questions) {
  if (question?.sourceType !== "MOEX_PAST_EXAM") {
    continue;
  }

  const result = classifyQuestion(question);
  const original = `${question.chapter} / ${question.section}`;

  if (result.reason.startsWith("suspicious")) {
    suspicious += 1;
    if (sampledSuspicious.length < 12) {
      sampledSuspicious.push({
        id: question.id,
        original,
        stem: question.stem.slice(0, 48)
      });
    }
  }

  if (result.changed) {
    question.chapter = result.chapter;
    question.section = result.section;
    changed += 1;
    if (sampledChanges.length < 20) {
      sampledChanges.push({
        id: question.id,
        from: original,
        to: `${result.chapter} / ${result.section}`
      });
    }
  } else {
    kept += 1;
  }
}

const output = `import type { Question } from "@/types/quiz";\n\nexport const anatomyQuestions: Question[] = ${JSON.stringify(
  questions,
  null,
  2
)};\n\nexport const anatomyOutline = ${outlineLiteral}\n`;

fs.writeFileSync(file, output);
console.log(
  JSON.stringify(
    {
      changed,
      kept,
      suspicious,
      sampledChanges,
      sampledSuspicious
    },
    null,
    2
  )
);
