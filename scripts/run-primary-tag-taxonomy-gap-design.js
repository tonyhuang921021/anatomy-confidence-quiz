const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const reportDir = path.join(projectRoot, "reports", "primary-tag-pilot");
const taxonomyPath = path.join(projectRoot, "data", "analysisPrimaryTagTaxonomy.json");
const secretPath = path.join(projectRoot, ".env.classification.local");
const promptVersion = "primary-tag-taxonomy-gap-design-v1";
const modelPrices = {
  "gpt-5.4-mini": { input: 0.75, output: 4.5 },
  "gpt-5.4": { input: 2.5, output: 15 }
};

function parseArgs(argv) {
  const options = {
    input: "adjudication-252-input.json",
    model: "gpt-5.4",
    concurrency: 2,
    dryRun: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--input") options.input = argv[index + 1] ?? options.input;
    if (argv[index] === "--model") options.model = argv[index + 1] ?? options.model;
    if (argv[index] === "--concurrency") {
      options.concurrency = Number(argv[index + 1]) || options.concurrency;
    }
    if (argv[index] === "--dry-run") options.dryRun = true;
  }
  options.concurrency = Math.max(1, Math.min(3, Math.floor(options.concurrency)));
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

function toTagInput(tag) {
  return {
    id: tag.id,
    name: tag.name,
    definition: tag.definition,
    include: tag.include,
    exclude: tag.exclude,
    borderlineRules: tag.borderlineRules
  };
}

function toQuestionInput(question) {
  const allCredit = String(question.answerCreditType ?? "").toLowerCase() === "all_credit";
  return {
    questionId: question.questionId,
    stem: question.stem,
    options: question.options,
    correctAnswers: allCredit ? [] : question.correctAnswers,
    answerKeyStatus: allCredit ? "invalid_all_credit_ignore" : "usable",
    inputQualityFlags: question.inputQualityFlags,
    explanation: question.effectiveExplanation,
    priorEvidence: question.previousClassification.evidence,
    priorReviewReasons: question.previousClassification.reviewReasons
  };
}

function buildPrompt(subject, questions, taxonomy) {
  const subjectSummary = taxonomy.subjectSummary.find((item) => item.subject === subject);
  const existingTags = taxonomy.primaryTags
    .filter((tag) => tag.subject === subject)
    .map(toTagInput);
  return [
    "你是台灣醫師國考第一階段知識分類 taxonomy 的資深設計者。請整批比較同一大科的 taxonomyGap 題目，補上最少但足夠、可長期重複使用的 primaryTag。",
    `officialSubject=${subject}，已依官方試卷與題號區段鎖定，不可跨科。`,
    "先嘗試既有標籤。只有一群題目的核心知識確實不在任何 existingTags 的 definition/include，而且硬塞會誤導弱點分析時，才新增標籤。",
    "新標籤必須是章節層級，不可為單一疾病、單一藥物、單一病原或單一題目造標籤；原則上至少覆蓋本批 2 題。若只有 1 題但屬明顯缺少的基礎章節，必須填 singleQuestionJustification。",
    "同一概念只建立一個新標籤；不要建立『其他』『綜合』『跨領域』等無法形成弱點回饋的籃子。",
    "官方一律給分時忽略答案鍵，依題幹、選項與詳解判斷。缺必要圖片、缺前題或文字殘缺到無法知道考點時才 unresolved。",
    `新 ID 必須以 ${subjectSummary.subjectCode}_ 開頭，只能使用大寫英數與底線；名稱格式為「${subject}－章節名稱」。`,
    "輸出 JSON object：taxonomyAdditions 與 decisions。不要 markdown 或額外文字。",
    "taxonomyAdditions 每筆欄位：id、name、subject、definition、include、exclude、aliases、borderlineRules、singleQuestionJustification。include/exclude/aliases/borderlineRules 都是非空字串陣列。",
    "decisions 必須逐題且順序相同，欄位：questionId、disposition(existing_tag|new_tag|unresolved)、primaryTagId、confidence、evidence。unresolved 的 primaryTagId 必須是 taxonomyGap。",
    "新增標籤都必須至少被一題使用；每題只能選 existingTags、新增標籤或 taxonomyGap。confidence 為 0 到 1，evidence 最多 50 個中文字。",
    `existingTags=${JSON.stringify(existingTags)}`,
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
    text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim()
  );
}

function validateOutput(subject, questions, output, taxonomy) {
  if (!output || !Array.isArray(output.taxonomyAdditions) || !Array.isArray(output.decisions)) {
    throw new Error("輸出缺少 taxonomyAdditions 或 decisions。");
  }
  if (output.decisions.length !== questions.length) {
    throw new Error(`decisions 題數不符：${output.decisions.length} != ${questions.length}`);
  }
  const subjectCode = taxonomy.subjectSummary.find(
    (item) => item.subject === subject
  ).subjectCode;
  const existingTags = new Set(
    taxonomy.primaryTags.filter((tag) => tag.subject === subject).map((tag) => tag.id)
  );
  const existingNames = new Set(taxonomy.primaryTags.map((tag) => tag.name));
  const additionIds = new Set();
  const additionNames = new Set();
  output.taxonomyAdditions.forEach((addition) => {
    if (
      typeof addition.id !== "string" ||
      !addition.id.startsWith(`${subjectCode}_`) ||
      !/^[A-Z][A-Z0-9_]*$/.test(addition.id) ||
      existingTags.has(addition.id) ||
      additionIds.has(addition.id)
    ) {
      throw new Error(`新增標籤 ID 不合法或重複：${addition.id}`);
    }
    if (
      addition.subject !== subject ||
      typeof addition.name !== "string" ||
      !addition.name.startsWith(`${subject}－`) ||
      existingNames.has(addition.name) ||
      additionNames.has(addition.name)
    ) {
      throw new Error(`新增標籤名稱或大科不合法：${addition.id}`);
    }
    if (
      typeof addition.definition !== "string" ||
      !addition.definition.trim() ||
      !["include", "exclude", "aliases", "borderlineRules"].every(
        (key) =>
          Array.isArray(addition[key]) &&
          addition[key].length > 0 &&
          addition[key].every((value) => typeof value === "string" && value.trim())
      )
    ) {
      throw new Error(`新增標籤欄位不完整：${addition.id}`);
    }
    additionIds.add(addition.id);
    additionNames.add(addition.name);
  });

  const usageCounts = new Map([...additionIds].map((id) => [id, 0]));
  output.decisions.forEach((decision, index) => {
    if (decision.questionId !== questions[index].questionId) {
      throw new Error(`第 ${index + 1} 筆 questionId 不符。`);
    }
    if (!["existing_tag", "new_tag", "unresolved"].includes(decision.disposition)) {
      throw new Error(`${decision.questionId} disposition 不合法。`);
    }
    if (decision.disposition === "existing_tag" && !existingTags.has(decision.primaryTagId)) {
      throw new Error(`${decision.questionId} 沒有選合法既有標籤。`);
    }
    if (decision.disposition === "new_tag" && !additionIds.has(decision.primaryTagId)) {
      throw new Error(`${decision.questionId} 沒有選合法新增標籤。`);
    }
    if (decision.disposition === "unresolved" && decision.primaryTagId !== "taxonomyGap") {
      throw new Error(`${decision.questionId} unresolved 時必須使用 taxonomyGap。`);
    }
    if (typeof decision.confidence !== "number" || decision.confidence < 0 || decision.confidence > 1) {
      throw new Error(`${decision.questionId} confidence 不合法。`);
    }
    if (typeof decision.evidence !== "string" || !decision.evidence.trim()) {
      throw new Error(`${decision.questionId} 缺少 evidence。`);
    }
    if (usageCounts.has(decision.primaryTagId)) {
      usageCounts.set(decision.primaryTagId, usageCounts.get(decision.primaryTagId) + 1);
    }
  });
  output.taxonomyAdditions.forEach((addition) => {
    const usageCount = usageCounts.get(addition.id);
    if (usageCount === 0) throw new Error(`新增標籤未被使用：${addition.id}`);
    if (
      usageCount === 1 &&
      (typeof addition.singleQuestionJustification !== "string" ||
        !addition.singleQuestionJustification.trim())
    ) {
      throw new Error(`單題新增標籤缺少理由：${addition.id}`);
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

function estimateCost(model, usage) {
  const price = modelPrices[model];
  if (!price) return null;
  return (
    (usage.inputTokens / 1_000_000) * price.input +
    (usage.outputTokens / 1_000_000) * price.output
  );
}

async function runSubject(apiKey, model, subject, questions, taxonomy) {
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
        input: `${buildPrompt(subject, questions, taxonomy)}${correction}`,
        max_output_tokens: Math.max(6000, questions.length * 600)
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
      const output = parseJsonOutput(rawText);
      validateOutput(subject, questions, output, taxonomy);
      attempts.push({ attempt, usage: attemptUsage, validationError: null });
      return { output, usage, attempts };
    } catch (error) {
      const validationError = error instanceof Error ? error.message : String(error);
      attempts.push({ attempt, usage: attemptUsage, validationError, rawText });
      if (attempt === 2) throw error;
      console.log(`${subject} validation failed; retrying: ${validationError}`);
      correction = `\n上一次輸出錯誤：${validationError}。請重新輸出完整 JSON object。`;
    }
  }
  throw new Error(`${subject} 未產生結果。`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const input = JSON.parse(fs.readFileSync(resolveReportPath(options.input), "utf8"));
  const taxonomy = JSON.parse(fs.readFileSync(taxonomyPath, "utf8"));
  const gapQuestions = input.questions.filter(
    (question) => question.previousClassification.primaryTagId === taxonomy.taxonomyGap.id
  );
  if (gapQuestions.length === 0) throw new Error("沒有 taxonomyGap 題目。");
  const subjectGroups = taxonomy.scope.subjects
    .map((subject) => ({
      subject,
      questions: gapQuestions.filter((question) => question.trustedSubject === subject)
    }))
    .filter((group) => group.questions.length > 0);
  const inputHash = crypto
    .createHash("sha256")
    .update(gapQuestions.map((question) => question.questionId).join("\n"))
    .digest("hex")
    .slice(0, 8);
  const checkpointPath = path.join(
    reportDir,
    `checkpoint-taxonomy-gap-design-${gapQuestions.length}-${options.model}-${promptVersion}-${inputHash}.json`
  );

  const promptSizes = subjectGroups.map((group) =>
    buildPrompt(group.subject, group.questions, taxonomy).length
  );
  const estimatedUsage = {
    inputTokens: Math.ceil(promptSizes.reduce((sum, size) => sum + size, 0) * 0.7),
    outputTokens: gapQuestions.length * 170
  };
  console.log(
    JSON.stringify(
      {
        model: options.model,
        questions: gapQuestions.length,
        requests: subjectGroups.length,
        promptCharacters: promptSizes.reduce((sum, size) => sum + size, 0),
        estimatedStandardCostUsd: estimateCost(options.model, estimatedUsage)
      },
      null,
      2
    )
  );
  if (options.dryRun) {
    console.log("Dry run only; no API request was sent.");
    return;
  }

  const apiKey = getApiKey();
  if (!apiKey) throw new Error("找不到 OPENAI_CLASSIFICATION_API_KEY。");
  const checkpoint = fs.existsSync(checkpointPath)
    ? JSON.parse(fs.readFileSync(checkpointPath, "utf8"))
    : { promptVersion, model: options.model, inputHash, requests: [] };
  const responses = new Array(subjectGroups.length);
  let nextIndex = 0;
  let stop = false;

  async function processGroup(index) {
    const group = subjectGroups[index];
    const questionIds = group.questions.map((question) => question.questionId);
    const saved = checkpoint.requests.find(
      (request) =>
        request.subject === group.subject &&
        JSON.stringify(request.questionIds) === JSON.stringify(questionIds)
    );
    if (saved?.output) {
      validateOutput(group.subject, group.questions, saved.output, taxonomy);
      console.log(`Resuming ${group.subject} from checkpoint...`);
      return saved;
    }
    console.log(`Running ${group.subject} (${group.questions.length})...`);
    const response = await runSubject(
      apiKey,
      options.model,
      group.subject,
      group.questions,
      taxonomy
    );
    const record = { subject: group.subject, questionIds, ...response };
    checkpoint.requests = checkpoint.requests.filter(
      (request) => request.subject !== group.subject
    );
    checkpoint.requests.push(record);
    fs.writeFileSync(checkpointPath, JSON.stringify(checkpoint, null, 2));
    return record;
  }

  async function worker() {
    while (!stop) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= subjectGroups.length) return;
      try {
        responses[index] = await processGroup(index);
      } catch (error) {
        stop = true;
        throw error;
      }
    }
  }

  const outcomes = await Promise.allSettled(
    Array.from({ length: Math.min(options.concurrency, subjectGroups.length) }, () => worker())
  );
  const failure = outcomes.find((outcome) => outcome.status === "rejected");
  if (failure?.status === "rejected") throw failure.reason;

  const usage = emptyUsage();
  responses.forEach((response) => addUsage(usage, response.usage));
  const output = {
    completedAt: new Date().toISOString(),
    promptVersion,
    model: options.model,
    questionCount: gapQuestions.length,
    usage,
    estimatedStandardCostUsd: estimateCost(options.model, usage),
    taxonomyAdditions: responses.flatMap(
      (response) => response.output.taxonomyAdditions
    ),
    decisions: responses.flatMap((response) => response.output.decisions),
    requests: responses.map(({ subject, questionIds, usage: requestUsage, attempts }) => ({
      subject,
      questionIds,
      usage: requestUsage,
      attempts
    }))
  };
  const outputPath = path.join(
    reportDir,
    `taxonomy-gap-design-${gapQuestions.length}-${options.model}-${promptVersion}-${inputHash}-result.json`
  );
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`Output: ${outputPath}`);
  console.log(`Additions: ${output.taxonomyAdditions.length}`);
  console.log(`Usage: ${JSON.stringify(usage)}`);
  console.log(`Estimated standard cost: $${output.estimatedStandardCostUsd.toFixed(4)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
