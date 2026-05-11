export const moexMed1Requested71QuestionsDetailedPatchV5 = {
  "metadata": {
    "title": "MOEX 醫學（一）指定補題／校正題 71 題詳解補丁 v5",
    "generated_at": "2026-05-11T11:17:06",
    "total_questions": 71,
    "reported_missing_by_user_count": 35,
    "additional_requested_by_user_count": 36,
    "note": "本檔為 upsert patch。請以 upsert_key = exam_code-paper_code-question_no 取代或補入主題庫。舊制 1101 題可能屬微生物、寄生蟲或公衛，故 classification_v5 同時保留 primary_subject_exact 與 five_subject_bucket_if_app_requires。",
    "source_detailed_files": [
      "moex_anatomy_strict_detailed_v3_merged_001_973.json",
      "moex_med1_remaining_detailed_v4_merged_001_1827.json",
      "moex_med1_missing_22_questions_detailed_v5.json"
    ]
  },
  "questions": [
    {
      "id": "moex-med1-supplement-v5-100140-1101-021",
      "upsert_key": "100140-1101-21",
      "source_exam_key": "100140-1101",
      "exam_code": "100140",
      "paper_code": "1101",
      "exam_year_roc": 100,
      "exam_year_gregorian": 2011,
      "exam_session": "第二次",
      "question_no": 21,
      "requested_group": "reported_missing_by_user",
      "action": "upsert_or_replace_by_upsert_key",
      "subject_group": "醫學（一）",
      "stem": "右肺門的肺動脈位在支氣管的：",
      "options": {
        "A": "上方",
        "B": "下方",
        "C": "前方",
        "D": "後方"
      },
      "official_answer_raw": "#",
      "correct_answers": [
        "B",
        "C"
      ],
      "answer_credit_type": "multiple_accepted",
      "answer_note": "第21題答B或C或BC者均給分，",
      "classification_v5": {
        "primary_subject_exact": "解剖學",
        "topic_section": "胸腔",
        "subtopic": "肺門解剖",
        "five_subject_bucket_if_app_requires": "解剖學",
        "original_question_no_used": 21,
        "question_number_default_bucket": "解剖學",
        "classification_method": "original_question_number_rule_checked_by_content",
        "confidence": "high",
        "legacy_non_five_subject": false,
        "original_classification": {
          "primary_subject": "解剖學",
          "body_region": "胸腔",
          "topic_section": "肺與胸膜",
          "anatomy_track": true,
          "classification_confidence": 0.78,
          "subject_confidence": 0.75,
          "region_confidence": 0.82,
          "method": "v2_rule_based_keyword_plus_known_manual_checks",
          "subject_scores": {
            "微生物免疫學/寄生蟲學": 0,
            "公共衛生學": 0,
            "生物化學": 0,
            "生理學": 0,
            "胚胎及發育生物學": 0,
            "組織學": 0,
            "解剖學": 2
          },
          "manual_note": ""
        },
        "notes": "已依題號與內容確認歸類。"
      },
      "explanation": "右肺門中，支氣管與肺動脈的上下/前後關係有不同描述角度；常用RALS口訣為右肺動脈在支氣管前方、左肺動脈在支氣管上方。官方本題接受多個答案，應以官方correct_answers為準。 這題要抓的重點是：肺門RALS：Right pulmonary artery Anterior, Left pulmonary artery Superior。",
      "option_analysis": {
        "A": "不選。上方 與題幹要求的解剖位置、支配或功能不符。",
        "B": "正確。右肺門中，支氣管與肺動脈的上下/前後關係有不同描述角度；常用RALS口訣為右肺動脈在支氣管前方、左肺動脈在支氣管上方。官方本題接受多個答案，應以官方correct_answers為準。",
        "C": "正確。右肺門中，支氣管與肺動脈的上下/前後關係有不同描述角度；常用RALS口訣為右肺動脈在支氣管前方、左肺動脈在支氣管上方。官方本題接受多個答案，應以官方correct_answers為準。",
        "D": "不選。後方 與題幹要求的解剖位置、支配或功能不符。"
      },
      "exam_point": "肺門RALS：Right pulmonary artery Anterior, Left pulmonary artery Superior。",
      "memory_tip": "先定位構造，再判斷其功能、走行、支配或鄰近關係。",
      "clinical_link": "",
      "review_flags": [
        "official_modified_or_multiple_credit",
        "requested_supplement_patch",
        "reported_missing_by_user",
        "reported_missing_in_user_integrity_check",
        "official_answer_correction_or_multiple_credit"
      ],
      "source_files": {
        "extracted_from_detailed_file": "moex_anatomy_strict_detailed_v3_merged_001_973.json",
        "source_question_pdf": "100140_1101.pdf",
        "source_answer_pdf": "100140_MOD1101.pdf"
      }
    },
    {
      "id": "moex-med1-supplement-v5-100140-1101-051",
      "upsert_key": "100140-1101-51",
      "source_exam_key": "100140-1101",
      "exam_code": "100140",
      "paper_code": "1101",
      "exam_year_roc": 100,
      "exam_year_gregorian": 2011,
      "exam_session": "第二次",
      "question_no": 51,
      "requested_group": "additional_requested_by_user",
      "action": "upsert_or_replace_by_upsert_key",
      "subject_group": "醫學（一）",
      "stem": "一位男性因其陰莖出現潰瘍而就醫，經醫師診察後發現其潰瘍處界限分明，表面呈肉紅色糜爛，觸 摸時可感覺皮下似埋有一鈕扣，是為硬性下疳的症狀，且患者無壓痛感，但壓時有清澈之滲出液溢 出，經 VDRL 試驗呈陽性反應，表示該病人可能患有何種疾病？",
      "options": {
        "A": "梅毒（syphilis）",
        "B": "疹（herpes）",
        "C": "淋病（gonorrhea）",
        "D": "生殖器濕疣（anogenital warts）"
      },
      "official_answer_raw": "A",
      "correct_answers": [
        "A"
      ],
      "answer_credit_type": "standard",
      "answer_note": "",
      "classification_v5": {
        "primary_subject_exact": "微生物學",
        "topic_section": "性傳染病",
        "subtopic": "梅毒",
        "five_subject_bucket_if_app_requires": null,
        "original_question_no_used": 51,
        "question_number_default_bucket": "生理學",
        "classification_method": "content_override",
        "confidence": "high",
        "legacy_non_five_subject": true,
        "original_classification": {
          "primary_subject": "未分類",
          "topic_section": "綜合題",
          "track": "med1_remaining_detailed",
          "classification_confidence": "medium"
        },
        "notes": "舊制醫學（一）含微生物、寄生蟲、公衛等；此題保留精準主科，不硬塞入五大科。"
      },
      "explanation": "無痛性硬性下疳、清澈滲出液及VDRL陽性是一期梅毒的典型線索。",
      "option_analysis": {
        "A": "正確。梅毒（syphilis） 符合本題關鍵線索。無痛性硬性下疳、清澈滲出液及VDRL陽性是一期梅毒的典型線索。",
        "B": "不選。疱疹（herpes） 與題幹關鍵線索不符，或不是此疾病／機轉／概念最典型的答案。",
        "C": "不選。淋病（gonorrhea） 與題幹關鍵線索不符，或不是此疾病／機轉／概念最典型的答案。",
        "D": "不選。生殖器濕疣（anogenital warts） 與題幹關鍵線索不符，或不是此疾病／機轉／概念最典型的答案。"
      },
      "exam_point": "一期梅毒臨床表現。",
      "memory_tip": "梅毒硬下疳：硬、無痛、VDRL。",
      "clinical_link": "",
      "review_flags": [
        "requested_supplement_patch",
        "additional_requested_by_user",
        "legacy_non_five_subject",
        "additional_question_requested_by_user",
        "official_answer_correction_or_multiple_credit"
      ],
      "source_files": {
        "extracted_from_detailed_file": "moex_med1_remaining_detailed_v4_merged_001_1827.json",
        "source_question_pdf": "100140_1101.pdf",
        "source_answer_pdf": "100140_MOD1101.pdf"
      }
    },
    {
      "id": "moex-med1-supplement-v5-100140-1101-054",
      "upsert_key": "100140-1101-54",
      "source_exam_key": "100140-1101",
      "exam_code": "100140",
      "paper_code": "1101",
      "exam_year_roc": 100,
      "exam_year_gregorian": 2011,
      "exam_session": "第二次",
      "question_no": 54,
      "requested_group": "additional_requested_by_user",
      "action": "upsert_or_replace_by_upsert_key",
      "subject_group": "醫學（一）",
      "stem": "承上題，下列何者不宜用來處理破傷風病人？",
      "options": {
        "A": "給予破傷風抗毒素",
        "B": "擴創術（debridement）",
        "C": "給予青黴素（penicillin）",
        "D": "給予破傷風疫苗"
      },
      "official_answer_raw": "C",
      "correct_answers": [
        "C"
      ],
      "answer_credit_type": "standard",
      "answer_note": "",
      "classification_v5": {
        "primary_subject_exact": "微生物學",
        "topic_section": "細菌毒素/破傷風",
        "subtopic": "tetanus management",
        "five_subject_bucket_if_app_requires": null,
        "original_question_no_used": 54,
        "question_number_default_bucket": "生理學",
        "classification_method": "content_override",
        "confidence": "high",
        "legacy_non_five_subject": true,
        "original_classification": {
          "primary_subject": "未分類",
          "topic_section": "綜合題",
          "track": "med1_remaining_detailed",
          "classification_confidence": "medium"
        },
        "notes": "舊制醫學（一）含微生物、寄生蟲、公衛等；此題保留精準主科，不硬塞入五大科。"
      },
      "explanation": "破傷風處置重點為清創、抗毒素、支持療法與疫苗補種；抗生素可輔助但題幹問「不宜」時依官方答案處理並保留背景。",
      "option_analysis": {
        "A": "不選。給予破傷風抗毒素 與題幹關鍵線索不符，或不是此疾病／機轉／概念最典型的答案。",
        "B": "不選。擴創術（debridement） 與題幹關鍵線索不符，或不是此疾病／機轉／概念最典型的答案。",
        "C": "正確。給予青黴素（penicillin） 符合本題關鍵線索。破傷風處置重點為清創、抗毒素、支持療法與疫苗補種；抗生素可輔助但題幹問「不宜」時依官方答案處理並保留背景。",
        "D": "不選。給予破傷風疫苗 與題幹關鍵線索不符，或不是此疾病／機轉／概念最典型的答案。"
      },
      "exam_point": "破傷風處置原則。",
      "memory_tip": "Tetanus：清創、抗毒素、疫苗。",
      "clinical_link": "",
      "review_flags": [
        "requested_supplement_patch",
        "additional_requested_by_user",
        "legacy_non_five_subject",
        "additional_question_requested_by_user",
        "official_answer_correction_or_multiple_credit"
      ],
      "source_files": {
        "extracted_from_detailed_file": "moex_med1_remaining_detailed_v4_merged_001_1827.json",
        "source_question_pdf": "100140_1101.pdf",
        "source_answer_pdf": "100140_MOD1101.pdf"
      }
    },
    {
      "id": "moex-med1-supplement-v5-100140-1101-076",
      "upsert_key": "100140-1101-76",
      "source_exam_key": "100140-1101",
      "exam_code": "100140",
      "paper_code": "1101",
      "exam_year_roc": 100,
      "exam_year_gregorian": 2011,
      "exam_session": "第二次",
      "question_no": 76,
      "requested_group": "additional_requested_by_user",
      "action": "upsert_or_replace_by_upsert_key",
      "subject_group": "醫學（一）",
      "stem": "下列有關隱翅蟲之敘述，何者錯誤？",
      "options": {
        "A": "臺灣地區最常見的是褐毒隱翅蟲（Paederus fusca）",
        "B": "隱翅蟲的毒害是由蟲體螫咬人體所致",
        "C": "隱翅蟲素（pederin）附著皮膚後會產生緩慢痊癒的壞死性紅斑",
        "D": "待病灶痊癒後，若未再接觸隱翅蟲素，一般不用擔心復發的問題"
      },
      "official_answer_raw": "B",
      "correct_answers": [
        "B"
      ],
      "answer_credit_type": "standard",
      "answer_note": "",
      "classification_v5": {
        "primary_subject_exact": "寄生蟲學/醫學昆蟲學",
        "topic_section": "節肢動物",
        "subtopic": "隱翅蟲",
        "five_subject_bucket_if_app_requires": null,
        "original_question_no_used": 76,
        "question_number_default_bucket": "生物化學",
        "classification_method": "content_override",
        "confidence": "high",
        "legacy_non_five_subject": true,
        "original_classification": {
          "primary_subject": "未分類",
          "topic_section": "綜合題",
          "track": "med1_remaining_detailed",
          "classification_confidence": "medium"
        },
        "notes": "舊制醫學（一）含微生物、寄生蟲、公衛等；此題保留精準主科，不硬塞入五大科。"
      },
      "explanation": "隱翅蟲皮膚炎主要是蟲體被壓碎後釋放pederin接觸皮膚造成，並非由螫咬造成。",
      "option_analysis": {
        "A": "不選。臺灣地區最常見的是褐毒隱翅蟲（Paederus fusca） 屬於正確敘述或相關概念，因題目要求找錯誤／例外，所以不是答案。",
        "B": "正確作答。題幹要求找錯誤或例外，隱翅蟲的毒害是由蟲體螫咬人體所致 是不符合正確概念的選項。隱翅蟲皮膚炎主要是蟲體被壓碎後釋放pederin接觸皮膚造成，並非由螫咬造成。",
        "C": "不選。隱翅蟲素（pederin）附著皮膚後會產生緩慢痊癒的壞死性紅斑 屬於正確敘述或相關概念，因題目要求找錯誤／例外，所以不是答案。",
        "D": "不選。待病灶痊癒後，若未再接觸隱翅蟲素，一般不用擔心復發的問題 屬於正確敘述或相關概念，因題目要求找錯誤／例外，所以不是答案。"
      },
      "exam_point": "隱翅蟲皮膚炎機轉。",
      "memory_tip": "隱翅蟲不是咬，是汁液擦到。",
      "clinical_link": "",
      "review_flags": [
        "needs_manual_tag_review",
        "requested_supplement_patch",
        "additional_requested_by_user",
        "legacy_non_five_subject",
        "additional_question_requested_by_user",
        "official_answer_correction_or_multiple_credit"
      ],
      "source_files": {
        "extracted_from_detailed_file": "moex_med1_remaining_detailed_v4_merged_001_1827.json",
        "source_question_pdf": "100140_1101.pdf",
        "source_answer_pdf": "100140_MOD1101.pdf"
      }
    },
    {
      "id": "moex-med1-supplement-v5-100140-1101-081",
      "upsert_key": "100140-1101-81",
      "source_exam_key": "100140-1101",
      "exam_code": "100140",
      "paper_code": "1101",
      "exam_year_roc": 100,
      "exam_year_gregorian": 2011,
      "exam_session": "第二次",
      "question_no": 81,
      "requested_group": "additional_requested_by_user",
      "action": "upsert_or_replace_by_upsert_key",
      "subject_group": "醫學（一）",
      "stem": "下列何種阿米巴原蟲對人體不具致病性？",
      "options": {
        "A": "痢疾阿米巴（Entamoeba histolytica）",
        "B": "棘阿米巴（Acanthamoeba spp.）",
        "C": "迪斯帕阿米巴（Entamoeba dispar）",
        "D": "福氏耐格利阿米巴（Naegleria fowleri）"
      },
      "official_answer_raw": "C",
      "correct_answers": [
        "C"
      ],
      "answer_credit_type": "standard",
      "answer_note": "",
      "classification_v5": {
        "primary_subject_exact": "寄生蟲學",
        "topic_section": "原蟲學",
        "subtopic": "阿米巴",
        "five_subject_bucket_if_app_requires": null,
        "original_question_no_used": 81,
        "question_number_default_bucket": "生物化學",
        "classification_method": "content_override",
        "confidence": "high",
        "legacy_non_five_subject": true,
        "original_classification": {
          "primary_subject": "未分類",
          "topic_section": "綜合題",
          "track": "med1_remaining_detailed",
          "classification_confidence": "medium"
        },
        "notes": "舊制醫學（一）含微生物、寄生蟲、公衛等；此題保留精準主科，不硬塞入五大科。"
      },
      "explanation": "Entamoeba dispar形態類似E. histolytica，但通常不具侵襲致病性。",
      "option_analysis": {
        "A": "不選。痢疾阿米巴（Entamoeba histolytica） 與題幹關鍵線索不符，或不是此疾病／機轉／概念最典型的答案。",
        "B": "不選。棘阿米巴（Acanthamoeba spp.） 與題幹關鍵線索不符，或不是此疾病／機轉／概念最典型的答案。",
        "C": "正確。迪斯帕阿米巴（Entamoeba dispar） 符合本題關鍵線索。Entamoeba dispar形態類似E. histolytica，但通常不具侵襲致病性。",
        "D": "不選。福氏耐格利阿米巴（Naegleria fowleri） 與題幹關鍵線索不符，或不是此疾病／機轉／概念最典型的答案。"
      },
      "exam_point": "非致病性阿米巴鑑別。",
      "memory_tip": "dispar不是dysentery。",
      "clinical_link": "",
      "review_flags": [
        "needs_manual_tag_review",
        "requested_supplement_patch",
        "additional_requested_by_user",
        "legacy_non_five_subject",
        "additional_question_requested_by_user",
        "official_answer_correction_or_multiple_credit"
      ],
      "source_files": {
        "extracted_from_detailed_file": "moex_med1_remaining_detailed_v4_merged_001_1827.json",
        "source_question_pdf": "100140_1101.pdf",
        "source_answer_pdf": "100140_MOD1101.pdf"
      }
    },
    {
      "id": "moex-med1-supplement-v5-100140-1101-084",
      "upsert_key": "100140-1101-84",
      "source_exam_key": "100140-1101",
      "exam_code": "100140",
      "paper_code": "1101",
      "exam_year_roc": 100,
      "exam_year_gregorian": 2011,
      "exam_session": "第二次",
      "question_no": 84,
      "requested_group": "additional_requested_by_user",
      "action": "upsert_or_replace_by_upsert_key",
      "subject_group": "醫學（一）",
      "stem": "下列何者是醫學過度專科化最可能產生之現象？",
      "options": {
        "A": "專科醫師的培訓過程自然而然會考量病人的所有問題",
        "B": "病人與專科醫師間的溝通會更順暢無礙",
        "C": "大型教學醫院的專科醫師常須從事一般性門診服務",
        "D": "診所的開業醫師必須提供尖端醫療科技服務"
      },
      "official_answer_raw": "C",
      "correct_answers": [
        "C"
      ],
      "answer_credit_type": "standard",
      "answer_note": "",
      "classification_v5": {
        "primary_subject_exact": "公共衛生學/醫療社會學",
        "topic_section": "醫療體系",
        "subtopic": "過度專科化",
        "five_subject_bucket_if_app_requires": null,
        "original_question_no_used": 84,
        "question_number_default_bucket": "生物化學",
        "classification_method": "content_override",
        "confidence": "high",
        "legacy_non_five_subject": true,
        "original_classification": {
          "primary_subject": "未分類",
          "topic_section": "綜合題",
          "track": "med1_remaining_detailed",
          "classification_confidence": "medium"
        },
        "notes": "舊制醫學（一）含微生物、寄生蟲、公衛等；此題保留精準主科，不硬塞入五大科。"
      },
      "explanation": "本題重點在辨認題幹線索與最符合的病原、構造、免疫機轉或公衛概念。",
      "option_analysis": {
        "A": "不選。專科醫師的培訓過程自然而然會考量病人的所有問題 與題幹關鍵線索不符，或不是此疾病／機轉／概念最典型的答案。",
        "B": "不選。病人與專科醫師間的溝通會更順暢無礙 與題幹關鍵線索不符，或不是此疾病／機轉／概念最典型的答案。",
        "C": "正確。大型教學醫院的專科醫師常須從事一般性門診服務 符合本題關鍵線索。本題重點在辨認題幹線索與最符合的病原、構造、免疫機轉或公衛概念。",
        "D": "不選。診所的開業醫師必須提供尖端醫療科技服務 與題幹關鍵線索不符，或不是此疾病／機轉／概念最典型的答案。"
      },
      "exam_point": "依題幹關鍵字選出最符合的概念。",
      "memory_tip": "先抓關鍵字，再排除不符合的選項。",
      "clinical_link": "",
      "review_flags": [
        "needs_manual_tag_review",
        "requested_supplement_patch",
        "additional_requested_by_user",
        "legacy_non_five_subject",
        "additional_question_requested_by_user",
        "official_answer_correction_or_multiple_credit"
      ],
      "source_files": {
        "extracted_from_detailed_file": "moex_med1_remaining_detailed_v4_merged_001_1827.json",
        "source_question_pdf": "100140_1101.pdf",
        "source_answer_pdf": "100140_MOD1101.pdf"
      }
    },
    {
      "id": "moex-med1-supplement-v5-100140-1101-086",
      "upsert_key": "100140-1101-86",
      "source_exam_key": "100140-1101",
      "exam_code": "100140",
      "paper_code": "1101",
      "exam_year_roc": 100,
      "exam_year_gregorian": 2011,
      "exam_session": "第二次",
      "question_no": 86,
      "requested_group": "additional_requested_by_user",
      "action": "upsert_or_replace_by_upsert_key",
      "subject_group": "醫學（一）",
      "stem": "下列那一項是最能證明愛滋病預防教育執行成功的指標？",
      "options": {
        "A": "民眾從事安全性行為（使用保險套）的比率提高",
        "B": "愛滋病患的病情在臨床上獲得有效控制",
        "C": "醫院發出愛滋病預防教育單張的數量增加",
        "D": "參加愛滋病衛生教育活動的人數增多"
      },
      "official_answer_raw": "A",
      "correct_answers": [
        "A"
      ],
      "answer_credit_type": "standard",
      "answer_note": "",
      "classification_v5": {
        "primary_subject_exact": "公共衛生學/健康教育",
        "topic_section": "AIDS prevention",
        "subtopic": "介入成效指標",
        "five_subject_bucket_if_app_requires": null,
        "original_question_no_used": 86,
        "question_number_default_bucket": "生物化學",
        "classification_method": "content_override",
        "confidence": "high",
        "legacy_non_five_subject": true,
        "original_classification": {
          "primary_subject": "未分類",
          "topic_section": "綜合題",
          "track": "med1_remaining_detailed",
          "classification_confidence": "medium"
        },
        "notes": "舊制醫學（一）含微生物、寄生蟲、公衛等；此題保留精準主科，不硬塞入五大科。"
      },
      "explanation": "預防教育成功最應看行為結果，如安全性行為比例提高；發單張或參加人數只是過程指標。",
      "option_analysis": {
        "A": "正確。民眾從事安全性行為（使用保險套）的比率提高 符合本題關鍵線索。預防教育成功最應看行為結果，如安全性行為比例提高；發單張或參加人數只是過程指標。",
        "B": "不選。愛滋病患的病情在臨床上獲得有效控制 與題幹關鍵線索不符，或不是此疾病／機轉／概念最典型的答案。",
        "C": "不選。醫院發出愛滋病預防教育單張的數量增加 與題幹關鍵線索不符，或不是此疾病／機轉／概念最典型的答案。",
        "D": "不選。參加愛滋病衛生教育活動的人數增多 與題幹關鍵線索不符，或不是此疾病／機轉／概念最典型的答案。"
      },
      "exam_point": "衛生教育成效評估。",
      "memory_tip": "成功看行為，不只看活動量。",
      "clinical_link": "",
      "review_flags": [
        "needs_manual_tag_review",
        "requested_supplement_patch",
        "additional_requested_by_user",
        "legacy_non_five_subject",
        "additional_question_requested_by_user",
        "official_answer_correction_or_multiple_credit"
      ],
      "source_files": {
        "extracted_from_detailed_file": "moex_med1_remaining_detailed_v4_merged_001_1827.json",
        "source_question_pdf": "100140_1101.pdf",
        "source_answer_pdf": "100140_MOD1101.pdf"
      }
    },
    {
      "id": "moex-med1-supplement-v5-100140-1101-091",
      "upsert_key": "100140-1101-91",
      "source_exam_key": "100140-1101",
      "exam_code": "100140",
      "paper_code": "1101",
      "exam_year_roc": 100,
      "exam_year_gregorian": 2011,
      "exam_session": "第二次",
      "question_no": 91,
      "requested_group": "additional_requested_by_user",
      "action": "upsert_or_replace_by_upsert_key",
      "subject_group": "醫學（一）",
      "stem": "下列何者屬於正向心理健康的表現？",
      "options": {
        "A": "尊重接納他人",
        "B": "忽視身體傷病",
        "C": "壓抑負面情緒",
        "D": "刻板社會角色"
      },
      "official_answer_raw": "A",
      "correct_answers": [
        "A"
      ],
      "answer_credit_type": "standard",
      "answer_note": "",
      "classification_v5": {
        "primary_subject_exact": "公共衛生學/心理衛生",
        "topic_section": "正向心理健康",
        "subtopic": "心理健康",
        "five_subject_bucket_if_app_requires": null,
        "original_question_no_used": 91,
        "question_number_default_bucket": "生物化學",
        "classification_method": "content_override",
        "confidence": "high",
        "legacy_non_five_subject": true,
        "original_classification": {
          "primary_subject": "未分類",
          "topic_section": "綜合題",
          "track": "med1_remaining_detailed",
          "classification_confidence": "medium"
        },
        "notes": "舊制醫學（一）含微生物、寄生蟲、公衛等；此題保留精準主科，不硬塞入五大科。"
      },
      "explanation": "本題重點在辨認題幹線索與最符合的病原、構造、免疫機轉或公衛概念。",
      "option_analysis": {
        "A": "正確。尊重接納他人 符合本題關鍵線索。本題重點在辨認題幹線索與最符合的病原、構造、免疫機轉或公衛概念。",
        "B": "不選。忽視身體傷病 與題幹關鍵線索不符，或不是此疾病／機轉／概念最典型的答案。",
        "C": "不選。壓抑負面情緒 與題幹關鍵線索不符，或不是此疾病／機轉／概念最典型的答案。",
        "D": "不選。刻板社會角色 與題幹關鍵線索不符，或不是此疾病／機轉／概念最典型的答案。"
      },
      "exam_point": "依題幹關鍵字選出最符合的概念。",
      "memory_tip": "先抓關鍵字，再排除不符合的選項。",
      "clinical_link": "",
      "review_flags": [
        "needs_manual_tag_review",
        "requested_supplement_patch",
        "additional_requested_by_user",
        "legacy_non_five_subject",
        "additional_question_requested_by_user",
        "official_answer_correction_or_multiple_credit"
      ],
      "source_files": {
        "extracted_from_detailed_file": "moex_med1_remaining_detailed_v4_merged_001_1827.json",
        "source_question_pdf": "100140_1101.pdf",
        "source_answer_pdf": "100140_MOD1101.pdf"
      }
    },
    {
      "id": "moex-med1-supplement-v5-100140-1101-094",
      "upsert_key": "100140-1101-94",
      "source_exam_key": "100140-1101",
      "exam_code": "100140",
      "paper_code": "1101",
      "exam_year_roc": 100,
      "exam_year_gregorian": 2011,
      "exam_session": "第二次",
      "question_no": 94,
      "requested_group": "additional_requested_by_user",
      "action": "upsert_or_replace_by_upsert_key",
      "subject_group": "醫學（一）",
      "stem": "假設 10 年前 25%的心肌梗塞病人在發病 24 小時內死亡，這個比例稱為個案致死率（case fatality）， 有位研究者想了解 10 年來心肌梗塞病人的個案致死率是否有顯著的改變，在他收集的 15 位新的心 肌梗塞病人，5 位 24 小時內死亡，此研究者應該使用何種統計方法來回答他的研究問題？",
      "options": {
        "A": "單一樣本 z 檢定",
        "B": "單一樣本 t 檢定",
        "C": "單一樣本二項比例檢定",
        "D": "兩個樣本二項比例檢定"
      },
      "official_answer_raw": "C",
      "correct_answers": [
        "C"
      ],
      "answer_credit_type": "standard",
      "answer_note": "",
      "classification_v5": {
        "primary_subject_exact": "公共衛生學/生物統計",
        "topic_section": "比例檢定",
        "subtopic": "case fatality",
        "five_subject_bucket_if_app_requires": null,
        "original_question_no_used": 94,
        "question_number_default_bucket": "生物化學",
        "classification_method": "content_override",
        "confidence": "high",
        "legacy_non_five_subject": true,
        "original_classification": {
          "primary_subject": "未分類",
          "topic_section": "綜合題",
          "track": "med1_remaining_detailed",
          "classification_confidence": "medium"
        },
        "notes": "舊制醫學（一）含微生物、寄生蟲、公衛等；此題保留精準主科，不硬塞入五大科。"
      },
      "explanation": "研究單一族群比例是否不同於既定比例（25%）時，應使用單一樣本二項比例檢定。",
      "option_analysis": {
        "A": "不選。單一樣本 z 檢定 與題幹關鍵線索不符，或不是此疾病／機轉／概念最典型的答案。",
        "B": "不選。單一樣本 t 檢定 與題幹關鍵線索不符，或不是此疾病／機轉／概念最典型的答案。",
        "C": "正確。單一樣本二項比例檢定 符合本題關鍵線索。研究單一族群比例是否不同於既定比例（25%）時，應使用單一樣本二項比例檢定。",
        "D": "不選。兩個樣本二項比例檢定 與題幹關鍵線索不符，或不是此疾病／機轉／概念最典型的答案。"
      },
      "exam_point": "比例資料的統計檢定選擇。",
      "memory_tip": "一組比例比固定值：one-sample proportion test。",
      "clinical_link": "",
      "review_flags": [
        "requested_supplement_patch",
        "additional_requested_by_user",
        "legacy_non_five_subject",
        "additional_question_requested_by_user",
        "official_answer_correction_or_multiple_credit"
      ],
      "source_files": {
        "extracted_from_detailed_file": "moex_med1_remaining_detailed_v4_merged_001_1827.json",
        "source_question_pdf": "100140_1101.pdf",
        "source_answer_pdf": "100140_MOD1101.pdf"
      }
    },
    {
      "id": "moex-med1-supplement-v5-100140-1101-099",
      "upsert_key": "100140-1101-99",
      "source_exam_key": "100140-1101",
      "exam_code": "100140",
      "paper_code": "1101",
      "exam_year_roc": 100,
      "exam_year_gregorian": 2011,
      "exam_session": "第二次",
      "question_no": 99,
      "requested_group": "additional_requested_by_user",
      "action": "upsert_or_replace_by_upsert_key",
      "subject_group": "醫學（一）",
      "stem": "若某工廠外洩毒性物質引起呼吸道傷害個案數呈現陡升陡降，此現象較符合何種流行曲線？",
      "options": {
        "A": "混合流行（mixed epidemic）",
        "B": "連鎖流行（propagated epidemic）",
        "C": "共同病源流行（common source epidemic）",
        "D": "週期循環流行（cyclic epidemic）"
      },
      "official_answer_raw": "C",
      "correct_answers": [
        "C"
      ],
      "answer_credit_type": "standard",
      "answer_note": "",
      "classification_v5": {
        "primary_subject_exact": "公共衛生學/流行病學",
        "topic_section": "流行曲線",
        "subtopic": "common source outbreak",
        "five_subject_bucket_if_app_requires": null,
        "original_question_no_used": 99,
        "question_number_default_bucket": "生物化學",
        "classification_method": "content_override",
        "confidence": "high",
        "legacy_non_five_subject": true,
        "original_classification": {
          "primary_subject": "未分類",
          "topic_section": "綜合題",
          "track": "med1_remaining_detailed",
          "classification_confidence": "medium"
        },
        "notes": "舊制醫學（一）含微生物、寄生蟲、公衛等；此題保留精準主科，不硬塞入五大科。"
      },
      "explanation": "病例數短時間內陡升陡降，符合共同病源暴露；連鎖流行則通常呈多波逐漸傳播。",
      "option_analysis": {
        "A": "不選。混合流行（mixed epidemic） 與題幹關鍵線索不符，或不是此疾病／機轉／概念最典型的答案。",
        "B": "不選。連鎖流行（propagated epidemic） 與題幹關鍵線索不符，或不是此疾病／機轉／概念最典型的答案。",
        "C": "正確。共同病源流行（common source epidemic） 符合本題關鍵線索。病例數短時間內陡升陡降，符合共同病源暴露；連鎖流行則通常呈多波逐漸傳播。",
        "D": "不選。週期循環流行（cyclic epidemic） 與題幹關鍵線索不符，或不是此疾病／機轉／概念最典型的答案。"
      },
      "exam_point": "流行曲線判讀。",
      "memory_tip": "共同病源：一波尖峰。",
      "clinical_link": "",
      "review_flags": [
        "needs_manual_tag_review",
        "requested_supplement_patch",
        "additional_requested_by_user",
        "legacy_non_five_subject",
        "additional_question_requested_by_user",
        "official_answer_correction_or_multiple_credit"
      ],
      "source_files": {
        "extracted_from_detailed_file": "moex_med1_remaining_detailed_v4_merged_001_1827.json",
        "source_question_pdf": "100140_1101.pdf",
        "source_answer_pdf": "100140_MOD1101.pdf"
      }
    },
    {
      "id": "moex-med1-supplement-v5-101030-1101-043",
      "upsert_key": "101030-1101-43",
      "source_exam_key": "101030-1101",
      "exam_code": "101030",
      "paper_code": "1101",
      "exam_year_roc": 101,
      "exam_year_gregorian": 2012,
      "exam_session": "第一次",
      "question_no": 43,
      "requested_group": "additional_requested_by_user",
      "action": "upsert_or_replace_by_upsert_key",
      "subject_group": "醫學（一）",
      "stem": "臨床上患者呈現「Strawberry tongne」之特徵很可能是感染下列何種疾病？",
      "options": {
        "A": "Scarlet fever",
        "B": "Streptococcal toxin shock syndrome",
        "C": "Staphylococcal toxin shock syndrome",
        "D": "Rheumatic fever"
      },
      "official_answer_raw": "#",
      "correct_answers": [
        "A",
        "B",
        "C",
        "D"
      ],
      "answer_credit_type": "all_credit",
      "answer_note": "第43題 一律給分，",
      "classification_v5": {
        "primary_subject_exact": "微生物學",
        "topic_section": "細菌學",
        "subtopic": "草莓舌",
        "five_subject_bucket_if_app_requires": null,
        "original_question_no_used": 43,
        "question_number_default_bucket": "組織學",
        "classification_method": "content_override",
        "confidence": "high",
        "legacy_non_five_subject": true,
        "original_classification": {
          "primary_subject": "未分類",
          "topic_section": "綜合題",
          "track": "med1_remaining_detailed",
          "classification_confidence": "medium"
        },
        "notes": "舊制醫學（一）含微生物、寄生蟲、公衛等；此題保留精準主科，不硬塞入五大科。"
      },
      "explanation": "官方答案更正為一律給分。原題核心可整理為：草莓舌可見於猩紅熱與毒性休克等；本題官方一律給分，應保留疑義標記。",
      "option_analysis": {
        "A": "官方更正為一律給分。Scarlet fever 需依題目脈絡判斷，但本題不建議作為單一正解背誦。",
        "B": "官方更正為一律給分。Streptococcal toxin shock syndrome 需依題目脈絡判斷，但本題不建議作為單一正解背誦。",
        "C": "官方更正為一律給分。Staphylococcal toxin shock syndrome 需依題目脈絡判斷，但本題不建議作為單一正解背誦。",
        "D": "官方更正為一律給分。Rheumatic fever 需依題目脈絡判斷，但本題不建議作為單一正解背誦。"
      },
      "exam_point": "草莓舌鑑別與官方疑義。",
      "memory_tip": "草莓舌不只一種病。",
      "clinical_link": "",
      "review_flags": [
        "needs_human_review",
        "official_all_credit",
        "official_modified_or_multiple_credit",
        "requested_supplement_patch",
        "additional_requested_by_user",
        "legacy_non_five_subject",
        "additional_question_requested_by_user",
        "official_answer_correction_or_multiple_credit"
      ],
      "source_files": {
        "extracted_from_detailed_file": "moex_med1_remaining_detailed_v4_merged_001_1827.json",
        "source_question_pdf": "101030_1101.pdf",
        "source_answer_pdf": "101030_MOD1101.pdf"
      }
    },
    {
      "id": "moex-med1-supplement-v5-101030-1101-046",
      "upsert_key": "101030-1101-46",
      "source_exam_key": "101030-1101",
      "exam_code": "101030",
      "paper_code": "1101",
      "exam_year_roc": 101,
      "exam_year_gregorian": 2012,
      "exam_session": "第一次",
      "question_no": 46,
      "requested_group": "additional_requested_by_user",
      "action": "upsert_or_replace_by_upsert_key",
      "subject_group": "醫學（一）",
      "stem": "下列關於 Bacillus anthracis 感染的敘述，何者錯誤？",
      "options": {
        "A": "經由皮膚感染是人類最罕見的傳染方式",
        "B": "在草食性動物最常見的感染途徑是食入孢子",
        "C": "吸入性傳染是在畜牧業從業人員常見的感染途徑",
        "D": "生化武器攻擊最常用的是吸入性的感染途徑"
      },
      "official_answer_raw": "A",
      "correct_answers": [
        "A"
      ],
      "answer_credit_type": "standard",
      "answer_note": "",
      "classification_v5": {
        "primary_subject_exact": "微生物學",
        "topic_section": "細菌學",
        "subtopic": "Bacillus anthracis",
        "five_subject_bucket_if_app_requires": null,
        "original_question_no_used": 46,
        "question_number_default_bucket": "組織學",
        "classification_method": "content_override",
        "confidence": "high",
        "legacy_non_five_subject": true,
        "original_classification": {
          "primary_subject": "未分類",
          "topic_section": "綜合題",
          "track": "med1_remaining_detailed",
          "classification_confidence": "medium"
        },
        "notes": "舊制醫學（一）含微生物、寄生蟲、公衛等；此題保留精準主科，不硬塞入五大科。"
      },
      "explanation": "炭疽在人類最常見是皮膚感染，並非最罕見；吸入性炭疽可見於畜牧相關暴露或生物武器。",
      "option_analysis": {
        "A": "正確作答。題幹要求找錯誤或例外，經由皮膚感染是人類最罕見的傳染方式 是不符合正確概念的選項。炭疽在人類最常見是皮膚感染，並非最罕見；吸入性炭疽可見於畜牧相關暴露或生物武器。",
        "B": "不選。在草食性動物最常見的感染途徑是食入孢子 屬於正確敘述或相關概念，因題目要求找錯誤／例外，所以不是答案。",
        "C": "不選。吸入性傳染是在畜牧業從業人員常見的感染途徑 屬於正確敘述或相關概念，因題目要求找錯誤／例外，所以不是答案。",
        "D": "不選。生化武器攻擊最常用的是吸入性的感染途徑 屬於正確敘述或相關概念，因題目要求找錯誤／例外，所以不是答案。"
      },
      "exam_point": "炭疽感染途徑。",
      "memory_tip": "Anthrax常見皮膚，恐怖攻擊怕吸入。",
      "clinical_link": "",
      "review_flags": [
        "requested_supplement_patch",
        "additional_requested_by_user",
        "legacy_non_five_subject",
        "additional_question_requested_by_user",
        "official_answer_correction_or_multiple_credit"
      ],
      "source_files": {
        "extracted_from_detailed_file": "moex_med1_remaining_detailed_v4_merged_001_1827.json",
        "source_question_pdf": "101030_1101.pdf",
        "source_answer_pdf": "101030_MOD1101.pdf"
      }
    },
    {
      "id": "moex-med1-supplement-v5-101030-1101-076",
      "upsert_key": "101030-1101-76",
      "source_exam_key": "101030-1101",
      "exam_code": "101030",
      "paper_code": "1101",
      "exam_year_roc": 101,
      "exam_year_gregorian": 2012,
      "exam_session": "第一次",
      "question_no": 76,
      "requested_group": "additional_requested_by_user",
      "action": "upsert_or_replace_by_upsert_key",
      "subject_group": "醫學（一）",
      "stem": "下 列 何 種 人 體 寄 生 蟲 感 染 常 引 起 嗜 伊 紅 性 腦 膜 炎 或 腦 膜 腦 炎 （ eosinophilic meningitis or meningoencephalitis）？",
      "options": {
        "A": "日本血吸蟲（Schistosoma japonicum）",
        "B": "旋毛蟲（Trichinella spiralis）",
        "C": "廣東住血線蟲（Angiostrongylus cantonensis）",
        "D": "有鉤絛蟲（Taenia solium）"
      },
      "official_answer_raw": "C",
      "correct_answers": [
        "C"
      ],
      "answer_credit_type": "standard",
      "answer_note": "",
      "classification_v5": {
        "primary_subject_exact": "寄生蟲學",
        "topic_section": "蠕蟲學",
        "subtopic": "eosinophilic meningitis",
        "five_subject_bucket_if_app_requires": null,
        "original_question_no_used": 76,
        "question_number_default_bucket": "生物化學",
        "classification_method": "content_override",
        "confidence": "high",
        "legacy_non_five_subject": true,
        "original_classification": {
          "primary_subject": "未分類",
          "topic_section": "綜合題",
          "track": "med1_remaining_detailed",
          "classification_confidence": "medium"
        },
        "notes": "舊制醫學（一）含微生物、寄生蟲、公衛等；此題保留精準主科，不硬塞入五大科。"
      },
      "explanation": "廣東住血線蟲是嗜伊紅性腦膜炎的重要病因，常與食入受感染中間或保蚴宿主相關。",
      "option_analysis": {
        "A": "不選。日本血吸蟲（Schistosoma japonicum） 與題幹關鍵線索不符，或不是此疾病／機轉／概念最典型的答案。",
        "B": "不選。旋毛蟲（Trichinella spiralis） 與題幹關鍵線索不符，或不是此疾病／機轉／概念最典型的答案。",
        "C": "正確。廣東住血線蟲（Angiostrongylus cantonensis） 符合本題關鍵線索。廣東住血線蟲是嗜伊紅性腦膜炎的重要病因，常與食入受感染中間或保蚴宿主相關。",
        "D": "不選。有鉤絛蟲（Taenia solium） 與題幹關鍵線索不符，或不是此疾病／機轉／概念最典型的答案。"
      },
      "exam_point": "嗜伊紅性腦膜炎病原。",
      "memory_tip": "嗜伊紅腦膜炎：Angiostrongylus cantonensis。",
      "clinical_link": "",
      "review_flags": [
        "requested_supplement_patch",
        "additional_requested_by_user",
        "legacy_non_five_subject",
        "additional_question_requested_by_user",
        "official_answer_correction_or_multiple_credit"
      ],
      "source_files": {
        "extracted_from_detailed_file": "moex_med1_remaining_detailed_v4_merged_001_1827.json",
        "source_question_pdf": "101030_1101.pdf",
        "source_answer_pdf": "101030_MOD1101.pdf"
      }
    },
    {
      "id": "moex-med1-supplement-v5-101030-1101-079",
      "upsert_key": "101030-1101-79",
      "source_exam_key": "101030-1101",
      "exam_code": "101030",
      "paper_code": "1101",
      "exam_year_roc": 101,
      "exam_year_gregorian": 2012,
      "exam_session": "第一次",
      "question_no": 79,
      "requested_group": "additional_requested_by_user",
      "action": "upsert_or_replace_by_upsert_key",
      "subject_group": "醫學（一）",
      "stem": "下列有關瘧疾的敘述，何者正確？",
      "options": {
        "A": "西非的黑人及其後裔，血型多為 Duffy 陰性，不會感染間日瘧",
        "B": "卵形瘧原蟲的滋養體在血液抹片上之鑑定特徵，是看其是否有帶狀型滋養體（band form trophozoites）",
        "C": "三日瘧原蟲較喜侵入網織紅血球（reticulocytes）中分裂增殖",
        "D": "全球各地的惡性瘧都已出現 chloroquine-resistance"
      },
      "official_answer_raw": "#",
      "correct_answers": [
        "A",
        "B",
        "C",
        "D"
      ],
      "answer_credit_type": "all_credit",
      "answer_note": "第79題一律給分。",
      "classification_v5": {
        "primary_subject_exact": "寄生蟲學",
        "topic_section": "原蟲學",
        "subtopic": "malaria",
        "five_subject_bucket_if_app_requires": null,
        "original_question_no_used": 79,
        "question_number_default_bucket": "生物化學",
        "classification_method": "content_override",
        "confidence": "high",
        "legacy_non_five_subject": true,
        "original_classification": {
          "primary_subject": "未分類",
          "topic_section": "綜合題",
          "track": "med1_remaining_detailed",
          "classification_confidence": "medium"
        },
        "notes": "舊制醫學（一）含微生物、寄生蟲、公衛等；此題保留精準主科，不硬塞入五大科。"
      },
      "explanation": "官方答案更正為一律給分。原題核心可整理為：瘧疾選項涉及多個種別特性，官方一律給分需標記。一般重點：Duffy陰性抵抗P. vivax，P. malariae可見band form，P. vivax/ovale偏好網織紅血球。",
      "option_analysis": {
        "A": "官方更正為一律給分。西非的黑人及其後裔，血型多為 Duffy 陰性，不會感染間日瘧 需依題目脈絡判斷，但本題不建議作為單一正解背誦。",
        "B": "官方更正為一律給分。卵形瘧原蟲的滋養體在血液抹片上之鑑定特徵，是看其是否有帶狀型滋養體（band form trophozoites） 需依題目脈絡判斷，但本題不建議作為單一正解背誦。",
        "C": "官方更正為一律給分。三日瘧原蟲較喜侵入網織紅血球（reticulocytes）中分裂增殖 需依題目脈絡判斷，但本題不建議作為單一正解背誦。",
        "D": "官方更正為一律給分。全球各地的惡性瘧都已出現 chloroquine-resistance 需依題目脈絡判斷，但本題不建議作為單一正解背誦。"
      },
      "exam_point": "瘧原蟲種別鑑別與官方疑義。",
      "memory_tip": "Vivax要Duffy，malariae有band form。",
      "clinical_link": "",
      "review_flags": [
        "needs_human_review",
        "official_all_credit",
        "official_modified_or_multiple_credit",
        "requested_supplement_patch",
        "additional_requested_by_user",
        "legacy_non_five_subject",
        "additional_question_requested_by_user",
        "official_answer_correction_or_multiple_credit"
      ],
      "source_files": {
        "extracted_from_detailed_file": "moex_med1_remaining_detailed_v4_merged_001_1827.json",
        "source_question_pdf": "101030_1101.pdf",
        "source_answer_pdf": "101030_MOD1101.pdf"
      }
    },
    {
      "id": "moex-med1-supplement-v5-101030-1101-082",
      "upsert_key": "101030-1101-82",
      "source_exam_key": "101030-1101",
      "exam_code": "101030",
      "paper_code": "1101",
      "exam_year_roc": 101,
      "exam_year_gregorian": 2012,
      "exam_session": "第一次",
      "question_no": 82,
      "requested_group": "additional_requested_by_user",
      "action": "upsert_or_replace_by_upsert_key",
      "subject_group": "醫學（一）",
      "stem": "下列何者為傳播人畜共通萊姆病（Lyme disease）之病媒？",
      "options": {
        "A": "鹿蜱（Ixodes dammini）",
        "B": "鼠蚤（Xenopsylla cheopis）",
        "C": "體蝨（body louse）",
        "D": "臭蟲（bedbug）"
      },
      "official_answer_raw": "A",
      "correct_answers": [
        "A"
      ],
      "answer_credit_type": "standard",
      "answer_note": "",
      "classification_v5": {
        "primary_subject_exact": "寄生蟲學/醫學昆蟲學",
        "topic_section": "病媒",
        "subtopic": "Lyme disease vector",
        "five_subject_bucket_if_app_requires": null,
        "original_question_no_used": 82,
        "question_number_default_bucket": "生物化學",
        "classification_method": "content_override",
        "confidence": "high",
        "legacy_non_five_subject": true,
        "original_classification": {
          "primary_subject": "未分類",
          "topic_section": "綜合題",
          "track": "med1_remaining_detailed",
          "classification_confidence": "medium"
        },
        "notes": "舊制醫學（一）含微生物、寄生蟲、公衛等；此題保留精準主科，不硬塞入五大科。"
      },
      "explanation": "萊姆病由Borrelia burgdorferi引起，主要媒介為Ixodes硬蜱。",
      "option_analysis": {
        "A": "正確。鹿蜱（Ixodes dammini） 符合本題關鍵線索。萊姆病由Borrelia burgdorferi引起，主要媒介為Ixodes硬蜱。",
        "B": "不選。鼠蚤（Xenopsylla cheopis） 與題幹關鍵線索不符，或不是此疾病／機轉／概念最典型的答案。",
        "C": "不選。體蝨（body louse） 與題幹關鍵線索不符，或不是此疾病／機轉／概念最典型的答案。",
        "D": "不選。臭蟲（bedbug） 與題幹關鍵線索不符，或不是此疾病／機轉／概念最典型的答案。"
      },
      "exam_point": "萊姆病病媒。",
      "memory_tip": "Lyme = Ixodes tick。",
      "clinical_link": "",
      "review_flags": [
        "needs_manual_tag_review",
        "requested_supplement_patch",
        "additional_requested_by_user",
        "legacy_non_five_subject",
        "additional_question_requested_by_user",
        "official_answer_correction_or_multiple_credit"
      ],
      "source_files": {
        "extracted_from_detailed_file": "moex_med1_remaining_detailed_v4_merged_001_1827.json",
        "source_question_pdf": "101030_1101.pdf",
        "source_answer_pdf": "101030_MOD1101.pdf"
      }
    },
    {
      "id": "moex-med1-supplement-v5-101030-1101-084",
      "upsert_key": "101030-1101-84",
      "source_exam_key": "101030-1101",
      "exam_code": "101030",
      "paper_code": "1101",
      "exam_year_roc": 101,
      "exam_year_gregorian": 2012,
      "exam_session": "第一次",
      "question_no": 84,
      "requested_group": "additional_requested_by_user",
      "action": "upsert_or_replace_by_upsert_key",
      "subject_group": "醫學（一）",
      "stem": "有關醫療社會化（medical socialization）之可能結果，請由下列選項中選出最適當的組合關係？①造 成醫療價格高漲 ②非醫療需求者亦需負擔醫療費用 ③易引起醫療供給者之反彈 ④易引起高所 得者之不滿與不安",
      "options": {
        "A": "①②③④",
        "B": "②③④",
        "C": "①②③",
        "D": "①②④"
      },
      "official_answer_raw": "B",
      "correct_answers": [
        "B"
      ],
      "answer_credit_type": "standard",
      "answer_note": "",
      "classification_v5": {
        "primary_subject_exact": "公共衛生學/醫療社會學",
        "topic_section": "醫療社會化",
        "subtopic": "制度影響",
        "five_subject_bucket_if_app_requires": null,
        "original_question_no_used": 84,
        "question_number_default_bucket": "生物化學",
        "classification_method": "content_override",
        "confidence": "high",
        "legacy_non_five_subject": true,
        "original_classification": {
          "primary_subject": "未分類",
          "topic_section": "綜合題",
          "track": "med1_remaining_detailed",
          "classification_confidence": "medium"
        },
        "notes": "舊制醫學（一）含微生物、寄生蟲、公衛等；此題保留精準主科，不硬塞入五大科。"
      },
      "explanation": "本題重點在辨認題幹線索與最符合的病原、構造、免疫機轉或公衛概念。",
      "option_analysis": {
        "A": "不選。①②③④ 與題幹關鍵線索不符，或不是此疾病／機轉／概念最典型的答案。",
        "B": "正確。②③④ 符合本題關鍵線索。本題重點在辨認題幹線索與最符合的病原、構造、免疫機轉或公衛概念。",
        "C": "不選。①②③ 與題幹關鍵線索不符，或不是此疾病／機轉／概念最典型的答案。",
        "D": "不選。①②④ 與題幹關鍵線索不符，或不是此疾病／機轉／概念最典型的答案。"
      },
      "exam_point": "依題幹關鍵字選出最符合的概念。",
      "memory_tip": "先抓關鍵字，再排除不符合的選項。",
      "clinical_link": "",
      "review_flags": [
        "needs_manual_tag_review",
        "requested_supplement_patch",
        "additional_requested_by_user",
        "legacy_non_five_subject",
        "additional_question_requested_by_user",
        "official_answer_correction_or_multiple_credit"
      ],
      "source_files": {
        "extracted_from_detailed_file": "moex_med1_remaining_detailed_v4_merged_001_1827.json",
        "source_question_pdf": "101030_1101.pdf",
        "source_answer_pdf": "101030_MOD1101.pdf"
      }
    },
    {
      "id": "moex-med1-supplement-v5-101030-1101-085",
      "upsert_key": "101030-1101-85",
      "source_exam_key": "101030-1101",
      "exam_code": "101030",
      "paper_code": "1101",
      "exam_year_roc": 101,
      "exam_year_gregorian": 2012,
      "exam_session": "第一次",
      "question_no": 85,
      "requested_group": "additional_requested_by_user",
      "action": "upsert_or_replace_by_upsert_key",
      "subject_group": "醫學（一）",
      "stem": "醫療法規定下列何種醫療機構應提撥年度結餘的百分之二十以上作為營運基金？",
      "options": {
        "A": "公立醫療機構",
        "B": "財團法人醫療機構",
        "C": "社團法人醫療機構",
        "D": "教學醫院"
      },
      "official_answer_raw": "C",
      "correct_answers": [
        "C"
      ],
      "answer_credit_type": "standard",
      "answer_note": "",
      "classification_v5": {
        "primary_subject_exact": "公共衛生學/醫療法規",
        "topic_section": "醫療機構",
        "subtopic": "營運基金",
        "five_subject_bucket_if_app_requires": null,
        "original_question_no_used": 85,
        "question_number_default_bucket": "生物化學",
        "classification_method": "content_override",
        "confidence": "high",
        "legacy_non_five_subject": true,
        "original_classification": {
          "primary_subject": "未分類",
          "topic_section": "綜合題",
          "track": "med1_remaining_detailed",
          "classification_confidence": "medium"
        },
        "notes": "舊制醫學（一）含微生物、寄生蟲、公衛等；此題保留精準主科，不硬塞入五大科。"
      },
      "explanation": "本題重點在辨認題幹線索與最符合的病原、構造、免疫機轉或公衛概念。",
      "option_analysis": {
        "A": "不選。公立醫療機構 與題幹關鍵線索不符，或不是此疾病／機轉／概念最典型的答案。",
        "B": "不選。財團法人醫療機構 與題幹關鍵線索不符，或不是此疾病／機轉／概念最典型的答案。",
        "C": "正確。社團法人醫療機構 符合本題關鍵線索。本題重點在辨認題幹線索與最符合的病原、構造、免疫機轉或公衛概念。",
        "D": "不選。教學醫院 與題幹關鍵線索不符，或不是此疾病／機轉／概念最典型的答案。"
      },
      "exam_point": "依題幹關鍵字選出最符合的概念。",
      "memory_tip": "先抓關鍵字，再排除不符合的選項。",
      "clinical_link": "",
      "review_flags": [
        "needs_manual_tag_review",
        "requested_supplement_patch",
        "additional_requested_by_user",
        "legacy_non_five_subject",
        "additional_question_requested_by_user",
        "official_answer_correction_or_multiple_credit"
      ],
      "source_files": {
        "extracted_from_detailed_file": "moex_med1_remaining_detailed_v4_merged_001_1827.json",
        "source_question_pdf": "101030_1101.pdf",
        "source_answer_pdf": "101030_MOD1101.pdf"
      }
    },
    {
      "id": "moex-med1-supplement-v5-101030-1101-087",
      "upsert_key": "101030-1101-87",
      "source_exam_key": "101030-1101",
      "exam_code": "101030",
      "paper_code": "1101",
      "exam_year_roc": 101,
      "exam_year_gregorian": 2012,
      "exam_session": "第一次",
      "question_no": 87,
      "requested_group": "additional_requested_by_user",
      "action": "upsert_or_replace_by_upsert_key",
      "subject_group": "醫學（一）",
      "stem": "健康的決定因子中，下列那一項最具影響力？",
      "options": {
        "A": "生物遺傳",
        "B": "醫療照護",
        "C": "社經狀況",
        "D": "環境與生活方式"
      },
      "official_answer_raw": "D",
      "correct_answers": [
        "D"
      ],
      "answer_credit_type": "standard",
      "answer_note": "",
      "classification_v5": {
        "primary_subject_exact": "公共衛生學/健康促進",
        "topic_section": "健康決定因子",
        "subtopic": "determinants of health",
        "five_subject_bucket_if_app_requires": null,
        "original_question_no_used": 87,
        "question_number_default_bucket": "生物化學",
        "classification_method": "content_override",
        "confidence": "high",
        "legacy_non_five_subject": true,
        "original_classification": {
          "primary_subject": "未分類",
          "topic_section": "綜合題",
          "track": "med1_remaining_detailed",
          "classification_confidence": "medium"
        },
        "notes": "舊制醫學（一）含微生物、寄生蟲、公衛等；此題保留精準主科，不硬塞入五大科。"
      },
      "explanation": "族群健康受環境、生活方式、社經條件、醫療照護與生物遺傳影響；公共衛生常強調環境與生活方式影響最大。",
      "option_analysis": {
        "A": "不選。生物遺傳 與題幹關鍵線索不符，或不是此疾病／機轉／概念最典型的答案。",
        "B": "不選。醫療照護 與題幹關鍵線索不符，或不是此疾病／機轉／概念最典型的答案。",
        "C": "不選。社經狀況 與題幹關鍵線索不符，或不是此疾病／機轉／概念最典型的答案。",
        "D": "正確。環境與生活方式 符合本題關鍵線索。族群健康受環境、生活方式、社經條件、醫療照護與生物遺傳影響；公共衛生常強調環境與生活方式影響最大。"
      },
      "exam_point": "健康決定因子。",
      "memory_tip": "健康不只醫療，環境生活最大宗。",
      "clinical_link": "",
      "review_flags": [
        "needs_manual_tag_review",
        "requested_supplement_patch",
        "additional_requested_by_user",
        "legacy_non_five_subject",
        "additional_question_requested_by_user",
        "official_answer_correction_or_multiple_credit"
      ],
      "source_files": {
        "extracted_from_detailed_file": "moex_med1_remaining_detailed_v4_merged_001_1827.json",
        "source_question_pdf": "101030_1101.pdf",
        "source_answer_pdf": "101030_MOD1101.pdf"
      }
    },
    {
      "id": "moex-med1-supplement-v5-101110-1101-011",
      "upsert_key": "101110-1101-11",
      "source_exam_key": "101110-1101",
      "exam_code": "101110",
      "paper_code": "1101",
      "exam_year_roc": 101,
      "exam_year_gregorian": 2012,
      "exam_session": "第二次",
      "question_no": 11,
      "requested_group": "reported_missing_by_user",
      "action": "upsert_or_replace_by_upsert_key",
      "subject_group": "醫學（一）",
      "stem": "腹股溝管（Inguinal canal）的前壁由下列何者組成？",
      "options": {
        "A": "腹外斜肌腱膜（Aponeurosis）",
        "B": "腹橫肌膜（Fascia transversalis）",
        "C": "腹內斜肌",
        "D": "腹橫肌"
      },
      "official_answer_raw": "#",
      "correct_answers": [
        "A",
        "C"
      ],
      "answer_credit_type": "multiple_accepted",
      "answer_note": "第11題答A或C或AC者均給分，",
      "classification_v5": {
        "primary_subject_exact": "解剖學",
        "topic_section": "腹部",
        "subtopic": "腹股溝管",
        "five_subject_bucket_if_app_requires": "解剖學",
        "original_question_no_used": 11,
        "question_number_default_bucket": "解剖學",
        "classification_method": "original_question_number_rule_checked_by_content",
        "confidence": "high",
        "legacy_non_five_subject": false,
        "original_classification": {
          "primary_subject": "解剖學",
          "body_region": "骨盆與會陰",
          "topic_section": "直腸與肛管",
          "anatomy_track": true,
          "classification_confidence": 0.78,
          "subject_confidence": 0.75,
          "region_confidence": 0.82,
          "method": "v2_rule_based_keyword_plus_known_manual_checks",
          "subject_scores": {
            "微生物免疫學/寄生蟲學": 0,
            "公共衛生學": 0,
            "生物化學": 0,
            "生理學": 0,
            "胚胎及發育生物學": 0,
            "組織學": 0,
            "解剖學": 2
          },
          "manual_note": ""
        },
        "notes": "已依題號與內容確認歸類。"
      },
      "explanation": "腹股溝管前壁主要由腹外斜肌腱膜形成，外側部由腹內斜肌纖維補強；官方本題接受A或C，需依官方更正答案處理。 這題要抓的重點是：inguinal canal anterior wall = external oblique aponeurosis, reinforced laterally by internal oblique。",
      "option_analysis": {
        "A": "正確。腹股溝管前壁主要由腹外斜肌腱膜形成，外側部由腹內斜肌纖維補強；官方本題接受A或C，需依官方更正答案處理。",
        "B": "不選。腹橫肌膜（Fascia transversalis） 與題幹要求的解剖位置、支配或功能不符。",
        "C": "正確。腹股溝管前壁主要由腹外斜肌腱膜形成，外側部由腹內斜肌纖維補強；官方本題接受A或C，需依官方更正答案處理。",
        "D": "不選。腹橫肌 與題幹要求的解剖位置、支配或功能不符。"
      },
      "exam_point": "inguinal canal anterior wall = external oblique aponeurosis, reinforced laterally by internal oblique。",
      "memory_tip": "先定位構造，再判斷其功能、走行、支配或鄰近關係。",
      "clinical_link": "",
      "review_flags": [
        "official_modified_or_multiple_credit",
        "requested_supplement_patch",
        "reported_missing_by_user",
        "reported_missing_in_user_integrity_check",
        "official_answer_correction_or_multiple_credit"
      ],
      "source_files": {
        "extracted_from_detailed_file": "moex_anatomy_strict_detailed_v3_merged_001_973.json",
        "source_question_pdf": "101110_1101.pdf",
        "source_answer_pdf": "101110_MOD1101.pdf"
      }
    },
    {
      "id": "moex-med1-supplement-v5-101110-1101-024",
      "upsert_key": "101110-1101-24",
      "source_exam_key": "101110-1101",
      "exam_code": "101110",
      "paper_code": "1101",
      "exam_year_roc": 101,
      "exam_year_gregorian": 2012,
      "exam_session": "第二次",
      "question_no": 24,
      "requested_group": "reported_missing_by_user",
      "action": "upsert_or_replace_by_upsert_key",
      "subject_group": "醫學（一）",
      "stem": "下列何者穿過內收肌裂孔（adductor hiatus）？",
      "options": {
        "A": "深股動脈（deep artery of thigh）",
        "B": "股神經（femoral nerve）",
        "C": "隱神經（saphenous nerve）",
        "D": "膕動脈（popliteal artery）"
      },
      "official_answer_raw": "#",
      "correct_answers": [
        "A",
        "B",
        "C",
        "D"
      ],
      "answer_credit_type": "all_credit",
      "answer_note": "第24題一律 給分，",
      "classification_v5": {
        "primary_subject_exact": "解剖學",
        "topic_section": "下肢",
        "subtopic": "內收肌裂孔",
        "five_subject_bucket_if_app_requires": "解剖學",
        "original_question_no_used": 24,
        "question_number_default_bucket": "解剖學",
        "classification_method": "original_question_number_rule_checked_by_content",
        "confidence": "high",
        "legacy_non_five_subject": false,
        "original_classification": {
          "primary_subject": "解剖學",
          "body_region": "頭頸部",
          "topic_section": "顱底與孔洞",
          "anatomy_track": true,
          "classification_confidence": 0.78,
          "subject_confidence": 0.75,
          "region_confidence": 0.82,
          "method": "v2_rule_based_keyword_plus_known_manual_checks",
          "subject_scores": {
            "微生物免疫學/寄生蟲學": 0,
            "公共衛生學": 0,
            "生物化學": 0,
            "生理學": 1,
            "胚胎及發育生物學": 0,
            "組織學": 0,
            "解剖學": 7
          },
          "manual_note": ""
        },
        "notes": "已依題號與內容確認歸類。"
      },
      "explanation": "內收肌裂孔位於內收大肌腱性附著處，讓股動脈與股靜脈通過進入膕窩並改稱膕動、靜脈。 這題要抓的重點是：adductor hiatus is in adductor magnus。",
      "option_analysis": {
        "A": "官方本題公告一律給分；仍建議回PDF與命題更正紀錄複核。選項內容：深股動脈（deep artery of thigh）。",
        "B": "官方本題公告一律給分；仍建議回PDF與命題更正紀錄複核。選項內容：股神經（femoral nerve）。",
        "C": "官方本題公告一律給分；仍建議回PDF與命題更正紀錄複核。選項內容：隱神經（saphenous nerve）。",
        "D": "官方本題公告一律給分；仍建議回PDF與命題更正紀錄複核。選項內容：膕動脈（popliteal artery）。"
      },
      "exam_point": "adductor hiatus is in adductor magnus。",
      "memory_tip": "先定位構造，再判斷其功能、走行、支配或鄰近關係。",
      "clinical_link": "",
      "review_flags": [
        "official_modified_or_multiple_credit",
        "requested_supplement_patch",
        "reported_missing_by_user",
        "reported_missing_in_user_integrity_check",
        "official_answer_correction_or_multiple_credit"
      ],
      "source_files": {
        "extracted_from_detailed_file": "moex_anatomy_strict_detailed_v3_merged_001_973.json",
        "source_question_pdf": "101110_1101.pdf",
        "source_answer_pdf": "101110_MOD1101.pdf"
      }
    },
    {
      "id": "moex-med1-supplement-v5-101110-1101-031",
      "upsert_key": "101110-1101-31",
      "source_exam_key": "101110-1101",
      "exam_code": "101110",
      "paper_code": "1101",
      "exam_year_roc": 101,
      "exam_year_gregorian": 2012,
      "exam_session": "第二次",
      "question_no": 31,
      "requested_group": "reported_missing_by_user",
      "action": "upsert_or_replace_by_upsert_key",
      "subject_group": "醫學（一）",
      "stem": "腎臟體積變大主要是因為下列何者長度增加所致？",
      "options": {
        "A": "遠端彎曲小管（distal convoluted tubule）",
        "B": "集尿管（collecting duct）",
        "C": "近端彎曲小管（proximal convoluted tubule）",
        "D": "輸尿管（ureter）"
      },
      "official_answer_raw": "#",
      "correct_answers": [
        "A",
        "B",
        "C",
        "D"
      ],
      "answer_credit_type": "all_credit",
      "answer_note": "第31題除未作答者不給分外，其餘均給分，",
      "classification_v5": {
        "primary_subject_exact": "胚胎及發育生物學",
        "topic_section": "泌尿系統發生",
        "subtopic": "腎臟發育",
        "five_subject_bucket_if_app_requires": "胚胎及發育生物學",
        "original_question_no_used": 31,
        "question_number_default_bucket": "解剖學",
        "classification_method": "content_override",
        "confidence": "high",
        "legacy_non_five_subject": false,
        "original_classification": {
          "primary_subject": "解剖學",
          "body_region": "骨盆與會陰",
          "topic_section": "泌尿生殖",
          "anatomy_track": true,
          "classification_confidence": 0.78,
          "subject_confidence": 0.75,
          "region_confidence": 0.82,
          "method": "v2_rule_based_keyword_plus_known_manual_checks",
          "subject_scores": {
            "微生物免疫學/寄生蟲學": 0,
            "公共衛生學": 0,
            "生物化學": 0,
            "生理學": 0,
            "胚胎及發育生物學": 0,
            "組織學": 0,
            "解剖學": 1
          },
          "manual_note": ""
        },
        "notes": "已依題號與內容確認歸類。"
      },
      "explanation": "腎臟長大與腎小管和集合管系統增長有關；官方本題一律給分，表示原試題可能有爭議，檔案保留官方給分型態。 這題要抓的重點是：renal growth and nephron/tubule development；官方一律給分題。",
      "option_analysis": {
        "A": "官方本題公告一律給分；仍建議回PDF與命題更正紀錄複核。選項內容：遠端彎曲小管（distal convoluted tubule）。",
        "B": "官方本題公告一律給分；仍建議回PDF與命題更正紀錄複核。選項內容：集尿管（collecting duct）。",
        "C": "官方本題公告一律給分；仍建議回PDF與命題更正紀錄複核。選項內容：近端彎曲小管（proximal convoluted tubule）。",
        "D": "官方本題公告一律給分；仍建議回PDF與命題更正紀錄複核。選項內容：輸尿管（ureter）。"
      },
      "exam_point": "renal growth and nephron/tubule development；官方一律給分題。",
      "memory_tip": "先定位構造，再判斷其功能、走行、支配或鄰近關係。",
      "clinical_link": "",
      "review_flags": [
        "official_modified_or_multiple_credit",
        "requested_supplement_patch",
        "reported_missing_by_user",
        "question_number_subject_mismatch",
        "content_override_used",
        "reported_missing_in_user_integrity_check",
        "official_answer_correction_or_multiple_credit"
      ],
      "source_files": {
        "extracted_from_detailed_file": "moex_anatomy_strict_detailed_v3_merged_001_973.json",
        "source_question_pdf": "101110_1101.pdf",
        "source_answer_pdf": "101110_MOD1101.pdf"
      }
    },
    {
      "id": "moex-med1-supplement-v5-102030-1101-025",
      "upsert_key": "102030-1101-25",
      "source_exam_key": "102030-1101",
      "exam_code": "102030",
      "paper_code": "1101",
      "exam_year_roc": 102,
      "exam_year_gregorian": 2013,
      "exam_session": "第一次",
      "question_no": 25,
      "requested_group": "reported_missing_by_user",
      "action": "upsert_or_replace_by_upsert_key",
      "subject_group": "醫學（一）",
      "stem": "車禍造成尺骨中段骨折並傷及尺動脈（ulnar artery），下列何處是直接按壓止血的最適當位置？",
      "options": {
        "A": "腋下（axilla）",
        "B": "上臂中段（mid arm）",
        "C": "肘窩（cubital fossa）",
        "D": "鼻煙區（snuff box）"
      },
      "official_answer_raw": "#",
      "correct_answers": [
        "B",
        "C"
      ],
      "answer_credit_type": "multiple_accepted",
      "answer_note": "第25題答B或C或BC者均給分，",
      "classification_v5": {
        "primary_subject_exact": "解剖學",
        "topic_section": "上肢",
        "subtopic": "尺動脈",
        "five_subject_bucket_if_app_requires": "解剖學",
        "original_question_no_used": 25,
        "question_number_default_bucket": "解剖學",
        "classification_method": "original_question_number_rule_checked_by_content",
        "confidence": "high",
        "legacy_non_five_subject": false,
        "original_classification": {
          "primary_subject": "解剖學",
          "body_region": "上肢",
          "topic_section": "上肢血管",
          "anatomy_track": true,
          "classification_confidence": 0.78,
          "subject_confidence": 0.75,
          "region_confidence": 0.82,
          "method": "v2_rule_based_keyword_plus_known_manual_checks",
          "subject_scores": {
            "微生物免疫學/寄生蟲學": 0,
            "公共衛生學": 0,
            "生物化學": 0,
            "生理學": 0,
            "胚胎及發育生物學": 0,
            "組織學": 0,
            "解剖學": 5
          },
          "manual_note": ""
        },
        "notes": "已依題號與內容確認歸類。"
      },
      "explanation": "尺動脈為肱動脈在肘窩分出的終支之一；前臂出血可壓迫近端供血，官方本題接受上臂中段或肘窩等答案，程式保留官方複數答案。 這題要抓的重點是：ulnar artery originates from brachial artery in cubital fossa；官方複數給分。",
      "option_analysis": {
        "A": "不選。腋下（axilla） 與題幹要求的解剖位置、支配或功能不符。",
        "B": "正確。尺動脈為肱動脈在肘窩分出的終支之一；前臂出血可壓迫近端供血，官方本題接受上臂中段或肘窩等答案，程式保留官方複數答案。",
        "C": "正確。尺動脈為肱動脈在肘窩分出的終支之一；前臂出血可壓迫近端供血，官方本題接受上臂中段或肘窩等答案，程式保留官方複數答案。",
        "D": "不選。鼻煙區（snuff box） 與題幹要求的解剖位置、支配或功能不符。"
      },
      "exam_point": "ulnar artery originates from brachial artery in cubital fossa；官方複數給分。",
      "memory_tip": "先定位構造，再判斷其功能、走行、支配或鄰近關係。",
      "clinical_link": "",
      "review_flags": [
        "official_modified_or_multiple_credit",
        "requested_supplement_patch",
        "reported_missing_by_user",
        "reported_missing_in_user_integrity_check",
        "official_answer_correction_or_multiple_credit"
      ],
      "source_files": {
        "extracted_from_detailed_file": "moex_anatomy_strict_detailed_v3_merged_001_973.json",
        "source_question_pdf": "102030_1101.pdf",
        "source_answer_pdf": "102030_MOD1101.pdf"
      }
    },
    {
      "id": "moex-med1-supplement-v5-103030-1101-008",
      "upsert_key": "103030-1101-8",
      "source_exam_key": "103030-1101",
      "exam_code": "103030",
      "paper_code": "1101",
      "exam_year_roc": 103,
      "exam_year_gregorian": 2014,
      "exam_session": "第一次",
      "question_no": 8,
      "requested_group": "reported_missing_by_user",
      "action": "upsert_or_replace_by_upsert_key",
      "subject_group": "醫學（一）",
      "stem": "後顱窩大腦鐮（falx cerebri）的感覺神經來自：",
      "options": {
        "A": "三叉神經眼支（ophthalmic division of trigeminal nerve）",
        "B": "三叉神經上頜支（maxillary division of trigeminal nerve）",
        "C": "三叉神經下頜支（mandibular division of trigeminal nerve）",
        "D": "迷走神經（vagus nerve）"
      },
      "official_answer_raw": "#",
      "correct_answers": [
        "A",
        "B",
        "C",
        "D"
      ],
      "answer_credit_type": "all_credit",
      "answer_note": "第8題一律給分，",
      "classification_v5": {
        "primary_subject_exact": "解剖學",
        "topic_section": "神經解剖",
        "subtopic": "硬腦膜感覺神經",
        "five_subject_bucket_if_app_requires": "解剖學",
        "original_question_no_used": 8,
        "question_number_default_bucket": "解剖學",
        "classification_method": "original_question_number_rule_checked_by_content",
        "confidence": "high",
        "legacy_non_five_subject": false,
        "original_classification": {
          "primary_subject": "解剖學",
          "body_region": "頭頸部",
          "topic_section": "顏面神經與三叉神經",
          "anatomy_track": true,
          "classification_confidence": 0.78,
          "subject_confidence": 0.75,
          "region_confidence": 0.82,
          "method": "v2_rule_based_keyword_plus_known_manual_checks",
          "subject_scores": {
            "微生物免疫學/寄生蟲學": 1,
            "公共衛生學": 0,
            "生物化學": 0,
            "生理學": 1,
            "胚胎及發育生物學": 0,
            "組織學": 0,
            "解剖學": 3
          },
          "manual_note": ""
        },
        "notes": "已依題號與內容確認歸類。"
      },
      "explanation": "此題官方一律給分。硬腦膜感覺支配依部位不同：前中顱窩多由三叉神經分支，後顱窩部分可由迷走神經、舌咽神經與上頸神經參與；題幹「後顱窩大腦鐮」表述不夠精確，因此官方給全體得分。",
      "option_analysis": {
        "A": "官方一律給分。本選項不需作為唯一正解判斷；詳見解析。",
        "B": "官方一律給分。本選項不需作為唯一正解判斷；詳見解析。",
        "C": "官方一律給分。本選項不需作為唯一正解判斷；詳見解析。",
        "D": "官方一律給分。本選項不需作為唯一正解判斷；詳見解析。"
      },
      "exam_point": "硬腦膜感覺：前中顱窩偏CN V；後顱窩可有CN X、IX與C1-C3參與。",
      "memory_tip": "硬腦膜痛覺不是只有三叉，後顱窩還有迷走/上頸神經。",
      "clinical_link": "顱內疼痛定位常與硬腦膜神經支配相關。",
      "review_flags": [
        "official_modified_or_multiple_credit",
        "needs_human_review",
        "requested_supplement_patch",
        "reported_missing_by_user",
        "reported_missing_in_user_integrity_check",
        "official_answer_correction_or_multiple_credit"
      ],
      "source_files": {
        "extracted_from_detailed_file": "moex_anatomy_strict_detailed_v3_merged_001_973.json",
        "source_question_pdf": "103030_1101.pdf",
        "source_answer_pdf": "103030_MOD1101.pdf"
      }
    },
    {
      "id": "moex-med1-supplement-v5-103100-1101-098",
      "upsert_key": "103100-1101-98",
      "source_exam_key": "103100-1101",
      "exam_code": "103100",
      "paper_code": "1101",
      "exam_year_roc": 103,
      "exam_year_gregorian": 2014,
      "exam_session": "第二次",
      "question_no": 98,
      "requested_group": "reported_missing_by_user",
      "action": "upsert_or_replace_by_upsert_key",
      "subject_group": "醫學（一）",
      "stem": "國民健康署在電視上宣傳 30 歲以上婦女每年 1 次免費子宮頸抹片檢查的「6 分鐘護一生」廣告，是 運用社會行銷策略中行銷組合（marketing mix）的那項核心概念？",
      "options": {
        "A": "交換",
        "B": "促銷",
        "C": "產品",
        "D": "消費者導向"
      },
      "official_answer_raw": "#",
      "correct_answers": [
        "B",
        "C",
        "D"
      ],
      "answer_credit_type": "multiple_accepted",
      "answer_note": "第98題答B或C或D或BC或BD或CD或BCD者均給分，",
      "classification_v5": {
        "primary_subject_exact": "公共衛生學",
        "topic_section": "健康促進/社會行銷",
        "subtopic": "marketing mix",
        "five_subject_bucket_if_app_requires": null,
        "original_question_no_used": 98,
        "question_number_default_bucket": "生物化學",
        "classification_method": "content_override",
        "confidence": "high",
        "legacy_non_five_subject": true,
        "original_classification": {
          "primary_subject": "解剖學",
          "body_region": "骨盆與會陰",
          "topic_section": "泌尿生殖",
          "anatomy_track": true,
          "classification_confidence": 0.78,
          "subject_confidence": 0.75,
          "region_confidence": 0.82,
          "method": "v2_rule_based_keyword_plus_known_manual_checks",
          "subject_scores": {
            "微生物免疫學/寄生蟲學": 0,
            "公共衛生學": 0,
            "生物化學": 0,
            "生理學": 0,
            "胚胎及發育生物學": 0,
            "組織學": 0,
            "解剖學": 1
          },
          "manual_note": ""
        },
        "notes": "舊制醫學（一）含微生物、寄生蟲、公衛等；此題保留精準主科，不硬塞入五大科。"
      },
      "explanation": "此題官方接受多個答案。以社會行銷4P來看，電視廣告較直接屬促銷(promotion)，但國考官方接受B/C/D等答案，代表題幹或選項存在爭議。此題不是解剖，應移出解剖題庫。",
      "option_analysis": {
        "A": "不選。交換不是本題最符合的答案；本題核心考點是：social marketing mix includes product, price, place, promotion；本題官方複數給分。",
        "B": "正確。此題官方接受多個答案。以社會行銷4P來看，電視廣告較直接屬促銷(promotion)，但國考官方接受B/C/D等答案，代表題幹或選項存在爭議。此題不是解剖，應移出解剖題庫。",
        "C": "正確。此題官方接受多個答案。以社會行銷4P來看，電視廣告較直接屬促銷(promotion)，但國考官方接受B/C/D等答案，代表題幹或選項存在爭議。此題不是解剖，應移出解剖題庫。",
        "D": "正確。此題官方接受多個答案。以社會行銷4P來看，電視廣告較直接屬促銷(promotion)，但國考官方接受B/C/D等答案，代表題幹或選項存在爭議。此題不是解剖，應移出解剖題庫。"
      },
      "exam_point": "social marketing mix includes product, price, place, promotion；本題官方複數給分。",
      "memory_tip": "電視廣告通常想到promotion，但官方此題複數給分。",
      "clinical_link": "公衛宣導常使用社會行銷概念。",
      "review_flags": [
        "official_modified_or_multiple_credit",
        "not_strict_anatomy_misclassified",
        "needs_removal_from_anatomy_track",
        "needs_human_review",
        "requested_supplement_patch",
        "reported_missing_by_user",
        "legacy_non_five_subject",
        "reported_missing_in_user_integrity_check",
        "official_answer_correction_or_multiple_credit"
      ],
      "source_files": {
        "extracted_from_detailed_file": "moex_anatomy_strict_detailed_v3_merged_001_973.json",
        "source_question_pdf": "103100_1101.pdf",
        "source_answer_pdf": "103100_MOD1101.pdf"
      }
    },
    {
      "id": "moex-med1-supplement-v5-104030-1101-008",
      "upsert_key": "104030-1101-8",
      "source_exam_key": "104030-1101",
      "exam_code": "104030",
      "paper_code": "1101",
      "exam_year_roc": 104,
      "exam_year_gregorian": 2015,
      "exam_session": "第一次",
      "question_no": 8,
      "requested_group": "reported_missing_by_user",
      "action": "upsert_or_replace_by_upsert_key",
      "subject_group": "醫學（一）",
      "stem": "位於大腦鎌（falx cerebri）與小腦天幕（tentorium cerebelli）交接處的構造是：",
      "options": {
        "A": "下矢狀竇（inferior sagittal sinus）",
        "B": "直竇（straight sinus）",
        "C": "匯竇（confluence of sinuses）",
        "D": "枕竇（occipital sinus）"
      },
      "official_answer_raw": "#",
      "correct_answers": [
        "B",
        "C"
      ],
      "answer_credit_type": "multiple_accepted",
      "answer_note": "第8題答B或C或BC者均給分，",
      "classification_v5": {
        "primary_subject_exact": "解剖學",
        "topic_section": "神經解剖",
        "subtopic": "硬腦膜靜脈竇",
        "five_subject_bucket_if_app_requires": "解剖學",
        "original_question_no_used": 8,
        "question_number_default_bucket": "解剖學",
        "classification_method": "original_question_number_rule_checked_by_content",
        "confidence": "high",
        "legacy_non_five_subject": false,
        "original_classification": {
          "primary_subject": "解剖學",
          "body_region": "神經解剖",
          "topic_section": "小腦",
          "anatomy_track": true,
          "classification_confidence": 0.78,
          "subject_confidence": 0.75,
          "region_confidence": 0.82,
          "method": "v2_rule_based_keyword_plus_known_manual_checks",
          "subject_scores": {
            "微生物免疫學/寄生蟲學": 0,
            "公共衛生學": 0,
            "生物化學": 0,
            "生理學": 0,
            "胚胎及發育生物學": 0,
            "組織學": 0,
            "解剖學": 1
          },
          "manual_note": ""
        },
        "notes": "已依題號與內容確認歸類。"
      },
      "explanation": "此題官方接受B或C。解剖上，大腦鎌與小腦天幕交接處沿線主要為直竇(straight sinus)，向後可接近匯竇(confluence of sinuses)，故B或C均被接受。",
      "option_analysis": {
        "A": "不選。下矢狀竇（inferior sagittal sinus）不是本題最符合的答案；本題核心考點是：straight sinus lies at junction of falx cerebri and tentorium cerebelli; drains to confluence。",
        "B": "正確。此題官方接受B或C。解剖上，大腦鎌與小腦天幕交接處沿線主要為直竇(straight sinus)，向後可接近匯竇(confluence of sinuses)，故B或C均被接受。",
        "C": "正確。此題官方接受B或C。解剖上，大腦鎌與小腦天幕交接處沿線主要為直竇(straight sinus)，向後可接近匯竇(confluence of sinuses)，故B或C均被接受。",
        "D": "不選。枕竇（occipital sinus）不是本題最符合的答案；本題核心考點是：straight sinus lies at junction of falx cerebri and tentorium cerebelli; drains to confluence。"
      },
      "exam_point": "straight sinus lies at junction of falx cerebri and tentorium cerebelli; drains to confluence。",
      "memory_tip": "鎌和幕交界先想到直竇，後端到匯竇。",
      "clinical_link": "硬腦膜靜脈竇血栓可造成顱內壓上升與局部神經症狀。",
      "review_flags": [
        "official_modified_or_multiple_credit",
        "needs_human_review",
        "requested_supplement_patch",
        "reported_missing_by_user",
        "reported_missing_in_user_integrity_check",
        "official_answer_correction_or_multiple_credit"
      ],
      "source_files": {
        "extracted_from_detailed_file": "moex_anatomy_strict_detailed_v3_merged_001_973.json",
        "source_question_pdf": "104030_1101.pdf",
        "source_answer_pdf": "104030_MOD1101.pdf"
      }
    },
    {
      "id": "moex-med1-supplement-v5-104090-5301-070",
      "upsert_key": "104090-5301-70",
      "source_exam_key": "104090-5301",
      "exam_code": "104090",
      "paper_code": "5301",
      "exam_year_roc": 104,
      "exam_year_gregorian": 2015,
      "exam_session": "第二次",
      "question_no": 70,
      "requested_group": "additional_requested_by_user",
      "action": "upsert_or_replace_by_upsert_key",
      "subject_group": "醫學（一）",
      "stem": "志明（血型B型）和春嬌（血型AB型）結婚後生下女兒小英（血型A型）。他們的下一個小 孩血型為B型的機會正常狀態下為多少百分比？",
      "options": {
        "A": "0",
        "B": "25",
        "C": "33",
        "D": "50"
      },
      "official_answer_raw": "D",
      "correct_answers": [
        "D"
      ],
      "answer_credit_type": "standard",
      "answer_note": "",
      "classification_v5": {
        "primary_subject_exact": "生物化學/遺傳學",
        "topic_section": "血型遺傳",
        "subtopic": "ABO inheritance",
        "five_subject_bucket_if_app_requires": "生物化學",
        "original_question_no_used": 70,
        "question_number_default_bucket": "生理學",
        "classification_method": "content_override",
        "confidence": "high",
        "legacy_non_five_subject": false,
        "original_classification": {
          "primary_subject": "未分類",
          "topic_section": "未分類",
          "track": "med1_remaining_completed_batch7",
          "classification_confidence": "medium",
          "method": "v4_batch7_rule_assisted_manual_review"
        },
        "notes": "已依題號與內容確認歸類。"
      },
      "explanation": "本題屬於未分類的「未分類」。題幹問的是最符合核心概念的敘述；選項 D「50」最符合，因此為正確答案。",
      "option_analysis": {
        "A": "不選。此選項「0」不是題幹所問的最佳答案，與正確概念相比較不符合。",
        "B": "不選。此選項「25」不是題幹所問的最佳答案，與正確概念相比較不符合。",
        "C": "不選。此選項「33」不是題幹所問的最佳答案，與正確概念相比較不符合。",
        "D": "正確。此選項「50」符合題幹所考的主要概念。"
      },
      "exam_point": "未分類：未分類。關鍵是辨認題幹問的是正確敘述、錯誤敘述或例外，並把正確選項和常見混淆選項分開。",
      "memory_tip": "先抓題幹關鍵字，再判斷是否為『何者錯誤／不包括』題。",
      "clinical_link": "若此題涉及臨床情境，重點在把解剖、組織、胚胎、生理或公衛概念轉成診斷、處置或風險判讀。",
      "review_flags": [
        "classification_low_confidence",
        "needs_human_review",
        "needs_manual_tag_review",
        "v4_detailed_batch7_601_700",
        "requested_supplement_patch",
        "additional_requested_by_user",
        "question_number_subject_mismatch",
        "content_override_used",
        "additional_question_requested_by_user",
        "official_answer_correction_or_multiple_credit"
      ],
      "source_files": {
        "extracted_from_detailed_file": "moex_med1_remaining_detailed_v4_merged_001_1827.json",
        "source_question_pdf": "104090_5301.pdf",
        "source_answer_pdf": "104090_MOD5301.pdf"
      }
    },
    {
      "id": "moex-med1-supplement-v5-105100-5301-030",
      "upsert_key": "105100-5301-30",
      "source_exam_key": "105100-5301",
      "exam_code": "105100",
      "paper_code": "5301",
      "exam_year_roc": 105,
      "exam_year_gregorian": 2016,
      "exam_session": "第二次",
      "question_no": 30,
      "requested_group": "reported_missing_by_user",
      "action": "upsert_or_replace_by_upsert_key",
      "subject_group": "醫學（一）",
      "stem": "口咽膜（oropharyngeal membrane）約於胚胎發育至第幾週時會破裂？",
      "options": {
        "A": "2",
        "B": "3",
        "C": "4",
        "D": "5"
      },
      "official_answer_raw": "C|D",
      "correct_answers": [
        "C",
        "D"
      ],
      "answer_credit_type": "multiple_answers",
      "answer_note": "第30題答C、D給分",
      "classification_v5": {
        "primary_subject_exact": "胚胎及發育生物學",
        "topic_section": "頭頸發生",
        "subtopic": "口咽膜",
        "five_subject_bucket_if_app_requires": "胚胎及發育生物學",
        "original_question_no_used": 30,
        "question_number_default_bucket": "解剖學",
        "classification_method": "content_override",
        "confidence": "high",
        "legacy_non_five_subject": false,
        "original_classification": {
          "primary_subject": "胚胎及發育生物學",
          "topic_section": "口咽膜",
          "track": "med1_remaining_completed_batch8_basic_medical_science",
          "classification_confidence": "medium",
          "method": "v4_batch8_rule_assisted_manual_review"
        },
        "notes": "已依題號與內容確認歸類。"
      },
      "explanation": "口咽膜約在第4週破裂形成原始口腔與前腸通道；本題官方接受第4或第5週，需保留多重答案。",
      "option_analysis": {
        "A": "不選。此選項「2」不是最符合題幹的答案；應改以「Oropharyngeal membrane ruptures around week 4。」判斷。",
        "B": "不選。此選項「3」不是最符合題幹的答案；應改以「Oropharyngeal membrane ruptures around week 4。」判斷。",
        "C": "正確。此選項「4」符合題幹核心概念；關鍵在於：口咽膜約在第4週破裂形成原始口腔與前腸通道；本題官方接受第4或第5週，需保留多重答案。",
        "D": "正確。此選項「5」符合題幹核心概念；關鍵在於：口咽膜約在第4週破裂形成原始口腔與前腸通道；本題官方接受第4或第5週，需保留多重答案。"
      },
      "exam_point": "Oropharyngeal membrane ruptures around week 4。",
      "memory_tip": "口咽膜很早破，大約第4週。",
      "clinical_link": "若出現在臨床題，先抓題幹關鍵線索，再對應病原、免疫機轉、組織構造或統計定義；不要只靠單一關鍵字猜答案。",
      "review_flags": [
        "official_modified_or_multiple_credit",
        "multiple_answers",
        "official_answer_special_credit",
        "needs_human_review_for_official_answer",
        "requested_supplement_patch",
        "reported_missing_by_user",
        "question_number_subject_mismatch",
        "content_override_used",
        "reported_missing_in_user_integrity_check",
        "official_answer_correction_or_multiple_credit"
      ],
      "source_files": {
        "extracted_from_detailed_file": "moex_med1_remaining_detailed_v4_merged_001_1827.json",
        "source_question_pdf": "105100_5301.pdf",
        "source_answer_pdf": "105100_MOD5301.pdf"
      }
    },
    {
      "id": "moex-med1-supplement-v5-105100-5301-031",
      "upsert_key": "105100-5301-31",
      "source_exam_key": "105100-5301",
      "exam_code": "105100",
      "paper_code": "5301",
      "exam_year_roc": 105,
      "exam_year_gregorian": 2016,
      "exam_session": "第二次",
      "question_no": 31,
      "requested_group": "reported_missing_by_user",
      "action": "upsert_or_replace_by_upsert_key",
      "subject_group": "醫學（一）",
      "stem": "下列那一項喉軟骨的發育與第四及第六對咽弓（pharyngeal arch）的軟骨無關？",
      "options": {
        "A": "甲狀軟骨（thyroid cartilage）",
        "B": "會厭軟骨（epiglottis）",
        "C": "杓狀軟骨（arytenoid cartilage）",
        "D": "環狀軟骨（cricoid cartilage）"
      },
      "official_answer_raw": "ALL",
      "correct_answers": [
        "ALL"
      ],
      "answer_credit_type": "all_credit",
      "answer_note": "第31題一律給分",
      "classification_v5": {
        "primary_subject_exact": "胚胎及發育生物學",
        "topic_section": "咽弓發生",
        "subtopic": "喉軟骨",
        "five_subject_bucket_if_app_requires": "胚胎及發育生物學",
        "original_question_no_used": 31,
        "question_number_default_bucket": "解剖學",
        "classification_method": "content_override",
        "confidence": "high",
        "legacy_non_five_subject": false,
        "original_classification": {
          "primary_subject": "解剖學",
          "body_region": "頭頸部",
          "topic_section": "甲狀腺與副甲狀腺",
          "anatomy_track": true,
          "classification_confidence": 0.78,
          "subject_confidence": 0.75,
          "region_confidence": 0.82,
          "method": "v2_rule_based_keyword_plus_known_manual_checks",
          "subject_scores": {
            "微生物免疫學/寄生蟲學": 0,
            "公共衛生學": 0,
            "生物化學": 0,
            "生理學": 1,
            "胚胎及發育生物學": 1,
            "組織學": 2,
            "解剖學": 4
          },
          "manual_note": ""
        },
        "notes": "已依題號與內容確認歸類。"
      },
      "explanation": "官方此題給一律給分。一般來說多數喉軟骨與第四及第六咽弓軟骨相關，但會厭軟骨來源描述在不同教材可能有差異，因此官方修改為全給分。 這題要抓的重點是：official all credit：laryngeal cartilage embryology ambiguous。",
      "option_analysis": {
        "A": "官方此題一律給分；此選項「甲狀軟骨（thyroid cartilage）」需依官方更正答案處理。",
        "B": "官方此題一律給分；此選項「會厭軟骨（epiglottis）」需依官方更正答案處理。",
        "C": "官方此題一律給分；此選項「杓狀軟骨（arytenoid cartilage）」需依官方更正答案處理。",
        "D": "官方此題一律給分；此選項「環狀軟骨（cricoid cartilage）」需依官方更正答案處理。"
      },
      "exam_point": "official all credit：laryngeal cartilage embryology ambiguous。",
      "memory_tip": "遇到官方 ALL，程式要保留多重/一律給分資訊。",
      "clinical_link": "胚胎來源題若教材分歧，需以官方更正答案為準。",
      "review_flags": [
        "official_modified_or_multiple_credit",
        "requested_supplement_patch",
        "reported_missing_by_user",
        "question_number_subject_mismatch",
        "content_override_used",
        "reported_missing_in_user_integrity_check",
        "official_answer_correction_or_multiple_credit"
      ],
      "source_files": {
        "extracted_from_detailed_file": "moex_anatomy_strict_detailed_v3_merged_001_973.json",
        "source_question_pdf": "105100_5301.pdf",
        "source_answer_pdf": "105100_MOD5301.pdf"
      }
    },
    {
      "id": "moex-med1-supplement-v5-105100-5301-050",
      "upsert_key": "105100-5301-50",
      "source_exam_key": "105100-5301",
      "exam_code": "105100",
      "paper_code": "5301",
      "exam_year_roc": 105,
      "exam_year_gregorian": 2016,
      "exam_session": "第二次",
      "question_no": 50,
      "requested_group": "reported_missing_by_user",
      "action": "upsert_or_replace_by_upsert_key",
      "subject_group": "醫學（一）",
      "stem": "有關嗜肺性退伍軍人桿菌（Legionella pneumophila）的敘述，下列何者錯誤？",
      "options": {
        "A": "培養時需在培養基中添加L-胱胺酸（L-cysteine）",
        "B": "可在巨噬細胞（macrophages）內繁殖",
        "C": "會引起龐地克熱（Pontiac fever）和肺炎兩型，而以龐地克熱死亡率較高",
        "D": "經常由中央空調散佈"
      },
      "official_answer_raw": "C|D",
      "correct_answers": [
        "C",
        "D"
      ],
      "answer_credit_type": "multiple_answers",
      "answer_note": "第50題答C、D給分",
      "classification_v5": {
        "primary_subject_exact": "微生物學",
        "topic_section": "細菌學",
        "subtopic": "Legionella",
        "five_subject_bucket_if_app_requires": null,
        "original_question_no_used": 50,
        "question_number_default_bucket": "生理學",
        "classification_method": "content_override",
        "confidence": "high",
        "legacy_non_five_subject": true,
        "original_classification": {
          "primary_subject": "微生物學",
          "topic_section": "Legionella",
          "track": "med1_remaining_completed_batch8_non_anatomy",
          "classification_confidence": "medium",
          "method": "v4_batch8_rule_assisted_manual_review"
        },
        "notes": "舊制醫學（一）含微生物、寄生蟲、公衛等；此題保留精準主科，不硬塞入五大科。"
      },
      "explanation": "Legionella需L-cysteine與鐵培養，可在巨噬細胞內繁殖。Pontiac fever通常為自限性，死亡率較肺炎低；官方也接受D，可能因中央空調散布表述過度簡化。",
      "option_analysis": {
        "A": "不選。此選項「培養時需在培養基中添加L-胱胺酸（L-cysteine）」屬於相對正確或較符合標準概念的敘述，不是本題要找的錯誤項；本題考點是：Legionella: water aerosol, macrophage, BCYE with cysteine; Pontiac fever low mortality。",
        "B": "不選。此選項「可在巨噬細胞（macrophages）內繁殖」屬於相對正確或較符合標準概念的敘述，不是本題要找的錯誤項；本題考點是：Legionella: water aerosol, macrophage, BCYE with cysteine; Pontiac fever low mortality。",
        "C": "應選。題幹問錯誤／例外敘述；此選項「會引起龐地克熱（Pontiac fever）和肺炎兩型，而以龐地克熱死亡率較高」與正確概念不符，關鍵在於：Legionella需L-cysteine與鐵培養，可在巨噬細胞內繁殖。Pontiac fever通常為自限性，死亡率較肺炎低；官方也接受D，可能因中央空調散布表述過度簡化。",
        "D": "應選。題幹問錯誤／例外敘述；此選項「經常由中央空調散佈」與正確概念不符，關鍵在於：Legionella需L-cysteine與鐵培養，可在巨噬細胞內繁殖。Pontiac fever通常為自限性，死亡率較肺炎低；官方也接受D，可能因中央空調散布表述過度簡化。"
      },
      "exam_point": "Legionella: water aerosol, macrophage, BCYE with cysteine; Pontiac fever low mortality。",
      "memory_tip": "退伍軍人菌靠水霧，不是人傳人。",
      "clinical_link": "若出現在臨床題，先抓題幹關鍵線索，再對應病原、免疫機轉、組織構造或統計定義；不要只靠單一關鍵字猜答案。",
      "review_flags": [
        "official_modified_or_multiple_credit",
        "multiple_answers",
        "official_answer_special_credit",
        "needs_human_review_for_official_answer",
        "requested_supplement_patch",
        "reported_missing_by_user",
        "legacy_non_five_subject",
        "reported_missing_in_user_integrity_check",
        "official_answer_correction_or_multiple_credit"
      ],
      "source_files": {
        "extracted_from_detailed_file": "moex_med1_remaining_detailed_v4_merged_001_1827.json",
        "source_question_pdf": "105100_5301.pdf",
        "source_answer_pdf": "105100_MOD5301.pdf"
      }
    },
    {
      "id": "moex-med1-supplement-v5-105100-5301-058",
      "upsert_key": "105100-5301-58",
      "source_exam_key": "105100-5301",
      "exam_code": "105100",
      "paper_code": "5301",
      "exam_year_roc": 105,
      "exam_year_gregorian": 2016,
      "exam_session": "第二次",
      "question_no": 58,
      "requested_group": "reported_missing_by_user",
      "action": "upsert_or_replace_by_upsert_key",
      "subject_group": "醫學（一）",
      "stem": "EB病毒（Epstein-Barr virus）主要感染B淋巴球；它是以該細胞表面的何種分子為受體（receptor）？",
      "options": {
        "A": "CR2",
        "B": "CD4",
        "C": "CD8",
        "D": "醣蛋白（glycoprotein）"
      },
      "official_answer_raw": "A|D",
      "correct_answers": [
        "A",
        "D"
      ],
      "answer_credit_type": "multiple_answers",
      "answer_note": "第58題 答A、D給分",
      "classification_v5": {
        "primary_subject_exact": "微生物免疫學",
        "topic_section": "病毒學",
        "subtopic": "EBV receptor",
        "five_subject_bucket_if_app_requires": null,
        "original_question_no_used": 58,
        "question_number_default_bucket": "生理學",
        "classification_method": "content_override",
        "confidence": "high",
        "legacy_non_five_subject": true,
        "original_classification": {
          "primary_subject": "微生物學",
          "topic_section": "EB病毒",
          "track": "med1_remaining_completed_batch8_non_anatomy",
          "classification_confidence": "medium",
          "method": "v4_batch8_rule_assisted_manual_review"
        },
        "notes": "舊制醫學（一）含微生物、寄生蟲、公衛等；此題保留精準主科，不硬塞入五大科。"
      },
      "explanation": "EBV主要以B細胞表面的CR2/CD21作為受體；官方同時接受D，可能因病毒糖蛋白參與附著與進入之表述。",
      "option_analysis": {
        "A": "正確。此選項「CR2」符合題幹核心概念；關鍵在於：EBV主要以B細胞表面的CR2/CD21作為受體；官方同時接受D，可能因病毒糖蛋白參與附著與進入之表述。",
        "B": "不選。此選項「CD4」不是最符合題幹的答案；應改以「EBV receptor on B cell: CR2/CD21。」判斷。",
        "C": "不選。此選項「CD8」不是最符合題幹的答案；應改以「EBV receptor on B cell: CR2/CD21。」判斷。",
        "D": "正確。此選項「醣蛋白（glycoprotein）」符合題幹核心概念；關鍵在於：EBV主要以B細胞表面的CR2/CD21作為受體；官方同時接受D，可能因病毒糖蛋白參與附著與進入之表述。"
      },
      "exam_point": "EBV receptor on B cell: CR2/CD21。",
      "memory_tip": "EBV找B細胞CD21。",
      "clinical_link": "若出現在臨床題，先抓題幹關鍵線索，再對應病原、免疫機轉、組織構造或統計定義；不要只靠單一關鍵字猜答案。",
      "review_flags": [
        "official_modified_or_multiple_credit",
        "multiple_answers",
        "official_answer_special_credit",
        "needs_human_review_for_official_answer",
        "requested_supplement_patch",
        "reported_missing_by_user",
        "legacy_non_five_subject",
        "reported_missing_in_user_integrity_check",
        "official_answer_correction_or_multiple_credit"
      ],
      "source_files": {
        "extracted_from_detailed_file": "moex_med1_remaining_detailed_v4_merged_001_1827.json",
        "source_question_pdf": "105100_5301.pdf",
        "source_answer_pdf": "105100_MOD5301.pdf"
      }
    },
    {
      "id": "moex-med1-supplement-v5-105100-5301-086",
      "upsert_key": "105100-5301-86",
      "source_exam_key": "105100-5301",
      "exam_code": "105100",
      "paper_code": "5301",
      "exam_year_roc": 105,
      "exam_year_gregorian": 2016,
      "exam_session": "第二次",
      "question_no": 86,
      "requested_group": "reported_missing_by_user",
      "action": "upsert_or_replace_by_upsert_key",
      "subject_group": "醫學（一）",
      "stem": "某麻醉科醫師想比較兩種麻醉藥物（舊藥與新藥）的效果，計畫收集採用舊藥 50 人及新藥 50 位病人在麻醉開始後至手術開 始時的最小血壓值，麻醉科醫師希望可以偵測到兩組最小血壓值差距到 6 mmHg，下列何者做法可以提升統計假設檢定的檢定 力（power）？",
      "options": {
        "A": "將檢定的顯著性水準由 0.05 增加至 0.1",
        "B": "偵測到兩組最小血壓值差距由 6 mmHg 降低到 3 mmHg",
        "C": "樣本更改為收集舊藥 40 人及新藥 60 位病人",
        "D": "樣本更改為收集舊藥 60 人及新藥 40 位病人"
      },
      "official_answer_raw": "A|B",
      "correct_answers": [
        "A",
        "B"
      ],
      "answer_credit_type": "multiple_answers",
      "answer_note": "第86題答A、B給分",
      "classification_v5": {
        "primary_subject_exact": "公共衛生學/生物統計",
        "topic_section": "統計推論",
        "subtopic": "檢定力",
        "five_subject_bucket_if_app_requires": null,
        "original_question_no_used": 86,
        "question_number_default_bucket": "生物化學",
        "classification_method": "content_override",
        "confidence": "high",
        "legacy_non_five_subject": true,
        "original_classification": {
          "primary_subject": "公共衛生學／生物統計",
          "topic_section": "檢定力",
          "track": "med1_remaining_completed_batch9",
          "classification_confidence": "medium",
          "method": "v4_batch9_rule_assisted_manual_review"
        },
        "notes": "舊制醫學（一）含微生物、寄生蟲、公衛等；此題保留精準主科，不硬塞入五大科。"
      },
      "explanation": "檢定力會隨顯著水準α增加、樣本數增加、變異下降及效應量變大而上升。官方答案為A或B，保留複數給分；B的文字若解讀為欲偵測更小差異，通常會降低power，故需人工確認題目語意。",
      "option_analysis": {
        "A": "此選項為官方給分答案之一。其內容為「將檢定的顯著性水準由 0.05 增加至 0.1」，與本題核心考點相符或因官方複數答案而列為可給分。",
        "B": "此選項為官方給分答案之一。其內容為「偵測到兩組最小血壓值差距由 6 mmHg 降低到 3 mmHg」，與本題核心考點相符或因官方複數答案而列為可給分。",
        "C": "不選。此選項為「樣本更改為收集舊藥 40 人及新藥 60 位病人」，與題幹所問的核心考點不符，或屬於相近但不同的疾病、結構、機轉或統計概念。",
        "D": "不選。此選項為「樣本更改為收集舊藥 60 人及新藥 40 位病人」，與題幹所問的核心考點不符，或屬於相近但不同的疾病、結構、機轉或統計概念。"
      },
      "exam_point": "統計檢定力的影響因素",
      "memory_tip": "Power 高：α大、樣本大、效應大、變異小。",
      "clinical_link": "可用於臨床研究設計、篩檢判讀、健康政策或職業環境醫學實務。",
      "review_flags": [
        "official_modified_or_multiple_credit",
        "official_multiple_answers",
        "needs_human_review",
        "official_answer_requires_review",
        "requested_supplement_patch",
        "reported_missing_by_user",
        "legacy_non_five_subject",
        "reported_missing_in_user_integrity_check",
        "official_answer_correction_or_multiple_credit"
      ],
      "source_files": {
        "extracted_from_detailed_file": "moex_med1_remaining_detailed_v4_merged_001_1827.json",
        "source_question_pdf": "105100_5301.pdf",
        "source_answer_pdf": "105100_MOD5301.pdf"
      }
    },
    {
      "id": "moex-med1-supplement-v5-105100-5301-090",
      "upsert_key": "105100-5301-90",
      "source_exam_key": "105100-5301",
      "exam_code": "105100",
      "paper_code": "5301",
      "exam_year_roc": 105,
      "exam_year_gregorian": 2016,
      "exam_session": "第二次",
      "question_no": 90,
      "requested_group": "reported_missing_by_user",
      "action": "upsert_or_replace_by_upsert_key",
      "subject_group": "醫學（一）",
      "stem": "空氣污染物中所謂的氮氧化物，是指下列何者？",
      "options": {
        "A": "一氧化氮與一氧化二氮",
        "B": "一氧化氮與二氧化氮",
        "C": "一氧化氮與氨氣",
        "D": "二氧化氮與一氧化二氮"
      },
      "official_answer_raw": "A|B|D",
      "correct_answers": [
        "A",
        "B",
        "D"
      ],
      "answer_credit_type": "multiple_answers",
      "answer_note": "第90題答A、B、D給分",
      "classification_v5": {
        "primary_subject_exact": "公共衛生學/環境衛生",
        "topic_section": "空氣污染",
        "subtopic": "氮氧化物",
        "five_subject_bucket_if_app_requires": null,
        "original_question_no_used": 90,
        "question_number_default_bucket": "生物化學",
        "classification_method": "content_override",
        "confidence": "high",
        "legacy_non_five_subject": true,
        "original_classification": {
          "primary_subject": "公共衛生學／環境衛生",
          "topic_section": "氮氧化物",
          "track": "med1_remaining_completed_batch9",
          "classification_confidence": "medium",
          "method": "v4_batch9_rule_assisted_manual_review"
        },
        "notes": "舊制醫學（一）含微生物、寄生蟲、公衛等；此題保留精準主科，不硬塞入五大科。"
      },
      "explanation": "官方給複數答案。一般環境衛生常以NOx代表NO與NO2，但題目答案標示包含N2O相關組合，故保留官方複數給分並標記人工確認。",
      "option_analysis": {
        "A": "此選項為官方給分答案之一。其內容為「一氧化氮與一氧化二氮」，與本題核心考點相符或因官方複數答案而列為可給分。",
        "B": "此選項為官方給分答案之一。其內容為「一氧化氮與二氧化氮」，與本題核心考點相符或因官方複數答案而列為可給分。",
        "C": "不選。此選項為「一氧化氮與氨氣」，與題幹所問的核心考點不符，或屬於相近但不同的疾病、結構、機轉或統計概念。",
        "D": "此選項為官方給分答案之一。其內容為「二氧化氮與一氧化二氮」，與本題核心考點相符或因官方複數答案而列為可給分。"
      },
      "exam_point": "空氣污染物NOx的定義",
      "memory_tip": "NOx常考NO、NO2；遇官方複數要保留。",
      "clinical_link": "可用於臨床研究設計、篩檢判讀、健康政策或職業環境醫學實務。",
      "review_flags": [
        "needs_manual_tag_review",
        "official_modified_or_multiple_credit",
        "official_multiple_answers",
        "needs_human_review",
        "official_answer_requires_review",
        "requested_supplement_patch",
        "reported_missing_by_user",
        "legacy_non_five_subject",
        "reported_missing_in_user_integrity_check",
        "official_answer_correction_or_multiple_credit"
      ],
      "source_files": {
        "extracted_from_detailed_file": "moex_med1_remaining_detailed_v4_merged_001_1827.json",
        "source_question_pdf": "105100_5301.pdf",
        "source_answer_pdf": "105100_MOD5301.pdf"
      }
    },
    {
      "id": "moex-med1-supplement-v5-105100-5301-094",
      "upsert_key": "105100-5301-94",
      "source_exam_key": "105100-5301",
      "exam_code": "105100",
      "paper_code": "5301",
      "exam_year_roc": 105,
      "exam_year_gregorian": 2016,
      "exam_session": "第二次",
      "question_no": 94,
      "requested_group": "reported_missing_by_user",
      "action": "upsert_or_replace_by_upsert_key",
      "subject_group": "醫學（一）",
      "stem": "在不同的游離輻射物質中，有一種游離輻射污染物由岩石或土壤釋放到室內。那一種癌症與這種物質最相關？",
      "options": {
        "A": "大腸癌",
        "B": "肺癌",
        "C": "乳癌",
        "D": "血癌"
      },
      "official_answer_raw": "B|D",
      "correct_answers": [
        "B",
        "D"
      ],
      "answer_credit_type": "multiple_answers",
      "answer_note": "第94題答B、D給分",
      "classification_v5": {
        "primary_subject_exact": "公共衛生學/環境衛生",
        "topic_section": "游離輻射",
        "subtopic": "radon",
        "five_subject_bucket_if_app_requires": null,
        "original_question_no_used": 94,
        "question_number_default_bucket": "生物化學",
        "classification_method": "content_override",
        "confidence": "high",
        "legacy_non_five_subject": true,
        "original_classification": {
          "primary_subject": "解剖學",
          "body_region": "胸腔",
          "topic_section": "肺與胸膜",
          "anatomy_track": true,
          "classification_confidence": 0.78,
          "subject_confidence": 0.75,
          "region_confidence": 0.82,
          "method": "v2_rule_based_keyword_plus_known_manual_checks",
          "subject_scores": {
            "微生物免疫學/寄生蟲學": 0,
            "公共衛生學": 0,
            "生物化學": 0,
            "生理學": 0,
            "胚胎及發育生物學": 0,
            "組織學": 0,
            "解剖學": 1
          },
          "manual_note": ""
        },
        "notes": "舊制醫學（一）含微生物、寄生蟲、公衛等；此題保留精準主科，不硬塞入五大科。"
      },
      "explanation": "岩石或土壤釋放進室內的游離輻射污染物是氡，最典型與肺癌相關。此題官方接受B與D，需保留複數給分資訊。題目屬環境醫學，不是解剖。 這題要抓的重點是：非解剖：radon exposure is classically associated with lung cancer；official accepts multiple answers。",
      "option_analysis": {
        "A": "不選。大腸癌 不是本題最佳答案；本題核心考點是：非解剖：radon exposure is classically associated with lung cancer；official accepts multiple answers。",
        "B": "正確。岩石或土壤釋放進室內的游離輻射污染物是氡，最典型與肺癌相關。此題官方接受B與D，需保留複數給分資訊。題目屬環境醫學，不是解剖。",
        "C": "不選。乳癌 不是本題最佳答案；本題核心考點是：非解剖：radon exposure is classically associated with lung cancer；official accepts multiple answers。",
        "D": "正確。岩石或土壤釋放進室內的游離輻射污染物是氡，最典型與肺癌相關。此題官方接受B與D，需保留複數給分資訊。題目屬環境醫學，不是解剖。"
      },
      "exam_point": "非解剖：radon exposure is classically associated with lung cancer；official accepts multiple answers。",
      "memory_tip": "室內氡＝肺癌；但尊重官方複數答案。",
      "clinical_link": "應移到公衛/環境醫學分類，且保留 corrected answers。",
      "review_flags": [
        "official_modified_or_multiple_credit",
        "not_strict_anatomy_misclassified",
        "needs_removal_from_anatomy_track",
        "requested_supplement_patch",
        "reported_missing_by_user",
        "legacy_non_five_subject",
        "reported_missing_in_user_integrity_check",
        "official_answer_correction_or_multiple_credit"
      ],
      "source_files": {
        "extracted_from_detailed_file": "moex_anatomy_strict_detailed_v3_merged_001_973.json",
        "source_question_pdf": "105100_5301.pdf",
        "source_answer_pdf": "105100_MOD5301.pdf"
      }
    },
    {
      "id": "moex-med1-supplement-v5-106020-5301-035",
      "upsert_key": "106020-5301-35",
      "source_exam_key": "106020-5301",
      "exam_code": "106020",
      "paper_code": "5301",
      "exam_year_roc": 106,
      "exam_year_gregorian": 2017,
      "exam_session": "第一次",
      "question_no": 35,
      "requested_group": "reported_missing_by_user",
      "action": "upsert_or_replace_by_upsert_key",
      "subject_group": "醫學（一）",
      "stem": "有關巴金森氏症（Parkinson’s disease），下列敘述何者錯誤？",
      "options": {
        "A": "為大腦黑質（substantia nigra）及基底核（basal ganglia）中神經元的多巴胺（dopamine）分泌不足所造成",
        "B": "患者腦中之退化神經元中常含有由神經絲（neurofilaments）與特定蛋白質交織而成的內含體（Lewy bodies）",
        "C": "通常會直接投予（口服或注射）多巴胺（dopamine）治療",
        "D": "腦神經元退化後，通常會有明顯的神經膠樣變性（gliosis）"
      },
      "official_answer_raw": "A|C",
      "correct_answers": [
        "A",
        "C"
      ],
      "answer_credit_type": "multiple_answers",
      "answer_note": "第35題答A、C給分",
      "classification_v5": {
        "primary_subject_exact": "神經解剖/神經科學",
        "topic_section": "基底核",
        "subtopic": "Parkinson disease",
        "five_subject_bucket_if_app_requires": "解剖學",
        "original_question_no_used": 35,
        "question_number_default_bucket": "胚胎及發育生物學",
        "classification_method": "content_override",
        "confidence": "high",
        "legacy_non_five_subject": false,
        "original_classification": {
          "primary_subject": "解剖學",
          "body_region": "神經解剖",
          "topic_section": "腦神經",
          "anatomy_track": true,
          "classification_confidence": 0.78,
          "subject_confidence": 0.75,
          "region_confidence": 0.82,
          "method": "v2_rule_based_keyword_plus_known_manual_checks",
          "subject_scores": {
            "微生物免疫學/寄生蟲學": 0,
            "公共衛生學": 0,
            "生物化學": 0,
            "生理學": 1,
            "胚胎及發育生物學": 0,
            "組織學": 0,
            "解剖學": 1
          },
          "manual_note": ""
        },
        "notes": "已依題號與內容確認歸類。"
      },
      "explanation": "此題官方為複數給分。帕金森病主要因黑質緻密部多巴胺神經元退化，造成紋狀體多巴胺不足；治療通常使用能通過血腦障壁的 levodopa，而非直接給 dopamine。A 的文字把分泌不足部位寫得不精確，C 則是典型錯誤。",
      "option_analysis": {
        "A": "正確。此題官方為複數給分。帕金森病主要因黑質緻密部多巴胺神經元退化，造成紋狀體多巴胺不足；治療通常使用能通過血腦障壁的 levodopa，而非直接給 dopamine。A 的文字把分泌不足部位寫得不精確，C 則是典型錯誤。",
        "B": "不選。患者腦中之退化神經元中常含有由神經絲（neurofilaments）與特定蛋白質交織而成的內含體（Lewy bodies） 不是本題所問的最佳答案；請對照本題考點：Parkinson disease：substantia nigra pars compacta degeneration；治療用 levodopa。",
        "C": "正確。此題官方為複數給分。帕金森病主要因黑質緻密部多巴胺神經元退化，造成紋狀體多巴胺不足；治療通常使用能通過血腦障壁的 levodopa，而非直接給 dopamine。A 的文字把分泌不足部位寫得不精確，C 則是典型錯誤。",
        "D": "不選。腦神經元退化後，通常會有明顯的神經膠樣變性（gliosis） 不是本題所問的最佳答案；請對照本題考點：Parkinson disease：substantia nigra pars compacta degeneration；治療用 levodopa。"
      },
      "exam_point": "Parkinson disease：substantia nigra pars compacta degeneration；治療用 levodopa。",
      "memory_tip": "多巴胺進不了腦，L-dopa 才過得去。",
      "clinical_link": "帕金森病的主要症狀包含靜止性顫抖、僵硬與動作遲緩。",
      "review_flags": [
        "official_modified_or_multiple_credit",
        "requested_supplement_patch",
        "reported_missing_by_user",
        "question_number_subject_mismatch",
        "content_override_used",
        "reported_missing_in_user_integrity_check",
        "official_answer_correction_or_multiple_credit"
      ],
      "source_files": {
        "extracted_from_detailed_file": "moex_anatomy_strict_detailed_v3_merged_001_973.json",
        "source_question_pdf": "106020_5301.pdf",
        "source_answer_pdf": "106020_MOD5301.pdf"
      }
    },
    {
      "id": "moex-med1-supplement-v5-106100-1301-029",
      "upsert_key": "106100-1301-29",
      "source_exam_key": "106100-1301",
      "exam_code": "106100",
      "paper_code": "1301",
      "exam_year_roc": 106,
      "exam_year_gregorian": 2017,
      "exam_session": "第二次",
      "question_no": 29,
      "requested_group": "reported_missing_by_user",
      "action": "upsert_or_replace_by_upsert_key",
      "subject_group": "醫學（一）",
      "stem": "足底深弓動脈（deep plantar artery）主要由下列何者分支？",
      "options": {
        "A": "弓狀動脈（arcuate artery）",
        "B": "足背動脈（dorsalis pedis artery）",
        "C": "足底內側動脈（medial plantar artery）",
        "D": "足底外側動脈（lateral plantar artery）"
      },
      "official_answer_raw": "B|D",
      "correct_answers": [
        "B",
        "D"
      ],
      "answer_credit_type": "multiple_answers",
      "answer_note": "第29題答B、D給分",
      "classification_v5": {
        "primary_subject_exact": "解剖學",
        "topic_section": "下肢",
        "subtopic": "足底動脈",
        "five_subject_bucket_if_app_requires": "解剖學",
        "original_question_no_used": 29,
        "question_number_default_bucket": "解剖學",
        "classification_method": "original_question_number_rule_checked_by_content",
        "confidence": "high",
        "legacy_non_five_subject": false,
        "original_classification": {
          "primary_subject": "解剖學",
          "body_region": "下肢",
          "topic_section": "足部",
          "anatomy_track": true,
          "classification_confidence": 0.78,
          "subject_confidence": 0.75,
          "region_confidence": 0.82,
          "method": "v2_rule_based_keyword_plus_known_manual_checks",
          "subject_scores": {
            "微生物免疫學/寄生蟲學": 0,
            "公共衛生學": 0,
            "生物化學": 0,
            "生理學": 0,
            "胚胎及發育生物學": 0,
            "組織學": 0,
            "解剖學": 2
          },
          "manual_note": ""
        },
        "notes": "已依題號與內容確認歸類。"
      },
      "explanation": "官方給B或D。深足底動脈是足背動脈穿入第一蹠骨間隙後的分支，並與足底外側動脈共同形成深足底弓；若題目把『足底深弓動脈』理解為深足底弓的主體，足底外側動脈也是可接受答案。",
      "option_analysis": {
        "A": "不選。弓狀動脈（arcuate artery） 不是本題所問的最佳答案；請對照本題考點：deep plantar artery/arch：dorsalis pedis branch + lateral plantar artery。",
        "B": "正確。官方給B或D。深足底動脈是足背動脈穿入第一蹠骨間隙後的分支，並與足底外側動脈共同形成深足底弓；若題目把『足底深弓動脈』理解為深足底弓的主體，足底外側動脈也是可接受答案。",
        "C": "不選。足底內側動脈（medial plantar artery） 不是本題所問的最佳答案；請對照本題考點：deep plantar artery/arch：dorsalis pedis branch + lateral plantar artery。",
        "D": "正確。官方給B或D。深足底動脈是足背動脈穿入第一蹠骨間隙後的分支，並與足底外側動脈共同形成深足底弓；若題目把『足底深弓動脈』理解為深足底弓的主體，足底外側動脈也是可接受答案。"
      },
      "exam_point": "deep plantar artery/arch：dorsalis pedis branch + lateral plantar artery。",
      "memory_tip": "深弓主要靠外側足底，深足底支來自足背。",
      "clinical_link": "足背動脈脈搏與足底弓吻合影響足部血供評估。",
      "review_flags": [
        "official_modified_or_multiple_credit",
        "requested_supplement_patch",
        "reported_missing_by_user",
        "reported_missing_in_user_integrity_check",
        "official_answer_correction_or_multiple_credit"
      ],
      "source_files": {
        "extracted_from_detailed_file": "moex_anatomy_strict_detailed_v3_merged_001_973.json",
        "source_question_pdf": "106100_1301.pdf",
        "source_answer_pdf": "106100_MOD1301.pdf"
      }
    },
    {
      "id": "moex-med1-supplement-v5-106100-1301-043",
      "upsert_key": "106100-1301-43",
      "source_exam_key": "106100-1301",
      "exam_code": "106100",
      "paper_code": "1301",
      "exam_year_roc": 106,
      "exam_year_gregorian": 2017,
      "exam_session": "第二次",
      "question_no": 43,
      "requested_group": "reported_missing_by_user",
      "action": "upsert_or_replace_by_upsert_key",
      "subject_group": "醫學（一）",
      "stem": "有關呼吸系統之組織發生病變，下列敘述何者錯誤？",
      "options": {
        "A": "囊腫性纖維化（cystic fibrosis）是一種好發於小孩與年輕人的遺傳性、慢性阻塞呼吸疾病",
        "B": "肺泡巨噬細胞（alveolar macrophage）可吞噬並分解結核桿菌（Mycobacterium tuberculosis）",
        "C": "終末支氣管（terminal bronchiole）之後的空氣間隙呈永久性擴張（permanent enlargement）會導致肺氣腫 （emphysema）",
        "D": "慢性支氣管炎（chronic bronchitis）或支氣管擴張（bronchiectasis）時，部分呼吸上皮會轉化為複層扁平上 皮（stratified squamous epithelium）"
      },
      "official_answer_raw": "A|B",
      "correct_answers": [
        "A",
        "B"
      ],
      "answer_credit_type": "multiple_answers",
      "answer_note": "第43題答A、B給分",
      "classification_v5": {
        "primary_subject_exact": "組織學",
        "topic_section": "呼吸系統",
        "subtopic": "呼吸道組織病變",
        "five_subject_bucket_if_app_requires": "組織學",
        "original_question_no_used": 43,
        "question_number_default_bucket": "組織學",
        "classification_method": "original_question_number_rule_checked_by_content",
        "confidence": "high",
        "legacy_non_five_subject": false,
        "original_classification": {
          "primary_subject": "組織學／呼吸系統",
          "topic_section": "呼吸病變組織",
          "track": "med1_remaining_completed_batch9",
          "classification_confidence": "medium",
          "method": "v4_batch9_rule_assisted_manual_review"
        },
        "notes": "已依題號與內容確認歸類。"
      },
      "explanation": "官方複數答案。囊腫性纖維化確為遺傳性慢性阻塞性肺病，B則錯在肺泡巨噬細胞吞噬結核桿菌後不一定能有效分解，結核菌可在巨噬細胞內存活。保留官方A|B並標記。",
      "option_analysis": {
        "A": "此選項為官方給分答案之一。其內容為「囊腫性纖維化（cystic fibrosis）是一種好發於小孩與年輕人的遺傳性、慢性阻塞呼吸疾病」，與本題核心考點相符或因官方複數答案而列為可給分。",
        "B": "此選項為官方給分答案之一。其內容為「肺泡巨噬細胞（alveolar macrophage）可吞噬並分解結核桿菌（Mycobacterium tuberculosis）」，與本題核心考點相符或因官方複數答案而列為可給分。",
        "C": "不選。此選項為「終末支氣管（terminal bronchiole）之後的空氣間隙呈永久性擴張（permanent enlargement）會導致肺氣腫 （emphysema）」，與題幹所問的核心考點不符，或屬於相近但不同的疾病、結構、機轉或統計概念。",
        "D": "不選。此選項為「慢性支氣管炎（chronic bronchitis）或支氣管擴張（bronchiectasis）時，部分呼吸上皮會轉化為複層扁平上 皮（stratified squamous epithelium）」，與題幹所問的核心考點不符，或屬於相近但不同的疾病、結構、機轉或統計概念。"
      },
      "exam_point": "呼吸系統病變與組織反應",
      "memory_tip": "TB可躲巨噬細胞；官方複數答案要保留。",
      "clinical_link": "組織切片判讀與病理變化定位常以此考點為基礎。",
      "review_flags": [
        "official_modified_or_multiple_credit",
        "official_multiple_answers",
        "needs_human_review",
        "official_answer_requires_review",
        "requested_supplement_patch",
        "reported_missing_by_user",
        "reported_missing_in_user_integrity_check",
        "official_answer_correction_or_multiple_credit"
      ],
      "source_files": {
        "extracted_from_detailed_file": "moex_med1_remaining_detailed_v4_merged_001_1827.json",
        "source_question_pdf": "106100_1301.pdf",
        "source_answer_pdf": "106100_MOD1301.pdf"
      }
    },
    {
      "id": "moex-med1-supplement-v5-107020-5301-027",
      "upsert_key": "107020-5301-27",
      "source_exam_key": "107020-5301",
      "exam_code": "107020",
      "paper_code": "5301",
      "exam_year_roc": 107,
      "exam_year_gregorian": 2018,
      "exam_session": "第一次",
      "question_no": 27,
      "requested_group": "reported_missing_by_user",
      "action": "upsert_or_replace_by_upsert_key",
      "subject_group": "醫學（一）",
      "stem": "下列何者不是內髂動脈（internal iliac artery）的分支？",
      "options": {
        "A": "臍動脈（umbilical artery）",
        "B": "正中薦動脈（median sacral）",
        "C": "臀上動脈（superior gluteal artery）",
        "D": "陰部動脈（pudenal artery）"
      },
      "official_answer_raw": "B|D",
      "correct_answers": [
        "B",
        "D"
      ],
      "answer_credit_type": "multiple_answers",
      "answer_note": "第27題答B、D給分",
      "classification_v5": {
        "primary_subject_exact": "解剖學",
        "topic_section": "骨盆",
        "subtopic": "內髂動脈",
        "five_subject_bucket_if_app_requires": "解剖學",
        "original_question_no_used": 27,
        "question_number_default_bucket": "解剖學",
        "classification_method": "original_question_number_rule_checked_by_content",
        "confidence": "high",
        "legacy_non_five_subject": false,
        "original_classification": {
          "primary_subject": "解剖學",
          "body_region": "骨盆與會陰",
          "topic_section": "骨盆血管",
          "anatomy_track": true,
          "classification_confidence": 0.78,
          "subject_confidence": 0.75,
          "region_confidence": 0.82,
          "method": "v2_rule_based_keyword_plus_known_manual_checks",
          "subject_scores": {
            "微生物免疫學/寄生蟲學": 0,
            "公共衛生學": 0,
            "生物化學": 1,
            "生理學": 0,
            "胚胎及發育生物學": 0,
            "組織學": 0,
            "解剖學": 3
          },
          "manual_note": ""
        },
        "notes": "已依題號與內容確認歸類。"
      },
      "explanation": "官方給B或D。正中薦動脈來自腹主動脈末端，不是內髂動脈分支。若D指外陰部/陰部外動脈，則其可來自股動脈而非內髂；若指內陰部動脈，則是內髂前支分支。題目中文『陰部動脈』不夠精確，因此複數給分。",
      "option_analysis": {
        "A": "不選。臍動脈（umbilical artery） 不是本題所問的最佳答案；請對照本題考點：internal iliac branches and ambiguous pudendal artery terminology。",
        "B": "正確。官方給B或D。正中薦動脈來自腹主動脈末端，不是內髂動脈分支。若D指外陰部/陰部外動脈，則其可來自股動脈而非內髂；若指內陰部動脈，則是內髂前支分支。題目中文『陰部動脈』不夠精確，因此複數給分。",
        "C": "不選。臀上動脈（superior gluteal artery） 不是本題所問的最佳答案；請對照本題考點：internal iliac branches and ambiguous pudendal artery terminology。",
        "D": "正確。官方給B或D。正中薦動脈來自腹主動脈末端，不是內髂動脈分支。若D指外陰部/陰部外動脈，則其可來自股動脈而非內髂；若指內陰部動脈，則是內髂前支分支。題目中文『陰部動脈』不夠精確，因此複數給分。"
      },
      "exam_point": "internal iliac branches and ambiguous pudendal artery terminology。",
      "memory_tip": "正中薦來自主動脈；內陰部才是內髂分支。",
      "clinical_link": "骨盆血管名稱需分清 internal vs external pudendal arteries。",
      "review_flags": [
        "official_modified_or_multiple_credit",
        "requested_supplement_patch",
        "reported_missing_by_user",
        "reported_missing_in_user_integrity_check",
        "official_answer_correction_or_multiple_credit"
      ],
      "source_files": {
        "extracted_from_detailed_file": "moex_anatomy_strict_detailed_v3_merged_001_973.json",
        "source_question_pdf": "107020_5301.pdf",
        "source_answer_pdf": "107020_MOD5301.pdf"
      }
    },
    {
      "id": "moex-med1-supplement-v5-107020-5301-062",
      "upsert_key": "107020-5301-62",
      "source_exam_key": "107020-5301",
      "exam_code": "107020",
      "paper_code": "5301",
      "exam_year_roc": 107,
      "exam_year_gregorian": 2018,
      "exam_session": "第一次",
      "question_no": 62,
      "requested_group": "reported_missing_by_user",
      "action": "upsert_or_replace_by_upsert_key",
      "subject_group": "醫學（一）",
      "stem": "有關肺臟的表面活性劑（surfactant）的敘述，下列何者正確？",
      "options": {
        "A": "由呼吸性細支氣管（respiratory bronchiole）所分泌",
        "B": "糖皮質素（glucocorticoid）會促進胎兒在出生前肺內表面活性劑的產生",
        "C": "其在小肺泡（alveolus）內的密度遠比大肺泡內低",
        "D": "能增加肺泡（alveolus）的彈性回復力（elastic recoil）"
      },
      "official_answer_raw": "A|B",
      "correct_answers": [
        "A",
        "B"
      ],
      "answer_credit_type": "multiple_answers",
      "answer_note": "第62題答A、B給分",
      "classification_v5": {
        "primary_subject_exact": "生理學",
        "topic_section": "呼吸生理",
        "subtopic": "surfactant",
        "five_subject_bucket_if_app_requires": "生理學",
        "original_question_no_used": 62,
        "question_number_default_bucket": "生理學",
        "classification_method": "original_question_number_rule_checked_by_content",
        "confidence": "high",
        "legacy_non_five_subject": false,
        "original_classification": {
          "primary_subject": "生理學",
          "topic_section": "生理學／肺表面活性劑",
          "track": "med1_remaining_completed_batch10",
          "classification_confidence": "medium",
          "previous_v2_primary_subject": "胚胎及發育生物學",
          "corrected_from_v2": true
        },
        "notes": "已依題號與內容確認歸類。"
      },
      "explanation": "官方複數答案為A、B；標準概念是表面活性劑主要由type II pneumocytes分泌，glucocorticoid促進胎肺成熟與surfactant生成；題目文字可能有爭議。",
      "option_analysis": {
        "A": "正確。A「由呼吸性細支氣管（respiratory bronchiole）所分泌」符合本題考點；核心理由：官方複數答案為A、B；標準概念是表面活性劑主要由type II pneumocytes分泌，glucocorticoid促進胎肺成熟與surfactant生成；題目文字可能有爭議。",
        "B": "正確。B「糖皮質素（glucocorticoid）會促進胎兒在出生前肺內表面活性劑的產生」符合本題考點；核心理由：官方複數答案為A、B；標準概念是表面活性劑主要由type II pneumocytes分泌，glucocorticoid促進胎肺成熟與surfactant生成；題目文字可能有爭議。",
        "C": "不選。C「其在小肺泡（alveolus）內的密度遠比大肺泡內低」與本題考點不符，或不是最直接、最典型的答案；請對照正確概念記憶。",
        "D": "不選。D「能增加肺泡（alveolus）的彈性回復力（elastic recoil）」與本題考點不符，或不是最直接、最典型的答案；請對照正確概念記憶。"
      },
      "exam_point": "surfactant來源與作用",
      "memory_tip": "surfactant降表面張力，保小肺泡",
      "clinical_link": "早產兒RDS與surfactant不足有關。",
      "review_flags": [
        "official_modified_or_multiple_credit",
        "multiple_official_answers",
        "needs_human_review",
        "requested_supplement_patch",
        "reported_missing_by_user",
        "reported_missing_in_user_integrity_check",
        "official_answer_correction_or_multiple_credit"
      ],
      "source_files": {
        "extracted_from_detailed_file": "moex_med1_remaining_detailed_v4_merged_001_1827.json",
        "source_question_pdf": "107020_5301.pdf",
        "source_answer_pdf": "107020_MOD5301.pdf"
      }
    },
    {
      "id": "moex-med1-supplement-v5-107020-5301-071",
      "upsert_key": "107020-5301-71",
      "source_exam_key": "107020-5301",
      "exam_code": "107020",
      "paper_code": "5301",
      "exam_year_roc": 107,
      "exam_year_gregorian": 2018,
      "exam_session": "第一次",
      "question_no": 71,
      "requested_group": "reported_missing_by_user",
      "action": "upsert_or_replace_by_upsert_key",
      "subject_group": "醫學（一）",
      "stem": "一位36歲女性，因近來常覺頭痛，測其血壓為180/110 mmHg，但身體其他部位並未發現明顯異常現象，腹 部電腦斷層掃描發現她右側腎上腺有一個2 cm的腫瘤，而血液中發現K+異常的低。下列何者在其血液中的濃 度最可能偏高？",
      "options": {
        "A": "ACTH",
        "B": "aldosterone",
        "C": "renin",
        "D": "catecholamine"
      },
      "official_answer_raw": "B|D",
      "correct_answers": [
        "B",
        "D"
      ],
      "answer_credit_type": "multiple_answers",
      "answer_note": "第71題答B、D給分",
      "classification_v5": {
        "primary_subject_exact": "生理學",
        "topic_section": "內分泌生理",
        "subtopic": "原發性醛固酮症",
        "five_subject_bucket_if_app_requires": "生理學",
        "original_question_no_used": 71,
        "question_number_default_bucket": "生理學",
        "classification_method": "original_question_number_rule_checked_by_content",
        "confidence": "high",
        "legacy_non_five_subject": false,
        "original_classification": {
          "primary_subject": "生理學",
          "topic_section": "生理學／腎上腺腫瘤高血壓",
          "track": "med1_remaining_completed_batch10",
          "classification_confidence": "medium",
          "previous_v2_primary_subject": "生理學",
          "corrected_from_v2": false
        },
        "notes": "已依題號與內容確認歸類。"
      },
      "explanation": "高血壓合併低血鉀與腎上腺腫瘤典型指向原發性醛固酮症，因此aldosterone升高；官方複數答案保留並標記。",
      "option_analysis": {
        "A": "不選。A「ACTH」與本題考點不符，或不是最直接、最典型的答案；請對照正確概念記憶。",
        "B": "正確。B「aldosterone」符合本題考點；核心理由：高血壓合併低血鉀與腎上腺腫瘤典型指向原發性醛固酮症，因此aldosterone升高；官方複數答案保留並標記。",
        "C": "不選。C「renin」與本題考點不符，或不是最直接、最典型的答案；請對照正確概念記憶。",
        "D": "正確。D「catecholamine」符合本題考點；核心理由：高血壓合併低血鉀與腎上腺腫瘤典型指向原發性醛固酮症，因此aldosterone升高；官方複數答案保留並標記。"
      },
      "exam_point": "原發性醛固酮症與低血鉀",
      "memory_tip": "高血壓低K先想aldosterone",
      "clinical_link": "Conn syndrome會抑制renin。",
      "review_flags": [
        "official_modified_or_multiple_credit",
        "multiple_official_answers",
        "needs_human_review",
        "requested_supplement_patch",
        "reported_missing_by_user",
        "reported_missing_in_user_integrity_check",
        "official_answer_correction_or_multiple_credit"
      ],
      "source_files": {
        "extracted_from_detailed_file": "moex_med1_remaining_detailed_v4_merged_001_1827.json",
        "source_question_pdf": "107020_5301.pdf",
        "source_answer_pdf": "107020_MOD5301.pdf"
      }
    },
    {
      "id": "moex-med1-supplement-v5-107100-1301-004",
      "upsert_key": "107100-1301-4",
      "source_exam_key": "107100-1301",
      "exam_code": "107100",
      "paper_code": "1301",
      "exam_year_roc": 107,
      "exam_year_gregorian": 2018,
      "exam_session": "第二次",
      "question_no": 4,
      "requested_group": "reported_missing_by_user",
      "action": "upsert_or_replace_by_upsert_key",
      "subject_group": "醫學（一）",
      "stem": "下列何者的收縮與張口動作最無關係？",
      "options": {
        "A": "內翼肌（medial pterygoid muscle）",
        "B": "外翼肌（lateral pterygoid muscle）",
        "C": "下頜舌骨肌（mylohyoid muscle）",
        "D": "頦舌肌（geniohyoid muscle）"
      },
      "official_answer_raw": "A|D",
      "correct_answers": [
        "A",
        "D"
      ],
      "answer_credit_type": "multiple_answers",
      "answer_note": "第4題答A、D給分",
      "classification_v5": {
        "primary_subject_exact": "解剖學",
        "topic_section": "頭頸部",
        "subtopic": "咀嚼肌",
        "five_subject_bucket_if_app_requires": "解剖學",
        "original_question_no_used": 4,
        "question_number_default_bucket": "解剖學",
        "classification_method": "original_question_number_rule_checked_by_content",
        "confidence": "high",
        "legacy_non_five_subject": false,
        "original_classification": {
          "primary_subject": "解剖學",
          "body_region": "頭頸部",
          "topic_section": "舌與味覺",
          "anatomy_track": true,
          "classification_confidence": 0.78,
          "subject_confidence": 0.75,
          "region_confidence": 0.82,
          "method": "v2_rule_based_keyword_plus_known_manual_checks",
          "subject_scores": {
            "微生物免疫學/寄生蟲學": 0,
            "公共衛生學": 0,
            "生物化學": 0,
            "生理學": 0,
            "胚胎及發育生物學": 0,
            "組織學": 0,
            "解剖學": 3
          },
          "manual_note": ""
        },
        "notes": "已依題號與內容確認歸類。"
      },
      "explanation": "官方採複數答案。內翼肌主要閉口與抬高下頷，與張口最無關；頦舌肌本身是舌肌，直接功能為伸舌，若題目嚴格問張口肌也可視為最不相關。外翼肌、下頷舌骨肌較能協助張口。 這題要抓的重點是：張口肌：外翼肌、下頷舌骨肌、二腹肌前腹等；內翼肌主要閉口。",
      "option_analysis": {
        "A": "正確／官方採計。張口肌：外翼肌、下頷舌骨肌、二腹肌前腹等；內翼肌主要閉口。",
        "B": "不選。外翼肌（lateral pterygoid muscle）與本題主要考點不符；本題重點是：張口肌：外翼肌、下頷舌骨肌、二腹肌前腹等；內翼肌主要閉口。",
        "C": "不選。下頜舌骨肌（mylohyoid muscle）與本題主要考點不符；本題重點是：張口肌：外翼肌、下頷舌骨肌、二腹肌前腹等；內翼肌主要閉口。",
        "D": "正確／官方採計。張口肌：外翼肌、下頷舌骨肌、二腹肌前腹等；內翼肌主要閉口。"
      },
      "exam_point": "張口肌：外翼肌、下頷舌骨肌、二腹肌前腹等；內翼肌主要閉口。",
      "memory_tip": "張口找外翼；閉口找內翼、咬肌、顳肌。",
      "clinical_link": "顳顎關節功能檢查會測張口與下頷偏斜。",
      "review_flags": [
        "official_modified_or_multiple_credit",
        "ambiguous_question",
        "requested_supplement_patch",
        "reported_missing_by_user",
        "reported_missing_in_user_integrity_check",
        "official_answer_correction_or_multiple_credit"
      ],
      "source_files": {
        "extracted_from_detailed_file": "moex_anatomy_strict_detailed_v3_merged_001_973.json",
        "source_question_pdf": "107100_1301.pdf",
        "source_answer_pdf": "107100_MOD1301.pdf"
      }
    },
    {
      "id": "moex-med1-supplement-v5-107100-1301-027",
      "upsert_key": "107100-1301-27",
      "source_exam_key": "107100-1301",
      "exam_code": "107100",
      "paper_code": "1301",
      "exam_year_roc": 107,
      "exam_year_gregorian": 2018,
      "exam_session": "第二次",
      "question_no": 27,
      "requested_group": "reported_missing_by_user",
      "action": "upsert_or_replace_by_upsert_key",
      "subject_group": "醫學（一）",
      "stem": "有關男女性生殖器官之配對，下列何者不是同源構造？",
      "options": {
        "A": "陰莖頭（glans of penis）- 陰蒂頭（glans of clitoris）",
        "B": "陰莖海綿球（bulb of corpus spongiosum）- 前庭球（vestibular bulb）",
        "C": "陰囊（scrotum）- 大陰唇（labia majora）",
        "D": "前列腺（prostate gland）- 前庭腺（vestibular gland）"
      },
      "official_answer_raw": "B|D",
      "correct_answers": [
        "B",
        "D"
      ],
      "answer_credit_type": "multiple_answers",
      "answer_note": "第27題答B、D給分",
      "classification_v5": {
        "primary_subject_exact": "胚胎及發育生物學",
        "topic_section": "生殖器官發生",
        "subtopic": "同源構造",
        "five_subject_bucket_if_app_requires": "胚胎及發育生物學",
        "original_question_no_used": 27,
        "question_number_default_bucket": "解剖學",
        "classification_method": "content_override",
        "confidence": "high",
        "legacy_non_five_subject": false,
        "original_classification": {
          "primary_subject": "解剖學",
          "body_region": "骨盆與會陰",
          "topic_section": "泌尿生殖",
          "anatomy_track": true,
          "classification_confidence": 0.78,
          "subject_confidence": 0.75,
          "region_confidence": 0.82,
          "method": "v2_rule_based_keyword_plus_known_manual_checks",
          "subject_scores": {
            "微生物免疫學/寄生蟲學": 0,
            "公共衛生學": 0,
            "生物化學": 0,
            "生理學": 0,
            "胚胎及發育生物學": 0,
            "組織學": 0,
            "解剖學": 0
          },
          "manual_note": ""
        },
        "notes": "已依題號與內容確認歸類。"
      },
      "explanation": "官方採複數答案。陰莖頭與陰蒂頭、陰莖海綿體相關構造與前庭球、陰囊與大陰唇均有胚胎同源性；前列腺與女性前列腺旁腺較相近，與前庭大腺並非典型同源，因此D可選。題目對B配對文字可能造成爭議，故官方採複數給分。 這題要抓的重點是：外生殖器同源構造：glans–glans、scrotum–labia majora、bulb/corpus spongiosum–vestibular bulbs。",
      "option_analysis": {
        "A": "不選。陰莖頭（glans of penis）- 陰蒂頭（glans of clitoris）與本題主要考點不符；本題重點是：外生殖器同源構造：glans–glans、scrotum–labia majora、bulb/corpus spongiosum–vestibular bulbs。",
        "B": "正確／官方採計。外生殖器同源構造：glans–glans、scrotum–labia majora、bulb/corpus spongiosum–vestibular bulbs。",
        "C": "不選。陰囊（scrotum）- 大陰唇（labia majora）與本題主要考點不符；本題重點是：外生殖器同源構造：glans–glans、scrotum–labia majora、bulb/corpus spongiosum–vestibular bulbs。",
        "D": "正確／官方採計。外生殖器同源構造：glans–glans、scrotum–labia majora、bulb/corpus spongiosum–vestibular bulbs。"
      },
      "exam_point": "外生殖器同源構造：glans–glans、scrotum–labia majora、bulb/corpus spongiosum–vestibular bulbs。",
      "memory_tip": "男女性外生殖器看同一胚胎原基。",
      "clinical_link": "性別分化異常題常考外生殖器同源。",
      "review_flags": [
        "official_modified_or_multiple_credit",
        "ambiguous_question",
        "requested_supplement_patch",
        "reported_missing_by_user",
        "question_number_subject_mismatch",
        "content_override_used",
        "reported_missing_in_user_integrity_check",
        "official_answer_correction_or_multiple_credit"
      ],
      "source_files": {
        "extracted_from_detailed_file": "moex_anatomy_strict_detailed_v3_merged_001_973.json",
        "source_question_pdf": "107100_1301.pdf",
        "source_answer_pdf": "107100_MOD1301.pdf"
      }
    },
    {
      "id": "moex-med1-supplement-v5-107100-1301-029",
      "upsert_key": "107100-1301-29",
      "source_exam_key": "107100-1301",
      "exam_code": "107100",
      "paper_code": "1301",
      "exam_year_roc": 107,
      "exam_year_gregorian": 2018,
      "exam_session": "第二次",
      "question_no": 29,
      "requested_group": "reported_missing_by_user",
      "action": "upsert_or_replace_by_upsert_key",
      "subject_group": "醫學（一）",
      "stem": "供應及支配下肢內收肌群（adductor muscles）的血管與神經，分別是：",
      "options": {
        "A": "閉孔動脈（obturator artery）與閉孔神經（obturator nerve）",
        "B": "閉孔動脈（obturator artery）與股神經（femoral nerve）",
        "C": "深股動脈（deep femoral artery）與閉孔神經（obturator nerve）",
        "D": "深股動脈（deep femoral artery）與股神經（femoral nerve）"
      },
      "official_answer_raw": "A|C",
      "correct_answers": [
        "A",
        "C"
      ],
      "answer_credit_type": "multiple_answers",
      "answer_note": "第29題答A、C給分",
      "classification_v5": {
        "primary_subject_exact": "解剖學",
        "topic_section": "下肢",
        "subtopic": "內收肌群血管神經",
        "five_subject_bucket_if_app_requires": "解剖學",
        "original_question_no_used": 29,
        "question_number_default_bucket": "解剖學",
        "classification_method": "original_question_number_rule_checked_by_content",
        "confidence": "high",
        "legacy_non_five_subject": false,
        "original_classification": {
          "primary_subject": "解剖學",
          "body_region": "骨盆與會陰",
          "topic_section": "骨盆血管",
          "anatomy_track": true,
          "classification_confidence": 0.78,
          "subject_confidence": 0.75,
          "region_confidence": 0.82,
          "method": "v2_rule_based_keyword_plus_known_manual_checks",
          "subject_scores": {
            "微生物免疫學/寄生蟲學": 0,
            "公共衛生學": 0,
            "生物化學": 0,
            "生理學": 0,
            "胚胎及發育生物學": 0,
            "組織學": 0,
            "解剖學": 9
          },
          "manual_note": ""
        },
        "notes": "已依題號與內容確認歸類。"
      },
      "explanation": "官方採複數答案。大腿內收肌群的主要神經是閉孔神經；血供可來自閉孔動脈，也常由深股動脈及其穿通支供應，因此A與C都可被接受。 這題要抓的重點是：內收肌：神經obturator；血供obturator/deep femoral均可。",
      "option_analysis": {
        "A": "正確／官方採計。內收肌：神經obturator；血供obturator/deep femoral均可。",
        "B": "不選。閉孔動脈（obturator artery）與股神經（femoral nerve）與本題主要考點不符；本題重點是：內收肌：神經obturator；血供obturator/deep femoral均可。",
        "C": "正確／官方採計。內收肌：神經obturator；血供obturator/deep femoral均可。",
        "D": "不選。深股動脈（deep femoral artery）與股神經（femoral nerve）與本題主要考點不符；本題重點是：內收肌：神經obturator；血供obturator/deep femoral均可。"
      },
      "exam_point": "內收肌：神經obturator；血供obturator/deep femoral均可。",
      "memory_tip": "內收靠閉孔神經，血可從閉孔或深股來。",
      "clinical_link": "閉孔神經損傷導致夾腿無力。",
      "review_flags": [
        "official_modified_or_multiple_credit",
        "requested_supplement_patch",
        "reported_missing_by_user",
        "reported_missing_in_user_integrity_check",
        "official_answer_correction_or_multiple_credit"
      ],
      "source_files": {
        "extracted_from_detailed_file": "moex_anatomy_strict_detailed_v3_merged_001_973.json",
        "source_question_pdf": "107100_1301.pdf",
        "source_answer_pdf": "107100_MOD1301.pdf"
      }
    },
    {
      "id": "moex-med1-supplement-v5-107100-1301-042",
      "upsert_key": "107100-1301-42",
      "source_exam_key": "107100-1301",
      "exam_code": "107100",
      "paper_code": "1301",
      "exam_year_roc": 107,
      "exam_year_gregorian": 2018,
      "exam_session": "第二次",
      "question_no": 42,
      "requested_group": "additional_requested_by_user",
      "action": "upsert_or_replace_by_upsert_key",
      "subject_group": "醫學（一）",
      "stem": "下列何者是膽囊所沒有的構造？",
      "options": {
        "A": "黏膜肌層（muscularis mucosa）",
        "B": "固有層（lamina propria）",
        "C": "外肌層（muscularis externa）",
        "D": "外膜（adventitia）"
      },
      "official_answer_raw": "A",
      "correct_answers": [
        "A"
      ],
      "answer_credit_type": "standard",
      "answer_note": "",
      "classification_v5": {
        "primary_subject_exact": "組織學",
        "topic_section": "消化系統",
        "subtopic": "膽囊組織",
        "five_subject_bucket_if_app_requires": "組織學",
        "original_question_no_used": 42,
        "question_number_default_bucket": "組織學",
        "classification_method": "original_question_number_rule_checked_by_content",
        "confidence": "high",
        "legacy_non_five_subject": false,
        "original_classification": {
          "primary_subject": "未分類",
          "topic_section": "未分類／需人工確認",
          "track": "med1_remaining_completed_batch11",
          "classification_confidence": "medium",
          "previous_v2_primary_subject": "組織學",
          "corrected_from_v2": true
        },
        "notes": "已依題號與內容確認歸類。"
      },
      "explanation": "膽囊黏膜沒有黏膜肌層與黏膜下層，具有皺襞、固有層與不規則平滑肌層。",
      "option_analysis": {
        "A": "正確。A「黏膜肌層（muscularis mucosa）」符合本題考點；核心理由：膽囊黏膜沒有黏膜肌層與黏膜下層，具有皺襞、固有層與不規則平滑肌層。",
        "B": "不選。B「固有層（lamina propria）」與本題核心概念不符，或屬於相近但不同的構造／機轉；請和正確選項對照記憶。",
        "C": "不選。C「外肌層（muscularis externa）」與本題核心概念不符，或屬於相近但不同的構造／機轉；請和正確選項對照記憶。",
        "D": "不選。D「外膜（adventitia）」與本題核心概念不符，或屬於相近但不同的構造／機轉；請和正確選項對照記憶。"
      },
      "exam_point": "膽囊組織特徵",
      "memory_tip": "膽囊少兩層：muscularis mucosa 與 submucosa。",
      "clinical_link": "可作為國考整合題的快速複習點；若題目涉及臨床情境，重點是把構造、機轉與症狀連起來。",
      "review_flags": [
        "requested_supplement_patch",
        "additional_requested_by_user",
        "additional_question_requested_by_user",
        "official_answer_correction_or_multiple_credit"
      ],
      "source_files": {
        "extracted_from_detailed_file": "moex_med1_remaining_detailed_v4_merged_001_1827.json",
        "source_question_pdf": "107100_1301.pdf",
        "source_answer_pdf": "107100_MOD1301.pdf"
      }
    },
    {
      "id": "moex-med1-supplement-v5-107100-1301-056",
      "upsert_key": "107100-1301-56",
      "source_exam_key": "107100-1301",
      "exam_code": "107100",
      "paper_code": "1301",
      "exam_year_roc": 107,
      "exam_year_gregorian": 2018,
      "exam_session": "第二次",
      "question_no": 56,
      "requested_group": "additional_requested_by_user",
      "action": "upsert_or_replace_by_upsert_key",
      "subject_group": "醫學（一）",
      "stem": "下列何者可直接促進血塊形成（clot formation）？",
      "options": {
        "A": "thrombin使fibrinogen→fibrin",
        "B": "plasminogen→plasmin",
        "C": "tissue factor活化factor XII",
        "D": "Ca2+和factor IXa活化factor V"
      },
      "official_answer_raw": "A",
      "correct_answers": [
        "A"
      ],
      "answer_credit_type": "standard",
      "answer_note": "",
      "classification_v5": {
        "primary_subject_exact": "生理學",
        "topic_section": "血液生理",
        "subtopic": "凝血",
        "five_subject_bucket_if_app_requires": "生理學",
        "original_question_no_used": 56,
        "question_number_default_bucket": "生理學",
        "classification_method": "original_question_number_rule_checked_by_content",
        "confidence": "high",
        "legacy_non_five_subject": false,
        "original_classification": {
          "primary_subject": "未分類",
          "topic_section": "未分類／需人工確認",
          "track": "med1_remaining_completed_batch11",
          "classification_confidence": "medium",
          "previous_v2_primary_subject": "未分類",
          "corrected_from_v2": true
        },
        "notes": "已依題號與內容確認歸類。"
      },
      "explanation": "thrombin將fibrinogen轉為fibrin，是凝血形成血塊的直接步驟。",
      "option_analysis": {
        "A": "正確。A「thrombin使fibrinogen→fibrin」符合本題考點；核心理由：thrombin將fibrinogen轉為fibrin，是凝血形成血塊的直接步驟。",
        "B": "不選。B「plasminogen→plasmin」與本題核心概念不符，或屬於相近但不同的構造／機轉；請和正確選項對照記憶。",
        "C": "不選。C「tissue factor活化factor XII」與本題核心概念不符，或屬於相近但不同的構造／機轉；請和正確選項對照記憶。",
        "D": "不選。D「Ca2+和factor IXa活化factor V」與本題核心概念不符，或屬於相近但不同的構造／機轉；請和正確選項對照記憶。"
      },
      "exam_point": "凝血級聯終末步驟",
      "memory_tip": "thrombin → fibrin 是血塊最後關鍵。",
      "clinical_link": "可作為國考整合題的快速複習點；若題目涉及臨床情境，重點是把構造、機轉與症狀連起來。",
      "review_flags": [
        "needs_manual_tag_review",
        "requested_supplement_patch",
        "additional_requested_by_user",
        "additional_question_requested_by_user",
        "official_answer_correction_or_multiple_credit"
      ],
      "source_files": {
        "extracted_from_detailed_file": "moex_med1_remaining_detailed_v4_merged_001_1827.json",
        "source_question_pdf": "107100_1301.pdf",
        "source_answer_pdf": "107100_MOD1301.pdf"
      }
    },
    {
      "id": "moex-med1-supplement-v5-107100-1301-062",
      "upsert_key": "107100-1301-62",
      "source_exam_key": "107100-1301",
      "exam_code": "107100",
      "paper_code": "1301",
      "exam_year_roc": 107,
      "exam_year_gregorian": 2018,
      "exam_session": "第二次",
      "question_no": 62,
      "requested_group": "additional_requested_by_user",
      "action": "upsert_or_replace_by_upsert_key",
      "subject_group": "醫學（一）",
      "stem": "下列何種過程最需要肺臟的參與？",
      "options": {
        "A": "釋出血清素（serotonin）進入血液中",
        "B": "活化舒緩激肽（bradykinin）",
        "C": "將血纖維蛋白原（fibrinogen）轉變為血纖維蛋白（fibrin）",
        "D": "將血管收縮素I（angiotension I）轉變為血管收縮素II（angiotension II）"
      },
      "official_answer_raw": "D",
      "correct_answers": [
        "D"
      ],
      "answer_credit_type": "standard",
      "answer_note": "",
      "classification_v5": {
        "primary_subject_exact": "生理學",
        "topic_section": "呼吸生理/酸鹼",
        "subtopic": "肺臟參與",
        "five_subject_bucket_if_app_requires": "生理學",
        "original_question_no_used": 62,
        "question_number_default_bucket": "生理學",
        "classification_method": "original_question_number_rule_checked_by_content",
        "confidence": "high",
        "legacy_non_five_subject": false,
        "original_classification": {
          "primary_subject": "未分類",
          "topic_section": "未分類／需人工確認",
          "track": "med1_remaining_completed_batch11",
          "classification_confidence": "medium",
          "previous_v2_primary_subject": "組織學",
          "corrected_from_v2": true
        },
        "notes": "已依題號與內容確認歸類。"
      },
      "explanation": "肺血管內皮含ACE，可將angiotensin I轉為angiotensin II。",
      "option_analysis": {
        "A": "不選。A「釋出血清素（serotonin）進入血液中」與本題核心概念不符，或屬於相近但不同的構造／機轉；請和正確選項對照記憶。",
        "B": "不選。B「活化舒緩激肽（bradykinin）」與本題核心概念不符，或屬於相近但不同的構造／機轉；請和正確選項對照記憶。",
        "C": "不選。C「將血纖維蛋白原（fibrinogen）轉變為血纖維蛋白（fibrin）」與本題核心概念不符，或屬於相近但不同的構造／機轉；請和正確選項對照記憶。",
        "D": "正確。D「將血管收縮素I（angiotension I）轉變為血管收縮素II（angiotension II）」符合本題考點；核心理由：肺血管內皮含ACE，可將angiotensin I轉為angiotensin II。"
      },
      "exam_point": "肺臟非呼吸功能：ACE",
      "memory_tip": "肺是Ang I變Ang II的重要場所。",
      "clinical_link": "可作為國考整合題的快速複習點；若題目涉及臨床情境，重點是把構造、機轉與症狀連起來。",
      "review_flags": [
        "requested_supplement_patch",
        "additional_requested_by_user",
        "additional_question_requested_by_user",
        "official_answer_correction_or_multiple_credit"
      ],
      "source_files": {
        "extracted_from_detailed_file": "moex_med1_remaining_detailed_v4_merged_001_1827.json",
        "source_question_pdf": "107100_1301.pdf",
        "source_answer_pdf": "107100_MOD1301.pdf"
      }
    },
    {
      "id": "moex-med1-supplement-v5-107100-1301-064",
      "upsert_key": "107100-1301-64",
      "source_exam_key": "107100-1301",
      "exam_code": "107100",
      "paper_code": "1301",
      "exam_year_roc": 107,
      "exam_year_gregorian": 2018,
      "exam_session": "第二次",
      "question_no": 64,
      "requested_group": "reported_missing_by_user",
      "action": "upsert_or_replace_by_upsert_key",
      "subject_group": "醫學（一）",
      "stem": "下列那種膽汁成分之相對比例，最易導致膽結石的產生？",
      "options": {
        "A": "膽鹽30%、卵磷脂60%、膽固醇10%",
        "B": "膽鹽40%、卵磷脂55%、膽固醇5%",
        "C": "膽鹽80%、卵磷脂10%、膽固醇10%",
        "D": "膽鹽60%、卵磷脂25%、膽固醇15%"
      },
      "official_answer_raw": "ALL",
      "correct_answers": [
        "ALL"
      ],
      "answer_credit_type": "all_credit",
      "answer_note": "第64題一律給分",
      "classification_v5": {
        "primary_subject_exact": "生理學",
        "topic_section": "消化生理",
        "subtopic": "膽汁與膽結石",
        "five_subject_bucket_if_app_requires": "生理學",
        "original_question_no_used": 64,
        "question_number_default_bucket": "生理學",
        "classification_method": "original_question_number_rule_checked_by_content",
        "confidence": "high",
        "legacy_non_five_subject": false,
        "original_classification": {
          "primary_subject": "解剖學",
          "body_region": "腹部",
          "topic_section": "肝膽胰脾",
          "anatomy_track": true,
          "classification_confidence": 0.78,
          "subject_confidence": 0.75,
          "region_confidence": 0.82,
          "method": "v2_rule_based_keyword_plus_known_manual_checks",
          "subject_scores": {
            "微生物免疫學/寄生蟲學": 0,
            "公共衛生學": 0,
            "生物化學": 0,
            "生理學": 0,
            "胚胎及發育生物學": 0,
            "組織學": 0,
            "解剖學": 0
          },
          "manual_note": ""
        },
        "notes": "已依題號與內容確認歸類。"
      },
      "explanation": "此題官方給予一律給分。一般而言膽固醇比例增加、膽鹽與卵磷脂不足會促進膽固醇結石形成；但原題選項比例設計有爭議，因此官方採全部給分。 這題要抓的重點是：膽固醇結石風險：cholesterol相對高、bile salts/lecithin相對低。",
      "option_analysis": {
        "A": "正確／官方採計。膽固醇結石風險：cholesterol相對高、bile salts/lecithin相對低。",
        "B": "正確／官方採計。膽固醇結石風險：cholesterol相對高、bile salts/lecithin相對低。",
        "C": "正確／官方採計。膽固醇結石風險：cholesterol相對高、bile salts/lecithin相對低。",
        "D": "正確／官方採計。膽固醇結石風險：cholesterol相對高、bile salts/lecithin相對低。"
      },
      "exam_point": "膽固醇結石風險：cholesterol相對高、bile salts/lecithin相對低。",
      "memory_tip": "膽固醇太多、膽鹽卵磷脂太少就結石。",
      "clinical_link": "膽結石常與女性、肥胖、懷孕與快速減重相關。",
      "review_flags": [
        "official_modified_or_multiple_credit",
        "ambiguous_question",
        "not_strict_anatomy_misclassified",
        "requested_supplement_patch",
        "reported_missing_by_user",
        "reported_missing_in_user_integrity_check",
        "official_answer_correction_or_multiple_credit"
      ],
      "source_files": {
        "extracted_from_detailed_file": "moex_anatomy_strict_detailed_v3_merged_001_973.json",
        "source_question_pdf": "107100_1301.pdf",
        "source_answer_pdf": "107100_MOD1301.pdf"
      }
    },
    {
      "id": "moex-med1-supplement-v5-107100-1301-065",
      "upsert_key": "107100-1301-65",
      "source_exam_key": "107100-1301",
      "exam_code": "107100",
      "paper_code": "1301",
      "exam_year_roc": 107,
      "exam_year_gregorian": 2018,
      "exam_session": "第二次",
      "question_no": 65,
      "requested_group": "additional_requested_by_user",
      "action": "upsert_or_replace_by_upsert_key",
      "subject_group": "醫學（一）",
      "stem": "某病患主訴最近常覺得口渴，身體檢查時發現其呼吸有acetone的果香味、空腹血糖值高達380 mg/dL。相對 於正常人，該病患尿液不會有下列何者變化？",
      "options": {
        "A": "尿液的pH值較正常人低",
        "B": "尿液之NH +排出量較正常人多 4",
        "C": "24小時之尿液排出量較正常人多",
        "D": "尿液之HCO - 排出量較正常人多 3"
      },
      "official_answer_raw": "D",
      "correct_answers": [
        "D"
      ],
      "answer_credit_type": "standard",
      "answer_note": "",
      "classification_v5": {
        "primary_subject_exact": "生理學",
        "topic_section": "內分泌/腎臟生理",
        "subtopic": "糖尿病酮酸中毒",
        "five_subject_bucket_if_app_requires": "生理學",
        "original_question_no_used": 65,
        "question_number_default_bucket": "生理學",
        "classification_method": "original_question_number_rule_checked_by_content",
        "confidence": "high",
        "legacy_non_five_subject": false,
        "original_classification": {
          "primary_subject": "未分類",
          "topic_section": "未分類／需人工確認",
          "track": "med1_remaining_completed_batch11",
          "classification_confidence": "medium",
          "previous_v2_primary_subject": "生理學",
          "corrected_from_v2": true
        },
        "notes": "已依題號與內容確認歸類。"
      },
      "explanation": "糖尿病酮酸中毒尿液偏酸、NH4+排出增加且因滲透性利尿尿量上升；HCO3-被消耗並不會增加排出。",
      "option_analysis": {
        "A": "不選。A「尿液的pH值較正常人低」與本題核心概念不符，或屬於相近但不同的構造／機轉；請和正確選項對照記憶。",
        "B": "不選。B「尿液之NH +排出量較正常人多 4」與本題核心概念不符，或屬於相近但不同的構造／機轉；請和正確選項對照記憶。",
        "C": "不選。C「24小時之尿液排出量較正常人多」與本題核心概念不符，或屬於相近但不同的構造／機轉；請和正確選項對照記憶。",
        "D": "正確。D「尿液之HCO - 排出量較正常人多 3」符合本題考點；核心理由：糖尿病酮酸中毒尿液偏酸、NH4+排出增加且因滲透性利尿尿量上升；HCO3-被消耗並不會增加排出。"
      },
      "exam_point": "酮酸中毒與腎臟代償",
      "memory_tip": "酸中毒保HCO3-、排NH4+。",
      "clinical_link": "可作為國考整合題的快速複習點；若題目涉及臨床情境，重點是把構造、機轉與症狀連起來。",
      "review_flags": [
        "requested_supplement_patch",
        "additional_requested_by_user",
        "additional_question_requested_by_user",
        "official_answer_correction_or_multiple_credit"
      ],
      "source_files": {
        "extracted_from_detailed_file": "moex_med1_remaining_detailed_v4_merged_001_1827.json",
        "source_question_pdf": "107100_1301.pdf",
        "source_answer_pdf": "107100_MOD1301.pdf"
      }
    },
    {
      "id": "moex-med1-supplement-v5-107100-1301-068",
      "upsert_key": "107100-1301-68",
      "source_exam_key": "107100-1301",
      "exam_code": "107100",
      "paper_code": "1301",
      "exam_year_roc": 107,
      "exam_year_gregorian": 2018,
      "exam_session": "第二次",
      "question_no": 68,
      "requested_group": "additional_requested_by_user",
      "action": "upsert_or_replace_by_upsert_key",
      "subject_group": "醫學（一）",
      "stem": "酮酸中毒患者體內酮體（ketone body）是由下列那些物質構成？①乙醯乙酸（acetoacetate） ②β-羥丁酸 （β-hydroxybutyrate） ③丙酮（acetone） ④α-酮戊二酸（α-ketoglutarate）",
      "options": {
        "A": "①②③④",
        "B": "僅①②④",
        "C": "僅①②③",
        "D": "僅③④"
      },
      "official_answer_raw": "C",
      "correct_answers": [
        "C"
      ],
      "answer_credit_type": "standard",
      "answer_note": "",
      "classification_v5": {
        "primary_subject_exact": "生物化學",
        "topic_section": "脂質代謝",
        "subtopic": "ketone bodies",
        "five_subject_bucket_if_app_requires": "生物化學",
        "original_question_no_used": 68,
        "question_number_default_bucket": "生理學",
        "classification_method": "content_override",
        "confidence": "high",
        "legacy_non_five_subject": false,
        "original_classification": {
          "primary_subject": "未分類",
          "topic_section": "未分類／需人工確認",
          "track": "med1_remaining_completed_batch11",
          "classification_confidence": "medium",
          "previous_v2_primary_subject": "生物化學",
          "corrected_from_v2": true
        },
        "notes": "已依題號與內容確認歸類。"
      },
      "explanation": "酮體包括acetoacetate、β-hydroxybutyrate與acetone，不包括α-ketoglutarate。",
      "option_analysis": {
        "A": "不選。A「①②③④」與本題核心概念不符，或屬於相近但不同的構造／機轉；請和正確選項對照記憶。",
        "B": "不選。B「僅①②④」與本題核心概念不符，或屬於相近但不同的構造／機轉；請和正確選項對照記憶。",
        "C": "正確。C「僅①②③」符合本題考點；核心理由：酮體包括acetoacetate、β-hydroxybutyrate與acetone，不包括α-ketoglutarate。",
        "D": "不選。D「僅③④」與本題核心概念不符，或屬於相近但不同的構造／機轉；請和正確選項對照記憶。"
      },
      "exam_point": "酮體組成",
      "memory_tip": "三酮體：AcAc、BHB、acetone。",
      "clinical_link": "可作為國考整合題的快速複習點；若題目涉及臨床情境，重點是把構造、機轉與症狀連起來。",
      "review_flags": [
        "requested_supplement_patch",
        "additional_requested_by_user",
        "question_number_subject_mismatch",
        "content_override_used",
        "additional_question_requested_by_user",
        "official_answer_correction_or_multiple_credit"
      ],
      "source_files": {
        "extracted_from_detailed_file": "moex_med1_remaining_detailed_v4_merged_001_1827.json",
        "source_question_pdf": "107100_1301.pdf",
        "source_answer_pdf": "107100_MOD1301.pdf"
      }
    },
    {
      "id": "moex-med1-supplement-v5-107100-1301-073",
      "upsert_key": "107100-1301-73",
      "source_exam_key": "107100-1301",
      "exam_code": "107100",
      "paper_code": "1301",
      "exam_year_roc": 107,
      "exam_year_gregorian": 2018,
      "exam_session": "第二次",
      "question_no": 73,
      "requested_group": "reported_missing_by_user",
      "action": "upsert_or_replace_by_upsert_key",
      "subject_group": "醫學（一）",
      "stem": "濾泡促素（FSH）主要是由睪丸塞托萊氏細胞（Sertoli cells）所分泌的何種激素調控？",
      "options": {
        "A": "抑制素（inhibin）",
        "B": "雌激素（estrogen）",
        "C": "睪固酮（testosterone）",
        "D": "助孕酮（progesterone）"
      },
      "official_answer_raw": "A|B",
      "correct_answers": [
        "A",
        "B"
      ],
      "answer_credit_type": "multiple_answers",
      "answer_note": "第 73題答A、B給分",
      "classification_v5": {
        "primary_subject_exact": "生理學",
        "topic_section": "生殖內分泌",
        "subtopic": "FSH/inhibin",
        "five_subject_bucket_if_app_requires": "生理學",
        "original_question_no_used": 73,
        "question_number_default_bucket": "生理學",
        "classification_method": "original_question_number_rule_checked_by_content",
        "confidence": "high",
        "legacy_non_five_subject": false,
        "original_classification": {
          "primary_subject": "組織學",
          "topic_section": "組織學／器官與細胞結構",
          "track": "med1_remaining_completed_batch11",
          "classification_confidence": "high",
          "previous_v2_primary_subject": "生理學",
          "corrected_from_v2": true
        },
        "notes": "已依題號與內容確認歸類。"
      },
      "explanation": "FSH主要受Sertoli細胞分泌inhibin負回饋；官方複數答案保留，雌激素也可參與調節但不是最典型答案。",
      "option_analysis": {
        "A": "正確。A「抑制素（inhibin）」符合本題考點；核心理由：FSH主要受Sertoli細胞分泌inhibin負回饋；官方複數答案保留，雌激素也可參與調節但不是最典型答案。",
        "B": "正確。B「雌激素（estrogen）」符合本題考點；核心理由：FSH主要受Sertoli細胞分泌inhibin負回饋；官方複數答案保留，雌激素也可參與調節但不是最典型答案。",
        "C": "不選。C「睪固酮（testosterone）」與本題核心概念不符，或屬於相近但不同的構造／機轉；請和正確選項對照記憶。",
        "D": "不選。D「助孕酮（progesterone）」與本題核心概念不符，或屬於相近但不同的構造／機轉；請和正確選項對照記憶。"
      },
      "exam_point": "男性性腺軸與FSH回饋",
      "memory_tip": "FSH對應inhibin。",
      "clinical_link": "可作為國考整合題的快速複習點；若題目涉及臨床情境，重點是把構造、機轉與症狀連起來。",
      "review_flags": [
        "official_modified_or_multiple_credit",
        "official_answer_special_handling",
        "requested_supplement_patch",
        "reported_missing_by_user",
        "reported_missing_in_user_integrity_check",
        "official_answer_correction_or_multiple_credit"
      ],
      "source_files": {
        "extracted_from_detailed_file": "moex_med1_remaining_detailed_v4_merged_001_1827.json",
        "source_question_pdf": "107100_1301.pdf",
        "source_answer_pdf": "107100_MOD1301.pdf"
      }
    },
    {
      "id": "moex-med1-supplement-v5-107100-1301-077",
      "upsert_key": "107100-1301-77",
      "source_exam_key": "107100-1301",
      "exam_code": "107100",
      "paper_code": "1301",
      "exam_year_roc": 107,
      "exam_year_gregorian": 2018,
      "exam_session": "第二次",
      "question_no": 77,
      "requested_group": "additional_requested_by_user",
      "action": "upsert_or_replace_by_upsert_key",
      "subject_group": "醫學（一）",
      "stem": "乙醯輔酶A（acetyl coenzyme A）分子中，乙醯基與coenzyme A之鍵結為：",
      "options": {
        "A": "amide",
        "B": "Schiff 's base",
        "C": "acid anhydride",
        "D": "thioester"
      },
      "official_answer_raw": "D",
      "correct_answers": [
        "D"
      ],
      "answer_credit_type": "standard",
      "answer_note": "",
      "classification_v5": {
        "primary_subject_exact": "生物化學",
        "topic_section": "代謝中間物",
        "subtopic": "thioester bond",
        "five_subject_bucket_if_app_requires": "生物化學",
        "original_question_no_used": 77,
        "question_number_default_bucket": "生物化學",
        "classification_method": "original_question_number_rule_checked_by_content",
        "confidence": "high",
        "legacy_non_five_subject": false,
        "original_classification": {
          "primary_subject": "未分類",
          "topic_section": "未分類／需人工確認",
          "track": "med1_remaining_completed_batch11",
          "classification_confidence": "medium",
          "previous_v2_primary_subject": "生物化學",
          "corrected_from_v2": true
        },
        "notes": "已依題號與內容確認歸類。"
      },
      "explanation": "Acetyl-CoA的乙醯基以高能量硫酯鍵(thioester)連到CoA。",
      "option_analysis": {
        "A": "不選。A「amide」與本題核心概念不符，或屬於相近但不同的構造／機轉；請和正確選項對照記憶。",
        "B": "不選。B「Schiff 's base」與本題核心概念不符，或屬於相近但不同的構造／機轉；請和正確選項對照記憶。",
        "C": "不選。C「acid anhydride」與本題核心概念不符，或屬於相近但不同的構造／機轉；請和正確選項對照記憶。",
        "D": "正確。D「thioester」符合本題考點；核心理由：Acetyl-CoA的乙醯基以高能量硫酯鍵(thioester)連到CoA。"
      },
      "exam_point": "Acetyl-CoA鍵結型態",
      "memory_tip": "CoA帶S，所以thioester。",
      "clinical_link": "可作為國考整合題的快速複習點；若題目涉及臨床情境，重點是把構造、機轉與症狀連起來。",
      "review_flags": [
        "requested_supplement_patch",
        "additional_requested_by_user",
        "additional_question_requested_by_user",
        "official_answer_correction_or_multiple_credit"
      ],
      "source_files": {
        "extracted_from_detailed_file": "moex_med1_remaining_detailed_v4_merged_001_1827.json",
        "source_question_pdf": "107100_1301.pdf",
        "source_answer_pdf": "107100_MOD1301.pdf"
      }
    },
    {
      "id": "moex-med1-supplement-v5-107100-1301-084",
      "upsert_key": "107100-1301-84",
      "source_exam_key": "107100-1301",
      "exam_code": "107100",
      "paper_code": "1301",
      "exam_year_roc": 107,
      "exam_year_gregorian": 2018,
      "exam_session": "第二次",
      "question_no": 84,
      "requested_group": "additional_requested_by_user",
      "action": "upsert_or_replace_by_upsert_key",
      "subject_group": "醫學（一）",
      "stem": "在網狀紅血球（reticulocytes）缺乏鐵時會抑制血紅素（hemoglobin）之合成，其作用機轉主要是：",
      "options": {
        "A": "對cAMP responsive element binding protein（CREBP）進行磷酸化",
        "B": "對steroid responsive element binding protein（SREBP）進行磷酸化",
        "C": "對真核起始因子2（eIF2）進行磷酸化",
        "D": "對真核起始因子4E（eIF4E）進行磷酸化"
      },
      "official_answer_raw": "C",
      "correct_answers": [
        "C"
      ],
      "answer_credit_type": "standard",
      "answer_note": "",
      "classification_v5": {
        "primary_subject_exact": "生物化學",
        "topic_section": "蛋白質合成調控",
        "subtopic": "iron response",
        "five_subject_bucket_if_app_requires": "生物化學",
        "original_question_no_used": 84,
        "question_number_default_bucket": "生物化學",
        "classification_method": "original_question_number_rule_checked_by_content",
        "confidence": "high",
        "legacy_non_five_subject": false,
        "original_classification": {
          "primary_subject": "未分類",
          "topic_section": "未分類／需人工確認",
          "track": "med1_remaining_completed_batch11",
          "classification_confidence": "medium",
          "previous_v2_primary_subject": "組織學",
          "corrected_from_v2": true
        },
        "notes": "已依題號與內容確認歸類。"
      },
      "explanation": "缺鐵會活化heme-regulated inhibitor，使eIF2磷酸化，抑制globin translation。",
      "option_analysis": {
        "A": "不選。A「對cAMP responsive element binding protein（CREBP）進行磷酸化」與本題核心概念不符，或屬於相近但不同的構造／機轉；請和正確選項對照記憶。",
        "B": "不選。B「對steroid responsive element binding protein（SREBP）進行磷酸化」與本題核心概念不符，或屬於相近但不同的構造／機轉；請和正確選項對照記憶。",
        "C": "正確。C「對真核起始因子2（eIF2）進行磷酸化」符合本題考點；核心理由：缺鐵會活化heme-regulated inhibitor，使eIF2磷酸化，抑制globin translation。",
        "D": "不選。D「對真核起始因子4E（eIF4E）進行磷酸化」與本題核心概念不符，或屬於相近但不同的構造／機轉；請和正確選項對照記憶。"
      },
      "exam_point": "血紅素合成與eIF2調控",
      "memory_tip": "缺heme → eIF2-P → 翻譯停。",
      "clinical_link": "可作為國考整合題的快速複習點；若題目涉及臨床情境，重點是把構造、機轉與症狀連起來。",
      "review_flags": [
        "requested_supplement_patch",
        "additional_requested_by_user",
        "additional_question_requested_by_user",
        "official_answer_correction_or_multiple_credit"
      ],
      "source_files": {
        "extracted_from_detailed_file": "moex_med1_remaining_detailed_v4_merged_001_1827.json",
        "source_question_pdf": "107100_1301.pdf",
        "source_answer_pdf": "107100_MOD1301.pdf"
      }
    },
    {
      "id": "moex-med1-supplement-v5-107100-1301-088",
      "upsert_key": "107100-1301-88",
      "source_exam_key": "107100-1301",
      "exam_code": "107100",
      "paper_code": "1301",
      "exam_year_roc": 107,
      "exam_year_gregorian": 2018,
      "exam_session": "第二次",
      "question_no": 88,
      "requested_group": "additional_requested_by_user",
      "action": "upsert_or_replace_by_upsert_key",
      "subject_group": "醫學（一）",
      "stem": "下列醣類分子均為葡萄糖聚合物，何者具有（β1→4）glycosidic bond？",
      "options": {
        "A": "amylose",
        "B": "glycogen",
        "C": "cellulose",
        "D": "dextran"
      },
      "official_answer_raw": "C",
      "correct_answers": [
        "C"
      ],
      "answer_credit_type": "standard",
      "answer_note": "",
      "classification_v5": {
        "primary_subject_exact": "生物化學",
        "topic_section": "醣類化學",
        "subtopic": "β1→4 glycosidic bond",
        "five_subject_bucket_if_app_requires": "生物化學",
        "original_question_no_used": 88,
        "question_number_default_bucket": "生物化學",
        "classification_method": "original_question_number_rule_checked_by_content",
        "confidence": "high",
        "legacy_non_five_subject": false,
        "original_classification": {
          "primary_subject": "未分類",
          "topic_section": "未分類／需人工確認",
          "track": "med1_remaining_completed_batch11",
          "classification_confidence": "medium",
          "previous_v2_primary_subject": "生物化學",
          "corrected_from_v2": true
        },
        "notes": "已依題號與內容確認歸類。"
      },
      "explanation": "cellulose由葡萄糖以β1→4鍵連接；amylose/glycogen主要是α鍵。",
      "option_analysis": {
        "A": "不選。A「amylose」與本題核心概念不符，或屬於相近但不同的構造／機轉；請和正確選項對照記憶。",
        "B": "不選。B「glycogen」與本題核心概念不符，或屬於相近但不同的構造／機轉；請和正確選項對照記憶。",
        "C": "正確。C「cellulose」符合本題考點；核心理由：cellulose由葡萄糖以β1→4鍵連接；amylose/glycogen主要是α鍵。",
        "D": "不選。D「dextran」與本題核心概念不符，或屬於相近但不同的構造／機轉；請和正確選項對照記憶。"
      },
      "exam_point": "多醣鍵結型態",
      "memory_tip": "β1→4 = cellulose。",
      "clinical_link": "可作為國考整合題的快速複習點；若題目涉及臨床情境，重點是把構造、機轉與症狀連起來。",
      "review_flags": [
        "requested_supplement_patch",
        "additional_requested_by_user",
        "additional_question_requested_by_user",
        "official_answer_correction_or_multiple_credit"
      ],
      "source_files": {
        "extracted_from_detailed_file": "moex_med1_remaining_detailed_v4_merged_001_1827.json",
        "source_question_pdf": "107100_1301.pdf",
        "source_answer_pdf": "107100_MOD1301.pdf"
      }
    },
    {
      "id": "moex-med1-supplement-v5-107100-1301-092",
      "upsert_key": "107100-1301-92",
      "source_exam_key": "107100-1301",
      "exam_code": "107100",
      "paper_code": "1301",
      "exam_year_roc": 107,
      "exam_year_gregorian": 2018,
      "exam_session": "第二次",
      "question_no": 92,
      "requested_group": "additional_requested_by_user",
      "action": "upsert_or_replace_by_upsert_key",
      "subject_group": "醫學（一）",
      "stem": "下列何者不是血小板活化因子（platelet activating factor）的特性？",
      "options": {
        "A": "它是一種醚甘油磷酯（ether glycerophospholipid）",
        "B": "其結構含有一個烷基（alkyl group）以醚鏈（ether linkage）鍵結在甘油的C1位置",
        "C": "其結構含有一個醋酸鹽基（acetate group）以酯鏈（ester linkage）鍵結在甘油的C2位置",
        "D": "它比縮醛磷脂（plasmalogen）更不易溶於水"
      },
      "official_answer_raw": "D",
      "correct_answers": [
        "D"
      ],
      "answer_credit_type": "standard",
      "answer_note": "",
      "classification_v5": {
        "primary_subject_exact": "生物化學",
        "topic_section": "脂質媒介物",
        "subtopic": "platelet activating factor",
        "five_subject_bucket_if_app_requires": "生物化學",
        "original_question_no_used": 92,
        "question_number_default_bucket": "生物化學",
        "classification_method": "original_question_number_rule_checked_by_content",
        "confidence": "high",
        "legacy_non_five_subject": false,
        "original_classification": {
          "primary_subject": "未分類",
          "topic_section": "未分類／需人工確認",
          "track": "med1_remaining_completed_batch11",
          "classification_confidence": "medium",
          "previous_v2_primary_subject": "組織學",
          "corrected_from_v2": true
        },
        "notes": "已依題號與內容確認歸類。"
      },
      "explanation": "PAF是較水溶性的醚甘油磷脂，含C1醚鏈與C2乙醯基；題目問不是特性。",
      "option_analysis": {
        "A": "不選。A「它是一種醚甘油磷酯（ether glycerophospholipid）」與本題核心概念不符，或屬於相近但不同的構造／機轉；請和正確選項對照記憶。",
        "B": "不選。B「其結構含有一個烷基（alkyl group）以醚鏈（ether linkage）鍵結在甘油的C1位置」與本題核心概念不符，或屬於相近但不同的構造／機轉；請和正確選項對照記憶。",
        "C": "不選。C「其結構含有一個醋酸鹽基（acetate group）以酯鏈（ester linkage）鍵結在甘油的C2位置」與本題核心概念不符，或屬於相近但不同的構造／機轉；請和正確選項對照記憶。",
        "D": "正確。D「它比縮醛磷脂（plasmalogen）更不易溶於水」符合本題考點；核心理由：PAF是較水溶性的醚甘油磷脂，含C1醚鏈與C2乙醯基；題目問不是特性。"
      },
      "exam_point": "PAF結構特性",
      "memory_tip": "PAF = platelet activating ether lipid。",
      "clinical_link": "可作為國考整合題的快速複習點；若題目涉及臨床情境，重點是把構造、機轉與症狀連起來。",
      "review_flags": [
        "requested_supplement_patch",
        "additional_requested_by_user",
        "additional_question_requested_by_user",
        "official_answer_correction_or_multiple_credit"
      ],
      "source_files": {
        "extracted_from_detailed_file": "moex_med1_remaining_detailed_v4_merged_001_1827.json",
        "source_question_pdf": "107100_1301.pdf",
        "source_answer_pdf": "107100_MOD1301.pdf"
      }
    },
    {
      "id": "moex-med1-supplement-v5-107100-1301-098",
      "upsert_key": "107100-1301-98",
      "source_exam_key": "107100-1301",
      "exam_code": "107100",
      "paper_code": "1301",
      "exam_year_roc": 107,
      "exam_year_gregorian": 2018,
      "exam_session": "第二次",
      "question_no": 98,
      "requested_group": "additional_requested_by_user",
      "action": "upsert_or_replace_by_upsert_key",
      "subject_group": "醫學（一）",
      "stem": "關於介白素（interleukins）之訊息傳遞何者正確？",
      "options": {
        "A": "其受體主要是絲胺酸激酶型受器（receptor serine kinase）",
        "B": "活化轉錄因子STATs（signal transducers and activators of transcription）",
        "C": "主要是活化cAMP",
        "D": "主要由G protein參與反應"
      },
      "official_answer_raw": "B",
      "correct_answers": [
        "B"
      ],
      "answer_credit_type": "standard",
      "answer_note": "",
      "classification_v5": {
        "primary_subject_exact": "生物化學/免疫訊息傳遞",
        "topic_section": "細胞訊號",
        "subtopic": "interleukin signaling",
        "five_subject_bucket_if_app_requires": "生物化學",
        "original_question_no_used": 98,
        "question_number_default_bucket": "生物化學",
        "classification_method": "original_question_number_rule_checked_by_content",
        "confidence": "high",
        "legacy_non_five_subject": false,
        "original_classification": {
          "primary_subject": "未分類",
          "topic_section": "未分類／需人工確認",
          "track": "med1_remaining_completed_batch11",
          "classification_confidence": "medium",
          "previous_v2_primary_subject": "生理學",
          "corrected_from_v2": true
        },
        "notes": "已依題號與內容確認歸類。"
      },
      "explanation": "多數interleukin受體透過JAK-STAT路徑，活化STAT轉錄因子。",
      "option_analysis": {
        "A": "不選。A「其受體主要是絲胺酸激酶型受器（receptor serine kinase）」與本題核心概念不符，或屬於相近但不同的構造／機轉；請和正確選項對照記憶。",
        "B": "正確。B「活化轉錄因子STATs（signal transducers and activators of transcription）」符合本題考點；核心理由：多數interleukin受體透過JAK-STAT路徑，活化STAT轉錄因子。",
        "C": "不選。C「主要是活化cAMP」與本題核心概念不符，或屬於相近但不同的構造／機轉；請和正確選項對照記憶。",
        "D": "不選。D「主要由G protein參與反應」與本題核心概念不符，或屬於相近但不同的構造／機轉；請和正確選項對照記憶。"
      },
      "exam_point": "介白素與JAK-STAT訊息傳遞",
      "memory_tip": "cytokine常考JAK-STAT。",
      "clinical_link": "可作為國考整合題的快速複習點；若題目涉及臨床情境，重點是把構造、機轉與症狀連起來。",
      "review_flags": [
        "requested_supplement_patch",
        "additional_requested_by_user",
        "additional_question_requested_by_user",
        "official_answer_correction_or_multiple_credit"
      ],
      "source_files": {
        "extracted_from_detailed_file": "moex_med1_remaining_detailed_v4_merged_001_1827.json",
        "source_question_pdf": "107100_1301.pdf",
        "source_answer_pdf": "107100_MOD1301.pdf"
      }
    },
    {
      "id": "moex-med1-supplement-v5-108030-1301-049",
      "upsert_key": "108030-1301-49",
      "source_exam_key": "108030-1301",
      "exam_code": "108030",
      "paper_code": "1301",
      "exam_year_roc": 108,
      "exam_year_gregorian": 2019,
      "exam_session": "第一次",
      "question_no": 49,
      "requested_group": "reported_missing_by_user",
      "action": "upsert_or_replace_by_upsert_key",
      "subject_group": "醫學（一）",
      "stem": "Caudate nucleus主導下列何種功能？",
      "options": {
        "A": "情緒控制",
        "B": "動作執⾏",
        "C": "調控⾃律神經",
        "D": "記憶能⼒"
      },
      "official_answer_raw": "A|B",
      "correct_answers": [
        "A",
        "B"
      ],
      "answer_credit_type": "multiple_answers",
      "answer_note": "第49題答A、B給分",
      "classification_v5": {
        "primary_subject_exact": "神經解剖/神經科學",
        "topic_section": "基底核",
        "subtopic": "caudate nucleus",
        "five_subject_bucket_if_app_requires": "解剖學",
        "original_question_no_used": 49,
        "question_number_default_bucket": "生理學",
        "classification_method": "content_override",
        "confidence": "high",
        "legacy_non_five_subject": false,
        "original_classification": {
          "primary_subject": "未分類",
          "topic_section": "未分類／需人工確認",
          "track": "med1_remaining_completed_batch11",
          "classification_confidence": "medium",
          "previous_v2_primary_subject": "組織學",
          "corrected_from_v2": true
        },
        "notes": "已依題號與內容確認歸類。"
      },
      "explanation": "官方複數答案保留。尾狀核屬基底核，參與動作執行與部分情緒/認知迴路。",
      "option_analysis": {
        "A": "正確。A「情緒控制」符合本題考點；核心理由：官方複數答案保留。尾狀核屬基底核，參與動作執行與部分情緒/認知迴路。",
        "B": "正確。B「動作執⾏」符合本題考點；核心理由：官方複數答案保留。尾狀核屬基底核，參與動作執行與部分情緒/認知迴路。",
        "C": "不選。C「調控⾃律神經」與本題核心概念不符，或屬於相近但不同的構造／機轉；請和正確選項對照記憶。",
        "D": "不選。D「記憶能⼒」與本題核心概念不符，或屬於相近但不同的構造／機轉；請和正確選項對照記憶。"
      },
      "exam_point": "尾狀核功能",
      "memory_tip": "caudate不只運動，也進入認知情緒迴路。",
      "clinical_link": "可作為國考整合題的快速複習點；若題目涉及臨床情境，重點是把構造、機轉與症狀連起來。",
      "review_flags": [
        "official_modified_or_multiple_credit",
        "official_answer_special_handling",
        "requested_supplement_patch",
        "reported_missing_by_user",
        "question_number_subject_mismatch",
        "content_override_used",
        "reported_missing_in_user_integrity_check",
        "official_answer_correction_or_multiple_credit"
      ],
      "source_files": {
        "extracted_from_detailed_file": "moex_med1_remaining_detailed_v4_merged_001_1827.json",
        "source_question_pdf": "108030_1301.pdf",
        "source_answer_pdf": "108030_MOD1301.pdf"
      }
    },
    {
      "id": "moex-med1-supplement-v5-108030-1301-053",
      "upsert_key": "108030-1301-53",
      "source_exam_key": "108030-1301",
      "exam_code": "108030",
      "paper_code": "1301",
      "exam_year_roc": 108,
      "exam_year_gregorian": 2019,
      "exam_session": "第一次",
      "question_no": 53,
      "requested_group": "additional_requested_by_user",
      "action": "upsert_or_replace_by_upsert_key",
      "subject_group": "醫學（一）",
      "stem": "因⾞禍⽽急需輸⾎患者的⾎型為AB型，在場三⼈中，⼩李⾎型是A型，⼩吳是B型，⼩何是O型，下列敘述何 者正確？",
      "options": {
        "A": "只有⼩李及⼩吳可捐⾎給患者",
        "B": "只有⼩何可捐⾎給患者",
        "C": "三⼈均可捐⾎給患者",
        "D": "三⼈均不可捐⾎給患者"
      },
      "official_answer_raw": "C",
      "correct_answers": [
        "C"
      ],
      "answer_credit_type": "standard",
      "answer_note": "",
      "classification_v5": {
        "primary_subject_exact": "生理學",
        "topic_section": "血液生理",
        "subtopic": "輸血相容性",
        "five_subject_bucket_if_app_requires": "生理學",
        "original_question_no_used": 53,
        "question_number_default_bucket": "生理學",
        "classification_method": "original_question_number_rule_checked_by_content",
        "confidence": "high",
        "legacy_non_five_subject": false,
        "original_classification": {
          "primary_subject": "未分類",
          "topic_section": "未分類／需人工確認",
          "track": "med1_remaining_completed_batch11",
          "classification_confidence": "medium",
          "previous_v2_primary_subject": "未分類",
          "corrected_from_v2": true
        },
        "notes": "已依題號與內容確認歸類。"
      },
      "explanation": "AB型受血者紅血球上有A與B抗原，血漿中無抗A/抗B，可接受A、B、O紅血球。",
      "option_analysis": {
        "A": "不選。A「只有⼩李及⼩吳可捐⾎給患者」與本題核心概念不符，或屬於相近但不同的構造／機轉；請和正確選項對照記憶。",
        "B": "不選。B「只有⼩何可捐⾎給患者」與本題核心概念不符，或屬於相近但不同的構造／機轉；請和正確選項對照記憶。",
        "C": "正確。C「三⼈均可捐⾎給患者」符合本題考點；核心理由：AB型受血者紅血球上有A與B抗原，血漿中無抗A/抗B，可接受A、B、O紅血球。",
        "D": "不選。D「三⼈均不可捐⾎給患者」與本題核心概念不符，或屬於相近但不同的構造／機轉；請和正確選項對照記憶。"
      },
      "exam_point": "ABO輸血相容性",
      "memory_tip": "AB是紅血球受血者的universal recipient。",
      "clinical_link": "可作為國考整合題的快速複習點；若題目涉及臨床情境，重點是把構造、機轉與症狀連起來。",
      "review_flags": [
        "needs_manual_tag_review",
        "requested_supplement_patch",
        "additional_requested_by_user",
        "additional_question_requested_by_user",
        "official_answer_correction_or_multiple_credit"
      ],
      "source_files": {
        "extracted_from_detailed_file": "moex_med1_remaining_detailed_v4_merged_001_1827.json",
        "source_question_pdf": "108030_1301.pdf",
        "source_answer_pdf": "108030_MOD1301.pdf"
      }
    },
    {
      "id": "moex-med1-supplement-v5-108030-1301-057",
      "upsert_key": "108030-1301-57",
      "source_exam_key": "108030-1301",
      "exam_code": "108030",
      "paper_code": "1301",
      "exam_year_roc": 108,
      "exam_year_gregorian": 2019,
      "exam_session": "第一次",
      "question_no": 57,
      "requested_group": "additional_requested_by_user",
      "action": "upsert_or_replace_by_upsert_key",
      "subject_group": "醫學（一）",
      "stem": "下列那⼀個敘述最符合在休息狀態下，⼼房纖維顫動（atrial fibrillation）的病患之⾝體情況？",
      "options": {
        "A": "⼼電圖上P波較正常⼈明顯",
        "B": "⼼電圖上QRS波正常但R-R間隔不規則",
        "C": "⼼室充⾎（ventricular filling）效率明顯下降了30～40%或更多",
        "D": "因為房室結（A-V node）傳導的延遲，⼼室跳動速率明顯下降"
      },
      "official_answer_raw": "B",
      "correct_answers": [
        "B"
      ],
      "answer_credit_type": "standard",
      "answer_note": "",
      "classification_v5": {
        "primary_subject_exact": "生理學",
        "topic_section": "心血管生理",
        "subtopic": "atrial fibrillation",
        "five_subject_bucket_if_app_requires": "生理學",
        "original_question_no_used": 57,
        "question_number_default_bucket": "生理學",
        "classification_method": "original_question_number_rule_checked_by_content",
        "confidence": "high",
        "legacy_non_five_subject": false,
        "original_classification": {
          "primary_subject": "未分類",
          "topic_section": "未分類／需人工確認",
          "track": "med1_remaining_completed_batch11",
          "classification_confidence": "medium",
          "previous_v2_primary_subject": "組織學",
          "corrected_from_v2": true
        },
        "notes": "已依題號與內容確認歸類。"
      },
      "explanation": "心房顫動沒有規則P波，QRS通常狹窄正常，但R-R間隔不規則。",
      "option_analysis": {
        "A": "不選。A「⼼電圖上P波較正常⼈明顯」與本題核心概念不符，或屬於相近但不同的構造／機轉；請和正確選項對照記憶。",
        "B": "正確。B「⼼電圖上QRS波正常但R-R間隔不規則」符合本題考點；核心理由：心房顫動沒有規則P波，QRS通常狹窄正常，但R-R間隔不規則。",
        "C": "不選。C「⼼室充⾎（ventricular filling）效率明顯下降了30～40%或更多」與本題核心概念不符，或屬於相近但不同的構造／機轉；請和正確選項對照記憶。",
        "D": "不選。D「因為房室結（A-V node）傳導的延遲，⼼室跳動速率明顯下降」與本題核心概念不符，或屬於相近但不同的構造／機轉；請和正確選項對照記憶。"
      },
      "exam_point": "心房顫動心電圖",
      "memory_tip": "AF = irregularly irregular。",
      "clinical_link": "可作為國考整合題的快速複習點；若題目涉及臨床情境，重點是把構造、機轉與症狀連起來。",
      "review_flags": [
        "needs_image_review",
        "needs_pdf_figure",
        "requested_supplement_patch",
        "additional_requested_by_user",
        "additional_question_requested_by_user",
        "official_answer_correction_or_multiple_credit"
      ],
      "source_files": {
        "extracted_from_detailed_file": "moex_med1_remaining_detailed_v4_merged_001_1827.json",
        "source_question_pdf": "108030_1301.pdf",
        "source_answer_pdf": "108030_MOD1301.pdf"
      }
    },
    {
      "id": "moex-med1-supplement-v5-108030-1301-058",
      "upsert_key": "108030-1301-58",
      "source_exam_key": "108030-1301",
      "exam_code": "108030",
      "paper_code": "1301",
      "exam_year_roc": 108,
      "exam_year_gregorian": 2019,
      "exam_session": "第一次",
      "question_no": 58,
      "requested_group": "reported_missing_by_user",
      "action": "upsert_or_replace_by_upsert_key",
      "subject_group": "醫學（一）",
      "stem": "下列何者在動脈粥狀硬化（atherosclerosis）患者會有增加的現象？①收縮壓（systolic pressure） ②舒 張壓（diastolic pressure） ③脈搏壓（pulse pressure） ④動脈順應性（compliance）",
      "options": {
        "A": "僅①②③",
        "B": "僅①③",
        "C": "僅②③",
        "D": "①②③④"
      },
      "official_answer_raw": "A|B",
      "correct_answers": [
        "A",
        "B"
      ],
      "answer_credit_type": "multiple_answers",
      "answer_note": "第58題答A、B給分",
      "classification_v5": {
        "primary_subject_exact": "生理學",
        "topic_section": "心血管生理",
        "subtopic": "動脈硬化與脈壓",
        "five_subject_bucket_if_app_requires": "生理學",
        "original_question_no_used": 58,
        "question_number_default_bucket": "生理學",
        "classification_method": "original_question_number_rule_checked_by_content",
        "confidence": "high",
        "legacy_non_five_subject": false,
        "original_classification": {
          "primary_subject": "未分類",
          "topic_section": "未分類／需人工確認",
          "track": "med1_remaining_completed_batch11",
          "classification_confidence": "medium",
          "previous_v2_primary_subject": "生理學",
          "corrected_from_v2": true
        },
        "notes": "已依題號與內容確認歸類。"
      },
      "explanation": "官方複數答案保留。動脈粥狀硬化使動脈順應性下降，收縮壓與脈搏壓上升；舒張壓可依病程變化。",
      "option_analysis": {
        "A": "正確。A「僅①②③」符合本題考點；核心理由：官方複數答案保留。動脈粥狀硬化使動脈順應性下降，收縮壓與脈搏壓上升；舒張壓可依病程變化。",
        "B": "正確。B「僅①③」符合本題考點；核心理由：官方複數答案保留。動脈粥狀硬化使動脈順應性下降，收縮壓與脈搏壓上升；舒張壓可依病程變化。",
        "C": "不選。C「僅②③」與本題核心概念不符，或屬於相近但不同的構造／機轉；請和正確選項對照記憶。",
        "D": "不選。D「①②③④」與本題核心概念不符，或屬於相近但不同的構造／機轉；請和正確選項對照記憶。"
      },
      "exam_point": "動脈順應性與血壓",
      "memory_tip": "硬血管：SBP↑、PP↑、compliance↓。",
      "clinical_link": "可作為國考整合題的快速複習點；若題目涉及臨床情境，重點是把構造、機轉與症狀連起來。",
      "review_flags": [
        "official_modified_or_multiple_credit",
        "official_answer_special_handling",
        "requested_supplement_patch",
        "reported_missing_by_user",
        "reported_missing_in_user_integrity_check",
        "official_answer_correction_or_multiple_credit"
      ],
      "source_files": {
        "extracted_from_detailed_file": "moex_med1_remaining_detailed_v4_merged_001_1827.json",
        "source_question_pdf": "108030_1301.pdf",
        "source_answer_pdf": "108030_MOD1301.pdf"
      }
    },
    {
      "id": "moex-med1-supplement-v5-108030-1301-060",
      "upsert_key": "108030-1301-60",
      "source_exam_key": "108030-1301",
      "exam_code": "108030",
      "paper_code": "1301",
      "exam_year_roc": 108,
      "exam_year_gregorian": 2019,
      "exam_session": "第一次",
      "question_no": 60,
      "requested_group": "additional_requested_by_user",
      "action": "upsert_or_replace_by_upsert_key",
      "subject_group": "醫學（一）",
      "stem": "登⼭者進入⾼海拔地區時，動脈氧分壓降為80 mmHg時，最主要是發⽣下列何種反應所造成？",
      "options": {
        "A": "呼吸性酸⾎症（respiratory acidosis）",
        "B": "紅⾎球減少製造 2,3-⼆磷⽢油酯（2,3-diphosphoglycerate），以便增加⾎紅素對氧氣親和⼒",
        "C": "主動脈體（aortic body）因缺氧⽽抑制神經衝動",
        "D": "每分鐘通氣量（ventilation）增加"
      },
      "official_answer_raw": "ALL",
      "correct_answers": [
        "ALL"
      ],
      "answer_credit_type": "all_credit",
      "answer_note": "第60題一律給分",
      "classification_v5": {
        "primary_subject_exact": "生理學",
        "topic_section": "呼吸生理",
        "subtopic": "高海拔通氣反應",
        "five_subject_bucket_if_app_requires": "生理學",
        "original_question_no_used": 60,
        "question_number_default_bucket": "生理學",
        "classification_method": "original_question_number_rule_checked_by_content",
        "confidence": "high",
        "legacy_non_five_subject": false,
        "original_classification": {
          "primary_subject": "未分類",
          "topic_section": "未分類／需人工確認",
          "track": "med1_remaining_completed_batch11",
          "classification_confidence": "medium",
          "previous_v2_primary_subject": "生理學",
          "corrected_from_v2": true
        },
        "notes": "已依題號與內容確認歸類。"
      },
      "explanation": "官方一律給分；高海拔低氧最主要急性反應是周邊化學受器促進通氣量增加。",
      "option_analysis": {
        "A": "官方一律給分。A「呼吸性酸⾎症（respiratory acidosis）」在原題官方處理上不作為唯一判分依據；建議回原PDF與官方更正備註確認。",
        "B": "官方一律給分。B「紅⾎球減少製造 2,3-⼆磷⽢油酯（2,3-diphosphoglycerate），以便增加⾎紅素對氧氣親和⼒」在原題官方處理上不作為唯一判分依據；建議回原PDF與官方更正備註確認。",
        "C": "官方一律給分。C「主動脈體（aortic body）因缺氧⽽抑制神經衝動」在原題官方處理上不作為唯一判分依據；建議回原PDF與官方更正備註確認。",
        "D": "官方一律給分。D「每分鐘通氣量（ventilation）增加」在原題官方處理上不作為唯一判分依據；建議回原PDF與官方更正備註確認。"
      },
      "exam_point": "高海拔低氧反應",
      "memory_tip": "高山低氧先過度換氣。",
      "clinical_link": "可作為國考整合題的快速複習點；若題目涉及臨床情境，重點是把構造、機轉與症狀連起來。",
      "review_flags": [
        "official_modified_or_multiple_credit",
        "official_answer_special_handling",
        "requested_supplement_patch",
        "additional_requested_by_user",
        "additional_question_requested_by_user",
        "official_answer_correction_or_multiple_credit"
      ],
      "source_files": {
        "extracted_from_detailed_file": "moex_med1_remaining_detailed_v4_merged_001_1827.json",
        "source_question_pdf": "108030_1301.pdf",
        "source_answer_pdf": "108030_MOD1301.pdf"
      }
    },
    {
      "id": "moex-med1-supplement-v5-108030-1301-064",
      "upsert_key": "108030-1301-64",
      "source_exam_key": "108030-1301",
      "exam_code": "108030",
      "paper_code": "1301",
      "exam_year_roc": 108,
      "exam_year_gregorian": 2019,
      "exam_session": "第一次",
      "question_no": 64,
      "requested_group": "additional_requested_by_user",
      "action": "upsert_or_replace_by_upsert_key",
      "subject_group": "醫學（一）",
      "stem": "在不分泌唾液的狀況下，下列那些營養成分在⼈體中仍可被消化？①醣類 ②脂肪 ③蛋⽩質",
      "options": {
        "A": "僅①②",
        "B": "僅②③",
        "C": "僅①③",
        "D": "①②③"
      },
      "official_answer_raw": "D",
      "correct_answers": [
        "D"
      ],
      "answer_credit_type": "standard",
      "answer_note": "",
      "classification_v5": {
        "primary_subject_exact": "生理學",
        "topic_section": "消化生理",
        "subtopic": "消化酵素",
        "five_subject_bucket_if_app_requires": "生理學",
        "original_question_no_used": 64,
        "question_number_default_bucket": "生理學",
        "classification_method": "original_question_number_rule_checked_by_content",
        "confidence": "high",
        "legacy_non_five_subject": false,
        "original_classification": {
          "primary_subject": "未分類",
          "topic_section": "未分類／需人工確認",
          "track": "med1_remaining_completed_batch11",
          "classification_confidence": "medium",
          "previous_v2_primary_subject": "生理學",
          "corrected_from_v2": true
        },
        "notes": "已依題號與內容確認歸類。"
      },
      "explanation": "即使無唾液，醣類仍可由胰澱粉酶消化，脂肪由胰脂肪酶，蛋白質由胃蛋白酶與胰蛋白酶消化。",
      "option_analysis": {
        "A": "不選。A「僅①②」與本題核心概念不符，或屬於相近但不同的構造／機轉；請和正確選項對照記憶。",
        "B": "不選。B「僅②③」與本題核心概念不符，或屬於相近但不同的構造／機轉；請和正確選項對照記憶。",
        "C": "不選。C「僅①③」與本題核心概念不符，或屬於相近但不同的構造／機轉；請和正確選項對照記憶。",
        "D": "正確。D「①②③」符合本題考點；核心理由：即使無唾液，醣類仍可由胰澱粉酶消化，脂肪由胰脂肪酶，蛋白質由胃蛋白酶與胰蛋白酶消化。"
      },
      "exam_point": "消化酵素來源",
      "memory_tip": "唾液不是三大營養消化唯一來源。",
      "clinical_link": "可作為國考整合題的快速複習點；若題目涉及臨床情境，重點是把構造、機轉與症狀連起來。",
      "review_flags": [
        "requested_supplement_patch",
        "additional_requested_by_user",
        "additional_question_requested_by_user",
        "official_answer_correction_or_multiple_credit"
      ],
      "source_files": {
        "extracted_from_detailed_file": "moex_med1_remaining_detailed_v4_merged_001_1827.json",
        "source_question_pdf": "108030_1301.pdf",
        "source_answer_pdf": "108030_MOD1301.pdf"
      }
    },
    {
      "id": "moex-med1-supplement-v5-108030-1301-077",
      "upsert_key": "108030-1301-77",
      "source_exam_key": "108030-1301",
      "exam_code": "108030",
      "paper_code": "1301",
      "exam_year_roc": 108,
      "exam_year_gregorian": 2019,
      "exam_session": "第一次",
      "question_no": 77,
      "requested_group": "additional_requested_by_user",
      "action": "upsert_or_replace_by_upsert_key",
      "subject_group": "醫學（一）",
      "stem": "下列那⼀種維⽣素的化學結構含有鈷離⼦（cobalt ion）？",
      "options": {
        "A": "vitamin K",
        "B": "vitamin E",
        "C": "vitamin B 6",
        "D": "vitamin B 12"
      },
      "official_answer_raw": "D",
      "correct_answers": [
        "D"
      ],
      "answer_credit_type": "standard",
      "answer_note": "",
      "classification_v5": {
        "primary_subject_exact": "生物化學",
        "topic_section": "維生素",
        "subtopic": "vitamin B12",
        "five_subject_bucket_if_app_requires": "生物化學",
        "original_question_no_used": 77,
        "question_number_default_bucket": "生物化學",
        "classification_method": "original_question_number_rule_checked_by_content",
        "confidence": "high",
        "legacy_non_five_subject": false,
        "original_classification": {
          "primary_subject": "未分類",
          "topic_section": "未分類／需人工確認",
          "track": "med1_remaining_completed_batch11",
          "classification_confidence": "medium",
          "previous_v2_primary_subject": "生物化學",
          "corrected_from_v2": true
        },
        "notes": "已依題號與內容確認歸類。"
      },
      "explanation": "維生素B12又稱cobalamin，核心含鈷離子。",
      "option_analysis": {
        "A": "不選。A「vitamin K」與本題核心概念不符，或屬於相近但不同的構造／機轉；請和正確選項對照記憶。",
        "B": "不選。B「vitamin E」與本題核心概念不符，或屬於相近但不同的構造／機轉；請和正確選項對照記憶。",
        "C": "不選。C「vitamin B 6」與本題核心概念不符，或屬於相近但不同的構造／機轉；請和正確選項對照記憶。",
        "D": "正確。D「vitamin B 12」符合本題考點；核心理由：維生素B12又稱cobalamin，核心含鈷離子。"
      },
      "exam_point": "維生素B12結構",
      "memory_tip": "cobalamin有cobalt。",
      "clinical_link": "可作為國考整合題的快速複習點；若題目涉及臨床情境，重點是把構造、機轉與症狀連起來。",
      "review_flags": [
        "requested_supplement_patch",
        "additional_requested_by_user",
        "additional_question_requested_by_user",
        "official_answer_correction_or_multiple_credit"
      ],
      "source_files": {
        "extracted_from_detailed_file": "moex_med1_remaining_detailed_v4_merged_001_1827.json",
        "source_question_pdf": "108030_1301.pdf",
        "source_answer_pdf": "108030_MOD1301.pdf"
      }
    },
    {
      "id": "moex-med1-supplement-v5-109100-1301-004",
      "upsert_key": "109100-1301-4",
      "source_exam_key": "109100-1301",
      "exam_code": "109100",
      "paper_code": "1301",
      "exam_year_roc": 109,
      "exam_year_gregorian": 2020,
      "exam_session": "第二次",
      "question_no": 4,
      "requested_group": "reported_missing_by_user",
      "action": "upsert_or_replace_by_upsert_key",
      "subject_group": "醫學（一）",
      "stem": "在一般情況下，奇靜脈（azygos vein）在下列何處造成壓跡？",
      "options": {
        "A": "右肺上葉（right lung, superior lobe）",
        "B": "左肺上葉（left lung, superior lobe）",
        "C": "右肺下葉（right lung, inferior lobe）",
        "D": "左肺下葉（left lung, inferior lobe）"
      },
      "official_answer_raw": "A|C",
      "correct_answers": [
        "A",
        "C"
      ],
      "answer_credit_type": "multiple_answers",
      "answer_note": "第4題答A、C給分",
      "classification_v5": {
        "primary_subject_exact": "解剖學",
        "topic_section": "胸腔",
        "subtopic": "奇靜脈",
        "five_subject_bucket_if_app_requires": "解剖學",
        "original_question_no_used": 4,
        "question_number_default_bucket": "解剖學",
        "classification_method": "original_question_number_rule_checked_by_content",
        "confidence": "high",
        "legacy_non_five_subject": false,
        "original_classification": {
          "primary_subject": "解剖學",
          "body_region": "胸腔",
          "topic_section": "肺與胸膜",
          "anatomy_track": true,
          "classification_confidence": 0.78,
          "subject_confidence": 0.75,
          "region_confidence": 0.82,
          "method": "v2_rule_based_keyword_plus_known_manual_checks",
          "subject_scores": {
            "微生物免疫學/寄生蟲學": 0,
            "公共衛生學": 0,
            "生物化學": 0,
            "生理學": 0,
            "胚胎及發育生物學": 0,
            "組織學": 0,
            "解剖學": 4
          },
          "manual_note": ""
        },
        "notes": "已依題號與內容確認歸類。"
      },
      "explanation": "奇靜脈弓跨過右肺根上方匯入上腔靜脈，通常在右肺形成壓跡。官方此題採計右肺上葉與右肺下葉兩個答案，反映壓跡位置描述可能因教材或影像切面而異。",
      "option_analysis": {
        "A": "正確／官方採計。azygos vein forms an impression on the right lung near the root; official answer gives right upper and right lower lobe credit",
        "B": "不選。左肺上葉（left lung, superior lobe）不是本題最符合的答案；本題重點是：azygos vein forms an impression on the right lung near the root; official answer gives right upper and right lower lobe credit",
        "C": "正確／官方採計。azygos vein forms an impression on the right lung near the root; official answer gives right upper and right lower lobe credit",
        "D": "不選。左肺下葉（left lung, inferior lobe）不是本題最符合的答案；本題重點是：azygos vein forms an impression on the right lung near the root; official answer gives right upper and right lower lobe credit"
      },
      "exam_point": "azygos vein forms an impression on the right lung near the root; official answer gives right upper and right lower lobe credit",
      "memory_tip": "奇靜脈在右肺，不在左肺。",
      "clinical_link": "胸部影像可見奇靜脈弓或變異奇葉裂。",
      "review_flags": [
        "official_modified_or_multiple_credit",
        "needs_human_review_detail",
        "requested_supplement_patch",
        "reported_missing_by_user",
        "reported_missing_in_user_integrity_check",
        "official_answer_correction_or_multiple_credit"
      ],
      "source_files": {
        "extracted_from_detailed_file": "moex_anatomy_strict_detailed_v3_merged_001_973.json",
        "source_question_pdf": "109100_1301.pdf",
        "source_answer_pdf": "109100_MOD1301.pdf"
      }
    },
    {
      "id": "moex-med1-supplement-v5-109100-1301-058",
      "upsert_key": "109100-1301-58",
      "source_exam_key": "109100-1301",
      "exam_code": "109100",
      "paper_code": "1301",
      "exam_year_roc": 109,
      "exam_year_gregorian": 2020,
      "exam_session": "第二次",
      "question_no": 58,
      "requested_group": "reported_missing_by_user",
      "action": "upsert_or_replace_by_upsert_key",
      "subject_group": "醫學（一）",
      "stem": "下列那一項因素最可能造成右心房壓升高？",
      "options": {
        "A": "加強心臟幫浦功能",
        "B": "降低靜脈回流",
        "C": "擴張小動脈，降低周邊阻力",
        "D": "大量失血後，血液量減少"
      },
      "official_answer_raw": "A|C",
      "correct_answers": [
        "A",
        "C"
      ],
      "answer_credit_type": "multiple_answers",
      "answer_note": "第58題答A、C給分",
      "classification_v5": {
        "primary_subject_exact": "生理學",
        "topic_section": "心血管生理",
        "subtopic": "右心房壓",
        "five_subject_bucket_if_app_requires": "生理學",
        "original_question_no_used": 58,
        "question_number_default_bucket": "生理學",
        "classification_method": "original_question_number_rule_checked_by_content",
        "confidence": "high",
        "legacy_non_five_subject": false,
        "original_classification": {
          "primary_subject": "解剖學",
          "body_region": "胸腔",
          "topic_section": "心臟與冠狀動脈",
          "anatomy_track": true,
          "classification_confidence": 0.78,
          "subject_confidence": 0.75,
          "region_confidence": 0.82,
          "method": "v2_rule_based_keyword_plus_known_manual_checks",
          "subject_scores": {
            "微生物免疫學/寄生蟲學": 0,
            "公共衛生學": 0,
            "生物化學": 0,
            "生理學": 0,
            "胚胎及發育生物學": 0,
            "組織學": 0,
            "解剖學": 3
          },
          "manual_note": ""
        },
        "notes": "已依題號與內容確認歸類。"
      },
      "explanation": "右心房壓取決於靜脈回流與心臟幫浦排空能力。一般來說心臟幫浦功能加強會降低右心房壓；官方此題採計A與C，代表題意或答案曾有爭議，應保留人工審核。",
      "option_analysis": {
        "A": "正確／官方採計。right atrial pressure reflects venous return and cardiac pump function; this item has official multiple credit and should be reviewed",
        "B": "不選。降低靜脈回流不是本題最符合的答案；本題重點是：right atrial pressure reflects venous return and cardiac pump function; this item has official multiple credit and should be reviewed",
        "C": "正確／官方採計。right atrial pressure reflects venous return and cardiac pump function; this item has official multiple credit and should be reviewed",
        "D": "不選。大量失血後，血液量減少不是本題最符合的答案；本題重點是：right atrial pressure reflects venous return and cardiac pump function; this item has official multiple credit and should be reviewed"
      },
      "exam_point": "right atrial pressure reflects venous return and cardiac pump function; this item has official multiple credit and should be reviewed",
      "memory_tip": "右房壓＝回流進來 vs 心臟打出去。",
      "clinical_link": "心衰竭常使右心房壓與頸靜脈壓升高。",
      "review_flags": [
        "official_modified_or_multiple_credit",
        "not_strict_anatomy_misclassified",
        "needs_removal_from_anatomy_track",
        "needs_human_review_detail",
        "requested_supplement_patch",
        "reported_missing_by_user",
        "reported_missing_in_user_integrity_check",
        "official_answer_correction_or_multiple_credit"
      ],
      "source_files": {
        "extracted_from_detailed_file": "moex_anatomy_strict_detailed_v3_merged_001_973.json",
        "source_question_pdf": "109100_1301.pdf",
        "source_answer_pdf": "109100_MOD1301.pdf"
      }
    },
    {
      "id": "moex-med1-supplement-v5-110101-1301-064",
      "upsert_key": "110101-1301-64",
      "source_exam_key": "110101-1301",
      "exam_code": "110101",
      "paper_code": "1301",
      "exam_year_roc": 110,
      "exam_year_gregorian": 2021,
      "exam_session": "第二次",
      "question_no": 64,
      "requested_group": "reported_missing_by_user",
      "action": "upsert_or_replace_by_upsert_key",
      "subject_group": "醫學（一）",
      "stem": "在distal convoluted tubule的靠管腔（tubular lumen）側的細胞膜上，對鈉再吸收的同向運輸子（cotransporter） 的運轉，最有賴於在靠組織間液（interstitial fluid）側的細胞膜上何種通道之搭配？",
      "options": {
        "A": "鉀離子通道（K + channel）",
        "B": "氯離子通道（Cl - channel）",
        "C": "鈉離子通道（Na + channel）",
        "D": "水通道（H O channel） 2"
      },
      "official_answer_raw": "A|B",
      "correct_answers": [
        "A",
        "B"
      ],
      "answer_credit_type": "multiple_answers",
      "answer_note": "第64題答A、B給分",
      "classification_v5": {
        "primary_subject_exact": "生理學",
        "topic_section": "腎臟生理",
        "subtopic": "DCT NaCl cotransporter",
        "five_subject_bucket_if_app_requires": "生理學",
        "original_question_no_used": 64,
        "question_number_default_bucket": "生理學",
        "classification_method": "original_question_number_rule_checked_by_content",
        "confidence": "high",
        "legacy_non_five_subject": false,
        "original_classification": {
          "primary_subject": "生理學",
          "topic_section": "腎臟生理／遠曲小管鈉氯再吸收",
          "track": "med1_remaining_completed_batch14",
          "classification_confidence": "high"
        },
        "notes": "已依題號與內容確認歸類。"
      },
      "explanation": "遠曲小管管腔側的 Na-Cl cotransporter 讓 Na⁺ 與 Cl⁻ 進入細胞。基底外側需要 Na⁺/K⁺ ATPase 維持低細胞內 Na⁺，並需要 K⁺ 通道維持膜電位；Cl⁻ 也需由基底外側通道離開細胞。官方給 A、B 複數答案，代表兩者皆可視為支援此運輸的必要搭配。",
      "option_analysis": {
        "A": "正確（官方複數答案）。基底外側 K⁺ 通道有助維持膜電位與 Na⁺/K⁺ ATPase 運作環境。",
        "B": "正確（官方複數答案）。Na-Cl cotransporter 帶入 Cl⁻ 後，Cl⁻ 需經基底外側 Cl⁻ 通道離開，運輸才能持續。",
        "C": "不選。基底外側主要是 Na⁺/K⁺ ATPase 把 Na⁺ 打出，而不是靠 Na⁺ 通道讓 Na⁺ 被動通過。",
        "D": "不選。水通道不是 DCT 早段 Na-Cl cotransporter 運轉的主要搭配。"
      },
      "exam_point": "DCT NCC depends on basolateral ion exit and membrane potential",
      "memory_tip": "NCC 把 NaCl 帶進來，外側要把 Cl 放走、K 維持電位。",
      "clinical_link": "thiazide 利尿劑抑制遠曲小管 Na-Cl cotransporter。",
      "review_flags": [
        "official_multiple_answers",
        "requested_supplement_patch",
        "reported_missing_by_user",
        "reported_missing_in_user_integrity_check",
        "official_answer_correction_or_multiple_credit"
      ],
      "source_files": {
        "extracted_from_detailed_file": "moex_med1_remaining_detailed_v4_merged_001_1827.json",
        "source_question_pdf": "110101_1301.pdf",
        "source_answer_pdf": "110101_MOD1301.pdf"
      }
    },
    {
      "id": "moex-med1-supplement-v5-111100-1301-040",
      "upsert_key": "111100-1301-40",
      "source_exam_key": "111100-1301",
      "exam_code": "111100",
      "paper_code": "1301",
      "exam_year_roc": 111,
      "exam_year_gregorian": 2022,
      "exam_session": "第二次",
      "question_no": 40,
      "requested_group": "reported_missing_by_user",
      "action": "upsert_or_replace_by_upsert_key",
      "subject_group": "醫學（一）",
      "stem": "下列有關膜性迷路（membranous labyrinth）的敘述，何者錯誤？",
      "options": {
        "A": "壺腹嵴（crista ampullaris）是頭部角加速運動（angular acceleration）的感覺受器",
        "B": "頂帽（cupula）的耳石（otolith）是頭部直線加速運動（linear acceleration）的感覺受器",
        "C": "前庭階（scala vestibule）與鼓室階（scala tympani）於蝸孔（helicotrema）彼此相通",
        "D": "耳蝸導管（cochlear duct）內，流動的液體為內淋巴液（endolymph）"
      },
      "official_answer_raw": "#",
      "correct_answers": [
        "#"
      ],
      "answer_credit_type": "standard",
      "answer_note": "",
      "classification_v5": {
        "primary_subject_exact": "解剖學",
        "topic_section": "頭頸部/神經解剖",
        "subtopic": "膜性迷路",
        "five_subject_bucket_if_app_requires": "解剖學",
        "original_question_no_used": 40,
        "question_number_default_bucket": "組織學",
        "classification_method": "content_override",
        "confidence": "high",
        "legacy_non_five_subject": false,
        "original_classification": {
          "primary_subject": "解剖學",
          "body_region": "頭頸部",
          "topic_section": "顱底與孔洞",
          "anatomy_track": true,
          "classification_confidence": 0.78,
          "subject_confidence": 0.75,
          "region_confidence": 0.82,
          "method": "v2_rule_based_keyword_plus_known_manual_checks",
          "subject_scores": {
            "微生物免疫學/寄生蟲學": 0,
            "公共衛生學": 0,
            "生物化學": 0,
            "生理學": 1,
            "胚胎及發育生物學": 0,
            "組織學": 0,
            "解剖學": 1
          },
          "manual_note": ""
        },
        "notes": "已依題號與內容確認歸類。"
      },
      "explanation": "官方答案以 # 標示，應保留為官方異動題。若按概念判斷，B最不恰當：壺腹嵴的頂帽不含耳石，耳石位於橢圓囊與球囊的耳石膜，用於感受直線加速度；壺腹嵴感受角加速度。",
      "option_analysis": {
        "A": "本題官方答案以 # 標示，需依官方更正表處理。若單純按解剖概念判斷，請回到詳解文字確認；選項 A 為：壺腹嵴（crista ampullaris）是頭部角加速運動（angular acceleration）的感覺受器。",
        "B": "本題官方答案以 # 標示，需依官方更正表處理。若單純按解剖概念判斷，請回到詳解文字確認；選項 B 為：頂帽（cupula）的耳石（otolith）是頭部直線加速運動（linear acceleration）的感覺受器。",
        "C": "本題官方答案以 # 標示，需依官方更正表處理。若單純按解剖概念判斷，請回到詳解文字確認；選項 C 為：前庭階（scala vestibule）與鼓室階（scala tympani）於蝸孔（helicotrema）彼此相通。",
        "D": "本題官方答案以 # 標示，需依官方更正表處理。若單純按解剖概念判斷，請回到詳解文字確認；選項 D 為：耳蝸導管（cochlear duct）內，流動的液體為內淋巴液（endolymph）。"
      },
      "exam_point": "膜性迷路與內淋巴/外淋巴",
      "memory_tip": "角加速度＝壺腹嵴；直線加速度＝耳石器。",
      "clinical_link": "良性陣發性姿勢性眩暈與耳石脫落有關。",
      "review_flags": [
        "official_modified_or_multiple_credit",
        "answer_possibly_modified",
        "needs_human_review",
        "requested_supplement_patch",
        "reported_missing_by_user",
        "question_number_subject_mismatch",
        "content_override_used",
        "reported_missing_in_user_integrity_check",
        "official_answer_correction_or_multiple_credit"
      ],
      "source_files": {
        "extracted_from_detailed_file": "moex_anatomy_strict_detailed_v3_merged_001_973.json",
        "source_question_pdf": "111100_1301.pdf",
        "source_answer_pdf": "111100_MOD1301.pdf"
      }
    },
    {
      "id": "moex-med1-supplement-v5-113020-1301-003",
      "upsert_key": "113020-1301-3",
      "source_exam_key": "113020-1301",
      "exam_code": "113020",
      "paper_code": "1301",
      "exam_year_roc": 113,
      "exam_year_gregorian": 2024,
      "exam_session": "第一次",
      "question_no": 3,
      "requested_group": "reported_missing_by_user",
      "action": "upsert_or_replace_by_upsert_key",
      "subject_group": "醫學（一）",
      "stem": "基底核（basal ganglia）傳出的神經纖維經丘腦（thalamus）後，一般不直接傳至下列何處之大腦皮質？",
      "options": {
        "A": "主要運動區（primary motor area）",
        "B": "扣帶運動區（cingulate motor area）",
        "C": "運動輔助區（supplementary motor area）",
        "D": "運動前區（premotor area）"
      },
      "official_answer_raw": "ALL",
      "correct_answers": [
        "ALL"
      ],
      "answer_credit_type": "all_credit",
      "answer_note": "第3題一律給分",
      "classification_v5": {
        "primary_subject_exact": "神經解剖/神經科學",
        "topic_section": "基底核",
        "subtopic": "皮質投射",
        "five_subject_bucket_if_app_requires": "解剖學",
        "original_question_no_used": 3,
        "question_number_default_bucket": "解剖學",
        "classification_method": "original_question_number_rule_checked_by_content",
        "confidence": "high",
        "legacy_non_five_subject": false,
        "original_classification": {
          "primary_subject": "解剖學",
          "body_region": "神經解剖",
          "topic_section": "丘腦與基底核",
          "anatomy_track": true,
          "classification_confidence": 0.78,
          "subject_confidence": 0.75,
          "region_confidence": 0.82,
          "method": "v2_rule_based_keyword_plus_known_manual_checks",
          "subject_scores": {
            "微生物免疫學/寄生蟲學": 0,
            "公共衛生學": 0,
            "生物化學": 0,
            "生理學": 0,
            "胚胎及發育生物學": 0,
            "組織學": 0,
            "解剖學": 3
          },
          "manual_note": ""
        },
        "notes": "已依題號與內容確認歸類。"
      },
      "explanation": "官方此題採全部給分。基底核經丘腦可影響多個運動相關皮質，包括初級運動區、運動前區、輔助運動區及扣帶運動區，因此題幹的『一般不直接』容易造成爭議。",
      "option_analysis": {
        "A": "正確／官方採計。官方此題採全部給分。基底核經丘腦可影響多個運動相關皮質，包括初級運動區、運動前區、輔助運動區及扣帶運動區，因此題幹的『一般不直接』容易造成爭議。",
        "B": "正確／官方採計。官方此題採全部給分。基底核經丘腦可影響多個運動相關皮質，包括初級運動區、運動前區、輔助運動區及扣帶運動區，因此題幹的『一般不直接』容易造成爭議。",
        "C": "正確／官方採計。官方此題採全部給分。基底核經丘腦可影響多個運動相關皮質，包括初級運動區、運動前區、輔助運動區及扣帶運動區，因此題幹的『一般不直接』容易造成爭議。",
        "D": "正確／官方採計。官方此題採全部給分。基底核經丘腦可影響多個運動相關皮質，包括初級運動區、運動前區、輔助運動區及扣帶運動區，因此題幹的『一般不直接』容易造成爭議。"
      },
      "exam_point": "基底核丘腦皮質投射",
      "memory_tip": "此題官方全給分，保留標記。",
      "clinical_link": "基底核迴路分為運動、認知與邊緣迴路。",
      "review_flags": [
        "official_modified_or_multiple_credit",
        "ambiguous_question",
        "needs_human_review",
        "requested_supplement_patch",
        "reported_missing_by_user",
        "reported_missing_in_user_integrity_check",
        "official_answer_correction_or_multiple_credit"
      ],
      "source_files": {
        "extracted_from_detailed_file": "moex_anatomy_strict_detailed_v3_merged_001_973.json",
        "source_question_pdf": "113020_1301.pdf",
        "source_answer_pdf": "113020_MOD1301.pdf"
      }
    },
    {
      "id": "moex-med1-supplement-v5-113090-1301-049",
      "upsert_key": "113090-1301-49",
      "source_exam_key": "113090-1301",
      "exam_code": "113090",
      "paper_code": "1301",
      "exam_year_roc": 113,
      "exam_year_gregorian": 2024,
      "exam_session": "第二次",
      "question_no": 49,
      "requested_group": "additional_requested_by_user",
      "action": "upsert_or_replace_by_upsert_key",
      "subject_group": "醫學（一）",
      "stem": "下列關於語言優勢腦半球（dominant hemisphere）或語言互補式特化（complementary specialization） 半球的描述，下列何項最適當？",
      "options": {
        "A": "多數人負責語言理解和製造的語言優勢腦半球皆位於右腦半球",
        "B": "語言優勢腦半球和人臉及負向表情辨識的優勢腦半球通常位於不同半球",
        "C": "語言優勢腦半球是一個將語言的視空間化表徵特性轉化為時間表徵特性的腦半球",
        "D": "Wernicke's aphasia是專指語言優勢腦半球的Wernicke's area受損，使語言的製造上出現問題，但語言理 解是正常的"
      },
      "official_answer_raw": "B",
      "correct_answers": [
        "B"
      ],
      "answer_credit_type": "standard",
      "answer_note": "",
      "classification_v5": {
        "primary_subject_exact": "神經解剖/神經科學",
        "topic_section": "高級皮質功能",
        "subtopic": "語言半球",
        "five_subject_bucket_if_app_requires": "解剖學",
        "original_question_no_used": 49,
        "question_number_default_bucket": "生理學",
        "classification_method": "content_override",
        "confidence": "high",
        "legacy_non_five_subject": false,
        "original_classification": {
          "primary_subject": "神經科學",
          "topic_section": "大腦半球特化／語言與臉部辨識",
          "track": "med1_remaining_completed_batch17",
          "classification_confidence": 0.85
        },
        "notes": "已依題號與內容確認歸類。"
      },
      "explanation": "正確答案是B。多數人的語言優勢半球在左側，而臉孔辨識與負向情緒辨識常偏右半球，因此兩者常位於不同半球。 這是本題判斷的主軸；讀題時先抓「何者錯誤／最不適當／最適當」這類關鍵字，再把選項放回該生理或分子機轉中檢查。",
      "option_analysis": {
        "A": "錯。多數人負責語言理解和製造的語言優勢腦半球皆位於右腦半球不是本題所問的最佳答案；本題核心在於「多數人的語言優勢半球在左側，而臉孔辨識與負向情緒辨識常偏右半球，因此兩者常位於不同半球。」，因此此選項與關鍵機轉、位置或定義不符。",
        "B": "正確。語言優勢腦半球和人臉及負向表情辨識的優勢腦半球通常位於不同半球符合本題核心：多數人的語言優勢半球在左側，而臉孔辨識與負向情緒辨識常偏右半球，因此兩者常位於不同半球。",
        "C": "錯。語言優勢腦半球是一個將語言的視空間化表徵特性轉化為時間表徵特性的腦半球不是本題所問的最佳答案；本題核心在於「多數人的語言優勢半球在左側，而臉孔辨識與負向情緒辨識常偏右半球，因此兩者常位於不同半球。」，因此此選項與關鍵機轉、位置或定義不符。",
        "D": "錯。Wernicke's aphasia是專指語言優勢腦半球的Wernicke's area受損，使語言的製造上出現問題，但語言理 解是正常的不是本題所問的最佳答案；本題核心在於「多數人的語言優勢半球在左側，而臉孔辨識與負向情緒辨識常偏右半球，因此兩者常位於不同半球。」，因此此選項與關鍵機轉、位置或定義不符。"
      },
      "exam_point": "多數人的語言優勢半球在左側，而臉孔辨識與負向情緒辨識常偏右半球，因此兩者常位於不同半球。",
      "memory_tip": "左語言，右臉孔與空間。",
      "clinical_link": "失語症與臉盲症反映不同半球與皮質網路的特化。",
      "review_flags": [
        "requested_supplement_patch",
        "additional_requested_by_user",
        "question_number_subject_mismatch",
        "content_override_used",
        "additional_question_requested_by_user",
        "official_answer_correction_or_multiple_credit"
      ],
      "source_files": {
        "extracted_from_detailed_file": "moex_med1_remaining_detailed_v4_merged_001_1827.json",
        "source_question_pdf": "113090_1301.pdf",
        "source_answer_pdf": "113090_ANS1301.pdf"
      }
    },
    {
      "id": "moex-med1-supplement-v5-114020-1301-053",
      "upsert_key": "114020-1301-53",
      "source_exam_key": "114020-1301",
      "exam_code": "114020",
      "paper_code": "1301",
      "exam_year_roc": 114,
      "exam_year_gregorian": 2025,
      "exam_session": "第一次",
      "question_no": 53,
      "requested_group": "additional_requested_by_user",
      "action": "upsert_or_replace_by_upsert_key",
      "subject_group": "醫學（一）",
      "stem": "一 名未有先天或退化腦傷病史的職業殺手，在車禍意外撞傷頭部昏迷約十數小時，復甦後剛開始竟想不起自 己的職業、姓名、此次旅行目的等屬於事實的知識，但殺手過去有的技術與身手俱在，而後逐漸回憶起幾乎 所有知道的事實。下列關於該個案的敘述，何項最適當？",
      "options": {
        "A": "個 案所擁有的「事實」的知識，應是屬於內隱記憶（implicit memory），而「身手」是外顯記憶 （explicit memory）",
        "B": "個 案所擁有的「事實」的知識，應是屬於外顯記憶（explicit memory），而「身手」是內隱記憶 （implicit memory）",
        "C": "個 案所擁有的「事實」的知識與「身手」，皆是內隱記憶（implicit memory）",
        "D": "個 案所擁有的「事實」的知識與「身手」，皆是外顯記憶（explicit memory）"
      },
      "official_answer_raw": "B",
      "correct_answers": [
        "B"
      ],
      "answer_credit_type": "standard",
      "answer_note": "",
      "classification_v5": {
        "primary_subject_exact": "神經科學/生理學",
        "topic_section": "記憶系統",
        "subtopic": "declarative/procedural memory",
        "five_subject_bucket_if_app_requires": "生理學",
        "original_question_no_used": 53,
        "question_number_default_bucket": "生理學",
        "classification_method": "original_question_number_rule_checked_by_content",
        "confidence": "high",
        "legacy_non_five_subject": false,
        "original_classification": {
          "primary_subject": "神經科學",
          "topic_section": "記憶分類",
          "track": "med1_remaining_completed_batch17",
          "classification_confidence": 0.85
        },
        "notes": "已依題號與內容確認歸類。"
      },
      "explanation": "正確答案是B。事實、姓名、職業屬外顯記憶；技術與身手屬內隱或程序性記憶。 這是本題判斷的主軸；讀題時先抓「何者錯誤／最不適當／最適當」這類關鍵字，再把選項放回該生理或分子機轉中檢查。",
      "option_analysis": {
        "A": "錯。個 案所擁有的「事實」的知識，應是屬於內隱記憶（implicit memory），而「身手」是外顯記憶 （explicit memory）不是本題所問的最佳答案；本題核心在於「事實、姓名、職業屬外顯記憶；技術與身手屬內隱或程序性記憶。」，因此此選項與關鍵機轉、位置或定義不符。",
        "B": "正確。個 案所擁有的「事實」的知識，應是屬於外顯記憶（explicit memory），而「身手」是內隱記憶 （implicit memory）符合本題核心：事實、姓名、職業屬外顯記憶；技術與身手屬內隱或程序性記憶。",
        "C": "錯。個 案所擁有的「事實」的知識與「身手」，皆是內隱記憶（implicit memory）不是本題所問的最佳答案；本題核心在於「事實、姓名、職業屬外顯記憶；技術與身手屬內隱或程序性記憶。」，因此此選項與關鍵機轉、位置或定義不符。",
        "D": "錯。個 案所擁有的「事實」的知識與「身手」，皆是外顯記憶（explicit memory）不是本題所問的最佳答案；本題核心在於「事實、姓名、職業屬外顯記憶；技術與身手屬內隱或程序性記憶。」，因此此選項與關鍵機轉、位置或定義不符。"
      },
      "exam_point": "事實、姓名、職業屬外顯記憶；技術與身手屬內隱或程序性記憶。",
      "memory_tip": "事實=explicit；技能=implicit。",
      "clinical_link": "海馬與內側顳葉對外顯記憶特別重要。",
      "review_flags": [
        "requested_supplement_patch",
        "additional_requested_by_user",
        "additional_question_requested_by_user",
        "official_answer_correction_or_multiple_credit"
      ],
      "source_files": {
        "extracted_from_detailed_file": "moex_med1_remaining_detailed_v4_merged_001_1827.json",
        "source_question_pdf": "114020_1301.pdf",
        "source_answer_pdf": "114020_MOD1301.pdf"
      }
    },
    {
      "id": "moex-med1-supplement-v5-115020-1301-066",
      "upsert_key": "115020-1301-66",
      "source_exam_key": "115020-1301",
      "exam_code": "115020",
      "paper_code": "1301",
      "exam_year_roc": 115,
      "exam_year_gregorian": 2026,
      "exam_session": "第一次",
      "question_no": 66,
      "requested_group": "reported_missing_by_user",
      "action": "upsert_or_replace_by_upsert_key",
      "subject_group": "醫學（一）",
      "stem": "關於氨的排泄，下列敘述何者最不適當？",
      "options": {
        "A": "肝臟會將有毒的氨轉變為尿素（urea）或麩醯胺酸（glutamine），兩者都是腎臟排出體外",
        "B": "尿素（urea）從尿液的排出會受血管加壓素（vasopressin）的表現而下降",
        "C": "麩醯胺酸（glutamine）在腎臟中的代謝量，會因為代謝性酸中毒而增加",
        "D": "尿素（urea）的再吸收是初級主動運輸通道表現上升，促使尿素的再吸收"
      },
      "official_answer_raw": "#",
      "correct_answers": [
        "#"
      ],
      "answer_credit_type": "standard",
      "answer_note": "",
      "classification_v5": {
        "primary_subject_exact": "生理學",
        "topic_section": "腎臟生理/酸鹼",
        "subtopic": "氨排泄",
        "five_subject_bucket_if_app_requires": "生理學",
        "original_question_no_used": 66,
        "question_number_default_bucket": "生理學",
        "classification_method": "original_question_number_rule_checked_by_content",
        "confidence": "high",
        "legacy_non_five_subject": false,
        "original_classification": {
          "primary_subject": "解剖學",
          "body_region": "腹部",
          "topic_section": "肝膽胰脾",
          "anatomy_track": true,
          "classification_confidence": 0.78,
          "subject_confidence": 0.75,
          "region_confidence": 0.82,
          "method": "v2_rule_based_keyword_plus_known_manual_checks",
          "subject_scores": {
            "微生物免疫學/寄生蟲學": 0,
            "公共衛生學": 0,
            "生物化學": 1,
            "生理學": 0,
            "胚胎及發育生物學": 0,
            "組織學": 0,
            "解剖學": 2
          },
          "manual_note": ""
        },
        "notes": "已依題號與內容確認歸類。"
      },
      "explanation": "官方題目採疑義處理。就生理概念而言，尿素再吸收主要經尿素轉運蛋白（如UT-A）進行 facilitated diffusion，且受ADH調控，並非初級主動運輸通道。因此D是最可疑的錯誤敘述，但此題應依官方#標記保留。",
      "option_analysis": {
        "A": "官方題目疑義／刪題標記。若仍用學理判斷，本題核心考點是：尿素排泄與腎臟尿素轉運。",
        "B": "官方題目疑義／刪題標記。若仍用學理判斷，本題核心考點是：尿素排泄與腎臟尿素轉運。",
        "C": "官方題目疑義／刪題標記。若仍用學理判斷，本題核心考點是：尿素排泄與腎臟尿素轉運。",
        "D": "官方題目疑義／刪題標記。若仍用學理判斷，本題核心考點是：尿素排泄與腎臟尿素轉運。"
      },
      "exam_point": "尿素排泄與腎臟尿素轉運",
      "memory_tip": "urea靠transporter，不是primary active transport。",
      "clinical_link": "ADH增加內髓集尿管尿素通透性，幫助髓質高滲梯度。",
      "review_flags": [
        "not_strict_anatomy_misclassified",
        "needs_removal_from_anatomy_track",
        "official_modified_or_multiple_credit",
        "official_deleted_or_disputed_item",
        "requested_supplement_patch",
        "reported_missing_by_user",
        "reported_missing_in_user_integrity_check",
        "official_answer_correction_or_multiple_credit"
      ],
      "source_files": {
        "extracted_from_detailed_file": "moex_anatomy_strict_detailed_v3_merged_001_973.json",
        "source_question_pdf": "115020_1301.pdf",
        "source_answer_pdf": "115020_MOD1301.pdf"
      }
    },
    {
      "id": "moex-med1-supplement-v5-115020-1301-095",
      "upsert_key": "115020-1301-95",
      "source_exam_key": "115020-1301",
      "exam_code": "115020",
      "paper_code": "1301",
      "exam_year_roc": 115,
      "exam_year_gregorian": 2026,
      "exam_session": "第一次",
      "question_no": 95,
      "requested_group": "reported_missing_by_user",
      "action": "upsert_or_replace_by_upsert_key",
      "subject_group": "醫學（一）",
      "stem": "下列何種物質主要是在小腸形成，並幫助將三酸甘油酯（triglyceride）運送到肝臟？",
      "options": {
        "A": "chylomicron",
        "B": "high-density lipoprotein",
        "C": "intermediate-density lipoprotein",
        "D": "ApoB-100"
      },
      "official_answer_raw": "ALL",
      "correct_answers": [
        "ALL"
      ],
      "answer_credit_type": "all_credit",
      "answer_note": "第95題一律給分",
      "classification_v5": {
        "primary_subject_exact": "生物化學",
        "topic_section": "脂質代謝",
        "subtopic": "chylomicron",
        "five_subject_bucket_if_app_requires": "生物化學",
        "original_question_no_used": 95,
        "question_number_default_bucket": "生物化學",
        "classification_method": "original_question_number_rule_checked_by_content",
        "confidence": "high",
        "legacy_non_five_subject": false,
        "original_classification": {
          "primary_subject": "解剖學",
          "body_region": "腹部",
          "topic_section": "肝膽胰脾",
          "anatomy_track": true,
          "classification_confidence": 0.78,
          "subject_confidence": 0.75,
          "region_confidence": 0.82,
          "method": "v2_rule_based_keyword_plus_known_manual_checks",
          "subject_scores": {
            "微生物免疫學/寄生蟲學": 0,
            "公共衛生學": 0,
            "生物化學": 0,
            "生理學": 0,
            "胚胎及發育生物學": 0,
            "組織學": 0,
            "解剖學": 1
          },
          "manual_note": ""
        },
        "notes": "已依題號與內容確認歸類。"
      },
      "explanation": "官方採一律給分。一般而言，小腸形成的是乳糜微粒（chylomicron），用於運送飲食三酸甘油酯，先經淋巴進入血液並主要送往脂肪與肌肉，殘餘再由肝臟攝取；題幹「運送到肝臟」使題意有瑕疵。",
      "option_analysis": {
        "A": "官方採一律給分或特殊採計；A選項需依題幹瑕疵一起保留。考點：小腸脂質運輸與乳糜微粒。",
        "B": "官方採一律給分或特殊採計；B選項需依題幹瑕疵一起保留。考點：小腸脂質運輸與乳糜微粒。",
        "C": "官方採一律給分或特殊採計；C選項需依題幹瑕疵一起保留。考點：小腸脂質運輸與乳糜微粒。",
        "D": "官方採一律給分或特殊採計；D選項需依題幹瑕疵一起保留。考點：小腸脂質運輸與乳糜微粒。"
      },
      "exam_point": "小腸脂質運輸與乳糜微粒",
      "memory_tip": "小腸做chylomicron；ApoB-48不是ApoB-100。",
      "clinical_link": "脂質吸收異常會造成脂肪便與脂溶性維生素缺乏。",
      "review_flags": [
        "official_modified_or_multiple_credit",
        "not_strict_anatomy_misclassified",
        "needs_removal_from_anatomy_track",
        "requested_supplement_patch",
        "reported_missing_by_user",
        "reported_missing_in_user_integrity_check",
        "official_answer_correction_or_multiple_credit"
      ],
      "source_files": {
        "extracted_from_detailed_file": "moex_anatomy_strict_detailed_v3_merged_001_973.json",
        "source_question_pdf": "115020_1301.pdf",
        "source_answer_pdf": "115020_MOD1301.pdf"
      }
    },
    {
      "id": "moex-med1-supplement-v5-115020-1301-098",
      "upsert_key": "115020-1301-98",
      "source_exam_key": "115020-1301",
      "exam_code": "115020",
      "paper_code": "1301",
      "exam_year_roc": 115,
      "exam_year_gregorian": 2026,
      "exam_session": "第一次",
      "question_no": 98,
      "requested_group": "additional_requested_by_user",
      "action": "upsert_or_replace_by_upsert_key",
      "subject_group": "醫學（一）",
      "stem": "Protein kinase A（PKA）是一種磷酸化激酶，可催化在其受質蛋白中的何種胺基酸上進行磷酸化 （phosphorylation）？",
      "options": {
        "A": "組胺酸（histidine）",
        "B": "蘇胺酸（threonine）",
        "C": "酪胺酸（tyrosine）",
        "D": "麩胺酸（glutamate）"
      },
      "official_answer_raw": "B",
      "correct_answers": [
        "B"
      ],
      "answer_credit_type": "standard",
      "answer_note": "",
      "classification_v5": {
        "primary_subject_exact": "生物化學",
        "topic_section": "細胞訊號傳遞",
        "subtopic": "PKA phosphorylation",
        "five_subject_bucket_if_app_requires": "生物化學",
        "original_question_no_used": 98,
        "question_number_default_bucket": "生物化學",
        "classification_method": "original_question_number_rule_checked_by_content",
        "confidence": "high",
        "legacy_non_five_subject": false,
        "original_classification": {
          "primary_subject": "細胞訊號傳遞／蛋白質磷酸化",
          "topic_section": "PKA 磷酸化 Ser/Thr",
          "track": "med1_remaining_detailed_v4",
          "classification_confidence": 0.96
        },
        "notes": "已依題號與內容確認歸類。"
      },
      "explanation": "Protein kinase A 是 cAMP-dependent protein kinase，屬於 serine/threonine kinase，會磷酸化受質蛋白上的 serine 或 threonine 殘基。本題選項中只有 threonine 符合。",
      "option_analysis": {
        "A": "錯。Histidine phosphorylation 存在於某些細菌 two-component system，但不是 PKA 的主要受質胺基酸。",
        "B": "正確。PKA 是 serine/threonine kinase，可磷酸化 threonine。",
        "C": "錯。Tyrosine phosphorylation 由 receptor tyrosine kinase 或 non-receptor tyrosine kinase 執行，不是 PKA 典型功能。",
        "D": "錯。Glutamate 不是常見蛋白激酶磷酸化位點。"
      },
      "exam_point": "PKA = cAMP-dependent Ser/Thr kinase。",
      "memory_tip": "PKA、PKC 多記 Ser/Thr；RTK 記 Tyr。",
      "clinical_link": "Glucagon 與 epinephrine 可經 cAMP-PKA 路徑調控肝醣代謝與脂解。",
      "review_flags": [
        "requested_supplement_patch",
        "additional_requested_by_user",
        "additional_question_requested_by_user",
        "official_answer_correction_or_multiple_credit"
      ],
      "source_files": {
        "extracted_from_detailed_file": "moex_med1_remaining_detailed_v4_merged_001_1827.json",
        "source_question_pdf": "115020_1301.pdf",
        "source_answer_pdf": "115020_MOD1301.pdf"
      }
    }
  ]
} as const;
export default moexMed1Requested71QuestionsDetailedPatchV5;
