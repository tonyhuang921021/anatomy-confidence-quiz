export type PharmacologyDrugPriority = "A" | "B" | "C" | "D" | "E";

export type PharmacologyDrugCard = {
  name: string;
  category: string;
  mechanism: string;
  indications: string;
  effects: string;
  mnemonic: string;
  examLevel: PharmacologyDrugPriority;
  drawWeight: number;
};

export const PHARMACOLOGY_FLASHCARDS: PharmacologyDrugCard[] = [
  {
    "name": "Trimethoprim",
    "category": "感染科 > 抗生素 > DHFR抑制",
    "mechanism": "抑制細菌dihydrofolate reductase",
    "indications": "細菌感染治療（菌種依藥物光譜）",
    "effects": "干擾DNA/RNA或細胞分裂，產生細胞毒性",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "A",
    "drawWeight": 10
  },
  {
    "name": "Misoprostol",
    "category": "自泌素 > Eicosanoid > PGE1類似物",
    "mechanism": "PGE1類似物，抑制胃酸並促進子宮收縮",
    "indications": "抗凝血：PGI2(COX-2 生成)；降低胃酸分泌、促進蠕動；血管舒張，血壓下降；血管舒張，血壓遽降",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號；PDF重點：米菲(mife)晚餐(dino)喝了味噌(miso)後被車撞到(carbo)就流產了→子宮收縮for 墮胎；支氣管擴張：PGI2、PGE2",
    "mnemonic": "p.61: Dinoprostone • Miss(Mis-)Dinosaur(Dino-) 恐龍妹開車(Car-)(老司機)，有了小孩沒人敢要，只好墮胎\np.61: • Miss(Mis-)Dinosaur(Dino-) 恐龍妹開車(Car-)吃嗎啡(Mife-)，碰!流產了🡺墮胎藥\np.79: 米飛兔懷孕了要吃墮胎藥：米飛兔(Mife-)喝味噌(miso-)湯",
    "examLevel": "A",
    "drawWeight": 10
  },
  {
    "name": "Metronidazole",
    "category": "感染科 > 抗生素 > Nitroimidazole",
    "mechanism": "厭氧菌/原蟲還原後形成自由基，破壞DNA",
    "indications": "細菌感染治療（菌種依藥物光譜）",
    "effects": "干擾DNA/RNA或細胞分裂，產生細胞毒性",
    "mnemonic": "p.116: 蓋地板(台語，起頭咖)(Ketoco-)對阿祖(-azole)來說是一種苦行(Cushing)，可以治Cushing syndrome\np.116: 阿祖(-azole)看到爛(lanosterol)人很不爽，他踢他屁屁(P450)，剁他耳朵(ergosterol)",
    "examLevel": "A",
    "drawWeight": 10
  },
  {
    "name": "Metronidazole",
    "category": "腸胃科 > H. pylori用藥",
    "mechanism": "抗H. pylori抗生素；常與PPI/鉍劑併用",
    "indications": "GERD、消化性潰瘍、胃酸過多或H. pylori輔助治療",
    "effects": "抑制胃酸分泌",
    "mnemonic": "p.116: 蓋地板(台語，起頭咖)(Ketoco-)對阿祖(-azole)來說是一種苦行(Cushing)，可以治Cushing syndrome\np.116: 阿祖(-azole)看到爛(lanosterol)人很不爽，他踢他屁屁(P450)，剁他耳朵(ergosterol)",
    "examLevel": "A",
    "drawWeight": 10
  },
  {
    "name": "Amiodarone",
    "category": "內分泌/新陳代謝 > 甲狀腺 > 其他",
    "mechanism": "含碘且抑制周邊T4轉T3；可造成甲狀腺功能異常",
    "indications": "多種心律不整，尤其難治性VT/VF與AF節律控制",
    "effects": "Class III為主延長AP與QT，兼具Na/K/Ca與β阻斷；含碘，注意肺/肝/甲狀腺/角膜毒性",
    "mnemonic": "p.71: Lio(3個字母-T3)；Levo(4個字母-T4)",
    "examLevel": "A",
    "drawWeight": 10
  },
  {
    "name": "Amiodarone",
    "category": "心臟科 > 抗心律不整 > Class III",
    "mechanism": "阻斷K+通道，延長phase 3與ERP",
    "indications": "多種心律不整，尤其難治性VT/VF與AF節律控制",
    "effects": "Class III為主延長AP與QT，兼具Na/K/Ca與β阻斷；含碘，注意肺/肝/甲狀腺/角膜毒性",
    "mnemonic": "p.71: Lio(3個字母-T3)；Levo(4個字母-T4)",
    "examLevel": "A",
    "drawWeight": 10
  },
  {
    "name": "Levodopa",
    "category": "神經/精神科 > 抗帕金森 > DA前驅物",
    "mechanism": "DA前驅物，經DOPA decarboxylase轉為dopamine",
    "indications": "帕金森氏症最有效症狀治療，常與carbidopa併用",
    "effects": "多巴胺前驅物可通過BBB，於CNS轉為dopamine；長期可有wearing-off/dyskinesia",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "A",
    "drawWeight": 10
  },
  {
    "name": "Cyclophosphamide",
    "category": "血液腫瘤科 > 抗癌 > Alkylating nitrogen mustard",
    "mechanism": "形成DNA交聯，抑制DNA複製",
    "indications": "出血性膀胱炎→Mesna 解",
    "effects": "干擾DNA/RNA或細胞分裂，產生細胞毒性",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "A",
    "drawWeight": 10
  },
  {
    "name": "Cyclophosphamide",
    "category": "風濕免疫科 > 免疫抑制 > Alkylating agent",
    "mechanism": "代謝成phosphoramide mustard造成DNA交聯",
    "indications": "自體免疫疾病、器官移植排斥或發炎疾病",
    "effects": "干擾DNA/RNA或細胞分裂，產生細胞毒性；PDF重點：(抗癌藥)；全血細胞減少症",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "A",
    "drawWeight": 10
  },
  {
    "name": "Ipratropium",
    "category": "胸腔科 > 抗氣喘/COPD > 吸入型抗膽鹼藥",
    "mechanism": "短效Muscarinic受器阻斷，使支氣管平滑肌鬆弛",
    "indications": "多用於COPD(適合長期慢性使用)，較不易引發心律不整",
    "effects": "阻斷M受器，減少腺體分泌與平滑肌收縮；可散瞳、心跳上升、支氣管擴張；PDF重點：減少外分泌、放鬆平滑肌；機轉：抑制PDE (cAMP↑)、阻斷Adenosine-1",
    "mnemonic": "p.17: 一波 喘屁呀（氣喘COPD吸入給藥）\np.18: Ipratropium一噗臭屁（氣喘COPD吸入給藥）(只噗1次🡺短效)",
    "examLevel": "A",
    "drawWeight": 10
  },
  {
    "name": "Dopamine",
    "category": "神經/精神科 > 擬交感神經藥物 > 直接型",
    "mechanism": "劑量依賴性致效：低劑量D1/D2，中劑量β1，高劑量α",
    "indications": "急性休克，尤其需維持心腎灌流時",
    "effects": "劑量依賴：低劑量D1腎血管擴張，中劑量β1強心，高劑量α1血管收縮",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "A",
    "drawWeight": 10
  },
  {
    "name": "Omalizumab",
    "category": "胸腔科 > 抗氣喘 > 抗IgE",
    "mechanism": "抗IgE單株抗體，減少肥大細胞/嗜鹼性球活化",
    "indications": "抗IgE 單株抗體",
    "effects": "依其機轉產生對應藥理作用；請搭配適應症與考點複習",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "A",
    "drawWeight": 10
  },
  {
    "name": "Vancomycin",
    "category": "感染科 > 抗生素 > Glycopeptide",
    "mechanism": "結合D-Ala-D-Ala，抑制peptidoglycan延長/交聯",
    "indications": "MRSA、嚴重G(+)感染；口服用於C. difficile腸炎",
    "effects": "結合D-Ala-D-Ala抑制細胞壁合成；注意紅人症候群與腎/耳毒性",
    "mnemonic": "p.107: • 用萬(Vanco-)劍(Genta-)彈 4. Dalbavancin、Telavancin可用於Vancomycin有抗藥性之",
    "examLevel": "A",
    "drawWeight": 10
  },
  {
    "name": "Lidocaine",
    "category": "心臟科 > 抗心律不整 > Class IB",
    "mechanism": "阻斷Na+通道，縮短APD，偏作用於缺血/去極化心肌",
    "indications": "治Digitalis 或MI 造成",
    "effects": "抑制電位依賴性鈉通道，降低神經或心肌興奮性；PDF重點：治Digitalis 或MI 造成；effect，不具抑制交",
    "mnemonic": "p.54: B咖：墨西哥人、抑制phase0：弱(因為B咖很弱)、QT：縮短(B咖很短) 墨西哥(Mexiletine)B咖，你多看(Lidocaine)，不要動(=非你動)(Phenytoin)\np.54: B級Mexican(Mexiletine)吹口琴(口服)為了利多(lidocaine)太心急(Mex-跟lido-治療急性心律不 整)上抖音(phenytoin)被黃標(治毛地黃中毒)",
    "examLevel": "A",
    "drawWeight": 10
  },
  {
    "name": "Pertuzumab",
    "category": "風濕免疫/腫瘤 > 標靶治療 > HER2",
    "mechanism": "抗HER2單株抗體，抑制HER2訊號",
    "indications": "乳癌(有表現 HER2 有效)；心臟收縮功能下降；乳癌(HER2 和 EGFR 都可抑制)",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號；PDF重點：心臟收縮功能下降；乳癌(HER2 和 EGFR 都可抑制)",
    "mnemonic": "p.93: 她(HER)抓著(Trastu-)、捧著(Pertuzu-)我的大懶趴(lapa-)\np.93: 帶孫子(台，Trastu)怕吐(pertu-)，就吸HER懶趴(lapa-)",
    "examLevel": "A",
    "drawWeight": 10
  },
  {
    "name": "Lidocaine",
    "category": "麻醉科 > 局部麻醉 > Amide",
    "mechanism": "由細胞內側阻斷電壓依賴性Na+通道，抑制去極化",
    "indications": "抗心律不整",
    "effects": "抑制電位依賴性鈉通道，降低神經或心肌興奮性",
    "mnemonic": "p.54: B咖：墨西哥人、抑制phase0：弱(因為B咖很弱)、QT：縮短(B咖很短) 墨西哥(Mexiletine)B咖，你多看(Lidocaine)，不要動(=非你動)(Phenytoin)\np.54: B級Mexican(Mexiletine)吹口琴(口服)為了利多(lidocaine)太心急(Mex-跟lido-治療急性心律不 整)上抖音(phenytoin)被黃標(治毛地黃中毒)",
    "examLevel": "A",
    "drawWeight": 10
  },
  {
    "name": "Terbinafine",
    "category": "感染科 > 抗黴菌 > Allylamine",
    "mechanism": "抑制squalene epoxidase，降低ergosterol並累積squalene",
    "indications": "治甲癬、足癬、白色念珠菌感染",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "p.117: 特大冰拿鐵(terbina-)，對付squat(squalene)要有特(terbina-)殊的療黴舒 2. 作用於細胞壁",
    "examLevel": "A",
    "drawWeight": 10
  },
  {
    "name": "Adenosine",
    "category": "心臟科 > 抗心律不整 > Class V/其他",
    "mechanism": "A1受器致效（Gi），降低cAMP並抑制AV node傳導",
    "indications": "心律不整治療",
    "effects": "活化對應受器，產生受器相關生理效應",
    "mnemonic": "p.62: 學霸的名次誰要分你(theophylline)，想拚第一(抑制PDE)，不屑甘(腺苷adenosine抑制)於 第二名",
    "examLevel": "A",
    "drawWeight": 10
  },
  {
    "name": "Atropine",
    "category": "毒物學 > 解毒劑",
    "mechanism": "Muscarinic受器競爭性阻斷，治膽鹼毒性",
    "indications": "症狀性心搏過慢、術前減少分泌、散瞳/睫狀肌麻痺、有機磷中毒解毒",
    "effects": "非選擇性M受器拮抗，抑制副交感；心跳上升、分泌下降、散瞳與支氣管擴張",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "A",
    "drawWeight": 10
  },
  {
    "name": "Atropine",
    "category": "神經/精神科 > 膽鹼性拮抗劑 > Muscarinic阻斷",
    "mechanism": "競爭性Muscarinic受器阻斷",
    "indications": "症狀性心搏過慢、術前減少分泌、散瞳/睫狀肌麻痺、有機磷中毒解毒",
    "effects": "非選擇性M受器拮抗，抑制副交感；心跳上升、分泌下降、散瞳與支氣管擴張",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "A",
    "drawWeight": 10
  },
  {
    "name": "Sulfamethoxazole",
    "category": "感染科 > 抗生素 > Sulfonamide",
    "mechanism": "PABA類似物，競爭性抑制dihydropteroate synthase",
    "indications": "細菌感染治療（菌種依藥物光譜）",
    "effects": "抑制細菌細胞壁、蛋白質、核酸或葉酸代謝；PDF重點：抑菌型(+TMP=殺菌型)",
    "mnemonic": "p.116: 蓋地板(台語，起頭咖)(Ketoco-)對阿祖(-azole)來說是一種苦行(Cushing)，可以治Cushing syndrome\np.116: 阿祖(-azole)看到爛(lanosterol)人很不爽，他踢他屁屁(P450)，剁他耳朵(ergosterol)",
    "examLevel": "A",
    "drawWeight": 10
  },
  {
    "name": "Vincristine",
    "category": "血液腫瘤科 > 抗癌 > Vinca alkaloids",
    "mechanism": "抑制微小管聚合，阻斷M期紡錘絲形成",
    "indications": "不可周邊靜脈施打，若外滲皮膚壞死(熱敷治)",
    "effects": "干擾DNA/RNA或細胞分裂，產生細胞毒性；PDF重點：經病變(113-1)，但骨髓抑制較vinblastine",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "A",
    "drawWeight": 10
  },
  {
    "name": "Aspirin",
    "category": "自泌素 > Eicosanoid > COX抑制",
    "mechanism": "不可逆抑制COX-1/2，低劑量抑制血小板TXA2生成",
    "indications": "疼痛/發炎/發燒；低劑量抗血小板預防血栓、中風、AMI",
    "effects": "不可逆抑制COX-1/2；低劑量以抗血小板為主，高劑量抗發炎",
    "mnemonic": "p.57: 奶(Niacin)是脂肪(降血脂)構成的，有夠H(升HDL首選)，看到會阿斯~(Aspirin)，臉紅害羞(用Aspirin處 理臉潮紅)",
    "examLevel": "A",
    "drawWeight": 10
  },
  {
    "name": "Aspirin",
    "category": "血液腫瘤科 > 抗血小板 > COX抑制",
    "mechanism": "不可逆抑制血小板COX-1，使TXA2下降",
    "indications": "疼痛/發炎/發燒；低劑量抗血小板預防血栓、中風、AMI",
    "effects": "不可逆抑制COX-1/2；低劑量以抗血小板為主，高劑量抗發炎",
    "mnemonic": "p.57: 奶(Niacin)是脂肪(降血脂)構成的，有夠H(升HDL首選)，看到會阿斯~(Aspirin)，臉紅害羞(用Aspirin處 理臉潮紅)",
    "examLevel": "A",
    "drawWeight": 10
  },
  {
    "name": "Aspirin",
    "category": "風濕免疫科 > NSAID > Salicylates",
    "mechanism": "不可逆抑制COX-1/2；低劑量抑制血小板TXA2",
    "indications": "疼痛/發炎/發燒；低劑量抗血小板預防血栓、中風、AMI",
    "effects": "不可逆抑制COX-1/2；低劑量以抗血小板為主，高劑量抗發炎",
    "mnemonic": "p.57: 奶(Niacin)是脂肪(降血脂)構成的，有夠H(升HDL首選)，看到會阿斯~(Aspirin)，臉紅害羞(用Aspirin處 理臉潮紅)",
    "examLevel": "A",
    "drawWeight": 10
  },
  {
    "name": "Tolvaptan",
    "category": "心臟科 > 利尿劑 > ADH拮抗",
    "mechanism": "選擇性V2受器拮抗，增加自由水排出",
    "indications": "高血壓、水腫、心衰竭或特定電解質異常（依藥物）",
    "effects": "增加尿鈉/水排出，依部位影響K、Ca、Mg與酸鹼；PDF重點：減少水分再吸收；血Na+濃度增加",
    "mnemonic": "p.47: Call你發糖(conivaptan)，偷發糖(tolvaptan)，Damn call(demeclo-)！！(=後悔call你)",
    "examLevel": "A",
    "drawWeight": 10
  },
  {
    "name": "Dinoprostone",
    "category": "自泌素 > Eicosanoid > PGE2類似物",
    "mechanism": "PGE2類似物，促進子宮頸成熟與子宮收縮",
    "indications": "抗凝血：PGI2(COX-2 生成)；降低胃酸分泌、促進蠕動；血管舒張，血壓下降；血管舒張，血壓遽降",
    "effects": "促進神經傳遞物質或內分泌/代謝反應；PDF重點：米菲(mife)晚餐(dino)喝了味噌(miso)後被車撞到(carbo)就流產了→子宮收縮for 墮胎；支氣管擴張：PGI2、PGE2",
    "mnemonic": "p.61: Dinoprostone • Miss(Mis-)Dinosaur(Dino-) 恐龍妹開車(Car-)(老司機)，有了小孩沒人敢要，只好墮胎\np.61: • Miss(Mis-)Dinosaur(Dino-) 恐龍妹開車(Car-)吃嗎啡(Mife-)，碰!流產了🡺墮胎藥",
    "examLevel": "A",
    "drawWeight": 10
  },
  {
    "name": "Ketoconazole",
    "category": "內分泌/新陳代謝 > 腎上腺類固醇合成抑制",
    "mechanism": "抑制17α-hydroxylase與P450c17，降低cortisol/sex hormone合成",
    "indications": "治療男性性慾過強(107-1)",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）；PDF重點：抑制腎上腺&性腺的固醇類激素合成；拮抗-阻斷Androgen-R",
    "mnemonic": "p.116: 一起拿走(-conazole)唇&膜(抑egosterol醇合成，抑膜生成)\np.116: 蓋地板(台語，起頭咖)(Ketoco-)對阿祖(-azole)來說是一種苦行(Cushing)，可以治Cushing syndrome\np.116: 阿祖(-azole)看到爛(lanosterol)人很不爽，他踢他屁屁(P450)，剁他耳朵(ergosterol)",
    "examLevel": "A",
    "drawWeight": 10
  },
  {
    "name": "Ketoconazole",
    "category": "感染科 > 抗黴菌 > Azoles/Imidazole",
    "mechanism": "抑制真菌14α-demethylase (CYP51)，降低ergosterol合成",
    "indications": "可治Cushing syndrome",
    "effects": "破壞真菌細胞膜/細胞壁或麥角固醇合成",
    "mnemonic": "p.116: 一起拿走(-conazole)唇&膜(抑egosterol醇合成，抑膜生成)\np.116: 蓋地板(台語，起頭咖)(Ketoco-)對阿祖(-azole)來說是一種苦行(Cushing)，可以治Cushing syndrome\np.116: 阿祖(-azole)看到爛(lanosterol)人很不爽，他踢他屁屁(P450)，剁他耳朵(ergosterol)",
    "examLevel": "A",
    "drawWeight": 10
  },
  {
    "name": "Prednisolone",
    "category": "內分泌/新陳代謝 > 腎上腺皮質醇 > 中效Glucocorticoid",
    "mechanism": "活化glucocorticoid receptor，抑制發炎與免疫反應",
    "indications": "治腦腫瘤水腫，診斷Cushing",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號；PDF重點：生長抑制、",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "A",
    "drawWeight": 10
  },
  {
    "name": "Prednisolone",
    "category": "腸胃科 > 止吐 > 類固醇",
    "mechanism": "活化glucocorticoid receptor，與5-HT3拮抗劑合併止吐",
    "indications": "偏頭痛、止吐、腸胃蠕動或精神科適應症（依受器）",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）；PDF重點：Neurokinin(NK) 阻斷",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "A",
    "drawWeight": 10
  },
  {
    "name": "Zafirlukast",
    "category": "胸腔科 > 抗氣喘 > CysLT1拮抗",
    "mechanism": "阻斷CysLT1 leukotriene受器",
    "indications": "發炎疼痛、氣喘、肺高壓或胃黏膜保護（依藥物）",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "p.63: -lukast(leu卡死：所以就是卡死receptor)",
    "examLevel": "A",
    "drawWeight": 10
  },
  {
    "name": "Tegaserod",
    "category": "自泌素 > Serotonin > 5-HT4致效/促蠕動",
    "mechanism": "5-HT4受器致效，促進腸神經ACh釋放",
    "indications": "偏頭痛、止吐、腸胃蠕動或精神科適應症（依受器）",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "p.66: 唯恐(胃排空)傾國傾世(血清素4)的西施捧心(Cisapride，會有心律不整副作用)，因為畫 面太勾心了(Tegaserod)\np.66: Tegaserod中間有一個尬塞(台語)-gaser-，所以吃了會去尬塞(治便祕型腸躁症)",
    "examLevel": "A",
    "drawWeight": 10
  },
  {
    "name": "Zidovudine",
    "category": "感染科 > 抗HIV > NRTI",
    "mechanism": "核苷類RT抑制；經磷酸化後造成DNA鏈終止",
    "indications": "病毒感染治療或預防",
    "effects": "干擾DNA/RNA或細胞分裂，產生細胞毒性；PDF重點：骨髓抑制",
    "mnemonic": "p.120: (從外到內喔)：馬拉拉(Mara-) 愛浮潛(Efu-)，而且她博學多聞記很多(Zido-)拉密定理 (Lami-)，最後還暴動似的(riot, Ralte-)用力的K自己的陰蒂(Indi-) 🡺 一句話：馬拉愛浮記多 拉特陰蒂",
    "examLevel": "A",
    "drawWeight": 10
  },
  {
    "name": "Ondansetron",
    "category": "自泌素 > Serotonin > 5-HT3拮抗",
    "mechanism": "5-HT3離子通道拮抗",
    "indications": "偏頭痛、止吐、腸胃蠕動或精神科適應症（依受器）",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "p.59: 三重(setron)的三🡺 所以是抗第3型5HT\np.67: 這種常常用在化療止吐，化療都躺在床上所以也是吐在床上，吐了就要洗(台語)床(-setron)\np.67: 見自泌素",
    "examLevel": "A",
    "drawWeight": 10
  },
  {
    "name": "Neostigmine",
    "category": "神經/精神科 > 膽鹼性致效劑 > 可逆AChE抑制",
    "mechanism": "可逆性抑制AChE，增加神經肌肉接合處ACh",
    "indications": "間接+直接N→治MG 首選；治腸麻痺、尿滯留",
    "effects": "活化對應受器，產生受器相關生理效應",
    "mnemonic": "p.16: 明星一周風靡(edro-)，開記者會，記者一直死遞Mic(-stigmine)，抑制粉絲瓦解(Achase inh.)\np.16: 安卓手機(android phone, Edrophonium)一直黏住我(stick me, -stigmine)，使得了MG的 我都還一直用\np.16: 回收(Physo-)很油(脂溶)黏著我(-stig-mine)，油漬還沾到了手機，需要換新的(Neo-)，但 iPhone一整排你都(Py-rido-)不要，竟然挑Android的手機(Edro-phonium)",
    "examLevel": "A",
    "drawWeight": 10
  },
  {
    "name": "Theophylline",
    "category": "胸腔科 > 抗氣喘/COPD > Methylxanthines",
    "mechanism": "抑制PDE、阻斷A1 adenosine受器並具抗發炎作用",
    "indications": "氣喘/COPD、動暈、尿失禁、帕金森/EPS或散瞳（依藥物）",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）；PDF重點：機轉：抑制PDE (cAMP↑)、阻斷Adenosine-1；receptor、Histone deacetylation(抗發炎)",
    "mnemonic": "p.62: 學霸的名次誰要分你(theophylline)，想拚第一(抑制PDE)，不屑甘(腺苷adenosine抑制)於 第二名\np.62: Q：名次誰要分你(theophylline) A：阿明分你(Aminophylline)",
    "examLevel": "A",
    "drawWeight": 10
  },
  {
    "name": "Fluoxetine",
    "category": "神經/精神科 > 抗憂鬱 > SSRI",
    "mechanism": "選擇性抑制SERT，增加突觸間5-HT",
    "indications": "憂鬱症、焦慮症或神經痛/偏頭痛預防（依藥物）",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "p.25: 差點被撞(所以有PTSD→可治PTSD)的感冒的ox坐(fluoxetine)在central line(sertraline)很憂鬱 又一直搖ass(SSRI)\np.25: 怕流感(Par-, Flu-)，我先停(-oxetine) 洗塔羅牌(Citalopram)，避免Sir抓你 (Sertraline)",
    "examLevel": "A",
    "drawWeight": 10
  },
  {
    "name": "Nitroprusside",
    "category": "心臟科 > 降血壓 > NO供體",
    "mechanism": "釋放NO，活化guanylate cyclase、cGMP上升，動靜脈擴張",
    "indications": "治急性",
    "effects": "促進神經傳遞物質或內分泌/代謝反應；PDF重點：增加血管平滑肌的cGMP(107-2)",
    "mnemonic": "p.50: AV女優(動靜脈都作用)的奶頭曝曬(nitro-)🡺曬奶(SE：會Cyanide中毒)\np.50: 一句話：還抓奶頭?!!NO!!!",
    "examLevel": "A",
    "drawWeight": 10
  },
  {
    "name": "Doxorubicin",
    "category": "血液腫瘤科 > 抗癌 > Antitumor antibiotics/Anthracyclines",
    "mechanism": "嵌入DNA、抑制topoisomerase II並產生自由基",
    "indications": "不可周邊靜脈施打，若外滲皮膚壞死(冰敷治)",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "p.100: 魯賓遜(-rubicin)在荒島上很自由(自由基)但也很餓(topoisomerase2)，所以吃小紅莓，結果 心臟中毒\np.100: 魯賓遜(-rubicin) 到了島的北邊(Dau-nor-)，求他麥偷三創(Mitoxanetrone)，其他都隨 (Doso-)便你",
    "examLevel": "A",
    "drawWeight": 10
  },
  {
    "name": "Fomepizole",
    "category": "毒物學 > 酒精/醇類解毒",
    "mechanism": "抑制alcohol dehydrogenase",
    "indications": "中毒或重金屬暴露之解毒/螯合治療",
    "effects": "結合毒物/重金屬或繞過毒性路徑以促進排除",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "A",
    "drawWeight": 10
  },
  {
    "name": "Clonidine",
    "category": "神經/精神科 > 擬交感神經藥物 > α2致效劑",
    "mechanism": "中樞α2受器致效，降低交感神經輸出",
    "indications": "治高血壓、過動(鎮靜效果)、；癌症止痛、減輕戒斷症狀、；注意：突然停藥→反彈性高血壓(108-",
    "effects": "降低中樞交感輸出或增加NE釋放（依致效/拮抗）；PDF重點：治高血壓、過動(鎮靜效果)、；癌症止痛、減輕戒斷症狀、",
    "mnemonic": "p.11: 梅西(Methy-)被摸奶(Brimo-)，是被恐龍妹(Clonidine)摸奶(兩顆奶→α2 agonist)。另外，看到恐龍妹 嚇呆了→SE(副作用)為鎮靜。\np.11: 梅西多怕(Methydopa)孕婦懷孕(治療孕婦高血壓)和被摸(Brimo-)到眼睛(治青光眼)，摸他眼睛的人是一個克 隆(=隆乳)你的ㄋㄟ(Clonidine)的人，所以他就踢在你的ㄋㄟ(Tizanidine)讓他中間鬆掉(中樞性鬆弛劑)\np.11: 梅西(Methy-)、克隆尼(Clonidine)和泰山(Tizanidine)在阿二麻辣食堂(α2)吃飯，但是他們沒有揪西屏",
    "examLevel": "A",
    "drawWeight": 10
  },
  {
    "name": "Valsartan",
    "category": "心臟科 > 降血壓 > ARB",
    "mechanism": "阻斷Angiotensin II AT1受器；Saralasin為部分致效",
    "indications": "治慢性",
    "effects": "降低RAAS作用，血管擴張、降醛固酮並保護心腎",
    "mnemonic": "p.49: Airbus(ARB)很大台，所以在要沙灘(-sartan)旁的大機場才能降落，然後Sara常在那等老公 的飛機降落，心被拉著(拉心)(saralasin)\np.49: 阿北(ARB)殺氣騰騰(-sartan)\np.49: 這是一個打怪的故事： 第一關：怪物是愛斯基摩人(Aliskiren)因為是人所以造成畸胎(SE)。 第二關：怪物是屁怪(-pril)，會放屁攻擊你造成咳嗽(SE)。 BOSS關：怪物是撒旦(-sartan)，因為撒旦太強，所以無皮保護作用(特性)",
    "examLevel": "A",
    "drawWeight": 10
  },
  {
    "name": "Amantadine",
    "category": "感染科 > 抗流感 > M2阻斷",
    "mechanism": "阻斷Influenza A M2 H+通道，抑制脫殼",
    "indications": "治帕金森症",
    "effects": "阻斷M受器，減少腺體分泌與平滑肌收縮；可散瞳、心跳上升、支氣管擴張；PDF重點：神經胺酸酶抑制劑；抑制新病毒自宿主細胞中釋放",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "A",
    "drawWeight": 10
  },
  {
    "name": "Ceftazidime",
    "category": "感染科 > 抗生素 > Cephalosporin第三代",
    "mechanism": "β-lactam；抑制PBP/細胞壁合成",
    "indications": "細菌感染治療（菌種依藥物光譜）",
    "effects": "抑制細菌細胞壁、蛋白質、核酸或葉酸代謝",
    "mnemonic": "p.106: 波多野結衣(cefpodoxime)說fuck me(cefixime)害我不能思考(進不到BBB)；她說：『吹爽(ceftriaxone)我 還有fuck me(cefixime)』結果看到有淋病(淋病藥首選)，我很兇的叫她立定(ceftazidime)結果綠膿流出來 (第三代唯一治綠膿)，她還說因為我吹爽(ceftriaxone)她，所以要付稅給我(cefotaxime)真是腦壞掉(治腦膜 炎)",
    "examLevel": "A",
    "drawWeight": 10
  },
  {
    "name": "Amantadine",
    "category": "神經/精神科 > 抗帕金森 > 促DA釋放/NMDA拮抗",
    "mechanism": "促進DA釋放、抑制DA回收並拮抗NMDA受器",
    "indications": "原用於預防A 型流感；reticularis)、失眠、水",
    "effects": "阻斷對應受器或通道，降低該路徑效應",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "A",
    "drawWeight": 10
  },
  {
    "name": "Latanoprost",
    "category": "神經/精神科 > 青光眼用藥 > PGF2α類似物",
    "mechanism": "PGF2α類似物，增加房水葡萄膜鞏膜流出",
    "indications": "未在PDF同列明確標示；依分類臨床適應症複習",
    "effects": "依其機轉產生對應藥理作用；請搭配適應症與考點複習",
    "mnemonic": "p.60: 藍潭(Lantan-)意為藍藍眼睛(青光眼)裡面的水。",
    "examLevel": "A",
    "drawWeight": 10
  },
  {
    "name": "Latanoprost",
    "category": "自泌素 > Eicosanoid > PGF2α類似物/青光眼",
    "mechanism": "PGF2α類似物，增加房水流出、降眼壓",
    "indications": "降眼壓→治療青光眼(拉大隅角)",
    "effects": "依其機轉產生對應藥理作用；請搭配適應症與考點複習；PDF重點：降眼壓→治療青光眼(拉大隅角)",
    "mnemonic": "p.60: 藍潭(Lantan-)意為藍藍眼睛(青光眼)裡面的水。",
    "examLevel": "A",
    "drawWeight": 10
  },
  {
    "name": "Clindamycin",
    "category": "感染科 > 抗生素 > Lincosamide",
    "mechanism": "結合50S，抑制translocation/peptidyl transferase",
    "indications": "對G(+)抗菌似Erythromycin，且對大部分厭氧菌有效",
    "effects": "抑制細菌細胞壁、蛋白質、核酸或葉酸代謝",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "A",
    "drawWeight": 10
  },
  {
    "name": "Bupivacaine",
    "category": "麻醉科 > 局部麻醉 > Amide",
    "mechanism": "由細胞內側阻斷電壓依賴性Na+通道，抑制去極化",
    "indications": "氣喘/COPD、動暈、尿失禁、帕金森/EPS或散瞳（依藥物）",
    "effects": "抑制電位依賴性鈉通道，降低神經或心肌興奮性",
    "mnemonic": "p.45: 不批發(Bupiva-)叫貨久(效長)的肉批發(Ropiva-) 改做利多(Lido-)的棕色皮肉(Prilo-)",
    "examLevel": "A",
    "drawWeight": 10
  },
  {
    "name": "Niacin",
    "category": "心臟科 > 降血脂 > Niacin",
    "mechanism": "抑制脂肪組織脂解，使FFA與肝VLDL合成下降；降低HDL代謝",
    "indications": "高脂血症與動脈粥樣硬化風險降低",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號；PDF重點：升HDL 首選；高劑可致急性肝炎、尿酸↑、血糖↑",
    "mnemonic": "p.57: 奶安心(Niacin)🡺不用怕乳房被分解(抑制脂肪cell進行脂解)\np.57: 奶(Niacin)是脂肪(降血脂)構成的，有夠H(升HDL首選)，看到會阿斯~(Aspirin)，臉紅害羞(用Aspirin處 理臉潮紅)",
    "examLevel": "A",
    "drawWeight": 10
  },
  {
    "name": "Norepinephrine",
    "category": "神經/精神科 > 擬交感神經藥物 > 直接型",
    "mechanism": "腎上腺素受器致效；α1=α2>β1>>β2",
    "indications": "休克/低血壓升壓",
    "effects": "α1/α2為主造成血管收縮、BP↑↑；β1增加心收縮力，常見reflex bradycardia",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "A",
    "drawWeight": 10
  },
  {
    "name": "Glucagon",
    "category": "毒物學 > 解毒劑",
    "mechanism": "活化Gs/cAMP，治β-blocker中毒之低血壓/心搏過緩",
    "indications": "Opioid(酒精)戒斷症狀；Carbamate (胺基甲酸鹽殺蟲劑)；抗劑",
    "effects": "結合毒物/重金屬或繞過毒性路徑以促進排除；PDF重點：鎮靜藥物Benzodiazepine(BZD)",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "A",
    "drawWeight": 10
  },
  {
    "name": "Tramadol",
    "category": "神經/精神科 > 類鴉片止痛劑 > 弱/中效μ致效",
    "mechanism": "μ-opioid受器致效；Tramadol另抑制NE/5-HT再回收",
    "indications": "治療腹瀉(因不易進中樞)；戒斷症狀較輕、持續時間較短，漸取代Methadone 成為Morphine 戒斷替",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "A",
    "drawWeight": 10
  },
  {
    "name": "Alprostadil",
    "category": "自泌素 > Eicosanoid > PGE1類似物",
    "mechanism": "PGE1類似物，舒張血管/維持動脈導管開放",
    "indications": "治不舉(112-1)；大屌(-tadil)，可治不舉",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號；PDF重點：米菲(mife)晚餐(dino)喝了味噌(miso)後被車撞到(carbo)就流產了→子宮收縮for 墮胎；支氣管擴張：PGI2、PGE2",
    "mnemonic": "p.60: 大屌(-tadil)，可治不舉",
    "examLevel": "A",
    "drawWeight": 10
  },
  {
    "name": "Carboplatin",
    "category": "血液腫瘤科 > 抗癌 > Platinum compounds",
    "mechanism": "形成DNA交聯，抑制DNA複製/轉錄",
    "indications": "治療實質固態瘤（solid tumor）；會造成惡性高血壓",
    "effects": "干擾DNA/RNA或細胞分裂，產生細胞毒性；PDF重點：會造成惡性高血壓；和酒精共同服用可能造成disulfiram-like",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "A",
    "drawWeight": 10
  },
  {
    "name": "Mifepristone",
    "category": "自泌素 > Eicosanoid > 抗黃體素",
    "mechanism": "Progesterone receptor拮抗；亦拮抗glucocorticoid受器",
    "indications": "抗凝血：PGI2(COX-2 生成)；降低胃酸分泌、促進蠕動；血管舒張，血壓下降；血管舒張，血壓遽降",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）；PDF重點：支氣管擴張：PGI2、PGE2；支氣管收縮：TXA2、PGF2α、LTC4、",
    "mnemonic": "p.61: • Miss(Mis-)Dinosaur(Dino-) 恐龍妹開車(Car-)吃嗎啡(Mife-)，碰!流產了🡺墮胎藥\np.79: 米飛兔懷孕了要吃墮胎藥：米飛兔(Mife-)喝味噌(miso-)湯",
    "examLevel": "A",
    "drawWeight": 10
  },
  {
    "name": "Progesterone",
    "category": "內分泌/新陳代謝 > 性激素 > Progestin",
    "mechanism": "Progesterone receptor致效，負回饋抑制LH/FSH",
    "indications": "可治子宮內膜異位(108-1)；高血壓",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）；PDF重點：避孕 [抑制排卵(負回饋減少LH、FSH 分泌)]；負回饋抑制FSH&LH",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "A",
    "drawWeight": 10
  },
  {
    "name": "Midodrine",
    "category": "神經/精神科 > 擬交感神經藥物 > α1致效劑",
    "mechanism": "α1受器致效，增加周邊血管張力",
    "indications": "治姿勢性低血壓；治陣發性心搏過速(PSVT)",
    "effects": "血管/括約肌收縮；阻斷時則血管與前列腺平滑肌放鬆",
    "mnemonic": "p.10: 在飛牛牧場(Phenyl-)中間(Mido-)有一顆蘋果(a1 agonist)\np.10: 阿姨(alpha-1[中文])在夢中(middle dream=midodrine)不是你 的愛妃 (非你愛妃=phenylephrine)",
    "examLevel": "A",
    "drawWeight": 10
  },
  {
    "name": "Nystatin",
    "category": "感染科 > 抗黴菌 > Polyene",
    "mechanism": "結合ergosterol形成孔洞，破壞真菌細胞膜",
    "indications": "黴菌感染治療",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "p.116: 9個史達林(Nystatin) 瞄準屄(ㄅㄧ)(aim B🡺 Am…B)，突破妳的膜(在細胞膜上打洞)。 這整件事態度很硬(polyene)。",
    "examLevel": "A",
    "drawWeight": 10
  },
  {
    "name": "Carbamazepine",
    "category": "神經/精神科 > 情緒安定劑",
    "mechanism": "阻斷電壓依賴性Na+通道，降低興奮性神經放電",
    "indications": "躁鬱症急性或維持治療",
    "effects": "抑制電位依賴性鈉通道，降低神經或心肌興奮性",
    "mnemonic": "p.35: 搞藝術(ARTS: Allopurinol, Rifampin, Tmp-Smx)的蘇軾(Ethosuximide)，開 車的Obama(carbamazepine)，都比不上Pro IC(Valproic)大亨Steve Jobs(Steven-Johnson syndrome)",
    "examLevel": "A",
    "drawWeight": 10
  },
  {
    "name": "Carbamazepine",
    "category": "神經/精神科 > 抗癲癇 > Na+通道阻斷",
    "mechanism": "阻斷電壓依賴性Na+通道，穩定失活態",
    "indications": "癲癇發作控制；部分用於神經痛或情緒穩定",
    "effects": "抑制電位依賴性鈉通道，降低神經或心肌興奮性",
    "mnemonic": "p.35: 搞藝術(ARTS: Allopurinol, Rifampin, Tmp-Smx)的蘇軾(Ethosuximide)，開 車的Obama(carbamazepine)，都比不上Pro IC(Valproic)大亨Steve Jobs(Steven-Johnson syndrome)",
    "examLevel": "A",
    "drawWeight": 10
  },
  {
    "name": "Ritanserin",
    "category": "自泌素 > Serotonin > 5-HT2拮抗",
    "mechanism": "阻斷5-HT2受器",
    "indications": "抗憂鬱劑, 安眠(111-2)；第二代抗精神病藥；血清素症候群(類癌)",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）；PDF重點：阻斷5-HT2；減少Thromboxane 生成",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "A",
    "drawWeight": 10
  },
  {
    "name": "Ampicillin",
    "category": "感染科 > 抗生素 > Aminopenicillins",
    "mechanism": "β-lactam；抑制PBP/細胞壁合成",
    "indications": "細菌感染治療（菌種依藥物光譜）",
    "effects": "抑制細菌細胞壁、蛋白質、核酸或葉酸代謝；PDF重點：抑制transglycosylase(與D-Ala-D-Ala 結合)(106-2)",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "A",
    "drawWeight": 10
  },
  {
    "name": "Methadone",
    "category": "神經/精神科 > 類鴉片止痛劑 > 強效μ致效",
    "mechanism": "μ-opioid受器致效（Gi）：抑制Ca2+內流、促進K+外流",
    "indications": "Morphine 的戒斷控制(戒斷症狀輕",
    "effects": "調節鈣離子通道/骨代謝/血管平滑肌收縮；PDF重點：縮瞳、便秘(112-2)；禁忌：腦傷(因會致ICP↑)、膽絞痛、BPH、氣",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "A",
    "drawWeight": 10
  },
  {
    "name": "Metoclopramide",
    "category": "腸胃科 > 促腸胃蠕動/止吐 > D2阻斷",
    "mechanism": "D2受器拮抗；亦5-HT4致效、5-HT3拮抗，促ACh釋放",
    "indications": "過BBB 作用於CTZ",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）；PDF重點：D2 阻斷",
    "mnemonic": "p.67: 台語的袂吐唸作ㄇㄟˇㄊㄡˇ，意思是不吐",
    "examLevel": "A",
    "drawWeight": 10
  },
  {
    "name": "Metoclopramide",
    "category": "自泌素 > Serotonin > 5-HT4致效/促蠕動",
    "mechanism": "5-HT4受器致效，促進腸神經ACh釋放",
    "indications": "止吐；可治胃輕癱",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "p.67: 台語的袂吐唸作ㄇㄟˇㄊㄡˇ，意思是不吐",
    "examLevel": "A",
    "drawWeight": 10
  },
  {
    "name": "Isoniazid",
    "category": "感染科 > 抗結核 > 第一線",
    "mechanism": "經KatG活化後抑制mycolic acid合成",
    "indications": "結核病第一線用藥",
    "effects": "前驅藥經KatG活化，抑制mycolic acid合成；注意肝毒性與B6缺乏神經病變",
    "mnemonic": "p.114: 愛瘦奶啊記得(Isoniazid)，瑞凡平(Rifampin)，衣衫不透(ethambutol)，評論今哪買 (pyrazimnamide)?",
    "examLevel": "A",
    "drawWeight": 10
  },
  {
    "name": "Haloperidol",
    "category": "神經/精神科 > 抗精神病 > 傳統/典型",
    "mechanism": "D2受器拮抗",
    "indications": "思覺失調症/急性躁動、Tourette症、止吐；可用於amphetamine中毒精神症狀",
    "effects": "高效價典型抗精神病藥，強力D2拮抗；EPS與高泌乳較明顯",
    "mnemonic": "p.28: 馬可波羅(Chlor-)是個很鎮靜(鎮靜效果強)的人，鎮靜到他有姿勢性低血壓。所以當人們很興奮地揮手大喊 (EPS症狀 手一直揮)打招呼”hello Polo!(Haloperidol)”，他就只會口乾(SE)地跟你說：”Si(西文的 好)， all right~(Thio-)”，然後給你一片HAM(H a M antagonist) <改自小鳥醫師8.0>\np.28: 傳統分兩群： 第一群：姑婆媽(Chlorpromazine)是雷達 (Thioridazine)，專門製造謠言，所以副作用很多(M1/H1/α1 blocker) 第二群：哈囉陪你度 (Haloperidol) 過流感飛那時(Fluphenazine)，副作用是EPS。",
    "examLevel": "A",
    "drawWeight": 10
  },
  {
    "name": "Tetracycline",
    "category": "感染科 > 抗生素 > Tetracyclines短/中效",
    "mechanism": "結合30S，阻止aminoacyl-tRNA進入A site",
    "indications": "立克次體、披衣菌、黴漿菌、痤瘡等感染",
    "effects": "抑制30S tRNA binding，抑菌；避免孕婦與兒童牙齒骨骼影響",
    "mnemonic": "p.47: 這兩個是ADH Receptor V2抑制，-vaptan有個v，t是two\np.109: 短：四周環海( Tetracyclines)很廣，海中含鈣→影響鈣的組織(骨頭，牙齒) 中：梅杜莎(Methacycline)的米(Demeclocycline) 長：都市(Doxycycline)小(Minocycline)老虎(Tigecycline)；糯米(Mino)很油(脂溶性高，吸收不 易受食物干擾)，要多洗(Doxy)幾次→所以是長效的",
    "examLevel": "A",
    "drawWeight": 10
  },
  {
    "name": "Tetracycline",
    "category": "腸胃科 > H. pylori用藥",
    "mechanism": "抗H. pylori抗生素；常與PPI/鉍劑併用",
    "indications": "立克次體、披衣菌、黴漿菌、痤瘡等感染",
    "effects": "抑制30S tRNA binding，抑菌；避免孕婦與兒童牙齒骨骼影響",
    "mnemonic": "p.47: 這兩個是ADH Receptor V2抑制，-vaptan有個v，t是two\np.109: 短：四周環海( Tetracyclines)很廣，海中含鈣→影響鈣的組織(骨頭，牙齒) 中：梅杜莎(Methacycline)的米(Demeclocycline) 長：都市(Doxycycline)小(Minocycline)老虎(Tigecycline)；糯米(Mino)很油(脂溶性高，吸收不 易受食物干擾)，要多洗(Doxy)幾次→所以是長效的",
    "examLevel": "A",
    "drawWeight": 10
  },
  {
    "name": "Canakinumab",
    "category": "風濕免疫科 > 痛風 > IL-1抑制",
    "mechanism": "抗IL-1β單株抗體",
    "indications": "治CAPS",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "A",
    "drawWeight": 10
  },
  {
    "name": "Prucalopride",
    "category": "腸胃科 > 促腸胃蠕動 > 5-HT4致效",
    "mechanism": "選擇性5-HT4受器致效，促進腸蠕動",
    "indications": "偏頭痛、止吐、腸胃蠕動或精神科適應症（依受器）",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）；PDF重點：agonist，活化 GC-C → 增加 cGMP→活化；regulator）氯通道→促進 Cl⁻、HCO₃⁻、",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "A",
    "drawWeight": 10
  },
  {
    "name": "Kanamycin",
    "category": "感染科 > 抗生素 > Aminoglycosides",
    "mechanism": "不可逆結合30S，造成mRNA誤讀並抑制起始複合體",
    "indications": "(不易有抗藥",
    "effects": "干擾DNA/RNA或細胞分裂，產生細胞毒性",
    "mnemonic": "p.108: 尼歐(Neomycin)好像(台語，Kanamycin)歌星(Amikacin)🡺喇叭太大聲影響聽力",
    "examLevel": "A",
    "drawWeight": 10
  },
  {
    "name": "Treprostinil",
    "category": "自泌素 > Eicosanoid > PGI2類似物/IP受器致效",
    "mechanism": "PGI2/IP受器致效，血管擴張並抑制血小板凝集",
    "indications": "發炎疼痛、氣喘、肺高壓或胃黏膜保護（依藥物）",
    "effects": "活化對應受器，產生受器相關生理效應；PDF重點：(補充：Fasudi：為Rho-kinase 抑制劑",
    "mnemonic": "p.60: 姨婆(Epo-)在百貨一樓(ilo-)select包包(selexipag)，櫃姐吹捧 (Trepro-)她不像其他廢物(預防肺動脈高壓)一樣，是一位愛(PGI2)包達 人\np.60: 吹捧(trepro-)伊龍馬(ilo-)，apple pro(epopro-)隨便挑 (select-)。",
    "examLevel": "A",
    "drawWeight": 10
  },
  {
    "name": "Dupilumab",
    "category": "風濕免疫科 > 生物製劑 > Anti-IL-4Rα",
    "mechanism": "阻斷IL-4Rα，抑制IL-4/IL-13訊號",
    "indications": "(IV)治嚴重嗜伊紅性氣喘；(IM)治乾癬；治RA、巨細胞動脈炎",
    "effects": "阻斷對應受器或通道，降低該路徑效應；PDF重點：阻斷 IL-4 和 IL-13 的訊號傳導",
    "mnemonic": "p.91: 杜比(Dupi-)四聲道(IL-4、IL-13)",
    "examLevel": "A",
    "drawWeight": 10
  },
  {
    "name": "Itraconazole",
    "category": "感染科 > 抗黴菌 > Azoles/Triazole",
    "mechanism": "抑制真菌14α-demethylase，降低ergosterol合成",
    "indications": "治皮癬菌(Dermatophytosis)；治隱球菌性腦膜炎；治皮膜念珠菌；麴菌(voriconazole 首選)、",
    "effects": "破壞真菌細胞膜/細胞壁或麥角固醇合成",
    "mnemonic": "p.116: 一起拿走(-conazole)唇&膜(抑egosterol醇合成，抑膜生成)\np.116: 蓋地板(台語，起頭咖)(Ketoco-)對阿祖(-azole)來說是一種苦行(Cushing)，可以治Cushing syndrome\np.116: 阿祖(-azole)看到爛(lanosterol)人很不爽，他踢他屁屁(P450)，剁他耳朵(ergosterol)\np.117: 一抓(Itra-)頭就脫皮(皮蘚菌)，把生髮液(Flu-)當飲料喝(隱球菌)",
    "examLevel": "A",
    "drawWeight": 10
  },
  {
    "name": "Ibuprofen",
    "category": "風濕免疫科 > NSAID > Propionic acid類",
    "mechanism": "可逆抑制COX-1/2，降低PG生成",
    "indications": "解熱強、可治(關閉)PDA (109-1)；抗發炎強(治痛風佳)(抑制；Phospholipase A/C，降低嗜中性；治(關閉)PDA (107-1)",
    "effects": "降低前列腺素生成，解熱、止痛、抗發炎；PDF重點：同時抑制COX、LOX(106-1)；抗發炎強(治痛風佳)(抑制",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "A",
    "drawWeight": 10
  },
  {
    "name": "Oprelvekin",
    "category": "血液腫瘤科 > 血小板生成",
    "mechanism": "IL-11類似物，促進巨核細胞/血小板生成",
    "indications": "見免疫藥物；治嚴重；疲憊、頭痛及心房心律不整",
    "effects": "促進神經傳遞物質或內分泌/代謝反應",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "A",
    "drawWeight": 10
  },
  {
    "name": "Pembrolizumab",
    "category": "風濕免疫/腫瘤 > Immune checkpoint > Anti-PD-1",
    "mechanism": "抗PD-1，解除T細胞抑制",
    "indications": "特定癌症或腫瘤標靶治療",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "p.94: 賣尼莫(nivo-)，偏薄利(pembro-)\np.94: 你摸(Nivo-)潘伯(Pembro-)，果然是頭號神經病Psychic\np.94: [以上三種連貫一起記] 第一(PD-1)，你(Ni-)騙bro(Pembro-)Later(PD-L1)，又AAD(Atezolizumab, Avelemab, Durvalumab) 註： AAD是Against Advise Discharge(自動出院)做壞事要依比例(Ipili-)啦(CTLA-4)",
    "examLevel": "A",
    "drawWeight": 10
  },
  {
    "name": "Phenytoin",
    "category": "心臟科 > 抗心律不整 > Class IB",
    "mechanism": "阻斷Na+通道，縮短APD，偏作用於缺血/去極化心肌",
    "indications": "局部/全身強直陣攣發作；也可用於status epilepticus後續控制",
    "effects": "使用依賴性阻斷電位依賴性Na+通道，穩定不活化態；非線性動力學",
    "mnemonic": "p.54: B咖：墨西哥人、抑制phase0：弱(因為B咖很弱)、QT：縮短(B咖很短) 墨西哥(Mexiletine)B咖，你多看(Lidocaine)，不要動(=非你動)(Phenytoin)\np.54: B級Mexican(Mexiletine)吹口琴(口服)為了利多(lidocaine)太心急(Mex-跟lido-治療急性心律不 整)上抖音(phenytoin)被黃標(治毛地黃中毒)",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Phenytoin",
    "category": "神經/精神科 > 抗癲癇 > Na+通道阻斷",
    "mechanism": "阻斷電壓依賴性Na+通道，穩定失活態",
    "indications": "局部/全身強直陣攣發作；也可用於status epilepticus後續控制",
    "effects": "使用依賴性阻斷電位依賴性Na+通道，穩定不活化態；非線性動力學",
    "mnemonic": "p.54: B咖：墨西哥人、抑制phase0：弱(因為B咖很弱)、QT：縮短(B咖很短) 墨西哥(Mexiletine)B咖，你多看(Lidocaine)，不要動(=非你動)(Phenytoin)\np.54: B級Mexican(Mexiletine)吹口琴(口服)為了利多(lidocaine)太心急(Mex-跟lido-治療急性心律不 整)上抖音(phenytoin)被黃標(治毛地黃中毒)",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Doxycycline",
    "category": "感染科 > 抗生素 > Tetracyclines長效",
    "mechanism": "結合30S，阻止aminoacyl-tRNA進入A site",
    "indications": "Doxy-、Mino-、Tige-可用於腎功能不良者",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "p.109: 短：四周環海( Tetracyclines)很廣，海中含鈣→影響鈣的組織(骨頭，牙齒) 中：梅杜莎(Methacycline)的米(Demeclocycline) 長：都市(Doxycycline)小(Minocycline)老虎(Tigecycline)；糯米(Mino)很油(脂溶性高，吸收不 易受食物干擾)，要多洗(Doxy)幾次→所以是長效的",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Ethosuximide",
    "category": "神經/精神科 > 抗癲癇 > T-type Ca2+通道阻斷",
    "mechanism": "抑制丘腦T-type Ca2+通道",
    "indications": "治療失神性發作(107-1)",
    "effects": "調節鈣離子通道/骨代謝/血管平滑肌收縮；PDF重點：阻斷T-type Ca 通道",
    "mnemonic": "p.34: 買壽司(-suxi-)回來發現蓋(Ca2+)子打不開，很生氣🡺小發作\np.34: 蘇軾(-suxi-)蓋(阻斷Ca2+通道)牆防小洪水(小發作)\np.34: CAnnoT(抑制T-type Ca2+ channel) 一推隨心買(Ethosuximide)[意思是：別人以推銷就買]，會隨便買東西 的人都是失心瘋的人(治失神性發發作=小發作)\np.35: 搞藝術(ARTS: Allopurinol, Rifampin, Tmp-Smx)的蘇軾(Ethosuximide)，開 車的Obama(carbamazepine)，都比不上Pro IC(Valproic)大亨Steve Jobs(Steven-Johnson syndrome)",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Lamotrigine",
    "category": "神經/精神科 > 情緒安定劑",
    "mechanism": "阻斷電壓依賴性Na+通道，降低興奮性神經放電",
    "indications": "躁鬱症急性或維持治療",
    "effects": "抑制電位依賴性鈉通道，降低神經或心肌興奮性",
    "mnemonic": "p.35: Lamo(Na+ 嘸 台語) 🡺Na+通道阻斷劑",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Lamotrigine",
    "category": "神經/精神科 > 抗癲癇 > Na+通道阻斷",
    "mechanism": "阻斷電壓依賴性Na+通道，穩定失活態",
    "indications": "癲癇發作控制；部分用於神經痛或情緒穩定",
    "effects": "抑制電位依賴性鈉通道，降低神經或心肌興奮性",
    "mnemonic": "p.35: Lamo(Na+ 嘸 台語) 🡺Na+通道阻斷劑",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Sacubitril",
    "category": "心臟科 > 心衰竭 > Neprilysin抑制",
    "mechanism": "抑制neprilysin，使ANP/BNP上升；通常與ARB併用",
    "indications": "高血壓；部分用於心衰竭、腎保護或心絞痛",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）；PDF重點：抑制Neprilysin→ANP、BNP↑→血管；舒張",
    "mnemonic": "p.52: 傻哭包(Sacubi-)哭完🡺心情放鬆🡺血管舒張\np.52: 篩骨被催(Sacubitril)-->鼻子就斷啦，你不能吸(Neprilysin inhibitor)🡺這時你會說”啊鼻 子”(要和ARB併用)\np.53: 篩骨被催(Sacubitril)-->鼻子就斷啦，你不能吸 (Neprilysin inhibitor)🡺這時你會說”啊鼻子”(要和ARB 併用)",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Griseofulvin",
    "category": "感染科 > 抗黴菌 > Griseofulvin",
    "mechanism": "結合微小管，抑制有絲分裂；沉積於角質",
    "indications": "治皮癬菌(Dermatophytosis)首選；治甲癬、足癬",
    "effects": "干擾DNA/RNA或細胞分裂，產生細胞毒性；PDF重點：抑制紡錘絲形成",
    "mnemonic": "p.117: 格林(Gri-)有發明(Flu)殺小管(抑制微小管)的童話",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Albuterol",
    "category": "神經/精神科 > 擬交感神經藥物 > β2短效致效劑",
    "mechanism": "β2受器致效，活化Gs/cAMP使支氣管或子宮平滑肌鬆弛",
    "indications": "氣喘/COPD支氣管痙攣；部分藥物可安胎",
    "effects": "支氣管平滑肌放鬆；可有心悸、低血鉀、高血糖；PDF重點：β2 agonist 會升血糖",
    "mnemonic": "p.62: 短效：阿布(albu)牌渦輪(terbut-)很terrible(-terol)",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Albuterol",
    "category": "胸腔科 > 抗氣喘 > β2短效致效",
    "mechanism": "β2受器致效，促進cAMP使支氣管平滑肌鬆弛",
    "indications": "氣喘/COPD維持或急性支氣管痙攣緩解",
    "effects": "支氣管平滑肌放鬆；可有心悸、低血鉀、高血糖；PDF重點：促AC→cAMP↑",
    "mnemonic": "p.62: 短效：阿布(albu)牌渦輪(terbut-)很terrible(-terol)",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Cefuroxime",
    "category": "感染科 > 抗生素 > Cephalosporin第二代",
    "mechanism": "β-lactam；抑制PBP/細胞壁合成",
    "indications": "細菌感染治療（菌種依藥物光譜）",
    "effects": "抑制細菌細胞壁、蛋白質、核酸或葉酸代謝",
    "mnemonic": "p.105: 泰坦(Cefotetan)的剋星(Cefoxitin)是曼陀珠(Cefamandole)，他赴樓新(Cefuroxime)，結果沒帶鎖",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Zileuton",
    "category": "胸腔科 > 抗氣喘 > 5-LOX抑制",
    "mechanism": "抑制5-lipoxygenase，降低leukotriene生成",
    "indications": "口服(適用小孩)；常用於Aspirin-",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）；PDF重點：抑制5-Lipoxygenase (LOX)",
    "mnemonic": "p.63: 盧卡(Luka-)洗柳丁(zileuton)，丟Lexus(減少LOX或LOX R antagonist)\np.63: Zileuton(宰leukotriene產：所以是抑制酵素的)",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Linaclotide",
    "category": "腸胃科 > 瀉劑 > Cl-通道/GC-C",
    "mechanism": "活化guanylate cyclase-C，增加cGMP並促進CFTR分泌Cl-/水",
    "indications": "腸胃蠕動異常、嘔吐、便祕/腹瀉、IBD或IBS（依藥物）",
    "effects": "促進神經傳遞物質或內分泌/代謝反應；PDF重點：agonist，活化 GC-C → 增加 cGMP→活化；regulator）氯通道→促進 Cl⁻、HCO₃⁻、",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Oxaliplatin",
    "category": "血液腫瘤科 > 抗癌 > Platinum compounds",
    "mechanism": "形成DNA交聯，抑制DNA複製/轉錄",
    "indications": "會造成惡性高血壓",
    "effects": "干擾DNA/RNA或細胞分裂，產生細胞毒性；PDF重點：會造成惡性高血壓；和酒精共同服用可能造成disulfiram-like",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Nitroglycerin",
    "category": "心臟科 > 心絞痛 > Nitrate/Nitrite",
    "mechanism": "釋放NO→cGMP上升→血管平滑肌鬆弛，主要降低preload",
    "indications": "時，以預防產生耐藥性；氣喘、糖尿病、心搏過；Variant angina 不適用",
    "effects": "促進神經傳遞物質或內分泌/代謝反應；PDF重點：(與β 阻斷劑合用以減少；擴張靜脈→preload↓、心臟作功↓",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Alosetron",
    "category": "自泌素 > Serotonin > 5-HT3拮抗",
    "mechanism": "5-HT3離子通道拮抗",
    "indications": "偏頭痛、止吐、腸胃蠕動或精神科適應症（依受器）",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "p.67: 這種常常用在化療止吐，化療都躺在床上所以也是吐在床上，吐了就要洗(台語)床(-setron)\np.67: 見自泌素",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Desmopressin",
    "category": "內分泌/新陳代謝 > 腦下垂體 > Vasopressin類似物",
    "mechanism": "V2受器致效，促進AQP2插入並抗利尿",
    "indications": "抗利尿；治中樞型尿崩症",
    "effects": "增加尿鈉/水排出，依部位影響K、Ca、Mg與酸鹼；PDF重點：抗利尿",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Cyproheptadine",
    "category": "自泌素 > Histamine > 第一代H1阻斷",
    "mechanism": "H1受器反向致效/拮抗，較易過BBB且有抗M作用",
    "indications": "血清素症候群(類癌)",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）；PDF重點：阻斷5-HT2 & 抗H1(111-；抑制食慾 for 減重",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Desmopressin",
    "category": "血液腫瘤科 > 抗出血/促凝血",
    "mechanism": "V2受器致效，促進vWF與factor VIII釋放",
    "indications": "抗利尿、AQP2 通道留水；抗Heparin(離子態與Heparin 結合)；factor VIIIFc domain conjugate，治療與預防 A 型血友病患者出血；factor IXalbumin conjugate，治療及預防 B 型血友病患者出血",
    "effects": "活化對應受器，產生受器相關生理效應；PDF重點：血管收縮；抗利尿、AQP2 通道留水",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Ketorolac",
    "category": "風濕免疫科 > NSAID > Acetic acid類",
    "mechanism": "可逆抑制COX-1/2，降低PG生成",
    "indications": "急診強效止痛、術後止痛(106-1)",
    "effects": "降低RAAS作用，血管擴張、降醛固酮並保護心腎；PDF重點：急診強效止痛、術後止痛(106-1)",
    "mnemonic": "p.84: Ketorolac🡺踢痛揉leg🡺揉一揉踢到的地方，可以止痛(止痛強)",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Tamoxifen",
    "category": "內分泌/新陳代謝 > 性激素 > SERM",
    "mechanism": "SERM；乳房ER拮抗、子宮/骨骼ER致效",
    "indications": "避孕、荷爾蒙替代、癌症內分泌治療或生殖相關適應症",
    "effects": "活化對應受器，產生受器相關生理效應",
    "mnemonic": "p.80: 他摸(tamo-)，他只能摸乳房🡺只對乳房是antagonist；對子宮內膜就是agonist\np.80: 羅時豐(-loxifene)鈣穩定(治骨質疏鬆)",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Deferoxamine",
    "category": "毒物學 > 螯合劑",
    "mechanism": "螯合鐵，促進排泄",
    "indications": "急性鐵中毒與輸血造成鐵過載；也可螯合鋁",
    "effects": "螯合Fe3+形成可由尿/膽排出的複合物",
    "mnemonic": "p.125: 不一樣的鐵(defer)打針會喊",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Cisapride",
    "category": "自泌素 > Serotonin > 5-HT4致效/促蠕動",
    "mechanism": "5-HT4受器致效，促進腸神經ACh釋放",
    "indications": "治GERD、",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "p.66: 唯恐(胃排空)傾國傾世(血清素4)的西施捧心(Cisapride，會有心律不整副作用)，因為畫 面太勾心了(Tegaserod)",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Deferoxamine",
    "category": "血液腫瘤科 > 鐵螯合",
    "mechanism": "螯合游離鐵，促進排泄",
    "indications": "急性鐵中毒與輸血造成鐵過載；也可螯合鋁",
    "effects": "螯合Fe3+形成可由尿/膽排出的複合物",
    "mnemonic": "p.125: 不一樣的鐵(defer)打針會喊",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Physostigmine",
    "category": "毒物學 > 解毒劑",
    "mechanism": "可穿BBB之AChE抑制，治抗膽鹼中毒",
    "indications": "重症肌無力、青光眼、阿茲海默症或解抗膽鹼毒性（依藥物）",
    "effects": "阻斷M受器，減少腺體分泌與平滑肌收縮；可散瞳、心跳上升、支氣管擴張",
    "mnemonic": "p.16: 明星一周風靡(edro-)，開記者會，記者一直死遞Mic(-stigmine)，抑制粉絲瓦解(Achase inh.)\np.16: 安卓手機(android phone, Edrophonium)一直黏住我(stick me, -stigmine)，使得了MG的 我都還一直用\np.16: 飛梭(physo-)才能進腦袋(過BBB)所以可治青光眼，其他不行\np.16: 回收(Physo-)很油(脂溶)黏著我(-stig-mine)，油漬還沾到了手機，需要換新的(Neo-)，但 iPhone一整排你都(Py-rido-)不要，竟然挑Android的手機(Edro-phonium)",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Methyldopa",
    "category": "神經/精神科 > 擬交感神經藥物 > α2致效劑",
    "mechanism": "於中樞轉為α-methylnorepinephrine後刺激α2受器",
    "indications": "可用於孕婦或腎功能不全的高血壓患",
    "effects": "降低中樞交感輸出或增加NE釋放（依致效/拮抗）",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Physostigmine",
    "category": "神經/精神科 > 膽鹼性致效劑 > 可逆AChE抑制",
    "mechanism": "可逆性抑制AChE，增加ACh；可穿過BBB",
    "indications": "青光眼(Pilocarpine 較佳)；治腸麻痺、尿滯留",
    "effects": "活化對應受器，產生受器相關生理效應",
    "mnemonic": "p.16: 明星一周風靡(edro-)，開記者會，記者一直死遞Mic(-stigmine)，抑制粉絲瓦解(Achase inh.)\np.16: 安卓手機(android phone, Edrophonium)一直黏住我(stick me, -stigmine)，使得了MG的 我都還一直用\np.16: 飛梭(physo-)才能進腦袋(過BBB)所以可治青光眼，其他不行\np.16: 回收(Physo-)很油(脂溶)黏著我(-stig-mine)，油漬還沾到了手機，需要換新的(Neo-)，但 iPhone一整排你都(Py-rido-)不要，竟然挑Android的手機(Edro-phonium)",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Valproic acid",
    "category": "神經/精神科 > 情緒安定劑",
    "mechanism": "增加GABA、阻斷Na+通道並抑制T-type Ca2+通道",
    "indications": "躁鬱症急性或維持治療",
    "effects": "增強GABA-A抑制性傳導，鎮靜、抗焦慮、抗癲癇",
    "mnemonic": "p.34: CNN(阻Ca2+ Na+通道)說蒸發的(evaporate🡺valproic)最廣效，小心肝就好",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Valproic acid",
    "category": "神經/精神科 > 抗癲癇 > 多重機轉",
    "mechanism": "增加GABA、阻斷Na+通道並抑制T-type Ca2+通道",
    "indications": "癲癇發作控制；部分用於神經痛或情緒穩定",
    "effects": "增強GABA-A抑制性傳導，鎮靜、抗焦慮、抗癲癇",
    "mnemonic": "p.34: CNN(阻Ca2+ Na+通道)說蒸發的(evaporate🡺valproic)最廣效，小心肝就好",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Fenoldopam",
    "category": "神經/精神科 > 擬交感神經藥物 > Dopamine受器致效劑",
    "mechanism": "D1受器致效，擴張腎血管、增加腎血流",
    "indications": "增加腎血流(想到α1 agonist 減少腎血流)，用於術後高血壓、高血壓急；用於Parkinson (中樞)",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）；PDF重點：增加腎血流(想到α1 agonist 減少腎血流)，用於術後高血壓、高血壓急",
    "mnemonic": "p.11: F1賽車(Fenoldopam是D1 agonist) 間接\np.50: 倒數Day1(D1 receptor agonist)，煩惱多(fenoldo-)",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Sumatriptan",
    "category": "神經/精神科 > 頭痛用藥 > Triptan",
    "mechanism": "5-HT1B/1D受器致效，抑制三叉神經CGRP釋放並收縮顱血管",
    "indications": "5-HT1B：血管收縮 (血管收縮可緩解與顱內血管擴張相關的頭痛)",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）；PDF重點：5-HT1B：血管收縮 (血管收縮可緩解與顱內血管擴張相關的頭痛)；5-HT1D：抑制CGRP (抑制三叉神經末梢釋放神經胜肽（如 CGRP、Substance P），減",
    "mnemonic": "p.40: 偏頭痛，酥麻三分(Sumatri-)，suma(屬馬)的都是一個血滴子(血清素1D)",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Sumatriptan",
    "category": "自泌素 > Serotonin > 5-HT1D致效",
    "mechanism": "5-HT1D/1B受器致效，治急性偏頭痛",
    "indications": "治療急性偏頭痛、集束型；頭痛(108-1)",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）；PDF重點：Gq→↑IP3；直接造成平",
    "mnemonic": "p.40: 偏頭痛，酥麻三分(Sumatri-)，suma(屬馬)的都是一個血滴子(血清素1D)",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Erythromycin",
    "category": "感染科 > 抗生素 > Macrolides",
    "mechanism": "結合50S 23S rRNA，抑制translocation",
    "indications": "Mycoplasma 首選；殺菌型",
    "effects": "干擾DNA/RNA或細胞分裂，產生細胞毒性",
    "mnemonic": "p.110: 紅色(Erythromycin)的凱莉(Clarithromycin)變成奇怪(阿奇Azithromycin)的巨人(Macrolides)",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Formoterol",
    "category": "神經/精神科 > 擬交感神經藥物 > β2長效致效劑",
    "mechanism": "長效β2受器致效，活化Gs/cAMP使支氣管平滑肌鬆弛",
    "indications": "喘首選；安胎 利得胎；裡頭定 →安胎",
    "effects": "支氣管平滑肌放鬆；可有心悸、低血鉀、高血糖",
    "mnemonic": "p.62: 短效：阿布(albu)牌渦輪(terbut-)很terrible(-terol)\np.62: 喜歡吃鮭魚(salmon, salme-)配佛蒙特(formoterol)咖哩很久了(長效)。<改自小鳥醫師 8.0>",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Formoterol",
    "category": "胸腔科 > 抗氣喘 > β2長效致效",
    "mechanism": "長效β2受器致效，促進cAMP使支氣管平滑肌鬆弛",
    "indications": "氣喘/COPD維持或急性支氣管痙攣緩解",
    "effects": "支氣管平滑肌放鬆；可有心悸、低血鉀、高血糖",
    "mnemonic": "p.62: 短效：阿布(albu)牌渦輪(terbut-)很terrible(-terol)\np.62: 喜歡吃鮭魚(salmon, salme-)配佛蒙特(formoterol)咖哩很久了(長效)。<改自小鳥醫師 8.0>",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Erythromycin",
    "category": "腸胃科 > 促腸胃蠕動 > Motilin致效",
    "mechanism": "Motilin受器致效，促進胃腸蠕動",
    "indications": "腸胃蠕動異常、嘔吐、便祕/腹瀉、IBD或IBS（依藥物）",
    "effects": "活化對應受器，產生受器相關生理效應",
    "mnemonic": "p.110: 紅色(Erythromycin)的凱莉(Clarithromycin)變成奇怪(阿奇Azithromycin)的巨人(Macrolides)",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Denosumab",
    "category": "內分泌/新陳代謝 > 骨鬆 > Anti-RANKL",
    "mechanism": "抗RANKL單株抗體，抑制osteoclast生成/活性",
    "indications": "單株抗體",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號",
    "mnemonic": "p.73: 唸起來像dinosaur，因為小行星砸下來死光了，所以被排在rank L，代表他們是 loser",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Bleomycin",
    "category": "血液腫瘤科 > 抗癌 > Bleomycin",
    "mechanism": "與Fe/Cu產生自由基造成DNA斷裂，G2期作用",
    "indications": "特定癌症或腫瘤標靶治療",
    "effects": "干擾DNA/RNA或細胞分裂，產生細胞毒性",
    "mnemonic": "p.101: 肺(肺纖維化)用力吹(Bleo-)，把皮膚(皮膚毒)上的銅鎖(Cu2+衍生物)吹掉就自由(產自由 基)",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Plerixafor",
    "category": "風濕免疫科 > 免疫增強劑",
    "mechanism": "CXCR4拮抗，動員造血幹細胞至周邊血",
    "indications": "原為抗蟲藥，後發現可促淋巴球",
    "effects": "阻斷對應受器或通道，降低該路徑效應；PDF重點：並不直接增加血小板數量；球、巨噬細胞↑)",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Denosumab",
    "category": "風濕免疫科 > 生物製劑 > Anti-RANKL",
    "mechanism": "抗RANKL，抑制osteoclast生成",
    "indications": "未在PDF同列明確標示；依分類臨床適應症複習",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號；PDF重點：→使周邊血液和神經中的淋巴細胞數目下降",
    "mnemonic": "p.73: 唸起來像dinosaur，因為小行星砸下來死光了，所以被排在rank L，代表他們是 loser",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Rilonacept",
    "category": "風濕免疫科 > 痛風 > IL-1抑制",
    "mechanism": "可溶性IL-1受器融合蛋白，阻止IL-1作用",
    "indications": "(IV)治嚴重嗜伊紅性氣喘；(IM)治乾癬；治RA、巨細胞動脈炎",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號；PDF重點：阻斷 IL-4 和 IL-13 的訊號傳導",
    "mnemonic": "p.86: 李㼈(Rilo-)只是(台語，Cana-)看到屁眼(Ana-)就硬了，因為他是1(IL-1)",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Fludrocortisone",
    "category": "內分泌/新陳代謝 > 腎上腺皮質醇 > Mineralocorticoid",
    "mechanism": "活化mineralocorticoid受器，促進Na+再吸收與K+排泄",
    "indications": "發炎/免疫疾病、腎上腺功能異常或替代治療",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "p.74: 帶鑰匙(Deoxy-)只是輔佐(Fludro-)，因為平常都翻牆",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Dimercaprol",
    "category": "毒物學 > 螯合劑",
    "mechanism": "以巰基螯合砷/汞/鉛等重金屬",
    "indications": "高血壓；吃了sushi→過敏+瀉肚子；不適合用於治療慢性重金屬",
    "effects": "結合毒物/重金屬或繞過毒性路徑以促進排除",
    "mnemonic": "p.125: 我先生(砷)夠(汞)錢(鉛)買",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Propofol",
    "category": "麻醉科 > 全身麻醉 > IV麻醉誘導",
    "mechanism": "GABA_A受器正向變構調節",
    "indications": "全身麻醉誘導/維持、程序鎮靜；可降低顱內壓且止吐",
    "effects": "增強GABA-A作用，起效快恢復快；可呼吸抑制與低血壓",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Eplerenone",
    "category": "心臟科 > 利尿劑 > Aldosterone受器拮抗",
    "mechanism": "拮抗aldosterone受器，減少ENaC/Na+-K+ ATPase表現，保鉀利尿",
    "indications": "抗劑",
    "effects": "增加尿鈉/水排出，依部位影響K、Ca、Mg與酸鹼；PDF重點：代償因他種利尿劑引；血鉀增加",
    "mnemonic": "p.47: 嘉義的阿財super愛噴錢：(建議搭配影片服用www https://youtu.be/nslykuObX9k) 嘉義(K+)的阿財(阿成台灣阿成世界偉人財神總統，簡稱阿財)(阿ami-，財 tria-)super(spiron-)愛噴錢(eple-)，E奶(抑制ENaC)Amy想被騎(Amiloride)想try m(triamterene)",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Fluconazole",
    "category": "感染科 > 抗黴菌 > Azoles/Triazole",
    "mechanism": "抑制真菌14α-demethylase，降低ergosterol合成",
    "indications": "治隱球菌性腦膜炎；治皮膜念珠菌；麴菌(voriconazole 首選)、",
    "effects": "破壞真菌細胞膜/細胞壁或麥角固醇合成",
    "mnemonic": "p.116: 一起拿走(-conazole)唇&膜(抑egosterol醇合成，抑膜生成)\np.116: 蓋地板(台語，起頭咖)(Ketoco-)對阿祖(-azole)來說是一種苦行(Cushing)，可以治Cushing syndrome\np.116: 阿祖(-azole)看到爛(lanosterol)人很不爽，他踢他屁屁(P450)，剁他耳朵(ergosterol)",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Etanercept",
    "category": "風濕免疫科 > 生物製劑 > TNF receptor融合蛋白",
    "mechanism": "可溶性TNF受器融合蛋白，結合TNF",
    "indications": "未在PDF同列明確標示；依分類臨床適應症複習",
    "effects": "依其機轉產生對應藥理作用；請搭配適應症與考點複習",
    "mnemonic": "p.89: 當Intern(Etan-、In-)很阿達(Ada-)沒關係，舌頭(Certo-)夠力(Goli-)就好\np.89: 一個攤位(Etan-)，幫狗(go-) 洗頭(台語)(Certo-)，來了一隻阿達(Ada-)，隨便應付(Inf-)就好",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Ceftriaxone",
    "category": "感染科 > 抗生素 > Cephalosporin第三代",
    "mechanism": "β-lactam；抑制PBP/細胞壁合成",
    "indications": "細菌感染治療（菌種依藥物光譜）",
    "effects": "抑制細菌細胞壁、蛋白質、核酸或葉酸代謝",
    "mnemonic": "p.106: 波多野結衣(cefpodoxime)說fuck me(cefixime)害我不能思考(進不到BBB)；她說：『吹爽(ceftriaxone)我 還有fuck me(cefixime)』結果看到有淋病(淋病藥首選)，我很兇的叫她立定(ceftazidime)結果綠膿流出來 (第三代唯一治綠膿)，她還說因為我吹爽(ceftriaxone)她，所以要付稅給我(cefotaxime)真是腦壞掉(治腦膜 炎)",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Sofosbuvir",
    "category": "感染科 > 抗HCV > NS5B polymerase inhibitor",
    "mechanism": "抑制HCV NS5B RNA-dependent RNA polymerase",
    "indications": "病毒感染治療或預防",
    "effects": "干擾DNA/RNA或細胞分裂，產生細胞毒性",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Amphotericin B",
    "category": "感染科 > 抗黴菌 > Polyene",
    "mechanism": "結合ergosterol形成孔洞，破壞真菌細胞膜",
    "indications": "廣效(大部分黴菌首選，除麴菌)；殺菌型；治嚴重全身性黴菌感染；治隱球菌性腦膜炎(併5-FC)",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）；PDF重點：殺菌型",
    "mnemonic": "p.116: 很牛B(amphotericin B)的炸彈→炸cell膜(am”pho”音像膜)",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Abatacept",
    "category": "風濕免疫科 > 免疫抑制 > CTLA4-Ig",
    "mechanism": "CTLA4-Ig與CD80/86結合，抑制T cell共刺激",
    "indications": "自體免疫疾病、器官移植排斥或發炎疾病",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號；PDF重點：與TNF 抑制劑併用小",
    "mnemonic": "p.89: 阿爸他accept(Abatacept) bitch(B7)，霸凌(80)媽媽， 跟她說\"掰啦~\"(86)\np.89: 跳tabata(Abata-)體重從86kg變成80(和CD80/86有關)",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Romiplostim",
    "category": "血液腫瘤科 > 血小板生成",
    "mechanism": "TPO receptor (Mpl)致效，促進血小板生成",
    "indications": "特定癌症或腫瘤標靶治療",
    "effects": "活化對應受器，產生受器相關生理效應；PDF重點：dependent 血小板增加",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Anastrozole",
    "category": "內分泌/新陳代謝 > 性激素 > Aromatase抑制",
    "mechanism": "抑制aromatase，使androgen轉estrogen下降",
    "indications": "可用於預防&治療乳癌，長期使用造成ESTROGEN 減少進而骨質",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號；PDF重點：抑制劑；可用於預防&治療乳癌，長期使用造成ESTROGEN 減少進而骨質",
    "mnemonic": "p.79: 把小孩從肚子裡戳走（-trozole）：減少負回饋，促排卵\np.79: Anna說走🡺就沒有estrogen了(女生走了，就沒有雌性素了)\np.79: 這是一個Anna參加擠牛奶考試的故事。擠牛奶前需要先洗手，但是Anna不小心搓手(-trozole)了，導 致考試(Exem-)出現差錯(-mestane)，搓手後香香的手變臭臭(抑制芳香酶aromatase)。擠牛乳=治乳 癌\np.79: 糟蹋香香的女生(aromatase inhibitor)：乳房(防/治乳癌)拉搓揉(Letrozole)、肛門(ana-)搓揉 (anastrozole)，一直舔(-estane)",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Bupropion",
    "category": "內分泌/新陳代謝 > 減肥藥",
    "mechanism": "NDRI，抑制NE/DA再回收",
    "indications": "肥胖症輔助治療",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Bupropion",
    "category": "神經/精神科 > 抗憂鬱/戒菸",
    "mechanism": "NDRI；抑制NE與DA再回收",
    "indications": "適應症：抗憂鬱、戒菸 (cf. Varenicline=Nicotinic partial",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Tamsulosin",
    "category": "神經/精神科 > 交感神經阻斷劑 > α1阻斷",
    "mechanism": "選擇性α1受器阻斷，使血管、前列腺與膀胱頸平滑肌鬆弛",
    "indications": "治BPH 為主",
    "effects": "血管/括約肌收縮；阻斷時則血管與前列腺平滑肌放鬆；PDF重點：治BPH 為主",
    "mnemonic": "p.13: 黑心(台語/osin/)的廠商山寨機，跟Apple inc對槓(a1 antagonist)\np.13: 煮阿姨(阻 α1)有肉腥(-zosin)",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Vinorelbine",
    "category": "血液腫瘤科 > 抗癌 > Vinca alkaloids",
    "mechanism": "抑制微小管聚合，阻斷M期紡錘絲形成",
    "indications": "特定癌症或腫瘤標靶治療",
    "effects": "干擾DNA/RNA或細胞分裂，產生細胞毒性",
    "mnemonic": "p.101: “V”的兩端是分開的🡺微管聚不起來\np.101: -cristine名字最美，但也最毒",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Streptokinase",
    "category": "血液腫瘤科 > 血栓溶解劑",
    "mechanism": "活化plasminogen為plasmin，分解fibrin血栓",
    "indications": "過敏(具外來抗原",
    "effects": "依其機轉產生對應藥理作用；請搭配適應症與考點複習",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Basiliximab",
    "category": "風濕免疫科 > 免疫抑制 > Anti-CD25",
    "mechanism": "抗IL-2 receptor α (CD25)單株抗體，抑制T cell活化",
    "indications": "自體免疫疾病、器官移植排斥或發炎疾病",
    "effects": "調節多巴胺傳導，影響精神症狀、EPS、泌乳或帕金森症狀",
    "mnemonic": "p.89: 大顆粒(Dacli-)的巴西梨(Basili-)只要25元(anti-CD25)",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Bumetanide",
    "category": "心臟科 > 利尿劑 > Loop diuretics",
    "mechanism": "抑制亨利氏環厚上升支NKCC2，增加Na+/K+/Cl-/Ca2+/Mg2+排出",
    "indications": "嚴重心衰竭",
    "effects": "增加尿鈉/水排出，依部位影響K、Ca、Mg與酸鹼；PDF重點：Ca2+↑、Mg2+↑",
    "mnemonic": "p.46: 這些藥作用在NKCC2，兩個C圍成一個loop(loop diuretics)，像是賽車場🡺賽車電影fast and furious(furosemide)；開賽車就可以把妹(Bumetanide)；開太快出車禍，圍觀的問說”他死了嗎 (Torsemide)?”；最後真的不幸走了，其他人為他哭(other cry🡺ethacry-)。 車禍很嚴重🡺針對一些很嚴重的病症(ex急性肺水腫、嚴重心衰竭、腎衰竭)； 賽車又很吵🡺SE：有耳毒性； 車禍現場有很多砂石🡺高尿酸(砂石 結晶的感覺)\np.46: 她一脫(Tor-)讓肌膚露(Furo-)， 就讓我射滿地(-semide)，不買大奶(Bume-tanide)的寫真囉(loop)， 會瞬間後悔，一剎那哭死(Etha-crynic)",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Diltiazem",
    "category": "心臟科 > 抗心律不整 > Class IV",
    "mechanism": "阻斷L-type Ca2+通道，延長AV node傳導",
    "indications": "心律不整治療",
    "effects": "調節鈣離子通道/骨代謝/血管平滑肌收縮；PDF重點：抑制心臟；沒人怕(Verapa-)泰山(-tiazem)，所以背不停(bepridil)→心臟就太累不跳了(心臟抑制)",
    "mnemonic": "p.49: 薇拉(Vera-)太正(Diltiazem)，正到血壓(BP, BePri-)降低，還抑制心臟 <來自小鳥醫師 8.0>",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Diltiazem",
    "category": "心臟科 > 降血壓/CCB > Non-DHP",
    "mechanism": "阻斷L-type Ca2+通道，抑制心臟傳導並舒張冠狀動脈",
    "indications": "高血壓；部分用於心衰竭、腎保護或心絞痛",
    "effects": "調節鈣離子通道/骨代謝/血管平滑肌收縮；PDF重點：抑制心臟；沒人怕(Verapa-)泰山(-tiazem)，所以背不停(bepridil)→心臟就太累不跳了(心臟抑制)",
    "mnemonic": "p.49: 薇拉(Vera-)太正(Diltiazem)，正到血壓(BP, BePri-)降低，還抑制心臟 <來自小鳥醫師 8.0>",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Azathioprine",
    "category": "腸胃科 > IBD > 免疫抑制",
    "mechanism": "Purine拮抗/代謝為thio-IMP，抑制淋巴球增殖",
    "indications": "腸胃蠕動異常、嘔吐、便祕/腹瀉、IBD或IBS（依藥物）",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）；PDF重點：免疫抑制劑",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Azathioprine",
    "category": "風濕免疫科 > 免疫抑制 > Antimetabolite",
    "mechanism": "代謝為6-MP/thio-IMP，抑制purine合成與淋巴球增殖",
    "indications": "(抗癌藥)；不穿胎盤懷孕可用",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）；PDF重點：髓抑制；(抗癌藥)",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Propranolol",
    "category": "心臟科 > 抗心律不整 > Class II",
    "mechanism": "β受器阻斷，降低SA/AV node自律性與傳導",
    "indications": "高血壓、心絞痛、心衰竭、心律不整、青光眼（依藥物）",
    "effects": "阻斷對應受器或通道，降低該路徑效應；PDF重點：抑制β1→CO↓→需氧量↓；主要舒張冠狀動脈",
    "mnemonic": "p.14: -olol(A~M開頭的)：AM(白天)的OL比較挑(選擇性)，只要1支banana(B1 antagonist)\np.14: -olol(P開頭的)：晚上(不是下方A~M)的OL就不挑(非選擇性)，banana全都要(B antagonist)",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Propranolol",
    "category": "神經/精神科 > 交感神經阻斷劑 > β1/β2阻斷",
    "mechanism": "非選擇性β受器阻斷",
    "indications": "高血壓、BPH、嗜鉻細胞瘤或雷諾氏現象（依選擇性）",
    "effects": "支氣管平滑肌放鬆；可有心悸、低血鉀、高血糖；PDF重點：支氣管收縮→氣喘患者須小",
    "mnemonic": "p.14: -olol(A~M開頭的)：AM(白天)的OL比較挑(選擇性)，只要1支banana(B1 antagonist)\np.14: -olol(P開頭的)：晚上(不是下方A~M)的OL就不挑(非選擇性)，banana全都要(B antagonist)",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Ropinirole",
    "category": "神經/精神科 > 抗帕金森 > DA受器致效",
    "mechanism": "非Ergot類D2/D3受器致效",
    "indications": "帕金森氏症或藥物誘發EPS",
    "effects": "調節多巴胺傳導，影響精神症狀、EPS、泌乳或帕金森症狀",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Methotrexate",
    "category": "血液腫瘤科 > 抗癌 > 抗代謝/葉酸拮抗",
    "mechanism": "抑制DHFR，降低THF與dTMP/purine合成",
    "indications": "特定癌症或腫瘤標靶治療",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Spironolactone",
    "category": "心臟科 > 利尿劑 > Aldosterone受器拮抗",
    "mechanism": "拮抗aldosterone受器，減少ENaC/Na+-K+ ATPase表現，保鉀利尿",
    "indications": "抗劑",
    "effects": "增加尿鈉/水排出，依部位影響K、Ca、Mg與酸鹼；PDF重點：抑制留鈉排鉀；代償因他種利尿劑引",
    "mnemonic": "p.47: 嘉義的阿財super愛噴錢：(建議搭配影片服用www https://youtu.be/nslykuObX9k) 嘉義(K+)的阿財(阿成台灣阿成世界偉人財神總統，簡稱阿財)(阿ami-，財 tria-)super(spiron-)愛噴錢(eple-)，E奶(抑制ENaC)Amy想被騎(Amiloride)想try m(triamterene)\np.78: 林秉樞在他媽的(-tamide)喪禮後脅迫他人(cyproterone)，俘虜(Flu-)高嘉瑜，揍她揍到掰咖 (bica-)，嚇得她屁滾尿流(利尿劑Spironolactone)，真不配當男人(androgen blocker)",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Lomitapide",
    "category": "心臟科 > 降血脂 > MTP抑制",
    "mechanism": "抑制microsomal triglyceride transfer protein，降低VLDL組裝",
    "indications": "高脂血症與動脈粥樣硬化風險降低",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Diphenhydramine",
    "category": "神經/精神科 > 抗焦慮/鎮靜安眠 > H1阻斷",
    "mechanism": "第一代H1受器反向致效/拮抗，具鎮靜與抗膽鹼作用",
    "indications": "安眠，作用於melatonin receptor(107-1)",
    "effects": "阻斷M受器，減少腺體分泌與平滑肌收縮；可散瞳、心跳上升、支氣管擴張",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Diphenhydramine",
    "category": "腸胃科 > 止吐 > H1阻斷",
    "mechanism": "H1受器阻斷並有抗M作用，抑制前庭相關嘔吐",
    "indications": "過敏/蕁麻疹、動暈或胃酸相關疾病（依受器）",
    "effects": "阻斷對應受器或通道，降低該路徑效應",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Diphenhydramine",
    "category": "自泌素 > Histamine > 第一代H1阻斷",
    "mechanism": "H1受器反向致效/拮抗，較易過BBB且有抗M作用",
    "indications": "可做成止癢軟膏、可緩解藥物引起的；可用於懷孕婦女的噁心嘔吐；抗膽鹼作用；(2)可抗帕金森氏",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Digoxin",
    "category": "心臟科 > 心衰竭 > Digitalis glycosides",
    "mechanism": "抑制Na+/K+ ATPase，使細胞內Na+上升、NCX受抑、Ca2+上升",
    "indications": "心衰竭症狀改善；心房顫動/撲動之心室率控制",
    "effects": "抑制Na+/K+ ATPase使胞內Ca2+上升而強心；增加迷走張力使HR下降",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Penicillin G",
    "category": "感染科 > 抗生素 > β-lactam/Penicillin",
    "mechanism": "β-lactam；結合PBP並抑制transpeptidation，阻斷peptidoglycan交聯",
    "indications": "高血壓、心絞痛、心衰竭、心律不整、青光眼（依藥物）",
    "effects": "抑制細菌細胞壁、蛋白質、核酸或葉酸代謝",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Lithium",
    "category": "神經/精神科 > 情緒安定劑",
    "mechanism": "抑制inositol monophosphatase與Gq-PIP2訊號",
    "indications": "躁鬱症急性躁症與維持治療",
    "effects": "抑制inositol/Gq-PIP2相關訊號；治療窗窄，注意腎/甲狀腺與致畸",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Allopurinol",
    "category": "風濕免疫科 > 痛風 > Xanthine oxidase抑制",
    "mechanism": "抑制xanthine oxidase，降低尿酸合成",
    "indications": "急性痛風、慢性高尿酸血症或腫瘤溶解症預防",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "p.35: 搞藝術(ARTS: Allopurinol, Rifampin, Tmp-Smx)的蘇軾(Ethosuximide)，開 車的Obama(carbamazepine)，都比不上Pro IC(Valproic)大亨Steve Jobs(Steven-Johnson syndrome)",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Raloxifene",
    "category": "內分泌/新陳代謝 > 骨鬆 > SERM",
    "mechanism": "選擇性estrogen receptor調節；骨骼致效、乳房/子宮拮抗傾向",
    "indications": "可治乳癌；穩定血脂、穩定骨骼、促進血栓",
    "effects": "活化對應受器，產生受器相關生理效應；PDF重點：穩定血脂、穩定骨骼、促進血栓",
    "mnemonic": "p.73: 唸起來像dinosaur，因為小行星砸下來死光了，所以被排在rank L，代表他們是 loser\np.80: 臘肉(ralo-)香腸，可以用乳房夾住，也可以插在下面🡺乳房、子宮內膜都antagonist",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Flumazenil",
    "category": "毒物學 > 解毒劑",
    "mechanism": "BZD受器拮抗",
    "indications": "Carbamate (胺基甲酸鹽殺蟲劑)；抗劑",
    "effects": "增強GABA-A抑制性傳導，鎮靜、抗焦慮、抗癲癇；PDF重點：鎮靜藥物Benzodiazepine(BZD)中毒；Acetylcysteine，增加肝臟內",
    "mnemonic": "p.21: 踹走(Triazolam)牛(ox-)的時候會被牛反彈 Lora-、Chlordiazepoxide) (SE：反彈性失眠) 4. 解毒劑：Flumazenil (麻醉後輔助清醒-\np.21: 短中長效型解毒劑：Flumazenil（俘虜妹子）",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Flumazenil",
    "category": "神經/精神科 > 抗焦慮/鎮靜安眠 > Benzodiazepine拮抗",
    "mechanism": "競爭性拮抗BZD結合位",
    "indications": "短效、純安眠，無鎮靜、解除焦慮效果",
    "effects": "增強GABA-A抑制性傳導，鎮靜、抗焦慮、抗癲癇；PDF重點：短效、純安眠，無鎮靜、解除焦慮效果",
    "mnemonic": "p.21: 踹走(Triazolam)牛(ox-)的時候會被牛反彈 Lora-、Chlordiazepoxide) (SE：反彈性失眠) 4. 解毒劑：Flumazenil (麻醉後輔助清醒-\np.21: 短中長效型解毒劑：Flumazenil（俘虜妹子）",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Prednisone",
    "category": "內分泌/新陳代謝 > 腎上腺皮質醇 > 中效Glucocorticoid",
    "mechanism": "活化glucocorticoid receptor，抑制發炎與免疫反應",
    "indications": "治腦腫瘤水腫，診斷Cushing",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號；PDF重點：免疫抑制時用(移植)；生長抑制、",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Minoxidil",
    "category": "心臟科 > 降血壓 > KATP開啟",
    "mechanism": "開啟KATP通道使血管平滑肌過極化而舒張",
    "indications": "治雄性禿(落建)；治insulinoma 之低血糖；帶阿祖(有高血壓)(Diazoxide)呷飯((台語)打開K+通道)要記得帶著，以預防低血糖。另外，帶",
    "effects": "依其機轉產生對應藥理作用；請搭配適應症與考點複習",
    "mnemonic": "p.50: 帶阿祖(有高血壓)(Diazoxide)呷飯((台語)打開K+通道)要記得帶著，以預防低血糖。另外，帶 阿祖呷飯，要把米弄稀(minoxi-)，才不會噎到。\np.50: 米諾(Mino-)帶兒(Diazo-)呷(K+ channel)屎\np.50: 副作用：米諾陶爾毛很多-多毛症(治雄性禿)，黛兒愛甜食-高血糖(治insulinoma之低血糖)",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Prednisone",
    "category": "腸胃科 > IBD > 類固醇",
    "mechanism": "活化glucocorticoid receptor，抑制腸道發炎",
    "indications": "腸胃蠕動異常、嘔吐、便祕/腹瀉、IBD或IBS（依藥物）",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號；PDF重點：免疫抑制劑",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Acetaminophen",
    "category": "風濕免疫科 > 非NSAID解熱鎮痛",
    "mechanism": "中樞COX抑制為主；解熱鎮痛但抗發炎/抗血小板弱",
    "indications": "解熱止痛，特別適合兒童病毒感染或需避免NSAID腸胃/出血者",
    "effects": "主要中樞COX作用，解熱止痛但抗發炎/抗血小板弱；過量以N-acetylcysteine解毒",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Topiramate",
    "category": "內分泌/新陳代謝 > 減肥藥",
    "mechanism": "增強GABA、抑制AMPA/kainate並阻斷Na+通道",
    "indications": "氣喘/COPD、動暈、尿失禁、帕金森/EPS或散瞳（依藥物）",
    "effects": "增強GABA-A抑制性傳導，鎮靜、抗焦慮、抗癲癇；PDF重點：促NE 釋放+增加GABA 作用；延緩胃排空抑制食慾，國內合法",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Rifampin",
    "category": "感染科 > 抗痲瘋",
    "mechanism": "抑制DNA-dependent RNA polymerase",
    "indications": "首選；脂溶高→治腦膜炎(106-",
    "effects": "干擾DNA/RNA或細胞分裂，產生細胞毒性",
    "mnemonic": "p.35: 搞藝術(ARTS: Allopurinol, Rifampin, Tmp-Smx)的蘇軾(Ethosuximide)，開 車的Obama(carbamazepine)，都比不上Pro IC(Valproic)大亨Steve Jobs(Steven-Johnson syndrome)\np.114: 愛瘦奶啊記得(Isoniazid)，瑞凡平(Rifampin)，衣衫不透(ethambutol)，評論今哪買 (pyrazimnamide)?",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Rifampin",
    "category": "感染科 > 抗結核 > 第一線",
    "mechanism": "抑制DNA-dependent RNA polymerase",
    "indications": "首選；脂溶高→治腦膜炎(106-",
    "effects": "干擾DNA/RNA或細胞分裂，產生細胞毒性",
    "mnemonic": "p.35: 搞藝術(ARTS: Allopurinol, Rifampin, Tmp-Smx)的蘇軾(Ethosuximide)，開 車的Obama(carbamazepine)，都比不上Pro IC(Valproic)大亨Steve Jobs(Steven-Johnson syndrome)\np.114: 愛瘦奶啊記得(Isoniazid)，瑞凡平(Rifampin)，衣衫不透(ethambutol)，評論今哪買 (pyrazimnamide)?",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Topiramate",
    "category": "神經/精神科 > 抗癲癇 > AMPA/kainate阻斷與GABA增強",
    "mechanism": "阻斷Na+通道、增強GABA_A、抑制AMPA/kainate並抑制CA",
    "indications": "phentermine 做成複方治療肥胖",
    "effects": "增強GABA-A抑制性傳導，鎮靜、抗焦慮、抗癲癇；PDF重點：(109-1)阻斷Na+、Ca2+通道；尿道結石，致畸胎。抑制食慾造成體重減輕，可和",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Methimazole",
    "category": "內分泌/新陳代謝 > 甲狀腺 > Thioamides",
    "mechanism": "抑制thyroid peroxidase，減少MIT/DIT偶聯與碘化",
    "indications": "蛋白結合態少，不適用於孕婦",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號；PDF重點：[主要抑制T3, T4 合成]；抑制I2→MIT/DIT 之偶合(碘",
    "mnemonic": "p.71: 沒吸媽祖 (Methimazole) -不用媽祖就很有效，效強\np.116: 蓋地板(台語，起頭咖)(Ketoco-)對阿祖(-azole)來說是一種苦行(Cushing)，可以治Cushing syndrome\np.116: 阿祖(-azole)看到爛(lanosterol)人很不爽，他踢他屁屁(P450)，剁他耳朵(ergosterol)",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Tiotropium",
    "category": "胸腔科 > 抗氣喘/COPD > 吸入型抗膽鹼藥",
    "mechanism": "長效Muscarinic受器阻斷，使支氣管平滑肌鬆弛",
    "indications": "氣喘/COPD、動暈、尿失禁、帕金森/EPS或散瞳（依藥物）",
    "effects": "阻斷M受器，減少腺體分泌與平滑肌收縮；可散瞳、心跳上升、支氣管擴張；PDF重點：機轉：抑制PDE (cAMP↑)、阻斷Adenosine-1；receptor、Histone deacetylation(抗發炎)",
    "mnemonic": "p.17: 一波 喘屁呀（氣喘COPD吸入給藥）\np.18: Tiotropium吸一口臭屁（氣喘COPD吸入給藥）(噗1次還吸1口回來🡺長效)",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Ciclesonide",
    "category": "胸腔科 > 抗氣喘 > 吸入型類固醇",
    "mechanism": "活化glucocorticoid receptor，抑制發炎基因轉錄",
    "indications": "抗發炎(長；期預防)；口咽，易感染(漱；口服(適用小孩)",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號；PDF重點：抗發炎(長；esterase 活化(作用專一)",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Furosemide",
    "category": "心臟科 > 利尿劑 > Loop diuretics",
    "mechanism": "抑制亨利氏環厚上升支NKCC2，增加Na+/K+/Cl-/Ca2+/Mg2+排出",
    "indications": "急性肺水腫首選、嚴重水腫/心衰竭、急性高血鈣或高血鉀",
    "effects": "Loop diuretic：抑制NKCC2，增加NaCl/K/Ca/Mg排出；效力強",
    "mnemonic": "p.46: 這些藥作用在NKCC2，兩個C圍成一個loop(loop diuretics)，像是賽車場🡺賽車電影fast and furious(furosemide)；開賽車就可以把妹(Bumetanide)；開太快出車禍，圍觀的問說”他死了嗎 (Torsemide)?”；最後真的不幸走了，其他人為他哭(other cry🡺ethacry-)。 車禍很嚴重🡺針對一些很嚴重的病症(ex急性肺水腫、嚴重心衰竭、腎衰竭)； 賽車又很吵🡺SE：有耳毒性； 車禍現場有很多砂石🡺高尿酸(砂石 結晶的感覺)\np.46: 她一脫(Tor-)讓肌膚露(Furo-)， 就讓我射滿地(-semide)，不買大奶(Bume-tanide)的寫真囉(loop)， 會瞬間後悔，一剎那哭死(Etha-crynic)",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Mirabegron",
    "category": "神經/精神科 > 擬交感神經藥物 > β3致效劑",
    "mechanism": "β3受器致效，使膀胱逼尿肌鬆弛",
    "indications": "膀胱過動症",
    "effects": "β3致效使逼尿肌放鬆、降低膀胱張力；也可促脂肪分解",
    "mnemonic": "p.11: 米拉被肛(Mirabegron)，β和3都是屁股的形狀 🡺被肛到膀胱鬆了：可降膀胱張力，治膀胱過動症 🡺被肛太久瘦了：促進脂肪分解，減肥藥\np.11: 麥(不要)拉我膀胱(Mirabegron)，搧你巴掌(β3)",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Ticlopidine",
    "category": "血液腫瘤科 > 抗血小板 > ADP P2Y12拮抗",
    "mechanism": "不可逆阻斷P2Y12 ADP受器，抑制血小板活化",
    "indications": "白血球下降、紫斑症",
    "effects": "阻斷對應受器或通道，降低該路徑效應",
    "mnemonic": "p.96: Clopidogrel可柔批鬥貴兒(-grel)，踢他又摳他(ticlo-)\np.96: 怕輸哥(Prasugrel)和臭屁哥(Clopidogrel)想要買一塊A級的地皮(ADP-R)，但是地(Ti-)檢署說(-clo-) 那塊地皮(-pidine)有鬧鬼(Ticlopidine最易導致neutropenia)不能出售，怕輸哥聽到後生氣到被氣死 (SE: 想像臉紅紅=Prasugrel最易出血)，但是臭屁哥聽到消息承受得住(用於冠狀動脈放支架，心導管術前)\np.96: ***想tickle(ticlo-)她，摳她屁洞(clopidogrel)，persuade(Prasugrel)她跟我做。",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Empagliflozin",
    "category": "內分泌/新陳代謝 > 糖尿病 > SGLT2抑制",
    "mechanism": "抑制近曲小管SGLT2，降低葡萄糖再吸收",
    "indications": "糖尿病血糖控制",
    "effects": "降低血糖或改善胰島素/腸泌素/腎糖排出路徑",
    "mnemonic": "p.76: 把蛤蜊frozen(-glifrozen)就不能吃glucose(不吸收glucose)了\np.76: -flo 🡺 flow 🡺跟著尿液流出去",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Nizatidine",
    "category": "自泌素/腸胃 > H2阻斷",
    "mechanism": "H2受器阻斷，抑制胃壁細胞酸分泌",
    "indications": "過敏/蕁麻疹、動暈或胃酸相關疾病（依受器）",
    "effects": "抑制胃酸分泌；PDF重點：可促進胃排空",
    "mnemonic": "p.65: 躲在梯廳(-tidine)不能呵呵笑(HH笑🡺H2 receptor blocker)\np.65: 西門慶(Cime-)讓你(Rani-) 撫摸(Famo-)，你讓他硬(Nizatidine)；因為西門慶(Cimetidine)很色一直 做，最後會陽痿(SE)；你讓他硬(Nizatidine)用嘴巴(口服)\np.65: Nizatidine：哪吒(Niza-)，破壞大王，來去匆匆(=作用時間短)，所到之處都亂成一團，剩(腎)下的東西不 多(唯一腎代謝)，但因為是牛魔王的兒子，大家只能忍氣吞聲(只能口服)",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Diazoxide",
    "category": "心臟科 > 降血壓 > KATP開啟",
    "mechanism": "開啟KATP通道使血管平滑肌過極化而舒張",
    "indications": "治insulinoma 之低血糖；帶阿祖(有高血壓)()呷飯((台語)打開K+通道)要記得帶著，以預防低血糖。另外，帶",
    "effects": "依其機轉產生對應藥理作用；請搭配適應症與考點複習",
    "mnemonic": "p.50: 帶阿祖(有高血壓)(Diazoxide)呷飯((台語)打開K+通道)要記得帶著，以預防低血糖。另外，帶 阿祖呷飯，要把米弄稀(minoxi-)，才不會噎到。\np.50: 米諾(Mino-)帶兒(Diazo-)呷(K+ channel)屎\np.50: 副作用：米諾陶爾毛很多-多毛症(治雄性禿)，黛兒愛甜食-高血糖(治insulinoma之低血糖)\np.75: 甲飯後(飯後吃，gli在字尾)，說：今 Diazoxide 晚真是個蛤蜊的夜晚(gli-night, - 5. 體重增加 glinide)~ 6. 副作用：低血糖 7. Meglitinides可用於對硫或磺胺類藥物嚴重 過敏的第二型糖尿病",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Benztropine",
    "category": "神經/精神科 > 抗帕金森 > 抗膽鹼",
    "mechanism": "中樞M受器阻斷，改善震顫與僵硬",
    "indications": "氣喘/COPD、動暈、尿失禁、帕金森/EPS或散瞳（依藥物）",
    "effects": "阻斷M受器，減少腺體分泌與平滑肌收縮；可散瞳、心跳上升、支氣管擴張",
    "mnemonic": "p.18: 踹狠心肥弟(Trihexy-phenidyl)，揍完屁弟之後(治PD) 開Benz去買抓餅(Benz-tropine)， 兩個小弟陪你等",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Benztropine",
    "category": "神經/精神科 > 抗帕金森 > 抗膽鹼藥",
    "mechanism": "中樞Muscarinic受器阻斷，降低相對過高之ACh活性",
    "indications": "氣喘/COPD、動暈、尿失禁、帕金森/EPS或散瞳（依藥物）",
    "effects": "阻斷M受器，減少腺體分泌與平滑肌收縮；可散瞳、心跳上升、支氣管擴張",
    "mnemonic": "p.18: 踹狠心肥弟(Trihexy-phenidyl)，揍完屁弟之後(治PD) 開Benz去買抓餅(Benz-tropine)， 兩個小弟陪你等",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Disulfiram",
    "category": "神經/精神科 > 酒精用藥",
    "mechanism": "抑制aldehyde dehydrogenase，造成acetaldehyde累積",
    "indications": "高血壓；部分用於心衰竭、腎保護或心絞痛",
    "effects": "降低RAAS作用，血管擴張、降醛固酮並保護心腎",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Infliximab",
    "category": "腸胃科 > IBD > Anti-TNF",
    "mechanism": "中和TNF-α",
    "indications": "腸胃蠕動異常、嘔吐、便祕/腹瀉、IBD或IBS（依藥物）",
    "effects": "依其機轉產生對應藥理作用；請搭配適應症與考點複習",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Infliximab",
    "category": "風濕免疫科 > 生物製劑 > Anti-TNF",
    "mechanism": "抗TNF-α單株抗體/片段，中和TNF",
    "indications": "未在PDF同列明確標示；依分類臨床適應症複習",
    "effects": "依其機轉產生對應藥理作用；請搭配適應症與考點複習；PDF重點：抑制TNF-α(106-1)",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Aliskiren",
    "category": "心臟科 > 降血壓 > Renin抑制",
    "mechanism": "直接抑制renin，降低Angiotensin I生成",
    "indications": "高血壓",
    "effects": "降低RAAS作用，血管擴張、降醛固酮並保護心腎；PDF重點：抑制renin(最上游)",
    "mnemonic": "p.49: 遇上愛麗莎(Alisk-)，就不申訴(腎素，renin-inhibitor)了\np.49: 腎素是renin，Aliskiren就是\"阿哩死去ren\"，renin死去所以是抑制腎素\np.49: 這是一個打怪的故事： 第一關：怪物是愛斯基摩人(Aliskiren)因為是人所以造成畸胎(SE)。 第二關：怪物是屁怪(-pril)，會放屁攻擊你造成咳嗽(SE)。 BOSS關：怪物是撒旦(-sartan)，因為撒旦太強，所以無皮保護作用(特性)",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Amikacin",
    "category": "感染科 > 抗生素 > Aminoglycosides",
    "mechanism": "不可逆結合30S，造成mRNA誤讀並抑制起始複合體",
    "indications": "(不易有抗藥",
    "effects": "干擾DNA/RNA或細胞分裂，產生細胞毒性",
    "mnemonic": "p.108: 尼歐(Neomycin)好像(台語，Kanamycin)歌星(Amikacin)🡺喇叭太大聲影響聽力",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Cocaine",
    "category": "神經/精神科 > 擬交感神經藥物 > 間接型",
    "mechanism": "抑制NE、Epi、DA再回收；亦阻斷電壓依賴性Na+通道",
    "indications": "(α1)治鼻塞、尿床 (β2)治氣喘；(NE)升血壓，常作為禁藥；降低食慾→減肥",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Lubiprostone",
    "category": "腸胃科 > 瀉劑 > Cl-通道活化",
    "mechanism": "活化腸道ClC-2氯離子通道，增加腸液分泌",
    "indications": "腸胃蠕動異常、嘔吐、便祕/腹瀉、IBD或IBS（依藥物）",
    "effects": "依其機轉產生對應藥理作用；請搭配適應症與考點複習；PDF重點：Cl⁻通道活化劑",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Cocaine",
    "category": "麻醉科 > 局部麻醉 > Ester",
    "mechanism": "由細胞內側阻斷電壓依賴性Na+通道，抑制去極化",
    "indications": "中表面麻醉；對麻醉敏感)：C≧B>A",
    "effects": "抑制電位依賴性鈉通道，降低神經或心肌興奮性；PDF重點：興奮交感：血管收縮；含PABA 結構：↓磺胺藥",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Verapamil",
    "category": "心臟科 > 抗心律不整 > Class IV",
    "mechanism": "阻斷L-type Ca2+通道，延長AV node傳導",
    "indications": "心律不整治療",
    "effects": "調節鈣離子通道/骨代謝/血管平滑肌收縮；PDF重點：舒張冠狀動脈；抑制心臟",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Verapamil",
    "category": "心臟科 > 降血壓/CCB > Non-DHP",
    "mechanism": "阻斷L-type Ca2+通道，抑制心臟傳導並舒張冠狀動脈",
    "indications": "高血壓；部分用於心衰竭、腎保護或心絞痛",
    "effects": "調節鈣離子通道/骨代謝/血管平滑肌收縮；PDF重點：舒張冠狀動脈；抑制心臟",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Dicloxacillin",
    "category": "感染科 > 抗生素 > Penicillinase-resistant penicillins",
    "mechanism": "β-lactam；抑制PBP，且較耐penicillinase",
    "indications": "Amoxicillin 不受食物影響，很常使用，用以治鏈球菌咽喉",
    "effects": "抑制細菌細胞壁、蛋白質、核酸或葉酸代謝",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Buspirone",
    "category": "神經/精神科 > 抗焦慮藥",
    "mechanism": "5-HT1A受器部分致效",
    "indications": "僅焦慮解除劑、無安眠效果；比較：Bupropion(抗精神藥物NDRI)，Buprenorphine(嗎啡戒斷)",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "p.23: 坐車號5HT 1A的巴士(Bus-)，巴士開很慢(onset慢)，很放鬆可以解除焦慮，但不會",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Buspirone",
    "category": "自泌素 > Serotonin > 5-HT1A致效",
    "mechanism": "5-HT1A受器部分致效",
    "indications": "抗焦慮(作用慢)",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "p.23: 坐車號5HT 1A的巴士(Bus-)，巴士開很慢(onset慢)，很放鬆可以解除焦慮，但不會",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Octreotide",
    "category": "內分泌/新陳代謝 > 腦下垂體 > Somatostatin類似物",
    "mechanism": "Somatostatin受器致效，抑制GH與多種內分泌分泌",
    "indications": "高脂血症與動脈粥樣硬化風險降低",
    "effects": "降低膽固醇合成、上調LDL受器；PDF重點：抑制GH 分泌(較SST 強)；抑制胰島素、升糖素和胃泌素分泌",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Gemfibrozil",
    "category": "心臟科 > 降血脂 > Fibrates",
    "mechanism": "活化PPAR-α，增加lipoprotein lipase，降低TG",
    "indications": "高脂血症與動脈粥樣硬化風險降低",
    "effects": "依其機轉產生對應藥理作用；請搭配適應症與考點複習；PDF重點：lipase、HDL↑；比較：刺激 PPAR-γ(-glitazone)降",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Selegiline",
    "category": "神經/精神科 > 抗帕金森 > MAO-B抑制",
    "mechanism": "選擇性抑制MAO-B，減少DA代謝",
    "indications": "帕金森氏症或藥物誘發EPS",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號；PDF重點：抑制MAO-B",
    "mnemonic": "p.30: 史萊哲林(selegiline)都很會喇賽(rasa-)和裝逼(MAO-B)\np.31: 吉林(-giline)很冷，貓咪(MAO B)不喜歡(抑制)",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Octreotide",
    "category": "腸胃科 > 止瀉劑 > Somatostatin類似物",
    "mechanism": "Somatostatin受器致效，抑制多種腸胃/內分泌分泌",
    "indications": "效較長(可治肢端肥大症、；緩解內分泌(糖尿病、化療後)造成之腹瀉",
    "effects": "降低膽固醇合成、上調LDL受器；PDF重點：緩解內分泌(糖尿病、化療後)造成之腹瀉",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Diphenoxylate",
    "category": "腸胃科 > 止瀉劑 > 周邊Opioid致效",
    "mechanism": "周邊μ/δ opioid受器致效，抑制腸道ACh釋放與蠕動",
    "indications": "感之Ach 釋出，不可止痛)；兩者皆專用於止瀉，不具止痛作用",
    "effects": "活化對應受器，產生受器相關生理效應；PDF重點：(透過μ、δ 受器抑制副交；感之Ach 釋出，不可止痛)",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Nifedipine",
    "category": "心臟科 > 降血壓/CCB > DHP",
    "mechanism": "阻斷L-type Ca2+通道，以血管平滑肌舒張為主",
    "indications": "治療雷諾氏症狀(手指麻木發紺)",
    "effects": "調節鈣離子通道/骨代謝/血管平滑肌收縮；PDF重點：心臟抑制(後兩者)；低頻(-dipine)聲音會阻止Ca2+ 抑血管收縮",
    "mnemonic": "p.49: 低頻(-dipine)聲音會阻止Ca2+ 抑血管收縮",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Gentamicin",
    "category": "感染科 > 抗生素 > Aminoglycosides",
    "mechanism": "不可逆結合30S，造成mRNA誤讀並抑制起始複合體",
    "indications": "嚴重好氧G(-)感染；與β-lactam併用抗腸球菌",
    "effects": "Aminoglycoside，抑制30S造成misreading；濃度依賴殺菌，腎/耳毒性",
    "mnemonic": "p.107: • 用萬(Vanco-)劍(Genta-)彈 4. Dalbavancin、Telavancin可用於Vancomycin有抗藥性之",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Dalbavancin",
    "category": "感染科 > 抗生素 > Lipoglycopeptide",
    "mechanism": "結合D-Ala-D-Ala並抑制細胞壁合成；部分亦破壞膜功能",
    "indications": "細菌感染治療（菌種依藥物光譜）",
    "effects": "抑制細菌細胞壁、蛋白質、核酸或葉酸代謝",
    "mnemonic": "p.107: • 用萬(Vanco-)劍(Genta-)彈 4. Dalbavancin、Telavancin可用於Vancomycin有抗藥性之\np.107: 鐵口騙你(Teicoplanin)，舔那(Tela-)痘疤(Dalba-)",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Midazolam",
    "category": "神經/精神科 > 抗焦慮/鎮靜安眠 > Benzodiazepines",
    "mechanism": "GABA_A受器正向變構調節；增加Cl-通道開啟頻率",
    "indications": "成癮性、戒斷症狀較明顯",
    "effects": "增強GABA-A抑制性傳導，鎮靜、抗焦慮、抗癲癇",
    "mnemonic": "p.21: 麥來作亂(Midazolam)： 術前、氣管插管前鎮 3. 適應症：鎮靜、抗焦慮、抗癲癇\np.21: 我打走(midazolam)踹走(Triazolam)牛 Temazepam、長Flurazepam) (ox-) ： (2)抗痙攣(Clonazepam) 被術前打鎮定劑的時候因為不想手術，所以我打 (3)中樞性骨骼肌鬆弛劑(Diazepam) 走 (midazolam) 醫生。 (4)急性酒精戒斷治療(Dia-、Oxa-、",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Cisplatin",
    "category": "血液腫瘤科 > 抗癌 > Platinum compounds",
    "mechanism": "形成DNA交聯，抑制DNA複製/轉錄",
    "indications": "治療實質固態瘤（solid tumor）；會造成惡性高血壓",
    "effects": "干擾DNA/RNA或細胞分裂，產生細胞毒性；PDF重點：會造成惡性高血壓；和酒精共同服用可能造成disulfiram-like",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Sirolimus",
    "category": "風濕免疫科 > 免疫抑制 > mTOR抑制",
    "mechanism": "與FKBP12結合抑制mTOR，抑制IL-2驅動之T cell增殖",
    "indications": "預防血管內皮；腹瀉、高血脂、感染",
    "effects": "抑制calcineurin→↓IL-2與T細胞活化，產生免疫抑制；PDF重點：與FKBP12 結合；骨髓抑制",
    "mnemonic": "p.87: 在西螺大橋(sirolimus)上騎摩托車(mTOR inhibitor)大聲地按喇叭(rapamycin)\np.87: 我騎摩托車(mTOR)去西螺(Siro-)，食物總是(Ever-)甜死(Temsi-)",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Aminoglutethimide",
    "category": "內分泌/新陳代謝 > 腎上腺類固醇合成抑制",
    "mechanism": "抑制cholesterol side-chain cleavage，減少所有腎上腺皮質類固醇合成",
    "indications": "發炎/免疫疾病、腎上腺功能異常或替代治療",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號；PDF重點：抑制膽固醇轉變成Pregnelolone(抑制；完全阻斷抑制三種腎上腺皮質類固醇的合成",
    "mnemonic": "p.74: 山脈很高(-thimide, Aminoglutethimide)，跨不過去，全部block (三種腎上線皮質都降低)",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Amiloride",
    "category": "心臟科 > 利尿劑 > ENaC阻斷",
    "mechanism": "直接阻斷集尿管ENaC，保鉀利尿",
    "indications": "高血壓、水腫、心衰竭或特定電解質異常（依藥物）",
    "effects": "增加尿鈉/水排出，依部位影響K、Ca、Mg與酸鹼；PDF重點：直接阻斷；代償因他種利尿劑引發之",
    "mnemonic": "p.47: 嘉義的阿財super愛噴錢：(建議搭配影片服用www https://youtu.be/nslykuObX9k) 嘉義(K+)的阿財(阿成台灣阿成世界偉人財神總統，簡稱阿財)(阿ami-，財 tria-)super(spiron-)愛噴錢(eple-)，E奶(抑制ENaC)Amy想被騎(Amiloride)想try m(triamterene)",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Milrinone",
    "category": "心臟科 > 心衰竭 > PDE3抑制",
    "mechanism": "抑制PDE3，使cAMP上升，增加心收縮並血管舒張",
    "indications": "心衰竭症狀改善或預後治療",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號；PDF重點：心收縮、血管舒張；低鎂、腎功能差時)→不可與造成",
    "mnemonic": "p.53: 犀牛(英,-rinone)很強(強心)壯🡺去把PDE3撞壞(PDE3 低血鉀的利尿劑並用 inh.) 解毒：",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Adalimumab",
    "category": "腸胃科 > IBD > Anti-TNF",
    "mechanism": "中和TNF-α",
    "indications": "腸胃蠕動異常、嘔吐、便祕/腹瀉、IBD或IBS（依藥物）",
    "effects": "依其機轉產生對應藥理作用；請搭配適應症與考點複習",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Ranitidine",
    "category": "自泌素/腸胃 > H2阻斷",
    "mechanism": "H2受器阻斷，抑制胃壁細胞酸分泌",
    "indications": "過敏/蕁麻疹、動暈或胃酸相關疾病（依受器）",
    "effects": "抑制胃酸分泌",
    "mnemonic": "p.65: 躲在梯廳(-tidine)不能呵呵笑(HH笑🡺H2 receptor blocker)\np.65: 西門慶(Cime-)讓你(Rani-) 撫摸(Famo-)，你讓他硬(Nizatidine)；因為西門慶(Cimetidine)很色一直 做，最後會陽痿(SE)；你讓他硬(Nizatidine)用嘴巴(口服)\np.65: 先記前三個：西門町(Cime-)逛街，女生很多(Cime-作用：抗雄性素，造成男性女乳症)，逛街到一半有人拉 住你(Rani-)(拉住你=會讓CYP450下降)，問你要不要當髮模(Famo-)。要當髮模，時間要夠多(藥效長且 強)，且不可以被影響(不影響CYP450)。",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Atezolizumab",
    "category": "風濕免疫/腫瘤 > Immune checkpoint > Anti-PD-L1",
    "mechanism": "抗PD-L1，解除T細胞抑制",
    "indications": "特定癌症或腫瘤標靶治療",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "p.94: [以上三種連貫一起記] 第一(PD-1)，你(Ni-)騙bro(Pembro-)Later(PD-L1)，又AAD(Atezolizumab, Avelemab, Durvalumab) 註： AAD是Against Advise Discharge(自動出院)做壞事要依比例(Ipili-)啦(CTLA-4)",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Adalimumab",
    "category": "風濕免疫科 > 生物製劑 > Anti-TNF",
    "mechanism": "抗TNF-α單株抗體/片段，中和TNF",
    "indications": "未在PDF同列明確標示；依分類臨床適應症複習",
    "effects": "依其機轉產生對應藥理作用；請搭配適應症與考點複習；PDF重點：抑制TNF-α(106-1)",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Cephalexin",
    "category": "感染科 > 抗生素 > Cephalosporin第一代",
    "mechanism": "β-lactam；抑制PBP/細胞壁合成",
    "indications": "手術前預防用藥首選(106-1)；手術是一種蹂躪(Cefa-zolin)，術前預防性用藥。",
    "effects": "抑制細菌細胞壁、蛋白質、核酸或葉酸代謝",
    "mnemonic": "p.105: 有人來信(Cephalexin)，叫我去濁水溪(Cefadroxil)揍人(Cefazoline)",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Labetalol",
    "category": "神經/精神科 > 交感神經阻斷劑 > α1+β阻斷",
    "mechanism": "α1、β1、β2受器阻斷，兼具血管擴張與降心輸出",
    "indications": "高血壓",
    "effects": "支氣管平滑肌放鬆；可有心悸、低血鉀、高血糖",
    "mnemonic": "p.14: 來逼他(Labeta-)熬夜喝咖啡打lol(Carve-dilol)\np.14: l-a-beta-lol (藥名同時有α、有β、有lol)",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Memantine",
    "category": "神經/精神科 > 抗阿茲海默 > NMDA拮抗",
    "mechanism": "NMDA受器非競爭性拮抗，降低glutamate excitotoxicity",
    "indications": "治療中重度AD",
    "effects": "阻斷對應受器或通道，降低該路徑效應",
    "mnemonic": "p.34: 東尼(Done-)跟蓋倫(Galan-)看到廣告(AD)跑去理髮(Riva)得到迷妹(Mema-)",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Cabazitaxel",
    "category": "血液腫瘤科 > 抗癌 > Taxanes",
    "mechanism": "穩定微小管，抑制去聚合",
    "indications": "特定癌症或腫瘤標靶治療",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "p.101: 愛離不離",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Irinotecan",
    "category": "血液腫瘤科 > 抗癌 > Topoisomerase I抑制",
    "mechanism": "抑制topoisomerase I，阻止DNA單股斷裂修復",
    "indications": "急性膽鹼性症候群(Atropine 治)；腹瀉(Loperamide 治療)",
    "effects": "干擾DNA/RNA或細胞分裂，產生細胞毒性",
    "mnemonic": "p.101: 意淩(irin-)露營(camp-)，第一次遇到土撥鼠(抑制topoisomerase 1)",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Tenecteplase",
    "category": "血液腫瘤科 > 血栓溶解劑",
    "mechanism": "活化plasminogen為plasmin，分解fibrin血栓",
    "indications": "作用於血栓中",
    "effects": "依其機轉產生對應藥理作用；請搭配適應症與考點複習",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Sunitinib",
    "category": "風濕免疫/腫瘤 > 標靶治療 > 多靶點TKI",
    "mechanism": "抑制VEGFR/PDGFR等多種tyrosine kinase",
    "indications": "特定癌症或腫瘤標靶治療",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "p.93: 拉姆(Ramu-)從被窩(Beva-)起來，看到是晴天(suni-)，爽啦(sora-)\np.93: 你老母(Ramu-)咧，真的很白目(台, Beva-)耶，知道我要考試，還跟我說：”爽啦(Sora-)是 晴天(suni-)”，還跟我比YA(V, VGFR)，Sunny(Suni-)，備馬(Beva-) 拉母(Ramu-)牛去曬 太陽，爽啦(Sora-)",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Piroxicam",
    "category": "風濕免疫科 > NSAID > Oxicam類",
    "mechanism": "抑制COX；Meloxicam低劑量較偏COX-2",
    "indications": "高度selective，治RA、；無抗血小板作用；(Vioxx)易血栓，已下架；適用：兒童感染病毒(109-1) (避Aspirin 的",
    "effects": "降低前列腺素生成，解熱、止痛、抗發炎；PDF重點：增加MI、中風風險；無抗血小板作用",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Reslizumab",
    "category": "風濕免疫科 > 生物製劑 > Anti-IL-5",
    "mechanism": "抗IL-5單株抗體，降低嗜酸性球活性",
    "indications": "(IM)治乾癬；治RA、巨細胞動脈炎",
    "effects": "依其機轉產生對應藥理作用；請搭配適應症與考點複習",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Fenofibrate",
    "category": "心臟科 > 降血脂 > Fibrates",
    "mechanism": "活化PPAR-α，增加lipoprotein lipase，降低TG",
    "indications": "高脂血症與動脈粥樣硬化風險降低",
    "effects": "依其機轉產生對應藥理作用；請搭配適應症與考點複習",
    "mnemonic": "p.57: 鐵支(TG)翻倍(fibrate)劈哩啪啦(PPAR-alpha)慶祝太激動(肌痛肌痛)",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Raltegravir",
    "category": "感染科 > 抗HIV > Integrase inhibitor",
    "mechanism": "抑制HIV integrase，阻止病毒DNA整合",
    "indications": "病毒感染治療或預防",
    "effects": "干擾DNA/RNA或細胞分裂，產生細胞毒性；PDF重點：阻斷HIV-1 及HIV-2 嵌合酶(integrase)的活性；阻斷複製完成的病毒釋出",
    "mnemonic": "p.120: (從外到內喔)：馬拉拉(Mara-) 愛浮潛(Efu-)，而且她博學多聞記很多(Zido-)拉密定理 (Lami-)，最後還暴動似的(riot, Ralte-)用力的K自己的陰蒂(Indi-) 🡺 一句話：馬拉愛浮記多 拉特陰蒂",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Pralidoxime",
    "category": "毒物學 > 解毒劑",
    "mechanism": "重新活化被有機磷磷酸化之AChE（aging前有效）",
    "indications": "重症肌無力、青光眼、阿茲海默症或解抗膽鹼毒性（依藥物）",
    "effects": "結合毒物/重金屬或繞過毒性路徑以促進排除",
    "mnemonic": "p.16: Pralidoxime：依林(AChE inh磷中毒的解毒劑)中毒好了之後穿得趴哩趴哩(Prali)",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Citalopram",
    "category": "神經/精神科 > 抗憂鬱 > SSRI",
    "mechanism": "選擇性抑制SERT，增加突觸間5-HT",
    "indications": "禁突然停藥(眩暈失眠疲倦噁心焦慮寒顫頭痛等戒斷症狀)",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "p.25: 怕流感(Par-, Flu-)，我先停(-oxetine) 洗塔羅牌(Citalopram)，避免Sir抓你 (Sertraline)",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Ephedrine",
    "category": "神經/精神科 > 擬交感神經藥物 > 直接/間接混合型",
    "mechanism": "α1、β2受器致效並促進NE釋放",
    "indications": "(α1)治鼻塞、尿床 (β2)治氣喘；(NE)升血壓，常作為禁藥；降低食慾→減肥",
    "effects": "支氣管平滑肌放鬆；可有心悸、低血鉀、高血糖；PDF重點：(NE)升血壓，常作為禁藥；降低食慾→減肥",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Naltrexone",
    "category": "內分泌/新陳代謝 > 減肥藥",
    "mechanism": "Opioid受器拮抗，用於食慾/獎賞路徑調節",
    "indications": "肥胖症輔助治療",
    "effects": "阻斷對應受器或通道，降低該路徑效應；PDF重點：延緩胃排空抑制食慾，國內合法",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Captopril",
    "category": "心臟科 > 降血壓 > ACEI",
    "mechanism": "抑制ACE，使Angiotensin II下降、Bradykinin上升",
    "indications": "高血壓、心衰竭、糖尿病腎病變/蛋白尿等RAAS適應症",
    "effects": "ACE inhibitor：↓Ang II、↑bradykinin，血管擴張並降低醛固酮；副作用乾咳/血管性水腫/高血鉀",
    "mnemonic": "p.49: 有人出ACE(ACEI)，我”呸!(-pril)”，我有更大的牌! 呸完噎到🡺一直咳嗽(SE)\np.49: ACE念起來跟ass很像，ass就是屁喔(-pril)\np.49: ACE餅乾(ACEI)很難吃，呸(pril)~吐掉\np.49: 這是一個打怪的故事： 第一關：怪物是愛斯基摩人(Aliskiren)因為是人所以造成畸胎(SE)。 第二關：怪物是屁怪(-pril)，會放屁攻擊你造成咳嗽(SE)。 BOSS關：怪物是撒旦(-sartan)，因為撒旦太強，所以無皮保護作用(特性)",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Darunavir",
    "category": "感染科 > 抗HIV > Protease inhibitor",
    "mechanism": "抑制HIV protease，阻止病毒多蛋白切割成熟",
    "indications": "病毒感染治療或預防",
    "effects": "抑制病毒複製、成熟或進入宿主細胞",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Naltrexone",
    "category": "神經/精神科 > 類鴉片解毒/戒斷",
    "mechanism": "長效opioid受器拮抗",
    "indications": "解毒、戒癮(酒癮)，少用(易產生強烈戒斷症狀)",
    "effects": "結合毒物/重金屬或繞過毒性路徑以促進排除",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Cholestyramine",
    "category": "心臟科 > 降血脂 > Bile acid resins",
    "mechanism": "結合腸道膽酸/陰離子，增加膽酸排出並降低LDL",
    "indications": "無降TG 效果",
    "effects": "依其機轉產生對應藥理作用；請搭配適應症與考點複習；PDF重點：干擾脂溶性物質吸收(Vit. ADEK↓)；肝為了製造膽酸→膽固醇↓→LDL-R↑",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Cefoperazone",
    "category": "感染科 > 抗生素 > Cephalosporin第三代",
    "mechanism": "β-lactam；抑制PBP/細胞壁合成",
    "indications": "細菌感染治療（菌種依藥物光譜）",
    "effects": "抑制細菌細胞壁、蛋白質、核酸或葉酸代謝",
    "mnemonic": "p.106: • 泰坦(Cefotetan)與曼陀珠(Cefamandole)喝酒，但巴拉松(Cefoperazone)沒帶鎖(Cefmatazole)",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Trazodone",
    "category": "神經/精神科 > 抗憂鬱 > SARI",
    "mechanism": "阻斷5-HT2受器並抑制5-HT再回收",
    "indications": "抗H1(鎮靜)；→抗憂鬱；抗α1(姿勢性低血壓)；插肉洞(trazod-)→很爽抗憂鬱",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）；PDF重點：低劑量→抑制5HT2A-R→安眠藥；高劑量→抑制5HT2A-R 和SERT",
    "mnemonic": "p.25: 插肉洞(trazod-)→很爽抗憂鬱；但SE：陰莖持續勃 抗α1(姿勢性低血壓) 3. 抑制5HT2A-R→ 起 較無性功能障礙之副作用",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Salmeterol",
    "category": "神經/精神科 > 擬交感神經藥物 > β2長效致效劑",
    "mechanism": "長效β2受器致效，活化Gs/cAMP使支氣管平滑肌鬆弛",
    "indications": "治夜間氣；喘首選；安胎 利得胎；裡頭定 →安胎",
    "effects": "支氣管平滑肌放鬆；可有心悸、低血鉀、高血糖",
    "mnemonic": "p.62: 短效：阿布(albu)牌渦輪(terbut-)很terrible(-terol)",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Salmeterol",
    "category": "胸腔科 > 抗氣喘 > β2長效致效",
    "mechanism": "長效β2受器致效，促進cAMP使支氣管平滑肌鬆弛",
    "indications": "控制時，常合併用之",
    "effects": "支氣管平滑肌放鬆；可有心悸、低血鉀、高血糖",
    "mnemonic": "p.62: 短效：阿布(albu)牌渦輪(terbut-)很terrible(-terol)",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Cholestyramine",
    "category": "腸胃科 > 止瀉劑 > 膽汁酸樹脂",
    "mechanism": "結合腸道膽汁酸，減少膽汁酸性腹瀉",
    "indications": "腸胃蠕動異常、嘔吐、便祕/腹瀉、IBD或IBS（依藥物）",
    "effects": "依其機轉產生對應藥理作用；請搭配適應症與考點複習；PDF重點：agonist，活化 GC-C → 增加 cGMP→活化；regulator）氯通道→促進 Cl⁻、HCO₃⁻、",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Bosentan",
    "category": "心臟科 > 降血壓/肺高壓 > Endothelin受器拮抗",
    "mechanism": "ETA/ETB受器拮抗，降低肺血管收縮",
    "indications": "治療肺動脈高壓；胞接受體的結抗劑",
    "effects": "阻斷對應受器或通道，降低該路徑效應；PDF重點：抑制節後神經元釋出；抑制小泡釋放NE",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Ciprofloxacin",
    "category": "感染科 > 抗生素 > Fluoroquinolones",
    "mechanism": "抑制DNA gyrase與topoisomerase IV",
    "indications": "細菌感染治療（菌種依藥物光譜）",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）；PDF重點：G(+)↑",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Imipramine",
    "category": "神經/精神科 > 抗憂鬱 > TCA",
    "mechanism": "抑制NET與SERT，增加NE與5-HT；另有M1/H1/α1阻斷",
    "indications": "治夜尿；鎮靜作用強(抗H1；抗H1：增重、嗜睡、鎮靜",
    "effects": "血管/括約肌收縮；阻斷時則血管與前列腺平滑肌放鬆",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Iloprost",
    "category": "自泌素 > Eicosanoid > PGI2類似物/IP受器致效",
    "mechanism": "PGI2/IP受器致效，血管擴張並抑制血小板凝集",
    "indications": "發炎疼痛、氣喘、肺高壓或胃黏膜保護（依藥物）",
    "effects": "活化對應受器，產生受器相關生理效應",
    "mnemonic": "p.60: 姨婆(Epo-)在百貨一樓(ilo-)select包包(selexipag)，櫃姐吹捧 (Trepro-)她不像其他廢物(預防肺動脈高壓)一樣，是一位愛(PGI2)包達 人\np.60: 一破破(Epopro-)，一籮破(Ilopro-)，大破特破(Tepro-)→抑制血小 板凝集\np.60: 吹捧(trepro-)伊龍馬(ilo-)，apple pro(epopro-)隨便挑 (select-)。",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Ipilimumab",
    "category": "風濕免疫/腫瘤 > Immune checkpoint > Anti-CTLA4",
    "mechanism": "抗CTLA-4，增強T細胞共刺激",
    "indications": "治黑色素瘤；增加免疫；可以改善骨髓抑；原為抗蟲藥，後發現可促淋巴球",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）；PDF重點：增加免疫；化療後(嗜中性球↑)",
    "mnemonic": "p.94: 西班牙(CTLA-4)在伊比利半島(Ipili-)\np.94: [以上三種連貫一起記] 第一(PD-1)，你(Ni-)騙bro(Pembro-)Later(PD-L1)，又AAD(Atezolizumab, Avelemab, Durvalumab) 註： AAD是Against Advise Discharge(自動出院)做壞事要依比例(Ipili-)啦(CTLA-4)",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Liraglutide",
    "category": "內分泌/新陳代謝 > 糖尿病 > GLP-1致效",
    "mechanism": "GLP-1受器致效，葡萄糖依賴性促insulin並抑制glucagon",
    "indications": "糖尿病血糖控制",
    "effects": "降低血糖或改善胰島素/腸泌素/腎糖排出路徑；PDF重點：延緩胃排空抑制食慾，國內合法",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Betamethasone",
    "category": "內分泌/新陳代謝 > 腎上腺皮質醇 > 長效Glucocorticoid",
    "mechanism": "活化glucocorticoid receptor，長效抗炎/免疫抑制",
    "indications": "治腦腫瘤水腫，診斷Cushing",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號；PDF重點：生長抑制、",
    "mnemonic": "p.74: (Betamethasone) Be-想到Baby，用在給小baby促進肺成熟",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Calcitonin",
    "category": "內分泌/新陳代謝 > 鈣質相關 > 降鈣素",
    "mechanism": "抑制osteoclast活性，降低骨吸收",
    "indications": "治Paget's disease(109-1)；預防",
    "effects": "調節鈣離子通道/骨代謝/血管平滑肌收縮；PDF重點：鈣↓磷↓；↓腸吸收鈣&磷、↓骨吸收(=分解)、↑腎排鈣&磷",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Famotidine",
    "category": "自泌素/腸胃 > H2阻斷",
    "mechanism": "H2受器阻斷，抑制胃壁細胞酸分泌",
    "indications": "過敏/蕁麻疹、動暈或胃酸相關疾病（依受器）",
    "effects": "抑制胃酸分泌",
    "mnemonic": "p.65: 躲在梯廳(-tidine)不能呵呵笑(HH笑🡺H2 receptor blocker)\np.65: 西門慶(Cime-)讓你(Rani-) 撫摸(Famo-)，你讓他硬(Nizatidine)；因為西門慶(Cimetidine)很色一直 做，最後會陽痿(SE)；你讓他硬(Nizatidine)用嘴巴(口服)\np.65: 先記前三個：西門町(Cime-)逛街，女生很多(Cime-作用：抗雄性素，造成男性女乳症)，逛街到一半有人拉 住你(Rani-)(拉住你=會讓CYP450下降)，問你要不要當髮模(Famo-)。要當髮模，時間要夠多(藥效長且 強)，且不可以被影響(不影響CYP450)。",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "TMP-SMX",
    "category": "感染科 > 抗生素 > 抗葉酸合併",
    "mechanism": "Sulfamethoxazole抑制dihydropteroate synthase，Trimethoprim抑制DHFR",
    "indications": "細菌感染治療（菌種依藥物光譜）",
    "effects": "抑制細菌細胞壁、蛋白質、核酸或葉酸代謝",
    "mnemonic": "p.35: 搞藝術(ARTS: Allopurinol, Rifampin, Tmp-Smx)的蘇軾(Ethosuximide)，開 車的Obama(carbamazepine)，都比不上Pro IC(Valproic)大亨Steve Jobs(Steven-Johnson syndrome)",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Duloxetine",
    "category": "神經/精神科 > 抗憂鬱 > SNRI",
    "mechanism": "抑制SERT與NET，增加5-HT與NE",
    "indications": "憂鬱症、焦慮症或神經痛/偏頭痛預防（依藥物）",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "p.25: SNoRe太大聲被發現(-faxine)，被禁止snore(抑制Serotonin NE回收)",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Lasmiditan",
    "category": "神經/精神科 > 頭痛用藥 > 5-HT1F致效",
    "mechanism": "5-HT1F受器致效，抑制三叉神經痛覺傳遞",
    "indications": "偏頭痛急性治療或預防",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Pantoprazole",
    "category": "腸胃科 > 消化性潰瘍 > PPI",
    "mechanism": "不可逆抑制胃壁細胞H+/K+ ATPase",
    "indications": "GERD、消化性潰瘍、胃酸過多或H. pylori輔助治療",
    "effects": "抑制胃酸分泌",
    "mnemonic": "p.65: 用puzzle拼出PPI <取自小鳥醫師8.0>\np.65: 屁屁挨(PPI)打，怕揍(-prazole)\np.116: 蓋地板(台語，起頭咖)(Ketoco-)對阿祖(-azole)來說是一種苦行(Cushing)，可以治Cushing syndrome\np.116: 阿祖(-azole)看到爛(lanosterol)人很不爽，他踢他屁屁(P450)，剁他耳朵(ergosterol)",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Dabigatran",
    "category": "血液腫瘤科 > 抗凝血 > Direct thrombin inhibitors",
    "mechanism": "直接抑制thrombin (factor IIa)",
    "indications": "特定癌症或腫瘤標靶治療",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號",
    "mnemonic": "p.95: 美拉想搭船(Melagatran)，要去西門所以來搭船(Ximelagatran)。但身上沒帶錢，只好賴皮 (Lepi-)不付錢，結果被罰(Biva-)用agar(Arga-)當代幣(Dabi-)\np.95: 沒錢賴皮(Lepi-)，只好割腎(腎代謝)做代幣(Dabi-)。(只有Lepi和Dabi是腎代謝，其他都是肝 代謝)",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Cetuximab",
    "category": "風濕免疫/腫瘤 > 標靶治療 > Anti-EGFR",
    "mechanism": "抗EGFR單株抗體，阻斷EGFR訊號",
    "indications": "頭頸麟狀細胞癌；腹瀉；(轉移型大腸直腸癌、頭頸癌的選)；非小細胞肺癌具EGFR 突變, 胰臟癌",
    "effects": "阻斷對應受器或通道，降低該路徑效應",
    "mnemonic": "p.93: Penny(Pani-)收到一大堆(a lot, Erlot-)禮物(gift, Geft-)，吸了一大口就吐了(吸吐， cetu-)\np.93: 騙你(Pani-)收Gift(Geft-)，你生氣的吸吐(Cetu-)氣 ，捏死(Neci-)你耳朵(Erlot-)\np.93: 皮條客(EGFR)試圖(cetu-)盤你(pani-), 你捏死他(necitu-), 斷他頸項(治頭頸癌)",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Linezolid",
    "category": "感染科 > 抗生素 > Oxazolidinone",
    "mechanism": "結合50S，阻止70S起始複合體形成",
    "indications": "可作為Vancomycin(僅IV)治MRSA 替代用藥",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）；PDF重點：結合50S 中的23S，抑制起始複合物形成；抑制起始作用",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "SMX-TMP",
    "category": "感染科 > 抗生素 > 抗葉酸合併",
    "mechanism": "Sulfamethoxazole抑制dihydropteroate synthase，Trimethoprim抑制DHFR",
    "indications": "細菌感染治療（菌種依藥物光譜）",
    "effects": "抑制細菌細胞壁、蛋白質、核酸或葉酸代謝",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Tirofiban",
    "category": "血液腫瘤科 > 抗血小板 > GP IIb/IIIa拮抗",
    "mechanism": "阻斷GP IIb/IIIa，抑制fibrinogen橋接血小板",
    "indications": "特定癌症或腫瘤標靶治療",
    "effects": "阻斷對應受器或通道，降低該路徑效應",
    "mnemonic": "p.96: 在ABCmart(Abci-)裡，T羅飛奔(tirofiban)去買鞋子，結果鞋子被賣光empty(empti-)了\np.96: ***接續上面的故事：只有肉體關係太弱(Tiro-)，應該要交流一些ABC(abcixi-)、或3A2B(阻斷GP llb/llla- R)這種猜數字的遊戲、或是跆拳道如何踢飛body(-tifibate)",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Repaglinide",
    "category": "內分泌/新陳代謝 > 糖尿病 > Meglitinides",
    "mechanism": "阻斷胰臟β細胞KATP通道，促進餐後insulin分泌",
    "indications": "氣喘/COPD、動暈、尿失禁、帕金森/EPS或散瞳（依藥物）",
    "effects": "降低血糖或改善胰島素/腸泌素/腎糖排出路徑",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Conivaptan",
    "category": "心臟科 > 利尿劑 > ADH拮抗",
    "mechanism": "V1a/V2受器拮抗，增加自由水排出",
    "indications": "高血壓、水腫、心衰竭或特定電解質異常（依藥物）",
    "effects": "增加尿鈉/水排出，依部位影響K、Ca、Mg與酸鹼；PDF重點：減少水分再吸收；血Na+濃度增加",
    "mnemonic": "p.47: Call你發糖(conivaptan)，偷發糖(tolvaptan)，Damn call(demeclo-)！！(=後悔call你)",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Ranolazine",
    "category": "心臟科 > 心絞痛 > Late Na current抑制",
    "mechanism": "抑制late Na+ current，降低細胞內Na+與Ca2+累積",
    "indications": "穩定型心絞痛首選；不可突然停藥→反彈性心絞痛或高血壓",
    "effects": "抑制電位依賴性鈉通道，降低神經或心肌興奮性；PDF重點：藉由抑制Late Na current，使Na 無法進入細胞內，當胞內Na 不夠",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Sotalol",
    "category": "心臟科 > 抗心律不整 > Class III",
    "mechanism": "阻斷K+通道，延長phase 3與ERP",
    "indications": "長期服用降低AMI 死亡率",
    "effects": "阻斷對應受器或通道，降低該路徑效應；PDF重點：同時具classII、III、含強力β 阻斷活性(非選擇性)；長期服用降低AMI 死亡率",
    "mnemonic": "p.55: 假的(K blocker) 阿喵(Amio-) 其實是Brety姐(Bretylium)，她一步踢來(Ibutilide)，都飛 踢(Dofeti-)， 求你(Drone-) ㄙㄡˊ她(Sota-，撫摸)的Vagina(Verna-) <取自高醫元廷藥理>",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Cefotaxime",
    "category": "感染科 > 抗生素 > Cephalosporin第三代",
    "mechanism": "β-lactam；抑制PBP/細胞壁合成",
    "indications": "細菌感染治療（菌種依藥物光譜）",
    "effects": "抑制細菌細胞壁、蛋白質、核酸或葉酸代謝",
    "mnemonic": "p.106: 波多野結衣(cefpodoxime)說fuck me(cefixime)害我不能思考(進不到BBB)；她說：『吹爽(ceftriaxone)我 還有fuck me(cefixime)』結果看到有淋病(淋病藥首選)，我很兇的叫她立定(ceftazidime)結果綠膿流出來 (第三代唯一治綠膿)，她還說因為我吹爽(ceftriaxone)她，所以要付稅給我(cefotaxime)真是腦壞掉(治腦膜 炎)",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Carvedilol",
    "category": "神經/精神科 > 交感神經阻斷劑 > α1+β阻斷",
    "mechanism": "α1、β1、β2受器阻斷，兼具血管擴張與降心輸出",
    "indications": "高血壓、BPH、嗜鉻細胞瘤或雷諾氏現象（依選擇性）",
    "effects": "支氣管平滑肌放鬆；可有心悸、低血鉀、高血糖",
    "mnemonic": "p.14: 來逼他(Labeta-)熬夜喝咖啡打lol(Carve-dilol)\np.52: 我也(meto-)鼻屎(biso-)卡血管(carve-)那邊(nebi-) 卡血管=car-vessel，簡稱carve!阿 卡血管就心衰竭了!\np.52: 眉頭(Meto-)那邊(Nebi-) 一堆閉鎖(Biso-)粉刺，別再喝咖啡(Carve-)了！",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Etoposide",
    "category": "血液腫瘤科 > 抗癌 > 其他化療",
    "mechanism": "Dacarbazine/Procarbazine為DNA烷化/甲基化；Etoposide抑制topoisomerase II",
    "indications": "高血壓；部分用於心衰竭、腎保護或心絞痛",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）；PDF重點：骨髓抑制",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Metformin",
    "category": "內分泌/新陳代謝 > 糖尿病 > Biguanide",
    "mechanism": "活化AMPK並抑制肝臟糖質新生",
    "indications": "糖尿病血糖控制",
    "effects": "降低血糖或改善胰島素/腸泌素/腎糖排出路徑；PDF重點：抑制肝臟醣質新生；有減重效果，不會低血糖",
    "mnemonic": "p.76: 跟他交配(mate for me, metformin)，沒吃東西就劇烈運動🡺乳酸堆積(SE) 跟他交配(mate for me, metformin)，要戴套抑制新生命🡺抑制糖質新生",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Somatotropin",
    "category": "內分泌/新陳代謝 > 腦下垂體 > GH/GHRH",
    "mechanism": "重組GH，活化JAK-STAT並促進IGF-1",
    "indications": "用，使血糖上升；用於對exogenous GH 無反應的IGF-1 缺乏",
    "effects": "促進神經傳遞物質或內分泌/代謝反應；PDF重點：GHRH→GH() [JAK-STAT Pathway]→促進肝臟分泌IGF-1(Somatomedin C) [直接促",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Indinavir",
    "category": "感染科 > 抗HIV > Protease inhibitor",
    "mechanism": "抑制HIV protease，阻止病毒多蛋白切割成熟",
    "indications": "病毒感染治療或預防",
    "effects": "抑制病毒複製、成熟或進入宿主細胞",
    "mnemonic": "p.120: (從外到內喔)：馬拉拉(Mara-) 愛浮潛(Efu-)，而且她博學多聞記很多(Zido-)拉密定理 (Lami-)，最後還暴動似的(riot, Ralte-)用力的K自己的陰蒂(Indi-) 🡺 一句話：馬拉愛浮記多 拉特陰蒂",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Tazobactam",
    "category": "感染科 > 抗生素 > β-lactamase inhibitor",
    "mechanism": "抑制β-lactamase，保護β-lactam抗生素",
    "indications": "細菌感染治療（菌種依藥物光譜）",
    "effects": "抑制細菌細胞壁、蛋白質、核酸或葉酸代謝",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Omadacycline",
    "category": "感染科 > 抗生素 > 新型Tetracycline",
    "mechanism": "結合30S，抑制蛋白質合成",
    "indications": "細菌感染治療（菌種依藥物光譜）",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Zaleplon",
    "category": "神經/精神科 > 抗焦慮/鎮靜安眠 > Z-drugs",
    "mechanism": "作用於BZ1/GABA_A複合體，促進GABA抑制性傳遞",
    "indications": "短效、純安眠，無鎮靜、解除焦慮效果",
    "effects": "增強GABA-A抑制性傳導，鎮靜、抗焦慮、抗癲癇；PDF重點：短效、純安眠，無鎮靜、解除焦慮效果",
    "mnemonic": "p.23: Z drug：Z開頭的，純安眠作用(zzz…)",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Pseudoephedrine",
    "category": "神經/精神科 > 擬交感神經藥物 > 直接/間接混合型",
    "mechanism": "α1、β2受器致效並促進NE釋放",
    "indications": "鼻塞、上呼吸道鼻充血",
    "effects": "混合型交感作用：α1血管收縮並促NE釋放；可升血壓、心悸",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Epoprostenol",
    "category": "自泌素 > Eicosanoid > PGI2類似物/IP受器致效",
    "mechanism": "PGI2/IP受器致效，血管擴張並抑制血小板凝集",
    "indications": "發炎疼痛、氣喘、肺高壓或胃黏膜保護（依藥物）",
    "effects": "活化對應受器，產生受器相關生理效應；PDF重點：舒張；抑制血小",
    "mnemonic": "p.60: 一破破(Epopro-)，一籮破(Ilopro-)，大破特破(Tepro-)→抑制血小 板凝集\np.60: 吹捧(trepro-)伊龍馬(ilo-)，apple pro(epopro-)隨便挑 (select-)。",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Ketanserin",
    "category": "自泌素 > Serotonin > 5-HT2拮抗",
    "mechanism": "阻斷5-HT1C/5-HT2與α1受器",
    "indications": "治高血壓、血管痙攣；抗憂鬱劑, 安眠(111-2)；第二代抗精神病藥；血清素症候群(類癌)",
    "effects": "血管/括約肌收縮；阻斷時則血管與前列腺平滑肌放鬆；PDF重點：阻斷5-HT1C、5-HT2、；阻斷5-HT2",
    "mnemonic": "p.59: 師婆害怕他(Cypro-hepta-)在樓下(Locar-)堵人，小弟拿著漆彈(Ketan-)請他來談談",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Bivalirudin",
    "category": "血液腫瘤科 > 抗凝血 > Direct thrombin inhibitors",
    "mechanism": "直接抑制thrombin (factor IIa)",
    "indications": "特定癌症或腫瘤標靶治療",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號",
    "mnemonic": "p.95: 美拉想搭船(Melagatran)，要去西門所以來搭船(Ximelagatran)。但身上沒帶錢，只好賴皮 (Lepi-)不付錢，結果被罰(Biva-)用agar(Arga-)當代幣(Dabi-)",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Nivolumab",
    "category": "風濕免疫/腫瘤 > Immune checkpoint > Anti-PD-1",
    "mechanism": "抗PD-1，解除T細胞抑制",
    "indications": "特定癌症或腫瘤標靶治療",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "p.93: 討厭費城(抑制費城染色體)的一馬(ima-)，所以在尼羅(nivo-)河旁邊的大沙漠(dasa-)騎駱 駝(camel->CML)，結果迷路(所也需要MAP, 阻斷MAPK路徑)\np.94: 賣尼莫(nivo-)，偏薄利(pembro-)\np.94: 你摸(Nivo-)潘伯(Pembro-)，果然是頭號神經病Psychic",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Panitumumab",
    "category": "風濕免疫/腫瘤 > 標靶治療 > Anti-EGFR",
    "mechanism": "抗EGFR單株抗體，阻斷EGFR訊號",
    "indications": "(轉移型大腸直腸癌、頭頸癌的選)；非小細胞肺癌具EGFR 突變, 胰臟癌；腹瀉",
    "effects": "阻斷對應受器或通道，降低該路徑效應",
    "mnemonic": "p.93: Penny(Pani-)收到一大堆(a lot, Erlot-)禮物(gift, Geft-)，吸了一大口就吐了(吸吐， cetu-)\np.93: 你姊夫(gefi-)在二樓(erlo-)處理egg(EGFR)，你先洗手(台，Cetu)在上去找他，不然怕你吐 (panitu-)\np.93: 騙你(Pani-)收Gift(Geft-)，你生氣的吸吐(Cetu-)氣 ，捏死(Neci-)你耳朵(Erlot-)\np.93: 皮條客(EGFR)試圖(cetu-)盤你(pani-), 你捏死他(necitu-), 斷他頸項(治頭頸癌)",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Voriconazole",
    "category": "感染科 > 抗黴菌 > Azoles/Triazole",
    "mechanism": "抑制真菌14α-demethylase，降低ergosterol合成",
    "indications": "黴菌感染治療",
    "effects": "破壞真菌細胞膜/細胞壁或麥角固醇合成",
    "mnemonic": "p.116: 一起拿走(-conazole)唇&膜(抑egosterol醇合成，抑膜生成)\np.116: 蓋地板(台語，起頭咖)(Ketoco-)對阿祖(-azole)來說是一種苦行(Cushing)，可以治Cushing syndrome\np.116: 阿祖(-azole)看到爛(lanosterol)人很不爽，他踢他屁屁(P450)，剁他耳朵(ergosterol)\np.117: 我哩(Vori-)個去(麴菌)，小美穿薄紗(Posa-)，啊嘶~(絲黴菌)",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Oxygen",
    "category": "毒物學 > CO中毒",
    "mechanism": "提高氧分壓並促進CO與hemoglobin解離",
    "indications": "Oxidizing agents(nitrogen oxides 心衰竭、心絞痛、癌症；Digoxin 中毒 (112-1) (不適合使用血液透析解毒)；Lidocaine…等抗心律不整藥；Digoxin 抗體",
    "effects": "促進神經傳遞物質或內分泌/代謝反應",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Tisagenlecleucel",
    "category": "風濕免疫科 > 細胞治療",
    "mechanism": "CD19 CAR-T細胞，辨識並殺傷CD19陽性B細胞",
    "indications": "未在PDF同列明確標示；依分類臨床適應症複習",
    "effects": "依其機轉產生對應藥理作用；請搭配適應症與考點複習",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Atenolol",
    "category": "神經/精神科 > 交感神經阻斷劑 > β1選擇性阻斷",
    "mechanism": "選擇性β1受器阻斷，降低心率/收縮力/renin釋放",
    "indications": "高血壓、BPH、嗜鉻細胞瘤或雷諾氏現象（依選擇性）",
    "effects": "增加心收縮力/心跳或阻斷後降低心率與耗氧",
    "mnemonic": "p.14: -olol(A~M開頭的)：AM(白天)的OL比較挑(選擇性)，只要1支banana(B1 antagonist)\np.14: -olol(P開頭的)：晚上(不是下方A~M)的OL就不挑(非選擇性)，banana全都要(B antagonist)",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Erlotinib",
    "category": "風濕免疫/腫瘤 > 標靶治療 > EGFR TKI",
    "mechanism": "抑制EGFR tyrosine kinase",
    "indications": "特定癌症或腫瘤標靶治療",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "p.93: Penny(Pani-)收到一大堆(a lot, Erlot-)禮物(gift, Geft-)，吸了一大口就吐了(吸吐， cetu-)\np.93: 你姊夫(gefi-)在二樓(erlo-)處理egg(EGFR)，你先洗手(台，Cetu)在上去找他，不然怕你吐 (panitu-)\np.93: 騙你(Pani-)收Gift(Geft-)，你生氣的吸吐(Cetu-)氣 ，捏死(Neci-)你耳朵(Erlot-)",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Mycophenolate mofetil",
    "category": "風濕免疫科 > 免疫抑制 > Antimetabolite",
    "mechanism": "抑制IMP dehydrogenase，抑制de novo GMP合成",
    "indications": "自體免疫疾病、器官移植排斥或發炎疾病",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Loperamide",
    "category": "腸胃科 > 止瀉劑 > 周邊Opioid致效",
    "mechanism": "周邊μ/δ opioid受器致效，抑制腸道ACh釋放與蠕動",
    "indications": "非吸收性抗生素",
    "effects": "活化對應受器，產生受器相關生理效應；PDF重點：agonist，活化 GC-C → 增加 cGMP→活化；regulator）氯通道→促進 Cl⁻、HCO₃⁻、",
    "mnemonic": "p.68: 落魄流氓(loper-)大份吸(diphenxy-)鴉片(opioid R agonist)",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Scopolamine",
    "category": "神經/精神科 > 膽鹼性拮抗劑 > 中樞/動暈Muscarinic阻斷",
    "mechanism": "Muscarinic受器阻斷，抑制前庭訊號",
    "indications": "失憶，輔助麻醉；青光眼；降低胃酸分泌及腸胃蠕動；→治胃潰瘍",
    "effects": "阻斷M受器，減少腺體分泌與平滑肌收縮；可散瞳、心跳上升、支氣管擴張；PDF重點：降低胃酸分泌及腸胃蠕動；減少腸胃蠕動、作為止瀉藥",
    "mnemonic": "p.18: 會暈車的人都是死狗破爛命(Scopolamine)",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Scopolamine",
    "category": "腸胃科 > 止吐 > 抗M1",
    "mechanism": "M1受器阻斷，抑制前庭核",
    "indications": "氣喘/COPD、動暈、尿失禁、帕金森/EPS或散瞳（依藥物）",
    "effects": "阻斷對應受器或通道，降低該路徑效應",
    "mnemonic": "p.18: 會暈車的人都是死狗破爛命(Scopolamine)",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Ribavirin",
    "category": "感染科 > 抗HCV",
    "mechanism": "Guanosine類似物，抑制病毒RNA複製",
    "indications": "病毒感染治療或預防",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）；PDF重點：之機轉為抑制病毒之RNA 複製，需同干擾素並用",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Rituximab",
    "category": "風濕免疫科 > 生物製劑 > Anti-CD20",
    "mechanism": "抗CD20單株抗體，耗竭B細胞",
    "indications": "未在PDF同列明確標示；依分類臨床適應症複習",
    "effects": "調節多巴胺傳導，影響精神症狀、EPS、泌乳或帕金森症狀",
    "mnemonic": "p.90: 你禿頭(Ritu-)是偶發禿(Ofatu-)",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Simvastatin",
    "category": "心臟科 > 降血脂 > Statins",
    "mechanism": "抑制HMG-CoA reductase，增加肝臟LDL receptor",
    "indications": "高脂血症與動脈粥樣硬化風險降低",
    "effects": "降低膽固醇合成、上調LDL受器",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Warfarin",
    "category": "血液腫瘤科 > 抗凝血 > Vitamin K antagonist",
    "mechanism": "抑制VKORC1，使還原型vitamin K下降，降低II/VII/IX/X與protein C/S活化",
    "indications": "血栓預防/治療；長期抗凝",
    "effects": "抑制vitamin K epoxide reductase，降低II/VII/IX/X與protein C/S活化",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Esmolol",
    "category": "心臟科 > 抗心律不整 > Class II",
    "mechanism": "β受器阻斷，降低SA/AV node自律性與傳導",
    "indications": "高血壓、心絞痛、心衰竭、心律不整、青光眼（依藥物）",
    "effects": "阻斷對應受器或通道，降低該路徑效應",
    "mnemonic": "p.14: -olol(A~M開頭的)：AM(白天)的OL比較挑(選擇性)，只要1支banana(B1 antagonist)\np.14: -olol(P開頭的)：晚上(不是下方A~M)的OL就不挑(非選擇性)，banana全都要(B antagonist)",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Esmolol",
    "category": "神經/精神科 > 交感神經阻斷劑 > β1選擇性阻斷",
    "mechanism": "選擇性β1受器阻斷，降低心率/收縮力/renin釋放",
    "indications": "用於高血壓治療",
    "effects": "增加心收縮力/心跳或阻斷後降低心率與耗氧",
    "mnemonic": "p.14: -olol(A~M開頭的)：AM(白天)的OL比較挑(選擇性)，只要1支banana(B1 antagonist)\np.14: -olol(P開頭的)：晚上(不是下方A~M)的OL就不挑(非選擇性)，banana全都要(B antagonist)",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "Tocilizumab",
    "category": "風濕免疫科 > 生物製劑 > Anti-IL-6R",
    "mechanism": "抗IL-6 receptor，抑制IL-6訊號",
    "indications": "治RA、巨細胞動脈炎",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號",
    "mnemonic": "p.91: 你個老六( IL-6)搞偷襲(Toci-)",
    "examLevel": "B",
    "drawWeight": 7
  },
  {
    "name": "6-Mercaptopurine",
    "category": "腸胃科 > IBD > 免疫抑制",
    "mechanism": "Purine拮抗/代謝為thio-IMP，抑制淋巴球增殖",
    "indications": "腸胃蠕動異常、嘔吐、便祕/腹瀉、IBD或IBS（依藥物）",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "6-Mercaptopurine",
    "category": "血液腫瘤科 > 抗癌 > 抗代謝/嘌呤類",
    "mechanism": "經HGPRT形成TIMP，抑制purine合成",
    "indications": "特定癌症或腫瘤標靶治療",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "5-Fluorouracil",
    "category": "血液腫瘤科 > 抗癌 > 抗代謝/嘧啶類",
    "mechanism": "代謝為5-FdUMP抑制thymidylate synthase；5-FUTP可嵌入RNA",
    "indications": "特定癌症或腫瘤標靶治療",
    "effects": "干擾DNA/RNA或細胞分裂，產生細胞毒性；PDF重點：形成三合體，抑制Thymidylate synthetase 的作用，干擾DNA 合",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Diazepam",
    "category": "神經/精神科 > 中樞性肌肉鬆弛劑",
    "mechanism": "GABA_A正向變構調節，增加Cl-通道開啟頻率",
    "indications": "焦慮、癲癇重積症、肌肉痙攣、酒精戒斷或麻醉前用藥",
    "effects": "BZD增強GABA-A開啟頻率，鎮靜、抗焦慮、抗癲癇、肌肉鬆弛",
    "mnemonic": "p.20: D gabaA (大) ； B gabaB (逼)\np.21: 我打走(midazolam)踹走(Triazolam)牛 Temazepam、長Flurazepam) (ox-) ： (2)抗痙攣(Clonazepam) 被術前打鎮定劑的時候因為不想手術，所以我打 (3)中樞性骨骼肌鬆弛劑(Diazepam) 走 (midazolam) 醫生。 (4)急性酒精戒斷治療(Dia-、Oxa-、\np.21: 都是女生的名字： 6. onset速度： 歐普拉(alpra-)、蘿拉(Lora-)、伊斯塔 Triazolam>Diazepam>Chlordiazepoxide> (Esta-)、提瑪(tema-)會俘虜你(fluni-)的 Oxazapam、Lorazepam、Temazapam 心 (106-2)\np.21: tri(三倍快) > di(兩倍快) > 蘿拉她媽在閹牛",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Diazepam",
    "category": "神經/精神科 > 抗癲癇 > GABA_A增強",
    "mechanism": "增強GABA_A介導的Cl-內流",
    "indications": "焦慮、癲癇重積症、肌肉痙攣、酒精戒斷或麻醉前用藥",
    "effects": "BZD增強GABA-A開啟頻率，鎮靜、抗焦慮、抗癲癇、肌肉鬆弛",
    "mnemonic": "p.20: D gabaA (大) ； B gabaB (逼)\np.21: 我打走(midazolam)踹走(Triazolam)牛 Temazepam、長Flurazepam) (ox-) ： (2)抗痙攣(Clonazepam) 被術前打鎮定劑的時候因為不想手術，所以我打 (3)中樞性骨骼肌鬆弛劑(Diazepam) 走 (midazolam) 醫生。 (4)急性酒精戒斷治療(Dia-、Oxa-、\np.21: 都是女生的名字： 6. onset速度： 歐普拉(alpra-)、蘿拉(Lora-)、伊斯塔 Triazolam>Diazepam>Chlordiazepoxide> (Esta-)、提瑪(tema-)會俘虜你(fluni-)的 Oxazapam、Lorazepam、Temazapam 心 (106-2)\np.21: tri(三倍快) > di(兩倍快) > 蘿拉她媽在閹牛",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Diazepam",
    "category": "腸胃科 > 止吐 > BZD",
    "mechanism": "GABA_A正向變構調節，鎮靜並減少預期性嘔吐",
    "indications": "焦慮、癲癇重積症、肌肉痙攣、酒精戒斷或麻醉前用藥",
    "effects": "BZD增強GABA-A開啟頻率，鎮靜、抗焦慮、抗癲癇、肌肉鬆弛",
    "mnemonic": "p.20: D gabaA (大) ； B gabaB (逼)\np.21: 我打走(midazolam)踹走(Triazolam)牛 Temazepam、長Flurazepam) (ox-) ： (2)抗痙攣(Clonazepam) 被術前打鎮定劑的時候因為不想手術，所以我打 (3)中樞性骨骼肌鬆弛劑(Diazepam) 走 (midazolam) 醫生。 (4)急性酒精戒斷治療(Dia-、Oxa-、\np.21: 都是女生的名字： 6. onset速度： 歐普拉(alpra-)、蘿拉(Lora-)、伊斯塔 Triazolam>Diazepam>Chlordiazepoxide> (Esta-)、提瑪(tema-)會俘虜你(fluni-)的 Oxazapam、Lorazepam、Temazapam 心 (106-2)\np.21: tri(三倍快) > di(兩倍快) > 蘿拉她媽在閹牛",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Heparin",
    "category": "血液腫瘤科 > 抗凝血 > Heparin類",
    "mechanism": "活化Antithrombin，抑制IIa與Xa",
    "indications": "急性血栓抗凝；孕婦需抗凝時首選",
    "effects": "活化antithrombin III，抑制IIa/Xa；過量用protamine解毒",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Iodide",
    "category": "內分泌/新陳代謝 > 甲狀腺 > 碘化物",
    "mechanism": "高劑量造成Wolff-Chaikoff效應，抑制甲狀腺激素釋放",
    "indications": "體積，可用於甲狀腺風暴、甲；解毒劑：澱粉可解碘中毒",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號；PDF重點：機轉：干擾碘化抑制T3T4 釋；抑制 T3 & T4",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Lorazepam",
    "category": "神經/精神科 > 抗焦慮/鎮靜安眠 > Benzodiazepines",
    "mechanism": "GABA_A受器正向變構調節；增加Cl-通道開啟頻率",
    "indications": "焦慮、失眠、鎮靜、抗癲癇或麻醉誘導（依藥物）",
    "effects": "增強GABA-A抑制性傳導，鎮靜、抗焦慮、抗癲癇",
    "mnemonic": "p.21: 都是女生的名字： 6. onset速度： 歐普拉(alpra-)、蘿拉(Lora-)、伊斯塔 Triazolam>Diazepam>Chlordiazepoxide> (Esta-)、提瑪(tema-)會俘虜你(fluni-)的 Oxazapam、Lorazepam、Temazapam 心 (106-2)",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Lorazepam",
    "category": "神經/精神科 > 抗癲癇 > GABA_A增強",
    "mechanism": "增強GABA_A介導的Cl-內流",
    "indications": "癲癇發作控制；部分用於神經痛或情緒穩定",
    "effects": "增強GABA-A抑制性傳導，鎮靜、抗焦慮、抗癲癇",
    "mnemonic": "p.21: 都是女生的名字： 6. onset速度： 歐普拉(alpra-)、蘿拉(Lora-)、伊斯塔 Triazolam>Diazepam>Chlordiazepoxide> (Esta-)、提瑪(tema-)會俘虜你(fluni-)的 Oxazapam、Lorazepam、Temazapam 心 (106-2)",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Lorazepam",
    "category": "腸胃科 > 止吐 > BZD",
    "mechanism": "GABA_A正向變構調節，鎮靜並減少預期性嘔吐",
    "indications": "焦慮、失眠、鎮靜、抗癲癇或麻醉誘導（依藥物）",
    "effects": "增強GABA-A抑制性傳導，鎮靜、抗焦慮、抗癲癇",
    "mnemonic": "p.21: 都是女生的名字： 6. onset速度： 歐普拉(alpra-)、蘿拉(Lora-)、伊斯塔 Triazolam>Diazepam>Chlordiazepoxide> (Esta-)、提瑪(tema-)會俘虜你(fluni-)的 Oxazapam、Lorazepam、Temazapam 心 (106-2)",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Amoxicillin",
    "category": "感染科 > 抗生素 > Aminopenicillins",
    "mechanism": "β-lactam；抑制PBP/細胞壁合成",
    "indications": "常見G(+)與部分G(-)感染；H. pylori合併療法",
    "effects": "Aminopenicillin，抑制細胞壁交聯；常與β-lactamase inhibitor併用",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Amoxicillin",
    "category": "腸胃科 > H. pylori用藥",
    "mechanism": "抗H. pylori抗生素；常與PPI/鉍劑併用",
    "indications": "常見G(+)與部分G(-)感染；H. pylori合併療法",
    "effects": "Aminopenicillin，抑制細胞壁交聯；常與β-lactamase inhibitor併用",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Bromocriptine",
    "category": "內分泌/新陳代謝 > 腦下垂體 > Dopamine致效",
    "mechanism": "D2受器致效，抑制prolactin釋放",
    "indications": "未在PDF同列明確標示；依分類臨床適應症複習",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "p.31: 在bromo的快艇(bromocriptine)開得很快，因為怕狗來(pergolide)<註：bromo為一座印",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Bromocriptine",
    "category": "神經/精神科 > 抗帕金森 > DA受器致效",
    "mechanism": "Ergot類DA受器致效，主要D2作用",
    "indications": "用於Parkinson (中樞)",
    "effects": "調節多巴胺傳導，影響精神症狀、EPS、泌乳或帕金森症狀",
    "mnemonic": "p.31: 在bromo的快艇(bromocriptine)開得很快，因為怕狗來(pergolide)<註：bromo為一座印",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Bromocriptine",
    "category": "神經/精神科 > 擬交感神經藥物 > Dopamine受器致效劑",
    "mechanism": "D2受器致效",
    "indications": "用於Parkinson (中樞)",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "p.31: 在bromo的快艇(bromocriptine)開得很快，因為怕狗來(pergolide)<註：bromo為一座印",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Testosterone",
    "category": "內分泌/新陳代謝 > 性激素 > Androgen",
    "mechanism": "Androgen receptor致效",
    "indications": "衍生物，長期類固醇的輔助治療，促進增肌、；緩解子宮內膜異位",
    "effects": "活化對應受器，產生受器相關生理效應；PDF重點：衍生物，長期類固醇的輔助治療，促進增肌、；↓骨質疏鬆",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Danazol",
    "category": "內分泌/新陳代謝 > 性激素 > 類Androgen",
    "mechanism": "抑制中樞與卵巢類固醇生成，造成低estrogen狀態",
    "indications": "緩解子宮內膜異位",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號；PDF重點：作用在中樞與周邊，抑制androgen 生成，致estrogen 不；足，最終抑制卵巢",
    "mnemonic": "p.78: 打哪揍(Danazol)~~治子宮內膜異位（把他揍回原位）",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Alvimopan",
    "category": "腸胃科 > 瀉劑 > 周邊μ拮抗",
    "mechanism": "周邊μ-opioid受器拮抗，改善opioid引起便秘",
    "indications": "腸胃蠕動異常、嘔吐、便祕/腹瀉、IBD或IBS（依藥物）",
    "effects": "阻斷對應受器或通道，降低該路徑效應",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Cimetidine",
    "category": "自泌素/腸胃 > H2阻斷",
    "mechanism": "H2受器阻斷，抑制胃壁細胞酸分泌",
    "indications": "抗雄性素，男性久服會陽萎(109-1)、男性女",
    "effects": "抑制胃酸分泌",
    "mnemonic": "p.65: 躲在梯廳(-tidine)不能呵呵笑(HH笑🡺H2 receptor blocker)\np.65: 西門慶(Cime-)讓你(Rani-) 撫摸(Famo-)，你讓他硬(Nizatidine)；因為西門慶(Cimetidine)很色一直 做，最後會陽痿(SE)；你讓他硬(Nizatidine)用嘴巴(口服)\np.65: 先記前三個：西門町(Cime-)逛街，女生很多(Cime-作用：抗雄性素，造成男性女乳症)，逛街到一半有人拉 住你(Rani-)(拉住你=會讓CYP450下降)，問你要不要當髮模(Famo-)。要當髮模，時間要夠多(藥效長且 強)，且不可以被影響(不影響CYP450)。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Lamivudine",
    "category": "感染科 > 抗HBV > 核苷/核苷酸類似物",
    "mechanism": "Cytosine類似物；抑制HBV DNA polymerase/RT",
    "indications": "懷孕可用",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）；PDF重點：→競爭抑制HIV-1 反轉錄；→卡病毒DNA 阻斷其複製",
    "mnemonic": "p.120: (從外到內喔)：馬拉拉(Mara-) 愛浮潛(Efu-)，而且她博學多聞記很多(Zido-)拉密定理 (Lami-)，最後還暴動似的(riot, Ralte-)用力的K自己的陰蒂(Indi-) 🡺 一句話：馬拉愛浮記多 拉特陰蒂",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Lamivudine",
    "category": "感染科 > 抗HIV > NRTI",
    "mechanism": "核苷類RT抑制；經磷酸化後造成DNA鏈終止",
    "indications": "懷孕可用",
    "effects": "干擾DNA/RNA或細胞分裂，產生細胞毒性；PDF重點：→競爭抑制HIV-1 反轉錄；→卡病毒DNA 阻斷其複製",
    "mnemonic": "p.120: (從外到內喔)：馬拉拉(Mara-) 愛浮潛(Efu-)，而且她博學多聞記很多(Zido-)拉密定理 (Lami-)，最後還暴動似的(riot, Ralte-)用力的K自己的陰蒂(Indi-) 🡺 一句話：馬拉愛浮記多 拉特陰蒂",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Bimatoprost",
    "category": "神經/精神科 > 青光眼用藥 > PGF2α類似物",
    "mechanism": "PGF2α類似物，增加房水葡萄膜鞏膜流出",
    "indications": "未在PDF同列明確標示；依分類臨床適應症複習",
    "effects": "依其機轉產生對應藥理作用；請搭配適應症與考點複習",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Bimatoprost",
    "category": "自泌素 > Eicosanoid > PGF2α類似物/青光眼",
    "mechanism": "PGF2α類似物，增加房水流出、降眼壓",
    "indications": "發炎疼痛、氣喘、肺高壓或胃黏膜保護（依藥物）",
    "effects": "依其機轉產生對應藥理作用；請搭配適應症與考點複習",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Timolol",
    "category": "神經/精神科 > 交感神經阻斷劑 > β1/β2阻斷",
    "mechanism": "非選擇性β受器阻斷",
    "indications": "常用於青光眼首選；慢性心絞痛；預防偏頭痛",
    "effects": "支氣管平滑肌放鬆；可有心悸、低血鉀、高血糖",
    "mnemonic": "p.14: -olol(A~M開頭的)：AM(白天)的OL比較挑(選擇性)，只要1支banana(B1 antagonist)\np.14: -olol(P開頭的)：晚上(不是下方A~M)的OL就不挑(非選擇性)，banana全都要(B antagonist)",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Lactulose",
    "category": "腸胃科 > 瀉劑 > 滲透壓瀉劑",
    "mechanism": "不被吸收或形成高滲，將水分留在腸腔",
    "indications": "瀉劑；將NH3轉變為水溶性氨有利排泄，改善；效快(水瀉)→；血鎂、水瀉",
    "effects": "依其機轉產生對應藥理作用；請搭配適應症與考點複習",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Acyclovir",
    "category": "感染科 > 抗病毒 > HSV/VZV核苷類",
    "mechanism": "經病毒thymidine kinase活化，抑制viral DNA polymerase並造成鏈終止",
    "indications": "HSV-1/HSV-2/VZV；IV用於疱疹腦炎",
    "effects": "經病毒thymidine kinase活化後抑制病毒DNA polymerase並造成鏈終止",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Fluphenazine",
    "category": "神經/精神科 > 抗精神病 > 傳統/典型",
    "mechanism": "D2受器拮抗",
    "indications": "抗α1：姿態性低血壓、心搏過速、嗜睡；止吐：Prochlorperazine (Novamin)；治Tourette’s syndrome、；效強(抗D2-R 強)→EPS、Prolactin 症狀",
    "effects": "調節多巴胺傳導，影響精神症狀、EPS、泌乳或帕金森症狀",
    "mnemonic": "p.28: 傳統分兩群： 第一群：姑婆媽(Chlorpromazine)是雷達 (Thioridazine)，專門製造謠言，所以副作用很多(M1/H1/α1 blocker) 第二群：哈囉陪你度 (Haloperidol) 過流感飛那時(Fluphenazine)，副作用是EPS。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Leuprolide",
    "category": "內分泌/新陳代謝 > 性激素 > GnRH agonist",
    "mechanism": "持續刺激GnRH受器使LH/FSH下降",
    "indications": "治前列腺癌；治療性早熟(107-1)；緩解子宮內膜異位",
    "effects": "活化對應受器，產生受器相關生理效應；PDF重點：持續刺激→LH、FSH↓",
    "mnemonic": "p.78: 顧搓(台語)(Goser-)脫皮(台)(Leupro-)：要促進GnRH，所以一直 GnRH走GPCR，(112-1) 搓、顧著搓、搓到脫皮還在搓，至於搓什麼我就不知道了\np.80: 阿爸(Aba-)，用在男 Leuprolide無效時使用 治中樞性性早熟 性 人工受孕取卵前控制",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Vinblastine",
    "category": "血液腫瘤科 > 抗癌 > Vinca alkaloids",
    "mechanism": "抑制微小管聚合，阻斷M期紡錘絲形成",
    "indications": "不可周邊靜脈施打，若外滲皮膚壞死(熱敷治)",
    "effects": "干擾DNA/RNA或細胞分裂，產生細胞毒性；PDF重點：抑制微小管聚合；經病變(113-1)，但骨髓抑制較",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Chlordiazepoxide",
    "category": "神經/精神科 > 抗焦慮/鎮靜安眠 > Benzodiazepines",
    "mechanism": "GABA_A受器正向變構調節；增加Cl-通道開啟頻率",
    "indications": "焦慮、失眠、鎮靜、抗癲癇或麻醉誘導（依藥物）",
    "effects": "增強GABA-A抑制性傳導，鎮靜、抗焦慮、抗癲癇",
    "mnemonic": "p.21: 踹走(Triazolam)牛(ox-)的時候會被牛反彈 Lora-、Chlordiazepoxide) (SE：反彈性失眠) 4. 解毒劑：Flumazenil (麻醉後輔助清醒-\np.21: 都是女生的名字： 6. onset速度： 歐普拉(alpra-)、蘿拉(Lora-)、伊斯塔 Triazolam>Diazepam>Chlordiazepoxide> (Esta-)、提瑪(tema-)會俘虜你(fluni-)的 Oxazapam、Lorazepam、Temazapam 心 (106-2)",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Penicillamine",
    "category": "毒物學 > 螯合劑",
    "mechanism": "螯合銅，治Wilson disease",
    "indications": "中毒或重金屬暴露之解毒/螯合治療",
    "effects": "結合毒物/重金屬或繞過毒性路徑以促進排除",
    "mnemonic": "p.125: 相同/銅(penicillamine,D-",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Fluorouracil",
    "category": "血液腫瘤科 > 抗癌 > 抗代謝/嘧啶類",
    "mechanism": "代謝為5-FdUMP抑制thymidylate synthase；5-FUTP可嵌入RNA",
    "indications": "特定癌症或腫瘤標靶治療",
    "effects": "干擾DNA/RNA或細胞分裂，產生細胞毒性；PDF重點：形成三合體，抑制Thymidylate synthetase 的作用，干擾DNA 合",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Indomethacin",
    "category": "風濕免疫科 > NSAID > Acetic acid類",
    "mechanism": "可逆抑制COX-1/2，降低PG生成",
    "indications": "抗發炎強(治痛風佳)(抑制；Phospholipase A/C，降低嗜中性；治(關閉)PDA (107-1)",
    "effects": "降低RAAS作用，血管擴張、降醛固酮並保護心腎；PDF重點：抗發炎強(治痛風佳)(抑制；Phospholipase A/C，降低嗜中性",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Oxybutynin",
    "category": "泌尿/膽鹼拮抗 > 膀胱過動症",
    "mechanism": "Muscarinic受器阻斷，降低膀胱收縮",
    "indications": "治尿失禁(109-1)",
    "effects": "阻斷M受器，減少腺體分泌與平滑肌收縮；可散瞳、心跳上升、支氣管擴張",
    "mnemonic": "p.18: O~，膝部踢你(oxybutynin)，讓你尿不出來!\np.18: O=尿道，尿不停膩(-butynin) 🡺治尿失禁\np.18: 尿失禁就是膀胱阿死都不聽你(Oxybutynin)",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Ketamine",
    "category": "神經/精神科 > 成癮物質/藥物",
    "mechanism": "NMDA受器非競爭性拮抗",
    "indications": "膀胱纖維化",
    "effects": "阻斷對應受器或通道，降低該路徑效應",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Meclizine",
    "category": "腸胃科 > 止吐 > H1阻斷",
    "mechanism": "H1受器阻斷並有抗M作用，抑制前庭相關嘔吐",
    "indications": "過敏/蕁麻疹、動暈或胃酸相關疾病（依受器）",
    "effects": "阻斷對應受器或通道，降低該路徑效應；PDF重點：H1 阻斷；治動暈首選(抑制中樞前庭核)",
    "mnemonic": "p.58: 破麻傷心(Promethazine)、沒開心(Meclizine)就讓大家去大分海、大門海(兩個海洋Diphenhy-, Dimenhy-)多吸一點拉麵(Doxy-lamine)",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Meclizine",
    "category": "自泌素 > Histamine > 第一代H1阻斷",
    "mechanism": "H1受器反向致效/拮抗，較易過BBB且有抗M作用",
    "indications": "(2)可抗帕金森氏",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "p.58: 破麻傷心(Promethazine)、沒開心(Meclizine)就讓大家去大分海、大門海(兩個海洋Diphenhy-, Dimenhy-)多吸一點拉麵(Doxy-lamine)",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Ketamine",
    "category": "麻醉科 > 全身麻醉 > IV麻醉誘導",
    "mechanism": "NMDA受器非競爭性拮抗，解離性麻醉",
    "indications": "解離型麻醉(看起來清醒但無痛無意識)；大出血時的手術麻醉；可用於氣喘or 低血壓病人",
    "effects": "阻斷對應受器或通道，降低該路徑效應；PDF重點：抑制NMDA-R(108-1)；交感活性：BP↑、HR↑、IOP↑、",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Varenicline",
    "category": "神經/精神科 > 成癮/戒菸",
    "mechanism": "α4β2 nicotinic受器部分致效",
    "indications": "適應症：抗憂鬱、戒菸 (cf. =Nicotinic partial",
    "effects": "支氣管平滑肌放鬆；可有心悸、低血鉀、高血糖",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Pyrimethamine",
    "category": "感染科 > 抗生素/抗原蟲 > DHFR抑制",
    "mechanism": "抑制寄生蟲DHFR，常與sulfadiazine/sulfadoxine併用",
    "indications": "細菌感染治療（菌種依藥物光譜）",
    "effects": "依蟲種破壞寄生蟲神經肌肉/微管或代謝，使蟲體麻痺或死亡",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Ganciclovir",
    "category": "感染科 > 抗病毒 > CMV核苷類",
    "mechanism": "經病毒kinase活化後抑制viral DNA polymerase",
    "indications": "病毒感染治療或預防",
    "effects": "干擾DNA/RNA或細胞分裂，產生細胞毒性；PDF重點：骨髓抑制",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Betaxolol",
    "category": "神經/精神科 > 交感神經阻斷劑 > β1選擇性阻斷",
    "mechanism": "選擇性β1受器阻斷，降低心率/收縮力/renin釋放",
    "indications": "治青光眼",
    "effects": "增加心收縮力/心跳或阻斷後降低心率與耗氧",
    "mnemonic": "p.14: -olol(A~M開頭的)：AM(白天)的OL比較挑(選擇性)，只要1支banana(B1 antagonist)\np.14: -olol(P開頭的)：晚上(不是下方A~M)的OL就不挑(非選擇性)，banana全都要(B antagonist)",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Thiopental",
    "category": "神經/精神科 > 抗焦慮/鎮靜安眠 > Barbiturates",
    "mechanism": "GABA_A受器正向變構調節；延長Cl-通道開啟時間，高劑量可直接開啟",
    "indications": "加強GABA 作用於GABA A-R(延長Cl-通道；作為麻醉誘導；適應症：鎮靜、抗焦慮、抗癲癇；治療癲癇發作",
    "effects": "增強GABA-A抑制性傳導，鎮靜、抗焦慮、抗癲癇",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Fosphenytoin",
    "category": "神經/精神科 > 抗癲癇 > Na+通道阻斷",
    "mechanism": "阻斷電壓依賴性Na+通道，穩定失活態",
    "indications": "治療失神性發作(107-1)",
    "effects": "抑制電位依賴性鈉通道，降低神經或心肌興奮性；PDF重點：阻斷T-type Ca 通道",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Thiopental",
    "category": "麻醉科 > 全身麻醉 > IV麻醉誘導",
    "mechanism": "Barbiturate；增強GABA_A並延長Cl-通道開啟",
    "indications": "焦慮、失眠、鎮靜、抗癲癇或麻醉誘導（依藥物）",
    "effects": "增強GABA-A抑制性傳導，鎮靜、抗焦慮、抗癲癇；PDF重點：(BP、CO↓，反射性；↑HR)",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Glimepiride",
    "category": "內分泌/新陳代謝 > 糖尿病 > Sulfonylureas",
    "mechanism": "阻斷胰臟β細胞KATP通道，使Ca2+內流並促insulin分泌",
    "indications": "糖尿病血糖控制",
    "effects": "調節鈣離子通道/骨代謝/血管平滑肌收縮；PDF重點：機轉：阻斷胰臟β 細胞上的ATP-",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Cefepime",
    "category": "感染科 > 抗生素 > Cephalosporin第四代",
    "mechanism": "β-lactam；抑制PBP/細胞壁合成，廣效",
    "indications": "細菌感染治療（菌種依藥物光譜）",
    "effects": "抑制細菌細胞壁、蛋白質、核酸或葉酸代謝",
    "mnemonic": "p.106: 是(4)誰放屁(cefepime)!屁臭到我的腦裡(進BBB，有中樞作用)",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Cyclosporine",
    "category": "風濕免疫科 > 免疫抑制 > Calcineurin抑制",
    "mechanism": "與cyclophilin結合後抑制calcineurin，降低NFAT/IL-2轉錄",
    "indications": "器官移植排斥預防/治療、自體免疫疾病",
    "effects": "與cyclophilin結合抑制calcineurin，↓IL-2與T細胞活化；腎毒性/高血壓",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Hydrocortisone",
    "category": "內分泌/新陳代謝 > 腎上腺皮質醇 > 短效Glucocorticoid",
    "mechanism": "活化glucocorticoid receptor，抑制發炎與免疫反應",
    "indications": "抑制T4→T3、防休克；甲狀腺激素合成的原料，用以預防和治療地方性甲狀；腺腫。抑制甲狀腺激素釋放，治療甲狀腺亢進。；用於甲狀腺功能亢進術前準備，使甲狀腺變小變硬",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號；PDF重點：抑制T4→T3、防休克；立即給予PTU(抑制周邊T4→T3)",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Dexamethasone",
    "category": "內分泌/新陳代謝 > 腎上腺皮質醇 > 長效Glucocorticoid",
    "mechanism": "活化glucocorticoid receptor，長效抗炎/免疫抑制",
    "indications": "治腦腫瘤水腫，診斷Cushing",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號",
    "mnemonic": "p.74: Beta(Beta-)，待殺(Dexa-)，沒殺爽(-methasone) 註釋：玩Beta版封測的線上遊戲，還在期待殺人，結果時間到了不給玩，根本沒殺爽啊可惡",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Mipomersen",
    "category": "心臟科 > 降血脂 > ApoB-100 antisense",
    "mechanism": "抑制apoB-100 mRNA，降低VLDL/LDL",
    "indications": "只用來降家族性高膽固醇血症的LDL",
    "effects": "干擾DNA/RNA或細胞分裂，產生細胞毒性；PDF重點：只用來降家族性高膽固醇血症的LDL",
    "mnemonic": "p.57: 米潑門神(Mipomersen)🡺逼逼(BB)~犯規扣100分(抑制 apoB-100)",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Ezetimibe",
    "category": "心臟科 > 降血脂 > Cholesterol吸收抑制",
    "mechanism": "抑制小腸NPC1L1，降低膽固醇吸收",
    "indications": "LDL↓、HDL 微量上升(考古不能升HDL)",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號",
    "mnemonic": "p.57: 一直停買(Ezetimibe)🡺不咬cholesterol\np.57: 抑制(Eze-)載體麥(-timibe)，所以知道是抑制腸道載體的降血脂 藥\np.57: 抑制運送蛋白 就像送貨員，讓你可以在家享受easy time(Ezetim-)",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Avibactam",
    "category": "感染科 > 抗生素 > β-lactamase inhibitor",
    "mechanism": "抑制β-lactamase，保護β-lactam抗生素",
    "indications": "細菌感染治療（菌種依藥物光譜）",
    "effects": "抑制細菌細胞壁、蛋白質、核酸或葉酸代謝",
    "mnemonic": "p.107: 真假(Rele-)？瑋柏(Vabor-) 拍AV(Avi-)不戴套(非環)",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Deferasirox",
    "category": "毒物學 > 螯合劑",
    "mechanism": "螯合鐵，促進排泄",
    "indications": "(口服)(降低肝臟",
    "effects": "結合毒物/重金屬或繞過毒性路徑以促進排除；PDF重點：(口服)(降低肝臟",
    "mnemonic": "p.125: 不一樣的鐵(defer)打針會喊",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Galantamine",
    "category": "神經/精神科 > 抗阿茲海默 > AChE抑制",
    "mechanism": "中樞AChE抑制，增加腦中ACh",
    "indications": "治療中重度AD",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號",
    "mnemonic": "p.34: 記者在瑞芳遇到明星，拼命遞麥(瑞芳死遞麥🡺rivastigmine)，Donald(這個明星)就很生氣潑汽油(Done潑汽 油🡺Donepezil)，可憐他們~(galantamine)\np.34: 東尼(Done-)跟蓋倫(Galan-)看到廣告(AD)跑去理髮(Riva)得到迷妹(Mema-)",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Dexamethasone",
    "category": "腸胃科 > 止吐 > 類固醇",
    "mechanism": "活化glucocorticoid receptor，與5-HT3拮抗劑合併止吐",
    "indications": "偏頭痛、止吐、腸胃蠕動或精神科適應症（依受器）",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "p.74: Beta(Beta-)，待殺(Dexa-)，沒殺爽(-methasone) 註釋：玩Beta版封測的線上遊戲，還在期待殺人，結果時間到了不給玩，根本沒殺爽啊可惡",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Humate-P",
    "category": "血液腫瘤科 > 凝血因子/vWD",
    "mechanism": "補充vWF ± factor VIII",
    "indications": "特定癌症或腫瘤標靶治療",
    "effects": "依其機轉產生對應藥理作用；請搭配適應症與考點複習",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Deferasirox",
    "category": "血液腫瘤科 > 鐵螯合",
    "mechanism": "螯合游離鐵，促進排泄",
    "indications": "高血壓、血栓併發症",
    "effects": "結合毒物/重金屬或繞過毒性路徑以促進排除",
    "mnemonic": "p.125: 不一樣的鐵(defer)打針會喊",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Bevacizumab",
    "category": "風濕免疫/腫瘤 > 標靶治療 > Anti-VEGF",
    "mechanism": "抗VEGF-A單株抗體，抑制血管新生",
    "indications": "肺癌(NSCLC)、大腸癌、腎細胞癌；血管內皮傷害(高血壓、；腦癌(Glioblastoma multiform)；造成腸穿孔。因抗",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號；PDF重點：造成腸穿孔。因抗",
    "mnemonic": "p.93: 拉姆(Ramu-)從被窩(Beva-)起來，看到是晴天(suni-)，爽啦(sora-)\np.93: 你老母(Ramu-)咧，真的很白目(台, Beva-)耶，知道我要考試，還跟我說：”爽啦(Sora-)是 晴天(suni-)”，還跟我比YA(V, VGFR)，Sunny(Suni-)，備馬(Beva-) 拉母(Ramu-)牛去曬 太陽，爽啦(Sora-)",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Phentermine",
    "category": "內分泌/新陳代謝 > 減肥藥",
    "mechanism": "促進NE釋放，抑制食慾",
    "indications": "肥胖症輔助治療",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）；PDF重點：促NE 釋放+增加GABA 作用；延緩胃排空抑制食慾，國內合法",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Vitamin K",
    "category": "毒物學 > 解毒劑",
    "mechanism": "恢復vitamin K依賴凝血因子γ-carboxylation",
    "indications": "高血壓；部分用於心衰竭、腎保護或心絞痛",
    "effects": "降低RAAS作用，血管擴張、降醛固酮並保護心腎",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Vitamin K",
    "category": "血液腫瘤科 > 抗出血/促凝血",
    "mechanism": "補充維生素K，恢復γ-carboxylation凝血因子活化",
    "indications": "高血壓；部分用於心衰竭、腎保護或心絞痛",
    "effects": "降低RAAS作用，血管擴張、降醛固酮並保護心腎",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Telavancin",
    "category": "感染科 > 抗生素 > Lipoglycopeptide",
    "mechanism": "結合D-Ala-D-Ala並抑制細胞壁合成；部分亦破壞膜功能",
    "indications": "細菌感染治療（菌種依藥物光譜）",
    "effects": "抑制細菌細胞壁、蛋白質、核酸或葉酸代謝",
    "mnemonic": "p.107: • 用萬(Vanco-)劍(Genta-)彈 4. Dalbavancin、Telavancin可用於Vancomycin有抗藥性之\np.107: 鐵口騙你(Teicoplanin)，舔那(Tela-)痘疤(Dalba-)",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Ethambutol",
    "category": "感染科 > 抗結核 > 第一線",
    "mechanism": "抑制arabinosyl transferase，阻斷arabinogalactan合成",
    "indications": "結核病或非典型分枝桿菌感染",
    "effects": "阻斷對應受器或通道，降低該路徑效應",
    "mnemonic": "p.114: 愛瘦奶啊記得(Isoniazid)，瑞凡平(Rifampin)，衣衫不透(ethambutol)，評論今哪買 (pyrazimnamide)?",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Succimer",
    "category": "毒物學 > 螯合劑",
    "mechanism": "水溶性DMSA，螯合鉛/汞/砷",
    "indications": "中毒或重金屬暴露之解毒/螯合治療",
    "effects": "結合毒物/重金屬或繞過毒性路徑以促進排除",
    "mnemonic": "p.125: 我先生(砷)夠(汞)錢(鉛)買\np.125: 牽(鉛)著ET",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Gabapentin",
    "category": "神經/精神科 > 抗癲癇 > Ca2+通道α2δ配體",
    "mechanism": "結合電壓依賴性Ca2+通道α2δ次單元，降低興奮性傳遞物釋放",
    "indications": "三叉神經痛新藥(亦治帶狀皰疹疼痛、糖尿病神經",
    "effects": "降低中樞交感輸出或增加NE釋放（依致效/拮抗）；PDF重點：α 單元，減少glutamate 釋放；transaminase↓、GABA 回",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Epinephrine",
    "category": "神經/精神科 > 擬交感神經藥物 > 直接型",
    "mechanism": "非選擇性腎上腺素受器致效；β1=β2>α1=α2",
    "indications": "過敏性休克首選；心跳停止急救；延長局部麻醉；青光眼/出血等依情境",
    "effects": "非選擇性交感致效：β1增強心跳/收縮、β2支氣管擴張、α1血管收縮；可升血糖與乳酸",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Metyrapone",
    "category": "內分泌/新陳代謝 > 腎上腺類固醇合成抑制",
    "mechanism": "抑制11β-hydroxylase，降低cortisol/aldosterone合成",
    "indications": "發炎/免疫疾病、腎上腺功能異常或替代治療",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "p.74: 在美堤河濱公園打炮碰碰碰(Metyrapone)，可降低Aldosterone,cortisol，但androgen 上升(性慾增強)",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Pindolol",
    "category": "心臟科 > 抗心律不整 > Class II",
    "mechanism": "β受器阻斷，降低SA/AV node自律性與傳導",
    "indications": "高血壓、心絞痛、心衰竭、心律不整、青光眼（依藥物）",
    "effects": "阻斷對應受器或通道，降低該路徑效應",
    "mnemonic": "p.14: -olol(A~M開頭的)：AM(白天)的OL比較挑(選擇性)，只要1支banana(B1 antagonist)\np.14: -olol(P開頭的)：晚上(不是下方A~M)的OL就不挑(非選擇性)，banana全都要(B antagonist)\np.14: 一個賽車比賽(carteolol)，在地上丟乒乓球(pindolol & penbutolol)，最後得了第一 (ace=1)acebutolol)。\np.14: 王牌(ace-)乒乓(pin-, pen-)車(car-)",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Oseltamivir",
    "category": "感染科 > 抗流感 > Neuraminidase inhibitor",
    "mechanism": "抑制neuraminidase，阻止病毒釋出",
    "indications": "未在PDF同列明確標示；依分類臨床適應症複習",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）；PDF重點：神經胺酸酶抑制劑；抑制新病毒自宿主細胞中釋放",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Piperacillin",
    "category": "感染科 > 抗生素 > Antipseudomonal penicillins",
    "mechanism": "β-lactam；抑制PBP/細胞壁合成，具抗Pseudomonas活性",
    "indications": "細菌感染治療（菌種依藥物光譜）",
    "effects": "抑制細菌細胞壁、蛋白質、核酸或葉酸代謝",
    "mnemonic": "p.105: • 阿祖(台Azlo-)兇(台Pipe-)綠膿桿菌沒有錯(Mezlo-)\np.105: • 阿祖(台Azlo-)用水管(Pipe-)戳，梅子落(Mezlo-)",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Unithiol",
    "category": "毒物學 > 螯合劑",
    "mechanism": "DMPS，螯合汞/砷等重金屬",
    "indications": "中毒或重金屬暴露之解毒/螯合治療",
    "effects": "結合毒物/重金屬或繞過毒性路徑以促進排除",
    "mnemonic": "p.125: 特殊的厲害(unique又多用途)\np.125: 他(鉈)是普魯士男很色(銫)",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Mirtazapine",
    "category": "神經/精神科 > 交感神經阻斷劑 > α2阻斷/抗憂鬱",
    "mechanism": "阻斷α2受器並阻斷5-HT2/5-HT3與H1受器，增加NE與5-HT傳遞",
    "indications": "適應症：抗憂鬱、鎮靜",
    "effects": "降低中樞交感輸出或增加NE釋放（依致效/拮抗）",
    "mnemonic": "p.13: 我要買它產品(Mirtazapine)，我要買NASA(此為NaSSA類的抗憂鬱用藥)的產品，拒買其他AA牌的產品\np.26: 我要買它產品(Mirtazapine)，我要買NASA(此為NaSSA類的抗憂鬱用藥)的產品，拒買其他AA牌的產品(a2 antagonist)",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Pindolol",
    "category": "神經/精神科 > 交感神經阻斷劑 > β1/β2阻斷",
    "mechanism": "非選擇性β受器阻斷",
    "indications": "常用於青光眼首選；慢性心絞痛；預防偏頭痛",
    "effects": "支氣管平滑肌放鬆；可有心悸、低血鉀、高血糖",
    "mnemonic": "p.14: -olol(A~M開頭的)：AM(白天)的OL比較挑(選擇性)，只要1支banana(B1 antagonist)\np.14: -olol(P開頭的)：晚上(不是下方A~M)的OL就不挑(非選擇性)，banana全都要(B antagonist)\np.14: 一個賽車比賽(carteolol)，在地上丟乒乓球(pindolol & penbutolol)，最後得了第一 (ace=1)acebutolol)。\np.14: 王牌(ace-)乒乓(pin-, pen-)車(car-)",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Mirtazapine",
    "category": "神經/精神科 > 抗憂鬱 > NaSSA",
    "mechanism": "α2受器拮抗並阻斷5-HT2/5-HT3，增加NE與5-HT傳遞",
    "indications": "適應症：抗憂鬱、鎮靜",
    "effects": "降低中樞交感輸出或增加NE釋放（依致效/拮抗）",
    "mnemonic": "p.13: 我要買它產品(Mirtazapine)，我要買NASA(此為NaSSA類的抗憂鬱用藥)的產品，拒買其他AA牌的產品\np.26: 我要買它產品(Mirtazapine)，我要買NASA(此為NaSSA類的抗憂鬱用藥)的產品，拒買其他AA牌的產品(a2 antagonist)",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Flurazepam",
    "category": "神經/精神科 > 抗焦慮/鎮靜安眠 > Benzodiazepines",
    "mechanism": "GABA_A受器正向變構調節；增加Cl-通道開啟頻率",
    "indications": "最長效、戒斷最不明顯",
    "effects": "增強GABA-A抑制性傳導，鎮靜、抗焦慮、抗癲癇",
    "mnemonic": "p.21: 我打走(midazolam)踹走(Triazolam)牛 Temazepam、長Flurazepam) (ox-) ： (2)抗痙攣(Clonazepam) 被術前打鎮定劑的時候因為不想手術，所以我打 (3)中樞性骨骼肌鬆弛劑(Diazepam) 走 (midazolam) 醫生。 (4)急性酒精戒斷治療(Dia-、Oxa-、",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Tiagabine",
    "category": "神經/精神科 > 抗癲癇 > GABA再回收抑制",
    "mechanism": "抑制GABA transporter，減少GABA再回收",
    "indications": "癲癇發作控制；部分用於神經痛或情緒穩定",
    "effects": "增強GABA-A抑制性傳導，鎮靜、抗焦慮、抗癲癇；PDF重點：GABA 回收↓",
    "mnemonic": "p.35: Tia(拆 台語)gaba 🡺拆掉gaba就不能回收",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Oxcarbazepine",
    "category": "神經/精神科 > 抗癲癇 > Na+通道阻斷",
    "mechanism": "阻斷電壓依賴性Na+通道，穩定失活態",
    "indications": "可治躁鬱的抗癲癇藥：Carbamazepine、；會加重Dravet syndrome 的癲癇",
    "effects": "抑制電位依賴性鈉通道，降低神經或心肌興奮性",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Clozapine",
    "category": "神經/精神科 > 抗精神病 > 非典型",
    "mechanism": "主要阻斷D2與5-HT2A受器",
    "indications": "抗5-HT 2A-R、；保留給嚴重精神分裂且傳統治療；口水↑、體重↑、癲癇",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）；PDF重點：口水↑、體重↑、癲癇；鎮靜極強(夜尿)",
    "mnemonic": "p.29: A pine(一個松樹樹屋)的故事： 他決定要關閉(cloz-)並離開(quit🡺 quet-)這一個松樹屋(-apine)，臨走前還揍它(把松樹打到有黑輪 (台)(olan-))。另外，pine的葉子尖，會戳破WBC(Clozapine會造成顆粒性白血球缺乏)\np.29: SE：Cloz-像cloze，有很多空格，所以造成顆粒性白血球缺乏；Olan-像黑輪(台語)，吃很多會胖，所以會造 成體重增加 / 黑輪→熊貓→像熊貓一樣胖(體重上升)",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Pyridostigmine",
    "category": "神經/精神科 > 膽鹼性致效劑 > 可逆AChE抑制",
    "mechanism": "可逆性抑制AChE，增加神經肌肉接合處ACh",
    "indications": "長效治MG、預防有機磷中毒；短效治MG(診斷)；治MG、可口服",
    "effects": "活化對應受器，產生受器相關生理效應；PDF重點：明星一周風靡(edro-)，開記者會，記者一直死遞Mic(-stigmine)，抑制粉絲瓦解(Achase",
    "mnemonic": "p.16: 明星一周風靡(edro-)，開記者會，記者一直死遞Mic(-stigmine)，抑制粉絲瓦解(Achase inh.)\np.16: 安卓手機(android phone, Edrophonium)一直黏住我(stick me, -stigmine)，使得了MG的 我都還一直用\np.16: 回收(Physo-)很油(脂溶)黏著我(-stig-mine)，油漬還沾到了手機，需要換新的(Neo-)，但 iPhone一整排你都(Py-rido-)不要，竟然挑Android的手機(Edro-phonium)",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Carboprost",
    "category": "自泌素 > Eicosanoid > PGF2α類似物",
    "mechanism": "PGF2α類似物，促進子宮收縮",
    "indications": "抗凝血：PGI2(COX-2 生成)；降低胃酸分泌、促進蠕動；血管舒張，血壓下降；血管舒張，血壓遽降",
    "effects": "促進神經傳遞物質或內分泌/代謝反應；PDF重點：米菲(mife)晚餐(dino)喝了味噌(miso)後被車撞到(carbo)就流產了→子宮收縮for 墮胎；支氣管擴張：PGI2、PGE2",
    "mnemonic": "p.60: 咖波(Carbo-)的眼睛裡面有水。見右圖。\np.61: • 米菲(mife)晚餐(dino)喝了味噌(miso)後被車撞到(carbo)就流產了🡺子宮收縮for墮胎",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Capecitabine",
    "category": "血液腫瘤科 > 抗癌 > 抗代謝/嘧啶類前驅物",
    "mechanism": "口服前驅物，於肝/腫瘤代謝為5-FU",
    "indications": "特定癌症或腫瘤標靶治療",
    "effects": "依其機轉產生對應藥理作用；請搭配適應症與考點複習；PDF重點：似Cytosine，抑制DNA polymerase",
    "mnemonic": "p.100: 我付(5-FU)卡比(Cape-)錢，再塞他(Cytar-)寶石(Gem-)，希望他保守秘(嘧啶)密。\np.100: 卡比(Cape-)到了腫瘤變身成5-FU(代謝成5-FU)",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Folic acid",
    "category": "血液腫瘤科 > 抗貧血 > 葉酸",
    "mechanism": "補充葉酸，促進核苷酸合成與紅血球生成",
    "indications": "高血壓、血栓併發症",
    "effects": "促進神經傳遞物質或內分泌/代謝反應",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Anakinra",
    "category": "風濕免疫科 > 痛風 > IL-1抑制",
    "mechanism": "IL-1受器拮抗",
    "indications": "治RA",
    "effects": "阻斷對應受器或通道，降低該路徑效應；PDF重點：Anti-IL-1 Receptor，阻斷NF-κB pathway",
    "mnemonic": "p.86: 蘇菲(sulfin-)開benz(benzbro-)走進一家利息很pro(高)的bank(probenecid)，尿尿(-urinol) Anakinra 原本用於RA，抑制IL 1α and IL 1β的活性\np.89: 作為一個1 (IL-1)，看到anal (ana-)就硬了(-inra)",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Etomidate",
    "category": "麻醉科 > 全身麻醉 > IV麻醉誘導",
    "mechanism": "GABA_A受器正向變構調節；抑制腎上腺11β-hydroxylase",
    "indications": "只用於心臟疾病患者",
    "effects": "增強GABA-A抑制性傳導，鎮靜、抗焦慮、抗癲癇；PDF重點：不抑制心臟及呼吸功能，具有安眠效果,但無止；抑制Epi",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Mestranol",
    "category": "內分泌/新陳代謝 > 性激素 > Estrogen",
    "mechanism": "Estrogen receptor致效",
    "indications": "避孕、荷爾蒙替代、癌症內分泌治療或生殖相關適應症",
    "effects": "活化對應受器，產生受器相關生理效應",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Rosiglitazone",
    "category": "內分泌/新陳代謝 > 糖尿病 > TZD",
    "mechanism": "活化PPARγ，增加insulin sensitivity與GLUT4作用",
    "indications": "糖尿病血糖控制",
    "effects": "降低血糖或改善胰島素/腸泌素/腎糖排出路徑；PDF重點：不會低血糖",
    "mnemonic": "p.75: Papa(活化PPARγ)把蛤蜊太熟(-glitazone)沒人要吃，就過剩了(英，glut，增加GLUT-4 R)",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Bazedoxifene",
    "category": "內分泌/新陳代謝 > 骨鬆 > SERM",
    "mechanism": "選擇性estrogen receptor調節；骨骼致效、乳房/子宮拮抗傾向",
    "indications": "可治乳癌；穩定血脂、穩定骨骼、促進血栓",
    "effects": "活化對應受器，產生受器相關生理效應",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Strontium ranelate",
    "category": "內分泌/新陳代謝 > 骨鬆 > 抑破骨促骨",
    "mechanism": "抑制骨吸收並促進骨形成",
    "indications": "預防停經後婦女的骨質疏鬆；單株抗體",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Dofetilide",
    "category": "心臟科 > 抗心律不整 > Class III",
    "mechanism": "阻斷K+通道，延長phase 3與ERP",
    "indications": "心律不整治療",
    "effects": "阻斷對應受器或通道，降低該路徑效應",
    "mnemonic": "p.55: 假的(K blocker) 阿喵(Amio-) 其實是Brety姐(Bretylium)，她一步踢來(Ibutilide)，都飛 踢(Dofeti-)， 求你(Drone-) ㄙㄡˊ她(Sota-，撫摸)的Vagina(Verna-) <取自高醫元廷藥理>",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Doxazosin",
    "category": "神經/精神科 > 交感神經阻斷劑 > α1阻斷",
    "mechanism": "選擇性α1受器阻斷，使血管、前列腺與膀胱頸平滑肌鬆弛",
    "indications": "治BPH",
    "effects": "血管/括約肌收縮；阻斷時則血管與前列腺平滑肌放鬆；PDF重點：治BPH",
    "mnemonic": "p.13: 黑心(台語/osin/)的廠商山寨機，跟Apple inc對槓(a1 antagonist)\np.13: 治高血壓+BPH：柔欣(-zosin)有高血壓+BPH，因為愛吃印度拉麵(indoramine)\np.13: 煮阿姨(阻 α1)有肉腥(-zosin)\np.13: 你太快了(U-rapid-il)讓我整個走心(-zosin)，我要去吃印度拉麵(Indo-ramin)消消氣",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Venlafaxine",
    "category": "神經/精神科 > 抗憂鬱 > SNRI",
    "mechanism": "抑制SERT與NET，增加5-HT與NE",
    "indications": "適用症：憂鬱、異常疼痛、焦慮",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Levetiracetam",
    "category": "神經/精神科 > 抗癲癇 > SV2A結合",
    "mechanism": "結合突觸小泡蛋白SV2A，降低神經傳遞物釋放",
    "indications": "癲癇發作控制；部分用於神經痛或情緒穩定",
    "effects": "促進神經傳遞物質或內分泌/代謝反應",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Ritodrine",
    "category": "神經/精神科 > 擬交感神經藥物 > β2安胎藥",
    "mechanism": "β2受器致效，使子宮平滑肌鬆弛",
    "indications": "安胎 利得胎；裡頭定 →安胎",
    "effects": "支氣管平滑肌放鬆；可有心悸、低血鉀、高血糖",
    "mnemonic": "p.11: Ritodrine 安胎 •利得胎；裡頭定 🡺安胎",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Ambenonium",
    "category": "神經/精神科 > 膽鹼性致效劑 > 可逆AChE抑制",
    "mechanism": "可逆性抑制AChE，增加神經肌肉接合處ACh",
    "indications": "治MG、可口服",
    "effects": "活化對應受器，產生受器相關生理效應；PDF重點：明星一周風靡(edro-)，開記者會，記者一直死遞Mic(-stigmine)，抑制粉絲瓦解(Achase",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Pilocarpine",
    "category": "神經/精神科 > 膽鹼性致效劑 > 直接型",
    "mechanism": "Muscarinic受器致效",
    "indications": "重症肌無力、青光眼、阿茲海默症或解抗膽鹼毒性（依藥物）",
    "effects": "阻斷M受器，減少腺體分泌與平滑肌收縮；可散瞳、心跳上升、支氣管擴張",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Ergonovine",
    "category": "神經/精神科 > 頭痛用藥 > Ergot類",
    "mechanism": "Ergot alkaloid，促進子宮平滑肌收縮",
    "indications": "5-HT1B：血管收縮 (血管收縮可緩解與顱內血管擴張相關的頭痛)",
    "effects": "促進神經傳遞物質或內分泌/代謝反應；PDF重點：5-HT1B：血管收縮 (血管收縮可緩解與顱內血管擴張相關的頭痛)；5-HT1D：抑制CGRP (抑制三叉神經末梢釋放神經胜肽（如 CGRP、Substance P），減",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Codeine",
    "category": "神經/精神科 > 類鴉片止痛劑 > 弱/中效μ致效",
    "mechanism": "μ-opioid受器致效；Tramadol另抑制NE/5-HT再回收",
    "indications": "中重度疼痛、止咳或鴉片戒斷/解毒（依藥物）",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Omeprazole",
    "category": "腸胃科 > 消化性潰瘍 > PPI",
    "mechanism": "不可逆抑制胃壁細胞H+/K+ ATPase",
    "indications": "GERD、消化性潰瘍、Zollinger-Ellison syndrome；壓力性潰瘍出血預防/治療",
    "effects": "不可逆抑制胃壁細胞H+/K+ ATPase，持久抑制胃酸",
    "mnemonic": "p.65: 屁屁挨(PPI)打，怕揍(-prazole)\np.116: 蓋地板(台語，起頭咖)(Ketoco-)對阿祖(-azole)來說是一種苦行(Cushing)，可以治Cushing syndrome\np.116: 阿祖(-azole)看到爛(lanosterol)人很不爽，他踢他屁屁(P450)，剁他耳朵(ergosterol)",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Vonicog alfa",
    "category": "血液腫瘤科 > 凝血因子/vWD",
    "mechanism": "補充vWF ± factor VIII",
    "indications": "特定癌症或腫瘤標靶治療",
    "effects": "依其機轉產生對應藥理作用；請搭配適應症與考點複習",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Eloctate",
    "category": "血液腫瘤科 > 凝血因子/血友病",
    "mechanism": "重組factor VIII融合蛋白",
    "indications": "factor VIIIFc domain conjugate，治療與預防 A 型血友病患者出血；factor IXalbumin conjugate，治療及預防 B 型血友病患者出血；factor VIII concentrate，治療與預防 von Willebrand disease 患者出血；recombinant von Willebrand factor，治療與 von Willebrand disease",
    "effects": "依其機轉產生對應藥理作用；請搭配適應症與考點複習",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Argatroban",
    "category": "血液腫瘤科 > 抗凝血 > Direct thrombin inhibitors",
    "mechanism": "直接抑制thrombin (factor IIa)",
    "indications": "特定癌症或腫瘤標靶治療",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號",
    "mnemonic": "p.95: 美拉想搭船(Melagatran)，要去西門所以來搭船(Ximelagatran)。但身上沒帶錢，只好賴皮 (Lepi-)不付錢，結果被罰(Biva-)用agar(Arga-)當代幣(Dabi-)",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Cytarabine",
    "category": "血液腫瘤科 > 抗癌 > 抗代謝/嘧啶類",
    "mechanism": "Cytosine類似物，抑制DNA polymerase",
    "indications": "治療轉移性胰臟癌(113-1)",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）；PDF重點：似Cytosine，抑制DNA polymerase",
    "mnemonic": "p.100: 我付(5-FU)卡比(Cape-)錢，再塞他(Cytar-)寶石(Gem-)，希望他保守秘(嘧啶)密。\np.100: 塞爆他(Cytar-)腦袋🡺有CNS損傷",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Lapatinib",
    "category": "風濕免疫/腫瘤 > 標靶治療 > HER2/EGFR TKI",
    "mechanism": "抑制HER2/EGFR tyrosine kinase",
    "indications": "心臟收縮功能下降；乳癌(HER2 和 EGFR 都可抑制)",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）；PDF重點：心臟收縮功能下降；乳癌(HER2 和 EGFR 都可抑制)",
    "mnemonic": "p.93: 她(HER)抓著(Trastu-)、捧著(Pertuzu-)我的大懶趴(lapa-)\np.93: 帶孫子(台，Trastu)怕吐(pertu-)，就吸HER懶趴(lapa-)",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Celecoxib",
    "category": "風濕免疫科 > NSAID > COX-2選擇性",
    "mechanism": "選擇性抑制COX-2，降低發炎性PG生成",
    "indications": "高度selective，治RA、；無抗血小板作用",
    "effects": "降低前列腺素生成，解熱、止痛、抗發炎；PDF重點：無抗血小板作用",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Ketoprofen",
    "category": "風濕免疫科 > NSAID > Propionic acid類",
    "mechanism": "可逆抑制COX-1/2，降低PG生成",
    "indications": "抗發炎強(治痛風佳)(抑制；Phospholipase A/C，降低嗜中性；治(關閉)PDA (107-1)",
    "effects": "降低前列腺素生成，解熱、止痛、抗發炎；PDF重點：同時抑制COX、LOX(106-1)；抗發炎強(治痛風佳)(抑制",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Efalizumab",
    "category": "風濕免疫科 > 生物製劑 > Anti-CD11a",
    "mechanism": "抗LFA-1/CD11a，抑制T細胞黏附與活化",
    "indications": "(IM)治乾癬；治RA、巨細胞動脈炎",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Ustekinumab",
    "category": "風濕免疫科 > 生物製劑 > Anti-IL-12/23",
    "mechanism": "抗IL-12/23 p40，抑制Th1/Th17訊號",
    "indications": "過敏/蕁麻疹、動暈或胃酸相關疾病（依受器）",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號",
    "mnemonic": "p.91: Bro(Broda-), Us(Uste-IL12,23)一世(Ixe)社畜(secu-), 只能一起(IL-17)加班好好乾 (斑塊型乾癬)",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Mepolizumab",
    "category": "風濕免疫科 > 生物製劑 > Anti-IL-5",
    "mechanism": "抗IL-5單株抗體，降低嗜酸性球活性",
    "indications": "(IV)治嚴重嗜伊紅性氣喘；(IM)治乾癬；治RA、巨細胞動脈炎",
    "effects": "依其機轉產生對應藥理作用；請搭配適應症與考點複習",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Febuxostat",
    "category": "風濕免疫科 > 痛風 > Xanthine oxidase抑制",
    "mechanism": "抑制xanthine oxidase，降低尿酸合成",
    "indications": "急性痛風、慢性高尿酸血症或腫瘤溶解症預防",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "p.86: 全純肉(Alo-puri-nol)的飲食造就肥不瘦的身材(Febuso-stat)，少吃點XO醬吧！ (抑制XO)",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Procaine",
    "category": "麻醉科 > 局部麻醉 > Ester",
    "mechanism": "由細胞內側阻斷電壓依賴性Na+通道，抑制去極化",
    "indications": "局部/區域麻醉與止痛",
    "effects": "抑制電位依賴性鈉通道，降低神經或心肌興奮性；PDF重點：含PABA 結構：↓磺胺藥",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Triamcinolone",
    "category": "內分泌/新陳代謝 > 腎上腺皮質醇 > 中效Glucocorticoid",
    "mechanism": "活化glucocorticoid receptor，抑制發炎與免疫反應",
    "indications": "治腦腫瘤水腫，診斷Cushing",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號；PDF重點：生長抑制、",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Oxytocin",
    "category": "內分泌/新陳代謝 > 腦下垂體 > Oxytocin受器致效",
    "mechanism": "Oxytocin受器致效，促進子宮收縮與乳汁排出",
    "indications": "未在PDF同列明確標示；依分類臨床適應症複習",
    "effects": "活化對應受器，產生受器相關生理效應",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Terlipressin",
    "category": "內分泌/新陳代謝 > 腦下垂體 > Vasopressin類似物",
    "mechanism": "V1受器致效，造成血管收縮",
    "indications": "抗利尿；治中樞型尿崩症",
    "effects": "活化對應受器，產生受器相關生理效應；PDF重點：促進；血管收縮",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Telithromycin",
    "category": "感染科 > 抗生素 > Ketolide",
    "mechanism": "結合50S核醣體，抑制蛋白質合成",
    "indications": "殺菌型",
    "effects": "抑制細菌細胞壁、蛋白質、核酸或葉酸代謝",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Donepezil",
    "category": "神經/精神科 > 抗阿茲海默 > AChE抑制",
    "mechanism": "中樞AChE抑制，增加腦中ACh",
    "indications": "治療中重度AD",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號",
    "mnemonic": "p.34: 記者在瑞芳遇到明星，拼命遞麥(瑞芳死遞麥🡺rivastigmine)，Donald(這個明星)就很生氣潑汽油(Done潑汽 油🡺Donepezil)，可憐他們~(galantamine)\np.34: 東尼(Done-)跟蓋倫(Galan-)看到廣告(AD)跑去理髮(Riva)得到迷妹(Mema-)",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Rivastigmine",
    "category": "神經/精神科 > 抗阿茲海默 > AChE抑制",
    "mechanism": "中樞AChE抑制，增加腦中ACh",
    "indications": "治療中重度AD",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號",
    "mnemonic": "p.16: 明星一周風靡(edro-)，開記者會，記者一直死遞Mic(-stigmine)，抑制粉絲瓦解(Achase inh.)\np.16: 安卓手機(android phone, Edrophonium)一直黏住我(stick me, -stigmine)，使得了MG的 我都還一直用\np.34: 記者在瑞芳遇到明星，拼命遞麥(瑞芳死遞麥🡺rivastigmine)，Donald(這個明星)就很生氣潑汽油(Done潑汽 油🡺Donepezil)，可憐他們~(galantamine)",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Triamcinolone",
    "category": "胸腔科 > 抗氣喘 > 吸入型類固醇",
    "mechanism": "活化glucocorticoid receptor，抑制發炎基因轉錄",
    "indications": "氣喘/COPD維持或急性支氣管痙攣緩解",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Sucralfate",
    "category": "腸胃科 > 消化性潰瘍 > 黏膜保護",
    "mechanism": "酸性環境聚合黏附潰瘍面，保護黏膜並促PG",
    "indications": "pH<4 時便成活性態→空腹服用、三餐及睡前使用。不與制酸劑及抗胃酸藥合用",
    "effects": "促進神經傳遞物質或內分泌/代謝反應；PDF重點：促進mucus、",
    "mnemonic": "p.65: Sacrifice 促PG分泌，保護傷口；適合ICU病人的stress ulcer治療；無法預防NSAID – 自己保護胃 induced ulcer 黏膜",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Etodolac",
    "category": "風濕免疫科 > NSAID > Acetic acid類",
    "mechanism": "可逆抑制COX-1/2，降低PG生成",
    "indications": "高度selective，治RA、；無抗血小板作用；(Vioxx)易血栓，已下架；適用：兒童感染病毒(109-1) (避Aspirin 的",
    "effects": "降低RAAS作用，血管擴張、降醛固酮並保護心腎；PDF重點：增加MI、中風風險；無抗血小板作用",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Meloxicam",
    "category": "風濕免疫科 > NSAID > Oxicam類",
    "mechanism": "抑制COX；Meloxicam低劑量較偏COX-2",
    "indications": "高度selective，治RA、；無抗血小板作用；(Vioxx)易血栓，已下架；適用：兒童感染病毒(109-1) (避Aspirin 的",
    "effects": "降低前列腺素生成，解熱、止痛、抗發炎；PDF重點：無抗血小板作用；抗發炎、抗血小板作用弱",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Mexiletine",
    "category": "心臟科 > 抗心律不整 > Class IB",
    "mechanism": "阻斷Na+通道，縮短APD，偏作用於缺血/去極化心肌",
    "indications": "心律不整治療",
    "effects": "抑制電位依賴性鈉通道，降低神經或心肌興奮性；PDF重點：置毛地黃造成的心律不整",
    "mnemonic": "p.54: B咖：墨西哥人、抑制phase0：弱(因為B咖很弱)、QT：縮短(B咖很短) 墨西哥(Mexiletine)B咖，你多看(Lidocaine)，不要動(=非你動)(Phenytoin)\np.54: B級Mexican(Mexiletine)吹口琴(口服)為了利多(lidocaine)太心急(Mex-跟lido-治療急性心律不 整)上抖音(phenytoin)被黃標(治毛地黃中毒)",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Busulfan",
    "category": "血液腫瘤科 > 抗癌 > Alkyl sulfonate",
    "mechanism": "DNA烷化，造成骨髓抑制",
    "indications": "Glutathione S-transferase 活性增加時易引起抗藥",
    "effects": "干擾DNA/RNA或細胞分裂，產生細胞毒性；PDF重點：Glutathione S-transferase 活性增加時易引起抗藥",
    "mnemonic": "p.99: 公車(Busulfan)的廢氣，造成肺纖維化",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Levothyroxine",
    "category": "內分泌/新陳代謝 > 甲狀腺 > 甲狀腺素",
    "mechanism": "T4補充，轉為T3後活化核內甲狀腺素受器",
    "indications": "平常治療首選、治黏液水腫昏迷；用於甲低或甲亢患者調整劑量時；可治amiodarone(心律不整藥",
    "effects": "依其機轉產生對應藥理作用；請搭配適應症與考點複習；PDF重點：物)所造成的甲狀腺功能低下",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Acarbose",
    "category": "內分泌/新陳代謝 > 糖尿病 > α-glucosidase抑制",
    "mechanism": "抑制腸道α-glucosidase，延緩寡糖分解/吸收",
    "indications": "糖尿病血糖控制",
    "effects": "降低血糖或改善胰島素/腸泌素/腎糖排出路徑；PDF重點：抑制腸內分解；不易低血糖(若有用葡萄糖or 牛奶",
    "mnemonic": "p.76: 一卡車的老大(acarbose)不准寡糖在腸道分解，他們火氣很大🡺讓肚子都氣(SE：腸脹氣)。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Finasteride",
    "category": "內分泌/新陳代謝 > 性激素 > 5α-reductase抑制",
    "mechanism": "抑制5α-reductase，使testosterone轉DHT下降",
    "indications": "治雄性禿；治療男性性慾過強(107-1)",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）；PDF重點：抑制攝護腺肥大；抑制腎上腺&性腺的固醇類激素合成",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Propylthiouracil",
    "category": "內分泌/新陳代謝 > 甲狀腺 > Thioamides",
    "mechanism": "抑制thyroid peroxidase；並抑制周邊T4→T3",
    "indications": "蛋白結合態少，不適用於孕婦",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號；PDF重點：[ 主要抑制去碘化(T4 轉；[主要抑制T3, T4 合成]",
    "mnemonic": "p.71: 媽祖包庇 (Propyl-)：保孕婦（可用在孕婦）",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Acetazolamide",
    "category": "心臟科 > 利尿劑 > 碳酸酐酶抑制劑",
    "mechanism": "抑制近曲小管carbonic anhydrase，減少HCO3-再吸收",
    "indications": "青光眼；高山症(預防水腫+",
    "effects": "增加尿鈉/水排出，依部位影響K、Ca、Mg與酸鹼；PDF重點：減少HCO3-再吸收；抑制CA→",
    "mnemonic": "p.46: Acid都在裡面(acetazolamine)→所以流出來的是鹼性尿\np.46: 買一瓶西打(Aceta-)，說“走囉(-zola-)，去爬mountain(-mide)” 1. 西打：喝很多西打身體會變酸=導致代謝性酸中毒、2. “走囉，去爬山”：預防高山症",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Methicillin",
    "category": "感染科 > 抗生素 > Penicillinase-resistant penicillins",
    "mechanism": "β-lactam；抑制PBP，且較耐penicillinase",
    "indications": "細菌感染治療（菌種依藥物光譜）",
    "effects": "抑制細菌細胞壁、蛋白質、核酸或葉酸代謝；PDF重點：對altered PBP 之MRSA 無",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Melarsoprol",
    "category": "感染科 > 抗蟲 > 非洲錐蟲",
    "mechanism": "砷劑，抑制寄生蟲含硫酵素",
    "indications": "寄生蟲/原蟲感染治療",
    "effects": "依蟲種破壞寄生蟲神經肌肉/微管或代謝，使蟲體麻痺或死亡",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Acetylcysteine",
    "category": "毒物學 > Acetaminophen解毒",
    "mechanism": "補充glutathione，解毒NAPQI",
    "indications": "Carbamate (胺基甲酸鹽殺蟲劑)；抗劑；Oxidizing agents(nitrogen oxides 心衰竭、心絞痛、癌症",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）；PDF重點：增加肝臟內；Anticholinergic agent 中毒、非去極化神經肌肉阻斷劑中毒",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "N-Acetylcysteine",
    "category": "毒物學 > Acetaminophen解毒",
    "mechanism": "補充glutathione，解毒NAPQI",
    "indications": "高血壓；部分用於心衰竭、腎保護或心絞痛",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Paroxetine",
    "category": "神經/精神科 > 抗憂鬱 > SSRI",
    "mechanism": "選擇性抑制SERT，增加突觸間5-HT",
    "indications": "睡、體重增加、頭痛；禁突然停藥(眩暈失眠疲倦噁心焦慮寒顫頭痛等戒斷症狀)",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Amitriptyline",
    "category": "神經/精神科 > 抗憂鬱 > TCA",
    "mechanism": "抑制NET與SERT，增加NE與5-HT；另有M1/H1/α1阻斷",
    "indications": "鎮靜作用強(抗H1；抗H1：增重、嗜睡、鎮靜；抗α1：姿態性低血壓、心搏過速、嗜睡；預防偏頭痛",
    "effects": "血管/括約肌收縮；阻斷時則血管與前列腺平滑肌放鬆；PDF重點：鎮靜作用強(抗H1；抗H1：增重、嗜睡、鎮靜",
    "mnemonic": "p.25: I promise(-ipramine)要帶小孩去環島(TCA, “Taiwan - cycle around”)，但trip太冷(- triptyline)，所以不去北(N)或南(S)(抑制NE Serotonin回收)，也不吃HAM(H a M antagonist)。小孩也promise不亂尿床",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Amitriptyline",
    "category": "神經/精神科 > 擬交感神經藥物 > 間接型",
    "mechanism": "三環抗憂鬱劑；抑制NE與5-HT再回收",
    "indications": "鎮靜作用強(抗H1；抗H1：增重、嗜睡、鎮靜；抗α1：姿態性低血壓、心搏過速、嗜睡；預防偏頭痛",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）；PDF重點：鎮靜作用強(抗H1；抗H1：增重、嗜睡、鎮靜",
    "mnemonic": "p.25: I promise(-ipramine)要帶小孩去環島(TCA, “Taiwan - cycle around”)，但trip太冷(- triptyline)，所以不去北(N)或南(S)(抑制NE Serotonin回收)，也不吃HAM(H a M antagonist)。小孩也promise不亂尿床",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Botulinum toxin",
    "category": "神經/精神科 > 神經肌肉/毒素",
    "mechanism": "切割SNARE蛋白，抑制ACh釋放",
    "indications": "未在PDF同列明確標示；依分類臨床適應症複習",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號",
    "mnemonic": "p.20: 柏拉圖(botulism)氏的愛情🡺不have sex、不射(不釋放Ach到突觸)\np.20: 不吐(Botu)，突觸不吐出小泡",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Rivaroxaban",
    "category": "血液腫瘤科 > 抗凝血 > Direct Xa inhibitors",
    "mechanism": "直接抑制factor Xa",
    "indications": "為直接性解毒劑",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號",
    "mnemonic": "p.96: Xaban倒過來看，就是ban Xa，抑制Xa",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Eltrombopag",
    "category": "血液腫瘤科 > 血小板生成",
    "mechanism": "TPO receptor (Mpl)致效，促進血小板生成",
    "indications": "特定癌症或腫瘤標靶治療",
    "effects": "活化對應受器，產生受器相關生理效應；PDF重點：dependent 血小板增加",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Afatinib",
    "category": "風濕免疫/腫瘤 > 標靶治療 > EGFR TKI",
    "mechanism": "抑制EGFR tyrosine kinase",
    "indications": "特定癌症或腫瘤標靶治療",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Secukinumab",
    "category": "風濕免疫科 > 生物製劑 > Anti-IL-17",
    "mechanism": "阻斷IL-17A或IL-17受器，抑制Th17發炎",
    "indications": "過敏/蕁麻疹、動暈或胃酸相關疾病（依受器）",
    "effects": "阻斷對應受器或通道，降低該路徑效應",
    "mnemonic": "p.91: Bro(Broda-), Us(Uste-IL12,23)一世(Ixe)社畜(secu-), 只能一起(IL-17)加班好好乾 (斑塊型乾癬)",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Colchicine",
    "category": "風濕免疫科 > 痛風 > 急性",
    "mechanism": "抑制tubulin聚合成microtubule，降低嗜中性球趨化/吞噬",
    "indications": "急性止痛；抑制紡垂絲形成→抗癌藥",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號；PDF重點：抑制Neutrophils 上的；化/吞噬作用↓",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Nitrous oxide",
    "category": "麻醉科 > 全身麻醉 > 吸入性",
    "mechanism": "NMDA受器拮抗為主，具止痛與麻醉作用",
    "indications": "氣體麻醉劑；安全、止痛佳；性，可能造成巨母紅血球性貧血(Megaloblastic",
    "effects": "阻斷對應受器或通道，降低該路徑效應；PDF重點：安全、止痛佳；氧化Vit. B12 導致神經病變",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Benzocaine",
    "category": "麻醉科 > 局部麻醉 > Ester",
    "mechanism": "由細胞內側阻斷電壓依賴性Na+通道，抑制去極化",
    "indications": "局部/區域麻醉與止痛",
    "effects": "抑制電位依賴性鈉通道，降低神經或心肌興奮性",
    "mnemonic": "p.45: 四台(Tetra-)賓士(Benzo-)在半夜飆車， 成了治安破口(Pro-, Co-) 作用較好(傷口酸性)→確",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Triamterene",
    "category": "心臟科 > 利尿劑 > ENaC阻斷",
    "mechanism": "直接阻斷集尿管ENaC，保鉀利尿",
    "indications": "高血壓、水腫、心衰竭或特定電解質異常（依藥物）",
    "effects": "增加尿鈉/水排出，依部位影響K、Ca、Mg與酸鹼；PDF重點：低血鉀症",
    "mnemonic": "p.47: 嘉義的阿財super愛噴錢：(建議搭配影片服用www https://youtu.be/nslykuObX9k) 嘉義(K+)的阿財(阿成台灣阿成世界偉人財神總統，簡稱阿財)(阿ami-，財 tria-)super(spiron-)愛噴錢(eple-)，E奶(抑制ENaC)Amy想被騎(Amiloride)想try m(triamterene)",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Penicillin V",
    "category": "感染科 > 抗生素 > β-lactam/Penicillin",
    "mechanism": "β-lactam；結合PBP並抑制transpeptidation，阻斷peptidoglycan交聯",
    "indications": "高血壓、心絞痛、心衰竭、心律不整、青光眼（依藥物）",
    "effects": "抑制細菌細胞壁、蛋白質、核酸或葉酸代謝；PDF重點：對altered PBP 之MRSA 無",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Quinine",
    "category": "感染科 > 抗蟲 > 抗瘧",
    "mechanism": "抑制heme polymerization",
    "indications": "預防；抗性惡性瘧；可用於孕婦",
    "effects": "依蟲種破壞寄生蟲神經肌肉/微管或代謝，使蟲體麻痺或死亡；PDF重點：低血糖",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Clonazepam",
    "category": "神經/精神科 > 抗焦慮/鎮靜安眠 > Benzodiazepines",
    "mechanism": "GABA_A受器正向變構調節；增加Cl-通道開啟頻率",
    "indications": "治療抽筋；.藥效短-易戒斷、反彈性失眠；戒斷、白天嗜睡；最長效、戒斷最不明顯",
    "effects": "增強GABA-A抑制性傳導，鎮靜、抗焦慮、抗癲癇",
    "mnemonic": "p.21: 我打走(midazolam)踹走(Triazolam)牛 Temazepam、長Flurazepam) (ox-) ： (2)抗痙攣(Clonazepam) 被術前打鎮定劑的時候因為不想手術，所以我打 (3)中樞性骨骼肌鬆弛劑(Diazepam) 走 (midazolam) 醫生。 (4)急性酒精戒斷治療(Dia-、Oxa-、",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Clonazepam",
    "category": "神經/精神科 > 抗癲癇 > GABA_A增強",
    "mechanism": "增強GABA_A介導的Cl-內流",
    "indications": "治療抽筋；.藥效短-易戒斷、反彈性失眠；戒斷、白天嗜睡；最長效、戒斷最不明顯",
    "effects": "增強GABA-A抑制性傳導，鎮靜、抗焦慮、抗癲癇",
    "mnemonic": "p.21: 我打走(midazolam)踹走(Triazolam)牛 Temazepam、長Flurazepam) (ox-) ： (2)抗痙攣(Clonazepam) 被術前打鎮定劑的時候因為不想手術，所以我打 (3)中樞性骨骼肌鬆弛劑(Diazepam) 走 (midazolam) 醫生。 (4)急性酒精戒斷治療(Dia-、Oxa-、",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Metaproterenol",
    "category": "神經/精神科 > 擬交感神經藥物 > β2短效致效劑",
    "mechanism": "β2受器致效，活化Gs/cAMP使支氣管或子宮平滑肌鬆弛",
    "indications": "氣喘/COPD支氣管痙攣；部分藥物可安胎",
    "effects": "支氣管平滑肌放鬆；可有心悸、低血鉀、高血糖；PDF重點：β2 agonist 會升血糖",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Metaproterenol",
    "category": "胸腔科 > 抗氣喘 > β2短效致效",
    "mechanism": "β2受器致效，促進cAMP使支氣管平滑肌鬆弛",
    "indications": "氣喘/COPD維持或急性支氣管痙攣緩解",
    "effects": "支氣管平滑肌放鬆；可有心悸、低血鉀、高血糖",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Bismuth",
    "category": "腸胃科 > 消化性潰瘍 > 黏膜保護",
    "mechanism": "促進mucus/HCO3-/PG並具抗H. pylori作用",
    "indications": "※不能與制酸劑/其他抗胃酸藥併用：PPI、sucralfate",
    "effects": "促進神經傳遞物質或內分泌/代謝反應；PDF重點：促進mucus、",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Mechlorethamine",
    "category": "血液腫瘤科 > 抗癌 > Alkylating nitrogen mustard",
    "mechanism": "形成DNA交聯，抑制DNA複製",
    "indications": "出血性膀胱炎→Mesna 解",
    "effects": "干擾DNA/RNA或細胞分裂，產生細胞毒性",
    "mnemonic": "p.99: 沒課(Mechlo-)時，去買環形(Cyclo-)的戒指(芥子氣)。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Pemetrexed",
    "category": "血液腫瘤科 > 抗癌 > 抗代謝/葉酸拮抗",
    "mechanism": "抑制thymidylate synthase，亦抑制DHFR等葉酸路徑",
    "indications": "特定癌症或腫瘤標靶治療",
    "effects": "阻斷對應受器或通道，降低該路徑效應",
    "mnemonic": "p.100: 還(DHFR)甲(Metho-)基在合成(TS)牌的馬桶上對我(me)放屁(屁me：pemetrexed)",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Isoflurane",
    "category": "麻醉科 > 全身麻醉 > 吸入性鹵化麻醉劑",
    "mechanism": "增強GABA_A/甘胺酸等抑制性通道並抑制興奮性傳遞，造成全身麻醉",
    "indications": "高劑量致癲癇",
    "effects": "增強GABA-A抑制性傳導，鎮靜、抗焦慮、抗癲癇；PDF重點：心輸出率越低則對溶解大者誘導速率增加；大劑量下均有支氣管擴張、子宮舒張效果",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Exenatide",
    "category": "內分泌/新陳代謝 > 糖尿病 > GLP-1致效",
    "mechanism": "GLP-1受器致效，葡萄糖依賴性促insulin並抑制glucagon",
    "indications": "降低食慾(減重)",
    "effects": "降低血糖或改善胰島素/腸泌素/腎糖排出路徑；PDF重點：不會低血糖；降低食慾(減重)",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Nateglinide",
    "category": "內分泌/新陳代謝 > 糖尿病 > Meglitinides",
    "mechanism": "阻斷胰臟β細胞KATP通道，促進餐後insulin分泌",
    "indications": "氣喘/COPD、動暈、尿失禁、帕金森/EPS或散瞳（依藥物）",
    "effects": "降低血糖或改善胰島素/腸泌素/腎糖排出路徑",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Trilostane",
    "category": "內分泌/新陳代謝 > 腎上腺類固醇合成抑制",
    "mechanism": "抑制3β-hydroxysteroid dehydrogenase，降低類固醇合成",
    "indications": "治Cushing’s",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Romosozumab",
    "category": "內分泌/新陳代謝 > 骨鬆 > Anti-sclerostin",
    "mechanism": "抗sclerostin單株抗體，促進骨形成",
    "indications": "未在PDF同列明確標示；依分類臨床適應症複習",
    "effects": "促進神經傳遞物質或內分泌/代謝反應；PDF重點：抑制Sclerostin",
    "mnemonic": "p.73: 唸起來像dinosaur，因為小行星砸下來死光了，所以被排在rank L，代表他們是 loser\np.73: 是個螺絲釘(Sclerostin)，所以只能落寞鎖住(Romosozu-)",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Molsidomine",
    "category": "心臟科 > 心絞痛 > NO供體前驅物",
    "mechanism": "代謝為SIN-1釋放NO，提升cGMP造成血管舒張",
    "indications": "cyclase，導致冠狀血管平滑肌細胞內cGMP 濃度上升，使血管放鬆並增加；適應症：心絞痛、缺血性心臟病、心衰竭、減少腦血管痙攣導致的腦中風",
    "effects": "促進神經傳遞物質或內分泌/代謝反應；PDF重點：cyclase，導致冠狀血管平滑肌細胞內cGMP 濃度上升，使血管放鬆並增加；適應症：心絞痛、缺血性心臟病、心衰竭、減少腦血管痙攣導致的腦中風",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Disopyramide",
    "category": "心臟科 > 抗心律不整 > Class IA",
    "mechanism": "阻斷Na+通道並延長再極化；兼具K+通道阻斷",
    "indications": "治療心房顫動",
    "effects": "抑制電位依賴性鈉通道，降低神經或心肌興奮性",
    "mnemonic": "p.54: A咖：貴族、抑制phase0：中(因為貴族通常很中庸)、QT：延長(貴族可以最長)\np.54: Na個 no MAKe up(anti-M,alpha,K+)皇后(quinidine)宣稱(procain-)Diso金字塔 (pyramide)是一等A級的",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Dronedarone",
    "category": "心臟科 > 抗心律不整 > Class III",
    "mechanism": "阻斷K+通道，延長phase 3與ERP",
    "indications": "用於陣發性或永久性心房顫動、PVST 復發；長期服用降低AMI 死亡率",
    "effects": "阻斷對應受器或通道，降低該路徑效應；PDF重點：抑制NE 釋出；同時具classII、III、含強力β 阻斷活性(非選擇性)",
    "mnemonic": "p.55: 假的(K blocker) 阿喵(Amio-) 其實是Brety姐(Bretylium)，她一步踢來(Ibutilide)，都飛 踢(Dofeti-)， 求你(Drone-) ㄙㄡˊ她(Sota-，撫摸)的Vagina(Verna-) <取自高醫元廷藥理>",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Caspofungin",
    "category": "感染科 > 抗黴菌 > Echinocandin",
    "mechanism": "抑制β-1,3-D-glucan synthase，阻斷真菌細胞壁合成",
    "indications": "治麴菌、念珠菌",
    "effects": "抑制細菌細胞壁、蛋白質、核酸或葉酸代謝",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Caffeine",
    "category": "毒物學 > 解毒劑",
    "mechanism": "Adenosine受器拮抗與PDE抑制，刺激中樞/心臟",
    "indications": "Opioid(酒精)戒斷症狀；Carbamate (胺基甲酸鹽殺蟲劑)；抗劑",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）；PDF重點：鎮靜藥物Benzodiazepine(BZD)",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Tasimelteon",
    "category": "神經/精神科 > 睡眠節律藥",
    "mechanism": "MT1/MT2褪黑激素受器致效",
    "indications": "安眠，作用於melatonin receptor(107-1)",
    "effects": "活化對應受器，產生受器相關生理效應",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Apraclonidine",
    "category": "神經/精神科 > 青光眼用藥 > 擬交感/擬副交感/前列腺素",
    "mechanism": "α2受器致效，降低房水生成",
    "indications": "β blocker(首選)",
    "effects": "降低中樞交感輸出或增加NE釋放（依致效/拮抗）；PDF重點：Diuretics 利尿劑",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Ubrogepant",
    "category": "神經/精神科 > 頭痛用藥 > CGRP受器拮抗",
    "mechanism": "CGRP受器拮抗",
    "indications": "偏頭痛急性治療或預防",
    "effects": "阻斷對應受器或通道，降低該路徑效應",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Budesonide",
    "category": "胸腔科 > 抗氣喘 > 吸入型類固醇",
    "mechanism": "活化glucocorticoid receptor，抑制發炎基因轉錄",
    "indications": "口咽，易感染(漱；口服(適用小孩)；常用於Aspirin-",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號；PDF重點：抑制5-Lipoxygenase (LOX)",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Flunisolide",
    "category": "胸腔科 > 抗氣喘 > 吸入型類固醇",
    "mechanism": "活化glucocorticoid receptor，抑制發炎基因轉錄",
    "indications": "口咽，易感染(漱",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Mometasone",
    "category": "胸腔科 > 抗氣喘 > 吸入型類固醇",
    "mechanism": "活化glucocorticoid receptor，抑制發炎基因轉錄",
    "indications": "口服(適用小孩)；常用於Aspirin-",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號；PDF重點：抑制5-Lipoxygenase (LOX)",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Apixaban",
    "category": "血液腫瘤科 > 抗凝血 > Direct Xa inhibitors",
    "mechanism": "直接抑制factor Xa",
    "indications": "特定癌症或腫瘤標靶治療",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號",
    "mnemonic": "p.96: Xaban倒過來看，就是ban Xa，抑制Xa",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Lepirudin",
    "category": "血液腫瘤科 > 抗凝血 > Direct thrombin inhibitors",
    "mechanism": "直接抑制thrombin (factor IIa)",
    "indications": "特定癌症或腫瘤標靶治療",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號",
    "mnemonic": "p.95: 美拉想搭船(Melagatran)，要去西門所以來搭船(Ximelagatran)。但身上沒帶錢，只好賴皮 (Lepi-)不付錢，結果被罰(Biva-)用agar(Arga-)當代幣(Dabi-)\np.95: 沒錢賴皮(Lepi-)，只好割腎(腎代謝)做代幣(Dabi-)。(只有Lepi和Dabi是腎代謝，其他都是肝 代謝)",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Docetaxel",
    "category": "血液腫瘤科 > 抗癌 > Taxanes",
    "mechanism": "穩定微小管，抑制去聚合",
    "indications": "特定癌症或腫瘤標靶治療",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）；PDF重點：易骨髓抑制、水腫",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Gemcitabine",
    "category": "血液腫瘤科 > 抗癌 > 抗代謝/嘧啶類",
    "mechanism": "Cytidine類似物，抑制DNA合成",
    "indications": "治療轉移性胰臟癌(113-1)",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Avelumab",
    "category": "風濕免疫/腫瘤 > Immune checkpoint > Anti-PD-L1",
    "mechanism": "抗PD-L1，解除T細胞抑制",
    "indications": "特定癌症或腫瘤標靶治療",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Necitumumab",
    "category": "風濕免疫/腫瘤 > 標靶治療 > Anti-EGFR",
    "mechanism": "抗EGFR單株抗體，阻斷EGFR訊號",
    "indications": "非小細胞肺癌具EGFR 突變, 胰臟癌；腹瀉",
    "effects": "阻斷對應受器或通道，降低該路徑效應",
    "mnemonic": "p.93: 騙你(Pani-)收Gift(Geft-)，你生氣的吸吐(Cetu-)氣 ，捏死(Neci-)你耳朵(Erlot-)\np.93: 皮條客(EGFR)試圖(cetu-)盤你(pani-), 你捏死他(necitu-), 斷他頸項(治頭頸癌)",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Trastuzumab",
    "category": "風濕免疫/腫瘤 > 標靶治療 > HER2",
    "mechanism": "抗HER2單株抗體，抑制HER2訊號",
    "indications": "乳癌(有表現 HER2 有效)；心臟收縮功能下降；乳癌(HER2 和 EGFR 都可抑制)",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號；PDF重點：心臟收縮功能下降；乳癌(HER2 和 EGFR 都可抑制)",
    "mnemonic": "p.93: 她(HER)抓著(Trastu-)、捧著(Pertuzu-)我的大懶趴(lapa-)",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Sorafenib",
    "category": "風濕免疫/腫瘤 > 標靶治療 > 多靶點TKI",
    "mechanism": "抑制VEGFR/PDGFR等多種tyrosine kinase",
    "indications": "腎細胞癌、肝癌(尤其是手術無法切；除或轉移的肝癌)、黑色素瘤；治轉移性大腸直腸癌",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "p.93: 拉姆(Ramu-)從被窩(Beva-)起來，看到是晴天(suni-)，爽啦(sora-)\np.93: 你老母(Ramu-)咧，真的很白目(台, Beva-)耶，知道我要考試，還跟我說：”爽啦(Sora-)是 晴天(suni-)”，還跟我比YA(V, VGFR)，Sunny(Suni-)，備馬(Beva-) 拉母(Ramu-)牛去曬 太陽，爽啦(Sora-)",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Meclofenamate",
    "category": "風濕免疫科 > NSAID > Fenamate類",
    "mechanism": "可逆抑制COX，降低PG生成",
    "indications": "高度selective，治RA、；無抗血小板作用；(Vioxx)易血栓，已下架；適用：兒童感染病毒(109-1) (避Aspirin 的",
    "effects": "降低前列腺素生成，解熱、止痛、抗發炎；PDF重點：增加MI、中風風險；無抗血小板作用",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Daclizumab",
    "category": "風濕免疫科 > 免疫抑制 > Anti-CD25",
    "mechanism": "抗IL-2 receptor α (CD25)單株抗體，抑制T cell活化",
    "indications": "自體免疫疾病、器官移植排斥或發炎疾病",
    "effects": "調節多巴胺傳導，影響精神症狀、EPS、泌乳或帕金森症狀",
    "mnemonic": "p.89: 大顆粒(Dacli-)的巴西梨(Basili-)只要25元(anti-CD25)",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Teriflunomide",
    "category": "風濕免疫科 > 免疫抑制/抗代謝",
    "mechanism": "抑制dihydroorotate dehydrogenase，減少pyrimidine合成",
    "indications": "自體免疫疾病、器官移植排斥或發炎疾病",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）；PDF重點：誘發lipocortin,抑制PLA2；量↑",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Belimumab",
    "category": "風濕免疫科 > 生物製劑 > Anti-BAFF",
    "mechanism": "抗BAFF/BLyS，降低B cell存活",
    "indications": "未在PDF同列明確標示；依分類臨床適應症複習",
    "effects": "依其機轉產生對應藥理作用；請搭配適應症與考點複習；PDF重點：阻斷 IL-4 和 IL-13 的訊號傳導",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Baloxavir",
    "category": "感染科 > 抗流感 > Cap-dependent endonuclease inhibitor",
    "mechanism": "抑制influenza polymerase acidic (PA) endonuclease",
    "indications": "未在PDF同列明確標示；依分類臨床適應症複習",
    "effects": "抑制病毒複製、成熟或進入宿主細胞；PDF重點：(抑制Polymerase Acidic(PA)",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Daptomycin",
    "category": "感染科 > 抗生素 > 細胞膜作用",
    "mechanism": "與Ca2+協同插入細胞膜，造成去極化與K+流出",
    "indications": "細菌感染治療（菌種依藥物光譜）",
    "effects": "調節鈣離子通道/骨代謝/血管平滑肌收縮；PDF重點：與Ca 離子偕同，結合至細胞膜上造成K+流出，細胞死亡",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Canagliflozin",
    "category": "內分泌/新陳代謝 > 糖尿病 > SGLT2抑制",
    "mechanism": "抑制近曲小管SGLT2，降低葡萄糖再吸收",
    "indications": "糖尿病血糖控制",
    "effects": "降低血糖或改善胰島素/腸泌素/腎糖排出路徑",
    "mnemonic": "p.76: 把蛤蜊frozen(-glifrozen)就不能吃glucose(不吸收glucose)了",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Streptomycin",
    "category": "感染科 > 抗生素 > Aminoglycosides",
    "mechanism": "不可逆結合30S，造成mRNA誤讀並抑制起始複合體",
    "indications": "細菌感染治療（菌種依藥物光譜）",
    "effects": "干擾DNA/RNA或細胞分裂，產生細胞毒性；PDF重點：抑制細胞壁合成",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Streptomycin",
    "category": "感染科 > 抗結核 > Aminoglycoside",
    "mechanism": "結合30S，抑制蛋白質合成",
    "indications": "細菌感染治療（菌種依藥物光譜）",
    "effects": "抑制細菌細胞壁、蛋白質、核酸或葉酸代謝；PDF重點：抑制細胞壁合成",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Abciximab",
    "category": "血液腫瘤科 > 抗血小板 > GP IIb/IIIa拮抗",
    "mechanism": "阻斷GP IIb/IIIa，抑制fibrinogen橋接血小板",
    "indications": "特定癌症或腫瘤標靶治療",
    "effects": "阻斷對應受器或通道，降低該路徑效應；PDF重點：阻斷 GP 2b/3a",
    "mnemonic": "p.96: 在ABCmart(Abci-)裡，T羅飛奔(tirofiban)去買鞋子，結果鞋子被賣光empty(empti-)了\np.96: GP像grape，吃葡萄前要洗，所以都會問：“還不(Ab-)洗洗(-cixi-)嗎(-mab)”， --mab結尾： monoclonal Ab\np.96: ***接續上面的故事：只有肉體關係太弱(Tiro-)，應該要交流一些ABC(abcixi-)、或3A2B(阻斷GP llb/llla- R)這種猜數字的遊戲、或是跆拳道如何踢飛body(-tifibate)",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Hydroxyurea",
    "category": "血液腫瘤科 > 鐮刀型貧血",
    "mechanism": "抑制ribonucleotide reductase並提高HbF",
    "indications": "治療鐮刀型貧血；見免疫藥物；治嚴重；疲憊、頭痛及心房心律不整",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Mannitol",
    "category": "心臟科 > 利尿劑 > 滲透型",
    "mechanism": "增加腎小管腔滲透壓，減少水分再吸收",
    "indications": "顱內壓升高；青光眼",
    "effects": "增加尿鈉/水排出，依部位影響K、Ca、Mg與酸鹼；PDF重點：顱內壓升高；利尿效果",
    "mnemonic": "p.47: 沒你透，沒有什麼比mannitol滲透壓那麼高的\np.106: 因為疫情的關係，男人都(-man-dole) 薪停(-xitin)只能穿破徙(-proxil)，只吃鐵蛋(-tetan)果腹瘦成骷 髏(-clor)，對肉食糜(-roxime)的慾望直衝腦門，外帶回家才發現沒帶鎖(-metazole)\np.122: Rimantadine (龜剛 治帕金森症 阻止病毒複製 • “很man的2個人” -man- 阻",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Flecainide",
    "category": "心臟科 > 抗心律不整 > Class IC",
    "mechanism": "強效阻斷Na+通道，明顯抑制phase 0",
    "indications": "心律不整治療",
    "effects": "抑制電位依賴性鈉通道，降低神經或心肌興奮性",
    "mnemonic": "p.54: C=吸：肥子、抑制phase0：強、QT：不變 不怕肥呢(Propafenone)就可以吸(音同C)肥可奶(Flecainide)",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Lorcaserin",
    "category": "自泌素 > Serotonin > 5-HT2C致效/減重",
    "mechanism": "5-HT2C受器致效，抑制食慾",
    "indications": "化療止吐藥",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）；PDF重點：Low 卡()→抑制食慾for 減肥；reflex 造成心跳變慢及低",
    "mnemonic": "p.59: Low卡(lorcaserin)🡺抑制食慾for減肥",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Oxandrolone",
    "category": "內分泌/新陳代謝 > 性激素 > Androgen",
    "mechanism": "Androgen receptor致效",
    "indications": "testosterone 衍生物，長期類固醇的輔助治療，促進增肌、；緩解子宮內膜異位",
    "effects": "活化對應受器，產生受器相關生理效應；PDF重點：testosterone 衍生物，長期類固醇的輔助治療，促進增肌、；↓骨質疏鬆",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Sibutramine",
    "category": "內分泌/新陳代謝 > 減肥藥",
    "mechanism": "抑制SERT與NET，降低食慾",
    "indications": "肥胖症輔助治療",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）；PDF重點：增加心血管疾病風險已下市；促NE 釋放+增加GABA 作用",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Chlorothiazide",
    "category": "心臟科 > 利尿劑 > Thiazides",
    "mechanism": "抑制遠曲小管Na+/Cl- cotransporter (NCC)",
    "indications": "高血壓、水腫、心衰竭或特定電解質異常（依藥物）",
    "effects": "增加尿鈉/水排出，依部位影響K、Ca、Mg與酸鹼；PDF重點：反而可減少多尿病人",
    "mnemonic": "p.46: Thiazide唸快一點🡺蝦子，感覺蝦子吃多了不健康(高血糖 高血脂 高血鈣 高尿酸)，但會低血壓(🡺治高血壓) (好啦 這口訣沒那麼相關 但唸快一點變蝦子 是取自醫學口訣大亂鬥 我覺得滿好笑的就記起來了 by士博)\np.46: Thiazide唸起來像“泰山”： 1. 卡通那個泰山(Tarzan)可以晃很遠，所以是作用在遠曲小管(DCT) 2. 真正那座很高的泰山：治高血壓第一線用藥；SE：除了Na+, K+之外其他都變高 3. 泰山崩於前而色不變：治腎因性尿崩症\np.46: NCC(國家通訊委員會)駐點在泰山，泰山的蝦子，蝦子有很多鈣，升血鈣 (Que Logic?)",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Amlodipine",
    "category": "心臟科 > 降血壓/CCB > DHP",
    "mechanism": "阻斷L-type Ca2+通道，以血管平滑肌舒張為主",
    "indications": "頭痛；治療雷諾氏症狀(手指麻木發紺)",
    "effects": "調節鈣離子通道/骨代謝/血管平滑肌收縮；PDF重點：主要舒張血管；心臟抑制(後兩者)",
    "mnemonic": "p.49: 低頻(-dipine)聲音會阻止Ca2+ 抑血管收縮",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Evolocumab",
    "category": "心臟科 > 降血脂 > PCSK9抑制",
    "mechanism": "抑制PCSK9，減少LDL receptor分解",
    "indications": "高脂血症與動脈粥樣硬化風險降低",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號",
    "mnemonic": "p.57: (肥)肉哭沒(-volocumab、-rocumab)了🡺降血脂",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Entacapone",
    "category": "神經/精神科 > 抗帕金森 > COMT抑制",
    "mechanism": "抑制COMT，減少L-dopa/DA周邊或中樞代謝",
    "indications": "帕金森氏症或藥物誘發EPS",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號；PDF重點：僅周邊有效，抑制周邊組織",
    "mnemonic": "p.30: 開篷車(capone)頭髮亂飛就不能comb hair(抑制COMT)\np.30: 搭列車(commuter)需要coupon(-capone) [-capone抑制COMT]\np.30: 頭(Tol-)很大(Enta-)，穿衣服卡繃(-capone)",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Oxymetazoline",
    "category": "神經/精神科 > 擬交感神經藥物 > α致效劑",
    "mechanism": "α受器致效，以α1>α2為主",
    "indications": "治鼻塞、過敏性鼻炎；升壓劑、治心搏過速、散瞳、治鼻塞；治姿勢性低血壓；治陣發性心搏過速(PSVT)",
    "effects": "血管/括約肌收縮；阻斷時則血管與前列腺平滑肌放鬆；PDF重點：升壓劑、治心搏過速、散瞳、治鼻塞",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Muscarine",
    "category": "神經/精神科 > 膽鹼性致效劑 > 天然",
    "mechanism": "Muscarinic受器致效",
    "indications": "重症肌無力、青光眼、阿茲海默症或解抗膽鹼毒性（依藥物）",
    "effects": "阻斷M受器，減少腺體分泌與平滑肌收縮；可散瞳、心跳上升、支氣管擴張",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Acetylcholine",
    "category": "神經/精神科 > 膽鹼性致效劑 > 直接型",
    "mechanism": "Muscarinic與Nicotinic受器致效",
    "indications": "診斷氣喘；對心血管活性較高，治心搏過速",
    "effects": "阻斷M受器，減少腺體分泌與平滑肌收縮；可散瞳、心跳上升、支氣管擴張",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Acamprosate",
    "category": "神經/精神科 > 酒精用藥",
    "mechanism": "調節NMDA與GABA傳遞，降低戒酒渴求",
    "indications": "抗劑和GABAA 受體致效劑",
    "effects": "增強GABA-A抑制性傳導，鎮靜、抗焦慮、抗癲癇",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Docusate",
    "category": "腸胃科 > 瀉劑 > 軟便劑",
    "mechanism": "表面活性/保水作用，使水與脂肪混合軟化糞便",
    "indications": "瀉劑；將NH3轉變為水溶性氨有利排泄，改善；效快(水瀉)→；血鎂、水瀉",
    "effects": "依其機轉產生對應藥理作用；請搭配適應症與考點複習；PDF重點：抑制脂溶性維生素",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Cetirizine",
    "category": "自泌素 > Histamine > 第二代H1阻斷",
    "mechanism": "周邊H1受器反向致效/拮抗，不易過BBB",
    "indications": "氣喘/COPD、動暈、尿失禁、帕金森/EPS或散瞳（依藥物）",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "p.58: “他叮，那叮，離心”：他被叮(-tadine)，那裡被叮(-nadine)，抽個血離心(-rizine)看有沒有瘧原蟲感 染",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Dacarbazine",
    "category": "血液腫瘤科 > 抗癌 > 其他化療",
    "mechanism": "Dacarbazine/Procarbazine為DNA烷化/甲基化；Etoposide抑制topoisomerase II",
    "indications": "Vinblastine、(作用於Guanine 的；轉移型大腸癌；乳癌",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Dasatinib",
    "category": "風濕免疫/腫瘤 > 標靶治療 > Bcr-Abl TKI",
    "mechanism": "抑制Bcr-Abl tyrosine kinase",
    "indications": "特定癌症或腫瘤標靶治療",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "p.93: Becareful!(Bcr)姨媽(Ima)大殺(Dasa)你囉!(Nilo)",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Carfilzomib",
    "category": "風濕免疫/腫瘤 > 標靶治療 > Proteasome抑制",
    "mechanism": "抑制26S proteasome，促進腫瘤細胞凋亡",
    "indications": "治療 multiple myeloma",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Fingolimod",
    "category": "風濕免疫科 > 免疫調節 > S1P受器",
    "mechanism": "S1P受器功能性拮抗，將淋巴球滯留於淋巴結",
    "indications": "未在PDF同列明確標示；依分類臨床適應症複習",
    "effects": "阻斷對應受器或通道，降低該路徑效應；PDF重點：→使周邊血液和神經中的淋巴細胞數目下降",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Alemtuzumab",
    "category": "風濕免疫科 > 生物製劑 > Anti-CD52",
    "mechanism": "抗CD52單株抗體，造成成熟淋巴球耗竭",
    "indications": "未在PDF同列明確標示；依分類臨床適應症複習",
    "effects": "依其機轉產生對應藥理作用；請搭配適應症與考點複習",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Saxagliptin",
    "category": "內分泌/新陳代謝 > 糖尿病 > DPP-4抑制",
    "mechanism": "抑制DPP-4，延長內生性GLP-1/GIP作用",
    "indications": "糖尿病血糖控制",
    "effects": "降低血糖或改善胰島素/腸泌素/腎糖排出路徑",
    "mnemonic": "p.75: 他的前女友Ena(exena)，幫他LP注射，使LP變大(great LP🡺GLP-1)，然後就拿蛤蜊不停(- gliptin)地丟民進黨(DPP-4)抗議侵害大LP(抑制DPP分解GLP)\np.75: -gliptin: GLP-1不停,所以是抑制DPP分解",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Sitagliptin",
    "category": "內分泌/新陳代謝 > 糖尿病 > DPP-4抑制",
    "mechanism": "抑制DPP-4，延長內生性GLP-1/GIP作用",
    "indications": "糖尿病血糖控制",
    "effects": "降低血糖或改善胰島素/腸泌素/腎糖排出路徑",
    "mnemonic": "p.75: 他的前女友Ena(exena)，幫他LP注射，使LP變大(great LP🡺GLP-1)，然後就拿蛤蜊不停(- gliptin)地丟民進黨(DPP-4)抗議侵害大LP(抑制DPP分解GLP)\np.75: -gliptin: GLP-1不停,所以是抑制DPP分解",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Pioglitazone",
    "category": "內分泌/新陳代謝 > 糖尿病 > TZD",
    "mechanism": "活化PPARγ，增加insulin sensitivity與GLUT4作用",
    "indications": "糖尿病血糖控制",
    "effects": "降低血糖或改善胰島素/腸泌素/腎糖排出路徑",
    "mnemonic": "p.75: Papa(活化PPARγ)把蛤蜊太熟(-glitazone)沒人要吃，就過剩了(英，glut，增加GLUT-4 R)",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Losartan",
    "category": "心臟科 > 降血壓 > ARB",
    "mechanism": "阻斷Angiotensin II AT1受器；Saralasin為部分致效",
    "indications": "高血壓、心衰竭、糖尿病腎病變等RAAS適應症",
    "effects": "ARB：阻斷AT1受器，降低Ang II造成的血管收縮與醛固酮作用；較少咳嗽",
    "mnemonic": "p.49: Airbus(ARB)很大台，所以在要沙灘(-sartan)旁的大機場才能降落，然後Sara常在那等老公 的飛機降落，心被拉著(拉心)(saralasin)\np.49: 阿北(ARB)殺氣騰騰(-sartan)\np.49: 這是一個打怪的故事： 第一關：怪物是愛斯基摩人(Aliskiren)因為是人所以造成畸胎(SE)。 第二關：怪物是屁怪(-pril)，會放屁攻擊你造成咳嗽(SE)。 BOSS關：怪物是撒旦(-sartan)，因為撒旦太強，所以無皮保護作用(特性)",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Hydroxocobalamin",
    "category": "毒物學 > Cyanide解毒",
    "mechanism": "結合cyanide形成cyanocobalamin",
    "indications": "中毒或重金屬暴露之解毒/螯合治療",
    "effects": "結合毒物/重金屬或繞過毒性路徑以促進排除",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Thiamine",
    "category": "神經/精神科 > 酒精用藥",
    "mechanism": "補充維生素B1，預防/治療Wernicke-Korsakoff",
    "indications": "高血壓；部分用於心衰竭、腎保護或心絞痛",
    "effects": "增強GABA-A抑制性傳導，鎮靜、抗焦慮、抗癲癇",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "C",
    "drawWeight": 4
  },
  {
    "name": "Morphine",
    "category": "神經/精神科 > 類鴉片止痛劑 > 強效μ致效",
    "mechanism": "μ-opioid受器致效（Gi）：抑制Ca2+內流、促進K+外流",
    "indications": "止痛、麻醉(提高痛覺閾值、活化止；治急性肺水腫(+Nitrate、利尿",
    "effects": "調節鈣離子通道/骨代謝/血管平滑肌收縮；PDF重點：止痛、麻醉(提高痛覺閾值、活化止；外流↑，活化Chemoreceptor trigger",
    "mnemonic": "p.31: 羅賓(Ropin)怕門被鎖(pramipexole)起來，看見裸體夠挺(rotigotine)，然後啊被潑墨 (apomorphine)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Tigecycline",
    "category": "感染科 > 抗生素 > Glycylcycline",
    "mechanism": "結合30S，阻止tRNA進入A site，克服部分四環素抗藥性",
    "indications": "Doxy-、Mino-、Tige-可用於腎功能不良者",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "p.109: 短：四周環海( Tetracyclines)很廣，海中含鈣→影響鈣的組織(骨頭，牙齒) 中：梅杜莎(Methacycline)的米(Demeclocycline) 長：都市(Doxycycline)小(Minocycline)老虎(Tigecycline)；糯米(Mino)很油(脂溶性高，吸收不 易受食物干擾)，要多洗(Doxy)幾次→所以是長效的",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Demeclocycline",
    "category": "心臟科 > 利尿劑 > ADH作用抑制",
    "mechanism": "在腎集合管拮抗ADH作用，減少水分再吸收",
    "indications": "高血壓、水腫、心衰竭或特定電解質異常（依藥物）",
    "effects": "增加尿鈉/水排出，依部位影響K、Ca、Mg與酸鹼",
    "mnemonic": "p.109: 短：四周環海( Tetracyclines)很廣，海中含鈣→影響鈣的組織(骨頭，牙齒) 中：梅杜莎(Methacycline)的米(Demeclocycline) 長：都市(Doxycycline)小(Minocycline)老虎(Tigecycline)；糯米(Mino)很油(脂溶性高，吸收不 易受食物干擾)，要多洗(Doxy)幾次→所以是長效的",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Demeclocycline",
    "category": "感染科 > 抗生素 > Tetracyclines短/中效",
    "mechanism": "結合30S，阻止aminoacyl-tRNA進入A site",
    "indications": "Doxy-、Mino-、Tige-可用於腎功能不良者",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "p.109: 短：四周環海( Tetracyclines)很廣，海中含鈣→影響鈣的組織(骨頭，牙齒) 中：梅杜莎(Methacycline)的米(Demeclocycline) 長：都市(Doxycycline)小(Minocycline)老虎(Tigecycline)；糯米(Mino)很油(脂溶性高，吸收不 易受食物干擾)，要多洗(Doxy)幾次→所以是長效的",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Chloramphenicol",
    "category": "感染科 > 抗生素 > Amphenicol",
    "mechanism": "結合50S，抑制peptidyl transferase",
    "indications": "細菌感染治療（菌種依藥物光譜）",
    "effects": "抑制細菌細胞壁、蛋白質、核酸或葉酸代謝",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Dantrolene",
    "category": "麻醉科/毒物學 > 惡性高熱/肌鬆",
    "mechanism": "阻斷骨骼肌Ryanodine receptor，抑制SR釋放Ca2+",
    "indications": "惡性高溫( 治)(107-1)；@吸入性麻醉劑整理",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "p.19: 單戳冷 - 治惡性高溫\np.19: 等他冷 - 治惡性高溫",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Quinidine",
    "category": "心臟科 > 抗心律不整 > Class IA",
    "mechanism": "阻斷Na+通道並延長再極化；兼具K+通道阻斷",
    "indications": "心律不整治療",
    "effects": "抑制電位依賴性鈉通道，降低神經或心肌興奮性",
    "mnemonic": "p.54: A咖：貴族、抑制phase0：中(因為貴族通常很中庸)、QT：延長(貴族可以最長)\np.54: 皇后(Quinidine)老了會骨骼肌鬆弛(SE)；王子(Procainamide)年輕會臉紅(SE:Lupus like syndrome)\np.54: Na個 no MAKe up(anti-M,alpha,K+)皇后(quinidine)宣稱(procain-)Diso金字塔 (pyramide)是一等A級的",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Naloxone",
    "category": "毒物學 > 解毒劑",
    "mechanism": "Opioid受器競爭性拮抗",
    "indications": "中毒或重金屬暴露之解毒/螯合治療",
    "effects": "結合毒物/重金屬或繞過毒性路徑以促進排除",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Naloxone",
    "category": "神經/精神科 > 類鴉片解毒/戒斷",
    "mechanism": "競爭性opioid受器拮抗，急性解毒",
    "indications": "治療急性鴉片過度使用(解毒/脫癮)；解毒、戒癮(酒癮)，少用(易產生強烈戒斷症狀)",
    "effects": "結合毒物/重金屬或繞過毒性路徑以促進排除",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Minocycline",
    "category": "感染科 > 抗生素 > Tetracyclines長效",
    "mechanism": "結合30S，阻止aminoacyl-tRNA進入A site",
    "indications": "細菌感染治療（菌種依藥物光譜）",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "p.109: 短：四周環海( Tetracyclines)很廣，海中含鈣→影響鈣的組織(骨頭，牙齒) 中：梅杜莎(Methacycline)的米(Demeclocycline) 長：都市(Doxycycline)小(Minocycline)老虎(Tigecycline)；糯米(Mino)很油(脂溶性高，吸收不 易受食物干擾)，要多洗(Doxy)幾次→所以是長效的",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Phenobarbital",
    "category": "神經/精神科 > 抗焦慮/鎮靜安眠 > Barbiturates",
    "mechanism": "GABA_A受器正向變構調節；延長Cl-通道開啟時間，高劑量可直接開啟",
    "indications": "治療癲癇發作；耐藥性、生理依賴性(戒斷症狀嚴重)；短效、純安眠，無鎮靜、解除焦慮效果",
    "effects": "增強GABA-A抑制性傳導，鎮靜、抗焦慮、抗癲癇",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Phenobarbital",
    "category": "神經/精神科 > 抗癲癇 > GABA_A增強",
    "mechanism": "增強GABA_A介導的Cl-內流",
    "indications": "治療癲癇發作；耐藥性、生理依賴性(戒斷症狀嚴重)；短效、純安眠，無鎮靜、解除焦慮效果",
    "effects": "增強GABA-A抑制性傳導，鎮靜、抗焦慮、抗癲癇",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Halothane",
    "category": "麻醉科 > 全身麻醉 > 吸入性鹵化麻醉劑",
    "mechanism": "增強GABA_A/甘胺酸等抑制性通道並抑制興奮性傳遞，造成全身麻醉",
    "indications": "止痛弱；肌肉鬆弛佳、麻醉效果好；惡性高溫(Dantrolene 治)(107-1)",
    "effects": "增強GABA-A抑制性傳導，鎮靜、抗焦慮、抗癲癇；PDF重點：止痛弱；心臟抑制、低血壓、心律不整",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Triazolam",
    "category": "神經/精神科 > 抗焦慮/鎮靜安眠 > Benzodiazepines",
    "mechanism": "GABA_A受器正向變構調節；增加Cl-通道開啟頻率",
    "indications": "加強GABA 作用於GABAA-R (增加Cl-通道；容易產生反彈性失眠；成癮性、戒斷症狀較明顯",
    "effects": "增強GABA-A抑制性傳導，鎮靜、抗焦慮、抗癲癇；PDF重點：加強GABA 作用於GABAA-R (增加Cl-通道",
    "mnemonic": "p.21: 我打走(midazolam)踹走(Triazolam)牛 Temazepam、長Flurazepam) (ox-) ： (2)抗痙攣(Clonazepam) 被術前打鎮定劑的時候因為不想手術，所以我打 (3)中樞性骨骼肌鬆弛劑(Diazepam) 走 (midazolam) 醫生。 (4)急性酒精戒斷治療(Dia-、Oxa-、\np.21: 踹走(Triazolam)牛(ox-)的時候會被牛反彈 Lora-、Chlordiazepoxide) (SE：反彈性失眠) 4. 解毒劑：Flumazenil (麻醉後輔助清醒-\np.21: 都是女生的名字： 6. onset速度： 歐普拉(alpra-)、蘿拉(Lora-)、伊斯塔 Triazolam>Diazepam>Chlordiazepoxide> (Esta-)、提瑪(tema-)會俘虜你(fluni-)的 Oxazapam、Lorazepam、Temazapam 心 (106-2)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Fentanyl",
    "category": "神經/精神科 > 類鴉片止痛劑 > 強效μ致效",
    "mechanism": "μ-opioid受器致效（Gi）：抑制Ca2+內流、促進K+外流",
    "indications": "可做靜脈注射麻醉劑",
    "effects": "調節鈣離子通道/骨代謝/血管平滑肌收縮；PDF重點：中毒：針狀瞳孔、呼吸抑制、昏迷、低血壓",
    "mnemonic": "p.44: (Eto-)會吐(台)，副作用會吐",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Cefamandole",
    "category": "感染科 > 抗生素 > Cephalosporin第二代",
    "mechanism": "β-lactam；抑制PBP/細胞壁合成",
    "indications": "抗流感嗜血桿菌(112-2)",
    "effects": "抑制細菌細胞壁、蛋白質、核酸或葉酸代謝",
    "mnemonic": "p.105: 泰坦(Cefotetan)的剋星(Cefoxitin)是曼陀珠(Cefamandole)，他赴樓新(Cefuroxime)，結果沒帶鎖\np.106: • 泰坦(Cefotetan)與曼陀珠(Cefamandole)喝酒，但巴拉松(Cefoperazone)沒帶鎖(Cefmatazole)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Cefotetan",
    "category": "感染科 > 抗生素 > Cephalosporin第二代",
    "mechanism": "β-lactam；抑制PBP/細胞壁合成",
    "indications": "細菌感染治療（菌種依藥物光譜）",
    "effects": "抑制細菌細胞壁、蛋白質、核酸或葉酸代謝",
    "mnemonic": "p.105: 泰坦(Cefotetan)的剋星(Cefoxitin)是曼陀珠(Cefamandole)，他赴樓新(Cefuroxime)，結果沒帶鎖\np.106: • 泰坦(Cefotetan)與曼陀珠(Cefamandole)喝酒，但巴拉松(Cefoperazone)沒帶鎖(Cefmatazole)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Succinylcholine",
    "category": "麻醉科 > 神經肌肉阻斷劑 > 去極化",
    "mechanism": "Nm受器致效造成持續去極化，進而阻斷神經肌肉傳遞",
    "indications": "快速插管與短效骨骼肌鬆弛",
    "effects": "去極化型Nm受器致效，先肌束顫動後麻痺；注意高血鉀、惡性高熱與pseudocholinesterase缺乏",
    "mnemonic": "p.19: Mivacurium和Succinylcholine不可用AchEi藥物解毒：米娃很會吸(suck)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Cortisol",
    "category": "內分泌/新陳代謝 > 腎上腺皮質醇 > 短效Glucocorticoid",
    "mechanism": "活化glucocorticoid receptor，抑制發炎與免疫反應",
    "indications": "發炎/免疫疾病、腎上腺功能異常或替代治療",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號；PDF重點：免疫抑制時用(移植)",
    "mnemonic": "p.74: 在美堤河濱公園打炮碰碰碰(Metyrapone)，可降低Aldosterone,cortisol，但androgen 上升(性慾增強)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Aztreonam",
    "category": "感染科 > 抗生素 > Monobactam",
    "mechanism": "β-lactam；抑制Gram-negative PBP/細胞壁合成",
    "indications": "對βlactamase 有阻抗性，只對G(-)嗜氧菌有效；較少過敏→Penicillin 過敏且G(-)感染首選用藥",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "p.106: 孤單(Monobactams)的哈特利(Aztreonam)心情不好(negative)G(-)，需要氧氣(嗜氧菌)🡺只對嗜氧G(-)有用 β lactam Carbapenems",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Chlorpromazine",
    "category": "神經/精神科 > 抗精神病 > 傳統/典型",
    "mechanism": "D2受器拮抗",
    "indications": "抗D2-R：EPS、parkinsonism、遲發性運；治打嗝；抗M1：口乾、便祕、尿滯留、視野模糊、抗",
    "effects": "調節多巴胺傳導，影響精神症狀、EPS、泌乳或帕金森症狀；PDF重點：鎮靜作用最強；動不能、Prolactin↑(高泌乳血症、月經失",
    "mnemonic": "p.28: 中空的(Halo)車籠埔(chlorpromazine)易地震\np.28: 傳統分兩群： 第一群：姑婆媽(Chlorpromazine)是雷達 (Thioridazine)，專門製造謠言，所以副作用很多(M1/H1/α1 blocker) 第二群：哈囉陪你度 (Haloperidol) 過流感飛那時(Fluphenazine)，副作用是EPS。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Chlorpromazine",
    "category": "腸胃科 > 止吐 > D2阻斷",
    "mechanism": "D2受器拮抗，抑制CTZ",
    "indications": "治動暈；治化療引起之嘔吐(107-",
    "effects": "調節多巴胺傳導，影響精神症狀、EPS、泌乳或帕金森症狀；PDF重點：5-HT3 阻斷(109-1)",
    "mnemonic": "p.28: 中空的(Halo)車籠埔(chlorpromazine)易地震\np.28: 傳統分兩群： 第一群：姑婆媽(Chlorpromazine)是雷達 (Thioridazine)，專門製造謠言，所以副作用很多(M1/H1/α1 blocker) 第二群：哈囉陪你度 (Haloperidol) 過流感飛那時(Fluphenazine)，副作用是EPS。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Cefoxitin",
    "category": "感染科 > 抗生素 > Cephalosporin第二代",
    "mechanism": "β-lactam；抑制PBP/細胞壁合成",
    "indications": "細菌感染治療（菌種依藥物光譜）",
    "effects": "抑制細菌細胞壁、蛋白質、核酸或葉酸代謝；PDF重點：抑制transglycosylase(與D-Ala-D-Ala 結合)(106-2)",
    "mnemonic": "p.105: 泰坦(Cefotetan)的剋星(Cefoxitin)是曼陀珠(Cefamandole)，他赴樓新(Cefuroxime)，結果沒帶鎖",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Amphetamine",
    "category": "神經/精神科 > 擬交感神經藥物 > 間接型",
    "mechanism": "促進NE、Epi、DA釋放並抑制MAO",
    "indications": "休克、低血壓、氣喘/支氣管痙攣或其他交感適應症（依受器）",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）；PDF重點：BP↑HR↑(不適用心血管疾病；抑制MAO",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Perchlorate",
    "category": "內分泌/新陳代謝 > 甲狀腺 > 碘攝取抑制",
    "mechanism": "競爭性抑制甲狀腺NIS碘離子攝取",
    "indications": "甲狀腺功能亢進/低下或甲狀腺風暴",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號；PDF重點：競爭transporter 結合位，阻斷；抑制T4→T3、抑制交感興奮",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Protamine sulfate",
    "category": "毒物學 > 解毒劑",
    "mechanism": "陽離子蛋白，結合並中和heparin",
    "indications": "Oxidizing agents(nitrogen oxides 心衰竭、心絞痛、癌症；Digoxin 中毒 (112-1) (不適合使用血液透析解毒)；Lidocaine…等抗心律不整藥；Digoxin 抗體",
    "effects": "結合毒物/重金屬或繞過毒性路徑以促進排除",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Delta-9-tetrahydrocannabinol",
    "category": "神經/精神科 > 成癮物質/藥物",
    "mechanism": "CB1受器部分致效，促進中腦邊緣DA活性",
    "indications": "作用：增加食慾、緩解疼痛、減少噁心、欣快感(107-1)；作用於ion channel",
    "effects": "活化對應受器，產生受器相關生理效應；PDF重點：作用：增加食慾、緩解疼痛、減少噁心、欣快感(107-1)；增加Glu 釋放到大腦皮",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Modafinil",
    "category": "神經/精神科 > 擬交感神經藥物 > 間接型",
    "mechanism": "抑制NE、DA再回收",
    "indications": "治Narcolepsy (107-1)",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）；PDF重點：阻斷NE、DA 回收",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Hydralazine",
    "category": "心臟科 > 降血壓 > 直接血管擴張",
    "mechanism": "增加NO/cGMP相關血管舒張，主要擴張小動脈",
    "indications": "高血壓；部分用於心衰竭、腎保護或心絞痛",
    "effects": "依其機轉產生對應藥理作用；請搭配適應症與考點複習；PDF重點：非NO→cGMP↑",
    "mnemonic": "p.50: 嗨!抓拉親(hydra-)🡺抓完會紅紅的(會LPS) <部分改自Sarah同學>\np.50: 一句話：還抓奶頭?!!NO!!!",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Cilastatin",
    "category": "感染科 > 抗生素 > Dehydropeptidase抑制",
    "mechanism": "抑制腎臟dehydropeptidase I，避免imipenem分解",
    "indications": "細菌感染治療（菌種依藥物光譜）",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "p.107: 希拉蕊(Cilastatin)很有錢，要用我是i-pen(imipenem)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Clarithromycin",
    "category": "感染科 > 抗生素 > Macrolides",
    "mechanism": "結合50S 23S rRNA，抑制translocation",
    "indications": "Mycoplasma 首選；殺菌型",
    "effects": "干擾DNA/RNA或細胞分裂，產生細胞毒性；PDF重點：口服效果↑；殺菌型",
    "mnemonic": "p.110: 紅色(Erythromycin)的凱莉(Clarithromycin)變成奇怪(阿奇Azithromycin)的巨人(Macrolides)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Pirenzepine",
    "category": "神經/精神科 > 膽鹼性拮抗劑 > 胃腸Muscarinic阻斷",
    "mechanism": "選擇性M1受器阻斷，降低胃酸分泌",
    "indications": "降低胃酸分泌及腸胃蠕動；→治胃潰瘍；減少腸胃蠕動、作為止瀉藥",
    "effects": "阻斷M受器，減少腺體分泌與平滑肌收縮；可散瞳、心跳上升、支氣管擴張；PDF重點：降低胃酸分泌及腸胃蠕動；減少腸胃蠕動、作為止瀉藥",
    "mnemonic": "p.17: 因為有胃潰瘍，所以派忍者排(Pirenzepine)隊買很厲害的鍋子(Propan-) 6. 升體溫 (-theline就是隊伍)，才可以煮健康的食物緩解胃潰瘍\np.17: 壞人(piren)玻片(propan)🡺幹太多壞事壓力大而胃潰瘍",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Clarithromycin",
    "category": "腸胃科 > H. pylori用藥",
    "mechanism": "抗H. pylori抗生素；常與PPI/鉍劑併用",
    "indications": "GERD、消化性潰瘍、胃酸過多或H. pylori輔助治療",
    "effects": "抑制胃酸分泌",
    "mnemonic": "p.110: 紅色(Erythromycin)的凱莉(Clarithromycin)變成奇怪(阿奇Azithromycin)的巨人(Macrolides)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Pirenzepine",
    "category": "腸胃科 > 消化性潰瘍 > M1阻斷",
    "mechanism": "選擇性M1受器阻斷，降低胃酸分泌",
    "indications": "專一block M1 (不抗M3，故不便秘)；治Zollinger-Ellison syndrome(胃泌素瘤)首選；酸性下作用佳，故不與制酸劑及其他抗胃酸藥合用；首選用藥",
    "effects": "阻斷對應受器或通道，降低該路徑效應；PDF重點：效持久、不可逆抑制 H+/K+ ATPase (106-1)",
    "mnemonic": "p.17: 因為有胃潰瘍，所以派忍者排(Pirenzepine)隊買很厲害的鍋子(Propan-) 6. 升體溫 (-theline就是隊伍)，才可以煮健康的食物緩解胃潰瘍\np.17: 壞人(piren)玻片(propan)🡺幹太多壞事壓力大而胃潰瘍",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Cyproterone",
    "category": "內分泌/新陳代謝 > 性激素 > Antiandrogen",
    "mechanism": "Androgen receptor拮抗並抑制LH/FSH",
    "indications": "治療男性性慾過強(107-1)",
    "effects": "阻斷對應受器或通道，降低該路徑效應；PDF重點：抑制androgen Receptor 生成負回饋抑制LH&FSH",
    "mnemonic": "p.78: 因為性慾太強(降低性慾)🡺所以脅迫他人(cyproterone)\np.78: 塞婆打人(Cyproterone)，男生看到都不會有性慾了(降低性慾)\np.78: 林秉樞在他媽的(-tamide)喪禮後脅迫他人(cyproterone)，俘虜(Flu-)高嘉瑜，揍她揍到掰咖 (bica-)，嚇得她屁滾尿流(利尿劑Spironolactone)，真不配當男人(androgen blocker)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Thiothixene",
    "category": "神經/精神科 > 抗精神病 > 傳統/典型",
    "mechanism": "D2受器拮抗",
    "indications": "dentrolene 解毒",
    "effects": "調節多巴胺傳導，影響精神症狀、EPS、泌乳或帕金森症狀",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Probenecid",
    "category": "風濕免疫科 > 痛風 > 促尿酸排泄",
    "mechanism": "抑制近曲小管尿酸再吸收，增加尿酸排泄",
    "indications": "慢性降尿酸",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號；PDF重點：抑制腎小管對尿酸的再吸收；→尿酸排泄↑",
    "mnemonic": "p.86: 蘇菲(sulfin-)開benz(benzbro-)走進一家利息很pro(高)的bank(probenecid)，尿尿(-urinol) Anakinra 原本用於RA，抑制IL 1α and IL 1β的活性",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Mivacurium",
    "category": "麻醉科 > 神經肌肉阻斷劑 > 非去極化",
    "mechanism": "競爭性Nm受器拮抗，阻斷骨骼肌神經肌肉傳遞",
    "indications": "氣喘/COPD、動暈、尿失禁、帕金森/EPS或散瞳（依藥物）",
    "effects": "阻斷對應受器或通道，降低該路徑效應",
    "mnemonic": "p.19: Mivacurium和Succinylcholine不可用AchEi藥物解毒：米娃很會吸(suck)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Neomycin",
    "category": "感染科 > 抗生素 > Aminoglycosides",
    "mechanism": "不可逆結合30S，造成mRNA誤讀並抑制起始複合體",
    "indications": "細菌感染治療（菌種依藥物光譜）",
    "effects": "干擾DNA/RNA或細胞分裂，產生細胞毒性",
    "mnemonic": "p.108: 尼歐(Neomycin)好像(台語，Kanamycin)歌星(Amikacin)🡺喇叭太大聲影響聽力",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Meperidine",
    "category": "神經/精神科 > 類鴉片止痛劑 > 強效μ致效",
    "mechanism": "μ-opioid受器致效（Gi）：抑制Ca2+內流、促進K+外流",
    "indications": "中重度疼痛、止咳或鴉片戒斷/解毒（依藥物）",
    "effects": "調節鈣離子通道/骨代謝/血管平滑肌收縮",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Dapsone",
    "category": "感染科 > 抗痲瘋",
    "mechanism": "類似sulfonamide，抑制dihydropteroate synthase",
    "indications": "抗痲瘋",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號",
    "mnemonic": "p.115: That son(Dapsone)治不了痲瘋，call father治(Clofazi-，dapsone替代藥物)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Heroin",
    "category": "神經/精神科 > 類鴉片止痛劑 > 強效μ致效",
    "mechanism": "μ-opioid受器致效（Gi）：抑制Ca2+內流、促進K+外流",
    "indications": "Morphine 的戒斷控制(戒斷症狀輕；可做靜脈注射麻醉劑",
    "effects": "調節鈣離子通道/骨代謝/血管平滑肌收縮；PDF重點：腎功能↓、膽道括約肌收縮、histamine 釋放；縮瞳、便秘(112-2)",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Tacrolimus",
    "category": "風濕免疫科 > 免疫抑制 > Calcineurin抑制",
    "mechanism": "與FKBP12結合後抑制calcineurin，降低IL-2轉錄",
    "indications": "器官移植排斥預防/治療；亦用於自體免疫皮膚疾病",
    "effects": "與FKBP結合抑制calcineurin，↓IL-2與T細胞活化；腎毒性/神經毒性/糖尿病",
    "mnemonic": "p.87: 看到章魚圈圈(tacro-, cyclo-)就不餓(抑制IL-2)了",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Cefixime",
    "category": "感染科 > 抗生素 > Cephalosporin第三代",
    "mechanism": "β-lactam；抑制PBP/細胞壁合成",
    "indications": "細菌感染治療（菌種依藥物光譜）",
    "effects": "抑制細菌細胞壁、蛋白質、核酸或葉酸代謝",
    "mnemonic": "p.106: 淋病屌，吹阿爽(-triaxone)，想要小費?行!(-Cefixime)\np.106: 波多野結衣(cefpodoxime)說fuck me(cefixime)害我不能思考(進不到BBB)；她說：『吹爽(ceftriaxone)我 還有fuck me(cefixime)』結果看到有淋病(淋病藥首選)，我很兇的叫她立定(ceftazidime)結果綠膿流出來 (第三代唯一治綠膿)，她還說因為我吹爽(ceftriaxone)她，所以要付稅給我(cefotaxime)真是腦壞掉(治腦膜 炎)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Cefaclor",
    "category": "感染科 > 抗生素 > Cephalosporin第二代",
    "mechanism": "β-lactam；抑制PBP/細胞壁合成",
    "indications": "抗流感嗜血桿菌(112-2)",
    "effects": "抑制細菌細胞壁、蛋白質、核酸或葉酸代謝",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Selexipag",
    "category": "自泌素 > Eicosanoid > PGI2類似物/IP受器致效",
    "mechanism": "PGI2/IP受器致效，血管擴張並抑制血小板凝集",
    "indications": "發炎疼痛、氣喘、肺高壓或胃黏膜保護（依藥物）",
    "effects": "活化對應受器，產生受器相關生理效應",
    "mnemonic": "p.60: 姨婆(Epo-)在百貨一樓(ilo-)select包包(selexipag)，櫃姐吹捧 (Trepro-)她不像其他廢物(預防肺動脈高壓)一樣，是一位愛(PGI2)包達 人",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Nesiritide",
    "category": "心臟科 > 心衰竭 > Natriuretic peptide類似物",
    "mechanism": "BNP類似物，活化cGMP造成血管舒張與排鈉",
    "indications": "心衰竭症狀改善或預後治療",
    "effects": "依其機轉產生對應藥理作用；請搭配適應症與考點複習；PDF重點：增加血管平滑肌的cGMP(107-2)",
    "mnemonic": "p.52: 捏siri(Nesiritide)🡺可以放鬆心情🡺血管舒張\np.52: 拿書一路等，排拿特(排鈉肽) (大家國考的時候都會邊拿書邊排特色餐)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Azithromycin",
    "category": "感染科 > 抗生素 > Macrolides",
    "mechanism": "結合50S 23S rRNA，抑制translocation",
    "indications": "Mycoplasma 首選；殺菌型",
    "effects": "干擾DNA/RNA或細胞分裂，產生細胞毒性",
    "mnemonic": "p.110: 紅色(Erythromycin)的凱莉(Clarithromycin)變成奇怪(阿奇Azithromycin)的巨人(Macrolides)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Primaquine",
    "category": "感染科 > 抗蟲 > 抗瘧",
    "mechanism": "產生活性氧，殺滅肝內休眠子/配子體",
    "indications": "預防；抗性惡性瘧；可用於孕婦",
    "effects": "依蟲種破壞寄生蟲神經肌肉/微管或代謝，使蟲體麻痺或死亡；PDF重點：低血糖",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Dobutamine",
    "category": "神經/精神科 > 擬交感神經藥物 > β1致效劑",
    "mechanism": "β1受器致效，增加心肌收縮力",
    "indications": "急性心衰竭/心因性休克之強心支持",
    "effects": "β1致效為主，增加心收縮力且相對較少增加心率",
    "mnemonic": "p.11: 第1的Bra(β1 agonist)才有資格多婊她們(Dobutam-)\np.11: 都不(Dobutam-)揪啊，play one(β1)\np.11: 多補他命-->強心-->所以是β1",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Tyramine",
    "category": "神經/精神科 > 擬交感神經藥物 > 間接型",
    "mechanism": "促進NE釋放；與MAOI併用可造成高血壓危象",
    "indications": "休克、低血壓、氣喘/支氣管痙攣或其他交感適應症（依受器）",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "p.57: 這是一個討人厭的學霸故事~ 學霸已經第二名(tyramine)前測170(sevelam)還是覺得自己太破了(tipol)，所以打算結合(和膽酸結合)第一 名，這樣下去大家都不用維生了(降低維生素吸收)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Biperiden",
    "category": "神經/精神科 > 抗帕金森 > 抗膽鹼",
    "mechanism": "中樞M受器阻斷，改善震顫與僵硬",
    "indications": "氣喘/COPD、動暈、尿失禁、帕金森/EPS或散瞳（依藥物）",
    "effects": "阻斷M受器，減少腺體分泌與平滑肌收縮；可散瞳、心跳上升、支氣管擴張；PDF重點：Parkinson 的人，在Benz(三角的標誌→trihexyphenidyl)上讀白皮書(biperi-)，來抑制疼痛(Ache)；(trihexy-)的名牌benz 車(benzt-)來開，結果突然一個Ach 低下(Ach↓)就車禍變bedridden",
    "mnemonic": "p.18: 踹狠心肥弟(Trihexy-phenidyl)，揍完屁弟之後(治PD) 開Benz去買抓餅(Benz-tropine)， 兩個小弟陪你等\np.32: 有一個孤兒orphan(orphen-)，他很會騎自行車(procycli-)，但他卻買了logo有三個六角形 (trihexy-)的名牌benz車(benzt-)來開，結果突然一個Ach低下(Ach↓)就車禍變bedridden (biperiden)。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Trihexyphenidyl",
    "category": "神經/精神科 > 抗帕金森 > 抗膽鹼",
    "mechanism": "中樞M受器阻斷，改善震顫與僵硬",
    "indications": "氣喘/COPD、動暈、尿失禁、帕金森/EPS或散瞳（依藥物）",
    "effects": "阻斷M受器，減少腺體分泌與平滑肌收縮；可散瞳、心跳上升、支氣管擴張",
    "mnemonic": "p.18: 踹狠心肥弟(Trihexy-phenidyl)，揍完屁弟之後(治PD) 開Benz去買抓餅(Benz-tropine)， 兩個小弟陪你等\np.32: Parkinson的人，在Benz(三角的標誌🡺trihexyphenidyl)上讀白皮書(biperi-)，來抑制疼痛(Ache)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Biperiden",
    "category": "神經/精神科 > 抗帕金森 > 抗膽鹼藥",
    "mechanism": "中樞Muscarinic受器阻斷，降低相對過高之ACh活性",
    "indications": "氣喘/COPD、動暈、尿失禁、帕金森/EPS或散瞳（依藥物）",
    "effects": "阻斷M受器，減少腺體分泌與平滑肌收縮；可散瞳、心跳上升、支氣管擴張；PDF重點：Parkinson 的人，在Benz(三角的標誌→trihexyphenidyl)上讀白皮書(biperi-)，來抑制疼痛(Ache)；(trihexy-)的名牌benz 車(benzt-)來開，結果突然一個Ach 低下(Ach↓)就車禍變bedridden",
    "mnemonic": "p.18: 踹狠心肥弟(Trihexy-phenidyl)，揍完屁弟之後(治PD) 開Benz去買抓餅(Benz-tropine)， 兩個小弟陪你等\np.32: 有一個孤兒orphan(orphen-)，他很會騎自行車(procycli-)，但他卻買了logo有三個六角形 (trihexy-)的名牌benz車(benzt-)來開，結果突然一個Ach低下(Ach↓)就車禍變bedridden (biperiden)。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Trihexyphenidyl",
    "category": "神經/精神科 > 抗帕金森 > 抗膽鹼藥",
    "mechanism": "中樞Muscarinic受器阻斷，降低相對過高之ACh活性",
    "indications": "氣喘/COPD、動暈、尿失禁、帕金森/EPS或散瞳（依藥物）",
    "effects": "阻斷M受器，減少腺體分泌與平滑肌收縮；可散瞳、心跳上升、支氣管擴張",
    "mnemonic": "p.18: 踹狠心肥弟(Trihexy-phenidyl)，揍完屁弟之後(治PD) 開Benz去買抓餅(Benz-tropine)， 兩個小弟陪你等\np.32: Parkinson的人，在Benz(三角的標誌🡺trihexyphenidyl)上讀白皮書(biperi-)，來抑制疼痛(Ache)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Trimethaphan",
    "category": "神經/精神科 > 膽鹼性拮抗劑 > 神經節阻斷",
    "mechanism": "Nn nicotinic受器阻斷，抑制自律神經節傳遞",
    "indications": "口服戒菸降血壓",
    "effects": "阻斷對應受器或通道，降低該路徑效應；PDF重點：口服戒菸降血壓",
    "mnemonic": "p.19: 要阻止尼古丁傳宗接代(阻斷nicotinic receptor)：趁沒camera(mecamyla)，踹梅莎(trimetho)，讓 她害喜(hexa)🡺梅莎就BP低、暈倒了(姿勢性低血壓)\np.19: 比賽剩6(Hexa-)分鐘時，Try沒3分(trimethaphan)沒差(meca-)\np.19: 踹(Tri)我腳(Meca台語)六次(hexa)，幹(gamglion阻斷劑)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Mesna",
    "category": "血液腫瘤科 > 抗癌 > 保護劑",
    "mechanism": "結合acrolein，預防cyclophosphamide/ifosfamide出血性膀胱炎",
    "indications": "出血性膀胱炎→ 解",
    "effects": "依其機轉產生對應藥理作用；請搭配適應症與考點複習",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Goserelin",
    "category": "內分泌/新陳代謝 > 性激素 > GnRH agonist",
    "mechanism": "持續刺激GnRH受器使LH/FSH下降",
    "indications": "緩解子宮內膜異位",
    "effects": "活化對應受器，產生受器相關生理效應",
    "mnemonic": "p.78: 顧搓(台語)(Goser-)脫皮(台)(Leupro-)：要促進GnRH，所以一直 GnRH走GPCR，(112-1) 搓、顧著搓、搓到脫皮還在搓，至於搓什麼我就不知道了",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Ganirelix",
    "category": "內分泌/新陳代謝 > 性激素 > GnRH antagonist",
    "mechanism": "GnRH受器拮抗，使LH/FSH下降",
    "indications": "避孕、荷爾蒙替代、癌症內分泌治療或生殖相關適應症",
    "effects": "活化對應受器，產生受器相關生理效應",
    "mnemonic": "p.78: -reli”x”，打叉叉，所以是抑制劑(antagonist)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Imipenem",
    "category": "感染科 > 抗生素 > Carbapenem",
    "mechanism": "β-lactam；抑制PBP/細胞壁合成，廣效",
    "indications": "高血壓；部分用於心衰竭、腎保護或心絞痛",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "p.107: 希拉蕊(Cilastatin)很有錢，要用我是i-pen(imipenem)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Cefmetazole",
    "category": "感染科 > 抗生素 > Cephalosporin第二代",
    "mechanism": "β-lactam；抑制PBP/細胞壁合成",
    "indications": "細菌感染治療（菌種依藥物光譜）",
    "effects": "抑制細菌細胞壁、蛋白質、核酸或葉酸代謝",
    "mnemonic": "p.106: 因為疫情的關係，男人都(-man-dole) 薪停(-xitin)只能穿破徙(-proxil)，只吃鐵蛋(-tetan)果腹瘦成骷 髏(-clor)，對肉食糜(-roxime)的慾望直衝腦門，外帶回家才發現沒帶鎖(-metazole)\np.116: 蓋地板(台語，起頭咖)(Ketoco-)對阿祖(-azole)來說是一種苦行(Cushing)，可以治Cushing syndrome\np.116: 阿祖(-azole)看到爛(lanosterol)人很不爽，他踢他屁屁(P450)，剁他耳朵(ergosterol)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Methacycline",
    "category": "感染科 > 抗生素 > Tetracyclines短/中效",
    "mechanism": "結合30S，阻止aminoacyl-tRNA進入A site",
    "indications": "Doxy-、Mino-、Tige-可用於腎功能不良者",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "p.109: 短：四周環海( Tetracyclines)很廣，海中含鈣→影響鈣的組織(骨頭，牙齒) 中：梅杜莎(Methacycline)的米(Demeclocycline) 長：都市(Doxycycline)小(Minocycline)老虎(Tigecycline)；糯米(Mino)很油(脂溶性高，吸收不 易受食物干擾)，要多洗(Doxy)幾次→所以是長效的",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Estazolam",
    "category": "神經/精神科 > 抗焦慮/鎮靜安眠 > Benzodiazepines",
    "mechanism": "GABA_A受器正向變構調節；增加Cl-通道開啟頻率",
    "indications": "焦慮、失眠、鎮靜、抗癲癇或麻醉誘導（依藥物）",
    "effects": "增強GABA-A抑制性傳導，鎮靜、抗焦慮、抗癲癇",
    "mnemonic": "p.21: 都是女生的名字： 6. onset速度： 歐普拉(alpra-)、蘿拉(Lora-)、伊斯塔 Triazolam>Diazepam>Chlordiazepoxide> (Esta-)、提瑪(tema-)會俘虜你(fluni-)的 Oxazapam、Lorazepam、Temazapam 心 (106-2)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Felbamate",
    "category": "神經/精神科 > 抗癲癇 > NMDA拮抗/GABA增強",
    "mechanism": "阻斷NMDA受器並增強GABA傳遞",
    "indications": "氣喘/COPD、動暈、尿失禁、帕金森/EPS或散瞳（依藥物）",
    "effects": "增強GABA-A抑制性傳導，鎮靜、抗焦慮、抗癲癇；PDF重點：阻斷 NMDA-R、增強GABA 作；造成Stevens-Johnson syndrome：CBZ、Phenytoin、Ethosuximide、Lamotrigine",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Filgrastim",
    "category": "風濕免疫科 > 免疫增強劑",
    "mechanism": "G-CSF類似物，促進嗜中性球生成",
    "indications": "增加免疫；可以改善骨髓抑；原為抗蟲藥，後發現可促淋巴球",
    "effects": "促進神經傳遞物質或內分泌/代謝反應；PDF重點：增加免疫；化療後(嗜中性球↑)",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Sargramostim",
    "category": "風濕免疫科 > 免疫增強劑",
    "mechanism": "GM-CSF，促進粒/單核球生成",
    "indications": "原為抗蟲藥，後發現可促淋巴球",
    "effects": "促進神經傳遞物質或內分泌/代謝反應；PDF重點：球、巨噬細胞↑)",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Rasburicase",
    "category": "風濕免疫科 > 痛風 > Uricase",
    "mechanism": "Uricase類藥物，將尿酸代謝為較水溶性allantoin",
    "indications": "急性痛風、慢性高尿酸血症或腫瘤溶解症預防",
    "effects": "依其機轉產生對應藥理作用；請搭配適應症與考點複習",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Cabergoline",
    "category": "內分泌/新陳代謝 > 腦下垂體 > Dopamine致效",
    "mechanism": "D2受器致效，抑制prolactin釋放",
    "indications": "未在PDF同列明確標示；依分類臨床適應症複習",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Alendronate",
    "category": "內分泌/新陳代謝 > 骨鬆 > Bisphosphonates",
    "mechanism": "抑制osteoclast之farnesyl pyrophosphate synthase，降低骨吸收",
    "indications": "未在PDF同列明確標示；依分類臨床適應症複習",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Procainamide",
    "category": "心臟科 > 抗心律不整 > Class IA",
    "mechanism": "阻斷Na+通道並延長再極化；兼具K+通道阻斷",
    "indications": "心律不整治療",
    "effects": "抑制電位依賴性鈉通道，降低神經或心肌興奮性；PDF重點：舒張",
    "mnemonic": "p.54: A咖：貴族、抑制phase0：中(因為貴族通常很中庸)、QT：延長(貴族可以最長)\np.54: 皇后(Quinidine)老了會骨骼肌鬆弛(SE)；王子(Procainamide)年輕會臉紅(SE:Lupus like syndrome)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Bretylium",
    "category": "心臟科 > 抗心律不整 > Class III",
    "mechanism": "阻斷K+通道，延長phase 3與ERP",
    "indications": "長期服用降低AMI 死亡率",
    "effects": "阻斷對應受器或通道，降低該路徑效應；PDF重點：抑制NE 釋出；同時具classII、III、含強力β 阻斷活性(非選擇性)",
    "mnemonic": "p.55: 假的(K blocker) 阿喵(Amio-) 其實是Brety姐(Bretylium)，她一步踢來(Ibutilide)，都飛 踢(Dofeti-)， 求你(Drone-) ㄙㄡˊ她(Sota-，撫摸)的Vagina(Verna-) <取自高醫元廷藥理>",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Bretylium",
    "category": "神經/精神科 > 交感神經阻斷劑 > 交感神經末梢抑制",
    "mechanism": "抑制NE釋放；亦有第III類抗心律不整作用",
    "indications": "降血壓",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）；PDF重點：降血壓；抑制Tyrosine",
    "mnemonic": "p.55: 假的(K blocker) 阿喵(Amio-) 其實是Brety姐(Bretylium)，她一步踢來(Ibutilide)，都飛 踢(Dofeti-)， 求你(Drone-) ㄙㄡˊ她(Sota-，撫摸)的Vagina(Verna-) <取自高醫元廷藥理>",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Fluoride",
    "category": "內分泌/新陳代謝 > 骨鬆 > 促骨形成",
    "mechanism": "刺激osteoblast活性",
    "indications": "預防停經後婦女的骨質疏鬆；單株抗體",
    "effects": "依其機轉產生對應藥理作用；請搭配適應症與考點複習",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Bepridil",
    "category": "心臟科 > 抗心律不整 > Class IV",
    "mechanism": "阻斷L-type Ca2+通道，延長AV node傳導",
    "indications": "心律不整治療",
    "effects": "調節鈣離子通道/骨代謝/血管平滑肌收縮；PDF重點：沒人怕(Verapa-)泰山(-tiazem)，所以背不停()→心臟就太累不跳了(心臟抑制)",
    "mnemonic": "p.49: 沒人怕(Verapa-)泰山(-tiazem)，所以背不停(bepridil)🡺心臟就太累不跳了(心臟抑制)\np.55: 沒人怕(Verapa) 泰山(-tiazem)，一直要他背。所以他只好背人背不停(Bepridil)，搞到最後心 臟壞了(抑制心臟收縮, CCB) <取自高醫元廷藥理>",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Saralasin",
    "category": "心臟科 > 降血壓 > ARB",
    "mechanism": "阻斷Angiotensin II AT1受器；Saralasin為部分致效",
    "indications": "高血壓；部分用於心衰竭、腎保護或心絞痛",
    "effects": "降低RAAS作用，血管擴張、降醛固酮並保護心腎",
    "mnemonic": "p.49: Airbus(ARB)很大台，所以在要沙灘(-sartan)旁的大機場才能降落，然後Sara常在那等老公 的飛機降落，心被拉著(拉心)(saralasin)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Bepridil",
    "category": "心臟科 > 降血壓/CCB > Non-DHP",
    "mechanism": "阻斷L-type Ca2+通道，抑制心臟傳導並舒張冠狀動脈",
    "indications": "高血壓；部分用於心衰竭、腎保護或心絞痛",
    "effects": "調節鈣離子通道/骨代謝/血管平滑肌收縮；PDF重點：沒人怕(Verapa-)泰山(-tiazem)，所以背不停()→心臟就太累不跳了(心臟抑制)",
    "mnemonic": "p.49: 沒人怕(Verapa-)泰山(-tiazem)，所以背不停(bepridil)🡺心臟就太累不跳了(心臟抑制)\np.55: 沒人怕(Verapa) 泰山(-tiazem)，一直要他背。所以他只好背人背不停(Bepridil)，搞到最後心 臟壞了(抑制心臟收縮, CCB) <取自高醫元廷藥理>",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Ceftaroline",
    "category": "感染科 > 抗生素 > Cephalosporin第五代",
    "mechanism": "β-lactam；抑制PBP，對MRSA PBP2a有活性",
    "indications": "細菌感染治療（菌種依藥物光譜）",
    "effects": "抑制細菌細胞壁、蛋白質、核酸或葉酸代謝",
    "mnemonic": "p.106: 塔洛琳(Ceftaroline)大帝很強\np.106: 誰扶她蹂躪(ceftaroline)?我(5)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Sulfadiazine",
    "category": "感染科 > 抗生素 > Sulfonamide",
    "mechanism": "PABA類似物，競爭性抑制dihydropteroate synthase",
    "indications": "細菌感染治療（菌種依藥物光譜）",
    "effects": "抑制細菌細胞壁、蛋白質、核酸或葉酸代謝；PDF重點：抑菌型(+TMP=殺菌型)",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Pyrazinamide",
    "category": "感染科 > 抗結核 > 第一線",
    "mechanism": "轉為pyrazinoic acid，干擾脂肪酸/膜能量代謝",
    "indications": "高尿酸(痛風注意)",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Carbidopa",
    "category": "神經/精神科 > 抗帕金森 > 周邊DOPA decarboxylase抑制",
    "mechanism": "抑制周邊DOPA decarboxylase，使L-dopa在中樞作用並減少周邊副作用",
    "indications": "帕金森氏症或藥物誘發EPS",
    "effects": "降低RAAS作用，血管擴張、降醛固酮並保護心腎；PDF重點：僅周邊有效，抑制周邊組織",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Oxazepam",
    "category": "神經/精神科 > 抗焦慮/鎮靜安眠 > Benzodiazepines",
    "mechanism": "GABA_A受器正向變構調節；增加Cl-通道開啟頻率",
    "indications": "容易產生反彈性失眠；成癮性、戒斷症狀較明顯",
    "effects": "增強GABA-A抑制性傳導，鎮靜、抗焦慮、抗癲癇",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Ramelteon",
    "category": "神經/精神科 > 睡眠節律藥",
    "mechanism": "MT1/MT2褪黑激素受器致效",
    "indications": "安眠，作用於melatonin receptor(107-1)",
    "effects": "活化對應受器，產生受器相關生理效應",
    "mnemonic": "p.23: 辣模 舔(ramelteon)一舔，比較好睡(失眠用藥)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Bethanechol",
    "category": "神經/精神科 > 膽鹼性致效劑 > 直接型",
    "mechanism": "Muscarinic受器致效，促進膀胱與腸胃平滑肌收縮",
    "indications": "治腸麻痺、尿滯留(專一性佳只作用在；為交感控制)",
    "effects": "阻斷M受器，減少腺體分泌與平滑肌收縮；可散瞳、心跳上升、支氣管擴張；PDF重點：刺激交感，BP↑(血管主要",
    "mnemonic": "p.16: 貝莎內褲🡺治腸麻痺、尿滯留，穿內褲做M字腿(只作用在M) (5)支氣管收縮",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Travoprost",
    "category": "神經/精神科 > 青光眼用藥 > PGF2α類似物",
    "mechanism": "PGF2α類似物，增加房水葡萄膜鞏膜流出",
    "indications": "未在PDF同列明確標示；依分類臨床適應症複習",
    "effects": "依其機轉產生對應藥理作用；請搭配適應症與考點複習",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Aminophylline",
    "category": "胸腔科 > 抗氣喘/COPD > Methylxanthines",
    "mechanism": "抑制PDE、阻斷A1 adenosine受器並具抗發炎作用",
    "indications": "氣喘/COPD、動暈、尿失禁、帕金森/EPS或散瞳（依藥物）",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "p.62: Q：名次誰要分你(theophylline) A：阿明分你(Aminophylline)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Domperidone",
    "category": "腸胃科 > 促腸胃蠕動/止吐 > D2阻斷",
    "mechanism": "周邊D2受器拮抗，促進胃排空",
    "indications": "(無止吐效果)",
    "effects": "調節多巴胺傳導，影響精神症狀、EPS、泌乳或帕金森症狀；PDF重點：(無止吐效果)",
    "mnemonic": "p.67: 沒頭骷髏 (Metoclo-)開卡車(Domper🡺Domperidone)撞D2\np.67: 台語的袂吐唸作ㄇㄟˇㄊㄡˇ，意思是不吐",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Aprepitant",
    "category": "腸胃科 > 止吐 > NK1阻斷",
    "mechanism": "NK1/substance P受器拮抗",
    "indications": "腸胃蠕動異常、嘔吐、便祕/腹瀉、IBD或IBS（依藥物）",
    "effects": "阻斷對應受器或通道，降低該路徑效應；PDF重點：Neurokinin(NK) 阻斷",
    "mnemonic": "p.67: NK(不知道在喊什麼XD)!! Appreciate(Aprepitant)你沒讓我吐",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Travoprost",
    "category": "自泌素 > Eicosanoid > PGF2α類似物/青光眼",
    "mechanism": "PGF2α類似物，增加房水流出、降眼壓",
    "indications": "發炎疼痛、氣喘、肺高壓或胃黏膜保護（依藥物）",
    "effects": "依其機轉產生對應藥理作用；請搭配適應症與考點複習",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Promethazine",
    "category": "自泌素 > Histamine > 第一代H1阻斷",
    "mechanism": "H1受器反向致效/拮抗，較易過BBB且有抗M作用",
    "indications": "氣喘/COPD、動暈、尿失禁、帕金森/EPS或散瞳（依藥物）",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）；PDF重點：阻斷α receptor 造成血壓降低",
    "mnemonic": "p.58: 破麻傷心(Promethazine)、沒開心(Meclizine)就讓大家去大分海、大門海(兩個海洋Diphenhy-, Dimenhy-)多吸一點拉麵(Doxy-lamine)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Ixabepilone",
    "category": "血液腫瘤科 > 抗癌 > Epothilone",
    "mechanism": "穩定微小管，抑制去聚合",
    "indications": "特定癌症或腫瘤標靶治療",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）；PDF重點：抑制微管的聚合",
    "mnemonic": "p.101: 穿紫衫的人，有凝聚力(微管聚在一起散不開)感覺怪怪的(PNS異常)，容易過敏還容易被騙 囉(Ixabepilone其他類但同效果的藥)\np.101: 愛離不離",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Tubocurarine",
    "category": "麻醉科 > 神經肌肉阻斷劑 > 非去極化",
    "mechanism": "競爭性Nm受器拮抗，阻斷骨骼肌神經肌肉傳遞",
    "indications": "氣喘/COPD、動暈、尿失禁、帕金森/EPS或散瞳（依藥物）",
    "effects": "阻斷對應受器或通道，降低該路徑效應",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Abacavir",
    "category": "感染科 > 抗HIV > NRTI",
    "mechanism": "核苷類RT抑制；經磷酸化後造成DNA鏈終止",
    "indications": "病毒感染治療或預防",
    "effects": "干擾DNA/RNA或細胞分裂，產生細胞毒性",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Nafcillin",
    "category": "感染科 > 抗生素 > Penicillinase-resistant penicillins",
    "mechanism": "β-lactam；抑制PBP，且較耐penicillinase",
    "indications": "細菌感染治療（菌種依藥物光譜）",
    "effects": "抑制細菌細胞壁、蛋白質、核酸或葉酸代謝；PDF重點：對altered PBP 之MRSA 無",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Oxacillin",
    "category": "感染科 > 抗生素 > Penicillinase-resistant penicillins",
    "mechanism": "β-lactam；抑制PBP，且較耐penicillinase",
    "indications": "細菌感染治療（菌種依藥物光譜）",
    "effects": "抑制細菌細胞壁、蛋白質、核酸或葉酸代謝；PDF重點：對altered PBP 之MRSA 無",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Sodium nitrite",
    "category": "毒物學 > Cyanide解毒",
    "mechanism": "Nitrite產生methemoglobin結合cyanide；thiosulfate供硫轉為thiocyanate",
    "indications": "中毒或重金屬暴露之解毒/螯合治療",
    "effects": "結合毒物/重金屬或繞過毒性路徑以促進排除",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Pergolide",
    "category": "神經/精神科 > 抗帕金森 > DA受器致效",
    "mechanism": "Ergot類DA受器致效，主要D2作用",
    "indications": "帕金森氏症或藥物誘發EPS",
    "effects": "調節多巴胺傳導，影響精神症狀、EPS、泌乳或帕金森症狀",
    "mnemonic": "p.31: 在bromo的快艇(bromocriptine)開得很快，因為怕狗來(pergolide)<註：bromo為一座印\np.31: 腳(麥角鹼類)不給摸(不摸🡺bromo-)，又一直把腳撇過來(pergolide)，刺激多吧(Dopamine",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Sertraline",
    "category": "神經/精神科 > 抗憂鬱 > SSRI",
    "mechanism": "選擇性抑制SERT，增加突觸間5-HT",
    "indications": "睡、體重增加、頭痛；禁突然停藥(眩暈失眠疲倦噁心焦慮寒顫頭痛等戒斷症狀)",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "p.25: 差點被撞(所以有PTSD→可治PTSD)的感冒的ox坐(fluoxetine)在central line(sertraline)很憂鬱 又一直搖ass(SSRI)\np.25: 怕流感(Par-, Flu-)，我先停(-oxetine) 洗塔羅牌(Citalopram)，避免Sir抓你 (Sertraline)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Metoprolol",
    "category": "心臟科 > 抗心律不整 > Class II",
    "mechanism": "β受器阻斷，降低SA/AV node自律性與傳導",
    "indications": "降心搏，改善心臟因交感活性的代償性肥大；心衰竭只能用這四種B-blocker",
    "effects": "阻斷對應受器或通道，降低該路徑效應；PDF重點：降心搏，改善心臟因交感活性的代償性肥大",
    "mnemonic": "p.14: -olol(A~M開頭的)：AM(白天)的OL比較挑(選擇性)，只要1支banana(B1 antagonist)\np.14: -olol(P開頭的)：晚上(不是下方A~M)的OL就不挑(非選擇性)，banana全都要(B antagonist)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Metoprolol",
    "category": "神經/精神科 > 交感神經阻斷劑 > β1選擇性阻斷",
    "mechanism": "選擇性β1受器阻斷，降低心率/收縮力/renin釋放",
    "indications": "ISA (不用於MI)；治左心室衰竭",
    "effects": "增加心收縮力/心跳或阻斷後降低心率與耗氧；PDF重點：助內皮細胞活化nitric oxide synthase 產",
    "mnemonic": "p.14: -olol(A~M開頭的)：AM(白天)的OL比較挑(選擇性)，只要1支banana(B1 antagonist)\np.14: -olol(P開頭的)：晚上(不是下方A~M)的OL就不挑(非選擇性)，banana全都要(B antagonist)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Tranylcypromine",
    "category": "神經/精神科 > 抗憂鬱 > MAOI",
    "mechanism": "非選擇性抑制MAO-A與MAO-B，增加NE/5-HT/DA",
    "indications": "憂鬱症、焦慮症或神經痛/偏頭痛預防（依藥物）",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "p.26: 茂姨(aunt→MAOa inh.)因為分心(phen-)在train上 酒類)、交感神經類藥物合用 潑麵(Trany-)。此時她再吃起司的話就要高血壓了(高血 →過度刺激α1-R造成 壓危機)；或是再有OX再搖ass(SSRI)的話她就要發燒 Hypertension crisis 了(合併用SSRI會高燒) 3. 禁與SSRI、L-dopa、TCA合",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Primidone",
    "category": "神經/精神科 > 抗焦慮/鎮靜安眠 > Barbiturates",
    "mechanism": "GABA_A受器正向變構調節；延長Cl-通道開啟時間，高劑量可直接開啟",
    "indications": "焦慮、失眠、鎮靜、抗癲癇或麻醉誘導（依藥物）",
    "effects": "增強GABA-A抑制性傳導，鎮靜、抗焦慮、抗癲癇",
    "mnemonic": "p.34: 你去阻止開車的Obama(car bama-) &柯博文(optimus prime🡺primodo-)，我就分你投飲，這可以防大發 作！ <改自小鳥醫師8.0> (我覺得這個沒這麼好記XD)\np.35: 開車的Obama，壽司買回來，就蒸發了，他很生氣，就打給steven jobs(會引發 SJS syndrome)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Primidone",
    "category": "神經/精神科 > 抗癲癇 > GABA_A增強",
    "mechanism": "增強GABA_A介導的Cl-內流",
    "indications": "癲癇發作控制；部分用於神經痛或情緒穩定",
    "effects": "增強GABA-A抑制性傳導，鎮靜、抗焦慮、抗癲癇",
    "mnemonic": "p.34: 你去阻止開車的Obama(car bama-) &柯博文(optimus prime🡺primodo-)，我就分你投飲，這可以防大發 作！ <改自小鳥醫師8.0> (我覺得這個沒這麼好記XD)\np.35: 開車的Obama，壽司買回來，就蒸發了，他很生氣，就打給steven jobs(會引發 SJS syndrome)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Phenylephrine",
    "category": "神經/精神科 > 擬交感神經藥物 > α1致效劑",
    "mechanism": "選擇性α1受器致效",
    "indications": "低血壓升壓、鼻塞、散瞳、反射性治心搏過速",
    "effects": "選擇性α1致效，血管收縮使BP上升，並可散瞳/收縮鼻黏膜血管",
    "mnemonic": "p.10: 阿姨(alpha-1[中文])在夢中(middle dream=midodrine)不是你 的愛妃 (非你愛妃=phenylephrine)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Mecasermin",
    "category": "內分泌/新陳代謝 > 腦下垂體 > IGF-1",
    "mechanism": "重組IGF-1，活化IGF-1受器",
    "indications": "用於對exogenous GH 無反應的IGF-1 缺乏",
    "effects": "依其機轉產生對應藥理作用；請搭配適應症與考點複習",
    "mnemonic": "p.70: 美髂生命(Mecasermin)：從很美的髂骨中迸出生命來，可促進生長(Recombinant IGF-1)\np.70: 沒car賽命(Mecasermin)[天生沒有當賽車手的命運]，所以只能在IG上看F1賽車(IGF-1) (by ler ling)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Bacitracin",
    "category": "感染科 > 抗生素 > Bacitracin",
    "mechanism": "抑制bactoprenol去磷酸化，阻斷細胞壁前驅物運輸",
    "indications": "細菌感染治療（菌種依藥物光譜）",
    "effects": "抑制細菌細胞壁、蛋白質、核酸或葉酸代謝；PDF重點：抗G(+)抑制BP dephosphorylation(106-1)",
    "mnemonic": "p.108: 攜帶M，形成卜，翻牆",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Cefazolin",
    "category": "感染科 > 抗生素 > Cephalosporin第一代",
    "mechanism": "β-lactam；抑制PBP/細胞壁合成",
    "indications": "手術前預防用藥首選(106-1)；手術是一種蹂躪(Cefa-zolin)，術前預防性用藥。",
    "effects": "抑制細菌細胞壁、蛋白質、核酸或葉酸代謝",
    "mnemonic": "p.105: •所有cefa發音的都是第一代， Cefazoline (IV) 手術前預防用藥首選(106-1)\np.105: 除了以下兩個是第二代“法國 • 手術是一種蹂躪(Cefa-zolin)，術前預防性用藥。\np.105: 有人來信(Cephalexin)，叫我去濁水溪(Cefadroxil)揍人(Cefazoline)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Cycloserine",
    "category": "感染科 > 抗生素 > 細胞壁前驅物",
    "mechanism": "抑制alanine racemase與D-Ala-D-Ala ligase",
    "indications": "高血壓；部分用於心衰竭、腎保護或心絞痛",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）；PDF重點：抑制細胞壁合成",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "LSD",
    "category": "神經/精神科 > 成癮物質/藥物",
    "mechanism": "5-HT2A受器致效",
    "indications": "偏頭痛、止吐、腸胃蠕動或精神科適應症（依受器）",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Propantheline",
    "category": "神經/精神科 > 膽鹼性拮抗劑 > 胃腸Muscarinic阻斷",
    "mechanism": "Muscarinic受器阻斷，減少腸胃平滑肌痙攣/分泌",
    "indications": "→治胃潰瘍；減少腸胃蠕動、作為止瀉藥",
    "effects": "阻斷M受器，減少腺體分泌與平滑肌收縮；可散瞳、心跳上升、支氣管擴張；PDF重點：減少腸胃蠕動、作為止瀉藥",
    "mnemonic": "p.17: 壞人(piren)玻片(propan)🡺幹太多壞事壓力大而胃潰瘍\np.17: 屁人(piren-,M1)帶賽(dicy-,M3) 造成破片傷人 (propantheline,M1+M3)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Sulfasalazine",
    "category": "腸胃科 > IBD > 5-ASA",
    "mechanism": "釋放5-ASA，抑制COX/NF-κB並減少腸黏膜發炎",
    "indications": "發炎疼痛、氣喘、肺高壓或胃黏膜保護（依藥物）",
    "effects": "降低前列腺素生成，解熱、止痛、抗發炎",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Propantheline",
    "category": "腸胃科 > 消化性潰瘍 > M1/M3阻斷",
    "mechanism": "阻斷M1/M3，減少胃酸與腸胃痙攣",
    "indications": "Block M1 + M3 (有抗M3，可治腹瀉)；專一block M1 (不抗M3，故不便秘)；治Zollinger-Ellison syndrome(胃泌素瘤)首選；酸性下作用佳，故不與制酸劑及其他抗胃酸藥合用",
    "effects": "阻斷M受器，減少腺體分泌與平滑肌收縮；可散瞳、心跳上升、支氣管擴張；PDF重點：M1、M3 阻斷；效持久、不可逆抑制 H+/K+ ATPase (106-1)",
    "mnemonic": "p.17: 壞人(piren)玻片(propan)🡺幹太多壞事壓力大而胃潰瘍\np.17: 屁人(piren-,M1)帶賽(dicy-,M3) 造成破片傷人 (propantheline,M1+M3)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Glycerin",
    "category": "腸胃科 > 瀉劑 > 軟便劑",
    "mechanism": "表面活性/保水作用，使水與脂肪混合軟化糞便",
    "indications": "瀉劑；將NH3轉變為水溶性氨有利排泄，改善；效快(水瀉)→；血鎂、水瀉",
    "effects": "依其機轉產生對應藥理作用；請搭配適應症與考點複習；PDF重點：增加介面活性，促水和脂肪混合；抑制脂溶性維生素",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Flutamide",
    "category": "內分泌/新陳代謝 > 性激素 > Antiandrogen",
    "mechanism": "競爭性androgen receptor拮抗",
    "indications": "(可治前列腺癌) (108-2)；也抗aldosterone-R",
    "effects": "阻斷對應受器或通道，降低該路徑效應；PDF重點：競爭抑制androgen-R",
    "mnemonic": "p.78: 俘虜他mind(Flutamide)，讓雄性素變成受器",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Ibutilide",
    "category": "心臟科 > 抗心律不整 > Class III",
    "mechanism": "阻斷K+通道，延長phase 3與ERP",
    "indications": "心律不整治療",
    "effects": "阻斷對應受器或通道，降低該路徑效應",
    "mnemonic": "p.55: 假的(K blocker) 阿喵(Amio-) 其實是Brety姐(Bretylium)，她一步踢來(Ibutilide)，都飛 踢(Dofeti-)， 求你(Drone-) ㄙㄡˊ她(Sota-，撫摸)的Vagina(Verna-) <取自高醫元廷藥理>",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Carbenicillin",
    "category": "感染科 > 抗生素 > Antipseudomonal penicillins",
    "mechanism": "β-lactam；抑制PBP/細胞壁合成，具抗Pseudomonas活性",
    "indications": "細菌感染治療（菌種依藥物光譜）",
    "effects": "抑制細菌細胞壁、蛋白質、核酸或葉酸代謝",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Sodium thiosulfate",
    "category": "毒物學 > Cyanide解毒",
    "mechanism": "Nitrite產生methemoglobin結合cyanide；thiosulfate供硫轉為thiocyanate",
    "indications": "Oxidizing agents(nitrogen oxides 心衰竭、心絞痛、癌症；Digoxin 中毒 (112-1) (不適合使用血液透析解毒)；Lidocaine…等抗心律不整藥；Digoxin 抗體",
    "effects": "結合毒物/重金屬或繞過毒性路徑以促進排除",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Edrophonium",
    "category": "神經/精神科 > 膽鹼性致效劑 > 可逆AChE抑制",
    "mechanism": "可逆性抑制AChE，增加神經肌肉接合處ACh",
    "indications": "短效治MG(診斷)；治MG、可口服",
    "effects": "活化對應受器，產生受器相關生理效應；PDF重點：明星一周風靡(edro-)，開記者會，記者一直死遞Mic(-stigmine)，抑制粉絲瓦解(Achase",
    "mnemonic": "p.16: 明星一周風靡(edro-)，開記者會，記者一直死遞Mic(-stigmine)，抑制粉絲瓦解(Achase inh.)\np.16: 安卓手機(android phone, Edrophonium)一直黏住我(stick me, -stigmine)，使得了MG的 我都還一直用\np.16: 回收(Physo-)很油(脂溶)黏著我(-stig-mine)，油漬還沾到了手機，需要換新的(Neo-)，但 iPhone一整排你都(Py-rido-)不要，竟然挑Android的手機(Edro-phonium)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Diclofenac",
    "category": "風濕免疫科 > NSAID > Acetic acid類",
    "mechanism": "可逆抑制COX-1/2，降低PG生成",
    "indications": "高度selective，治RA、；無抗血小板作用；(Vioxx)易血栓，已下架；適用：兒童感染病毒(109-1) (避Aspirin 的",
    "effects": "降低RAAS作用，血管擴張、降醛固酮並保護心腎；PDF重點：增加MI、中風風險；無抗血小板作用",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Tofacitinib",
    "category": "風濕免疫科 > 免疫治療 > JAK抑制",
    "mechanism": "抑制JAK訊號，降低多種cytokine訊號傳遞",
    "indications": "自體免疫疾病、器官移植排斥或發炎疾病",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）；PDF重點：抑制NK cell,減少immunoglobulin 免疫球",
    "mnemonic": "p.90: 誰的頭髮(Tofa-)最香?當然是JK(JAK)的\np.90: 頭髮稀的女生(tofacitinib-)趕走Jack(抑制 JAK)\np.90: 土匪(tofa-)搶劫(JAK)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Rocuronium",
    "category": "麻醉科 > 神經肌肉阻斷劑 > 非去極化",
    "mechanism": "競爭性Nm受器拮抗，阻斷骨骼肌神經肌肉傳遞",
    "indications": "氣喘/COPD、動暈、尿失禁、帕金森/EPS或散瞳（依藥物）",
    "effects": "阻斷對應受器或通道，降低該路徑效應",
    "mnemonic": "p.19: Panic(Panc-)的感覺🡺有以下副作用：心跳↑、血壓↑ Vecuronium 無His釋 解毒：Sugammadex 放 Rocuronium 肝臟代謝\np.19: 用平底鍋(Pan-)煎肥肉(Ve-,Ro-)，很油要洗很久，還會剩⼀咪咪油漬(抑制迷走) 去極化型(非競爭型)強效Ach-R agonist",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Bicalutamide",
    "category": "內分泌/新陳代謝 > 性激素 > Antiandrogen",
    "mechanism": "競爭性androgen receptor拮抗",
    "indications": "(可治前列腺癌) (108-2)；也抗aldosterone-R",
    "effects": "阻斷對應受器或通道，降低該路徑效應",
    "mnemonic": "p.78: 林秉樞在他媽的(-tamide)喪禮後脅迫他人(cyproterone)，俘虜(Flu-)高嘉瑜，揍她揍到掰咖 (bica-)，嚇得她屁滾尿流(利尿劑Spironolactone)，真不配當男人(androgen blocker)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Clomiphene",
    "category": "內分泌/新陳代謝 > 性激素 > 不孕/促排卵",
    "mechanism": "部分estrogen receptor致效；阻斷下視丘ER負回饋，使GnRH/FSH/LH上升",
    "indications": "誘導排卵治不孕症(109-2)；(口服促排卵藥第一個想到它)",
    "effects": "活化對應受器，產生受器相關生理效應；PDF重點：阻斷中樞estrogen-R 負回饋；→GnRH、FSH、LH↑",
    "mnemonic": "p.79: Clone me~~複製我，生小孩：治不孕",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Carbimazole",
    "category": "內分泌/新陳代謝 > 甲狀腺 > Thioamides",
    "mechanism": "抑制thyroid peroxidase，減少MIT/DIT偶聯與碘化",
    "indications": "甲狀腺功能亢進/低下或甲狀腺風暴",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號；PDF重點：抑制周邊T4→T3(去碘化較快)；不抑制甲狀腺素釋放(114-2)",
    "mnemonic": "p.116: 蓋地板(台語，起頭咖)(Ketoco-)對阿祖(-azole)來說是一種苦行(Cushing)，可以治Cushing syndrome\np.116: 阿祖(-azole)看到爛(lanosterol)人很不爽，他踢他屁屁(P450)，剁他耳朵(ergosterol)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Insulin aspart",
    "category": "內分泌/新陳代謝 > 糖尿病 > Insulin",
    "mechanism": "速效insulin類似物，活化insulin receptor tyrosine kinase",
    "indications": "糖尿病血糖控制",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Insulin detemir",
    "category": "內分泌/新陳代謝 > 糖尿病 > Insulin",
    "mechanism": "長效insulin製劑，活化insulin receptor tyrosine kinase",
    "indications": "糖尿病血糖控制",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Insulin glargine",
    "category": "內分泌/新陳代謝 > 糖尿病 > Insulin",
    "mechanism": "長效insulin製劑，活化insulin receptor tyrosine kinase",
    "indications": "糖尿病血糖控制",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Insulin lispro",
    "category": "內分泌/新陳代謝 > 糖尿病 > Insulin",
    "mechanism": "速效insulin類似物，活化insulin receptor tyrosine kinase",
    "indications": "糖尿病血糖控制",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Regular insulin",
    "category": "內分泌/新陳代謝 > 糖尿病 > Insulin",
    "mechanism": "短效insulin，活化insulin receptor tyrosine kinase",
    "indications": "糖尿病血糖控制",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "p.75: 一個正常的insulin，是我注入(IV)的很多Zn血的 2. 低血鉀 結晶 3. 體重增加",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Glipizide",
    "category": "內分泌/新陳代謝 > 糖尿病 > Sulfonylureas",
    "mechanism": "阻斷胰臟β細胞KATP通道，使Ca2+內流並促insulin分泌",
    "indications": "糖尿病血糖控制",
    "effects": "調節鈣離子通道/骨代謝/血管平滑肌收縮",
    "mnemonic": "p.75: 飯前(飯前吃，gli在字首)呷(台 4. 比較: 語)(K+)蛤蜊(Gli-)才會舒服 使KATP channel關閉→Sulfonylurea、 (sulfo-)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Tolbutamide",
    "category": "內分泌/新陳代謝 > 糖尿病 > Sulfonylureas",
    "mechanism": "阻斷胰臟β細胞KATP通道，使Ca2+內流並促insulin分泌",
    "indications": "糖尿病血糖控制",
    "effects": "調節鈣離子通道/骨代謝/血管平滑肌收縮；PDF重點：機轉：阻斷胰臟β 細胞上的ATP-",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Teriparatide",
    "category": "內分泌/新陳代謝 > 骨鬆 > PTH類似物",
    "mechanism": "PTH 1-34類似物，間歇給予促進骨形成",
    "indications": "PTH 前34 個AA 序列(重組蛋白)，可用於治療骨質疏鬆、刺激新的骨生；預防停經後婦女的骨質疏鬆；單株抗體",
    "effects": "促進神經傳遞物質或內分泌/代謝反應",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Ivabradine",
    "category": "心臟科 > 心絞痛 > If抑制",
    "mechanism": "選擇性抑制SA node funny current (If)，降低心率",
    "indications": "對心絞痛有效，因為此藥可減緩心跳，因而減少心肌需氧量(不影響其他心臟",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號；PDF重點：抑制；對心絞痛有效，因為此藥可減緩心跳，因而減少心肌需氧量(不影響其他心臟",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Ticarcillin",
    "category": "感染科 > 抗生素 > Antipseudomonal penicillins",
    "mechanism": "β-lactam；抑制PBP/細胞壁合成，具抗Pseudomonas活性",
    "indications": "細菌感染治療（菌種依藥物光譜）",
    "effects": "抑制細菌細胞壁、蛋白質、核酸或葉酸代謝",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Sulbactam",
    "category": "感染科 > 抗生素 > β-lactamase inhibitor",
    "mechanism": "抑制β-lactamase，保護β-lactam抗生素",
    "indications": "細菌感染治療（菌種依藥物光譜）",
    "effects": "抑制細菌細胞壁、蛋白質、核酸或葉酸代謝",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Baclofen",
    "category": "神經/精神科 > 中樞性肌肉鬆弛劑",
    "mechanism": "GABA_B受器致效，關閉Ca2+通道並開啟K+通道",
    "indications": "憂鬱症、焦慮症或神經痛/偏頭痛預防（依藥物）",
    "effects": "增強GABA-A抑制性傳導，鎮靜、抗焦慮、抗癲癇",
    "mnemonic": "p.20: D gabaA (大) ； B gabaB (逼)\np.20: 小鳥藥理：鉀罷肉鬆(所以是GABA B鉀通道，是肌肉鬆弛劑)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Prazosin",
    "category": "神經/精神科 > 交感神經阻斷劑 > α1阻斷",
    "mechanism": "選擇性α1受器阻斷，使血管、前列腺與膀胱頸平滑肌鬆弛",
    "indications": "治高血壓；治BPH",
    "effects": "血管/括約肌收縮；阻斷時則血管與前列腺平滑肌放鬆；PDF重點：治BPH",
    "mnemonic": "p.13: 黑心(台語/osin/)的廠商山寨機，跟Apple inc對槓(a1 antagonist)\np.13: 治高血壓+BPH：柔欣(-zosin)有高血壓+BPH，因為愛吃印度拉麵(indoramine)\np.13: 煮阿姨(阻 α1)有肉腥(-zosin)\np.13: 你太快了(U-rapid-il)讓我整個走心(-zosin)，我要去吃印度拉麵(Indo-ramin)消消氣",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Terazosin",
    "category": "神經/精神科 > 交感神經阻斷劑 > α1阻斷",
    "mechanism": "選擇性α1受器阻斷，使血管、前列腺與膀胱頸平滑肌鬆弛",
    "indications": "治BPH 為主",
    "effects": "血管/括約肌收縮；阻斷時則血管與前列腺平滑肌放鬆；PDF重點：治BPH 為主",
    "mnemonic": "p.13: 黑心(台語/osin/)的廠商山寨機，跟Apple inc對槓(a1 antagonist)\np.13: 治高血壓+BPH：柔欣(-zosin)有高血壓+BPH，因為愛吃印度拉麵(indoramine)\np.13: 煮阿姨(阻 α1)有肉腥(-zosin)\np.13: 你太快了(U-rapid-il)讓我整個走心(-zosin)，我要去吃印度拉麵(Indo-ramin)消消氣",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Urapidil",
    "category": "神經/精神科 > 交感神經阻斷劑 > α1阻斷",
    "mechanism": "α1阻斷；兼具中樞α2與5-HT1A作用",
    "indications": "高血壓、BPH、嗜鉻細胞瘤或雷諾氏現象（依選擇性）",
    "effects": "血管/括約肌收縮；阻斷時則血管與前列腺平滑肌放鬆",
    "mnemonic": "p.13: 黑心(台語/osin/)的廠商山寨機，跟Apple inc對槓(a1 antagonist)\np.13: 煮阿姨(阻 α1)有肉腥(-zosin)\np.13: 你太快了(U-rapid-il)讓我整個走心(-zosin)，我要去吃印度拉麵(Indo-ramin)消消氣",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Benserazide",
    "category": "神經/精神科 > 抗帕金森 > 周邊DOPA decarboxylase抑制",
    "mechanism": "抑制周邊DOPA decarboxylase，使L-dopa在中樞作用並減少周邊副作用",
    "indications": "使用5 年後治療反應降；運動不能、食慾下降、；(cf. 抗結核藥物INH 與Vit. B6",
    "effects": "降低RAAS作用，血管擴張、降醛固酮並保護心腎；PDF重點：使用5 年後治療反應降；低、且長期使用導致",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Vigabatrin",
    "category": "神經/精神科 > 抗癲癇 > GABA-T抑制",
    "mechanism": "不可逆抑制GABA transaminase，增加GABA",
    "indications": "癲癇發作控制；部分用於神經痛或情緒穩定",
    "effects": "增強GABA-A抑制性傳導，鎮靜、抗焦慮、抗癲癇；PDF重點：transaminase↓、GABA 回；收↓",
    "mnemonic": "p.35: gabatrin想到trin=transaminase，抑制gaba transaminase",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Tetrodotoxin",
    "category": "神經/精神科 > 神經肌肉/毒素",
    "mechanism": "阻斷電壓依賴性Na+通道",
    "indications": "未在PDF同列明確標示；依分類臨床適應症複習",
    "effects": "抑制電位依賴性鈉通道，降低神經或心肌興奮性",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Tropicamide",
    "category": "神經/精神科 > 膽鹼性拮抗劑 > 眼科Muscarinic阻斷",
    "mechanism": "Muscarinic受器阻斷，造成散瞳與睫狀肌麻痺",
    "indications": "氣喘/COPD、動暈、尿失禁、帕金森/EPS或散瞳（依藥物）",
    "effects": "阻斷M受器，減少腺體分泌與平滑肌收縮；可散瞳、心跳上升、支氣管擴張",
    "mnemonic": "p.17: Home ma(Homa-)的孩子走丟了(散童)，在熱帶雨林(Tropica-)騎腳踏車(Cyclo-)找",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Cevimeline",
    "category": "神經/精神科 > 膽鹼性致效劑 > 直接型",
    "mechanism": "M1/M3受器致效，促進外分泌腺分泌",
    "indications": "重症肌無力、青光眼、阿茲海默症或解抗膽鹼毒性（依藥物）",
    "effects": "阻斷M受器，減少腺體分泌與平滑肌收縮；可散瞳、心跳上升、支氣管擴張",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Methysergide",
    "category": "神經/精神科 > 頭痛用藥 > 5-HT2拮抗",
    "mechanism": "5-HT2受器拮抗，偏頭痛預防",
    "indications": "5-HT1B：血管收縮 (血管收縮可緩解與顱內血管擴張相關的頭痛)",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）；PDF重點：5-HT1B：血管收縮 (血管收縮可緩解與顱內血管擴張相關的頭痛)；5-HT1D：抑制CGRP (抑制三叉神經末梢釋放神經胜肽（如 CGRP、Substance P），減",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Ergotamine",
    "category": "神經/精神科 > 頭痛用藥 > Ergot類",
    "mechanism": "5-HT1B/1D受器致效，造成顱內血管收縮",
    "indications": "5-HT1B：血管收縮 (血管收縮可緩解與顱內血管擴張相關的頭痛)",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）；PDF重點：5-HT1B：血管收縮 (血管收縮可緩解與顱內血管擴張相關的頭痛)；5-HT1D：抑制CGRP (抑制三叉神經末梢釋放神經胜肽（如 CGRP、Substance P），減",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Pentazocine",
    "category": "神經/精神科 > 類鴉片止痛劑 > 混合致效/拮抗",
    "mechanism": "κ受器致效，μ受器弱拮抗或部分致效",
    "indications": "少止痛效果甚至可能會有戒斷症狀",
    "effects": "活化對應受器，產生受器相關生理效應；PDF重點：可口服、高劑量時BP↑、較Morphine 不易有欣快感、併用Morphine 時減；少止痛效果甚至可能會有戒斷症狀",
    "mnemonic": "p.39: 不偷肥肉(Buto-phanol)，也不想變弱貧(Bu-pre-norphine)，所以應徵到了幾間麥當勞(partial μ agonist)盤子拿不平(Nal-buphine)，還騙他走心(Penta-zocine)，職位被卡掉(κ agonist)，連麥當",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Cromolyn",
    "category": "胸腔科 > 抗氣喘 > Mast cell stabilizer",
    "mechanism": "阻斷mast cell Ca2+進入，抑制degranulation",
    "indications": "氣喘/COPD、動暈、尿失禁、帕金森/EPS或散瞳（依藥物）",
    "effects": "調節鈣離子通道/骨代謝/血管平滑肌收縮；PDF重點：(109-2)而減少組織胺釋放；作用：預防氣喘(不具支氣管擴張作用，急性無效)、",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Nedocromil",
    "category": "胸腔科 > 抗氣喘 > Mast cell stabilizer",
    "mechanism": "阻斷mast cell Ca2+進入，抑制degranulation",
    "indications": "氣喘/COPD、動暈、尿失禁、帕金森/EPS或散瞳（依藥物）",
    "effects": "調節鈣離子通道/骨代謝/血管平滑肌收縮；PDF重點：作用：預防氣喘(不具支氣管擴張作用，急性無效)、",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Nabilone",
    "category": "腸胃科 > 止吐 > Cannabinoid",
    "mechanism": "CB1受器致效，抑制化療相關嘔吐",
    "indications": "腸胃蠕動異常、嘔吐、便祕/腹瀉、IBD或IBS（依藥物）",
    "effects": "活化對應受器，產生受器相關生理效應",
    "mnemonic": "p.67: 吸大麻太嗨，嗨到拿筆弄(nabilone)無人機(drone)\np.67: 拿大麻塞那邊啦(-nabiln/-nabilone)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Esomeprazole",
    "category": "腸胃科 > 消化性潰瘍 > PPI",
    "mechanism": "不可逆抑制胃壁細胞H+/K+ ATPase",
    "indications": "酸性下作用佳，故不與制酸劑及其他抗胃酸藥合用；首選用藥；用於預防及治療壓力性潰瘍所致之胃出血 (111-2)",
    "effects": "抑制胃酸分泌",
    "mnemonic": "p.65: 屁屁挨(PPI)打，怕揍(-prazole)\np.116: 蓋地板(台語，起頭咖)(Ketoco-)對阿祖(-azole)來說是一種苦行(Cushing)，可以治Cushing syndrome\np.116: 阿祖(-azole)看到爛(lanosterol)人很不爽，他踢他屁屁(P450)，剁他耳朵(ergosterol)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Cascara sagrada",
    "category": "腸胃科 > 瀉劑 > 刺激性瀉劑",
    "mechanism": "刺激腸神經叢與腸黏膜分泌，促進蠕動",
    "indications": "腸胃蠕動異常、嘔吐、便祕/腹瀉、IBD或IBS（依藥物）",
    "effects": "促進神經傳遞物質或內分泌/代謝反應",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Methylnaltrexone",
    "category": "腸胃科 > 瀉劑 > 周邊μ拮抗",
    "mechanism": "周邊μ-opioid受器拮抗，改善opioid引起便秘",
    "indications": "Opioid 阻抗；無法通過BBB，不影響止痛",
    "effects": "阻斷對應受器或通道，降低該路徑效應；PDF重點：無法通過BBB，不影響止痛",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Pitolisant",
    "category": "自泌素 > Histamine > H3 inverse agonist",
    "mechanism": "H3受器反向致效/拮抗，增加中樞histamine等神經傳遞",
    "indications": "過敏/蕁麻疹、動暈或胃酸相關疾病（依受器）",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）；PDF重點：減少腦、周圍神經中神經傳遞物質釋放；減少嗜睡病人睡意",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Chlorpheniramine",
    "category": "自泌素 > Histamine > 第一代H1阻斷",
    "mechanism": "H1受器反向致效/拮抗，較易過BBB且有抗M作用",
    "indications": "氣喘/COPD、動暈、尿失禁、帕金森/EPS或散瞳（依藥物）",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）；PDF重點：阻斷α receptor 造成血壓降低",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Dexfenfluramine",
    "category": "自泌素 > Serotonin > 5-HT2C致效/減重",
    "mechanism": "5-HT2C受器致效，抑制食慾",
    "indications": "偏頭痛、止吐、腸胃蠕動或精神科適應症（依受器）",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）；PDF重點：抑制食慾 for 減重",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Melagatran",
    "category": "血液腫瘤科 > 抗凝血 > Direct thrombin inhibitors",
    "mechanism": "直接抑制thrombin (factor IIa)",
    "indications": "特定癌症或腫瘤標靶治療",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號",
    "mnemonic": "p.95: 美拉想搭船(Melagatran)，要去西門所以來搭船(Ximelagatran)。但身上沒帶錢，只好賴皮 (Lepi-)不付錢，結果被罰(Biva-)用agar(Arga-)當代幣(Dabi-)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Ximelagatran",
    "category": "血液腫瘤科 > 抗凝血 > Direct thrombin inhibitors",
    "mechanism": "直接抑制thrombin (factor IIa)",
    "indications": "特定癌症或腫瘤標靶治療",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號",
    "mnemonic": "p.95: 美拉想搭船(Melagatran)，要去西門所以來搭船(Ximelagatran)。但身上沒帶錢，只好賴皮 (Lepi-)不付錢，結果被罰(Biva-)用agar(Arga-)當代幣(Dabi-)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Fondaparinux",
    "category": "血液腫瘤科 > 抗凝血 > Xa間接抑制",
    "mechanism": "活化Antithrombin，選擇性抑制factor Xa",
    "indications": "可用於HIT 病人",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號",
    "mnemonic": "p.95: 長得有點像Foodpanda，跟食物(10 Xa)有關\np.95: 瘋十大排行榜(Fondapari-)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Leucovorin",
    "category": "血液腫瘤科 > 抗癌 > Folate rescue",
    "mechanism": "還原型葉酸，繞過DHFR補充THF以降低MTX毒性",
    "indications": "特定癌症或腫瘤標靶治療",
    "effects": "干擾DNA/RNA或細胞分裂，產生細胞毒性",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Paclitaxel",
    "category": "血液腫瘤科 > 抗癌 > Taxanes",
    "mechanism": "穩定微小管，抑制去聚合",
    "indications": "特定癌症或腫瘤標靶治療",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）；PDF重點：抑制微小管分離；易骨髓抑制、水腫",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Tranexamic acid",
    "category": "血液腫瘤科 > 抗纖溶",
    "mechanism": "lysine類似物，抑制plasminogen結合fibrin",
    "indications": "抗Heparin(離子態與Heparin 結合)；factor VIIIFc domain conjugate，治療與預防 A 型血友病患者出血；factor IXalbumin conjugate，治療及預防 B 型血友病患者出血；factor VIII concentrate，治療與預防 von Willebrand disease 患者出血",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Clopidogrel",
    "category": "血液腫瘤科 > 抗血小板 > ADP P2Y12拮抗",
    "mechanism": "不可逆阻斷P2Y12 ADP受器，抑制血小板活化",
    "indications": "ACS、中風/周邊動脈疾病或支架後抗血小板",
    "effects": "不可逆阻斷P2Y12 ADP受器，抑制血小板凝集；前驅藥需肝臟活化",
    "mnemonic": "p.96: Clopidogrel可柔批鬥貴兒(-grel)，踢他又摳他(ticlo-)\np.96: 怕輸哥(Prasugrel)和臭屁哥(Clopidogrel)想要買一塊A級的地皮(ADP-R)，但是地(Ti-)檢署說(-clo-) 那塊地皮(-pidine)有鬧鬼(Ticlopidine最易導致neutropenia)不能出售，怕輸哥聽到後生氣到被氣死 (SE: 想像臉紅紅=Prasugrel最易出血)，但是臭屁哥聽到消息承受得住(用於冠狀動脈放支架，心導管術前)\np.96: ***想tickle(ticlo-)她，摳她屁洞(clopidogrel)，persuade(Prasugrel)她跟我做。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Rofecoxib",
    "category": "風濕免疫科 > NSAID > COX-2選擇性",
    "mechanism": "選擇性抑制COX-2，降低發炎性PG生成",
    "indications": "發炎疼痛、氣喘、肺高壓或胃黏膜保護（依藥物）",
    "effects": "降低前列腺素生成，解熱、止痛、抗發炎；PDF重點：抗發炎、抗血小板作用弱",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Levamisole",
    "category": "風濕免疫科 > 免疫增強劑",
    "mechanism": "免疫調節/增強T細胞功能",
    "indications": "原為抗蟲藥，後發現可促淋巴球",
    "effects": "促進神經傳遞物質或內分泌/代謝反應；PDF重點：增加免疫；化療後(嗜中性球↑)",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Leflunomide",
    "category": "風濕免疫科 > 免疫抑制/抗代謝",
    "mechanism": "代謝為teriflunomide，抑制dihydroorotate dehydrogenase，減少pyrimidine合成",
    "indications": "自體免疫疾病、器官移植排斥或發炎疾病",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Sulfinpyrazone",
    "category": "風濕免疫科 > 痛風 > 促尿酸排泄",
    "mechanism": "抑制近曲小管尿酸再吸收，增加尿酸排泄",
    "indications": "急性痛風、慢性高尿酸血症或腫瘤溶解症預防",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號",
    "mnemonic": "p.86: 蘇菲(sulfin-)開benz(benzbro-)走進一家利息很pro(高)的bank(probenecid)，尿尿(-urinol) Anakinra 原本用於RA，抑制IL 1α and IL 1β的活性",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Decamethonium",
    "category": "麻醉科 > 神經肌肉阻斷劑 > 去極化",
    "mechanism": "Nm受器致效造成持續去極化，進而阻斷神經肌肉傳遞",
    "indications": "氣喘/COPD、動暈、尿失禁、帕金森/EPS或散瞳（依藥物）",
    "effects": "活化對應受器，產生受器相關生理效應",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Estradiol",
    "category": "內分泌/新陳代謝 > 性激素 > Estrogen",
    "mechanism": "Estrogen receptor致效",
    "indications": "促血栓(factor2,7,9,10)；可改善停經的症狀(熱潮紅)；乳癌；子宮內膜癌↑(107-2)",
    "effects": "活化對應受器，產生受器相關生理效應；PDF重點：HDL↑LDL↓；減少骨質流失",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Cortisone",
    "category": "內分泌/新陳代謝 > 腎上腺皮質醇 > 短效Glucocorticoid",
    "mechanism": "活化glucocorticoid receptor，抑制發炎與免疫反應",
    "indications": "發炎/免疫疾病、腎上腺功能異常或替代治療",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號；PDF重點：免疫抑制時用(移植)；生長抑制、",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Entecavir",
    "category": "感染科 > 抗HBV > 核苷/核苷酸類似物",
    "mechanism": "Guanosine類似物；抑制HBV polymerase",
    "indications": "治療產生HBeAg 血清轉換持久性較高",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Cefadroxil",
    "category": "感染科 > 抗生素 > Cephalosporin第一代",
    "mechanism": "β-lactam；抑制PBP/細胞壁合成",
    "indications": "手術前預防用藥首選(106-1)；手術是一種蹂躪(Cefa-zolin)，術前預防性用藥。",
    "effects": "抑制細菌細胞壁、蛋白質、核酸或葉酸代謝",
    "mnemonic": "p.105: 有人來信(Cephalexin)，叫我去濁水溪(Cefadroxil)揍人(Cefazoline)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Cefpodoxime",
    "category": "感染科 > 抗生素 > Cephalosporin第三代",
    "mechanism": "β-lactam；抑制PBP/細胞壁合成",
    "indications": "細菌感染治療（菌種依藥物光譜）",
    "effects": "抑制細菌細胞壁、蛋白質、核酸或葉酸代謝",
    "mnemonic": "p.106: 波多野結衣(cefpodoxime)說fuck me(cefixime)害我不能思考(進不到BBB)；她說：『吹爽(ceftriaxone)我 還有fuck me(cefixime)』結果看到有淋病(淋病藥首選)，我很兇的叫她立定(ceftazidime)結果綠膿流出來 (第三代唯一治綠膿)，她還說因為我吹爽(ceftriaxone)她，所以要付稅給我(cefotaxime)真是腦壞掉(治腦膜 炎)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Chloroquine",
    "category": "感染科 > 抗蟲 > 抗瘧",
    "mechanism": "抑制heme polymerase，使heme毒性累積",
    "indications": "預防；抗性惡性瘧；可用於孕婦",
    "effects": "依蟲種破壞寄生蟲神經肌肉/微管或代謝，使蟲體麻痺或死亡；PDF重點：低血糖",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Mefloquine",
    "category": "感染科 > 抗蟲 > 抗瘧",
    "mechanism": "干擾寄生蟲heme處理",
    "indications": "預防；抗性惡性瘧；可用於孕婦",
    "effects": "依蟲種破壞寄生蟲神經肌肉/微管或代謝，使蟲體麻痺或死亡",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Nefazodone",
    "category": "神經/精神科 > 抗憂鬱 > SARI",
    "mechanism": "阻斷5-HT2受器並抑制5-HT再回收",
    "indications": "憂鬱症、焦慮症或神經痛/偏頭痛預防（依藥物）",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）；PDF重點：抑制5HT2A-R 和SERT",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Fluvoxamine",
    "category": "神經/精神科 > 抗憂鬱 > SSRI",
    "mechanism": "選擇性抑制SERT，增加突觸間5-HT",
    "indications": "睡、體重增加、頭痛；禁突然停藥(眩暈失眠疲倦噁心焦慮寒顫頭痛等戒斷症狀)",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Hydroxyzine",
    "category": "神經/精神科 > 抗焦慮/鎮靜安眠 > H1阻斷",
    "mechanism": "第一代H1受器反向致效/拮抗，具鎮靜與抗膽鹼作用",
    "indications": "單純焦慮解除劑，無法作為安眠藥使用；安眠，作用於melatonin receptor(107-1)",
    "effects": "阻斷M受器，減少腺體分泌與平滑肌收縮；可散瞳、心跳上升、支氣管擴張",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Dicyclomine",
    "category": "神經/精神科 > 膽鹼性拮抗劑 > 胃腸Muscarinic阻斷",
    "mechanism": "Muscarinic受器阻斷，減少腸胃平滑肌痙攣/分泌",
    "indications": "減少腸胃蠕動、作為止瀉藥",
    "effects": "阻斷M受器，減少腺體分泌與平滑肌收縮；可散瞳、心跳上升、支氣管擴張；PDF重點：減少腸胃蠕動、作為止瀉藥",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Unoprostone",
    "category": "神經/精神科 > 青光眼用藥 > PGF2α類似物",
    "mechanism": "PGF2α類似物，增加房水葡萄膜鞏膜流出",
    "indications": "未在PDF同列明確標示；依分類臨床適應症複習",
    "effects": "依其機轉產生對應藥理作用；請搭配適應症與考點複習",
    "mnemonic": "p.60: 可知此二者為青光眼用藥。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Certolizumab",
    "category": "腸胃科 > IBD > Anti-TNF",
    "mechanism": "中和TNF-α",
    "indications": "腸胃蠕動異常、嘔吐、便祕/腹瀉、IBD或IBS（依藥物）",
    "effects": "依其機轉產生對應藥理作用；請搭配適應症與考點複習",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Dimenhydrinate",
    "category": "腸胃科 > 止吐 > H1阻斷",
    "mechanism": "H1受器阻斷並有抗M作用，抑制前庭相關嘔吐",
    "indications": "過敏/蕁麻疹、動暈或胃酸相關疾病（依受器）",
    "effects": "阻斷對應受器或通道，降低該路徑效應",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Dicyclomine",
    "category": "腸胃科 > 止瀉劑 > M3阻斷",
    "mechanism": "阻斷M3，減少腸道痙攣",
    "indications": "(也降膽固醇)",
    "effects": "阻斷對應受器或通道，降低該路徑效應；PDF重點：M3 阻斷；(也降膽固醇)",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Kaolin-Pectin",
    "category": "腸胃科 > 止瀉劑 > 吸附劑",
    "mechanism": "吸附細菌/毒素並增加糞便稠度",
    "indications": "吸水性強，降低糞便流動性；感之Ach 釋出，不可止痛)；兩者皆專用於止瀉，不具止痛作用",
    "effects": "依其機轉產生對應藥理作用；請搭配適應症與考點複習；PDF重點：吸水性強，降低糞便流動性；減少蠕動",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Unoprostone",
    "category": "自泌素 > Eicosanoid > PGF2α類似物/青光眼",
    "mechanism": "PGF2α類似物，增加房水流出、降眼壓",
    "indications": "發炎疼痛、氣喘、肺高壓或胃黏膜保護（依藥物）",
    "effects": "依其機轉產生對應藥理作用；請搭配適應症與考點複習",
    "mnemonic": "p.60: 可知此二者為青光眼用藥。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Dimenhydrinate",
    "category": "自泌素 > Histamine > 第一代H1阻斷",
    "mechanism": "H1受器反向致效/拮抗，較易過BBB且有抗M作用",
    "indications": "(1)治動暈症、幫助睡眠(114-2)、治孕；可做成止癢軟膏、可緩解藥物引起的；可用於懷孕婦女的噁心嘔吐；抗膽鹼作用",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Hydroxyzine",
    "category": "自泌素 > Histamine > 第一代H1阻斷",
    "mechanism": "H1受器反向致效/拮抗，較易過BBB且有抗M作用",
    "indications": "(2)可抗帕金森氏",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Tolmetin",
    "category": "風濕免疫科 > NSAID > Acetic acid類",
    "mechanism": "可逆抑制COX-1/2，降低PG生成",
    "indications": "無法治痛風",
    "effects": "降低RAAS作用，血管擴張、降醛固酮並保護心腎",
    "mnemonic": "p.84: 阿死(Asp-)~痛沒停(tolmetin)🡺痛風無效、痛風別用",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Antilymphocyte globulin",
    "category": "風濕免疫科 > 免疫抑制 > 抗淋巴球抗體",
    "mechanism": "多株抗T細胞/淋巴球抗體，造成淋巴球耗竭",
    "indications": "自體免疫疾病、器官移植排斥或發炎疾病",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號；PDF重點：抑制最上游",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Antithymocyte globulin",
    "category": "風濕免疫科 > 免疫抑制 > 抗淋巴球抗體",
    "mechanism": "多株抗T細胞/淋巴球抗體，造成淋巴球耗竭",
    "indications": "自體免疫疾病、器官移植排斥或發炎疾病",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號；PDF重點：抑制最上游",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Certolizumab",
    "category": "風濕免疫科 > 生物製劑 > Anti-TNF",
    "mechanism": "抗TNF-α單株抗體/片段，中和TNF",
    "indications": "未在PDF同列明確標示；依分類臨床適應症複習",
    "effects": "依其機轉產生對應藥理作用；請搭配適應症與考點複習",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Oxaprozin",
    "category": "風濕免疫科 > 痛風 > NSAID",
    "mechanism": "NSAID，可逆抑制COX",
    "indications": "促尿酸排泄→治痛風；解熱強、可治(關閉)PDA (109-1)；抗發炎強(治痛風佳)(抑制；Phospholipase A/C，降低嗜中性",
    "effects": "降低前列腺素生成，解熱、止痛、抗發炎；PDF重點：同時抑制COX、LOX(106-1)；抗發炎強(治痛風佳)(抑制",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Moxifloxacin",
    "category": "感染科 > 抗生素 > Fluoroquinolones",
    "mechanism": "抑制DNA gyrase與topoisomerase IV",
    "indications": "抗厭氧菌",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）；PDF重點：G(-)↓",
    "mnemonic": "p.113: 乾弟(Gati-)跑來我家借米(Gemi-)， 說是拜魔神仔(Moxi-)的啦(Dela-)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Nitrofurantoin",
    "category": "感染科 > 抗生素 > 尿路抗菌",
    "mechanism": "細菌還原後產生活性中間物，損傷DNA/蛋白",
    "indications": "細菌感染治療（菌種依藥物光譜）",
    "effects": "干擾DNA/RNA或細胞分裂，產生細胞毒性",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Trifluridine",
    "category": "感染科 > 抗病毒 > HSV眼用",
    "mechanism": "胸苷類似物，抑制viral DNA合成",
    "indications": "僅局部使用於HSV 造成之角膜；抗CMV(HHV-5)；抗HSV、VZV、CMV 首選；也可治療有抗性的HSV, VZV",
    "effects": "干擾DNA/RNA或細胞分裂，產生細胞毒性；PDF重點：僅局部使用於HSV 造成之角膜；骨髓抑制",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Artemisinin",
    "category": "感染科 > 抗蟲 > 抗瘧",
    "mechanism": "含endoperoxide橋，產生自由基殺蟲",
    "indications": "預防；抗性惡性瘧；可用於孕婦",
    "effects": "依蟲種破壞寄生蟲神經肌肉/微管或代謝，使蟲體麻痺或死亡",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Metyrosine",
    "category": "神經/精神科 > 交感神經阻斷劑 > Catecholamine合成抑制",
    "mechanism": "抑制tyrosine hydroxylase，降低catecholamine合成",
    "indications": "高血壓、BPH、嗜鉻細胞瘤或雷諾氏現象（依選擇性）",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "p.14: 沒Tyrosine (Metyrosine)🡺抑制Tyrosine",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Reserpine",
    "category": "神經/精神科 > 交感神經阻斷劑 > 交感神經末梢抑制",
    "mechanism": "抑制VMAT，使NE/DA/5-HT囊泡儲存下降",
    "indications": "降血壓",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）；PDF重點：NE、5-HT、DA↓；降血壓",
    "mnemonic": "p.14: 雷射筆(reserpine)不讓DA進入",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "MDMA",
    "category": "神經/精神科 > 成癮物質/藥物",
    "mechanism": "促進5-HT、NE、DA釋放並抑制再回收",
    "indications": "偏頭痛、止吐、腸胃蠕動或精神科適應症（依受器）",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）；PDF重點：Amphetamine 衍生物，抑制SERT→成癮性較弱",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Propafenone",
    "category": "心臟科 > 抗心律不整 > Class IC",
    "mechanism": "強效阻斷Na+通道，明顯抑制phase 0",
    "indications": "心律不整治療",
    "effects": "抑制電位依賴性鈉通道，降低神經或心肌興奮性",
    "mnemonic": "p.54: C=吸：肥子、抑制phase0：強、QT：不變 不怕肥呢(Propafenone)就可以吸(音同C)肥可奶(Flecainide)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Lisinopril",
    "category": "心臟科 > 降血壓 > ACEI",
    "mechanism": "抑制ACE，使Angiotensin II下降、Bradykinin上升",
    "indications": "降低腎動脈壓)",
    "effects": "降低RAAS作用，血管擴張、降醛固酮並保護心腎；PDF重點：(血管舒張)；(腎動脈舒張",
    "mnemonic": "p.49: 有人出ACE(ACEI)，我”呸!(-pril)”，我有更大的牌! 呸完噎到🡺一直咳嗽(SE)\np.49: ACE念起來跟ass很像，ass就是屁喔(-pril)\np.49: ACE餅乾(ACEI)很難吃，呸(pril)~吐掉\np.49: 這是一個打怪的故事： 第一關：怪物是愛斯基摩人(Aliskiren)因為是人所以造成畸胎(SE)。 第二關：怪物是屁怪(-pril)，會放屁攻擊你造成咳嗽(SE)。 BOSS關：怪物是撒旦(-sartan)，因為撒旦太強，所以無皮保護作用(特性)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Ritonavir",
    "category": "感染科 > 抗COVID-19 > Protease inhibitor",
    "mechanism": "Nirmatrelvir抑制SARS-CoV-2 3CL protease；ritonavir抑制CYP3A增強濃度",
    "indications": "病毒感染治療或預防",
    "effects": "抑制病毒複製、成熟或進入宿主細胞",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Ritonavir",
    "category": "感染科 > 抗HIV > Protease inhibitor",
    "mechanism": "抑制HIV protease，阻止病毒多蛋白切割成熟",
    "indications": "病毒感染治療或預防",
    "effects": "抑制病毒複製、成熟或進入宿主細胞",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Levofloxacin",
    "category": "感染科 > 抗生素 > Fluoroquinolones",
    "mechanism": "抑制DNA gyrase與topoisomerase IV",
    "indications": "細菌感染治療（菌種依藥物光譜）",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Cloxacillin",
    "category": "感染科 > 抗生素 > Penicillinase-resistant penicillins",
    "mechanism": "β-lactam；抑制PBP，且較耐penicillinase",
    "indications": "Amoxicillin 不受食物影響，很常使用，用以治鏈球菌咽喉",
    "effects": "抑制細菌細胞壁、蛋白質、核酸或葉酸代謝",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Sulfadoxine",
    "category": "感染科 > 抗生素 > Sulfonamide",
    "mechanism": "PABA類似物，競爭性抑制dihydropteroate synthase",
    "indications": "TMP)合併治瘧疾、弓形",
    "effects": "抑制細菌細胞壁、蛋白質、核酸或葉酸代謝",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Methenamine",
    "category": "感染科 > 抗生素 > 尿路抗菌",
    "mechanism": "酸性尿中分解為formaldehyde，殺菌",
    "indications": "細菌感染治療（菌種依藥物光譜）",
    "effects": "抑制細菌細胞壁、蛋白質、核酸或葉酸代謝",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Foscarnet",
    "category": "感染科 > 抗病毒 > Pyrophosphate analog",
    "mechanism": "直接抑制viral DNA polymerase/RT之pyrophosphate binding site",
    "indications": "※Trifluridine, Docosanol(tropical use：治Keratoconjunctivity)",
    "effects": "干擾DNA/RNA或細胞分裂，產生細胞毒性",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Albendazole",
    "category": "感染科 > 抗蟲 > 線蟲",
    "mechanism": "結合β-tubulin，抑制微小管聚合與葡萄糖攝取",
    "indications": "寄生蟲/原蟲感染治療",
    "effects": "依蟲種破壞寄生蟲神經肌肉/微管或代謝，使蟲體麻痺或死亡",
    "mnemonic": "p.116: 蓋地板(台語，起頭咖)(Ketoco-)對阿祖(-azole)來說是一種苦行(Cushing)，可以治Cushing syndrome\np.116: 阿祖(-azole)看到爛(lanosterol)人很不爽，他踢他屁屁(P450)，剁他耳朵(ergosterol)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Guanethidine",
    "category": "神經/精神科 > 交感神經阻斷劑 > 交感神經末梢抑制",
    "mechanism": "進入交感神經末梢並抑制NE釋放",
    "indications": "降血壓",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）；PDF重點：抑制NE 釋出；降血壓",
    "mnemonic": "p.14: 掛念(Guane)你，不讓你走(小泡釋放) / 關你(Guane) 🡺小泡關起來，不釋放",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Isocarboxazid",
    "category": "神經/精神科 > 抗憂鬱 > MAOI",
    "mechanism": "非選擇性抑制MAO-A與MAO-B，增加NE/5-HT/DA",
    "indications": "憂鬱症、焦慮症或神經痛/偏頭痛預防（依藥物）",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Phenelzine",
    "category": "神經/精神科 > 抗憂鬱 > MAOI",
    "mechanism": "非選擇性抑制MAO-A與MAO-B，增加NE/5-HT/DA",
    "indications": "憂鬱症、焦慮症或神經痛/偏頭痛預防（依藥物）",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）；PDF重點：造成似安非他命興奮中樞效果→少用；5-HT、DA↑",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Ziprasidone",
    "category": "神經/精神科 > 抗精神病 > 非典型",
    "mechanism": "主要阻斷D2與5-HT2A受器",
    "indications": "思覺失調症、躁症、Tourette症或止吐（依藥物）",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "p.29: -idone我做了-：在瑞士(Risper-)我做了(-i done)兩隻斑馬(zipra-)，一隻叫serotonin、一隻叫 dopamine。\np.29: SE： Ziprasidone：斑馬(Zipra-)有四條 (quadra) 很長(long)的腿(thigh)= QT prolong； Risperidone：律師陪你動=雖然有點不好，但可以想成，如果精神病患者有一些法律糾紛，就需要律師陪你動= 治精神分裂症第一線用藥，SE：EPS(陪你動)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Tizanidine",
    "category": "神經/精神科 > 擬交感神經藥物 > α2致效劑",
    "mechanism": "中樞α2受器致效，抑制脊髓興奮性神經傳遞",
    "indications": "消皺紋、治食道弛緩不能",
    "effects": "降低中樞交感輸出或增加NE釋放（依致效/拮抗）；PDF重點：抑制SNAP 融合蛋白，使突觸囊泡不可逆抑制Ach",
    "mnemonic": "p.11: 梅西多怕(Methydopa)孕婦懷孕(治療孕婦高血壓)和被摸(Brimo-)到眼睛(治青光眼)，摸他眼睛的人是一個克 隆(=隆乳)你的ㄋㄟ(Clonidine)的人，所以他就踢在你的ㄋㄟ(Tizanidine)讓他中間鬆掉(中樞性鬆弛劑)\np.11: 梅西(Methy-)、克隆尼(Clonidine)和泰山(Tizanidine)在阿二麻辣食堂(α2)吃飯，但是他們沒有揪西屏",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Terbutaline",
    "category": "神經/精神科 > 擬交感神經藥物 > β2安胎藥",
    "mechanism": "β2受器致效，使子宮平滑肌鬆弛",
    "indications": "短效、安胎；治夜間氣；喘首選；安胎 利得胎",
    "effects": "支氣管平滑肌放鬆；可有心悸、低血鉀、高血糖",
    "mnemonic": "p.11: OL(-ol)他令(terbutaline)你脫(rito-)~~~太excited很喘~~~作為支氣管擴張劑，但其實它令你脫",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Procaterol",
    "category": "神經/精神科 > 擬交感神經藥物 > β2短效致效劑",
    "mechanism": "β2受器致效，活化Gs/cAMP使支氣管或子宮平滑肌鬆弛",
    "indications": "治夜間氣；喘首選；安胎 利得胎；裡頭定 →安胎",
    "effects": "支氣管平滑肌放鬆；可有心悸、低血鉀、高血糖",
    "mnemonic": "p.62: 短效：阿布(albu)牌渦輪(terbut-)很terrible(-terol)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Salbutamol",
    "category": "神經/精神科 > 擬交感神經藥物 > β2短效致效劑",
    "mechanism": "β2受器致效，活化Gs/cAMP使支氣管或子宮平滑肌鬆弛",
    "indications": "氣喘/COPD支氣管痙攣；部分藥物可安胎",
    "effects": "支氣管平滑肌放鬆；可有心悸、低血鉀、高血糖；PDF重點：β2 agonist 會升血糖",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Terbutaline",
    "category": "神經/精神科 > 擬交感神經藥物 > β2短效致效劑",
    "mechanism": "β2受器致效，活化Gs/cAMP使支氣管或子宮平滑肌鬆弛",
    "indications": "短效、安胎；治夜間氣；喘首選；安胎 利得胎",
    "effects": "支氣管平滑肌放鬆；可有心悸、低血鉀、高血糖",
    "mnemonic": "p.11: OL(-ol)他令(terbutaline)你脫(rito-)~~~太excited很喘~~~作為支氣管擴張劑，但其實它令你脫",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Buprenorphine",
    "category": "神經/精神科 > 類鴉片止痛劑 > 部分μ致效",
    "mechanism": "μ受器部分致效、κ受器拮抗",
    "indications": "戒斷症狀較輕、持續時間較短，漸取代Methadone 成為Morphine 戒斷替",
    "effects": "活化對應受器，產生受器相關生理效應",
    "mnemonic": "p.39: 不偷肥肉(Buto-phanol)，也不想變弱貧(Bu-pre-norphine)，所以應徵到了幾間麥當勞(partial μ agonist)盤子拿不平(Nal-buphine)，還騙他走心(Penta-zocine)，職位被卡掉(κ agonist)，連麥當",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Procaterol",
    "category": "胸腔科 > 抗氣喘 > β2短效致效",
    "mechanism": "β2受器致效，促進cAMP使支氣管平滑肌鬆弛",
    "indications": "氣喘/COPD維持或急性支氣管痙攣緩解",
    "effects": "支氣管平滑肌放鬆；可有心悸、低血鉀、高血糖",
    "mnemonic": "p.62: 短效：阿布(albu)牌渦輪(terbut-)很terrible(-terol)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Salbutamol",
    "category": "胸腔科 > 抗氣喘 > β2短效致效",
    "mechanism": "β2受器致效，促進cAMP使支氣管平滑肌鬆弛",
    "indications": "氣喘/COPD維持或急性支氣管痙攣緩解",
    "effects": "支氣管平滑肌放鬆；可有心悸、低血鉀、高血糖",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Terbutaline",
    "category": "胸腔科 > 抗氣喘 > β2短效致效",
    "mechanism": "β2受器致效，促進cAMP使支氣管平滑肌鬆弛",
    "indications": "氣喘/COPD維持或急性支氣管痙攣緩解",
    "effects": "支氣管平滑肌放鬆；可有心悸、低血鉀、高血糖",
    "mnemonic": "p.11: OL(-ol)他令(terbutaline)你脫(rito-)~~~太excited很喘~~~作為支氣管擴張劑，但其實它令你脫",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Pancuronium",
    "category": "麻醉科 > 神經肌肉阻斷劑 > 非去極化",
    "mechanism": "競爭性Nm受器拮抗，阻斷骨骼肌神經肌肉傳遞",
    "indications": "氣喘/COPD、動暈、尿失禁、帕金森/EPS或散瞳（依藥物）",
    "effects": "阻斷對應受器或通道，降低該路徑效應",
    "mnemonic": "p.19: Panic(Panc-)的感覺🡺有以下副作用：心跳↑、血壓↑ Vecuronium 無His釋 解毒：Sugammadex 放 Rocuronium 肝臟代謝\np.19: 用平底鍋(Pan-)煎肥肉(Ve-,Ro-)，很油要洗很久，還會剩⼀咪咪油漬(抑制迷走) 去極化型(非競爭型)強效Ach-R agonist",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Fulvestrant",
    "category": "內分泌/新陳代謝 > 性激素 > Pure ER antagonist",
    "mechanism": "純estrogen receptor拮抗並促進ER降解",
    "indications": "可治乳癌；用於治療使用",
    "effects": "活化對應受器，產生受器相關生理效應",
    "mnemonic": "p.80: 穿全套背心(Ful-vest-) 包緊緊就沒女人味(抑雌)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Enalapril",
    "category": "心臟科 > 降血壓 > ACEI",
    "mechanism": "抑制ACE，使Angiotensin II下降、Bradykinin上升",
    "indications": "糖尿病腎病變；降低腎動脈壓)",
    "effects": "降低RAAS作用，血管擴張、降醛固酮並保護心腎；PDF重點：Bradykinin↑；(血管舒張)",
    "mnemonic": "p.49: 有人出ACE(ACEI)，我”呸!(-pril)”，我有更大的牌! 呸完噎到🡺一直咳嗽(SE)\np.49: ACE念起來跟ass很像，ass就是屁喔(-pril)\np.49: ACE餅乾(ACEI)很難吃，呸(pril)~吐掉\np.49: 這是一個打怪的故事： 第一關：怪物是愛斯基摩人(Aliskiren)因為是人所以造成畸胎(SE)。 第二關：怪物是屁怪(-pril)，會放屁攻擊你造成咳嗽(SE)。 BOSS關：怪物是撒旦(-sartan)，因為撒旦太強，所以無皮保護作用(特性)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Felodipine",
    "category": "心臟科 > 降血壓/CCB > DHP",
    "mechanism": "阻斷L-type Ca2+通道，以血管平滑肌舒張為主",
    "indications": "高血壓；部分用於心衰竭、腎保護或心絞痛",
    "effects": "調節鈣離子通道/骨代謝/血管平滑肌收縮；PDF重點：心臟抑制(後兩者)；低頻(-dipine)聲音會阻止Ca2+ 抑血管收縮",
    "mnemonic": "p.49: 低頻(-dipine)聲音會阻止Ca2+ 抑血管收縮",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Vardenafil",
    "category": "心臟科 > 降血壓/肺高壓 > PDE5抑制",
    "mechanism": "抑制PDE5，使cGMP上升，平滑肌鬆弛",
    "indications": "孕婦高血壓；治療肺動脈高壓；胞接受體的結抗劑",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Spectinomycin",
    "category": "感染科 > 抗生素 > Aminocyclitol",
    "mechanism": "結合30S，抑制蛋白質合成",
    "indications": "細菌感染治療（菌種依藥物光譜）",
    "effects": "抑制細菌細胞壁、蛋白質、核酸或葉酸代謝",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Pentamidine",
    "category": "感染科 > 抗蟲 > 原蟲",
    "mechanism": "干擾DNA/RNA/蛋白合成",
    "indications": "寄生蟲/原蟲感染治療",
    "effects": "依蟲種破壞寄生蟲神經肌肉/微管或代謝，使蟲體麻痺或死亡",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Pamaquine",
    "category": "感染科 > 抗蟲 > 抗瘧",
    "mechanism": "8-aminoquinoline類；產生活性氧，作用於肝內型/配子體",
    "indications": "寄生蟲/原蟲感染治療",
    "effects": "依蟲種破壞寄生蟲神經肌肉/微管或代謝，使蟲體麻痺或死亡",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Pentaquine",
    "category": "感染科 > 抗蟲 > 抗瘧",
    "mechanism": "8-aminoquinoline類；產生活性氧，作用於肝內型/配子體",
    "indications": "寄生蟲/原蟲感染治療",
    "effects": "依蟲種破壞寄生蟲神經肌肉/微管或代謝，使蟲體麻痺或死亡",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Proguanil",
    "category": "感染科 > 抗蟲 > 抗瘧",
    "mechanism": "Atovaquone抑制粒線體cytochrome bc1；Proguanil抑制DHFR",
    "indications": "寄生蟲/原蟲感染治療",
    "effects": "依蟲種破壞寄生蟲神經肌肉/微管或代謝，使蟲體麻痺或死亡",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Suramin",
    "category": "感染科 > 抗蟲 > 非洲錐蟲",
    "mechanism": "抑制寄生蟲能量代謝酵素",
    "indications": "寄生蟲/原蟲感染治療",
    "effects": "依蟲種破壞寄生蟲神經肌肉/微管或代謝，使蟲體麻痺或死亡",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Flucytosine",
    "category": "感染科 > 抗黴菌 > Pyrimidine analog",
    "mechanism": "轉為5-FU，抑制DNA/RNA合成",
    "indications": "作用於有絲分裂",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）；PDF重點：骨髓抑制",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Phenoxybenzamine",
    "category": "神經/精神科 > 交感神經阻斷劑 > 非選擇性α阻斷",
    "mechanism": "不可逆α1/α2受器阻斷",
    "indications": "治療",
    "effects": "血管/括約肌收縮；阻斷時則血管與前列腺平滑肌放鬆；PDF重點：反射性HR↑",
    "mnemonic": "p.13: 有個性(用在嗜鉻性細胞瘤pheochromocytoma)的糞系辦(Phenoxyben-)需要被治療，偏頭\np.13: 片頭(Phento-)，所以用作診斷；Phenoxy-用作治療",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Phentolamine",
    "category": "神經/精神科 > 交感神經阻斷劑 > 非選擇性α阻斷",
    "mechanism": "可逆性α1/α2受器阻斷",
    "indications": "高血壓、BPH、嗜鉻細胞瘤或雷諾氏現象（依選擇性）",
    "effects": "血管/括約肌收縮；阻斷時則血管與前列腺平滑肌放鬆",
    "mnemonic": "p.13: 片頭(Phento-)，所以用作診斷；Phenoxy-用作治療",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Rasagiline",
    "category": "神經/精神科 > 抗帕金森 > MAO-B抑制",
    "mechanism": "選擇性抑制MAO-B，減少DA代謝",
    "indications": "帕金森氏症或藥物誘發EPS",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號",
    "mnemonic": "p.30: 茂伯(MAOb)很機靈(-giline)，會收垃圾(rasa-)討好犀利(sele-)人妻，有DA(DA致效)男人的樣子\np.30: 史萊哲林(selegiline)都很會喇賽(rasa-)和裝逼(MAO-B)\np.31: 吉林(-giline)很冷，貓咪(MAO B)不喜歡(抑制)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Clomipramine",
    "category": "神經/精神科 > 抗憂鬱 > TCA",
    "mechanism": "抑制NET與SERT，增加NE與5-HT；另有M1/H1/α1阻斷",
    "indications": "鎮靜作用強(抗H1；抗H1：增重、嗜睡、鎮靜；抗α1：姿態性低血壓、心搏過速、嗜睡；預防偏頭痛",
    "effects": "血管/括約肌收縮；阻斷時則血管與前列腺平滑肌放鬆；PDF重點：鎮靜作用強(抗H1；抗H1：增重、嗜睡、鎮靜",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Desipramine",
    "category": "神經/精神科 > 抗憂鬱 > TCA",
    "mechanism": "抑制NET與SERT，增加NE與5-HT；另有M1/H1/α1阻斷",
    "indications": "抗M1：口乾、便祕、尿液滯留(可治夜尿)、視；鎮靜作用強(抗H1；抗H1：增重、嗜睡、鎮靜；抗α1：姿態性低血壓、心搏過速、嗜睡",
    "effects": "血管/括約肌收縮；阻斷時則血管與前列腺平滑肌放鬆；PDF重點：鎮靜作用強(抗H1；抗H1：增重、嗜睡、鎮靜",
    "mnemonic": "p.25: 我是黛西(Im-, Desi-)，叫我(Clo-mi-)小戴就好，我發誓(-i-pramine)這趟台灣環島(TCA) 會很充實，不是(Nor-)專業(Pro-)的登山者建議要多帶衣物， 因為寒流到了，所以這趟旅行會太 冷(-trip-tyline)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Alprazolam",
    "category": "神經/精神科 > 抗焦慮/鎮靜安眠 > Benzodiazepines",
    "mechanism": "GABA_A受器正向變構調節；增加Cl-通道開啟頻率",
    "indications": "治療恐慌症、懼曠症首選；抗憂鬱症",
    "effects": "增強GABA-A抑制性傳導，鎮靜、抗焦慮、抗癲癇",
    "mnemonic": "p.21: 都是女生的名字： 6. onset速度： 歐普拉(alpra-)、蘿拉(Lora-)、伊斯塔 Triazolam>Diazepam>Chlordiazepoxide> (Esta-)、提瑪(tema-)會俘虜你(fluni-)的 Oxazapam、Lorazepam、Temazapam 心 (106-2)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Flunitrazepam",
    "category": "神經/精神科 > 抗焦慮/鎮靜安眠 > Benzodiazepines",
    "mechanism": "GABA_A受器正向變構調節；增加Cl-通道開啟頻率",
    "indications": "焦慮、失眠、鎮靜、抗癲癇或麻醉誘導（依藥物）",
    "effects": "增強GABA-A抑制性傳導，鎮靜、抗焦慮、抗癲癇",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Prazepam",
    "category": "神經/精神科 > 抗焦慮/鎮靜安眠 > Benzodiazepines",
    "mechanism": "GABA_A受器正向變構調節；增加Cl-通道開啟頻率",
    "indications": "最長效、戒斷最不明顯",
    "effects": "增強GABA-A抑制性傳導，鎮靜、抗焦慮、抗癲癇",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Thioridazine",
    "category": "神經/精神科 > 抗精神病 > 傳統/典型",
    "mechanism": "D2受器拮抗",
    "indications": "抗H1：增重、嗜睡、鎮靜；抗α1：姿態性低血壓、心搏過速、嗜睡；止吐：Prochlorperazine (Novamin)；治Tourette’s syndrome、",
    "effects": "調節多巴胺傳導，影響精神症狀、EPS、泌乳或帕金森症狀；PDF重點：鎮靜",
    "mnemonic": "p.28: 傳統分兩群： 第一群：姑婆媽(Chlorpromazine)是雷達 (Thioridazine)，專門製造謠言，所以副作用很多(M1/H1/α1 blocker) 第二群：哈囉陪你度 (Haloperidol) 過流感飛那時(Fluphenazine)，副作用是EPS。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Risperidone",
    "category": "神經/精神科 > 抗精神病 > 非典型",
    "mechanism": "主要阻斷D2與5-HT2A受器",
    "indications": "思覺失調症、躁症、Tourette症或止吐（依藥物）",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "p.29: -idone我做了-：在瑞士(Risper-)我做了(-i done)兩隻斑馬(zipra-)，一隻叫serotonin、一隻叫 dopamine。\np.29: SE： Ziprasidone：斑馬(Zipra-)有四條 (quadra) 很長(long)的腿(thigh)= QT prolong； Risperidone：律師陪你動=雖然有點不好，但可以想成，如果精神病患者有一些法律糾紛，就需要律師陪你動= 治精神分裂症第一線用藥，SE：EPS(陪你動)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Hemicholinium",
    "category": "神經/精神科 > 神經肌肉/毒素",
    "mechanism": "抑制膽鹼再攝取，降低ACh合成",
    "indications": "未在PDF同列明確標示；依分類臨床適應症複習",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號",
    "mnemonic": "p.20: H(hemi-)ate choline🡺抑制攝入choline",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Clidinium",
    "category": "神經/精神科 > 膽鹼性拮抗劑 > 胃腸Muscarinic阻斷",
    "mechanism": "Muscarinic受器阻斷，減少腸胃平滑肌痙攣/分泌",
    "indications": "治腹絞痛、腸躁症；氣喘、COPD",
    "effects": "阻斷M受器，減少腺體分泌與平滑肌收縮；可散瞳、心跳上升、支氣管擴張",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Echothiophate",
    "category": "神經/精神科 > 膽鹼性致效劑 > 不可逆AChE抑制",
    "mechanism": "有機磷類不可逆抑制AChE",
    "indications": "→長效治青光眼；Pralidoxime：依林(AChE inh 磷中毒的解毒劑)中毒好了之後穿得趴哩趴哩(Prali)",
    "effects": "活化對應受器，產生受器相關生理效應",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Dihydroergotamine",
    "category": "神經/精神科 > 頭痛用藥 > Ergot類",
    "mechanism": "5-HT1B/1D受器致效，造成顱內血管收縮",
    "indications": "5-HT1B：血管收縮 (血管收縮可緩解與顱內血管擴張相關的頭痛)",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）；PDF重點：5-HT1B：血管收縮 (血管收縮可緩解與顱內血管擴張相關的頭痛)；5-HT1D：抑制CGRP (抑制三叉神經末梢釋放神經胜肽（如 CGRP、Substance P），減",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Magnesium hydroxide",
    "category": "腸胃科 > 消化性潰瘍 > 制酸劑",
    "mechanism": "弱鹼中和胃酸；Mg鹽可軟便",
    "indications": "血鎂、水瀉；瀉劑",
    "effects": "調節鈣離子通道/骨代謝/血管平滑肌收縮",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Bisacodyl",
    "category": "腸胃科 > 瀉劑 > 刺激性瀉劑",
    "mechanism": "刺激腸神經叢與腸黏膜分泌，促進蠕動",
    "indications": "瀉劑",
    "effects": "促進神經傳遞物質或內分泌/代謝反應",
    "mnemonic": "p.68: 刺激性瀉劑：必殺(Bisa-)卡司(Castor, Cascara)， 都是孤獨的(Aloe)，水拿(Senna)起只需單手 (Danthron)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Castor oil",
    "category": "腸胃科 > 瀉劑 > 刺激性瀉劑",
    "mechanism": "刺激腸神經叢與腸黏膜分泌，促進蠕動",
    "indications": "瀉劑",
    "effects": "促進神經傳遞物質或內分泌/代謝反應",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Magnesium hydroxide",
    "category": "腸胃科 > 瀉劑 > 滲透壓瀉劑",
    "mechanism": "不被吸收或形成高滲，將水分留在腸腔",
    "indications": "血鎂、水瀉；瀉劑",
    "effects": "依其機轉產生對應藥理作用；請搭配適應症與考點複習",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Polyethylene glycol",
    "category": "腸胃科 > 瀉劑 > 滲透壓瀉劑",
    "mechanism": "不被吸收或形成高滲，將水分留在腸腔",
    "indications": "瀉劑；將NH3轉變為水溶性氨有利排泄，改善；效快(水瀉)→；血鎂、水瀉",
    "effects": "依其機轉產生對應藥理作用；請搭配適應症與考點複習",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Sorbitol",
    "category": "腸胃科 > 瀉劑 > 滲透壓瀉劑",
    "mechanism": "不被吸收或形成高滲，將水分留在腸腔",
    "indications": "將NH3轉變為水溶性氨有利排泄，改善；效快(水瀉)→",
    "effects": "依其機轉產生對應藥理作用；請搭配適應症與考點複習",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Mineral oil",
    "category": "腸胃科 > 瀉劑 > 潤滑劑",
    "mechanism": "潤滑糞便並阻礙水分吸收",
    "indications": "瀉劑；將NH3轉變為水溶性氨有利排泄，改善；效快(水瀉)→；血鎂、水瀉",
    "effects": "依其機轉產生對應藥理作用；請搭配適應症與考點複習；PDF重點：抑制脂溶性維生素",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Loratadine",
    "category": "自泌素 > Histamine > 第二代H1阻斷",
    "mechanism": "周邊H1受器反向致效/拮抗，不易過BBB",
    "indications": "氣喘/COPD、動暈、尿失禁、帕金森/EPS或散瞳（依藥物）",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "p.58: “他叮，那叮，離心”：他被叮(-tadine)，那裡被叮(-nadine)，抽個血離心(-rizine)看有沒有瘧原蟲感 染",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Terfenadine",
    "category": "自泌素 > Histamine > 第二代H1阻斷",
    "mechanism": "周邊H1受器反向致效/拮抗，不易過BBB",
    "indications": "氣喘/COPD、動暈、尿失禁、帕金森/EPS或散瞳（依藥物）",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "p.58: “他叮，那叮，離心”：他被叮(-tadine)，那裡被叮(-nadine)，抽個血離心(-rizine)看有沒有瘧原蟲感 染",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Eptifibatide",
    "category": "血液腫瘤科 > 抗血小板 > GP IIb/IIIa拮抗",
    "mechanism": "阻斷GP IIb/IIIa，抑制fibrinogen橋接血小板",
    "indications": "特定癌症或腫瘤標靶治療",
    "effects": "阻斷對應受器或通道，降低該路徑效應",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Ixazomib",
    "category": "風濕免疫/腫瘤 > 標靶治療 > Proteasome抑制",
    "mechanism": "抑制26S proteasome，促進腫瘤細胞凋亡",
    "indications": "特定癌症或腫瘤標靶治療",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Catumaxomab",
    "category": "風濕免疫/腫瘤 > 雙特異抗體",
    "mechanism": "結合EpCAM與CD3，促進T細胞殺傷腫瘤",
    "indications": "在腫瘤、；EpCAM 的腫瘤上；惡性腹水, 胃癌",
    "effects": "促進神經傳遞物質或內分泌/代謝反應",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Thalidomide",
    "category": "風濕免疫科 > 免疫調節 > TNF抑制",
    "mechanism": "免疫調節藥；降低TNF-α並調節T/NK細胞",
    "indications": "可用在治療；降低嗜中性球吞噬；抗血管增生→海豹肢；刺激T cell(促進細胞免疫)",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號；PDF重點：抑制TNF-α、IL-6、IL-10、IL-12；降低嗜中性球吞噬",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Natalizumab",
    "category": "風濕免疫科 > 生物製劑 > Anti-integrin",
    "mechanism": "抗α4 integrin，抑制白血球進入CNS/腸道",
    "indications": "未在PDF同列明確標示；依分類臨床適應症複習",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Vedolizumab",
    "category": "風濕免疫科 > 生物製劑 > Anti-integrin",
    "mechanism": "抗α4β7 integrin，抑制淋巴球進入腸道",
    "indications": "未在PDF同列明確標示；依分類臨床適應症複習",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Tetracaine",
    "category": "麻醉科 > 局部麻醉 > Ester",
    "mechanism": "由細胞內側阻斷電壓依賴性Na+通道，抑制去極化",
    "indications": "長脊髓麻醉；中表面麻醉；對麻醉敏感)：C≧B>A",
    "effects": "抑制電位依賴性鈉通道，降低神經或心肌興奮性；PDF重點：inactived site)而阻斷之→；興奮交感：血管收縮",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Vecuronium",
    "category": "麻醉科 > 神經肌肉阻斷劑 > 非去極化",
    "mechanism": "競爭性Nm受器拮抗，阻斷骨骼肌神經肌肉傳遞",
    "indications": "氣喘/COPD、動暈、尿失禁、帕金森/EPS或散瞳（依藥物）",
    "effects": "阻斷對應受器或通道，降低該路徑效應",
    "mnemonic": "p.19: Panic(Panc-)的感覺🡺有以下副作用：心跳↑、血壓↑ Vecuronium 無His釋 解毒：Sugammadex 放 Rocuronium 肝臟代謝\np.19: 用平底鍋(Pan-)煎肥肉(Ve-,Ro-)，很油要洗很久，還會剩⼀咪咪油漬(抑制迷走) 去極化型(非競爭型)強效Ach-R agonist",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Letrozole",
    "category": "內分泌/新陳代謝 > 性激素 > Aromatase抑制",
    "mechanism": "抑制aromatase，使androgen轉estrogen下降",
    "indications": "可用於預防&治療乳癌，長期使用造成ESTROGEN 減少進而骨質",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號；PDF重點：抑制aromatase→estrogen↓→負回饋↓；抑制劑",
    "mnemonic": "p.79: 把小孩從肚子裡戳走（-trozole）：減少負回饋，促排卵\np.79: 這是一個Anna參加擠牛奶考試的故事。擠牛奶前需要先洗手，但是Anna不小心搓手(-trozole)了，導 致考試(Exem-)出現差錯(-mestane)，搓手後香香的手變臭臭(抑制芳香酶aromatase)。擠牛乳=治乳 癌\np.79: 糟蹋香香的女生(aromatase inhibitor)：乳房(防/治乳癌)拉搓揉(Letrozole)、肛門(ana-)搓揉 (anastrozole)，一直舔(-estane)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Abarelix",
    "category": "內分泌/新陳代謝 > 性激素 > GnRH antagonist",
    "mechanism": "GnRH受器拮抗，使LH/FSH下降",
    "indications": "避孕、荷爾蒙替代、癌症內分泌治療或生殖相關適應症",
    "effects": "活化對應受器，產生受器相關生理效應；PDF重點：GnRH antagonist→LH、FSH↓",
    "mnemonic": "p.78: -reli”x”，打叉叉，所以是抑制劑(antagonist)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Cholestipol",
    "category": "心臟科 > 降血脂 > Bile acid resins",
    "mechanism": "結合腸道膽酸/陰離子，增加膽酸排出並降低LDL",
    "indications": "無降TG 效果",
    "effects": "依其機轉產生對應藥理作用；請搭配適應症與考點複習；PDF重點：無降TG 效果",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Tobramycin",
    "category": "感染科 > 抗生素 > Aminoglycosides",
    "mechanism": "不可逆結合30S，造成mRNA誤讀並抑制起始複合體",
    "indications": "(不易有抗藥",
    "effects": "干擾DNA/RNA或細胞分裂，產生細胞毒性",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Meropenem",
    "category": "感染科 > 抗生素 > Carbapenem",
    "mechanism": "β-lactam；抑制PBP/細胞壁合成，廣效",
    "indications": "高血壓；部分用於心衰竭、腎保護或心絞痛",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）；PDF重點：抑制β lactamase",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Tolcapone",
    "category": "神經/精神科 > 抗帕金森 > COMT抑制",
    "mechanism": "抑制COMT，減少L-dopa/DA周邊或中樞代謝",
    "indications": "帕金森氏症或藥物誘發EPS",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號",
    "mnemonic": "p.30: 開篷車(capone)頭髮亂飛就不能comb hair(抑制COMT)\np.30: 搭列車(commuter)需要coupon(-capone) [-capone抑制COMT]\np.30: 頭(Tol-)很大(Enta-)，穿衣服卡繃(-capone)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Amoxapine",
    "category": "神經/精神科 > 抗憂鬱 > TCA相關",
    "mechanism": "抑制NE/5-HT再回收，並有D2阻斷作用",
    "indications": "憂鬱症、焦慮症或神經痛/偏頭痛預防（依藥物）",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）；PDF重點：抑制NE 回收",
    "mnemonic": "p.26: 阿莫在蝦皮(Amoxapine)甚麼都賣，就是不賣來自北方(不賣North=抑制NE)的麻婆(mapro-)豆腐。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Temazepam",
    "category": "神經/精神科 > 抗焦慮/鎮靜安眠 > Benzodiazepines",
    "mechanism": "GABA_A受器正向變構調節；增加Cl-通道開啟頻率",
    "indications": "焦慮、失眠、鎮靜、抗癲癇或麻醉誘導（依藥物）",
    "effects": "增強GABA-A抑制性傳導，鎮靜、抗焦慮、抗癲癇",
    "mnemonic": "p.21: 我打走(midazolam)踹走(Triazolam)牛 Temazepam、長Flurazepam) (ox-) ： (2)抗痙攣(Clonazepam) 被術前打鎮定劑的時候因為不想手術，所以我打 (3)中樞性骨骼肌鬆弛劑(Diazepam) 走 (midazolam) 醫生。 (4)急性酒精戒斷治療(Dia-、Oxa-、\np.21: 都是女生的名字： 6. onset速度： 歐普拉(alpra-)、蘿拉(Lora-)、伊斯塔 Triazolam>Diazepam>Chlordiazepoxide> (Esta-)、提瑪(tema-)會俘虜你(fluni-)的 Oxazapam、Lorazepam、Temazapam 心 (106-2)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Zonisamide",
    "category": "神經/精神科 > 抗癲癇 > Na+/Ca2+通道阻斷",
    "mechanism": "阻斷Na+與T-type Ca2+通道",
    "indications": "phentermine 做成複方治療肥胖",
    "effects": "抑制電位依賴性鈉通道，降低神經或心肌興奮性；PDF重點：阻斷Na+、Ca2+通道",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Trimethadione",
    "category": "神經/精神科 > 抗癲癇 > T-type Ca2+通道阻斷",
    "mechanism": "抑制丘腦T-type Ca2+通道",
    "indications": "癲癇發作控制；部分用於神經痛或情緒穩定",
    "effects": "調節鈣離子通道/骨代謝/血管平滑肌收縮",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Brimonidine",
    "category": "神經/精神科 > 擬交感神經藥物 > α2致效劑",
    "mechanism": "α2受器致效，降低房水生成並增加流出",
    "indications": "治療青光眼",
    "effects": "降低中樞交感輸出或增加NE釋放（依致效/拮抗）",
    "mnemonic": "p.11: 梅西(Methy-)被摸奶(Brimo-)，是被恐龍妹(Clonidine)摸奶(兩顆奶→α2 agonist)。另外，看到恐龍妹 嚇呆了→SE(副作用)為鎮靜。\np.11: 梅西多怕(Methydopa)孕婦懷孕(治療孕婦高血壓)和被摸(Brimo-)到眼睛(治青光眼)，摸他眼睛的人是一個克 隆(=隆乳)你的ㄋㄟ(Clonidine)的人，所以他就踢在你的ㄋㄟ(Tizanidine)讓他中間鬆掉(中樞性鬆弛劑)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Carbachol",
    "category": "神經/精神科 > 膽鹼性致效劑 > 直接型",
    "mechanism": "Muscarinic與Nicotinic受器致效",
    "indications": "重症肌無力、青光眼、阿茲海默症或解抗膽鹼毒性（依藥物）",
    "effects": "阻斷M受器，減少腺體分泌與平滑肌收縮；可散瞳、心跳上升、支氣管擴張；PDF重點：→專一性差：骨骼肌收縮；(6)腸蠕動↑、尿↑",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Cholestipol",
    "category": "腸胃科 > 止瀉劑 > 膽汁酸樹脂",
    "mechanism": "結合腸道膽汁酸，減少膽汁酸性腹瀉",
    "indications": "(也降膽固醇)",
    "effects": "依其機轉產生對應藥理作用；請搭配適應症與考點複習；PDF重點：(也降膽固醇)",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Sodium bicarbonate",
    "category": "腸胃科 > 消化性潰瘍 > 制酸劑",
    "mechanism": "弱鹼中和胃酸",
    "indications": "GERD、消化性潰瘍、胃酸過多或H. pylori輔助治療",
    "effects": "調節鈣離子通道/骨代謝/血管平滑肌收縮",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Procarbazine",
    "category": "血液腫瘤科 > 抗癌 > 其他化療",
    "mechanism": "Dacarbazine/Procarbazine為DNA烷化/甲基化；Etoposide抑制topoisomerase II",
    "indications": "會造成惡性高血壓",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）；PDF重點：會造成惡性高血壓；和酒精共同服用可能造成disulfiram-like",
    "mnemonic": "p.99: 非經典款(non classic)的賓士車(car-bazine)，才需要包金箔(platinum)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Cyanocobalamin",
    "category": "血液腫瘤科 > 抗貧血 > Vitamin B12",
    "mechanism": "補充B12，恢復DNA合成與紅血球生成",
    "indications": "高血壓、血栓併發症",
    "effects": "干擾DNA/RNA或細胞分裂，產生細胞毒性",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Durvalumab",
    "category": "風濕免疫/腫瘤 > Immune checkpoint > Anti-PD-L1",
    "mechanism": "抗PD-L1，解除T細胞抑制",
    "indications": "特定癌症或腫瘤標靶治療",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "p.94: [以上三種連貫一起記] 第一(PD-1)，你(Ni-)騙bro(Pembro-)Later(PD-L1)，又AAD(Atezolizumab, Avelemab, Durvalumab) 註： AAD是Against Advise Discharge(自動出院)做壞事要依比例(Ipili-)啦(CTLA-4)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Nabumetone",
    "category": "風濕免疫科 > NSAID > Acetic acid類",
    "mechanism": "可逆抑制COX-1/2，降低PG生成",
    "indications": "緩解經痛；高度selective，治RA、；無抗血小板作用；(Vioxx)易血栓，已下架",
    "effects": "降低RAAS作用，血管擴張、降醛固酮並保護心腎；PDF重點：增加MI、中風風險；無抗血小板作用",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Sugammadex",
    "category": "麻醉科 > 神經肌肉阻斷逆轉",
    "mechanism": "包覆Rocuronium/Vecuronium，降低游離非去極化肌鬆劑濃度",
    "indications": "未在PDF同列明確標示；依分類臨床適應症複習",
    "effects": "阻斷對應受器或通道，降低該路徑效應",
    "mnemonic": "p.19: Panic(Panc-)的感覺🡺有以下副作用：心跳↑、血壓↑ Vecuronium 無His釋 解毒：Sugammadex 放 Rocuronium 肝臟代謝",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Exemestane",
    "category": "內分泌/新陳代謝 > 性激素 > Aromatase抑制",
    "mechanism": "抑制aromatase，使androgen轉estrogen下降",
    "indications": "避孕、荷爾蒙替代、癌症內分泌治療或生殖相關適應症",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號",
    "mnemonic": "p.79: Anna說走🡺就沒有estrogen了(女生走了，就沒有雌性素了)\np.79: 這是一個Anna參加擠牛奶考試的故事。擠牛奶前需要先洗手，但是Anna不小心搓手(-trozole)了，導 致考試(Exem-)出現差錯(-mestane)，搓手後香香的手變臭臭(抑制芳香酶aromatase)。擠牛乳=治乳 癌",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Desogestrel",
    "category": "內分泌/新陳代謝 > 性激素 > Progestin",
    "mechanism": "Progesterone receptor致效，負回饋抑制LH/FSH",
    "indications": "綜合口服避孕；組合型避孕藥使用5 年以上會；增加乳癌發生率；增生，但不能減低乳癌機率",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Norgestrel",
    "category": "內分泌/新陳代謝 > 性激素 > Progestin",
    "mechanism": "Progesterone receptor致效，負回饋抑制LH/FSH",
    "indications": "綜合口服避孕；組合型避孕藥使用5 年以上會；增加乳癌發生率；增生，但不能減低乳癌機率",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Pertechnetate",
    "category": "內分泌/新陳代謝 > 甲狀腺 > 碘攝取抑制",
    "mechanism": "競爭性抑制甲狀腺NIS碘離子攝取",
    "indications": "甲狀腺功能亢進/低下或甲狀腺風暴",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號；PDF重點：抑制T4→T3、抑制交感興奮",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Thiocyanate",
    "category": "內分泌/新陳代謝 > 甲狀腺 > 碘攝取抑制",
    "mechanism": "競爭性抑制甲狀腺NIS碘離子攝取",
    "indications": "甲狀腺功能亢進/低下或甲狀腺風暴",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號；PDF重點：抑制T4→T3、抑制交感興奮",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Insulin degludec",
    "category": "內分泌/新陳代謝 > 糖尿病 > Insulin",
    "mechanism": "長效insulin製劑，活化insulin receptor tyrosine kinase",
    "indications": "糖尿病血糖控制",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Ultralente insulin",
    "category": "內分泌/新陳代謝 > 糖尿病 > Insulin",
    "mechanism": "長效insulin製劑，活化insulin receptor tyrosine kinase",
    "indications": "糖尿病血糖控制",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Acetohexamide",
    "category": "內分泌/新陳代謝 > 糖尿病 > Sulfonylureas",
    "mechanism": "阻斷胰臟β細胞KATP通道，使Ca2+內流並促insulin分泌",
    "indications": "糖尿病血糖控制",
    "effects": "調節鈣離子通道/骨代謝/血管平滑肌收縮",
    "mnemonic": "p.75: 飯前(飯前吃，gli在字首)呷(台 4. 比較: 語)(K+)蛤蜊(Gli-)才會舒服 使KATP channel關閉→Sulfonylurea、 (sulfo-)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Glyburide",
    "category": "內分泌/新陳代謝 > 糖尿病 > Sulfonylureas",
    "mechanism": "阻斷胰臟β細胞KATP通道，使Ca2+內流並促insulin分泌",
    "indications": "糖尿病血糖控制",
    "effects": "調節鈣離子通道/骨代謝/血管平滑肌收縮",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Troglitazone",
    "category": "內分泌/新陳代謝 > 糖尿病 > TZD",
    "mechanism": "活化PPARγ，增加insulin sensitivity與GLUT4作用",
    "indications": "糖尿病血糖控制",
    "effects": "降低血糖或改善胰島素/腸泌素/腎糖排出路徑；PDF重點：增加；刺激 PPARγ→↑GLUT-4",
    "mnemonic": "p.75: Papa(活化PPARγ)把蛤蜊太熟(-glitazone)沒人要吃，就過剩了(英，glut，增加GLUT-4 R)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Desoxycorticosterone",
    "category": "內分泌/新陳代謝 > 腎上腺皮質醇 > Mineralocorticoid",
    "mechanism": "活化mineralocorticoid受器，促進Na+再吸收與K+排泄",
    "indications": "發炎/免疫疾病、腎上腺功能異常或替代治療",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Methylprednisolone",
    "category": "內分泌/新陳代謝 > 腎上腺皮質醇 > 中效Glucocorticoid",
    "mechanism": "活化glucocorticoid receptor，抑制發炎與免疫反應",
    "indications": "治腦腫瘤水腫，診斷Cushing",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號；PDF重點：生長抑制、",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Pegvisomant",
    "category": "內分泌/新陳代謝 > 腦下垂體 > GH受器拮抗",
    "mechanism": "GH受器拮抗，降低IGF-1",
    "indications": "未在PDF同列明確標示；依分類臨床適應症複習",
    "effects": "阻斷對應受器或通道，降低該路徑效應；PDF重點：抑制 GH receptor",
    "mnemonic": "p.70: Peggy(pegvi-)；Real tide(-reotide)真的很緊🡺 Peggy real tide (Peggy真的很緊，因為打了之後長不高-抑制GH)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Atosiban",
    "category": "內分泌/新陳代謝 > 腦下垂體 > Oxytocin受器拮抗",
    "mechanism": "Oxytocin受器拮抗，抑制子宮收縮",
    "indications": "未在PDF同列明確標示；依分類臨床適應症複習",
    "effects": "阻斷對應受器或通道，降低該路徑效應；PDF重點：ADH 抗利尿激素=Vasopressin 血管收縮素(108-1)；促進",
    "mnemonic": "p.70: 拮抗 Atosiban • -osiban:Ban掉osi(拮抗oxy-) 安胎",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Lanreotide",
    "category": "內分泌/新陳代謝 > 腦下垂體 > Somatostatin類似物",
    "mechanism": "Somatostatin受器致效，抑制GH與多種內分泌分泌",
    "indications": "高脂血症與動脈粥樣硬化風險降低",
    "effects": "降低膽固醇合成、上調LDL受器；PDF重點：抑制胰島素、升糖素和胃泌素分泌；(較SST 弱，故發生高血糖機率較低)",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Vapreotide",
    "category": "內分泌/新陳代謝 > 腦下垂體 > Somatostatin類似物",
    "mechanism": "Somatostatin受器致效，抑制GH與多種內分泌分泌",
    "indications": "高脂血症與動脈粥樣硬化風險降低",
    "effects": "降低膽固醇合成、上調LDL受器；PDF重點：抑制 GH receptor",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Calcitriol",
    "category": "內分泌/新陳代謝 > 鈣質相關 > 活性維生素D",
    "mechanism": "活化vitamin D receptor，增加腸鈣磷吸收",
    "indications": "骨質疏鬆、高/低血鈣或副甲狀腺相關疾病",
    "effects": "調節鈣離子通道/骨代謝/血管平滑肌收縮；PDF重點：腎臟活化之產物(1, 25 -OH)；鈣↓磷↓",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Pamidronate",
    "category": "內分泌/新陳代謝 > 骨鬆 > Bisphosphonates",
    "mechanism": "抑制osteoclast之farnesyl pyrophosphate synthase，降低骨吸收",
    "indications": "未在PDF同列明確標示；依分類臨床適應症複習",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Risedronate",
    "category": "內分泌/新陳代謝 > 骨鬆 > Bisphosphonates",
    "mechanism": "抑制osteoclast之farnesyl pyrophosphate synthase，降低骨吸收",
    "indications": "未在PDF同列明確標示；依分類臨床適應症複習",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）；PDF重點：抑制farnesyl pyrophosphae (FPP)；抑制OC",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Isosorbide dinitrate",
    "category": "心臟科 > 心絞痛 > Nitrate/Nitrite",
    "mechanism": "釋放NO→cGMP上升→血管平滑肌鬆弛，主要降低preload",
    "indications": "治急性",
    "effects": "促進神經傳遞物質或內分泌/代謝反應；PDF重點：增加血管平滑肌的cGMP(107-2)",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Alirocumab",
    "category": "心臟科 > 降血脂 > PCSK9抑制",
    "mechanism": "抑制PCSK9，減少LDL receptor分解",
    "indications": "高脂血症與動脈粥樣硬化風險降低",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號；PDF重點：(PCSK9 本身促進LDL-R 的分解)",
    "mnemonic": "p.57: (肥)肉哭沒(-volocumab、-rocumab)了🡺降血脂",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Adefovir",
    "category": "感染科 > 抗HBV > 核苷/核苷酸類似物",
    "mechanism": "Adenosine nucleotide類似物；抑制HBV polymerase",
    "indications": "治療產生HBeAg 血清轉換持久性較高",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Adefovir dipivoxil",
    "category": "感染科 > 抗HBV > 核苷/核苷酸類似物",
    "mechanism": "Adenosine nucleotide類似物；抑制HBV polymerase",
    "indications": "治療產生HBeAg 血清轉換持久性較高",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Telbivudine",
    "category": "感染科 > 抗HBV > 核苷/核苷酸類似物",
    "mechanism": "Thymidine類似物；抑制HBV polymerase",
    "indications": "治療產生HBeAg 血清轉換持久性較高",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Tenofovir",
    "category": "感染科 > 抗HBV > 核苷/核苷酸類似物",
    "mechanism": "Adenosine nucleotide類似物；抑制HBV polymerase",
    "indications": "治療產生HBeAg 血清轉換持久性較高",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Maraviroc",
    "category": "感染科 > 抗HIV > CCR5拮抗",
    "mechanism": "CCR5拮抗，阻止gp120/CCR5介導之病毒進入",
    "indications": "病毒感染治療或預防",
    "effects": "抑制病毒複製、成熟或進入宿主細胞；PDF重點：骨髓抑制；→競爭抑制HIV-1 反轉錄",
    "mnemonic": "p.120: antagonist • Maroon5(Mara-是anti-CCR5，不讓他接gp41)\np.120: (從外到內喔)：馬拉拉(Mara-) 愛浮潛(Efu-)，而且她博學多聞記很多(Zido-)拉密定理 (Lami-)，最後還暴動似的(riot, Ralte-)用力的K自己的陰蒂(Indi-) 🡺 一句話：馬拉愛浮記多 拉特陰蒂",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Azlocillin",
    "category": "感染科 > 抗生素 > Antipseudomonal penicillins",
    "mechanism": "β-lactam；抑制PBP/細胞壁合成，具抗Pseudomonas活性",
    "indications": "細菌感染治療（菌種依藥物光譜）",
    "effects": "抑制細菌細胞壁、蛋白質、核酸或葉酸代謝",
    "mnemonic": "p.105: • 阿祖(台Azlo-)兇(台Pipe-)綠膿桿菌沒有錯(Mezlo-)\np.105: • 阿祖(台Azlo-)用水管(Pipe-)戳，梅子落(Mezlo-)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Mezlocillin",
    "category": "感染科 > 抗生素 > Antipseudomonal penicillins",
    "mechanism": "β-lactam；抑制PBP/細胞壁合成，具抗Pseudomonas活性",
    "indications": "細菌感染治療（菌種依藥物光譜）",
    "effects": "抑制細菌細胞壁、蛋白質、核酸或葉酸代謝",
    "mnemonic": "p.105: • 阿祖(台Azlo-)兇(台Pipe-)綠膿桿菌沒有錯(Mezlo-)\np.105: • 阿祖(台Azlo-)用水管(Pipe-)戳，梅子落(Mezlo-)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Ertapenem",
    "category": "感染科 > 抗生素 > Carbapenem",
    "mechanism": "β-lactam；抑制PBP/細胞壁合成，廣效",
    "indications": "高血壓；部分用於心衰竭、腎保護或心絞痛",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）；PDF重點：抑制β lactamase",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Cephalothin",
    "category": "感染科 > 抗生素 > Cephalosporin第一代",
    "mechanism": "β-lactam；抑制PBP/細胞壁合成",
    "indications": "細菌感染治療（菌種依藥物光譜）",
    "effects": "抑制細菌細胞壁、蛋白質、核酸或葉酸代謝",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Ceftizoxime",
    "category": "感染科 > 抗生素 > Cephalosporin第三代",
    "mechanism": "β-lactam；抑制PBP/細胞壁合成",
    "indications": "細菌感染治療（菌種依藥物光譜）",
    "effects": "抑制細菌細胞壁、蛋白質、核酸或葉酸代謝",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Moxalactam",
    "category": "感染科 > 抗生素 > Cephalosporin第三代",
    "mechanism": "β-lactam；抑制PBP/細胞壁合成",
    "indications": "細菌感染治療（菌種依藥物光譜）",
    "effects": "抑制細菌細胞壁、蛋白質、核酸或葉酸代謝",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Cefonicid",
    "category": "感染科 > 抗生素 > Cephalosporin第二代",
    "mechanism": "β-lactam；抑制PBP/細胞壁合成",
    "indications": "細菌感染治療（菌種依藥物光譜）",
    "effects": "抑制細菌細胞壁、蛋白質、核酸或葉酸代謝",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Loracarbef",
    "category": "感染科 > 抗生素 > Cephalosporin第二代",
    "mechanism": "β-lactam；抑制PBP/細胞壁合成",
    "indications": "細菌感染治療（菌種依藥物光譜）",
    "effects": "抑制細菌細胞壁、蛋白質、核酸或葉酸代謝",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Ceftobiprole",
    "category": "感染科 > 抗生素 > Cephalosporin第五代",
    "mechanism": "β-lactam；抑制PBP，對MRSA PBP2a有活性",
    "indications": "細菌感染治療（菌種依藥物光譜）",
    "effects": "抑制細菌細胞壁、蛋白質、核酸或葉酸代謝",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Cefpirome",
    "category": "感染科 > 抗生素 > Cephalosporin第四代",
    "mechanism": "β-lactam；抑制PBP/細胞壁合成，廣效",
    "indications": "細菌感染治療（菌種依藥物光譜）",
    "effects": "抑制細菌細胞壁、蛋白質、核酸或葉酸代謝",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Troleandomycin",
    "category": "感染科 > 抗生素 > Macrolides",
    "mechanism": "結合50S 23S rRNA，抑制translocation",
    "indications": "細菌感染治療（菌種依藥物光譜）",
    "effects": "干擾DNA/RNA或細胞分裂，產生細胞毒性",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Cefiderocol",
    "category": "感染科 > 抗生素 > Siderophore cephalosporin",
    "mechanism": "藉鐵運輸進入細菌並抑制PBP/細胞壁合成",
    "indications": "貧血治療或造血刺激",
    "effects": "抑制細菌細胞壁、蛋白質、核酸或葉酸代謝",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Quinupristin-Dalfopristin",
    "category": "感染科 > 抗生素 > Streptogramin",
    "mechanism": "結合50S，協同抑制蛋白質合成",
    "indications": "殺菌型；新藥，抗菌活性與Macrolides 相似",
    "effects": "抑制細菌細胞壁、蛋白質、核酸或葉酸代謝；PDF重點：殺菌型",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Sulfacetamide",
    "category": "感染科 > 抗生素 > Sulfonamide",
    "mechanism": "PABA類似物，競爭性抑制dihydropteroate synthase",
    "indications": "效果中等，用於燒傷病患；(抑制骨髓→再生不良貧血)",
    "effects": "抑制細菌細胞壁、蛋白質、核酸或葉酸代謝；PDF重點：(抑制骨髓→再生不良貧血)；可口服，抑制二氫葉酸還原酶(dihydrofolate",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Sulfisoxazole",
    "category": "感染科 > 抗生素 > Sulfonamide",
    "mechanism": "PABA類似物，競爭性抑制dihydropteroate synthase",
    "indications": "治兒童中耳炎；抑菌型(+TMP=殺菌型)",
    "effects": "抑制細菌細胞壁、蛋白質、核酸或葉酸代謝；PDF重點：抑制二氫蝶酸合成酶；抑菌型(+TMP=殺菌型)",
    "mnemonic": "p.116: 蓋地板(台語，起頭咖)(Ketoco-)對阿祖(-azole)來說是一種苦行(Cushing)，可以治Cushing syndrome\np.116: 阿祖(-azole)看到爛(lanosterol)人很不爽，他踢他屁屁(P450)，剁他耳朵(ergosterol)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Oxytetracycline",
    "category": "感染科 > 抗生素 > Tetracyclines短/中效",
    "mechanism": "結合30S，阻止aminoacyl-tRNA進入A site",
    "indications": "細菌感染治療（菌種依藥物光譜）",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Benzathine penicillin",
    "category": "感染科 > 抗生素 > β-lactam/Penicillin",
    "mechanism": "β-lactam；結合PBP並抑制transpeptidation，阻斷peptidoglycan交聯",
    "indications": "高血壓、心絞痛、心衰竭、心律不整、青光眼（依藥物）",
    "effects": "抑制細菌細胞壁、蛋白質、核酸或葉酸代謝；PDF重點：對altered PBP 之MRSA 無",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Clavulanate",
    "category": "感染科 > 抗生素 > β-lactamase inhibitor",
    "mechanism": "抑制β-lactamase，保護β-lactam抗生素",
    "indications": "細菌感染治療（菌種依藥物光譜）",
    "effects": "抑制細菌細胞壁、蛋白質、核酸或葉酸代謝；PDF重點：抑制β lactamase",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Relebactam",
    "category": "感染科 > 抗生素 > β-lactamase inhibitor",
    "mechanism": "抑制β-lactamase，保護β-lactam抗生素",
    "indications": "細菌感染治療（菌種依藥物光譜）",
    "effects": "抑制細菌細胞壁、蛋白質、核酸或葉酸代謝",
    "mnemonic": "p.107: 真假(Rele-)？瑋柏(Vabor-) 拍AV(Avi-)不戴套(非環)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Vaborbactam",
    "category": "感染科 > 抗生素 > β-lactamase inhibitor",
    "mechanism": "抑制β-lactamase，保護β-lactam抗生素",
    "indications": "細菌感染治療（菌種依藥物光譜）",
    "effects": "抑制細菌細胞壁、蛋白質、核酸或葉酸代謝",
    "mnemonic": "p.107: 真假(Rele-)？瑋柏(Vabor-) 拍AV(Avi-)不戴套(非環)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Cotrimoxazole",
    "category": "感染科 > 抗生素 > 抗葉酸合併",
    "mechanism": "Sulfamethoxazole抑制dihydropteroate synthase，Trimethoprim抑制DHFR",
    "indications": "細菌感染治療（菌種依藥物光譜）",
    "effects": "抑制細菌細胞壁、蛋白質、核酸或葉酸代謝",
    "mnemonic": "p.116: 蓋地板(台語，起頭咖)(Ketoco-)對阿祖(-azole)來說是一種苦行(Cushing)，可以治Cushing syndrome\np.116: 阿祖(-azole)看到爛(lanosterol)人很不爽，他踢他屁屁(P450)，剁他耳朵(ergosterol)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Fosfomycin",
    "category": "感染科 > 抗生素 > 細胞壁前驅物",
    "mechanism": "抑制MurA/enolpyruvyl transferase，阻斷peptidoglycan前驅物合成",
    "indications": "氣喘/COPD、動暈、尿失禁、帕金森/EPS或散瞳（依藥物）",
    "effects": "抑制細菌細胞壁、蛋白質、核酸或葉酸代謝；PDF重點：抑制enolpyruvate transferase(抑制G 變M)；抑制Alanine racemase(L-Ala -> D-Ala)、D-acetyl-D-alanine",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Deferiprone",
    "category": "毒物學 > 螯合劑",
    "mechanism": "螯合鐵，促進排泄",
    "indications": "(口服)(降低心臟；Deferasirox (口服)(降低肝臟",
    "effects": "結合毒物/重金屬或繞過毒性路徑以促進排除；PDF重點：(口服)(降低心臟；Deferasirox (口服)(降低肝臟",
    "mnemonic": "p.125: 不一樣的鐵(defer)打針會喊",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Methylene blue",
    "category": "毒物學 > 解毒劑",
    "mechanism": "促進methemoglobin還原為hemoglobin",
    "indications": "中毒或重金屬暴露之解毒/螯合治療",
    "effects": "結合毒物/重金屬或繞過毒性路徑以促進排除；PDF重點：造成之變性血紅素症",
    "mnemonic": "p.100: Ivy(IV給藥)付(5-FU)錢買了合成(TS)的葉子(THF=N5,10-methylene-FH4)來裝B(過BBB)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Cyclobenzaprine",
    "category": "神經/精神科 > 中樞性肌肉鬆弛劑",
    "mechanism": "中樞抑制性肌肉鬆弛；結構類似TCA",
    "indications": "憂鬱症、焦慮症或神經痛/偏頭痛預防（依藥物）",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）；PDF重點：(河豚毒素)抑制神經細胞膜上的鈉離子通道，進而抑制動作電位(107-1)",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Indoramin",
    "category": "神經/精神科 > 交感神經阻斷劑 > α1阻斷",
    "mechanism": "選擇性α1受器阻斷，使血管、前列腺與膀胱頸平滑肌鬆弛",
    "indications": "高血壓、BPH、嗜鉻細胞瘤或雷諾氏現象（依選擇性）",
    "effects": "血管/括約肌收縮；阻斷時則血管與前列腺平滑肌放鬆",
    "mnemonic": "p.13: 黑心(台語/osin/)的廠商山寨機，跟Apple inc對槓(a1 antagonist)\np.13: 治高血壓+BPH：柔欣(-zosin)有高血壓+BPH，因為愛吃印度拉麵(indoramine)\np.13: 煮阿姨(阻 α1)有肉腥(-zosin)\np.13: 你太快了(U-rapid-il)讓我整個走心(-zosin)，我要去吃印度拉麵(Indo-ramin)消消氣",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Nadolol",
    "category": "神經/精神科 > 交感神經阻斷劑 > β1/β2阻斷",
    "mechanism": "非選擇性β受器阻斷",
    "indications": "支氣管收縮→氣喘患者須小；常用於青光眼首選；慢性心絞痛；預防偏頭痛",
    "effects": "支氣管平滑肌放鬆；可有心悸、低血鉀、高血糖；PDF重點：支氣管收縮→氣喘患者須小",
    "mnemonic": "p.14: -olol(A~M開頭的)：AM(白天)的OL比較挑(選擇性)，只要1支banana(B1 antagonist)\np.14: -olol(P開頭的)：晚上(不是下方A~M)的OL就不挑(非選擇性)，banana全都要(B antagonist)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Desvenlafaxine",
    "category": "神經/精神科 > 抗憂鬱 > SNRI",
    "mechanism": "抑制SERT與NET，增加5-HT與NE",
    "indications": "適用症：憂鬱、異常疼痛、焦慮",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Milnacipran",
    "category": "神經/精神科 > 抗憂鬱 > SNRI",
    "mechanism": "抑制SERT與NET，增加5-HT與NE",
    "indications": "憂鬱症、焦慮症或神經痛/偏頭痛預防（依藥物）",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "p.25: SNoRe太大聲被發現(-faxine)，被禁止snore(抑制Serotonin NE回收)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Escitalopram",
    "category": "神經/精神科 > 抗憂鬱 > SSRI",
    "mechanism": "選擇性抑制SERT，增加突觸間5-HT",
    "indications": "禁突然停藥(眩暈失眠疲倦噁心焦慮寒顫頭痛等戒斷症狀)",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Hexobarbital",
    "category": "神經/精神科 > 抗焦慮/鎮靜安眠 > Barbiturates",
    "mechanism": "GABA_A受器正向變構調節；延長Cl-通道開啟時間，高劑量可直接開啟",
    "indications": "適應症：鎮靜、抗焦慮、抗癲癇；治療癲癇發作；耐藥性、生理依賴性(戒斷症狀嚴重)；短效、純安眠，無鎮靜、解除焦慮效果",
    "effects": "增強GABA-A抑制性傳導，鎮靜、抗焦慮、抗癲癇",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Methohexital",
    "category": "神經/精神科 > 抗焦慮/鎮靜安眠 > Barbiturates",
    "mechanism": "GABA_A受器正向變構調節；延長Cl-通道開啟時間，高劑量可直接開啟",
    "indications": "焦慮、失眠、鎮靜、抗癲癇或麻醉誘導（依藥物）",
    "effects": "增強GABA-A抑制性傳導，鎮靜、抗焦慮、抗癲癇",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Pentobarbital",
    "category": "神經/精神科 > 抗焦慮/鎮靜安眠 > Barbiturates",
    "mechanism": "GABA_A受器正向變構調節；延長Cl-通道開啟時間，高劑量可直接開啟",
    "indications": "適應症：鎮靜、抗焦慮、抗癲癇；治療癲癇發作；耐藥性、生理依賴性(戒斷症狀嚴重)；短效、純安眠，無鎮靜、解除焦慮效果",
    "effects": "增強GABA-A抑制性傳導，鎮靜、抗焦慮、抗癲癇",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Secobarbital",
    "category": "神經/精神科 > 抗焦慮/鎮靜安眠 > Barbiturates",
    "mechanism": "GABA_A受器正向變構調節；延長Cl-通道開啟時間，高劑量可直接開啟",
    "indications": "適應症：鎮靜、抗焦慮、抗癲癇；治療癲癇發作；耐藥性、生理依賴性(戒斷症狀嚴重)；短效、純安眠，無鎮靜、解除焦慮效果",
    "effects": "增強GABA-A抑制性傳導，鎮靜、抗焦慮、抗癲癇",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Pregabalin",
    "category": "神經/精神科 > 抗癲癇 > Ca2+通道α2δ配體",
    "mechanism": "結合電壓依賴性Ca2+通道α2δ次單元，降低興奮性傳遞物釋放",
    "indications": "癲癇發作控制；部分用於神經痛或情緒穩定",
    "effects": "降低中樞交感輸出或增加NE釋放（依致效/拮抗）；PDF重點：α 單元，減少glutamate 釋放；transaminase↓、GABA 回",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Prochlorperazine",
    "category": "神經/精神科 > 抗精神病 > 傳統/典型",
    "mechanism": "D2受器拮抗",
    "indications": "止吐： (Novamin)；治Tourette’s syndrome、；效強(抗D2-R 強)→EPS、Prolactin 症狀；強→抗M 抗α 抗H 弱→鎮靜弱",
    "effects": "調節多巴胺傳導，影響精神症狀、EPS、泌乳或帕金森症狀",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Olanzapine",
    "category": "神經/精神科 > 抗精神病 > 非典型",
    "mechanism": "主要阻斷D2與5-HT2A受器",
    "indications": "對傳統抗精神病藥無",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "p.29: A pine(一個松樹樹屋)的故事： 他決定要關閉(cloz-)並離開(quit🡺 quet-)這一個松樹屋(-apine)，臨走前還揍它(把松樹打到有黑輪 (台)(olan-))。另外，pine的葉子尖，會戳破WBC(Clozapine會造成顆粒性白血球缺乏)\np.29: SE：Cloz-像cloze，有很多空格，所以造成顆粒性白血球缺乏；Olan-像黑輪(台語)，吃很多會胖，所以會造 成體重增加 / 黑輪→熊貓→像熊貓一樣胖(體重上升)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Quetiapine",
    "category": "神經/精神科 > 抗精神病 > 非典型",
    "mechanism": "主要阻斷D2與5-HT2A受器",
    "indications": "思覺失調症、躁症、Tourette症或止吐（依藥物）",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "p.29: A pine(一個松樹樹屋)的故事： 他決定要關閉(cloz-)並離開(quit🡺 quet-)這一個松樹屋(-apine)，臨走前還揍它(把松樹打到有黑輪 (台)(olan-))。另外，pine的葉子尖，會戳破WBC(Clozapine會造成顆粒性白血球缺乏)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Cyclopentolate",
    "category": "神經/精神科 > 膽鹼性拮抗劑 > 眼科Muscarinic阻斷",
    "mechanism": "Muscarinic受器阻斷，造成散瞳與睫狀肌麻痺",
    "indications": "氣喘/COPD、動暈、尿失禁、帕金森/EPS或散瞳（依藥物）",
    "effects": "阻斷M受器，減少腺體分泌與平滑肌收縮；可散瞳、心跳上升、支氣管擴張；PDF重點：散瞳→眼底鏡檢查",
    "mnemonic": "p.17: Home ma(Homa-)的孩子走丟了(散童)，在熱帶雨林(Tropica-)騎腳踏車(Cyclo-)找",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Homatropine",
    "category": "神經/精神科 > 膽鹼性拮抗劑 > 眼科Muscarinic阻斷",
    "mechanism": "Muscarinic受器阻斷，造成散瞳與睫狀肌麻痺",
    "indications": "氣喘/COPD、動暈、尿失禁、帕金森/EPS或散瞳（依藥物）",
    "effects": "阻斷M受器，減少腺體分泌與平滑肌收縮；可散瞳、心跳上升、支氣管擴張；PDF重點：單純散瞳(α1)；散瞳→眼底鏡檢查",
    "mnemonic": "p.17: Home ma(Homa-)的孩子走丟了(散童)，在熱帶雨林(Tropica-)騎腳踏車(Cyclo-)找",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Methacholine",
    "category": "神經/精神科 > 膽鹼性致效劑 > 直接型",
    "mechanism": "Muscarinic受器致效，用於支氣管挑戰試驗",
    "indications": "診斷氣喘；對心血管活性較高，治心搏過速",
    "effects": "阻斷M受器，減少腺體分泌與平滑肌收縮；可散瞳、心跳上升、支氣管擴張；PDF重點：BP↓(EDRF=NO)",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Ethanol",
    "category": "神經/精神科 > 酒精用藥",
    "mechanism": "增強GABA_A並抑制NMDA受器",
    "indications": "高血壓；部分用於心衰竭、腎保護或心絞痛",
    "effects": "增強GABA-A抑制性傳導，鎮靜、抗焦慮、抗癲癇",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Chloral hydrate",
    "category": "神經/精神科 > 鎮靜安眠",
    "mechanism": "代謝為trichloroethanol，增強GABA_A抑制性傳遞",
    "indications": "焦慮、失眠、鎮靜、抗癲癇或麻醉誘導（依藥物）",
    "effects": "增強GABA-A抑制性傳導，鎮靜、抗焦慮、抗癲癇",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Erenumab",
    "category": "神經/精神科 > 頭痛用藥 > 抗CGRP單株抗體",
    "mechanism": "阻斷CGRP受器或CGRP訊號",
    "indications": "單株抗體預防偏頭痛",
    "effects": "阻斷對應受器或通道，降低該路徑效應",
    "mnemonic": "p.40: E人(Eren-)散發的費洛蒙(Freman-)讓我尷尬(Galca-)頭痛",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Fremanezumab",
    "category": "神經/精神科 > 頭痛用藥 > 抗CGRP單株抗體",
    "mechanism": "阻斷CGRP受器或CGRP訊號",
    "indications": "偏頭痛急性治療或預防",
    "effects": "阻斷對應受器或通道，降低該路徑效應",
    "mnemonic": "p.40: E人(Eren-)散發的費洛蒙(Freman-)讓我尷尬(Galca-)頭痛",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Galcanezumab",
    "category": "神經/精神科 > 頭痛用藥 > 抗CGRP單株抗體",
    "mechanism": "阻斷CGRP受器或CGRP訊號",
    "indications": "CGRP 單株抗體",
    "effects": "阻斷對應受器或通道，降低該路徑效應",
    "mnemonic": "p.40: E人(Eren-)散發的費洛蒙(Freman-)讓我尷尬(Galca-)頭痛",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Dihydrocodeine",
    "category": "神經/精神科 > 類鴉片止痛劑 > 弱/中效μ致效",
    "mechanism": "μ-opioid受器致效；Tramadol另抑制NE/5-HT再回收",
    "indications": "治療腹瀉(因不易進中樞)；戒斷症狀較輕、持續時間較短，漸取代Methadone 成為Morphine 戒斷替",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Hydrocodone",
    "category": "神經/精神科 > 類鴉片止痛劑 > 弱/中效μ致效",
    "mechanism": "μ-opioid受器致效；Tramadol另抑制NE/5-HT再回收",
    "indications": "治療腹瀉(因不易進中樞)；戒斷症狀較輕、持續時間較短，漸取代Methadone 成為Morphine 戒斷替",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Oxycodone",
    "category": "神經/精神科 > 類鴉片止痛劑 > 弱/中效μ致效",
    "mechanism": "μ-opioid受器致效；Tramadol另抑制NE/5-HT再回收",
    "indications": "治療腹瀉(因不易進中樞)；戒斷症狀較輕、持續時間較短，漸取代Methadone 成為Morphine 戒斷替",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Alfentanil",
    "category": "神經/精神科 > 類鴉片止痛劑 > 強效μ致效",
    "mechanism": "μ-opioid受器致效（Gi）：抑制Ca2+內流、促進K+外流",
    "indications": "中重度疼痛、止咳或鴉片戒斷/解毒（依藥物）",
    "effects": "調節鈣離子通道/骨代謝/血管平滑肌收縮",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Remifentanil",
    "category": "神經/精神科 > 類鴉片止痛劑 > 強效μ致效",
    "mechanism": "μ-opioid受器致效（Gi）：抑制Ca2+內流、促進K+外流",
    "indications": "中重度疼痛、止咳或鴉片戒斷/解毒（依藥物）",
    "effects": "調節鈣離子通道/骨代謝/血管平滑肌收縮",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Butorphanol",
    "category": "神經/精神科 > 類鴉片止痛劑 > 混合致效/拮抗",
    "mechanism": "κ受器致效，μ受器部分致效/拮抗",
    "indications": "中重度疼痛、止咳或鴉片戒斷/解毒（依藥物）",
    "effects": "活化對應受器，產生受器相關生理效應",
    "mnemonic": "p.39: 不偷肥肉(Buto-phanol)，也不想變弱貧(Bu-pre-norphine)，所以應徵到了幾間麥當勞(partial μ agonist)盤子拿不平(Nal-buphine)，還騙他走心(Penta-zocine)，職位被卡掉(κ agonist)，連麥當",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Nalbuphine",
    "category": "神經/精神科 > 類鴉片止痛劑 > 混合致效/拮抗",
    "mechanism": "κ受器致效、μ受器拮抗",
    "indications": "少止痛效果甚至可能會有戒斷症狀",
    "effects": "活化對應受器，產生受器相關生理效應",
    "mnemonic": "p.39: 不偷肥肉(Buto-phanol)，也不想變弱貧(Bu-pre-norphine)，所以應徵到了幾間麥當勞(partial μ agonist)盤子拿不平(Nal-buphine)，還騙他走心(Penta-zocine)，職位被卡掉(κ agonist)，連麥當",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Nalmefene",
    "category": "神經/精神科 > 類鴉片解毒/戒斷",
    "mechanism": "長效opioid受器拮抗",
    "indications": "中重度疼痛、止咳或鴉片戒斷/解毒（依藥物）",
    "effects": "結合毒物/重金屬或繞過毒性路徑以促進排除",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Methylprednisolone",
    "category": "胸腔科 > 抗氣喘 > 全身性類固醇",
    "mechanism": "活化glucocorticoid receptor，抑制發炎反應",
    "indications": "口咽，易感染(漱",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Fluticasone",
    "category": "胸腔科 > 抗氣喘 > 吸入型類固醇",
    "mechanism": "活化glucocorticoid receptor，抑制發炎基因轉錄",
    "indications": "口服(適用小孩)；常用於Aspirin-",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號；PDF重點：抑制5-Lipoxygenase (LOX)",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Dronabinol",
    "category": "腸胃科 > 止吐 > Cannabinoid",
    "mechanism": "CB1受器致效，抑制化療相關嘔吐",
    "indications": "腸胃蠕動異常、嘔吐、便祕/腹瀉、IBD或IBS（依藥物）",
    "effects": "活化對應受器，產生受器相關生理效應",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Prochlorperazine",
    "category": "腸胃科 > 止吐 > D2阻斷",
    "mechanism": "D2受器拮抗，抑制CTZ",
    "indications": "腸胃蠕動異常、嘔吐、便祕/腹瀉、IBD或IBS（依藥物）",
    "effects": "調節多巴胺傳導，影響精神症狀、EPS、泌乳或帕金森症狀",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Fosaprepitant",
    "category": "腸胃科 > 止吐 > NK1阻斷",
    "mechanism": "NK1/substance P受器拮抗",
    "indications": "腸胃蠕動異常、嘔吐、便祕/腹瀉、IBD或IBS（依藥物）",
    "effects": "阻斷對應受器或通道，降低該路徑效應",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Proglumide",
    "category": "腸胃科 > 消化性潰瘍 > Gastrin受器阻斷",
    "mechanism": "Gastrin受器拮抗，抑制胃酸",
    "indications": "治Zollinger-Ellison syndrome(胃泌素瘤)首選；酸性下作用佳，故不與制酸劑及其他抗胃酸藥合用；首選用藥；用於預防及治療壓力性潰瘍所致之胃出血 (111-2)",
    "effects": "阻斷對應受器或通道，降低該路徑效應；PDF重點：效持久、不可逆抑制 H+/K+ ATPase (106-1)",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Lansoprazole",
    "category": "腸胃科 > 消化性潰瘍 > PPI",
    "mechanism": "不可逆抑制胃壁細胞H+/K+ ATPase",
    "indications": "首選用藥；用於預防及治療壓力性潰瘍所致之胃出血 (111-2)",
    "effects": "抑制胃酸分泌",
    "mnemonic": "p.65: 用puzzle拼出PPI <取自小鳥醫師8.0>\np.65: 屁屁挨(PPI)打，怕揍(-prazole)\np.116: 蓋地板(台語，起頭咖)(Ketoco-)對阿祖(-azole)來說是一種苦行(Cushing)，可以治Cushing syndrome\np.116: 阿祖(-azole)看到爛(lanosterol)人很不爽，他踢他屁屁(P450)，剁他耳朵(ergosterol)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Simethicone",
    "category": "腸胃科 > 消脹氣",
    "mechanism": "降低氣泡表面張力，使小氣泡合併排出",
    "indications": "未在PDF同列明確標示；依分類臨床適應症複習",
    "effects": "依其機轉產生對應藥理作用；請搭配適應症與考點複習",
    "mnemonic": "p.69: 消滅氣空\np.69: cone（錐體）像要把脹氣的泡泡刺破",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Aloe",
    "category": "腸胃科 > 瀉劑 > 刺激性瀉劑",
    "mechanism": "刺激腸神經叢與腸黏膜分泌，促進蠕動",
    "indications": "刺激性瀉劑：必殺(Bisa-)卡司(Castor, Cascara)， 都是孤獨的()，水拿(Senna)起只需單手；Opioid 阻抗；無法通過BBB，不影響止痛",
    "effects": "促進神經傳遞物質或內分泌/代謝反應；PDF重點：無法通過BBB，不影響止痛",
    "mnemonic": "p.68: 刺激性瀉劑：必殺(Bisa-)卡司(Castor, Cascara)， 都是孤獨的(Aloe)，水拿(Senna)起只需單手 (Danthron)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Danthron",
    "category": "腸胃科 > 瀉劑 > 刺激性瀉劑",
    "mechanism": "刺激腸神經叢與腸黏膜分泌，促進蠕動",
    "indications": "刺激性瀉劑：必殺(Bisa-)卡司(Castor, Cascara)， 都是孤獨的(Aloe)，水拿(Senna)起只需單手；Opioid 阻抗；無法通過BBB，不影響止痛",
    "effects": "促進神經傳遞物質或內分泌/代謝反應；PDF重點：無法通過BBB，不影響止痛",
    "mnemonic": "p.68: 刺激性瀉劑：必殺(Bisa-)卡司(Castor, Cascara)， 都是孤獨的(Aloe)，水拿(Senna)起只需單手 (Danthron)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Senna",
    "category": "腸胃科 > 瀉劑 > 刺激性瀉劑",
    "mechanism": "刺激腸神經叢與腸黏膜分泌，促進蠕動",
    "indications": "刺激性瀉劑：必殺(Bisa-)卡司(Castor, Cascara)， 都是孤獨的(Aloe)，水拿()起只需單手；Opioid 阻抗；無法通過BBB，不影響止痛",
    "effects": "促進神經傳遞物質或內分泌/代謝反應；PDF重點：無法通過BBB，不影響止痛",
    "mnemonic": "p.68: 刺激性瀉劑：必殺(Bisa-)卡司(Castor, Cascara)， 都是孤獨的(Aloe)，水拿(Senna)起只需單手 (Danthron)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Eluxadoline",
    "category": "腸胃科 > 腸躁症 > μ/κ致效/δ拮抗",
    "mechanism": "μ與κ opioid受器致效、δ受器拮抗，減少腹瀉型IBS",
    "indications": "非吸收性抗生素",
    "effects": "活化對應受器，產生受器相關生理效應；PDF重點：agonist，活化 GC-C → 增加 cGMP→活化；regulator）氯通道→促進 Cl⁻、HCO₃⁻、",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Rifaximin",
    "category": "腸胃科 > 腸躁症 > 非吸收性抗生素",
    "mechanism": "抑制細菌DNA-dependent RNA polymerase，局部作用於腸道",
    "indications": "非吸收性抗生素",
    "effects": "干擾DNA/RNA或細胞分裂，產生細胞毒性；PDF重點：agonist，活化 GC-C → 增加 cGMP→活化；regulator）氯通道→促進 Cl⁻、HCO₃⁻、",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Brompheniramine",
    "category": "自泌素 > Histamine > 第一代H1阻斷",
    "mechanism": "H1受器反向致效/拮抗，較易過BBB且有抗M作用",
    "indications": "氣喘/COPD、動暈、尿失禁、帕金森/EPS或散瞳（依藥物）",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Carbinoxamine",
    "category": "自泌素 > Histamine > 第一代H1阻斷",
    "mechanism": "H1受器反向致效/拮抗，較易過BBB且有抗M作用",
    "indications": "(1)治動暈症、幫助睡眠(114-2)、治孕；可做成止癢軟膏、可緩解藥物引起的；可用於懷孕婦女的噁心嘔吐；抗膽鹼作用",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Cyclizine",
    "category": "自泌素 > Histamine > 第一代H1阻斷",
    "mechanism": "H1受器反向致效/拮抗，較易過BBB且有抗M作用",
    "indications": "(2)可抗帕金森氏",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Doxylamine",
    "category": "自泌素 > Histamine > 第一代H1阻斷",
    "mechanism": "H1受器反向致效/拮抗，較易過BBB且有抗M作用",
    "indications": "抗膽鹼作用；(2)可抗帕金森氏",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "p.58: 破麻傷心(Promethazine)、沒開心(Meclizine)就讓大家去大分海、大門海(兩個海洋Diphenhy-, Dimenhy-)多吸一點拉麵(Doxy-lamine)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Tropisetron",
    "category": "自泌素 > Serotonin > 5-HT3拮抗",
    "mechanism": "5-HT3離子通道拮抗",
    "indications": "偏頭痛、止吐、腸胃蠕動或精神科適應症（依受器）",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "p.67: 這種常常用在化療止吐，化療都躺在床上所以也是吐在床上，吐了就要洗(台語)床(-setron)\np.67: 見自泌素",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Idarucizumab",
    "category": "血液腫瘤科 > 抗凝血 > Dabigatran解毒",
    "mechanism": "單株抗體片段，結合Dabigatran並中和其抗凝作用",
    "indications": "特定癌症或腫瘤標靶治療",
    "effects": "結合毒物/重金屬或繞過毒性路徑以促進排除",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Dalteparin",
    "category": "血液腫瘤科 > 抗凝血 > LMWH",
    "mechanism": "活化Antithrombin，以抑制Xa為主",
    "indications": "特定癌症或腫瘤標靶治療",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號；PDF重點：(109-1)→不會造成",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Enoxaparin",
    "category": "血液腫瘤科 > 抗凝血 > LMWH",
    "mechanism": "活化Antithrombin，以抑制Xa為主",
    "indications": "可用於HIT 病人",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號；PDF重點：(109-1)→不會造成",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Ifosfamide",
    "category": "血液腫瘤科 > 抗癌 > Alkylating nitrogen mustard",
    "mechanism": "形成DNA交聯，抑制DNA複製",
    "indications": "特定癌症或腫瘤標靶治療",
    "effects": "干擾DNA/RNA或細胞分裂，產生細胞毒性",
    "mnemonic": "p.99: 一個可憐(acrolein造成膀胱炎)的MENSA(mensa解毒)會員被綁架，他覺得很幹(肝活 化)，就捏爆綁匪的膀胱(膀胱炎)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Carmustine",
    "category": "血液腫瘤科 > 抗癌 > Alkylating nitrosourea",
    "mechanism": "可穿BBB之DNA烷化/交聯藥",
    "indications": "特定癌症或腫瘤標靶治療",
    "effects": "干擾DNA/RNA或細胞分裂，產生細胞毒性",
    "mnemonic": "p.99: 笨蛋(氮Nitrosoureas)，那麼油(脂溶)，一定要(-must-)給我過BBB(可過BBB)啊",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Daunorubicin",
    "category": "血液腫瘤科 > 抗癌 > Antitumor antibiotics/Anthracyclines",
    "mechanism": "嵌入DNA、抑制topoisomerase II並產生自由基",
    "indications": "特定癌症或腫瘤標靶治療",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "p.100: 紅傘(台語，anthra-)、小紅莓、ruby(紅寶石)、心臟毒性~~~~都是紅的\np.100: 魯賓遜(-rubicin)在荒島上很自由(自由基)但也很餓(topoisomerase2)，所以吃小紅莓，結果 心臟中毒\np.100: 魯賓遜(-rubicin) 到了島的北邊(Dau-nor-)，求他麥偷三創(Mitoxanetrone)，其他都隨 (Doso-)便你",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Idarubicin",
    "category": "血液腫瘤科 > 抗癌 > Antitumor antibiotics/Anthracyclines",
    "mechanism": "嵌入DNA、抑制topoisomerase II並產生自由基",
    "indications": "特定癌症或腫瘤標靶治療",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "p.100: 紅傘(台語，anthra-)、小紅莓、ruby(紅寶石)、心臟毒性~~~~都是紅的\np.100: 魯賓遜(-rubicin)在荒島上很自由(自由基)但也很餓(topoisomerase2)，所以吃小紅莓，結果 心臟中毒\np.100: 魯賓遜(-rubicin) 到了島的北邊(Dau-nor-)，求他麥偷三創(Mitoxanetrone)，其他都隨 (Doso-)便你",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Topotecan",
    "category": "血液腫瘤科 > 抗癌 > Topoisomerase I抑制",
    "mechanism": "抑制topoisomerase I，阻止DNA單股斷裂修復",
    "indications": "特定癌症或腫瘤標靶治療",
    "effects": "干擾DNA/RNA或細胞分裂，產生細胞毒性",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Aminocaproic acid",
    "category": "血液腫瘤科 > 抗纖溶",
    "mechanism": "lysine類似物，抑制plasminogen結合fibrin",
    "indications": "抗Heparin(離子態與Heparin 結合)；factor VIIIFc domain conjugate，治療與預防 A 型血友病患者出血；factor IXalbumin conjugate，治療及預防 B 型血友病患者出血；factor VIII concentrate，治療與預防 von Willebrand disease 患者出血",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）；PDF重點：抑制plasminogen 活化(抗tPA) (107-2)",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Aprotinin",
    "category": "血液腫瘤科 > 抗纖溶",
    "mechanism": "抑制plasmin與kallikrein等serine protease",
    "indications": "factor VIIIFc domain conjugate，治療與預防 A 型血友病患者出血；factor IXalbumin conjugate，治療及預防 B 型血友病患者出血；factor VIII concentrate，治療與預防 von Willebrand disease 患者出血；recombinant von Willebrand factor，治療與 von Willebrand disease",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Prasugrel",
    "category": "血液腫瘤科 > 抗血小板 > ADP P2Y12拮抗",
    "mechanism": "不可逆阻斷P2Y12 ADP受器，抑制血小板活化",
    "indications": "特定癌症或腫瘤標靶治療",
    "effects": "阻斷對應受器或通道，降低該路徑效應",
    "mnemonic": "p.96: 怕輸哥(Prasugrel)和臭屁哥(Clopidogrel)想要買一塊A級的地皮(ADP-R)，但是地(Ti-)檢署說(-clo-) 那塊地皮(-pidine)有鬧鬼(Ticlopidine最易導致neutropenia)不能出售，怕輸哥聽到後生氣到被氣死 (SE: 想像臉紅紅=Prasugrel最易出血)，但是臭屁哥聽到消息承受得住(用於冠狀動脈放支架，心導管術前)\np.96: ***想tickle(ticlo-)她，摳她屁洞(clopidogrel)，persuade(Prasugrel)她跟我做。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Iron dextran",
    "category": "血液腫瘤科 > 抗貧血 > 鐵劑",
    "mechanism": "補充鐵以促進heme/hemoglobin合成",
    "indications": "解毒(螯合)(108-1)",
    "effects": "促進神經傳遞物質或內分泌/代謝反應",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Alteplase",
    "category": "血液腫瘤科 > 血栓溶解劑",
    "mechanism": "活化plasminogen為plasmin，分解fibrin血栓",
    "indications": "作用於血栓中",
    "effects": "依其機轉產生對應藥理作用；請搭配適應症與考點複習",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Reteplase",
    "category": "血液腫瘤科 > 血栓溶解劑",
    "mechanism": "活化plasminogen為plasmin，分解fibrin血栓",
    "indications": "作用於血栓中",
    "effects": "依其機轉產生對應藥理作用；請搭配適應症與考點複習",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Urokinase",
    "category": "血液腫瘤科 > 血栓溶解劑",
    "mechanism": "活化plasminogen為plasmin，分解fibrin血栓",
    "indications": "特定癌症或腫瘤標靶治療",
    "effects": "依其機轉產生對應藥理作用；請搭配適應症與考點複習",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Gefitinib",
    "category": "風濕免疫/腫瘤 > 標靶治療 > EGFR TKI",
    "mechanism": "抑制EGFR tyrosine kinase",
    "indications": "非小細胞肺癌具EGFR 突變, 胰臟癌；腹瀉",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "p.93: 你姊夫(gefi-)在二樓(erlo-)處理egg(EGFR)，你先洗手(台，Cetu)在上去找他，不然怕你吐 (panitu-)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Aflibercept",
    "category": "風濕免疫/腫瘤 > 標靶治療 > VEGF trap",
    "mechanism": "可溶性VEGF receptor融合蛋白，結合VEGF/PlGF",
    "indications": "治轉移性大腸直腸癌",
    "effects": "依其機轉產生對應藥理作用；請搭配適應症與考點複習",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Ramucirumab",
    "category": "風濕免疫/腫瘤 > 標靶治療 > VEGFR2抗體",
    "mechanism": "抗VEGFR2單株抗體，抑制血管新生",
    "indications": "特定癌症或腫瘤標靶治療",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號；PDF重點：Bevacizumab：造成腸穿孔。因抗",
    "mnemonic": "p.93: 拉姆(Ramu-)從被窩(Beva-)起來，看到是晴天(suni-)，爽啦(sora-)\np.93: 你老母(Ramu-)咧，真的很白目(台, Beva-)耶，知道我要考試，還跟我說：”爽啦(Sora-)是 晴天(suni-)”，還跟我比YA(V, VGFR)，Sunny(Suni-)，備馬(Beva-) 拉母(Ramu-)牛去曬 太陽，爽啦(Sora-)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Mefenamic acid",
    "category": "風濕免疫科 > NSAID > Fenamate類",
    "mechanism": "可逆抑制COX，降低PG生成",
    "indications": "緩解經痛；高度selective，治RA、；無抗血小板作用；(Vioxx)易血栓，已下架",
    "effects": "降低前列腺素生成，解熱、止痛、抗發炎；PDF重點：增加MI、中風風險；無抗血小板作用",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Naproxen",
    "category": "風濕免疫科 > NSAID > Propionic acid類",
    "mechanism": "可逆抑制COX-1/2，降低PG生成",
    "indications": "解熱強，治慢性",
    "effects": "降低前列腺素生成，解熱、止痛、抗發炎",
    "mnemonic": "p.83: 拿Pro扇🡺拿這麼專業的扇子搧風，解熱強也是應該的",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Aldesleukin",
    "category": "風濕免疫科 > 免疫增強劑",
    "mechanism": "重組IL-2，促進T/NK細胞活化",
    "indications": "治慢性肉芽腫；治腎細胞癌、黑色素瘤；治黑色素瘤；增加免疫",
    "effects": "促進神經傳遞物質或內分泌/代謝反應；PDF重點：增加免疫；化療後(嗜中性球↑)",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Brodalumab",
    "category": "風濕免疫科 > 生物製劑 > Anti-IL-17",
    "mechanism": "阻斷IL-17A或IL-17受器，抑制Th17發炎",
    "indications": "過敏/蕁麻疹、動暈或胃酸相關疾病（依受器）",
    "effects": "阻斷對應受器或通道，降低該路徑效應",
    "mnemonic": "p.91: Bro(Broda-), Us(Uste-IL12,23)一世(Ixe)社畜(secu-), 只能一起(IL-17)加班好好乾 (斑塊型乾癬)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Ixekizumab",
    "category": "風濕免疫科 > 生物製劑 > Anti-IL-17",
    "mechanism": "阻斷IL-17A或IL-17受器，抑制Th17發炎",
    "indications": "過敏/蕁麻疹、動暈或胃酸相關疾病（依受器）",
    "effects": "阻斷對應受器或通道，降低該路徑效應",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Palivizumab",
    "category": "風濕免疫科 > 生物製劑 > Anti-RSV",
    "mechanism": "抗RSV F protein，預防RSV感染",
    "indications": "未在PDF同列明確標示；依分類臨床適應症複習",
    "effects": "依其機轉產生對應藥理作用；請搭配適應症與考點複習；PDF重點：→使周邊血液和神經中的淋巴細胞數目下降",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Golimumab",
    "category": "風濕免疫科 > 生物製劑 > Anti-TNF",
    "mechanism": "抗TNF-α單株抗體/片段，中和TNF",
    "indications": "未在PDF同列明確標示；依分類臨床適應症複習",
    "effects": "依其機轉產生對應藥理作用；請搭配適應症與考點複習",
    "mnemonic": "p.89: 當Intern(Etan-、In-)很阿達(Ada-)沒關係，舌頭(Certo-)夠力(Goli-)就好",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Pegloticase",
    "category": "風濕免疫科 > 痛風 > Uricase",
    "mechanism": "Uricase類藥物，將尿酸代謝為較水溶性allantoin",
    "indications": "急性痛風、慢性高尿酸血症或腫瘤溶解症預防",
    "effects": "依其機轉產生對應藥理作用；請搭配適應症與考點複習",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Benzbromarone",
    "category": "風濕免疫科 > 痛風 > 促尿酸排泄",
    "mechanism": "抑制近曲小管尿酸再吸收，增加尿酸排泄",
    "indications": "急性痛風、慢性高尿酸血症或腫瘤溶解症預防",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號",
    "mnemonic": "p.86: 蘇菲(sulfin-)開benz(benzbro-)走進一家利息很pro(高)的bank(probenecid)，尿尿(-urinol) Anakinra 原本用於RA，抑制IL 1α and IL 1β的活性",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Lesinurad",
    "category": "風濕免疫科 > 痛風 > 促尿酸排泄",
    "mechanism": "抑制近曲小管尿酸再吸收，增加尿酸排泄",
    "indications": "急性痛風、慢性高尿酸血症或腫瘤溶解症預防",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Methohexital",
    "category": "麻醉科 > 全身麻醉 > IV麻醉誘導",
    "mechanism": "Barbiturate；增強GABA_A並延長Cl-通道開啟",
    "indications": "焦慮、失眠、鎮靜、抗癲癇或麻醉誘導（依藥物）",
    "effects": "增強GABA-A抑制性傳導，鎮靜、抗焦慮、抗癲癇",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Desflurane",
    "category": "麻醉科 > 全身麻醉 > 吸入性鹵化麻醉劑",
    "mechanism": "增強GABA_A/甘胺酸等抑制性通道並抑制興奮性傳遞，造成全身麻醉",
    "indications": "高劑量致癲癇",
    "effects": "增強GABA-A抑制性傳導，鎮靜、抗焦慮、抗癲癇；PDF重點：心輸出率越低則對溶解大者誘導速率增加；大劑量下均有支氣管擴張、子宮舒張效果",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Sevoflurane",
    "category": "麻醉科 > 全身麻醉 > 吸入性鹵化麻醉劑",
    "mechanism": "增強GABA_A/甘胺酸等抑制性通道並抑制興奮性傳遞，造成全身麻醉",
    "indications": "'@吸入性麻醉劑整理",
    "effects": "增強GABA-A抑制性傳導，鎮靜、抗焦慮、抗癲癇",
    "mnemonic": "p.43: Diss(Des-)台灣人的口頭禪七次(Sevo-)，愛說(Iso-)摁(En-)哈囉(Halo-)沒啥事(Methoxy-)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Droperidol",
    "category": "麻醉科 > 全身麻醉 > 神經安定鎮痛",
    "mechanism": "D2受器拮抗，止吐/鎮靜",
    "indications": "焦慮、失眠、鎮靜、抗癲癇或麻醉誘導（依藥物）",
    "effects": "調節多巴胺傳導，影響精神症狀、EPS、泌乳或帕金森症狀",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Prilocaine",
    "category": "麻醉科 > 局部麻醉 > Amide",
    "mechanism": "由細胞內側阻斷電壓依賴性Na+通道，抑制去極化",
    "indications": "氣喘/COPD、動暈、尿失禁、帕金森/EPS或散瞳（依藥物）",
    "effects": "抑制電位依賴性鈉通道，降低神經或心肌興奮性",
    "mnemonic": "p.45: 不批發(Bupiva-)叫貨久(效長)的肉批發(Ropiva-) 改做利多(Lido-)的棕色皮肉(Prilo-)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Atracurium",
    "category": "麻醉科 > 神經肌肉阻斷劑 > 非去極化",
    "mechanism": "競爭性Nm受器拮抗，阻斷骨骼肌神經肌肉傳遞",
    "indications": "氣喘/COPD、動暈、尿失禁、帕金森/EPS或散瞳（依藥物）",
    "effects": "阻斷對應受器或通道，降低該路徑效應",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Teicoplanin",
    "category": "感染科 > 抗生素 > Lipoglycopeptide",
    "mechanism": "結合D-Ala-D-Ala並抑制細胞壁合成；部分亦破壞膜功能",
    "indications": "細菌感染治療（菌種依藥物光譜）",
    "effects": "抑制細菌細胞壁、蛋白質、核酸或葉酸代謝",
    "mnemonic": "p.107: 鐵口騙你(Teicoplanin)，舔那(Tela-)痘疤(Dalba-)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Acebutolol",
    "category": "神經/精神科 > 交感神經阻斷劑 > β1選擇性阻斷",
    "mechanism": "選擇性β1受器阻斷，降低心率/收縮力/renin釋放",
    "indications": "ISA (不用於MI)；治左心室衰竭",
    "effects": "增加心收縮力/心跳或阻斷後降低心率與耗氧；PDF重點：助內皮細胞活化nitric oxide synthase 產",
    "mnemonic": "p.14: -olol(A~M開頭的)：AM(白天)的OL比較挑(選擇性)，只要1支banana(B1 antagonist)\np.14: -olol(P開頭的)：晚上(不是下方A~M)的OL就不挑(非選擇性)，banana全都要(B antagonist)\np.14: 一個賽車比賽(carteolol)，在地上丟乒乓球(pindolol & penbutolol)，最後得了第一 (ace=1)acebutolol)。\np.14: 王牌(ace-)乒乓(pin-, pen-)車(car-)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Ethacrynic acid",
    "category": "心臟科 > 利尿劑 > Loop diuretics",
    "mechanism": "抑制亨利氏環厚上升支NKCC2，增加Na+/K+/Cl-/Ca2+/Mg2+排出",
    "indications": "嚴重心衰竭",
    "effects": "增加尿鈉/水排出，依部位影響K、Ca、Mg與酸鹼",
    "mnemonic": "p.46: 這些藥作用在NKCC2，兩個C圍成一個loop(loop diuretics)，像是賽車場🡺賽車電影fast and furious(furosemide)；開賽車就可以把妹(Bumetanide)；開太快出車禍，圍觀的問說”他死了嗎 (Torsemide)?”；最後真的不幸走了，其他人為他哭(other cry🡺ethacry-)。 車禍很嚴重🡺針對一些很嚴重的病症(ex急性肺水腫、嚴重心衰竭、腎衰竭)； 賽車又很吵🡺SE：有耳毒性； 車禍現場有很多砂石🡺高尿酸(砂石 結晶的感覺)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Torsemide",
    "category": "心臟科 > 利尿劑 > Loop diuretics",
    "mechanism": "抑制亨利氏環厚上升支NKCC2，增加Na+/K+/Cl-/Ca2+/Mg2+排出",
    "indications": "嚴重心衰竭",
    "effects": "增加尿鈉/水排出，依部位影響K、Ca、Mg與酸鹼",
    "mnemonic": "p.46: 這些藥作用在NKCC2，兩個C圍成一個loop(loop diuretics)，像是賽車場🡺賽車電影fast and furious(furosemide)；開賽車就可以把妹(Bumetanide)；開太快出車禍，圍觀的問說”他死了嗎 (Torsemide)?”；最後真的不幸走了，其他人為他哭(other cry🡺ethacry-)。 車禍很嚴重🡺針對一些很嚴重的病症(ex急性肺水腫、嚴重心衰竭、腎衰竭)； 賽車又很吵🡺SE：有耳毒性； 車禍現場有很多砂石🡺高尿酸(砂石 結晶的感覺)\np.46: 她一脫(Tor-)讓肌膚露(Furo-)， 就讓我射滿地(-semide)，不買大奶(Bume-tanide)的寫真囉(loop)， 會瞬間後悔，一剎那哭死(Etha-crynic)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Digitoxin",
    "category": "心臟科 > 心衰竭 > Digitalis glycosides",
    "mechanism": "抑制Na+/K+ ATPase，使細胞內Na+上升、NCX受抑、Ca2+上升",
    "indications": "心衰竭症狀改善或預後治療",
    "effects": "抑制電位依賴性鈉通道，降低神經或心肌興奮性",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Sildenafil",
    "category": "心臟科 > 降血壓/肺高壓 > PDE5抑制",
    "mechanism": "抑制PDE5，使cGMP上升，平滑肌鬆弛",
    "indications": "治陽痿；孕婦高血壓；治療肺動脈高壓；胞接受體的結抗劑",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Apomorphine",
    "category": "神經/精神科 > 抗帕金森 > DA受器致效/救援",
    "mechanism": "DA受器致效，用於L-dopa on-off現象救援",
    "indications": "帕金森氏症或藥物誘發EPS",
    "effects": "活化對應受器，產生受器相關生理效應",
    "mnemonic": "p.31: 羅賓(Ropin)怕門被鎖(pramipexole)起來，看見裸體夠挺(rotigotine)，然後啊被潑墨 (apomorphine)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Nicotine",
    "category": "神經/精神科 > 膽鹼性致效劑 > 天然",
    "mechanism": "Nicotinic受器致效",
    "indications": "作用於DA 神經元的α4β2-R→直接；菸癮治療：減藥治療；作用於Glu 神經元的α7-R→間接DA↑；作用於GABA 神經元的α4β2-",
    "effects": "活化對應受器，產生受器相關生理效應；PDF重點：DA↑",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Sulindac",
    "category": "風濕免疫科 > NSAID > Acetic acid類",
    "mechanism": "可逆抑制COX-1/2，降低PG生成",
    "indications": "治RA、抗大腸癌、前列腺癌、乳癌",
    "effects": "降低RAAS作用，血管擴張、降醛固酮並保護心腎",
    "mnemonic": "p.84: 印度(Indo-)的豬哥(台)(Diclo-)：很會抗發炎，但很傷胃\np.84: 豬哥常常熬夜到sun出來(Sulin-)，很傷肝",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Ouabain",
    "category": "心臟科 > 心衰竭 > Digitalis glycosides",
    "mechanism": "抑制Na+/K+ ATPase，使細胞內Na+上升、NCX受抑、Ca2+上升",
    "indications": "心衰竭症狀改善或預後治療",
    "effects": "抑制電位依賴性鈉通道，降低神經或心肌興奮性",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Efavirenz",
    "category": "感染科 > 抗HIV > NNRTI",
    "mechanism": "非核苷類反轉錄酶變構抑制",
    "indications": "懷孕可用",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號；PDF重點：阻斷HIV-1 及HIV-2 嵌合酶(integrase)的活性；阻斷複製完成的病毒釋出",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Rimantadine",
    "category": "感染科 > 抗流感 > M2阻斷",
    "mechanism": "阻斷Influenza A M2 H+通道，抑制脫殼",
    "indications": "氣喘/COPD、動暈、尿失禁、帕金森/EPS或散瞳（依藥物）",
    "effects": "阻斷M受器，減少腺體分泌與平滑肌收縮；可散瞳、心跳上升、支氣管擴張；PDF重點：神經胺酸酶抑制劑；抑制新病毒自宿主細胞中釋放",
    "mnemonic": "p.122: Rimantadine (龜剛 治帕金森症 阻止病毒複製 • “很man的2個人” -man- 阻",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Zanamivir",
    "category": "感染科 > 抗流感 > Neuraminidase inhibitor",
    "mechanism": "抑制neuraminidase，阻止病毒釋出",
    "indications": "未在PDF同列明確標示；依分類臨床適應症複習",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）；PDF重點：抑制新病毒自宿主細胞中釋放；(抑制Polymerase Acidic(PA)",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Pimodivir",
    "category": "感染科 > 抗流感 > PB2 inhibitor",
    "mechanism": "抑制influenza PB2 cap-binding protein",
    "indications": "未在PDF同列明確標示；依分類臨床適應症複習",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號；PDF重點：(抑制Polymerase Basic",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Oritavancin",
    "category": "感染科 > 抗生素 > Lipoglycopeptide",
    "mechanism": "結合D-Ala-D-Ala並抑制細胞壁合成；部分亦破壞膜功能",
    "indications": "細菌感染治療（菌種依藥物光譜）",
    "effects": "抑制細菌細胞壁、蛋白質、核酸或葉酸代謝",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Tedizolid",
    "category": "感染科 > 抗生素 > Oxazolidinone",
    "mechanism": "結合50S，阻止70S起始複合體形成",
    "indications": "Linezolid 可作為Vancomycin(僅IV)治MRSA 替代用藥",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）；PDF重點：抑制起始作用；(1)Aminoglycoside 抑制30S 和50S 的結合，使核糖體無法在mRNA 上作用",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Valacyclovir",
    "category": "感染科 > 抗病毒 > HSV/VZV核苷類前驅物",
    "mechanism": "前驅物，轉為acyclovir/penciclovir後抑制viral DNA polymerase",
    "indications": "病毒感染治療或預防",
    "effects": "干擾DNA/RNA或細胞分裂，產生細胞毒性；PDF重點：嵌入DNA chain 造成中斷；僅局部使用於HSV 造成之角膜",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Cidofovir",
    "category": "感染科 > 抗病毒 > Nucleotide analog",
    "mechanism": "胞嘧啶核苷酸類似物，抑制viral DNA polymerase",
    "indications": "病毒感染治療或預防",
    "effects": "干擾DNA/RNA或細胞分裂，產生細胞毒性；PDF重點：※是否需要thymidine kinase 才能活化這個藥物?(以下僅舉",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Yohimbine",
    "category": "神經/精神科 > 交感神經阻斷劑 > α2阻斷",
    "mechanism": "α2受器阻斷，增加NE釋放",
    "indications": "高血壓、BPH、嗜鉻細胞瘤或雷諾氏現象（依選擇性）",
    "effects": "降低中樞交感輸出或增加NE釋放（依致效/拮抗）；PDF重點：HR↑性器官血管擴張",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Carteolol",
    "category": "神經/精神科 > 交感神經阻斷劑 > β1/β2阻斷",
    "mechanism": "非選擇性β受器阻斷",
    "indications": "對於心搏過慢的高血壓患者",
    "effects": "支氣管平滑肌放鬆；可有心悸、低血鉀、高血糖；PDF重點：(增加在休息狀態之心跳速率)",
    "mnemonic": "p.14: -olol(A~M開頭的)：AM(白天)的OL比較挑(選擇性)，只要1支banana(B1 antagonist)\np.14: -olol(P開頭的)：晚上(不是下方A~M)的OL就不挑(非選擇性)，banana全都要(B antagonist)\np.14: 一個賽車比賽(carteolol)，在地上丟乒乓球(pindolol & penbutolol)，最後得了第一 (ace=1)acebutolol)。\np.14: 王牌(ace-)乒乓(pin-, pen-)車(car-)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Penbutolol",
    "category": "神經/精神科 > 交感神經阻斷劑 > β1/β2阻斷",
    "mechanism": "非選擇性β受器阻斷",
    "indications": "對於心搏過慢的高血壓患者",
    "effects": "支氣管平滑肌放鬆；可有心悸、低血鉀、高血糖；PDF重點：(增加在休息狀態之心跳速率)",
    "mnemonic": "p.14: -olol(A~M開頭的)：AM(白天)的OL比較挑(選擇性)，只要1支banana(B1 antagonist)\np.14: -olol(P開頭的)：晚上(不是下方A~M)的OL就不挑(非選擇性)，banana全都要(B antagonist)\np.14: 一個賽車比賽(carteolol)，在地上丟乒乓球(pindolol & penbutolol)，最後得了第一 (ace=1)acebutolol)。\np.14: 王牌(ace-)乒乓(pin-, pen-)車(car-)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Nebivolol",
    "category": "神經/精神科 > 交感神經阻斷劑 > β1選擇性阻斷",
    "mechanism": "選擇性β1受器阻斷，降低心率/收縮力/renin釋放",
    "indications": "治左心室衰竭",
    "effects": "增加心收縮力/心跳或阻斷後降低心率與耗氧；PDF重點：助內皮細胞活化nitric oxide synthase 產",
    "mnemonic": "p.14: -olol(A~M開頭的)：AM(白天)的OL比較挑(選擇性)，只要1支banana(B1 antagonist)\np.14: -olol(P開頭的)：晚上(不是下方A~M)的OL就不挑(非選擇性)，banana全都要(B antagonist)\np.52: 卡文(carve)內壁(nebi-)必收(biso-)metal(meto-) 翻譯：卡文迪許向內壁咚，且一定會收藏 metal金屬類型的唱片\np.52: 我也(meto-)鼻屎(biso-)卡血管(carve-)那邊(nebi-) 卡血管=car-vessel，簡稱carve!阿 卡血管就心衰竭了!\np.52: 眉頭(Meto-)那邊(Nebi-) 一堆閉鎖(Biso-)粉刺，別再喝咖啡(Carve-)了！",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Pramipexole",
    "category": "神經/精神科 > 抗帕金森 > DA受器致效",
    "mechanism": "非Ergot類D2/D3受器致效",
    "indications": "帕金森氏症或藥物誘發EPS",
    "effects": "調節多巴胺傳導，影響精神症狀、EPS、泌乳或帕金森症狀",
    "mnemonic": "p.31: 羅賓(Ropin)怕門被鎖(pramipexole)起來，看見裸體夠挺(rotigotine)，然後啊被潑墨 (apomorphine)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Isoproterenol",
    "category": "神經/精神科 > 擬交感神經藥物 > 直接型",
    "mechanism": "β1、β2受器致效",
    "indications": "治氣喘(少用)",
    "effects": "支氣管平滑肌放鬆；可有心悸、低血鉀、高血糖",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Epoetin",
    "category": "血液腫瘤科 > 造血刺激",
    "mechanism": "Erythropoietin receptor致效，促進紅血球生成",
    "indications": "引發之貧血患者；治療鐮刀型貧血；見免疫藥物；治嚴重",
    "effects": "活化對應受器，產生受器相關生理效應",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Cisatracurium",
    "category": "麻醉科 > 神經肌肉阻斷劑 > 非去極化",
    "mechanism": "競爭性Nm受器拮抗，阻斷骨骼肌神經肌肉傳遞",
    "indications": "氣喘/COPD、動暈、尿失禁、帕金森/EPS或散瞳（依藥物）",
    "effects": "阻斷對應受器或通道，降低該路徑效應",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Liothyronine",
    "category": "內分泌/新陳代謝 > 甲狀腺 > 甲狀腺素",
    "mechanism": "T3補充，活化核內甲狀腺素受器",
    "indications": "甲狀腺功能亢進/低下或甲狀腺風暴",
    "effects": "依其機轉產生對應藥理作用；請搭配適應症與考點複習；PDF重點：物)所造成的甲狀腺功能低下",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Liotrix",
    "category": "內分泌/新陳代謝 > 甲狀腺 > 甲狀腺素",
    "mechanism": "T4/T3複方補充",
    "indications": "懷孕OK、口服；治甲狀腺亢進 [碘化作用@thyroid，合成T3, T4；蛋白結合態少，不適用於孕婦",
    "effects": "依其機轉產生對應藥理作用；請搭配適應症與考點複習；PDF重點：[ 主要抑制去碘化(T4 轉；[主要抑制T3, T4 合成]",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Pramlintide",
    "category": "內分泌/新陳代謝 > 糖尿病 > Amylin類似物",
    "mechanism": "Amylin類似物；抑制glucagon、延緩胃排空並降低食慾",
    "indications": "糖尿病血糖控制",
    "effects": "降低血糖或改善胰島素/腸泌素/腎糖排出路徑；PDF重點：降低餐後血糖、抑制食慾(可減重)；抑制升糖素釋放、減少胃排空之效果",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Somatrem",
    "category": "內分泌/新陳代謝 > 腦下垂體 > GH/GHRH",
    "mechanism": "重組GH，活化JAK-STAT並促進IGF-1",
    "indications": "用，使血糖上升",
    "effects": "促進神經傳遞物質或內分泌/代謝反應；PDF重點：刺激蛋白質合成，血糖上升，增加；肌肉，減少脂肪",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Somatropin",
    "category": "內分泌/新陳代謝 > 腦下垂體 > GH/GHRH",
    "mechanism": "重組GH，活化JAK-STAT並促進IGF-1",
    "indications": "用，使血糖上升；用於對exogenous GH 無反應的IGF-1 缺乏",
    "effects": "促進神經傳遞物質或內分泌/代謝反應；PDF重點：刺激蛋白質合成，血糖上升，增加；肌肉，減少脂肪",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Sermorelin",
    "category": "內分泌/新陳代謝 > 腦下垂體 > GHRH類似物",
    "mechanism": "GHRH受器致效，促進GH釋放",
    "indications": "診斷GH 有無上升，以鑑別pituitary or hypothalamus 的",
    "effects": "活化對應受器，產生受器相關生理效應",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Hydrochlorothiazide",
    "category": "心臟科 > 利尿劑 > Thiazides",
    "mechanism": "抑制遠曲小管Na+/Cl- cotransporter (NCC)",
    "indications": "高血壓(首選)；心衰竭",
    "effects": "增加尿鈉/水排出，依部位影響K、Ca、Mg與酸鹼；PDF重點：抑制 Na+/Cl-；Ca2+↓",
    "mnemonic": "p.46: Thiazide唸快一點🡺蝦子，感覺蝦子吃多了不健康(高血糖 高血脂 高血鈣 高尿酸)，但會低血壓(🡺治高血壓) (好啦 這口訣沒那麼相關 但唸快一點變蝦子 是取自醫學口訣大亂鬥 我覺得滿好笑的就記起來了 by士博)\np.46: Thiazide唸起來像“泰山”： 1. 卡通那個泰山(Tarzan)可以晃很遠，所以是作用在遠曲小管(DCT) 2. 真正那座很高的泰山：治高血壓第一線用藥；SE：除了Na+, K+之外其他都變高 3. 泰山崩於前而色不變：治腎因性尿崩症\np.46: NCC(國家通訊委員會)駐點在泰山，泰山的蝦子，蝦子有很多鈣，升血鈣 (Que Logic?)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Amyl nitrite",
    "category": "心臟科 > 心絞痛 > Nitrate/Nitrite",
    "mechanism": "釋放NO→cGMP上升→血管平滑肌鬆弛，主要降低preload",
    "indications": "心絞痛與缺血性心臟病症狀控制",
    "effects": "促進神經傳遞物質或內分泌/代謝反應；PDF重點：抑制β1→CO↓→需氧量↓；主要舒張冠狀動脈",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Amrinone",
    "category": "心臟科 > 心衰竭 > PDE3抑制",
    "mechanism": "抑制PDE3，使cAMP上升，增加心收縮並血管舒張",
    "indications": "心衰竭症狀改善或預後治療",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號；PDF重點：心收縮、血管舒張；低鎂、腎功能差時)→不可與造成",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Tocainide",
    "category": "心臟科 > 抗心律不整 > Class IB",
    "mechanism": "阻斷Na+通道，縮短APD，偏作用於缺血/去極化心肌",
    "indications": "心律不整治療",
    "effects": "抑制電位依賴性鈉通道，降低神經或心肌興奮性；PDF重點：置毛地黃造成的心律不整",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Magnesium sulfate",
    "category": "心臟科 > 抗心律不整 > Class V/其他",
    "mechanism": "穩定膜電位並抑制早期後去極化，用於torsades與digoxin相關心律不整",
    "indications": "心律不整治療",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Nirmatrelvir",
    "category": "感染科 > 抗COVID-19 > Protease inhibitor",
    "mechanism": "Nirmatrelvir抑制SARS-CoV-2 3CL protease；ritonavir抑制CYP3A增強濃度",
    "indications": "病毒感染治療或預防",
    "effects": "抑制病毒複製、成熟或進入宿主細胞",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Paxlovid",
    "category": "感染科 > 抗COVID-19 > Protease inhibitor",
    "mechanism": "Nirmatrelvir抑制SARS-CoV-2 3CL protease；ritonavir抑制CYP3A增強濃度",
    "indications": "病毒感染治療或預防",
    "effects": "抑制病毒複製、成熟或進入宿主細胞",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Remdesivir",
    "category": "感染科 > 抗COVID-19 > RdRp inhibitor",
    "mechanism": "Adenosine類似前驅物，抑制viral RNA-dependent RNA polymerase",
    "indications": "病毒感染治療或預防",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）；PDF重點：抑制病毒的複製)",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Dasabuvir",
    "category": "感染科 > 抗HCV > NS5B polymerase inhibitor",
    "mechanism": "抑制HCV NS5B RNA-dependent RNA polymerase",
    "indications": "病毒感染治療或預防",
    "effects": "干擾DNA/RNA或細胞分裂，產生細胞毒性",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Etravirine",
    "category": "感染科 > 抗HIV > NNRTI",
    "mechanism": "非核苷類反轉錄酶變構抑制",
    "indications": "懷孕可用",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號；PDF重點：阻斷HIV-1 及HIV-2 嵌合酶(integrase)的活性；阻斷複製完成的病毒釋出",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Nevirapine",
    "category": "感染科 > 抗HIV > NNRTI",
    "mechanism": "非核苷類反轉錄酶變構抑制",
    "indications": "懷孕可用",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號；PDF重點：非核苷酸反轉錄酶抑制劑；直接抑制HIV-1 反轉錄酶",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Rilpivirine",
    "category": "感染科 > 抗HIV > NNRTI",
    "mechanism": "非核苷類反轉錄酶變構抑制",
    "indications": "懷孕可用",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號；PDF重點：阻斷HIV-1 及HIV-2 嵌合酶(integrase)的活性；阻斷複製完成的病毒釋出",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Didanosine",
    "category": "感染科 > 抗HIV > NRTI",
    "mechanism": "核苷類RT抑制；經磷酸化後造成DNA鏈終止",
    "indications": "懷孕可用",
    "effects": "干擾DNA/RNA或細胞分裂，產生細胞毒性；PDF重點：→卡病毒DNA 阻斷其複製；非核苷酸反轉錄酶抑制劑",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Zalcitabine",
    "category": "感染科 > 抗HIV > NRTI",
    "mechanism": "核苷類RT抑制；經磷酸化後造成DNA鏈終止",
    "indications": "懷孕可用",
    "effects": "干擾DNA/RNA或細胞分裂，產生細胞毒性；PDF重點：非核苷酸反轉錄酶抑制劑；直接抑制HIV-1 反轉錄酶",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Atazanavir",
    "category": "感染科 > 抗HIV > Protease inhibitor",
    "mechanism": "抑制HIV protease，阻止病毒多蛋白切割成熟",
    "indications": "病毒感染治療或預防",
    "effects": "抑制病毒複製、成熟或進入宿主細胞",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Lopinavir",
    "category": "感染科 > 抗HIV > Protease inhibitor",
    "mechanism": "抑制HIV protease，阻止病毒多蛋白切割成熟",
    "indications": "病毒感染治療或預防",
    "effects": "抑制病毒複製、成熟或進入宿主細胞",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Saquinavir",
    "category": "感染科 > 抗HIV > Protease inhibitor",
    "mechanism": "抑制HIV protease，阻止病毒多蛋白切割成熟",
    "indications": "病毒感染治療或預防",
    "effects": "抑制病毒複製、成熟或進入宿主細胞",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Peramivir",
    "category": "感染科 > 抗流感 > Neuraminidase inhibitor",
    "mechanism": "抑制neuraminidase，阻止病毒釋出",
    "indications": "未在PDF同列明確標示；依分類臨床適應症複習",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）；PDF重點：(抑制Polymerase Acidic(PA)；(抑制Polymerase Basic",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Netilmicin",
    "category": "感染科 > 抗生素 > Aminoglycosides",
    "mechanism": "不可逆結合30S，造成mRNA誤讀並抑制起始複合體",
    "indications": "細菌感染治療（菌種依藥物光譜）",
    "effects": "干擾DNA/RNA或細胞分裂，產生細胞毒性；PDF重點：(3)神經肌肉阻斷(Curare-like effect: 抑Ach",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Plazomicin",
    "category": "感染科 > 抗生素 > Aminoglycosides",
    "mechanism": "不可逆結合30S，造成mRNA誤讀並抑制起始複合體",
    "indications": "細菌感染治療（菌種依藥物光譜）",
    "effects": "干擾DNA/RNA或細胞分裂，產生細胞毒性",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Sisomicin",
    "category": "感染科 > 抗生素 > Aminoglycosides",
    "mechanism": "不可逆結合30S，造成mRNA誤讀並抑制起始複合體",
    "indications": "細菌感染治療（菌種依藥物光譜）",
    "effects": "干擾DNA/RNA或細胞分裂，產生細胞毒性",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Delafloxacin",
    "category": "感染科 > 抗生素 > Fluoroquinolones",
    "mechanism": "抑制DNA gyrase與topoisomerase IV",
    "indications": "細菌感染治療（菌種依藥物光譜）",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "p.113: 二代 Cipro：(濕婆)有ne ne，是女生(可以打G negative)，長得很醜(G+不行)又會流綠膿(可以 打PsA)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Enoxacin",
    "category": "感染科 > 抗生素 > Fluoroquinolones",
    "mechanism": "抑制DNA gyrase與topoisomerase IV",
    "indications": "Gati-、Gemi-、Moxi-)：抗G(+)效果好；抗厭氧菌",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Gatifloxacin",
    "category": "感染科 > 抗生素 > Fluoroquinolones",
    "mechanism": "抑制DNA gyrase與topoisomerase IV",
    "indications": "抗厭氧菌",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "p.113: 乾弟(Gati-)跑來我家借米(Gemi-)， 說是拜魔神仔(Moxi-)的啦(Dela-)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Gemifloxacin",
    "category": "感染科 > 抗生素 > Fluoroquinolones",
    "mechanism": "抑制DNA gyrase與topoisomerase IV",
    "indications": "抗厭氧菌",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "p.113: 乾弟(Gati-)跑來我家借米(Gemi-)， 說是拜魔神仔(Moxi-)的啦(Dela-)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Lomefloxacin",
    "category": "感染科 > 抗生素 > Fluoroquinolones",
    "mechanism": "抑制DNA gyrase與topoisomerase IV",
    "indications": "Gati-、Gemi-、Moxi-)：抗G(+)效果好；抗厭氧菌",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Norfloxacin",
    "category": "感染科 > 抗生素 > Fluoroquinolones",
    "mechanism": "抑制DNA gyrase與topoisomerase IV",
    "indications": "細菌感染治療（菌種依藥物光譜）",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Ofloxacin",
    "category": "感染科 > 抗生素 > Fluoroquinolones",
    "mechanism": "抑制DNA gyrase與topoisomerase IV",
    "indications": "Gati-、Gemi-、Moxi-)：抗G(+)效果好；抗厭氧菌",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Lefamulin",
    "category": "感染科 > 抗生素 > Pleuromutilin",
    "mechanism": "結合50S peptidyl transferase center，抑制蛋白質合成",
    "indications": "殺菌型；新藥，抗菌活性與Macrolides 相似",
    "effects": "抑制細菌細胞壁、蛋白質、核酸或葉酸代謝；PDF重點：殺菌型",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Nalidixic acid",
    "category": "感染科 > 抗生素 > Quinolone第一代",
    "mechanism": "抑制DNA gyrase與topoisomerase IV",
    "indications": "細菌感染治療（菌種依藥物光譜）",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Sulfacytine",
    "category": "感染科 > 抗生素 > Sulfonamide",
    "mechanism": "PABA類似物，競爭性抑制dihydropteroate synthase",
    "indications": "治兒童中耳炎；抑菌型(+TMP=殺菌型)",
    "effects": "抑制細菌細胞壁、蛋白質、核酸或葉酸代謝；PDF重點：抑制二氫蝶酸合成酶；抑菌型(+TMP=殺菌型)",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Eravacycline",
    "category": "感染科 > 抗生素 > 新型Tetracycline",
    "mechanism": "結合30S，抑制蛋白質合成",
    "indications": "細菌感染治療（菌種依藥物光譜）",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Fomivirsen",
    "category": "感染科 > 抗病毒 > Antisense",
    "mechanism": "反義oligonucleotide，抑制CMV IE2 mRNA",
    "indications": "※Trifluridine, Docosanol(tropical use：治Keratoconjunctivity)",
    "effects": "干擾DNA/RNA或細胞分裂，產生細胞毒性；PDF重點：眼壓↑；抑制蛋白質製造",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Famciclovir",
    "category": "感染科 > 抗病毒 > HSV/VZV核苷類前驅物",
    "mechanism": "前驅物，轉為acyclovir/penciclovir後抑制viral DNA polymerase",
    "indications": "僅局部使用於HSV 造成之角膜；抗CMV(HHV-5)；抗HSV、VZV、CMV 首選；也可治療有抗性的HSV, VZV",
    "effects": "干擾DNA/RNA或細胞分裂，產生細胞毒性；PDF重點：僅局部使用於HSV 造成之角膜；骨髓抑制",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Docosanol",
    "category": "感染科 > 抗病毒 > HSV外用",
    "mechanism": "抑制HSV外套膜與宿主細胞膜融合",
    "indications": "※Trifluridine, (tropical use：治Keratoconjunctivity)",
    "effects": "抑制病毒複製、成熟或進入宿主細胞",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Praziquantel",
    "category": "感染科 > 抗蟲 > 吸蟲/絛蟲",
    "mechanism": "增加蟲體Ca2+通透性，造成痙攣麻痺",
    "indications": "吸蟲與絛蟲感染；血吸蟲常考",
    "effects": "增加蟲體Ca2+通透性造成痙攣性麻痺與外皮受損",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Atovaquone",
    "category": "感染科 > 抗蟲 > 抗瘧",
    "mechanism": "Atovaquone抑制粒線體cytochrome bc1；Proguanil抑制DHFR",
    "indications": "可用於孕婦",
    "effects": "依蟲種破壞寄生蟲神經肌肉/微管或代謝，使蟲體麻痺或死亡",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Malarone",
    "category": "感染科 > 抗蟲 > 抗瘧",
    "mechanism": "Atovaquone抑制粒線體cytochrome bc1；Proguanil抑制DHFR",
    "indications": "可用於孕婦",
    "effects": "依蟲種破壞寄生蟲神經肌肉/微管或代謝，使蟲體麻痺或死亡",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Niclosamide",
    "category": "感染科 > 抗蟲 > 絛蟲",
    "mechanism": "抑制寄生蟲氧化磷酸化",
    "indications": "寄生蟲/原蟲感染治療",
    "effects": "依蟲種破壞寄生蟲神經肌肉/微管或代謝，使蟲體麻痺或死亡",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Mebendazole",
    "category": "感染科 > 抗蟲 > 線蟲",
    "mechanism": "結合β-tubulin，抑制微小管聚合與葡萄糖攝取",
    "indications": "寄生蟲/原蟲感染治療",
    "effects": "依蟲種破壞寄生蟲神經肌肉/微管或代謝，使蟲體麻痺或死亡",
    "mnemonic": "p.116: 蓋地板(台語，起頭咖)(Ketoco-)對阿祖(-azole)來說是一種苦行(Cushing)，可以治Cushing syndrome\np.116: 阿祖(-azole)看到爛(lanosterol)人很不爽，他踢他屁屁(P450)，剁他耳朵(ergosterol)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Thiabendazole",
    "category": "感染科 > 抗蟲 > 線蟲",
    "mechanism": "結合β-tubulin，抑制微小管聚合與葡萄糖攝取",
    "indications": "寄生蟲/原蟲感染治療",
    "effects": "依蟲種破壞寄生蟲神經肌肉/微管或代謝，使蟲體麻痺或死亡",
    "mnemonic": "p.116: 蓋地板(台語，起頭咖)(Ketoco-)對阿祖(-azole)來說是一種苦行(Cushing)，可以治Cushing syndrome\np.116: 阿祖(-azole)看到爛(lanosterol)人很不爽，他踢他屁屁(P450)，剁他耳朵(ergosterol)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Ivermectin",
    "category": "感染科 > 抗蟲 > 線蟲/外寄生蟲",
    "mechanism": "活化glutamate-gated Cl-通道，造成麻痺",
    "indications": "寄生蟲/原蟲感染治療",
    "effects": "依蟲種破壞寄生蟲神經肌肉/微管或代謝，使蟲體麻痺或死亡",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Eflornithine",
    "category": "感染科 > 抗蟲 > 非洲錐蟲",
    "mechanism": "抑制ornithine decarboxylase",
    "indications": "高血壓；部分用於心衰竭、腎保護或心絞痛",
    "effects": "依蟲種破壞寄生蟲神經肌肉/微管或代謝，使蟲體麻痺或死亡",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Posaconazole",
    "category": "感染科 > 抗黴菌 > Azoles/Triazole",
    "mechanism": "抑制真菌14α-demethylase，降低ergosterol合成",
    "indications": "Azole 類唯一治療絲狀黴菌",
    "effects": "破壞真菌細胞膜/細胞壁或麥角固醇合成",
    "mnemonic": "p.116: 一起拿走(-conazole)唇&膜(抑egosterol醇合成，抑膜生成)\np.116: 蓋地板(台語，起頭咖)(Ketoco-)對阿祖(-azole)來說是一種苦行(Cushing)，可以治Cushing syndrome\np.116: 阿祖(-azole)看到爛(lanosterol)人很不爽，他踢他屁屁(P450)，剁他耳朵(ergosterol)\np.117: 我哩(Vori-)個去(麴菌)，小美穿薄紗(Posa-)，啊嘶~(絲黴菌)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Anidulafungin",
    "category": "感染科 > 抗黴菌 > Echinocandin",
    "mechanism": "抑制β-1,3-D-glucan synthase，阻斷真菌細胞壁合成",
    "indications": "高血壓、心絞痛、心衰竭、心律不整、青光眼（依藥物）",
    "effects": "抑制細菌細胞壁、蛋白質、核酸或葉酸代謝；PDF重點：synthase→抑制",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Micafungin",
    "category": "感染科 > 抗黴菌 > Echinocandin",
    "mechanism": "抑制β-1,3-D-glucan synthase，阻斷真菌細胞壁合成",
    "indications": "高血壓、心絞痛、心衰竭、心律不整、青光眼（依藥物）",
    "effects": "抑制細菌細胞壁、蛋白質、核酸或葉酸代謝；PDF重點：synthase→抑制",
    "mnemonic": "p.117: 糖果(-candy)屋的房間(-fungin)的牆壁(cell wall)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Natamycin",
    "category": "感染科 > 抗黴菌 > Polyene",
    "mechanism": "結合ergosterol形成孔洞，破壞真菌細胞膜",
    "indications": "黴菌感染治療",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Bisoprolol",
    "category": "神經/精神科 > 交感神經阻斷劑 > β1選擇性阻斷",
    "mechanism": "選擇性β1受器阻斷，降低心率/收縮力/renin釋放",
    "indications": "高血壓、BPH、嗜鉻細胞瘤或雷諾氏現象（依選擇性）",
    "effects": "增加心收縮力/心跳或阻斷後降低心率與耗氧",
    "mnemonic": "p.14: -olol(A~M開頭的)：AM(白天)的OL比較挑(選擇性)，只要1支banana(B1 antagonist)\np.14: -olol(P開頭的)：晚上(不是下方A~M)的OL就不挑(非選擇性)，banana全都要(B antagonist)\np.52: 卡文(carve)內壁(nebi-)必收(biso-)metal(meto-) 翻譯：卡文迪許向內壁咚，且一定會收藏 metal金屬類型的唱片\np.52: 我也(meto-)鼻屎(biso-)卡血管(carve-)那邊(nebi-) 卡血管=car-vessel，簡稱carve!阿 卡血管就心衰竭了!\np.52: 眉頭(Meto-)那邊(Nebi-) 一堆閉鎖(Biso-)粉刺，別再喝咖啡(Carve-)了！",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Cytisine",
    "category": "神經/精神科 > 成癮/戒菸",
    "mechanism": "nicotinic受器部分致效",
    "indications": "作用於GABA 神經元的α4β2-；膀胱纖維化；戒斷症狀；→治猝睡症和過動症",
    "effects": "活化對應受器，產生受器相關生理效應；PDF重點：R→DA↓，但會去敏化，導致成癮；抑制DAT、NET",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Rotigotine",
    "category": "神經/精神科 > 抗帕金森 > DA受器致效",
    "mechanism": "非Ergot類D2/D3受器致效",
    "indications": "帕金森氏症或藥物誘發EPS",
    "effects": "調節多巴胺傳導，影響精神症狀、EPS、泌乳或帕金森症狀",
    "mnemonic": "p.31: 羅賓(Ropin)怕門被鎖(pramipexole)起來，看見裸體夠挺(rotigotine)，然後啊被潑墨 (apomorphine)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Orphenadrine",
    "category": "神經/精神科 > 抗帕金森 > 抗膽鹼",
    "mechanism": "中樞M受器阻斷，改善震顫與僵硬",
    "indications": "氣喘/COPD、動暈、尿失禁、帕金森/EPS或散瞳（依藥物）",
    "effects": "阻斷M受器，減少腺體分泌與平滑肌收縮；可散瞳、心跳上升、支氣管擴張",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Procyclidine",
    "category": "神經/精神科 > 抗帕金森 > 抗膽鹼",
    "mechanism": "中樞M受器阻斷，改善震顫與僵硬",
    "indications": "氣喘/COPD、動暈、尿失禁、帕金森/EPS或散瞳（依藥物）",
    "effects": "阻斷M受器，減少腺體分泌與平滑肌收縮；可散瞳、心跳上升、支氣管擴張",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Orphenadrine",
    "category": "神經/精神科 > 抗帕金森 > 抗膽鹼藥",
    "mechanism": "中樞Muscarinic受器阻斷，降低相對過高之ACh活性",
    "indications": "氣喘/COPD、動暈、尿失禁、帕金森/EPS或散瞳（依藥物）",
    "effects": "阻斷M受器，減少腺體分泌與平滑肌收縮；可散瞳、心跳上升、支氣管擴張",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Procyclidine",
    "category": "神經/精神科 > 抗帕金森 > 抗膽鹼藥",
    "mechanism": "中樞Muscarinic受器阻斷，降低相對過高之ACh活性",
    "indications": "氣喘/COPD、動暈、尿失禁、帕金森/EPS或散瞳（依藥物）",
    "effects": "阻斷M受器，減少腺體分泌與平滑肌收縮；可散瞳、心跳上升、支氣管擴張",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Moclobemide",
    "category": "神經/精神科 > 抗憂鬱 > MAO-A抑制",
    "mechanism": "可逆性選擇性抑制MAO-A",
    "indications": "適應症：抗憂鬱、鎮靜",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號；PDF重點：抑制MAO-A(可逆)；抑制MAO-B",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Doxepin",
    "category": "神經/精神科 > 抗憂鬱 > TCA",
    "mechanism": "抑制NET與SERT，增加NE與5-HT；另有M1/H1/α1阻斷",
    "indications": "TCA 解毒劑：sodium bicarbonate",
    "effects": "血管/括約肌收縮；阻斷時則血管與前列腺平滑肌放鬆",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Nortriptyline",
    "category": "神經/精神科 > 抗憂鬱 > TCA",
    "mechanism": "抑制NET與SERT，增加NE與5-HT；另有M1/H1/α1阻斷",
    "indications": "高血壓、BPH、嗜鉻細胞瘤或雷諾氏現象（依選擇性）",
    "effects": "血管/括約肌收縮；阻斷時則血管與前列腺平滑肌放鬆",
    "mnemonic": "p.25: I promise(-ipramine)要帶小孩去環島(TCA, “Taiwan - cycle around”)，但trip太冷(- triptyline)，所以不去北(N)或南(S)(抑制NE Serotonin回收)，也不吃HAM(H a M antagonist)。小孩也promise不亂尿床",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Protriptyline",
    "category": "神經/精神科 > 抗憂鬱 > TCA",
    "mechanism": "抑制NET與SERT，增加NE與5-HT；另有M1/H1/α1阻斷",
    "indications": "高血壓、BPH、嗜鉻細胞瘤或雷諾氏現象（依選擇性）",
    "effects": "血管/括約肌收縮；阻斷時則血管與前列腺平滑肌放鬆",
    "mnemonic": "p.25: I promise(-ipramine)要帶小孩去環島(TCA, “Taiwan - cycle around”)，但trip太冷(- triptyline)，所以不去北(N)或南(S)(抑制NE Serotonin回收)，也不吃HAM(H a M antagonist)。小孩也promise不亂尿床\np.25: 我是黛西(Im-, Desi-)，叫我(Clo-mi-)小戴就好，我發誓(-i-pramine)這趟台灣環島(TCA) 會很充實，不是(Nor-)專業(Pro-)的登山者建議要多帶衣物， 因為寒流到了，所以這趟旅行會太 冷(-trip-tyline)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Amobarbital",
    "category": "神經/精神科 > 抗焦慮/鎮靜安眠 > Barbiturates",
    "mechanism": "GABA_A受器正向變構調節；延長Cl-通道開啟時間，高劑量可直接開啟",
    "indications": "治療癲癇發作；耐藥性、生理依賴性(戒斷症狀嚴重)；短效、純安眠，無鎮靜、解除焦慮效果",
    "effects": "增強GABA-A抑制性傳導，鎮靜、抗焦慮、抗癲癇",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Clorazepate",
    "category": "神經/精神科 > 抗焦慮/鎮靜安眠 > Benzodiazepines",
    "mechanism": "GABA_A受器正向變構調節；增加Cl-通道開啟頻率",
    "indications": "焦慮、失眠、鎮靜、抗癲癇或麻醉誘導（依藥物）",
    "effects": "增強GABA-A抑制性傳導，鎮靜、抗焦慮、抗癲癇",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Zolpidem",
    "category": "神經/精神科 > 抗焦慮/鎮靜安眠 > Z-drugs",
    "mechanism": "作用於BZ1/GABA_A複合體，促進GABA抑制性傳遞",
    "indications": "短效、純安眠，無鎮靜、解除焦慮效果",
    "effects": "增強GABA-A抑制性傳導，鎮靜、抗焦慮、抗癲癇；PDF重點：短效、純安眠，無鎮靜、解除焦慮效果",
    "mnemonic": "p.23: Z drug：Z開頭的，純安眠作用(zzz…)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Zopiclone",
    "category": "神經/精神科 > 抗焦慮/鎮靜安眠 > Z-drugs",
    "mechanism": "作用於BZ1/GABA_A複合體，促進GABA抑制性傳遞",
    "indications": "焦慮、失眠、鎮靜、抗癲癇或麻醉誘導（依藥物）",
    "effects": "增強GABA-A抑制性傳導，鎮靜、抗焦慮、抗癲癇",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Mephenytoin",
    "category": "神經/精神科 > 抗癲癇 > Hydantoin類",
    "mechanism": "阻斷電壓依賴性Na+通道",
    "indications": "癲癇發作控制；部分用於神經痛或情緒穩定",
    "effects": "抑制電位依賴性鈉通道，降低神經或心肌興奮性",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Nirvanol",
    "category": "神經/精神科 > 抗癲癇 > Hydantoin類代謝物",
    "mechanism": "Mephenytoin活性代謝物，阻斷Na+通道",
    "indications": "氣喘/COPD、動暈、尿失禁、帕金森/EPS或散瞳（依藥物）",
    "effects": "抑制電位依賴性鈉通道，降低神經或心肌興奮性",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Amisulpride",
    "category": "神經/精神科 > 抗精神病 > 非典型",
    "mechanism": "主要阻斷D2與5-HT2A受器",
    "indications": "思覺失調症、躁症、Tourette症或止吐（依藥物）",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "p.29: 一個厲害的導彈(A missile pride)打2個target (D2 D3)\np.29: 二代統整：派很多（multi-acting receptors）阿兵哥（-apine）去打仗，結果一個飛彈（Amisul-）幹 掉兩個（anti-D2、D3），我很厲害也幹掉（-idone）兩個（anti-seratonin、dopamine）",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Aripiprazole",
    "category": "神經/精神科 > 抗精神病 > 非典型/部分致效",
    "mechanism": "D2受器部分致效，並具5-HT1A部分致效與5-HT2A拮抗",
    "indications": "Partial agonist of D2 治療",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "p.29: 阿里巴巴(Ari-)再厲害，到Day2都只剩部分體力(鎮靜效果最好，體重增加最少)\np.65: 屁屁挨(PPI)打，怕揍(-prazole)\np.116: 蓋地板(台語，起頭咖)(Ketoco-)對阿祖(-azole)來說是一種苦行(Cushing)，可以治Cushing syndrome\np.116: 阿祖(-azole)看到爛(lanosterol)人很不爽，他踢他屁屁(P450)，剁他耳朵(ergosterol)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Methoxamine",
    "category": "神經/精神科 > 擬交感神經藥物 > α1致效劑",
    "mechanism": "α1受器致效，升壓並可反射性降心率",
    "indications": "治陣發性心搏過速(PSVT)",
    "effects": "血管/括約肌收縮；阻斷時則血管與前列腺平滑肌放鬆",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Fenoterol",
    "category": "神經/精神科 > 擬交感神經藥物 > β2短效致效劑",
    "mechanism": "β2受器致效，活化Gs/cAMP使支氣管或子宮平滑肌鬆弛",
    "indications": "氣喘/COPD支氣管痙攣；部分藥物可安胎",
    "effects": "支氣管平滑肌放鬆；可有心悸、低血鉀、高血糖",
    "mnemonic": "p.62: 短效：阿布(albu)牌渦輪(terbut-)很terrible(-terol)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Pirbuterol",
    "category": "神經/精神科 > 擬交感神經藥物 > β2短效致效劑",
    "mechanism": "β2受器致效，活化Gs/cAMP使支氣管或子宮平滑肌鬆弛",
    "indications": "氣喘/COPD支氣管痙攣；部分藥物可安胎",
    "effects": "支氣管平滑肌放鬆；可有心悸、低血鉀、高血糖；PDF重點：β2 agonist 會升血糖",
    "mnemonic": "p.62: 短效：阿布(albu)牌渦輪(terbut-)很terrible(-terol)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Hexamethonium",
    "category": "神經/精神科 > 膽鹼性拮抗劑 > 神經節阻斷",
    "mechanism": "Nn nicotinic受器阻斷，抑制自律神經節傳遞",
    "indications": "口服戒菸降血壓",
    "effects": "阻斷對應受器或通道，降低該路徑效應；PDF重點：口服戒菸降血壓",
    "mnemonic": "p.19: 要阻止尼古丁傳宗接代(阻斷nicotinic receptor)：趁沒camera(mecamyla)，踹梅莎(trimetho)，讓 她害喜(hexa)🡺梅莎就BP低、暈倒了(姿勢性低血壓)\np.19: 比賽剩6(Hexa-)分鐘時，Try沒3分(trimethaphan)沒差(meca-)\np.19: 踹(Tri)我腳(Meca台語)六次(hexa)，幹(gamglion阻斷劑)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Mecamylamine",
    "category": "神經/精神科 > 膽鹼性拮抗劑 > 神經節阻斷",
    "mechanism": "Nn nicotinic受器阻斷，抑制自律神經節傳遞",
    "indications": "口服戒菸降血壓",
    "effects": "阻斷對應受器或通道，降低該路徑效應；PDF重點：口服戒菸降血壓",
    "mnemonic": "p.19: 要阻止尼古丁傳宗接代(阻斷nicotinic receptor)：趁沒camera(mecamyla)，踹梅莎(trimetho)，讓 她害喜(hexa)🡺梅莎就BP低、暈倒了(姿勢性低血壓)\np.19: 踹(Tri)我腳(Meca台語)六次(hexa)，幹(gamglion阻斷劑)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Lobeline",
    "category": "神經/精神科 > 膽鹼性致效劑 > 天然",
    "mechanism": "Nicotinic受器致效",
    "indications": "重症肌無力、青光眼、阿茲海默症或解抗膽鹼毒性（依藥物）",
    "effects": "活化對應受器，產生受器相關生理效應",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Montelukast",
    "category": "胸腔科 > 抗氣喘 > CysLT1拮抗",
    "mechanism": "阻斷CysLT1 leukotriene受器",
    "indications": "發炎疼痛、氣喘、肺高壓或胃黏膜保護（依藥物）",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "p.63: -lukast(leu卡死：所以就是卡死receptor)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Fenoterol",
    "category": "胸腔科 > 抗氣喘 > β2短效致效",
    "mechanism": "β2受器致效，促進cAMP使支氣管平滑肌鬆弛",
    "indications": "氣喘/COPD維持或急性支氣管痙攣緩解",
    "effects": "支氣管平滑肌放鬆；可有心悸、低血鉀、高血糖",
    "mnemonic": "p.62: 短效：阿布(albu)牌渦輪(terbut-)很terrible(-terol)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Balsalazide",
    "category": "腸胃科 > IBD > 5-ASA",
    "mechanism": "釋放5-ASA，抑制COX/NF-κB並減少腸黏膜發炎",
    "indications": "發炎疼痛、氣喘、肺高壓或胃黏膜保護（依藥物）",
    "effects": "降低前列腺素生成，解熱、止痛、抗發炎",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Olsalazine",
    "category": "腸胃科 > IBD > 5-ASA",
    "mechanism": "釋放5-ASA，抑制COX/NF-κB並減少腸黏膜發炎",
    "indications": "發炎疼痛、氣喘、肺高壓或胃黏膜保護（依藥物）",
    "effects": "降低前列腺素生成，解熱、止痛、抗發炎",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Difenoxin",
    "category": "腸胃科 > 止瀉劑 > 周邊Opioid致效",
    "mechanism": "周邊μ/δ opioid受器致效，抑制腸道ACh釋放與蠕動",
    "indications": "腸胃蠕動異常、嘔吐、便祕/腹瀉、IBD或IBS（依藥物）",
    "effects": "活化對應受器，產生受器相關生理效應",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Magnesium citrate",
    "category": "腸胃科 > 瀉劑 > 滲透壓瀉劑",
    "mechanism": "不被吸收或形成高滲，將水分留在腸腔",
    "indications": "瀉劑",
    "effects": "依其機轉產生對應藥理作用；請搭配適應症與考點複習",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Magnesium sulfate",
    "category": "腸胃科 > 瀉劑 > 滲透壓瀉劑",
    "mechanism": "不被吸收或形成高滲，將水分留在腸腔",
    "indications": "血鎂、水瀉；瀉劑",
    "effects": "依其機轉產生對應藥理作用；請搭配適應症與考點複習",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Methylcellulose",
    "category": "腸胃科 > 瀉劑 > 糞便成形劑",
    "mechanism": "吸水膨脹增加糞便體積，刺激蠕動反射",
    "indications": "瀉劑；將NH3轉變為水溶性氨有利排泄，改善；效快(水瀉)→",
    "effects": "依其機轉產生對應藥理作用；請搭配適應症與考點複習；PDF重點：增加介面活性，促水和脂肪混合；抑制脂溶性維生素",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Psyllium",
    "category": "腸胃科 > 瀉劑 > 糞便成形劑",
    "mechanism": "吸水膨脹增加糞便體積，刺激蠕動反射",
    "indications": "瀉劑；將NH3轉變為水溶性氨有利排泄，改善；效快(水瀉)→",
    "effects": "依其機轉產生對應藥理作用；請搭配適應症與考點複習；PDF重點：增加介面活性，促水和脂肪混合；抑制脂溶性維生素",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Dazoxiben",
    "category": "自泌素 > Eicosanoid > TXA2合成抑制",
    "mechanism": "抑制thromboxane A2 synthase",
    "indications": "發炎疼痛、氣喘、肺高壓或胃黏膜保護（依藥物）",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "p.60: 打手心(Dazoxi-)，Teacher(T)不可以(X)啊(A)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Astemizole",
    "category": "自泌素 > Histamine > 第二代H1阻斷",
    "mechanism": "周邊H1受器反向致效/拮抗，不易過BBB",
    "indications": "氣喘/COPD、動暈、尿失禁、帕金森/EPS或散瞳（依藥物）",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "p.58: “他叮，那叮，離心”：他被叮(-tadine)，那裡被叮(-nadine)，抽個血離心(-rizine)看有沒有瘧原蟲感 染",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Fexofenadine",
    "category": "自泌素 > Histamine > 第二代H1阻斷",
    "mechanism": "周邊H1受器反向致效/拮抗，不易過BBB",
    "indications": "氣喘/COPD、動暈、尿失禁、帕金森/EPS或散瞳（依藥物）",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Lomustine",
    "category": "血液腫瘤科 > 抗癌 > Alkylating nitrosourea",
    "mechanism": "可穿BBB之DNA烷化/交聯藥",
    "indications": "用來治療胰島細胞過度增生的胰臟癌",
    "effects": "干擾DNA/RNA或細胞分裂，產生細胞毒性",
    "mnemonic": "p.99: 笨蛋(氮Nitrosoureas)，那麼油(脂溶)，一定要(-must-)給我過BBB(可過BBB)啊",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Streptozocin",
    "category": "血液腫瘤科 > 抗癌 > Alkylating nitrosourea",
    "mechanism": "可穿BBB之DNA烷化/交聯藥",
    "indications": "用來治療胰島細胞過度增生的胰臟癌",
    "effects": "干擾DNA/RNA或細胞分裂，產生細胞毒性",
    "mnemonic": "p.99: 笨蛋(氮Nitrosoureas)，那麼油(脂溶)，一定要(-must-)給我過BBB(可過BBB)啊",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Eribulin",
    "category": "血液腫瘤科 > 抗癌 > Halichondrin",
    "mechanism": "抑制微小管生長，阻斷有絲分裂",
    "indications": "特定癌症或腫瘤標靶治療",
    "effects": "干擾DNA/RNA或細胞分裂，產生細胞毒性；PDF重點：抑制微管功能",
    "mnemonic": "p.101: 愛離不離",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Cilostazol",
    "category": "血液腫瘤科 > 抗血小板 > PDE3抑制",
    "mechanism": "抑制PDE3，使血小板cAMP上升並抑制凝集",
    "indications": "治間接性跛行(Intermittent claudication)",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號",
    "mnemonic": "p.96: 有一位PD(PDE)要去埃及拍紀錄片，所以在兩個pyramide(Dipyridamole)之間搭帳篷(cAMP↑)。金字塔裡 有很多稀有(Cilo-)statue(-stazol)和寶物，所以有很多盜墓人會想偷金字塔裡面的寶物(Dipyridamole 會有coronary steal)，偷完東西不想被抓所以要狂奔(做運動心電圖時用Dipyridamole)\np.96: ***我們去露營(cAMP↑)，我們聊一些大霹靂(dipyri-)、C羅明星(c羅star, Cilosta-)這類話題，但我壓 力很大(核醫用來做stress test)，因為我只準備這兩個話題…",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Darbepoetin",
    "category": "血液腫瘤科 > 造血刺激",
    "mechanism": "Erythropoietin receptor致效，促進紅血球生成",
    "indications": "引發之貧血患者；治療鐮刀型貧血；見免疫藥物；治嚴重",
    "effects": "活化對應受器，產生受器相關生理效應",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Encorafenib",
    "category": "風濕免疫/腫瘤 > 標靶治療 > BRAF抑制",
    "mechanism": "抑制突變BRAF kinase",
    "indications": "性黑色素瘤",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Vemurafenib",
    "category": "風濕免疫/腫瘤 > 標靶治療 > BRAF抑制",
    "mechanism": "抑制突變BRAF kinase",
    "indications": "特定癌症或腫瘤標靶治療",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Imatinib",
    "category": "風濕免疫/腫瘤 > 標靶治療 > Bcr-Abl TKI",
    "mechanism": "抑制Bcr-Abl tyrosine kinase",
    "indications": "特定癌症或腫瘤標靶治療",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "p.93: いま(現在，Ima-)打掃(Dasa-)!!!\np.93: Becareful!(Bcr)姨媽(Ima)大殺(Dasa)你囉!(Nilo)\np.93: 討厭費城(抑制費城染色體)的一馬(ima-)，所以在尼羅(nivo-)河旁邊的大沙漠(dasa-)騎駱 駝(camel->CML)，結果迷路(所也需要MAP, 阻斷MAPK路徑)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Nilotinib",
    "category": "風濕免疫/腫瘤 > 標靶治療 > Bcr-Abl TKI",
    "mechanism": "抑制Bcr-Abl tyrosine kinase",
    "indications": "特定癌症或腫瘤標靶治療",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "p.93: Becareful!(Bcr)姨媽(Ima)大殺(Dasa)你囉!(Nilo)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Binimetinib",
    "category": "風濕免疫/腫瘤 > 標靶治療 > MEK抑制",
    "mechanism": "抑制MEK1/2，阻斷MAPK路徑",
    "indications": "氣喘/COPD、動暈、尿失禁、帕金森/EPS或散瞳（依藥物）",
    "effects": "阻斷對應受器或通道，降低該路徑效應",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Cobimetinib",
    "category": "風濕免疫/腫瘤 > 標靶治療 > MEK抑制",
    "mechanism": "抑制MEK1/2，阻斷MAPK路徑",
    "indications": "氣喘/COPD、動暈、尿失禁、帕金森/EPS或散瞳（依藥物）",
    "effects": "阻斷對應受器或通道，降低該路徑效應；PDF重點：MEK2 上面抑制訊號",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Trametinib",
    "category": "風濕免疫/腫瘤 > 標靶治療 > MEK抑制",
    "mechanism": "抑制MEK1/2，阻斷MAPK路徑",
    "indications": "氣喘/COPD、動暈、尿失禁、帕金森/EPS或散瞳（依藥物）",
    "effects": "阻斷對應受器或通道，降低該路徑效應；PDF重點：MEK2 上面抑制訊號",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Bortezomib",
    "category": "風濕免疫/腫瘤 > 標靶治療 > Proteasome抑制",
    "mechanism": "抑制26S proteasome，促進腫瘤細胞凋亡",
    "indications": "特定癌症或腫瘤標靶治療",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Diflunisal",
    "category": "風濕免疫科 > NSAID > Salicylates",
    "mechanism": "抑制COX，解熱鎮痛抗發炎",
    "indications": "發炎疼痛、氣喘、肺高壓或胃黏膜保護（依藥物）",
    "effects": "降低前列腺素生成，解熱、止痛、抗發炎",
    "mnemonic": "p.83: 得了2倍量的流感(Di-flu)，當然難退燒(無解熱作用)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Everolimus",
    "category": "風濕免疫科 > 免疫抑制 > mTOR抑制",
    "mechanism": "與FKBP12結合抑制mTOR，抑制IL-2驅動之T cell增殖",
    "indications": "治腎細胞瘤",
    "effects": "抑制calcineurin→↓IL-2與T細胞活化，產生免疫抑制",
    "mnemonic": "p.87: 我騎摩托車(mTOR)去西螺(Siro-)，食物總是(Ever-)甜死(Temsi-)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Temsirolimus",
    "category": "風濕免疫科 > 免疫抑制 > mTOR抑制",
    "mechanism": "與FKBP12結合抑制mTOR，抑制IL-2驅動之T cell增殖",
    "indications": "治腎細胞瘤",
    "effects": "抑制calcineurin→↓IL-2與T細胞活化，產生免疫抑制",
    "mnemonic": "p.87: 我騎摩托車(mTOR)去西螺(Siro-)，食物總是(Ever-)甜死(Temsi-)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Lenalidomide",
    "category": "風濕免疫科 > 免疫調節 > TNF抑制",
    "mechanism": "免疫調節藥；降低TNF-α並調節T/NK細胞",
    "indications": "降低嗜中性球吞噬；抗血管增生→海豹肢；刺激T cell(促進細胞免疫)；抗發炎強",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號；PDF重點：降低嗜中性球吞噬；刺激T cell(促進細胞免疫)",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Ofatumumab",
    "category": "風濕免疫科 > 生物製劑 > Anti-CD20",
    "mechanism": "抗CD20單株抗體，耗竭B細胞",
    "indications": "未在PDF同列明確標示；依分類臨床適應症複習",
    "effects": "調節多巴胺傳導，影響精神症狀、EPS、泌乳或帕金森症狀",
    "mnemonic": "p.90: 你禿頭(Ritu-)是偶發禿(Ofatu-)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Otelixizumab",
    "category": "風濕免疫科 > 生物製劑 > Anti-CD3",
    "mechanism": "抗CD3單株抗體，調節/耗竭T細胞",
    "indications": "未在PDF同列明確標示；依分類臨床適應症複習",
    "effects": "依其機轉產生對應藥理作用；請搭配適應症與考點複習",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Teplizumab",
    "category": "風濕免疫科 > 生物製劑 > Anti-CD3",
    "mechanism": "抗CD3單株抗體，調節/耗竭T細胞",
    "indications": "未在PDF同列明確標示；依分類臨床適應症複習",
    "effects": "依其機轉產生對應藥理作用；請搭配適應症與考點複習",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Visilizumab",
    "category": "風濕免疫科 > 生物製劑 > Anti-CD3",
    "mechanism": "抗CD3單株抗體，調節/耗竭T細胞",
    "indications": "未在PDF同列明確標示；依分類臨床適應症複習",
    "effects": "依其機轉產生對應藥理作用；請搭配適應症與考點複習",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Enflurane",
    "category": "麻醉科 > 全身麻醉 > 吸入性鹵化麻醉劑",
    "mechanism": "增強GABA_A/甘胺酸等抑制性通道並抑制興奮性傳遞，造成全身麻醉",
    "indications": "高劑量致癲癇",
    "effects": "增強GABA-A抑制性傳導，鎮靜、抗焦慮、抗癲癇；PDF重點：心輸出率越低則對溶解大者誘導速率增加；大劑量下均有支氣管擴張、子宮舒張效果",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Methoxyflurane",
    "category": "麻醉科 > 全身麻醉 > 吸入性鹵化麻醉劑",
    "mechanism": "增強GABA_A/甘胺酸等抑制性通道並抑制興奮性傳遞，造成全身麻醉",
    "indications": "全身麻醉誘導/維持",
    "effects": "增強GABA-A抑制性傳導，鎮靜、抗焦慮、抗癲癇；PDF重點：大劑量下均有支氣管擴張、子宮舒張效果",
    "mnemonic": "p.43: Diss(Des-)台灣人的口頭禪七次(Sevo-)，愛說(Iso-)摁(En-)哈囉(Halo-)沒啥事(Methoxy-)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Etidocaine",
    "category": "麻醉科 > 局部麻醉 > Amide",
    "mechanism": "由細胞內側阻斷電壓依賴性Na+通道，抑制去極化",
    "indications": "氣喘/COPD、動暈、尿失禁、帕金森/EPS或散瞳（依藥物）",
    "effects": "抑制電位依賴性鈉通道，降低神經或心肌興奮性",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Lugol solution",
    "category": "內分泌/新陳代謝 > 甲狀腺 > 碘化物",
    "mechanism": "高劑量造成Wolff-Chaikoff效應，抑制甲狀腺激素釋放",
    "indications": "甲狀腺功能亢進/低下或甲狀腺風暴",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Linagliptin",
    "category": "內分泌/新陳代謝 > 糖尿病 > DPP-4抑制",
    "mechanism": "抑制DPP-4，延長內生性GLP-1/GIP作用",
    "indications": "糖尿病血糖控制",
    "effects": "降低血糖或改善胰島素/腸泌素/腎糖排出路徑",
    "mnemonic": "p.75: 他的前女友Ena(exena)，幫他LP注射，使LP變大(great LP🡺GLP-1)，然後就拿蛤蜊不停(- gliptin)地丟民進黨(DPP-4)抗議侵害大LP(抑制DPP分解GLP)\np.75: -gliptin: GLP-1不停,所以是抑制DPP分解",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "NPH insulin",
    "category": "內分泌/新陳代謝 > 糖尿病 > Insulin",
    "mechanism": "中效insulin製劑，含protamine延緩吸收",
    "indications": "糖尿病血糖控制",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Glibenclamide",
    "category": "內分泌/新陳代謝 > 糖尿病 > Sulfonylureas",
    "mechanism": "阻斷胰臟β細胞KATP通道，使Ca2+內流並促insulin分泌",
    "indications": "糖尿病血糖控制",
    "effects": "調節鈣離子通道/骨代謝/血管平滑肌收縮",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Vernakalant",
    "category": "心臟科 > 抗心律不整 > Class III",
    "mechanism": "阻斷K+通道，延長phase 3與ERP",
    "indications": "心律不整治療",
    "effects": "阻斷對應受器或通道，降低該路徑效應",
    "mnemonic": "p.55: 假的(K blocker) 阿喵(Amio-) 其實是Brety姐(Bretylium)，她一步踢來(Ibutilide)，都飛 踢(Dofeti-)， 求你(Drone-) ㄙㄡˊ她(Sota-，撫摸)的Vagina(Verna-) <取自高醫元廷藥理>",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Sevelamer",
    "category": "心臟科 > 降血脂 > Bile acid resins",
    "mechanism": "結合腸道膽酸/陰離子，增加膽酸排出並降低LDL",
    "indications": "高脂血症與動脈粥樣硬化風險降低",
    "effects": "依其機轉產生對應藥理作用；請搭配適應症與考點複習",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Atorvastatin",
    "category": "心臟科 > 降血脂 > Statins",
    "mechanism": "抑制HMG-CoA reductase，增加肝臟LDL receptor",
    "indications": "高脂血症與動脈粥樣硬化風險降低",
    "effects": "降低膽固醇合成、上調LDL受器",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Fluvastatin",
    "category": "心臟科 > 降血脂 > Statins",
    "mechanism": "抑制HMG-CoA reductase，增加肝臟LDL receptor",
    "indications": "高脂血症與動脈粥樣硬化風險降低",
    "effects": "降低膽固醇合成、上調LDL受器",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Lovastatin",
    "category": "心臟科 > 降血脂 > Statins",
    "mechanism": "抑制HMG-CoA reductase，增加肝臟LDL receptor",
    "indications": "高脂血症與動脈粥樣硬化風險降低",
    "effects": "降低膽固醇合成、上調LDL受器",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Pravastatin",
    "category": "心臟科 > 降血脂 > Statins",
    "mechanism": "抑制HMG-CoA reductase，增加肝臟LDL receptor",
    "indications": "高脂血症與動脈粥樣硬化風險降低",
    "effects": "降低膽固醇合成、上調LDL受器",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Rosuvastatin",
    "category": "心臟科 > 降血脂 > Statins",
    "mechanism": "抑制HMG-CoA reductase，增加肝臟LDL receptor",
    "indications": "高脂血症與動脈粥樣硬化風險降低",
    "effects": "降低膽固醇合成、上調LDL受器",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Molnupiravir",
    "category": "感染科 > 抗COVID-19 > 核苷類似物",
    "mechanism": "N-hydroxycytidine前驅物，造成病毒RNA錯誤突變",
    "indications": "病毒感染治療或預防",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Interferon-α",
    "category": "感染科 > 抗HBV/HCV > Interferon",
    "mechanism": "活化JAK-STAT抗病毒基因表現",
    "indications": "病毒感染治療或預防",
    "effects": "抑制病毒複製、成熟或進入宿主細胞",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Glecaprevir",
    "category": "感染科 > 抗HCV > NS3/4A protease inhibitor",
    "mechanism": "抑制HCV NS3/4A protease",
    "indications": "病毒感染治療或預防",
    "effects": "抑制病毒複製、成熟或進入宿主細胞",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Grazoprevir",
    "category": "感染科 > 抗HCV > NS3/4A protease inhibitor",
    "mechanism": "抑制HCV NS3/4A protease",
    "indications": "病毒感染治療或預防",
    "effects": "抑制病毒複製、成熟或進入宿主細胞",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Simeprevir",
    "category": "感染科 > 抗HCV > NS3/4A protease inhibitor",
    "mechanism": "抑制HCV NS3/4A protease",
    "indications": "病毒感染治療或預防",
    "effects": "抑制病毒複製、成熟或進入宿主細胞",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Daclatasvir",
    "category": "感染科 > 抗HCV > NS5A inhibitor",
    "mechanism": "抑制HCV NS5A複製複合體",
    "indications": "病毒感染治療或預防",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Ledipasvir",
    "category": "感染科 > 抗HCV > NS5A inhibitor",
    "mechanism": "抑制HCV NS5A複製複合體",
    "indications": "病毒感染治療或預防",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Velpatasvir",
    "category": "感染科 > 抗HCV > NS5A inhibitor",
    "mechanism": "抑制HCV NS5A複製複合體",
    "indications": "病毒感染治療或預防",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Enfuvirtide",
    "category": "感染科 > 抗HIV > Fusion inhibitor",
    "mechanism": "結合gp41，阻止HIV外套膜與細胞膜融合",
    "indications": "病毒感染治療或預防",
    "effects": "依其機轉產生對應藥理作用；請搭配適應症與考點複習；PDF重點：骨髓抑制；→競爭抑制HIV-1 反轉錄",
    "mnemonic": "p.120: (從外到內喔)：馬拉拉(Mara-) 愛浮潛(Efu-)，而且她博學多聞記很多(Zido-)拉密定理 (Lami-)，最後還暴動似的(riot, Ralte-)用力的K自己的陰蒂(Indi-) 🡺 一句話：馬拉愛浮記多 拉特陰蒂",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Delavirdine",
    "category": "感染科 > 抗HIV > NNRTI",
    "mechanism": "非核苷類反轉錄酶變構抑制",
    "indications": "病毒感染治療或預防",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Ceftibuten",
    "category": "感染科 > 抗生素 > Cephalosporin第三代",
    "mechanism": "β-lactam；抑制PBP/細胞壁合成",
    "indications": "細菌感染治療（菌種依藥物光譜）",
    "effects": "抑制細菌細胞壁、蛋白質、核酸或葉酸代謝",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Ceforanide",
    "category": "感染科 > 抗生素 > Cephalosporin第二代",
    "mechanism": "β-lactam；抑制PBP/細胞壁合成",
    "indications": "細菌感染治療（菌種依藥物光譜）",
    "effects": "抑制細菌細胞壁、蛋白質、核酸或葉酸代謝",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Cefprozil",
    "category": "感染科 > 抗生素 > Cephalosporin第二代",
    "mechanism": "β-lactam；抑制PBP/細胞壁合成",
    "indications": "細菌感染治療（菌種依藥物光譜）",
    "effects": "抑制細菌細胞壁、蛋白質、核酸或葉酸代謝",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Pefloxacin",
    "category": "感染科 > 抗生素 > Fluoroquinolones",
    "mechanism": "抑制DNA gyrase與topoisomerase IV",
    "indications": "抗厭氧菌",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Chlortetracycline",
    "category": "感染科 > 抗生素 > Tetracyclines短/中效",
    "mechanism": "結合30S，阻止aminoacyl-tRNA進入A site",
    "indications": "細菌感染治療（菌種依藥物光譜）",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）；PDF重點：機轉：阻斷 tRNA binding",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Colistin",
    "category": "感染科 > 抗生素 > 細胞膜作用",
    "mechanism": "陽離子界面活性劑，破壞Gram-negative外膜/細胞膜",
    "indications": "細菌感染治療（菌種依藥物光譜）",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Polymyxin B",
    "category": "感染科 > 抗生素 > 細胞膜作用",
    "mechanism": "陽離子界面活性劑，破壞Gram-negative外膜/細胞膜",
    "indications": "分解細胞膜之脂蛋白，以破壞細胞膜。治G(-) CRAB、CRE。",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）；PDF重點：抗G(+)抑制BP dephosphorylation(106-1)",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Clofazimine",
    "category": "感染科 > 抗痲瘋",
    "mechanism": "結合分枝桿菌DNA並產生活性氧；抗發炎",
    "indications": "抗痲瘋",
    "effects": "干擾DNA/RNA或細胞分裂，產生細胞毒性",
    "mnemonic": "p.115: That son(Dapsone)治不了痲瘋，call father治(Clofazi-，dapsone替代藥物)",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Diethylcarbamazine",
    "category": "感染科 > 抗蟲 > 絲蟲",
    "mechanism": "改變微絲蟲表面，使其易被宿主免疫清除",
    "indications": "寄生蟲/原蟲感染治療",
    "effects": "依蟲種破壞寄生蟲神經肌肉/微管或代謝，使蟲體麻痺或死亡",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Gamma-hydroxybutyrate",
    "category": "神經/精神科 > 成癮物質/藥物",
    "mechanism": "GABA_B與GHB受器作用，造成中樞抑制",
    "indications": "作用：增加食慾、緩解疼痛、減少噁心、欣快感(107-1)；作用於ion channel",
    "effects": "增強GABA-A抑制性傳導，鎮靜、抗焦慮、抗癲癇",
    "mnemonic": "p.57: γ = Gamma -> Glucose -> 降血糖(TZD藥物)；α = Alpha -> Adipose -> 降血脂",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Phencyclidine",
    "category": "神經/精神科 > 成癮物質/藥物",
    "mechanism": "NMDA受器非競爭性拮抗",
    "indications": "作用：增加食慾、緩解疼痛、減少噁心、欣快感(107-1)；作用於ion channel",
    "effects": "阻斷對應受器或通道，降低該路徑效應",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Quazepam",
    "category": "神經/精神科 > 抗焦慮/鎮靜安眠 > Benzodiazepines",
    "mechanism": "GABA_A受器正向變構調節；增加Cl-通道開啟頻率",
    "indications": "焦慮、失眠、鎮靜、抗癲癇或麻醉誘導（依藥物）",
    "effects": "增強GABA-A抑制性傳導，鎮靜、抗焦慮、抗癲癇",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Methylphenidate",
    "category": "神經/精神科 > 擬交感神經藥物 > 間接型",
    "mechanism": "抑制DA、NE再回收",
    "indications": "ADHD、猝睡症；可降低食慾",
    "effects": "抑制NE/DA回收，增強中樞單胺傳導；白天使用",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Sufentanil",
    "category": "神經/精神科 > 類鴉片止痛劑 > 強效μ致效",
    "mechanism": "μ-opioid受器致效（Gi）：抑制Ca2+內流、促進K+外流",
    "indications": "中重度疼痛、止咳或鴉片戒斷/解毒（依藥物）",
    "effects": "調節鈣離子通道/骨代謝/血管平滑肌收縮",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Beclomethasone",
    "category": "胸腔科 > 抗氣喘 > 吸入型類固醇",
    "mechanism": "活化glucocorticoid receptor，抑制發炎基因轉錄",
    "indications": "氣喘/COPD維持或急性支氣管痙攣緩解",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Mesalamine",
    "category": "腸胃科 > IBD > 5-ASA",
    "mechanism": "釋放5-ASA，抑制COX/NF-κB並減少腸黏膜發炎",
    "indications": "發炎疼痛、氣喘、肺高壓或胃黏膜保護（依藥物）",
    "effects": "降低前列腺素生成，解熱、止痛、抗發炎",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Aluminum hydroxide",
    "category": "腸胃科 > 消化性潰瘍 > 制酸劑",
    "mechanism": "弱鹼中和胃酸；鋁鹽可止瀉/吸附",
    "indications": "GERD、消化性潰瘍、胃酸過多或H. pylori輔助治療",
    "effects": "調節鈣離子通道/骨代謝/血管平滑肌收縮",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Calcium carbonate",
    "category": "腸胃科 > 消化性潰瘍 > 制酸劑",
    "mechanism": "弱鹼中和胃酸並補充鈣",
    "indications": "GERD、消化性潰瘍、胃酸過多或H. pylori輔助治療",
    "effects": "調節鈣離子通道/骨代謝/血管平滑肌收縮",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Mitoxantrone",
    "category": "血液腫瘤科 > 抗癌 > Anthracenedione",
    "mechanism": "抑制topoisomerase II並嵌入DNA",
    "indications": "高血壓；部分用於心衰竭、腎保護或心絞痛",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Ferrous sulfate",
    "category": "血液腫瘤科 > 抗貧血 > 鐵劑",
    "mechanism": "補充鐵以促進heme/hemoglobin合成",
    "indications": "特定癌症或腫瘤標靶治療",
    "effects": "促進神經傳遞物質或內分泌/代謝反應",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Dabrafenib",
    "category": "風濕免疫/腫瘤 > 標靶治療 > BRAF抑制",
    "mechanism": "抑制突變BRAF kinase",
    "indications": "特定癌症或腫瘤標靶治療",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Alefacept",
    "category": "風濕免疫科 > 免疫抑制 > LFA-3融合蛋白",
    "mechanism": "LFA-3-Ig與CD2結合，抑制/耗竭T細胞",
    "indications": "自體免疫疾病、器官移植排斥或發炎疾病",
    "effects": "調節多巴胺傳導，影響精神症狀、EPS、泌乳或帕金森症狀",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Pomalidomide",
    "category": "風濕免疫科 > 免疫調節 > TNF抑制",
    "mechanism": "免疫調節藥；降低TNF-α並調節T/NK細胞",
    "indications": "刺激T cell(促進細胞免疫)；抗發炎強；*原用於孕婦害喜,但會造成畸胎後禁止使用；治RA、AS、",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號；PDF重點：刺激T cell(促進細胞免疫)；抗發炎強",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "D",
    "drawWeight": 2
  },
  {
    "name": "Orlistat",
    "category": "內分泌/新陳代謝 > 減肥藥",
    "mechanism": "抑制pancreatic/gastric lipase，降低脂肪吸收",
    "indications": "肥胖症輔助治療",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號；PDF重點：抑制脂肪分解，國內合法；減少食慾",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "E",
    "drawWeight": 1
  },
  {
    "name": "Malathion",
    "category": "毒物學 > 有機磷/殺蟲劑",
    "mechanism": "有機磷類不可逆抑制AChE",
    "indications": "重症肌無力、青光眼、阿茲海默症或解抗膽鹼毒性（依藥物）",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "E",
    "drawWeight": 1
  },
  {
    "name": "Parathion",
    "category": "毒物學 > 有機磷/殺蟲劑",
    "mechanism": "有機磷類不可逆抑制AChE",
    "indications": "重症肌無力、青光眼、阿茲海默症或解抗膽鹼毒性（依藥物）",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "E",
    "drawWeight": 1
  },
  {
    "name": "Soman",
    "category": "毒物學 > 有機磷/殺蟲劑",
    "mechanism": "有機磷類不可逆抑制AChE",
    "indications": "重症肌無力、青光眼、阿茲海默症或解抗膽鹼毒性（依藥物）",
    "effects": "抑制該酵素/轉運/合成步驟，降低下游產物或訊號",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "E",
    "drawWeight": 1
  },
  {
    "name": "Phenazopyridine",
    "category": "泌尿科/毒物學 > 泌尿道止痛",
    "mechanism": "泌尿道局部止痛劑，作用於尿路黏膜",
    "indications": "中重度疼痛、止咳或鴉片戒斷/解毒（依藥物）",
    "effects": "依其機轉產生對應藥理作用；請搭配適應症與考點複習",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "E",
    "drawWeight": 1
  },
  {
    "name": "Maprotiline",
    "category": "神經/精神科 > 抗憂鬱 > NRI",
    "mechanism": "選擇性抑制NE再回收",
    "indications": "憂鬱症、焦慮症或神經痛/偏頭痛預防（依藥物）",
    "effects": "調節單胺神經傳導，改善情緒/痛覺或止吐/偏頭痛（依藥物）；PDF重點：抑制NE 回收",
    "mnemonic": "p.26: 阿莫在蝦皮(Amoxapine)甚麼都賣，就是不賣來自北方(不賣North=抑制NE)的麻婆(mapro-)豆腐。\np.26: 麻婆(mapro-)豆腐北方菜(North, 抑制NE回收)，豬肉凍(-zodone)南方菜(South, SARI)",
    "examLevel": "E",
    "drawWeight": 1
  },
  {
    "name": "Phenylpropanolamine",
    "category": "神經/精神科 > 擬交感神經藥物 > 直接/間接混合型",
    "mechanism": "擬交感作用，促進鼻黏膜血管收縮並降低食慾",
    "indications": "治鼻塞；降低食慾→減肥",
    "effects": "促進神經傳遞物質或內分泌/代謝反應；PDF重點：降低食慾→減肥",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "E",
    "drawWeight": 1
  },
  {
    "name": "Ropivacaine",
    "category": "麻醉科 > 局部麻醉 > Amide",
    "mechanism": "由細胞內側阻斷電壓依賴性Na+通道，抑制去極化",
    "indications": "氣喘/COPD、動暈、尿失禁、帕金森/EPS或散瞳（依藥物）",
    "effects": "抑制電位依賴性鈉通道，降低神經或心肌興奮性",
    "mnemonic": "p.45: 不批發(Bupiva-)叫貨久(效長)的肉批發(Ropiva-) 改做利多(Lido-)的棕色皮肉(Prilo-)",
    "examLevel": "E",
    "drawWeight": 1
  },
  {
    "name": "CaNa2EDTA",
    "category": "毒物學 > 螯合劑",
    "mechanism": "螯合鉛等二價/三價金屬",
    "indications": "中毒或重金屬暴露之解毒/螯合治療",
    "effects": "結合毒物/重金屬或繞過毒性路徑以促進排除",
    "mnemonic": "這筆藥物目前沒有對應口訣。",
    "examLevel": "E",
    "drawWeight": 1
  }
];
