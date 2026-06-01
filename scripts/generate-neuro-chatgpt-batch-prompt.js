const fs = require("fs");
const path = require("path");
const Module = require("module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const originalResolveFilename = Module._resolveFilename;

Module._resolveFilename = function patchedResolve(request, parent, isMain, options) {
  if (request.startsWith("@/")) {
    const candidate = path.join(projectRoot, request.slice(2));
    const withExt = tryResolveWithExtensions(candidate);
    if (withExt) {
      return originalResolveFilename.call(this, withExt, parent, isMain, options);
    }
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

function tryResolveWithExtensions(basePath) {
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.js`,
    `${basePath}.json`,
    path.join(basePath, "index.ts"),
    path.join(basePath, "index.tsx"),
    path.join(basePath, "index.js"),
    path.join(basePath, "index.json")
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

require.extensions[".ts"] = function registerTs(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
      jsx: ts.JsxEmit.React
    },
    fileName: filename
  });
  module._compile(outputText, filename);
};

require.extensions[".tsx"] = require.extensions[".ts"];

const {
  buildNeuroCandidateQuestions,
  getNeuroAnatomyQuestionBank
} = require("../lib/questionManagement.ts");

function buildQuestionPayload(question) {
  return {
    id: question.id,
    chapter: question.chapter,
    section: question.section,
    stem: question.stem,
    testedConcept: question.testedConcept,
    explanation: question.explanation,
    clinicalLink: question.clinicalLink ?? "",
    sourceYear: question.sourceYear ?? null,
    examCode: question.examCode ?? null,
    questionNumber: question.originalQuestionNumber ?? null
  };
}

function buildBatchPrompt(items) {
  return `你是醫學國考題目知識連結助手，專門處理神經解剖題目。

請針對每一題主題目：
1. 產生少量高品質 tags
2. 從候選題中找出真正值得建立連結的題目
3. 嚴格輸出 JSON，不要輸出任何說明文字
4. 不確定時寧可少標、少連，不要亂補

限制：
- tags 只允許 tag_type: concept, anatomy, disease, mechanism
- relations 只允許 relation_type: same_concept, same_disease
- 每題 tags 最多 4 個
- 每題 relations 最多 5 個
- confidence 用 0 到 1 小數表示
- 不要因為同章節就硬連
- 不要輸出泛用 tag，例如：神經解剖、解剖學、題目、國考
- relation 必須能用一句醫學理由說清楚

請輸出格式：
{
  "results": [
    {
      "question_id": "...",
      "tags": [
        {
          "tag": "...",
          "tag_type": "concept|anatomy|disease|mechanism",
          "confidence": 0.0
        }
      ],
      "relations": [
        {
          "target_question_id": "...",
          "relation_type": "same_concept|same_disease",
          "confidence": 0.0,
          "reason": "..."
        }
      ]
    }
  ]
}

題目批次資料：
${JSON.stringify(items, null, 2)}
`;
}

function main() {
  const batchIndex = Math.max(1, Number.parseInt(process.argv[2] ?? "1", 10));
  const batchSize = Math.max(1, Number.parseInt(process.argv[3] ?? "3", 10));
  const candidateLimit = Math.max(5, Number.parseInt(process.argv[4] ?? "10", 10));

  const bank = getNeuroAnatomyQuestionBank({});
  const start = (batchIndex - 1) * batchSize;
  const selected = bank.slice(start, start + batchSize);

  if (selected.length === 0) {
    throw new Error("No neuro anatomy questions found for this batch.");
  }

  const items = selected.map((question) => ({
    main_question: buildQuestionPayload(question),
    candidate_questions: buildNeuroCandidateQuestions(question, bank, candidateLimit).map(buildQuestionPayload)
  }));

  const prompt = buildBatchPrompt(items);
  const outputDir = path.join(projectRoot, "reports", "exports");
  fs.mkdirSync(outputDir, { recursive: true });
  const filePath = path.join(
    outputDir,
    `neuro_chatgpt_batch_${String(batchIndex).padStart(2, "0")}.txt`
  );
  fs.writeFileSync(filePath, prompt);

  console.log(`Saved prompt to ${filePath}`);
  console.log(`Questions: ${selected.map((question) => question.id).join(", ")}`);
}

main();
