const fs = require("fs");
const vm = require("vm");

const file = "/Users/huangguanlun/Documents/New project/data/anatomyQuestions.ts";

const text = fs.readFileSync(file, "utf8");
const arrayMatch = text.match(
  /export const anatomyQuestions: Question\[] = \[([\s\S]*?)\n\];\n\nexport const anatomyOutline = \[/
);
const outlineMatch = text.match(/export const anatomyOutline = \[([\s\S]*?)\] as const;/);

if (!arrayMatch || !outlineMatch) {
  throw new Error("Could not parse anatomyQuestions.ts");
}

const questions = vm.runInNewContext(`[${arrayMatch[1]}]`);
const outlineRaw = outlineMatch[1].trim();

const normalize = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const containsAny = (textValue, patterns) => patterns.some((pattern) => textValue.includes(pattern));

const rules = {
  "腦神經": [
    [["動眼神經", "oculomotor", "睫狀神經節"], "動眼神經與睫狀神經節"],
    [["滑車神經", "trochlear", "上斜肌"], "滑車神經與上斜肌"],
    [["外展神經", "abducens", "外直肌"], "外展神經與外直肌"],
    [["顏面神經", "facial nerve", "鼓索", "表情肌"], "顏面神經功能與分支"],
    [["三叉神經", "trigeminal", "V1", "V2", "V3"], "三叉神經分支與支配"],
    [["舌咽神經", "glossopharyngeal"], "舌咽神經功能"],
    [["迷走神經", "vagus", "喉返神經"], "迷走神經與喉返神經"],
    [["舌下神經", "hypoglossal", "伸舌"], "舌下神經與舌肌支配"],
    [["副神經", "accessory nerve", "胸鎖乳突肌", "斜方肌"], "副神經支配肌群"],
    [["味覺", "舌前", "舌後"], "味覺與舌部神經支配"]
  ],
  "腦幹核區": [
    [["疑核", "nucleus ambiguus"], "疑核功能"],
    [["孤束核", "nucleus solitarius", "孤束"], "孤束核與內臟感覺"],
    [["舌下神經核", "hypoglossal nucleus"], "舌下神經核定位"],
    [["顏面丘", "facial colliculus"], "顏面丘解剖"],
    [["Edinger-Westphal", "動眼神經副核"], "動眼神經副核"],
    [["脊髓三叉核", "spinal trigeminal"], "三叉神經脊髓核"],
    [["前庭神經核", "vestibular nuclei"], "前庭神經核群"],
    [["外展神經核", "abducens nucleus"], "外展神經核"],
    [["第四腦室", "hypoglossal trigone", "vagal trigone"], "第四腦室底與核區對應"]
  ],
  "視覺路徑": [
    [["Meyer", "顳葉", "上象限"], "Meyer’s loop 與視野缺損"],
    [["視交叉", "雙顳側", "bitemporal"], "視交叉病灶"],
    [["視束", "optic tract", "同向偏盲"], "視束病灶定位"],
    [["外側膝狀體", "lateral geniculate"], "外側膝狀體定位"],
    [["枕葉", "距狀裂", "cuneus", "lingual"], "視皮質與象限定位"]
  ],
  "聽覺與前庭路徑": [
    [["上橄欖", "superior olivary"], "上橄欖核與聲音定位"],
    [["耳蝸核", "cochlear nuclei"], "耳蝸核為聽覺第一中繼站"],
    [["內側膝狀體", "medial geniculate"], "內側膝狀體"],
    [["前庭眼反射", "vestibulo-ocular", "VOR"], "前庭眼反射"],
    [["聽神經瘤", "acoustic neuroma", "內耳道"], "內耳道神經與聽神經瘤"]
  ],
  "丘腦與基底核": [
    [["VPL"], "丘腦 VPL"],
    [["VPM"], "丘腦 VPM"],
    [["VA", "VL", "ventral anterior", "ventral lateral"], "丘腦運動核群"],
    [["subthalamic", "hemiballismus", "下丘腦核"], "下丘腦核與 hemiballismus"],
    [["黑質", "substantia nigra"], "黑質功能"],
    [["尾狀核", "被殼", "蒼白球", "lentiform"], "基底核構成與功能"]
  ],
  "小腦": [
    [["dysmetria", "ataxia", "測距不良"], "小腦半球病灶"],
    [["前庭小腦", "flocculonodular"], "前庭小腦功能"],
    [["脊髓小腦", "spinocerebellar"], "脊髓小腦功能"],
    [["小腦腳", "superior cerebellar peduncle", "middle cerebellar peduncle", "inferior cerebellar peduncle"], "小腦腳傳入傳出"]
  ],
  "脊髓傳導路徑": [
    [["脊髓丘腦", "spinothalamic", "痛", "溫度"], "脊髓丘腦徑功能"],
    [["背柱", "後索", "gracile", "cuneate"], "背柱內側丘系統"],
    [["皮質脊髓", "corticospinal"], "皮質脊髓徑"],
    [["Brown-Séquard", "半側脊髓"], "Brown-Séquard 症候群"],
    [["posterolateral sulcus", "後外側溝"], "脊髓神經根進出位置"]
  ],
  "自律神經": [
    [["Horner", "縮瞳", "無汗", "上眼瞼下垂"], "Horner syndrome 路徑"],
    [["頸上神經節", "superior cervical ganglion"], "頸上神經節"],
    [["腹腔神經節", "celiac ganglion"], "椎前神經節"],
    [["交感幹", "sympathetic trunk", "白交通枝", "灰交通枝"], "交感幹與交通枝"],
    [["副交感", "pelvic splanchnic", "骨盆內臟神經"], "副交感路徑"]
  ],
  "顏面神經與三叉神經": [
    [["顏面神經", "腮腺", "parotid"], "顏面神經與腮腺關係"],
    [["三叉神經", "trigeminal", "角膜反射"], "三叉神經感覺分支"],
    [["四角形空間", "quadrangular"], "肩胛區與腋神經"]
  ],
  "頸動脈鞘": [
    [["頸動脈鞘", "carotid sheath"], "頸動脈鞘內容物"],
    [["頸內動脈", "頸外動脈"], "頸內外動脈辨識"],
    [["頸動脈竇", "carotid sinus"], "頸動脈竇與頸動脈小體"]
  ],
  "咽喉解剖": [
    [["喉返神經", "recurrent laryngeal"], "喉返神經走行"],
    [["咽反射", "gag reflex"], "咽反射傳入傳出"],
    [["聲帶", "喉肌", "發聲"], "喉內在肌與聲帶運動"]
  ],
  "舌與味覺": [
    [["舌前", "鼓索", "舌神經"], "舌前 2/3 感覺與味覺"],
    [["舌後", "舌咽神經"], "舌後 1/3 感覺與味覺"],
    [["舌下神經", "伸舌"], "舌肌運動支配"]
  ],
  "甲狀腺與副甲狀腺": [
    [["甲狀腺上動脈", "superior thyroid"], "甲狀腺上動脈來源"],
    [["甲狀腺下動脈", "inferior thyroid"], "甲狀腺下動脈來源"],
    [["副甲狀腺", "parathyroid"], "副甲狀腺位置與血供"]
  ],
  "心臟與冠狀動脈": [
    [["右冠狀動脈", "RCA"], "右冠狀動脈分支"],
    [["左前降支", "LAD", "前室間"], "左前降支供血"],
    [["迴旋支", "circumflex"], "左迴旋支供血"],
    [["優勢型", "posterior interventricular", "後降支"], "冠狀動脈優勢型"],
    [["心小靜脈", "心大靜脈", "冠狀竇"], "心臟靜脈回流"]
  ],
  "縱膈": [
    [["胸導管", "thoracic duct"], "胸導管走行"],
    [["迷走神經", "phrenic nerve", "膈神經"], "縱膈神經走行"],
    [["食道", "azygos", "奇靜脈"], "後縱膈主要構造"]
  ],
  "肺與胸膜": [
    [["肺門", "hilum", "肺動脈", "支氣管"], "肺門構造相對位置"],
    [["thoracentesis", "胸腔穿刺"], "胸腔穿刺解剖"],
    [["胸膜", "pleura", "肋膈隱窩"], "胸膜與肋膈隱窩"]
  ],
  "橫膈": [
    [["T8", "T10", "T12", "食道裂孔", "腔靜脈裂孔", "主動脈裂孔"], "橫膈三大開口"],
    [["呼吸", "腰方肌"], "呼吸輔助肌與橫膈功能"]
  ],
  "腹膜關係": [
    [["次發性後腹膜", "retroperitoneal"], "次發性後腹膜器官"],
    [["小網膜", "lesser omentum"], "小網膜構成"],
    [["腹膜", "greater sac", "lesser sac"], "腹膜腔分區"]
  ],
  "胃腸道血管": [
    [["腹腔幹", "celiac"], "前腸血供"],
    [["上腸繫膜", "superior mesenteric"], "中腸血供"],
    [["下腸繫膜", "inferior mesenteric"], "後腸血供"],
    [["闌尾", "appendix"], "闌尾動脈"]
  ],
  "肝膽胰脾": [
    [["脾動脈", "splenic artery"], "脾動脈走行"],
    [["膽囊", "cystic"], "膽囊與膽囊動脈"],
    [["胰", "pancreas"], "胰臟鄰近關係"],
    [["肝", "hepatoduodenal", "portal triad"], "肝十二指腸韌帶與 portal triad"]
  ],
  "腎臟與後腹腔": [
    [["VAP", "腎門"], "腎門前後排列"],
    [["輸尿管", "ureter"], "輸尿管走行"],
    [["腎", "後腹膜"], "腎臟後腹膜關係"]
  ],
  "門脈系統": [
    [["門靜脈", "portal vein"], "門靜脈形成"],
    [["portosystemic", "食道靜脈曲張", "caput medusae"], "門體循環吻合"]
  ],
  "骨盆血管": [
    [["髂內動脈", "internal iliac"], "髂內動脈分支"],
    [["obturator", "閉孔動脈"], "閉孔動脈走行"],
    [["陰部", "pudendal"], "陰部血管供應"]
  ],
  "泌尿生殖": [
    [["卵巢韌帶", "ovarian ligament"], "卵巢韌帶與懸韌帶"],
    [["子宮", "uterus"], "子宮支持構造"],
    [["儲精囊", "vesicle", "前列腺", "攝護腺"], "男性骨盆生殖器關係"]
  ],
  "直腸與肛管": [
    [["齒狀線", "dentate"], "齒狀線上下差異"],
    [["肛門外括約肌", "inferior rectal"], "肛門外括約肌神經支配"],
    [["痔", "hemorrhoid"], "直腸靜脈回流與痔"]
  ],
  "會陰三角": [
    [["superficial perineal pouch", "會陰淺層間隙"], "會陰淺層間隙內容物"],
    [["deep perineal pouch", "深層間隙"], "會陰深層間隙內容物"],
    [["提肛肌", "levator ani"], "骨盆底與會陰支持"]
  ],
  "臂神經叢": [
    [["Erb", "C5", "C6"], "Erb palsy"],
    [["Klumpke", "C8", "T1"], "Klumpke palsy"],
    [["median", "ulnar", "radial", "musculocutaneous", "axillary"], "臂神經叢終末分支"]
  ],
  "肩胛區": [
    [["quadrangular space", "四角形空間"], "四角形空間內容物"],
    [["rotator cuff", "旋轉肌袖"], "旋轉肌袖肌群"],
    [["肩關節", "glenohumeral"], "肩關節穩定構造"]
  ],
  "前臂屈伸肌": [
    [["尺神經", "ulnar nerve"], "前臂屈肌神經支配"],
    [["正中神經", "median nerve"], "正中神經支配前臂肌群"],
    [["橈神經", "radial nerve"], "前臂伸肌神經支配"]
  ],
  "手部肌肉": [
    [["蚓狀肌", "lumbrical"], "蚓狀肌作用與支配"],
    [["骨間肌", "interossei"], "骨間肌作用"],
    [["魚際", "thenar"], "魚際肌群支配"],
    [["腕隧道", "carpal tunnel"], "腕隧道內容物"]
  ],
  "上肢血管": [
    [["腋動脈", "axillary artery"], "腋動脈分段與分支"],
    [["橈動脈", "尺動脈"], "前臂主要動脈"],
    [["掌淺弓", "掌深弓"], "手部動脈弓"]
  ],
  "腰薦神經叢": [
    [["坐骨神經", "sciatic"], "坐骨神經支配"],
    [["閉孔神經", "obturator"], "閉孔神經支配"],
    [["股神經", "femoral nerve"], "股神經支配"],
    [["腓總神經", "common fibular", "deep fibular", "superficial fibular"], "腓總神經及分支"]
  ],
  "臀區": [
    [["上臀神經", "superior gluteal"], "上臀神經支配"],
    [["下臀神經", "inferior gluteal"], "下臀神經支配"],
    [["piriformis", "梨狀肌"], "梨狀肌與坐骨神經關係"]
  ],
  "大腿前內後區": [
    [["adductor", "內收"], "大腿內收肌群"],
    [["hamstring", "後群", "坐骨神經"], "大腿後群支配"],
    [["股四頭", "quadriceps"], "大腿前群功能與支配"]
  ],
  "小腿肌群": [
    [["前區隔", "anterior compartment"], "小腿前群肌肉"],
    [["後區隔", "posterior compartment"], "小腿後群肌肉"],
    [["foot drop", "足下垂"], "足下垂與腓總神經"],
    [["脛後肌", "tibialis posterior"], "脛後肌功能"]
  ],
  "足部": [
    [["第一趾", "第一趾與第二趾", "deep fibular"], "第一趾蹼間感覺與腓深神經"],
    [["足弓", "arch", "flatfoot", "pes planus"], "足弓支撐機制"],
    [["足底內側", "medial plantar"], "足底內側神經分布"],
    [["足底外側", "lateral plantar"], "足底外側神經分布"]
  ],
  "下肢血管": [
    [["膕動脈", "popliteal"], "膕動脈與膝窩解剖"],
    [["足背動脈", "dorsalis pedis", "pedis dorsalis"], "足背動脈觸診"],
    [["脛後動脈", "posterior tibial"], "脛後動脈觸診"],
    [["股動脈", "femoral artery"], "股動脈走行"],
    [["大隱靜脈", "great saphenous"], "大隱靜脈回流"]
  ]
};

function cleanFallback(stem) {
  return normalize(stem)
    .replace(/^承上題[，,、]?/, "")
    .replace(/^下列何者[最]?/, "")
    .replace(/^有關/, "")
    .replace(/^關於/, "")
    .replace(/^若病人/, "")
    .replace(/^如果病人/, "")
    .replace(/[？?。].*$/, "")
    .replace(/^(是|為|與)/, "")
    .slice(0, 22);
}

function generateConcept(question) {
  const haystack = `${normalize(question.stem)} ${normalize(question.explanation)} ${Object.values(
    question.options
  )
    .map(normalize)
    .join(" ")}`;
  const sectionRules = rules[question.section] ?? [];

  for (const [patterns, label] of sectionRules) {
    if (containsAny(haystack, patterns)) {
      return label;
    }
  }

  return `${question.section}｜${cleanFallback(question.stem)}`;
}

let updated = 0;

for (const question of questions) {
  if (!question || question.sourceType !== "MOEX_PAST_EXAM") {
    continue;
  }
  question.testedConcept = generateConcept(question);
  updated += 1;
}

const output = `import type { Question } from "@/types/quiz";\n\nexport const anatomyQuestions: Question[] = ${JSON.stringify(
  questions,
  null,
  2
)};\n\nexport const anatomyOutline = [\n${outlineRaw}\n] as const;\n`;

fs.writeFileSync(file, output);
console.log(JSON.stringify({ updated }, null, 2));
