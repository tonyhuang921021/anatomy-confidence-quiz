const fs = require("fs");
const path = require("path");
const Module = require("module");
const ts = require("typescript");
const { createClient } = require("@supabase/supabase-js");
const {
  getMoexPaperGroup,
  getMoexPrimarySubject,
  parseMoexQuestionIdentity
} = require("./moex-primary-subject");

const projectRoot = path.resolve(__dirname, "..");
const outputDir = path.join(projectRoot, "reports", "primary-tag-pilot");
const snapshotPath = path.join(outputDir, "cloud-explanation-overrides-snapshot.json");
const inputPath = path.join(outputDir, "full-6200-input.json");
const pageSize = 500;
const canonicalSubjects = [
  "解剖學",
  "組織學",
  "胚胎學",
  "生理學",
  "生物化學",
  "藥理學",
  "病理學",
  "微生物免疫學",
  "寄生蟲學",
  "公共衛生學"
];

function parseArgs(argv) {
  const options = { offline: argv.includes("--offline"), samplePerSubject: 0 };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--sample-per-subject") {
      options.samplePerSubject = Number(argv[index + 1]) || 0;
    }
  }
  return options;
}

function loadEnvFile(filename) {
  const filePath = path.join(projectRoot, filename);
  if (!fs.existsSync(filePath)) return;
  fs.readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .forEach((line) => {
      const normalized = line.trim();
      if (!normalized || normalized.startsWith("#")) return;
      const separator = normalized.indexOf("=");
      if (separator <= 0) return;
      const key = normalized.slice(0, separator).trim();
      let value = normalized.slice(separator + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    });
}

function registerTypeScriptRuntime() {
  const originalResolveFilename = Module._resolveFilename;
  Module._resolveFilename = function resolveFilename(request, parent, isMain, options) {
    const resolvedRequest = request.startsWith("@/")
      ? path.join(projectRoot, request.slice(2))
      : request;
    return originalResolveFilename.call(this, resolvedRequest, parent, isMain, options);
  };
  require.extensions[".ts"] = (module, filename) => {
    const source = fs.readFileSync(filename, "utf8");
    const output = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        esModuleInterop: true,
        resolveJsonModule: true,
        jsx: ts.JsxEmit.ReactJSX
      }
    }).outputText;
    module._compile(output, filename);
  };
}

function loadCanonicalQuestions() {
  registerTypeScriptRuntime();
  const { canonicalQuestionBank } = require(path.join(projectRoot, "data", "med1QuestionBank.ts"));
  const questions = canonicalQuestionBank.filter(
    (question) =>
      question.sourceType === "MOEX_PAST_EXAM" && canonicalSubjects.includes(question.subject)
  );
  const uniqueIds = new Set(questions.map((question) => question.id));
  if (questions.length !== 6200 || uniqueIds.size !== 6200) {
    throw new Error(
      `canonical MOEX 題數異常：rows=${questions.length}, uniqueIds=${uniqueIds.size}`
    );
  }
  return questions;
}

function getSupabaseClient() {
  loadEnvFile(".env.production.local");
  loadEnvFile(".env.local");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("缺少 NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY。");
  }
  return {
    projectRef: new URL(url).hostname.split(".")[0],
    client: createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    })
  };
}

async function loadCloudExplanationOverrides() {
  const { client, projectRef } = getSupabaseClient();
  const rows = [];
  let lastQuestionId = "";

  for (let page = 1; page <= 100; page += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let query = client
      .from("question_explanation_overrides")
      .select("question_id, explanation, option_analysis, memory_tip, model, updated_at")
      .order("question_id", { ascending: true })
      .limit(pageSize)
      .abortSignal(controller.signal);
    if (lastQuestionId) query = query.gt("question_id", lastQuestionId);
    const { data, error } = await query;
    clearTimeout(timeout);
    if (error) throw error;
    const pageRows = data ?? [];
    rows.push(...pageRows);
    console.log(`Cloud override page ${page}: ${pageRows.length} rows`);
    if (pageRows.length < pageSize) break;
    lastQuestionId = pageRows[pageRows.length - 1].question_id;
  }

  return {
    exportedAt: new Date().toISOString(),
    projectRef,
    rowCount: rows.length,
    rows
  };
}

function getCorrectAnswers(question) {
  const acceptedAnswers = Array.isArray(question.acceptedAnswers)
    ? question.acceptedAnswers
    : [];
  if (acceptedAnswers.length > 0) return acceptedAnswers;
  if (Array.isArray(question.answer)) return question.answer;
  return question.answer ? [question.answer] : [];
}

function buildClassificationInput(questions, snapshot) {
  const cloudRowsById = new Map(snapshot.rows.map((row) => [row.question_id, row]));
  const canonicalIds = new Set(questions.map((question) => question.id));
  const normalizedQuestions = questions.map((question) => {
    const trustedSubject = getMoexPrimarySubject(question.id);
    const cloudOverride = cloudRowsById.get(question.id);
    const cloudExplanation = String(cloudOverride?.explanation ?? "").trim();
    const options = Object.fromEntries(
      Object.entries(question.options ?? {})
        .filter(([, value]) => typeof value === "string" && value.trim())
        .map(([key, value]) => [key, value.trim()])
    );
    const inputQualityFlags = [];
    if (Object.keys(options).length < 2) inputQualityFlags.push("missing_option_text");
    if (
      Object.keys(options).length < 2 ||
      /圖形|圖像|圖片|原始 PDF|回PDF/i.test(String(question.explanation ?? ""))
    ) {
      inputQualityFlags.push("image_required");
    }
    return {
      questionId: question.id,
      sourceGroup: getMoexPaperGroup(question.id),
      trustedSubject,
      stem: String(question.stem ?? "").trim(),
      options,
      correctAnswers: getCorrectAnswers(question),
      answerCreditType: String(question.answerCreditType ?? "standard"),
      answerNote: String(question.answerNote ?? "").trim(),
      effectiveExplanation: cloudExplanation || String(question.explanation ?? "").trim(),
      explanationSource: cloudExplanation ? "cloud_override" : "canonical_static",
      cloudOverrideMetadata: cloudExplanation
        ? {
            model: cloudOverride.model ?? null,
            updatedAt: cloudOverride.updated_at ?? null
          }
        : null,
      inputQualityFlags: [...new Set(inputQualityFlags)],
      validationOnly: {
        existingSubject: String(question.subject ?? "").trim(),
        existingChapter: String(question.chapter ?? "").trim(),
        existingSubtopic: String(question.section ?? "").trim(),
        existingTestedConcept: String(question.testedConcept ?? "").trim()
      }
    };
  });
  const invalidQuestions = normalizedQuestions
    .map((question) => ({
      questionId: question.questionId,
      reasons: [
        !question.questionId ? "missing_question_id" : null,
        !canonicalSubjects.includes(question.trustedSubject) ? "invalid_subject" : null,
        !question.stem ? "missing_stem" : null
      ].filter(Boolean)
    }))
    .filter((question) => question.reasons.length > 0);
  if (invalidQuestions.length > 0) {
    throw new Error(`有題目缺少分類必要欄位：${JSON.stringify(invalidQuestions)}`);
  }
  const sourceGroupCounts = Object.fromEntries(
    ["醫學一", "醫學二"].map((sourceGroup) => [
      sourceGroup,
      normalizedQuestions.filter((question) => question.sourceGroup === sourceGroup).length
    ])
  );
  const examSessions = new Map();
  normalizedQuestions.forEach((question) => {
    const { examCode } = parseMoexQuestionIdentity(question.questionId);
    const counts = examSessions.get(examCode) ?? { "醫學一": 0, "醫學二": 0 };
    counts[question.sourceGroup] += 1;
    examSessions.set(examCode, counts);
  });
  const incompleteSessions = [...examSessions.entries()].filter(
    ([, counts]) => counts["醫學一"] !== 100 || counts["醫學二"] !== 100
  );
  if (incompleteSessions.length > 0) {
    throw new Error(`有場次不是醫學一、二各 100 題：${JSON.stringify(incompleteSessions)}`);
  }
  const subjectCounts = Object.fromEntries(
    canonicalSubjects.map((subject) => [
      subject,
      normalizedQuestions.filter((question) => question.trustedSubject === subject).length
    ])
  );
  return {
    generatedAt: new Date().toISOString(),
    sourceQuestionCount: questions.length,
    selectedQuestionCount: normalizedQuestions.length,
    subjectCounts,
    sourceGroupCounts,
    examSessionCount: examSessions.size,
    explanationCoverage: {
      cloudOverrideCount: normalizedQuestions.filter(
        (question) => question.explanationSource === "cloud_override"
      ).length,
      canonicalStaticCount: normalizedQuestions.filter(
        (question) => question.explanationSource === "canonical_static"
      ).length,
      excludedNonMoexCloudRowCount: snapshot.rows.filter(
        (row) => !canonicalIds.has(row.question_id)
      ).length
    },
    questions: normalizedQuestions
  };
}

function writeJsonAtomically(filePath, payload) {
  const temporaryPath = `${filePath}.tmp`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(payload, null, 2)}\n`);
  fs.renameSync(temporaryPath, filePath);
}

function questionInputLength(question) {
  return [
    question.stem,
    ...Object.values(question.options),
    question.correctAnswers.join(","),
    question.effectiveExplanation
  ].join("\n").length;
}

function selectVariedQuestions(questions, count) {
  if (questions.length <= count) return [...questions];
  const sorted = [...questions].sort(
    (left, right) =>
      questionInputLength(left) - questionInputLength(right) ||
      left.questionId.localeCompare(right.questionId)
  );
  return Array.from({ length: count }, (_, index) => {
    const quantile = (index + 0.5) / count;
    return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * quantile))];
  });
}

function buildStratifiedSample(classificationInput, perSubject) {
  const questions = canonicalSubjects.flatMap((subject) =>
    selectVariedQuestions(
      classificationInput.questions.filter((question) => question.trustedSubject === subject),
      perSubject
    )
  );
  return {
    ...classificationInput,
    generatedAt: new Date().toISOString(),
    sourceQuestionCount: classificationInput.questions.length,
    selectedQuestionCount: questions.length,
    selectedPerSubject: perSubject,
    subjectCounts: Object.fromEntries(
      canonicalSubjects.map((subject) => [
        subject,
        questions.filter((question) => question.trustedSubject === subject).length
      ])
    ),
    sourceGroupCounts: {
      "醫學一": questions.filter((question) => question.sourceGroup === "醫學一").length,
      "醫學二": questions.filter((question) => question.sourceGroup === "醫學二").length
    },
    explanationCoverage: {
      ...classificationInput.explanationCoverage,
      cloudOverrideCount: questions.filter(
        (question) => question.explanationSource === "cloud_override"
      ).length,
      canonicalStaticCount: questions.filter(
        (question) => question.explanationSource === "canonical_static"
      ).length
    },
    questions
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  fs.mkdirSync(outputDir, { recursive: true });
  const questions = loadCanonicalQuestions();
  console.log(`Canonical MOEX questions: ${questions.length}`);

  let snapshot;
  if (options.offline) {
    if (!fs.existsSync(snapshotPath)) {
      snapshot = { exportedAt: null, projectRef: null, rowCount: 0, rows: [] };
    } else {
      snapshot = JSON.parse(fs.readFileSync(snapshotPath, "utf8"));
    }
    console.log(`Offline snapshot rows: ${snapshot.rows.length}`);
  } else {
    snapshot = await loadCloudExplanationOverrides();
    writeJsonAtomically(snapshotPath, snapshot);
    console.log(`Cloud snapshot rows: ${snapshot.rows.length}`);
  }

  const classificationInput = buildClassificationInput(questions, snapshot);
  writeJsonAtomically(inputPath, classificationInput);
  console.log(`Input: ${inputPath}`);
  if (options.samplePerSubject > 0) {
    const sample = buildStratifiedSample(classificationInput, options.samplePerSubject);
    const samplePath = path.join(outputDir, `canonical-sample-${sample.questions.length}-input.json`);
    writeJsonAtomically(samplePath, sample);
    console.log(`Sample input: ${samplePath}`);
  }
  console.log(JSON.stringify({
    subjectCounts: classificationInput.subjectCounts,
    sourceGroupCounts: classificationInput.sourceGroupCounts,
    explanationCoverage: classificationInput.explanationCoverage
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
