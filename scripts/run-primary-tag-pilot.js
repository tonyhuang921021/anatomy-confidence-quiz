const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const projectRoot = path.resolve(__dirname, "..");
const pilotDir = path.join(projectRoot, "reports", "primary-tag-pilot");
const defaultInputFilename = "pilot-30-input.json";
const taxonomyPath = path.join(projectRoot, "data", "analysisPrimaryTagTaxonomy.json");
const secretPath = path.join(projectRoot, ".env.classification.local");
const promptVersion = "primary-tag-pilot-v5-input-quality-flags";
const allowedTaskTypes = new Set([
  "記憶辨識",
  "機轉推理",
  "數值計算",
  "圖像判讀",
  "鑑別比較",
  "臨床應用"
]);
const modelPrices = {
  "gpt-5.4-nano": { input: 0.2, output: 1.25 },
  "gpt-5.4-mini": { input: 0.75, output: 4.5 },
  "gpt-5.4": { input: 2.5, output: 15 }
};

function parseArgs(argv) {
  const options = {
    model: "gpt-5.4-mini",
    input: defaultInputFilename,
    limit: 30,
    batchSize: 10,
    concurrency: 1,
    ids: [],
    dryRun: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--model") options.model = argv[index + 1] ?? options.model;
    if (value === "--input") options.input = argv[index + 1] ?? options.input;
    if (value === "--limit") options.limit = Number(argv[index + 1]) || options.limit;
    if (value === "--batch-size") options.batchSize = Number(argv[index + 1]) || options.batchSize;
    if (value === "--concurrency") {
      options.concurrency = Number(argv[index + 1]) || options.concurrency;
    }
    if (value === "--ids") {
      options.ids = String(argv[index + 1] ?? "")
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);
    }
    if (value === "--dry-run") options.dryRun = true;
  }
  options.concurrency = Math.max(1, Math.min(5, Math.floor(options.concurrency)));
  return options;
}

function readSecretFile() {
  if (!fs.existsSync(secretPath)) return "";
  const line = fs
    .readFileSync(secretPath, "utf8")
    .split(/\r?\n/)
    .find((item) => item.startsWith("OPENAI_CLASSIFICATION_API_KEY="));
  if (!line) return "";
  return line
    .slice("OPENAI_CLASSIFICATION_API_KEY=".length)
    .trim()
    .replace(/^['"]|['"]$/g, "");
}

function getApiKey() {
  return process.env.OPENAI_CLASSIFICATION_API_KEY?.trim() || readSecretFile();
}

function chunk(items, size) {
  const chunks = [];
  let current = [];
  let currentSubject = "";
  for (const item of items) {
    if (
      current.length > 0 &&
      (current.length >= size || item.trustedSubject !== currentSubject)
    ) {
      chunks.push(current);
      current = [];
    }
    currentSubject = item.trustedSubject;
    current.push(item);
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

function toModelInput(question) {
  const answerCreditType = String(question.answerCreditType ?? "standard").toLowerCase();
  const isAllCredit = answerCreditType === "all_credit";
  return {
    questionId: question.questionId,
    inputSubject: question.trustedSubject,
    stem: question.stem,
    options: question.options,
    correctAnswers: isAllCredit ? [] : question.correctAnswers,
    answerCreditType,
    answerKeyStatus: isAllCredit ? "invalid_all_credit_ignore_for_classification" : "usable",
    answerNote: question.answerNote,
    inputQualityFlags: question.inputQualityFlags ?? [],
    explanation: question.effectiveExplanation
  };
}

function toCandidateTag(tag) {
  return {
    id: tag.id,
    name: tag.name,
    subject: tag.subject,
    definition: tag.definition,
    include: tag.include,
    exclude: tag.exclude,
    borderlineRules: tag.borderlineRules
  };
}

function buildPrompt(questions, taxonomy) {
  const inputSubjects = new Set(questions.map((question) => question.trustedSubject));
  const candidateTags = taxonomy.primaryTags
    .filter((tag) => inputSubjects.has(tag.subject))
    .map(toCandidateTag);

  return [
    "你是台灣醫師國考題庫的知識分類員。請逐題依題幹、選項、正確答案與詳解獨立判斷。",
    "inputSubject 是目前題庫的大科。primaryTagId 只能從同一 inputSubject 的 candidateTags 選一個，不可自行創造標籤。",
    "例如微生物免疫學中的抗真菌治療可歸真菌學；藥理學中考藥物標的、副作用、藥動或選藥時，才歸藥理學。",
    "若題目核心明顯不屬於 inputSubject，primaryTagId 輸出 taxonomyGap、subjectConflict 設 true、suggestedSubject 填建議大科並 needsReview 設 true；不要直接跨科套用標籤。",
    "若大科正確但沒有任何候選標籤可涵蓋，primaryTagId 也輸出 taxonomyGap，subjectConflict 設 false。",
    "每題輸出：questionId、primaryTagId、secondaryTags、taskType、confidence、evidence、needsReview、subjectConflict、suggestedSubject。",
    "secondaryTags 放 1 至 3 個繁體中文細部考點，例如尿道球腺、腎小球過濾、入球與出球小動脈。",
    "secondaryTags 不可填 candidate tag ID、不可重複 primaryTagId 或章節名稱，也不可使用其他、一般、綜合題等空泛詞。",
    "以判斷正確答案真正需要的知識分類，不要被病例故事中的器官名稱帶偏。",
    "taskType 只能是：記憶辨識、機轉推理、數值計算、圖像判讀、鑑別比較、臨床應用。",
    "confidence 是 0 到 1 的數字；evidence 最多 45 個中文字。",
    "若 answerKeyStatus 是 invalid_all_credit_ignore_for_classification，代表官方答案有問題；忽略 correctAnswers，依題幹、選項與詳解判斷原本考點，不可只因一律給分就輸出 taxonomyGap。",
    "若 inputQualityFlags 含 missing_option_text 或 image_required，但題幹與詳解已足以判斷大章節，仍應選 primaryTagId；只有分類本身無法判定時才輸出 taxonomyGap。",
    "資訊不足、承上題缺前文、圖片不可判讀、taxonomyGap 或科目衝突時，needsReview 設為 true。",
    `suggestedSubject 只能是：${taxonomy.scope.subjects.join("、")}。若沒有科目衝突，必須等於 inputSubject。`,
    "輸出必須是 JSON 陣列，順序與輸入相同，不要 markdown，不要額外文字。",
    "",
    `candidateTags=${JSON.stringify(candidateTags)}`,
    `questions=${JSON.stringify(questions.map(toModelInput))}`
  ].join("\n");
}

function extractOutputText(payload) {
  return (payload.output ?? [])
    .flatMap((item) => item.content ?? [])
    .filter((item) => item.type === "output_text" && typeof item.text === "string")
    .map((item) => item.text)
    .join("\n")
    .trim();
}

function parseJsonOutput(text) {
  const normalized = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  return JSON.parse(normalized);
}

function validateTaxonomy(taxonomy) {
  const subjects = new Set(taxonomy?.scope?.subjects ?? []);
  const tags = taxonomy?.primaryTags ?? [];
  const ids = new Set();
  const names = new Set();
  if (!subjects.size || !tags.length || !taxonomy?.taxonomyGap?.id) {
    throw new Error("taxonomy 缺少必要結構。 ");
  }
  tags.forEach((tag) => {
    if (!/^[A-Z][A-Z0-9_]*$/.test(tag.id) || ids.has(tag.id)) {
      throw new Error(`taxonomy id 無效或重複：${tag.id}`);
    }
    if (!tag.name || names.has(tag.name) || !subjects.has(tag.subject)) {
      throw new Error(`taxonomy 名稱重複或科目無效：${tag.id}`);
    }
    if (
      !tag.definition ||
      !["include", "exclude", "aliases", "borderlineRules"].every(
        (key) => Array.isArray(tag[key]) && tag[key].length > 0
      )
    ) {
      throw new Error(`taxonomy 欄位不完整：${tag.id}`);
    }
    ids.add(tag.id);
    names.add(tag.name);
  });
  (taxonomy.subjectSummary ?? []).forEach((summary) => {
    const actual = tags.filter((tag) => tag.subject === summary.subject).length;
    if (actual !== summary.primaryTagCount) {
      throw new Error(`taxonomy 科目數量不符：${summary.subject}`);
    }
  });
}

function validateResults(inputQuestions, results, taxonomy) {
  if (!Array.isArray(results) || results.length !== inputQuestions.length) {
    throw new Error(`輸出題數不符：預期 ${inputQuestions.length}，實際 ${results?.length ?? 0}`);
  }
  const expectedIds = inputQuestions.map((question) => question.questionId);
  const tagsById = new Map(taxonomy.primaryTags.map((tag) => [tag.id, tag]));
  const tagNames = new Set(taxonomy.primaryTags.map((tag) => tag.name));
  const allowedSubjects = new Set(taxonomy.scope.subjects);
  results.forEach((result, index) => {
    const inputQuestion = inputQuestions[index];
    if (result?.questionId !== expectedIds[index]) {
      throw new Error(`第 ${index + 1} 筆 questionId 不符。`);
    }
    if (
      result.primaryTagId !== taxonomy.taxonomyGap.id &&
      !tagsById.has(result.primaryTagId)
    ) {
      throw new Error(`${result.questionId} 的 primaryTagId 不在固定 taxonomy。`);
    }
    const selectedTag = tagsById.get(result.primaryTagId);
    if (selectedTag && selectedTag.subject !== inputQuestion.trustedSubject) {
      throw new Error(`${result.questionId} 選到不同大科的 primaryTagId。`);
    }
    if (
      !Array.isArray(result.secondaryTags) ||
      result.secondaryTags.length < 1 ||
      result.secondaryTags.length > 3 ||
      result.secondaryTags.some(
        (tag) =>
          typeof tag !== "string" ||
          !tag.trim() ||
          tagsById.has(tag) ||
          tagNames.has(tag) ||
          ["其他", "一般", "綜合題"].includes(tag.trim())
      )
    ) {
      throw new Error(`${result.questionId} 的 secondaryTags 格式錯誤。`);
    }
    if (!allowedTaskTypes.has(result.taskType)) {
      throw new Error(`${result.questionId} 的 taskType 不在允許清單。`);
    }
    if (typeof result.confidence !== "number" || result.confidence < 0 || result.confidence > 1) {
      throw new Error(`${result.questionId} 的 confidence 格式錯誤。`);
    }
    if (typeof result.evidence !== "string" || !result.evidence.trim()) {
      throw new Error(`${result.questionId} 缺少 evidence。`);
    }
    if (typeof result.needsReview !== "boolean") {
      throw new Error(`${result.questionId} 缺少 needsReview。`);
    }
    if (typeof result.subjectConflict !== "boolean") {
      throw new Error(`${result.questionId} 缺少 subjectConflict。`);
    }
    if (!allowedSubjects.has(result.suggestedSubject)) {
      throw new Error(`${result.questionId} 的 suggestedSubject 不在允許清單。`);
    }
    if (!result.subjectConflict && result.suggestedSubject !== inputQuestion.trustedSubject) {
      throw new Error(`${result.questionId} 無科目衝突但 suggestedSubject 不一致。`);
    }
    if (result.subjectConflict && result.primaryTagId !== taxonomy.taxonomyGap.id) {
      throw new Error(`${result.questionId} 有科目衝突時必須輸出 taxonomyGap。`);
    }
    if (result.primaryTagId === taxonomy.taxonomyGap.id && !result.needsReview) {
      throw new Error(`${result.questionId} 使用 taxonomyGap 時必須覆核。`);
    }
  });
}

function normalizeModelResults(inputQuestions, results, taxonomy) {
  if (!Array.isArray(results)) return results;
  return results.map((result, index) => {
    const inputQuestion = inputQuestions[index];
    if (
      result?.primaryTagId === taxonomy.taxonomyGap.id &&
      taxonomy.scope.subjects.includes(result.suggestedSubject) &&
      result.suggestedSubject !== inputQuestion?.trustedSubject
    ) {
      return {
        ...result,
        subjectConflict: true,
        needsReview: true
      };
    }
    return result;
  });
}

async function runBatch(apiKey, model, questions, taxonomy) {
  const totalUsage = {
    inputTokens: 0,
    outputTokens: 0,
    reasoningTokens: 0,
    totalTokens: 0
  };
  const attempts = [];
  let correction = "";

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        reasoning: { effort: "low" },
        input: `${buildPrompt(questions, taxonomy)}${correction}`,
        max_output_tokens: Math.max(4000, questions.length * 600)
      })
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload?.error?.message || `OpenAI API ${response.status}`);
    }
    const usage = {
      inputTokens: payload.usage?.input_tokens ?? 0,
      outputTokens: payload.usage?.output_tokens ?? 0,
      reasoningTokens: payload.usage?.output_tokens_details?.reasoning_tokens ?? 0,
      totalTokens: payload.usage?.total_tokens ?? 0
    };
    Object.keys(totalUsage).forEach((key) => {
      totalUsage[key] += usage[key] ?? 0;
    });
    const rawText = extractOutputText(payload);
    try {
      const results = normalizeModelResults(
        questions,
        parseJsonOutput(rawText),
        taxonomy
      );
      validateResults(questions, results, taxonomy);
      attempts.push({ attempt, usage, rawText, validationError: null });
      return { results, rawText, usage: totalUsage, attempts };
    } catch (error) {
      const validationError = error instanceof Error ? error.message : String(error);
      attempts.push({ attempt, usage, rawText, validationError });
      if (attempt === 2) {
        const finalError = new Error(`同一批兩次輸出都未通過驗證：${validationError}`);
        finalError.attempts = attempts;
        finalError.isValidationFailure = true;
        throw finalError;
      }
      console.log(`Validation failed; retrying this request once: ${validationError}`);
      correction = `\n\n上一次輸出未通過格式驗證：${validationError} 請重新輸出完整 JSON 陣列，並嚴格遵守所有欄位與固定 taxonomy 規則。`;
    }
  }

  throw new Error("批次執行未產生結果。");
}

function emptyUsage() {
  return {
    inputTokens: 0,
    outputTokens: 0,
    reasoningTokens: 0,
    totalTokens: 0
  };
}

function addUsage(target, source) {
  Object.keys(target).forEach((key) => {
    target[key] += source?.[key] ?? 0;
  });
}

function sumAttemptUsage(attempts) {
  const usage = emptyUsage();
  attempts.forEach((attempt) => addUsage(usage, attempt.usage));
  return usage;
}

async function runBatchWithFallback(apiKey, model, questions, taxonomy, depth = 0) {
  try {
    return await runBatch(apiKey, model, questions, taxonomy);
  } catch (error) {
    if (!error?.isValidationFailure || questions.length <= 8 || depth >= 2) throw error;

    const splitAt = Math.ceil(questions.length / 2);
    const leftQuestions = questions.slice(0, splitAt);
    const rightQuestions = questions.slice(splitAt);
    const failedAttempts = error?.attempts ?? [];
    console.log(
      `Batch validation still failed; splitting ${questions.length} questions into ${leftQuestions.length} + ${rightQuestions.length}.`
    );

    const left = await runBatchWithFallback(
      apiKey,
      model,
      leftQuestions,
      taxonomy,
      depth + 1
    );
    const right = await runBatchWithFallback(
      apiKey,
      model,
      rightQuestions,
      taxonomy,
      depth + 1
    );
    const results = [...left.results, ...right.results];
    validateResults(questions, results, taxonomy);

    const usage = sumAttemptUsage(failedAttempts);
    addUsage(usage, left.usage);
    addUsage(usage, right.usage);

    return {
      results,
      rawText: JSON.stringify(results),
      usage,
      attempts: [
        ...failedAttempts.map((attempt) => ({
          ...attempt,
          fallbackDepth: depth,
          fallbackBatchSize: questions.length
        })),
        ...left.attempts,
        ...right.attempts
      ],
      fallbackSplits: [
        {
          depth,
          originalSize: questions.length,
          childSizes: [leftQuestions.length, rightQuestions.length],
          validationError: error instanceof Error ? error.message : String(error)
        },
        ...(left.fallbackSplits ?? []),
        ...(right.fallbackSplits ?? [])
      ]
    };
  }
}

function estimateCost(model, usage) {
  const price = modelPrices[model];
  if (!price) return null;
  return (
    (usage.inputTokens / 1_000_000) * price.input +
    (usage.outputTokens / 1_000_000) * price.output
  );
}

function buildReviewReasons(result, input, taxonomy) {
  const reasons = [];
  if (result.needsReview) reasons.push("model_needs_review");
  if (result.subjectConflict) reasons.push("subject_conflict");
  if (result.primaryTagId === taxonomy.taxonomyGap.id) reasons.push("taxonomy_gap");
  if (result.confidence < 0.85) reasons.push("low_confidence");
  if ((input?.inputQualityFlags ?? []).length > 0) reasons.push("input_quality_issue");
  return [...new Set(reasons)];
}

function buildAnswerQualityFlags(input) {
  const answerCreditType = String(input?.answerCreditType ?? "").toLowerCase();
  return answerCreditType === "all_credit" ? ["official_all_credit"] : [];
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const inputPath = path.isAbsolute(options.input)
    ? options.input
    : path.join(pilotDir, options.input);
  const pilot = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  const taxonomy = JSON.parse(fs.readFileSync(taxonomyPath, "utf8"));
  validateTaxonomy(taxonomy);
  const taxonomyFingerprint = crypto
    .createHash("sha1")
    .update(JSON.stringify(taxonomy))
    .digest("hex")
    .slice(0, 8);
  const selectedQuestions = options.ids.length
    ? options.ids.map((id) => {
        const question = pilot.questions.find((candidate) => candidate.questionId === id);
        if (!question) throw new Error(`找不到指定題目：${id}`);
        return question;
      })
    : pilot.questions.slice(0, options.limit);
  const subjectOrder = new Map(
    taxonomy.scope.subjects.map((subject, index) => [subject, index])
  );
  const questions = [...selectedQuestions].sort(
    (left, right) =>
      (subjectOrder.get(left.trustedSubject) ?? Number.MAX_SAFE_INTEGER) -
        (subjectOrder.get(right.trustedSubject) ?? Number.MAX_SAFE_INTEGER) ||
      left.questionId.localeCompare(right.questionId)
  );
  const batches = chunk(questions, options.batchSize);
  const selectionSuffix = `-selection-${crypto
    .createHash("sha1")
    .update(questions.map((question) => question.questionId).join("\n"))
    .digest("hex")
    .slice(0, 8)}`;
  const checkpointPath = path.join(
    pilotDir,
    `checkpoint-${questions.length}-${options.model}-${promptVersion}-batch-${options.batchSize}-tax-${taxonomyFingerprint}${selectionSuffix}.json`
  );

  console.log(`Model: ${options.model}`);
  console.log(`Questions: ${questions.length}`);
  console.log(`Requests: ${batches.length}`);
  console.log(`Concurrency: ${options.concurrency}`);
  if (options.dryRun) {
    let promptCharacters = 0;
    const promptSizes = [];
    batches.forEach((batch, index) => {
      const characters = buildPrompt(batch, taxonomy).length;
      promptCharacters += characters;
      promptSizes.push(characters);
      if (batches.length <= 50) {
        console.log(`Request ${index + 1} prompt characters: ${characters}`);
      }
    });
    const estimatedUsage = {
      inputTokens: Math.ceil(promptCharacters * 0.7),
      outputTokens: questions.length * 180
    };
    console.log(
      `Estimated standard cost: $${(estimateCost(options.model, estimatedUsage) ?? 0).toFixed(4)}`
    );
    if (batches.length > 50) {
      console.log(
        `Prompt characters: total=${promptCharacters}, min=${Math.min(...promptSizes)}, max=${Math.max(...promptSizes)}, average=${Math.round(promptCharacters / promptSizes.length)}`
      );
    }
    console.log("Dry run only; no API request was sent.");
    return;
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error(
      "找不到 OPENAI_CLASSIFICATION_API_KEY。請放在 .env.classification.local，且不要貼到對話或提交 Git。"
    );
  }

  const checkpoint = fs.existsSync(checkpointPath)
    ? JSON.parse(fs.readFileSync(checkpointPath, "utf8"))
    : {
        promptVersion,
        model: options.model,
        questionCount: questions.length,
        batchSize: options.batchSize,
        taxonomyFingerprint,
        requests: []
      };
  if (
    checkpoint.promptVersion !== promptVersion ||
    checkpoint.model !== options.model ||
    checkpoint.questionCount !== questions.length ||
    checkpoint.batchSize !== options.batchSize ||
    checkpoint.taxonomyFingerprint !== taxonomyFingerprint
  ) {
    throw new Error("既有 checkpoint 與本次設定不一致，請先人工檢查。 ");
  }

  const responses = new Array(batches.length);
  let nextBatchIndex = 0;
  let shouldStopWorkers = false;

  async function processBatch(index) {
    const batch = batches[index];
    const questionIds = batch.map((question) => question.questionId);
    const savedRequest = checkpoint.requests.find(
      (request) =>
        request.index === index + 1 &&
        JSON.stringify(request.questionIds) === JSON.stringify(questionIds)
    );
    let response;
    if (savedRequest?.results) {
      console.log(`Resuming request ${index + 1}/${batches.length} from checkpoint...`);
      validateResults(batch, savedRequest.results, taxonomy);
      response = savedRequest;
    } else {
      console.log(`Running request ${index + 1}/${batches.length}...`);
      try {
        response = await runBatchWithFallback(apiKey, options.model, batch, taxonomy);
      } catch (error) {
        const failurePath = path.join(
          pilotDir,
          `failure-request-${index + 1}-${path.basename(checkpointPath)}`
        );
        fs.writeFileSync(
          failurePath,
          JSON.stringify(
            {
              failedAt: new Date().toISOString(),
              requestIndex: index + 1,
              questionIds,
              error: error instanceof Error ? error.message : String(error),
              attempts: error?.attempts ?? []
            },
            null,
            2
          )
        );
        throw error;
      }
      const checkpointRecord = {
        index: index + 1,
        questionIds,
        results: response.results,
        usage: response.usage,
        rawText: response.rawText,
        attempts: response.attempts,
        fallbackSplits: response.fallbackSplits ?? []
      };
      checkpoint.requests = checkpoint.requests.filter(
        (request) => request.index !== checkpointRecord.index
      );
      checkpoint.requests.push(checkpointRecord);
      checkpoint.requests.sort((left, right) => left.index - right.index);
      fs.writeFileSync(checkpointPath, JSON.stringify(checkpoint, null, 2));
    }
    return response;
  }

  async function worker() {
    while (!shouldStopWorkers) {
      const index = nextBatchIndex;
      nextBatchIndex += 1;
      if (index >= batches.length) return;
      try {
        responses[index] = await processBatch(index);
      } catch (error) {
        shouldStopWorkers = true;
        throw error;
      }
    }
  }

  const workerCount = Math.min(options.concurrency, batches.length);
  const workerOutcomes = await Promise.allSettled(
    Array.from({ length: workerCount }, () => worker())
  );
  const failedWorker = workerOutcomes.find((outcome) => outcome.status === "rejected");
  if (failedWorker?.status === "rejected") throw failedWorker.reason;

  const allResults = [];
  const requestRecords = [];
  const totalUsage = {
    inputTokens: 0,
    outputTokens: 0,
    reasoningTokens: 0,
    totalTokens: 0
  };

  responses.forEach((response, index) => {
    if (!response) throw new Error(`第 ${index + 1} 批缺少結果。`);
    const questionIds = batches[index].map((question) => question.questionId);
    allResults.push(...response.results);
    Object.keys(totalUsage).forEach((key) => {
      totalUsage[key] += response.usage[key] ?? 0;
    });
    requestRecords.push({
      index: index + 1,
      questionIds,
      usage: response.usage,
      rawText: response.rawText,
      attempts: response.attempts ?? [],
      fallbackSplits: response.fallbackSplits ?? []
    });
  });

  const output = {
    completedAt: new Date().toISOString(),
    promptVersion,
    model: options.model,
    questionCount: questions.length,
    usage: totalUsage,
    estimatedStandardCostUsd: estimateCost(options.model, totalUsage),
    results: allResults.map((result) => {
      const input = questions.find((question) => question.questionId === result.questionId);
      const selectedTag = taxonomy.primaryTags.find((tag) => tag.id === result.primaryTagId);
      const reviewReasons = buildReviewReasons(result, input, taxonomy);
      return {
        ...result,
        primaryTag: selectedTag?.name ?? null,
        needsReview: reviewReasons.length > 0,
        reviewReasons,
        answerQualityFlags: buildAnswerQualityFlags(input),
        inputQualityFlags: input?.inputQualityFlags ?? [],
        explanationSource: input?.explanationSource ?? null,
        cloudOverrideMetadata: input?.cloudOverrideMetadata ?? null,
        trustedSubject: input?.trustedSubject,
        validationOnly: input?.validationOnly
      };
    }),
    requests: requestRecords
  };
  const outputPath = path.join(
    pilotDir,
    `pilot-${questions.length}-${options.model}-${promptVersion}-batch-${options.batchSize}-tax-${taxonomyFingerprint}${selectionSuffix}-result.json`
  );
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`Output: ${outputPath}`);
  console.log(`Usage: ${JSON.stringify(totalUsage)}`);
  console.log(`Estimated standard cost: $${(output.estimatedStandardCostUsd ?? 0).toFixed(4)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
