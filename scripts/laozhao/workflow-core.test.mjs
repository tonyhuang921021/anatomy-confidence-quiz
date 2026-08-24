import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  auditWorkflowContent,
  buildPrivateChapterPackage,
  buildReadablePackageStem,
  buildRepairFileNames,
  buildRepairFocus,
  buildSourceBoundaryPromptLines,
  buildUnresolvedEvidencePlan,
  collectLectureNotesPreflightErrors,
  collectLostTeacherEmphasisSignals,
  collectTeacherEmphasisIssues,
  writeState,
  normalizeChapterTimesForImport,
  validateAndNormalizeReviewedCaptions
} from "./workflow-core.mjs";
import {
  findNonTaiwanCaptions,
  normalizeTaiwanMedicalText
} from "./subtitle-proofreading-core.mjs";

function caption(id, startSec, endSec, text) {
  return {
    id,
    startSec,
    endSec,
    text,
    sourceSegmentStart: 1,
    sourceSegmentEnd: 1,
    sourceSegmentCount: 1
  };
}

function sha256Text(value) {
  return createHash("sha256").update(value).digest("hex");
}

test("醫學與臺灣常用詞不會被一般繁簡轉換誤判", () => {
  const texts = [
    "翼腭窩與深岩神經",
    "遠端關節面",
    "游離椎分布在前後兩端",
    "先公布答案，占兩塊",
    "一根典型肋骨頭不是只接一個椎體",
    "circumflex 可念作回旋，並以梁柱比喻"
  ];
  const issues = findNonTaiwanCaptions(texts.map((text, index) => caption(`cue-${index}`, index, index + 1, text)));
  assert.deepEqual(issues, []);
});

test("校訂字幕刪掉基底中的老師強調會被列入修補焦點", () => {
  const base = [
    caption("cue-00001", 0, 2, "這個地方要背好。"),
    caption("cue-00002", 2, 4, "小心不要混淆。"),
    caption("cue-00003", 4, 6, "一般說明。")
  ];
  const reviewed = [
    caption("cue-00001", 0, 2, "這個地方。"),
    caption("cue-00002", 2, 4, "小心不要混淆。"),
    caption("cue-00003", 4, 6, "一般說明。")
  ];
  assert.deepEqual(collectLostTeacherEmphasisSignals(base, reviewed), [{
    captionId: "cue-00001",
    baseText: "這個地方要背好。",
    reviewedText: "這個地方。"
  }]);
});

test("只自動套用明確安全的臺灣字形", () => {
  const result = normalizeTaiwanMedicalText("講台後面是齶骨與鼻梁，去念這一段");
  assert.equal(result.text, "講臺後面是腭骨與鼻樑，去唸這一段");
  assert.equal(result.changes.length, 4);
});

test("共用小數章節邊界只正規化一次", () => {
  const input = {
    chapters: [
      { startSec: 0, endSec: 1012.62, representativeFrameTargetSec: 1000.4 },
      { startSec: 1012.62, endSec: 1200.2, representativeFrameTargetSec: 1199.8 }
    ]
  };
  const result = normalizeChapterTimesForImport(input);
  assert.equal(result.draft.chapters[0].endSec, 1013);
  assert.equal(result.draft.chapters[1].startSec, 1013);
  assert.equal(result.draft.chapters[0].representativeFrameTargetSec, 1000);
  assert.equal(result.draft.chapters[1].representativeFrameTargetSec, null);
  assert.equal(input.chapters[0].endSec, 1012.62);
});

test("本機正規化不會把真正的章節重疊假裝成共用邊界", () => {
  const input = {
    chapters: [
      { startSec: 0, endSec: 1012.9, representativeFrameTargetSec: null },
      { startSec: 1011.1, endSec: 1200, representativeFrameTargetSec: null }
    ]
  };
  const result = normalizeChapterTimesForImport(input);
  assert.equal(result.draft.chapters[0].endSec, 1013);
  assert.equal(result.draft.chapters[1].startSec, 1011);
  assert.ok(result.draft.chapters[1].startSec < result.draft.chapters[0].endSec);
});

test("字幕驗證一次列出所有需要人工確認的 cue", () => {
  const base = [
    caption("cue-00001", 0, 1, "原文一"),
    caption("cue-00002", 1, 2, "原文二")
  ];
  const reviewed = {
    videoId: "ATFBb25QRNw",
    sourceFingerprint: "a".repeat(64),
    captions: [
      { ...base[0], text: "这边" },
      { ...base[1], text: "后边" }
    ]
  };
  const result = validateAndNormalizeReviewedCaptions(reviewed, base, "ATFBb25QRNw", "a".repeat(64));
  assert.equal(result.valid, false);
  assert.equal(result.structureValid, true);
  assert.equal(result.taiwanIssues.length, 2);
  assert.match(result.errors[0], /2 段/);
});

test("字幕過度縮短會阻擋匯入但仍允許後續結構預檢", () => {
  const base = [caption(
    "cue-00001",
    0,
    1,
    "這一段包含定義、三個方向、重要數字與老師提醒，不能在校對時整段刪掉。"
  )];
  const reviewed = {
    videoId: "ATFBb25QRNw",
    sourceFingerprint: "a".repeat(64),
    captions: [{ ...base[0], text: "這段要記。" }]
  };
  const result = validateAndNormalizeReviewedCaptions(reviewed, base, "ATFBb25QRNw", "a".repeat(64));
  assert.equal(result.valid, false);
  assert.equal(result.structureValid, true);
  assert.equal(result.compressionIssues.length, 1);
  assert.match(result.errors.at(-1), /縮短超過 45%/);
});

test("逐段核對且文字指紋相符的純贅詞刪減可以解除縮短警報", () => {
  const base = [caption(
    "cue-00001",
    0,
    1,
    "好，好，好，我們現在來看橫膈膜。來看這個橫膈膜。各位看一下橫膈膜。橫膈膜是最重要的吸氣肌。"
  )];
  const reviewedText = "橫膈膜是最重要的吸氣肌。";
  const reviewed = {
    videoId: "ATFBb25QRNw",
    sourceFingerprint: "a".repeat(64),
    captions: [{ ...base[0], text: reviewedText }],
    compressionReviews: [{
      captionId: "cue-00001",
      disposition: "verified_cleanup",
      reason: "repetition_only",
      baseTextSha256: sha256Text(base[0].text),
      reviewedTextSha256: sha256Text(reviewedText)
    }]
  };
  const result = validateAndNormalizeReviewedCaptions(reviewed, base, "ATFBb25QRNw", "a".repeat(64));
  assert.equal(result.valid, true);
  assert.deepEqual(result.compressionIssues, []);
  assert.equal(result.acknowledgedCompressionIssues.length, 1);
  assert.equal(result.acknowledgedCompressionIssues[0].captionId, "cue-00001");
  assert.equal(result.acknowledgedCompressionIssues[0].reason, "repetition_only");
  assert.ok(result.acknowledgedCompressionIssues[0].retainedRatio < 0.55);
});

test("字幕改過後沿用舊的縮短審核指紋會被阻擋", () => {
  const base = [caption(
    "cue-00001",
    0,
    1,
    "這一段包含定義、三個方向、重要數字與老師提醒，不能在校對時整段刪掉。"
  )];
  const reviewed = {
    videoId: "ATFBb25QRNw",
    sourceFingerprint: "a".repeat(64),
    captions: [{ ...base[0], text: "這段要記。" }],
    compressionReviews: [{
      captionId: "cue-00001",
      disposition: "verified_cleanup",
      reason: "filler_only",
      baseTextSha256: sha256Text(base[0].text),
      reviewedTextSha256: sha256Text("另一版文字。")
    }]
  };
  const result = validateAndNormalizeReviewedCaptions(reviewed, base, "ATFBb25QRNw", "a".repeat(64));
  assert.equal(result.valid, false);
  assert.equal(result.compressionIssues.length, 1);
  assert.match(result.errors.join("\n"), /reviewedTextSha256/);
});

test("目前沒有縮短警報的舊審核憑證會安全忽略", () => {
  const base = [caption(
    "cue-00001",
    0,
    1,
    "老師完整說明橫膈膜是主要吸氣肌。"
  )];
  const reviewed = {
    videoId: "ATFBb25QRNw",
    sourceFingerprint: "a".repeat(64),
    captions: [{ ...base[0], text: "老師完整說明橫膈膜是主要吸氣肌。" }],
    compressionReviews: [{
      captionId: "cue-00001",
      disposition: "verified_cleanup",
      reason: "repetition_only",
      baseTextSha256: "0".repeat(64),
      reviewedTextSha256: "1".repeat(64)
    }]
  };
  const result = validateAndNormalizeReviewedCaptions(reviewed, base, "ATFBb25QRNw", "a".repeat(64));
  assert.equal(result.valid, true);
  assert.deepEqual(result.compressionIssues, []);
  assert.deepEqual(result.ignoredStaleCompressionReviews, ["cue-00001"]);
});

test("工作包檔名使用課程順序與影片標題，不暴露機器識別碼", () => {
  assert.equal(buildReadablePackageStem({
    position: 5,
    videoTitle: "2016DF03-01",
    promptVersion: "laozhao-full-video-review-v2"
  }), "老趙解剖_第05支_2016DF03-01_完整校對_v2");
});

test("修補包檔名包含易讀名稱、固定輪次且輸入輸出不混淆", () => {
  assert.deepEqual(buildRepairFileNames("老趙解剖_第05支_2016DF03-01_完整校對_v2", 3), {
    token: "r03",
    input: "老趙解剖_第05支_2016DF03-01_完整校對_v2_修補_r03_工作包.zip",
    result: "老趙解剖_第05支_2016DF03-01_完整校對_v2_修補_r03_回傳包.zip"
  });
});

test("來源檔在上下集切點結束不會形成永久 unresolved", () => {
  const guidance = buildSourceBoundaryPromptLines().join("\n");
  assert.match(guidance, /來源邊界/);
  assert.match(guidance, /不要放入 unresolved\.json/);
  assert.match(guidance, /不要補寫影片外內容/);
  assert.doesNotMatch(guidance, /needs='continuation'.*保留/);
  assert.doesNotMatch(guidance, /來源邊界.*continuation/);
});

test("通過 Chat 驗證的章節會補齊板書抽取所需的私人來源欄位", () => {
  const sourceMediaSha256 = "b".repeat(64);
  const result = buildPrivateChapterPackage({
    videoId: "ATFBb25QRNw",
    videoTitle: "解剖學",
    durationSec: 3600,
    sourceFingerprint: "a".repeat(64),
    sourceMediaSha256,
    sourceFilename: "ATFBb25QRNw.mp4",
    sourceSizeBytes: 123456
  }, [{
    id: "ATFBb25QRNw-ch-001",
    position: 0,
    videoId: "ATFBb25QRNw",
    title: "第一章",
    startSec: 0,
    endSec: 3600,
    reviewStatus: "draft",
    rightsStatus: "private_only"
  }]);

  assert.equal(result.rightsStatus, "private_only");
  assert.equal(result.reviewStatus, "draft");
  assert.equal(result.requiresHumanReview, true);
  assert.equal(result.sourceMediaSha256, sourceMediaSha256);
  assert.equal(result.sourceFilename, "ATFBb25QRNw.mp4");
  assert.equal(result.chapters.length, 1);
});

test("流程狀態永遠升級成目前契約版本，不沿用舊版欄位", async () => {
  let written = null;
  const paths = { state: "/private/tmp/laozhao-workflow-state-test.json" };
  await writeState(paths, {
    schemaVersion: "0.9.0",
    workflowVersion: "laozhao-chatgpt-pro-workflow-v1",
    state: "waiting_for_chat"
  });
  written = JSON.parse(await (await import("node:fs/promises")).readFile(paths.state, "utf8"));
  assert.equal(written.schemaVersion, "1.0.0");
  assert.equal(written.workflowVersion, "laozhao-chatgpt-pro-workflow-v2");
});

test("修補焦點分開必修缺漏與只供抽查的弱訊號", () => {
  assert.deepEqual(buildRepairFocus({
    errors: ["章節重疊"],
    audit: {
      missingSignals: ["V1"],
      weakMissingSignals: ["13 頁", "D3"]
    }
  }), {
    errors: ["章節重疊"],
    missingSignals: ["V1"],
    weakMissingSignals: ["13 頁", "D3"],
    taiwanIssues: [],
    unresolved: [],
    teacherEmphasisIssues: [],
    compressionIssues: [],
    lostTeacherEmphasisSignals: [],
    actionCount: 2
  });
});

test("未解疑點證據計畫只擷取對應 cue 並保留前後文", () => {
  const captions = [
    caption("cue-00001", 0, 2, "前文。"),
    caption("cue-00002", 2, 5, "聽不清楚。"),
    caption("cue-00003", 5, 7, "後文。")
  ];
  const plans = buildUnresolvedEvidencePlan({
    unresolved: [{ captionId: "cue-00002", needs: "board" }, { captionId: "cue-missing", needs: "audio" }],
    captions,
    durationSec: 7
  });
  assert.equal(plans.length, 1);
  assert.equal(plans[0].captionId, "cue-00002");
  assert.equal(plans[0].startSec, 0);
  assert.equal(plans[0].endSec, 7);
  assert.deepEqual(plans[0].context.map((item) => item.id), ["cue-00001", "cue-00002", "cue-00003"]);
});

test("講義預檢會一次列出所有跨章區塊", () => {
  const captions = [
    caption("cue-00001", 0, 5, "第一章。"),
    caption("cue-00002", 5, 10, "第一章結尾。"),
    caption("cue-00003", 10, 15, "第二章。"),
    caption("cue-00004", 15, 20, "第二章結尾。")
  ];
  const chapters = [
    { id: "chapter-1", startSec: 0, endSec: 10 },
    { id: "chapter-2", startSec: 10, endSec: 20 }
  ];
  const errors = collectLectureNotesPreflightErrors({
    blocks: [{
      id: "block-1",
      provenance: "teacher",
      sourceCaptionStart: "cue-00001",
      sourceCaptionEnd: "cue-00003"
    }, {
      id: "block-2",
      provenance: "teacher",
      sourceCaptionStart: "cue-00004",
      sourceCaptionEnd: "cue-00004"
    }]
  }, captions, chapters);
  assert.equal(errors.filter((error) => error.includes("跨越章節")).length, 1);
});

test("講義預檢會一次列出所有過長區塊", () => {
  const captions = Array.from({ length: 40 }, (_, index) => (
    caption(`cue-${String(index + 1).padStart(5, "0")}`, index, index + 1, `第 ${index + 1} 段`)
  ));
  const errors = collectLectureNotesPreflightErrors({
    blocks: [
      { id: "block-1", provenance: "teacher", sourceCaptionStart: "cue-00001", sourceCaptionEnd: "cue-00020" },
      { id: "block-2", provenance: "teacher", sourceCaptionStart: "cue-00021", sourceCaptionEnd: "cue-00040" }
    ]
  }, captions);
  assert.equal(errors.length, 2);
  assert.match(errors[0], /20 段/);
  assert.match(errors[1], /20 段/);
});

test("講義預檢會一次列出所有子清單結構問題", () => {
  const captions = [caption("cue-00001", 0, 1, "測試字幕。")];
  const tooManyChildren = Array.from({ length: 15 }, (_, index) => ({ text: `子項 ${index + 1}` }));
  const errors = collectLectureNotesPreflightErrors({
    blocks: [{
      id: "block-1",
      type: "bullets",
      provenance: "teacher",
      sourceCaptionStart: "cue-00001",
      sourceCaptionEnd: "cue-00001",
      points: [{ text: "第一點", children: tooManyChildren }]
    }, {
      id: "block-2",
      type: "bullets",
      provenance: "supplement",
      points: [{
        text: "第一層",
        children: [{
          text: "第二層",
          children: [{
            text: "第三層",
            children: [{
              text: "第四層",
              children: [{ text: "第五層" }]
            }]
          }]
        }]
      }]
    }]
  }, captions);
  assert.equal(errors.filter((error) => error.includes("下層項目格式無效")).length, 1);
  assert.equal(errors.filter((error) => error.includes("超過四層共筆結構")).length, 1);
});

test("講義預檢一次列出全部偽造強調並接受含相鄰明確訊號的證據", () => {
  const captions = [
    caption("cue-00001", 0, 1, "肩關節很重要。"),
    caption("cue-00002", 1, 2, "肩關節由肱骨頭與關節盂構成。"),
    caption("cue-00003", 2, 3, "喙突相關肌肉共有三塊。"),
    caption("cue-00004", 3, 4, "最後要記住這個整理。")
  ];
  const errors = collectLectureNotesPreflightErrors({
    blocks: [
      {
        id: "teacher-1",
        provenance: "teacher",
        sourceCaptionStart: "cue-00001",
        sourceCaptionEnd: "cue-00002",
        teacherEmphasis: [{ phrase: "很重要", evidenceStartCue: "cue-00002", evidenceEndCue: "cue-00002" }],
        points: [{
          text: "肩關節構成。",
          teacherEmphasis: [{ phrase: "很重要", evidenceStartCue: "cue-00002", evidenceEndCue: "cue-00002" }]
        }]
      },
      {
        id: "supplement-1",
        provenance: "supplement",
        points: [{
          text: "補充。",
          teacherEmphasis: [{ phrase: "重要", evidenceStartCue: "cue-00001", evidenceEndCue: "cue-00001" }]
        }]
      },
      {
        id: "teacher-2",
        provenance: "teacher",
        sourceCaptionStart: "cue-00003",
        sourceCaptionEnd: "cue-00004",
        teacherEmphasis: [{ phrase: "要記住", evidenceStartCue: "cue-00003", evidenceEndCue: "cue-00004" }],
        points: [{
          text: "喙突相關肌肉。",
          teacherEmphasis: [{ phrase: "重要", evidenceStartCue: "cue-00003", evidenceEndCue: "cue-00003" }]
        }]
      }
    ]
  }, captions);
  assert.equal(errors.length, 4);
  assert.match(errors[0], /第 1 個講義區塊第 1 個老師強調/);
  assert.match(errors[1], /第 1 個講義區塊第 1 點第 1 個老師強調/);
  assert.match(errors[2], /補充內容/);
  assert.match(errors[3], /第 3 個講義區塊第 1 點第 1 個老師強調/);
  assert.equal(errors.some((error) => error.includes("第 3 個講義區塊第 1 個老師強調")), false);

  const issues = collectTeacherEmphasisIssues({
    blocks: [{
      id: "teacher-1",
      provenance: "teacher",
      sourceCaptionStart: "cue-00001",
      sourceCaptionEnd: "cue-00002",
      teacherEmphasis: [{ phrase: "很重要", evidenceStartCue: "cue-00002", evidenceEndCue: "cue-00002" }]
    }]
  }, captions.slice(0, 2));
  assert.equal(issues.length, 1);
  assert.deepEqual(issues[0].nearbyExplicitCues, [{ id: "cue-00001", text: "肩關節很重要。" }]);
  assert.match(issues[0].suggestedAction, /延伸 evidence/);
});

test("內容稽核可以計算多個方向詞而不拋出例外", async () => {
  const result = auditWorkflowContent({
    captions: [caption("cue-00001", 0, 1, "由前往後，再由內向外。")],
    lectureNotes: {
      blocks: [{ text: "由前往後，再由內向外。" }]
    }
  });
  assert.equal(result.sourceDirectionCount, 4);
  assert.equal(result.noteDirectionCount, 4);
});

test("內容稽核忽略空格與標點差異，不把同一數值敘述誤判遺漏", () => {
  const result = auditWorkflowContent({
    captions: [caption("cue-00001", 0, 1, "人體共有 12 對肋骨。")],
    lectureNotes: {
      blocks: [{ text: "人體共有12對肋骨" }]
    }
  });
  assert.deepEqual(result.missingSignals, []);
  assert.equal(result.status, "passed");
});

test("內容稽核將單一解剖編號視為已被講義範圍涵蓋", () => {
  const result = auditWorkflowContent({
    captions: [caption("cue-00001", 0, 1, "胸椎 T8 與肋骨 R3、薦椎 S3。")],
    lectureNotes: {
      blocks: [{ text: "胸椎由 T5 延伸至 T9；典型肋骨為 R2–R9；薦椎標示 S1-S5。" }]
    }
  });
  assert.deepEqual(result.missingSignals, []);
  assert.equal(result.status, "passed");
});

test("內容稽核辨識羅馬數字範圍與以端點重述的解剖範圍", () => {
  const result = auditWorkflowContent({
    captions: [caption("cue-00001", 0, 1, "腦神經 III、VI、VIII；R10–R12；脊髓到 L1–L2。")],
    lectureNotes: {
      blocks: [{ text: "第 I–XII 對腦神經；R10、R11、R12；脊髓約止於 L1，最多到 L2。" }]
    }
  });
  assert.deepEqual(result.missingSignals, []);
  assert.equal(result.status, "passed");
});

test("內容稽核接受白名單內的臺灣中文醫學同義詞", () => {
  const result = auditWorkflowContent({
    captions: [caption("cue-00001", 0, 1, "subclavian vessels, humeroulnar innervation, spinous articular transverse processes and IVD")],
    lectureNotes: {
      blocks: [{ text: "鎖骨下血管、肱尺關節與神經支配；棘突、關節突、橫突和椎間盤。" }]
    }
  });
  assert.deepEqual(result.missingSignals, []);
  assert.equal(result.status, "passed");
});

test("內容稽核將頁碼與一般計數保留為抽查警告而不阻擋匯入", () => {
  const result = auditWorkflowContent({
    captions: [caption("cue-00001", 0, 1, "請參考第 25 頁、第 2 層與 D3。")],
    lectureNotes: {
      blocks: [{ text: "接著說明深層構造。" }]
    }
  });
  assert.deepEqual(result.missingSignals, []);
  assert.deepEqual(result.weakMissingSignals, ["25 頁", "2 層", "D3"]);
  assert.equal(result.status, "passed");
});
