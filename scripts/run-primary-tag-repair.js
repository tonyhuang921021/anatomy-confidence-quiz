const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const reportDir = path.join(projectRoot, "reports", "primary-tag-pilot");
const taxonomyPath = path.join(projectRoot, "data", "analysisPrimaryTagTaxonomy.json");
const secretPath = path.join(projectRoot, ".env.classification.local");
const promptVersion = "primary-tag-repair-v2-official-subject";
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
    input: "repair-752-input.json",
    model: "gpt-5.4-mini",
    batchSize: 20,
    concurrency: 3,
    dryRun: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--input") options.input = argv[index + 1] ?? options.input;
    if (argv[index] === "--model") options.model = argv[index + 1] ?? options.model;
    if (argv[index] === "--batch-size") {
      options.batchSize = Number(argv[index + 1]) || options.batchSize;
    }
    if (argv[index] === "--concurrency") {
      options.concurrency = Number(argv[index + 1]) || options.concurrency;
    }
    if (argv[index] === "--dry-run") options.dryRun = true;
  }
  options.concurrency = Math.max(1, Math.min(5, Math.floor(options.concurrency)));
  return options;
}

function resolveReportPath(filename) {
  return path.isAbsolute(filename) ? filename : path.join(reportDir, filename);
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

function chunkBySubject(questions, size) {
  const batches = [];
  let current = [];
  let currentSubject = "";
  questions.forEach((question) => {
    if (
      current.length > 0 &&
      (current.length >= size || question.trustedSubject !== currentSubject)
    ) {
      batches.push(current);
      current = [];
    }
    currentSubject = question.trustedSubject;
    current.push(question);
  });
  if (current.length > 0) batches.push(current);
  return batches;
}

function toQuestionInput(question) {
  const answerCreditType = String(question.answerCreditType ?? "standard").toLowerCase();
  const isAllCredit = answerCreditType === "all_credit";
  return {
    questionId: question.questionId,
    officialSubject: question.trustedSubject,
    stem: question.stem,
    options: question.options,
    correctAnswers: isAllCredit ? [] : question.correctAnswers,
    answerKeyStatus: isAllCredit ? "invalid_all_credit_ignore" : "usable",
    inputQualityFlags: question.inputQualityFlags ?? [],
    explanation: question.effectiveExplanation,
    repairReasons: question.repairReasons,
    previousClassification: question.previousClassification
  };
}

function toCandidateTag(tag) {
  return {
    id: tag.id,
    name: tag.name,
    definition: tag.definition,
    include: tag.include,
    exclude: tag.exclude,
    borderlineRules: tag.borderlineRules
  };
}

function buildPrompt(questions, taxonomy) {
  const officialSubject = questions[0].trustedSubject;
  if (questions.some((question) => question.trustedSubject !== officialSubject)) {
    throw new Error("同一修復批次混入不同官方大科。");
  }
  const candidateTags = taxonomy.primaryTags
    .filter((tag) => tag.subject === officialSubject)
    .map(toCandidateTag);
  return [
    "你是台灣醫師國考題庫的章節覆核員。officialSubject 已依考試場次、試卷代碼與題號區段確認並鎖定，不可更改或跨科分類。",
    "previousClassification 是可能錯誤的舊結果，只能當作提醒；請重新閱讀題幹、選項、答案與詳解，依真正作答知識選唯一 primaryTagId。",
    "primaryTagId 只能從 candidateTags 選一個，不可創造標籤。只有缺必要圖片、缺前題、文字殘缺，或所有候選標籤確實不涵蓋時，才可輸出 taxonomyGap。",
    "官方一律給分代表答案鍵不可靠；忽略 correctAnswers，仍依題幹、選項與詳解所呈現的原始考點分類，不可只因一律給分輸出 taxonomyGap。",
    "若 inputQualityFlags 有值，但題幹或詳解已足以判斷章節，仍應選最適 primaryTagId。",
    "secondaryTags 填 1 至 3 個具體繁體中文考點，不可填 primaryTag 名稱、ID、其他、一般或綜合題。",
    "taskType 只能是：記憶辨識、機轉推理、數值計算、圖像判讀、鑑別比較、臨床應用。",
    "每題輸出 questionId、primaryTagId、secondaryTags、taskType、confidence、evidence、needsReview。confidence 為 0 到 1，evidence 最多 45 個中文字。",
    "若 primaryTagId 是 taxonomyGap，needsReview 必須為 true；資訊完整且能唯一分類時 needsReview 應為 false。",
    "輸出必須是 JSON 陣列，題數、順序與 questionId 必須和輸入完全相同，不要 markdown 或額外文字。",
    `officialSubject=${officialSubject}`,
    `candidateTags=${JSON.stringify(candidateTags)}`,
    `questions=${JSON.stringify(questions.map(toQuestionInput))}`
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
  return JSON.parse(
    text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim()
  );
}

function validateResults(questions, results, taxonomy) {
  if (!Array.isArray(results) || results.length !== questions.length) {
    throw new Error(`輸出題數不符：預期 ${questions.length}，實際 ${results?.length ?? 0}`);
  }
  const officialSubject = questions[0].trustedSubject;
  const allowedTags = new Set(
    taxonomy.primaryTags
      .filter((tag) => tag.subject === officialSubject)
      .map((tag) => tag.id)
  );
  const tagNames = new Set(taxonomy.primaryTags.map((tag) => tag.name));
  results.forEach((result, index) => {
    if (result?.questionId !== questions[index].questionId) {
      throw new Error(`第 ${index + 1} 筆 questionId 不符。`);
    }
    if (result.primaryTagId !== taxonomy.taxonomyGap.id && !allowedTags.has(result.primaryTagId)) {
      throw new Error(`${result.questionId} 的 primaryTagId 不屬於 ${officialSubject}。`);
    }
    if (
      !Array.isArray(result.secondaryTags) ||
      result.secondaryTags.length < 1 ||
      result.secondaryTags.length > 3 ||
      result.secondaryTags.some(
        (tag) =>
          typeof tag !== "string" ||
          !tag.trim() ||
          allowedTags.has(tag) ||
          tagNames.has(tag) ||
          ["其他", "一般", "綜合題"].includes(tag.trim())
      )
    ) {
      throw new Error(`${result.questionId} 的 secondaryTags 格式錯誤。`);
    }
    if (!allowedTaskTypes.has(result.taskType)) {
      throw new Error(`${result.questionId} 的 taskType 不合法。`);
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
    if (result.primaryTagId === taxonomy.taxonomyGap.id && !result.needsReview) {
      throw new Error(`${result.questionId} taxonomyGap 時必須覆核。`);
    }
  });
}

function emptyUsage() {
  return { inputTokens: 0, outputTokens: 0, reasoningTokens: 0, totalTokens: 0 };
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

async function runBatch(apiKey, model, questions, taxonomy) {
  const usage = emptyUsage();
  const attempts = [];
  let correction = "";
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        reasoning: { effort: "low" },
        input: `${buildPrompt(questions, taxonomy)}${correction}`,
        max_output_tokens: Math.max(4000, questions.length * 550)
      })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error?.message || `OpenAI API ${response.status}`);
    const attemptUsage = {
      inputTokens: payload.usage?.input_tokens ?? 0,
      outputTokens: payload.usage?.output_tokens ?? 0,
      reasoningTokens: payload.usage?.output_tokens_details?.reasoning_tokens ?? 0,
      totalTokens: payload.usage?.total_tokens ?? 0
    };
    addUsage(usage, attemptUsage);
    const rawText = extractOutputText(payload);
    try {
      const results = parseJsonOutput(rawText);
      validateResults(questions, results, taxonomy);
      attempts.push({ attempt, usage: attemptUsage, rawText, validationError: null });
      return { results, usage, attempts, rawText, fallbackSplits: [] };
    } catch (error) {
      const validationError = error instanceof Error ? error.message : String(error);
      attempts.push({ attempt, usage: attemptUsage, rawText, validationError });
      if (attempt === 2) {
        const finalError = new Error(`同一批兩次輸出都未通過驗證：${validationError}`);
        finalError.attempts = attempts;
        finalError.isValidationFailure = true;
        throw finalError;
      }
      console.log(`Validation failed; retrying once: ${validationError}`);
      correction = `\n上一次輸出錯誤：${validationError}。請重新輸出完整且順序相同的 JSON 陣列。`;
    }
  }
  throw new Error("批次未產生結果。");
}

async function runBatchWithFallback(apiKey, model, questions, taxonomy, depth = 0) {
  try {
    return await runBatch(apiKey, model, questions, taxonomy);
  } catch (error) {
    if (!error?.isValidationFailure || questions.length <= 6 || depth >= 2) throw error;
    const splitAt = Math.ceil(questions.length / 2);
    const leftQuestions = questions.slice(0, splitAt);
    const rightQuestions = questions.slice(splitAt);
    console.log(
      `Splitting invalid batch ${questions.length} into ${leftQuestions.length} + ${rightQuestions.length}.`
    );
    const left = await runBatchWithFallback(apiKey, model, leftQuestions, taxonomy, depth + 1);
    const right = await runBatchWithFallback(apiKey, model, rightQuestions, taxonomy, depth + 1);
    const results = [...left.results, ...right.results];
    validateResults(questions, results, taxonomy);
    const usage = sumAttemptUsage(error.attempts ?? []);
    addUsage(usage, left.usage);
    addUsage(usage, right.usage);
    return {
      results,
      usage,
      rawText: JSON.stringify(results),
      attempts: [...(error.attempts ?? []), ...left.attempts, ...right.attempts],
      fallbackSplits: [
        {
          depth,
          originalSize: questions.length,
          childSizes: [leftQuestions.length, rightQuestions.length],
          validationError: error.message
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

function buildReviewReasons(result, question, taxonomy) {
  const reasons = [];
  if (result.primaryTagId === taxonomy.taxonomyGap.id) reasons.push("repair_taxonomy_gap");
  if (result.needsReview) reasons.push("repair_model_needs_review");
  if (result.confidence < 0.9) reasons.push("repair_low_confidence");
  if ((question.inputQualityFlags ?? []).length > 0) reasons.push("input_quality_issue");
  return [...new Set(reasons)];
}

function buildAnswerQualityFlags(question) {
  const flags = [...(question.previousClassification?.answerQualityFlags ?? [])];
  if (String(question.answerCreditType ?? "").toLowerCase() === "all_credit") {
    flags.push("official_all_credit");
  }
  return [...new Set(flags)];
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const inputPath = resolveReportPath(options.input);
  const input = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  const taxonomy = JSON.parse(fs.readFileSync(taxonomyPath, "utf8"));
  const subjectOrder = new Map(
    taxonomy.scope.subjects.map((subject, index) => [subject, index])
  );
  const questions = [...(input.questions ?? input)].sort(
    (left, right) =>
      (subjectOrder.get(left.trustedSubject) ?? Number.MAX_SAFE_INTEGER) -
        (subjectOrder.get(right.trustedSubject) ?? Number.MAX_SAFE_INTEGER) ||
      left.questionId.localeCompare(right.questionId)
  );
  if (questions.length === 0) throw new Error("修復輸入不可為空。");
  if (input.questionCount && input.questionCount !== questions.length) {
    throw new Error(
      `修復輸入題數不一致：metadata=${input.questionCount}, rows=${questions.length}`
    );
  }
  const inputHash = crypto
    .createHash("sha256")
    .update(questions.map((question) => question.questionId).join("\n"))
    .digest("hex")
    .slice(0, 8);
  const batches = chunkBySubject(questions, options.batchSize);
  const checkpointPath = path.join(
    reportDir,
    `checkpoint-repair-${questions.length}-${options.model}-${promptVersion}-batch-${options.batchSize}-${inputHash}.json`
  );

  console.log(`Model: ${options.model}`);
  console.log(`Questions: ${questions.length}`);
  console.log(`Requests: ${batches.length}`);
  console.log(`Concurrency: ${options.concurrency}`);
  if (options.dryRun) {
    const promptSizes = batches.map((batch) => buildPrompt(batch, taxonomy).length);
    const estimatedUsage = {
      inputTokens: Math.ceil(promptSizes.reduce((sum, size) => sum + size, 0) * 0.7),
      outputTokens: questions.length * 180
    };
    console.log(
      JSON.stringify(
        {
          promptCharacters: promptSizes.reduce((sum, size) => sum + size, 0),
          minPromptCharacters: Math.min(...promptSizes),
          maxPromptCharacters: Math.max(...promptSizes),
          estimatedStandardCostUsd: estimateCost(options.model, estimatedUsage)
        },
        null,
        2
      )
    );
    console.log("Dry run only; no API request was sent.");
    return;
  }

  const apiKey = getApiKey();
  if (!apiKey) throw new Error("找不到 OPENAI_CLASSIFICATION_API_KEY。");
  const checkpoint = fs.existsSync(checkpointPath)
    ? JSON.parse(fs.readFileSync(checkpointPath, "utf8"))
    : {
        promptVersion,
        model: options.model,
        questionCount: questions.length,
        batchSize: options.batchSize,
        inputHash,
        requests: []
      };
  if (
    checkpoint.promptVersion !== promptVersion ||
    checkpoint.model !== options.model ||
    checkpoint.questionCount !== questions.length ||
    checkpoint.batchSize !== options.batchSize ||
    checkpoint.inputHash !== inputHash
  ) {
    throw new Error("repair checkpoint 與本次設定不一致。");
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
    if (savedRequest?.results) {
      validateResults(batch, savedRequest.results, taxonomy);
      console.log(`Resuming request ${index + 1}/${batches.length} from checkpoint...`);
      return savedRequest;
    }
    console.log(`Running request ${index + 1}/${batches.length}...`);
    const response = await runBatchWithFallback(
      apiKey,
      options.model,
      batch,
      taxonomy
    );
    const record = {
      index: index + 1,
      questionIds,
      results: response.results,
      usage: response.usage,
      rawText: response.rawText,
      attempts: response.attempts,
      fallbackSplits: response.fallbackSplits ?? []
    };
    checkpoint.requests = checkpoint.requests.filter(
      (request) => request.index !== record.index
    );
    checkpoint.requests.push(record);
    checkpoint.requests.sort((left, right) => left.index - right.index);
    fs.writeFileSync(checkpointPath, JSON.stringify(checkpoint, null, 2));
    return record;
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

  const outcomes = await Promise.allSettled(
    Array.from({ length: Math.min(options.concurrency, batches.length) }, () => worker())
  );
  const failure = outcomes.find((outcome) => outcome.status === "rejected");
  if (failure?.status === "rejected") throw failure.reason;

  const usage = emptyUsage();
  const results = [];
  responses.forEach((response, index) => {
    if (!response) throw new Error(`第 ${index + 1} 批缺少結果。`);
    addUsage(usage, response.usage);
    response.results.forEach((result) => {
      const question = questions.find((item) => item.questionId === result.questionId);
      const selectedTag = taxonomy.primaryTags.find(
        (tag) => tag.id === result.primaryTagId
      );
      const reviewReasons = buildReviewReasons(result, question, taxonomy);
      results.push({
        ...result,
        primaryTag: selectedTag?.name ?? null,
        needsReview: reviewReasons.length > 0,
        subjectConflict: false,
        suggestedSubject: question.trustedSubject,
        trustedSubject: question.trustedSubject,
        sourceGroup: question.sourceGroup,
        legacyTrustedSubject: question.legacyTrustedSubject,
        repairReasons: question.repairReasons,
        reviewReasons,
        answerQualityFlags: buildAnswerQualityFlags(question),
        inputQualityFlags: question.inputQualityFlags ?? [],
        explanationSource: question.explanationSource ?? null,
        cloudOverrideMetadata: question.cloudOverrideMetadata ?? null,
        validationOnly: question.validationOnly
      });
    });
  });

  const output = {
    completedAt: new Date().toISOString(),
    promptVersion,
    model: options.model,
    questionCount: questions.length,
    sourceInput: path.basename(inputPath),
    usage,
    estimatedStandardCostUsd: estimateCost(options.model, usage),
    results,
    requests: responses.map((response) => ({
      index: response.index,
      questionIds: response.questionIds,
      usage: response.usage,
      attempts: response.attempts ?? [],
      fallbackSplits: response.fallbackSplits ?? []
    }))
  };
  const outputPath = path.join(
    reportDir,
    `repair-${questions.length}-${options.model}-${promptVersion}-batch-${options.batchSize}-${inputHash}-result.json`
  );
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`Output: ${outputPath}`);
  console.log(`Usage: ${JSON.stringify(usage)}`);
  console.log(`Estimated standard cost: $${(output.estimatedStandardCostUsd ?? 0).toFixed(4)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
