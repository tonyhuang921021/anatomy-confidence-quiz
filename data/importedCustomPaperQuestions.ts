import type { Question } from "@/types/quiz";

export const importedCustomPaperQuestions: Question[] = [
  {
    id: "ANAT-HARD-001",
    subject: "解剖學",
    section: "消化系統／骨盆與會陰",
    chapter: "肛管解剖：齒狀線上下差異",
    stem: "關於肛管與其神經血管供應，下列何者正確？",
    options: {
      A: "肛管齒狀線以上疼痛主要經陰部神經傳入",
      B: "肛管齒狀線以下淋巴主要回流至內髂淋巴結",
      C: "肛管齒狀線以上靜脈回流可經上直腸靜脈進入門脈系統",
      D: "肛門內括約肌由骨骼肌構成，受陰部神經支配"
    },
    answer: "C",
    answerCreditType: "standard",
    explanation:
      "齒狀線以上來自內胚層／後腸，疼痛較不敏感，靜脈回流可經上直腸靜脈進入下腸繫膜靜脈，再進入門脈系統；淋巴多回流至內髂與下腸繫膜相關淋巴結。齒狀線以下來自外胚層／原肛，疼痛敏感，主要經陰部神經的 inferior rectal nerve 傳入，靜脈經中、下直腸靜脈進入體循環，淋巴多回流至淺腹股溝淋巴結。A 錯在齒狀線以下才主要經陰部神經。B 錯在齒狀線以下主要到淺腹股溝淋巴結。D 錯在內括約肌是平滑肌，外括約肌才是骨骼肌並受陰部神經支配。",
    testedConcept: "齒狀線上下的神經、靜脈、淋巴、胚胎來源差異",
    difficulty: "hard",
    source: "local",
    sourceCitation: "匯入自訂卷：很難的解剖十題"
  },
  {
    id: "ANAT-HARD-002",
    subject: "解剖學",
    section: "頭頸部／腦神經",
    chapter: "舌咽神經與咽反射",
    stem: "一位病人因顱底骨折導致右側舌後 1/3 味覺喪失、咽反射傳入路徑受損，但聲帶運動正常。最可能受損的神經節或神經為何？",
    options: {
      A: "geniculate ganglion",
      B: "inferior ganglion of glossopharyngeal nerve",
      C: "nodose ganglion of vagus nerve",
      D: "superior cervical ganglion"
    },
    answer: "B",
    answerCreditType: "standard",
    explanation:
      "舌後 1/3 味覺由舌咽神經 CN IX 負責，其味覺與一般感覺神經元細胞體位於 glossopharyngeal nerve 的 inferior ganglion。咽反射的傳入為 CN IX，傳出為 CN X。題幹提到咽反射傳入路徑受損，但聲帶運動正常，較支持 CN IX 受損而非 CN X 運動功能受損。A geniculate ganglion 屬 CN VII，與舌前 2/3 味覺相關。C nodose ganglion 是 CN X inferior ganglion，與內臟感覺及會厭附近味覺較相關。D superior cervical ganglion 是交感神經節，不是味覺神經節。",
    testedConcept: "CN IX 舌後 1/3 味覺與 gag reflex afferent",
    difficulty: "hard",
    source: "local",
    sourceCitation: "匯入自訂卷：很難的解剖十題"
  },
  {
    id: "ANAT-HARD-003",
    subject: "解剖學",
    section: "骨盆與會陰",
    chapter: "會陰淺隙與深隙",
    stem: "關於會陰淺隙與深隙，下列何者最正確？",
    options: {
      A: "尿道球腺位於會陰淺隙，因此其分泌物直接進入海綿體尿道",
      B: "會陰深隙內含外尿道括約肌與尿道球腺",
      C: "坐骨海綿體肌位於會陰深隙，包覆陰莖腳",
      D: "會陰淺隙的上界為會陰膜，下界為骨盆膈"
    },
    answer: "B",
    answerCreditType: "standard",
    explanation:
      "會陰淺隙主要含坐骨海綿體肌、球海綿體肌、淺橫會陰肌、陰莖腳、陰莖球與男性近端海綿體尿道。會陰深隙主要含外尿道括約肌、深橫會陰肌、尿道球腺與膜部尿道。A 錯在尿道球腺位於深隙，其導管穿過會陰膜後進入海綿體尿道。C 錯在坐骨海綿體肌位於淺隙。D 錯在會陰淺隙上界為會陰膜，下界為 Colles fascia，不是骨盆膈。",
    testedConcept: "superficial perineal pouch 與 deep perineal pouch 內容物",
    difficulty: "hard",
    source: "local",
    sourceCitation: "匯入自訂卷：很難的解剖十題"
  },
  {
    id: "ANAT-HARD-004",
    subject: "解剖學",
    section: "神經解剖／腦血管",
    chapter: "中大腦動脈分支與皮質功能定位",
    stem: "一名病人左側中大腦動脈 superior division 梗塞，最可能出現下列哪一組表現？",
    options: {
      A: "右側下肢無力為主，伴尿失禁",
      B: "右側臉與上肢無力為主，若優勢半球受損可有 Broca aphasia",
      C: "右側同向偏盲，伴 Wernicke aphasia",
      D: "左側眼裂變大、口角下垂、味覺喪失"
    },
    answer: "B",
    answerCreditType: "standard",
    explanation:
      "MCA superior division 主要供應 lateral frontal lobe，包括 primary motor cortex 的臉與上肢區，以及優勢半球的 Broca area。因此典型表現是對側臉、上肢無力大於下肢無力，若為優勢半球受損可出現 Broca aphasia。A 較符合 ACA 病灶，常以下肢無力、意志缺乏、尿失禁為主。C 較像 MCA inferior division 或顳頂葉、視放射相關病灶，Wernicke area 在 superior temporal gyrus。D 屬周邊 facial nerve lesion 的表現，不是 MCA superior division 梗塞。",
    testedConcept: "MCA superior division 供應 lateral frontal lobe 與 Broca area",
    difficulty: "hard",
    source: "local",
    sourceCitation: "匯入自訂卷：很難的解剖十題"
  },
  {
    id: "ANAT-HARD-005",
    subject: "解剖學",
    section: "頭頸部／腮腺與腦神經",
    chapter: "腮腺內構造與顏面神經",
    stem: "下列哪一個構造與腮腺手術中最需要避免傷害的神經分支走向最相關？",
    options: {
      A: "外頸動脈在腮腺外側分為 maxillary artery 與 superficial temporal artery",
      B: "facial nerve 進入腮腺後形成 parotid plexus，但不支配腮腺分泌",
      C: "glossopharyngeal nerve 穿過腮腺並支配咀嚼肌",
      D: "auriculotemporal nerve 是 facial nerve 的主要運動分支"
    },
    answer: "B",
    answerCreditType: "standard",
    explanation:
      "腮腺手術最怕傷到 facial nerve。CN VII 自 stylomastoid foramen 出來後進入腮腺，在腮腺內形成 parotid plexus，分成 temporal、zygomatic、buccal、marginal mandibular、cervical branches。但 CN VII 只是穿過腮腺，不支配腮腺分泌。腮腺副交感分泌路徑為 CN IX → tympanic nerve → lesser petrosal nerve → otic ganglion → auriculotemporal nerve → parotid gland。A 的外頸動脈分支不是本題問的主要神經手術風險。C 錯在 CN IX 不穿過腮腺支配咀嚼肌；咀嚼肌由 CN V3 支配。D 錯在 auriculotemporal nerve 是 V3 分支，攜帶副交感纖維到腮腺，不是 CN VII 運動分支。",
    testedConcept: "CN VII 穿過腮腺形成 parotid plexus，但腮腺分泌由 CN IX 副交感支配",
    difficulty: "hard",
    source: "local",
    sourceCitation: "匯入自訂卷：很難的解剖十題"
  },
  {
    id: "ANAT-HARD-006",
    subject: "解剖學",
    section: "腹部／腹股溝區",
    chapter: "腹股溝管與疝氣",
    stem: "關於腹股溝管與疝氣，下列何者正確？",
    options: {
      A: "indirect inguinal hernia 由 Hesselbach triangle 突出",
      B: "direct inguinal hernia 通常經 deep inguinal ring 進入腹股溝管",
      C: "deep inguinal ring 位於 inferior epigastric vessels 外側",
      D: "femoral hernia 位於 pubic tubercle 內上方，較常見於男性"
    },
    answer: "C",
    answerCreditType: "standard",
    explanation:
      "Deep inguinal ring 是 transversalis fascia 的開口，位於 inferior epigastric vessels 的外側。Indirect inguinal hernia 由 deep ring 進入腹股溝管，位於 inferior epigastric vessels 外側。Direct inguinal hernia 從 Hesselbach triangle 突出，位於 inferior epigastric vessels 內側，通常不經 deep ring。Femoral hernia 位於 femoral canal，位置在 pubic tubercle 外下方，較常見於女性。A、B 顛倒 direct 與 indirect 的路徑。D 的位置與流行病學皆錯。",
    testedConcept: "direct、indirect、femoral hernia 與 inferior epigastric vessels 的關係",
    difficulty: "hard",
    source: "local",
    sourceCitation: "匯入自訂卷：很難的解剖十題"
  },
  {
    id: "ANAT-HARD-007",
    subject: "解剖學",
    section: "頭頸部／眼眶",
    chapter: "眼外肌神經與眼眶通道",
    stem: "關於眼眶內神經與病灶表現，下列何者最正確？",
    options: {
      A: "abducens nerve 經 superior orbital fissure 進入眼眶，支配 superior oblique",
      B: "trochlear nerve 經 common tendinous ring 內進入眼眶，支配 lateral rectus",
      C: "oculomotor nerve inferior division 支配 inferior oblique，並帶副交感纖維至 ciliary ganglion",
      D: "optic nerve 經 superior orbital fissure 進入眼眶，伴 ophthalmic artery"
    },
    answer: "C",
    answerCreditType: "standard",
    explanation:
      "CN III superior division 支配 superior rectus 與 levator palpebrae superioris；CN III inferior division 支配 medial rectus、inferior rectus、inferior oblique，並帶副交感纖維到 ciliary ganglion。副交感路徑為 Edinger-Westphal nucleus → CN III inferior division → ciliary ganglion → short ciliary nerves → sphincter pupillae 與 ciliary muscle。A 錯在 CN VI 支配 lateral rectus，不是 superior oblique。B 錯在 CN IV 支配 superior oblique，且通常在 common tendinous ring 外進入眼眶。D 錯在 optic nerve 經 optic canal 進入眼眶，並伴 ophthalmic artery。",
    testedConcept: "CN III 分支、眼外肌支配與副交感路徑",
    difficulty: "hard",
    source: "local",
    sourceCitation: "匯入自訂卷：很難的解剖十題"
  },
  {
    id: "ANAT-HARD-008",
    subject: "解剖學",
    section: "神經解剖／腦神經",
    chapter: "舌下神經與皮質延髓徑",
    stem: "一名患者右側舌伸出時偏向右側，且右側舌肌萎縮。病灶最可能位於何處？",
    options: {
      A: "左側 corticobulbar tract above hypoglossal nucleus",
      B: "右側 hypoglossal nerve lesion",
      C: "右側 facial nerve marginal mandibular branch lesion",
      D: "左側 nucleus ambiguus lesion"
    },
    answer: "B",
    answerCreditType: "standard",
    explanation:
      "舌下神經 LMN lesion 會使舌頭伸出偏向病側，並可出現同側舌肌萎縮與 fasciculation。題目為右側舌伸出偏右且右側舌肌萎縮，因此最符合右側 hypoglossal nerve lesion。A 左側 corticobulbar tract above hypoglossal nucleus 是 UMN lesion，可造成舌偏右，但通常不會有明顯舌肌萎縮，因此是陷阱選項。C marginal mandibular branch 影響下唇表情肌，不支配舌肌。D nucleus ambiguus 與 CN IX、X、XI branchial motor 相關，影響吞嚥與發聲，不是舌伸出主軸。",
    testedConcept: "CN XII LMN lesion 與 UMN lesion 的舌偏斜差異",
    difficulty: "hard",
    source: "local",
    sourceCitation: "匯入自訂卷：很難的解剖十題"
  },
  {
    id: "ANAT-HARD-009",
    subject: "解剖學",
    section: "胸腔／肺與縱膈",
    chapter: "肺門與肺根排列",
    stem: "關於肺門與肺根構造排列，下列何者正確？",
    options: {
      A: "右肺肺門中，肺動脈通常位於主支氣管上方",
      B: "左肺肺門中，肺動脈通常位於主支氣管上方",
      C: "兩側肺門中，肺靜脈皆位於最上方",
      D: "右主支氣管較細、較水平，因此異物較不易進入"
    },
    answer: "B",
    answerCreditType: "standard",
    explanation:
      "肺門排列可用 RALS 記憶：Right pulmonary artery is Anterior to bronchus；Left pulmonary artery is Superior to bronchus。因此右肺中支氣管通常比肺動脈更上方，左肺中肺動脈通常比主支氣管更上方。肺靜脈多位於較前、較下方，不是最上方。右主支氣管較寬、短、垂直，因此異物較容易進入右側。A 錯在右肺不是肺動脈在主支氣管上方。C 錯在肺靜脈不是最上方。D 錯在右主支氣管較寬短垂直，異物較易進入。",
    testedConcept: "肺門 RALS 原則與右主支氣管異物吸入",
    difficulty: "hard",
    source: "local",
    sourceCitation: "匯入自訂卷：很難的解剖十題"
  },
  {
    id: "ANAT-HARD-010",
    subject: "解剖學",
    section: "神經解剖／大腦白質與腦血管",
    chapter: "內囊與 lenticulostriate arteries",
    stem: "關於內囊與腦血管病灶，下列何者最正確？",
    options: {
      A: "genu of internal capsule 主要含 corticospinal tract",
      B: "posterior limb of internal capsule 主要含 corticobulbar tract",
      C: "lenticulostriate arteries 損傷可造成 pure motor stroke",
      D: "anterior limb of internal capsule 完全不含額葉相關投射纖維"
    },
    answer: "C",
    answerCreditType: "standard",
    explanation:
      "內囊 anterior limb 含 frontopontine fibers 與 thalamocortical/corticothalamic fibers；genu 主要含 corticobulbar fibers；posterior limb 主要含 corticospinal fibers 與 somatosensory fibers。Lenticulostriate arteries 是 MCA 深穿支，供應 basal ganglia 與 internal capsule，若 posterior limb 受損，可造成典型 pure motor stroke，表現為對側臉、手、腳無力。A 錯在 genu 主要是 corticobulbar。B 錯在 posterior limb 主要是 corticospinal。D 錯在 anterior limb 含 frontopontine fibers，並非完全無額葉相關投射。",
    testedConcept: "internal capsule 各部位纖維與 lenticulostriate artery 梗塞",
    difficulty: "hard",
    source: "local",
    sourceCitation: "匯入自訂卷：很難的解剖十題"
  }
];

const importedCustomPaperQuestionMap = new Map(
  importedCustomPaperQuestions.map((question) => [question.id, question] as const)
);

export function getImportedCustomPaperQuestionsByIds(ids: string[]) {
  return ids
    .map((id) => importedCustomPaperQuestionMap.get(id))
    .filter((question): question is Question => Boolean(question));
}
