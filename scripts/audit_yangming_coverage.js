#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const Module = require("module");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const DEFAULT_ROWS_PATH = "/tmp/yangming_boundary_full_safe/yangming_visual_consolidated_rows_snapshot_safe_audited_v4.json";
const DEFAULT_OUTPUT_DIR = "/tmp/yangming_boundary_full_safe/coverage";
const EXCLUDED_EXAM_CODES = new Set(["115020"]);

const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function resolveAlias(request, parent, isMain, options) {
  if (request.startsWith("@/")) {
    return originalResolveFilename.call(this, path.join(root, request.slice(2)), parent, isMain, options);
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

require.extensions[".ts"] = function compileTypeScript(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX
    }
  });
  return module._compile(output.outputText, filename);
};

function parseArgs(argv) {
  const args = {
    rowsPath: DEFAULT_ROWS_PATH,
    outputDir: DEFAULT_OUTPUT_DIR
  };
  for (let index = 2; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--rows") {
      args.rowsPath = argv[index + 1];
      index += 1;
    } else if (value === "--out") {
      args.outputDir = argv[index + 1];
      index += 1;
    }
  }
  return args;
}

function normalizeQuestionId(id) {
  return String(id || "").replace(/_/g, "-");
}

function paperKeyOfQuestion(question) {
  return `${question.examCode}-${question.paperCode}`;
}

function paperKeyOfRow(row) {
  const match = normalizeQuestionId(row.question_id).match(/^MOEX-(\d+)-(\d+)-Q\d+$/);
  return match ? `${match[1]}-${match[2]}` : "unknown";
}

function hasMeaningfulExplanation(row) {
  return Boolean(
    (row.body || "").trim() ||
      (Array.isArray(row.sections) && row.sections.length > 0) ||
      (Array.isArray(row.assets) && row.assets.length > 0)
  );
}

function classifyRow(row) {
  if (!row) return "missing_row";
  if (row.match_status === "question_number_mismatch") return "question_number_mismatch";
  if (!hasMeaningfulExplanation(row)) {
    if (row.match_status === "low_confidence") return "low_confidence_empty";
    return "empty_after_filter";
  }
  if (!Array.isArray(row.assets) || row.assets.length === 0) return "text_only";
  return "has_safe_snapshot";
}

function truncate(text, limit = 120) {
  const compact = String(text || "").replace(/\s+/g, " ").trim();
  return compact.length > limit ? `${compact.slice(0, limit - 1)}…` : compact;
}

function csvCell(value) {
  const text = String(value ?? "");
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function toCsv(rows) {
  const headers = [
    "paper",
    "question_id",
    "question_no",
    "subject",
    "status",
    "match_status",
    "match_score",
    "extracted_question_no",
    "matched_question_no",
    "asset_count",
    "stem"
  ];
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(","))
  ].join("\n");
}

function main() {
  const args = parseArgs(process.argv);
  const rowsPath = path.resolve(args.rowsPath);
  const outputDir = path.resolve(args.outputDir);
  const { canonicalQuestionBank } = require(path.join(root, "data", "med1QuestionBank.ts"));
  const rows = JSON.parse(fs.readFileSync(rowsPath, "utf8"));
  const rowById = new Map(rows.map((row) => [normalizeQuestionId(row.question_id), row]));

  const targetQuestions = canonicalQuestionBank
    .filter((question) => question.sourceType === "MOEX_PAST_EXAM")
    .filter((question) => !EXCLUDED_EXAM_CODES.has(String(question.examCode || "")))
    .sort((a, b) => normalizeQuestionId(a.id).localeCompare(normalizeQuestionId(b.id)));
  const targetQuestionIds = new Set(targetQuestions.map((question) => normalizeQuestionId(question.id)));

  const detailRows = [];
  const paperStats = new Map();
  const globalStats = {
    target_questions: targetQuestions.length,
    row_count: rows.length,
    missing_row: 0,
    has_safe_snapshot: 0,
    text_only: 0,
    low_confidence_empty: 0,
    question_number_mismatch: 0,
    empty_after_filter: 0
  };

  for (const question of targetQuestions) {
    const questionId = normalizeQuestionId(question.id);
    const row = rowById.get(questionId);
    const status = classifyRow(row);
    globalStats[status] = (globalStats[status] || 0) + 1;
    const paper = paperKeyOfQuestion(question);
    const paperStat = paperStats.get(paper) || {
      paper,
      total: 0,
      missing_row: 0,
      has_safe_snapshot: 0,
      text_only: 0,
      low_confidence_empty: 0,
      question_number_mismatch: 0,
      empty_after_filter: 0
    };
    paperStat.total += 1;
    paperStat[status] = (paperStat[status] || 0) + 1;
    paperStats.set(paper, paperStat);

    detailRows.push({
      paper,
      question_id: questionId,
      question_no: question.originalQuestionNumber,
      subject: question.subject,
      status,
      match_status: row?.match_status || "",
      match_score: row?.match_score ?? "",
      extracted_question_no: row?.extracted_question_no ?? "",
      matched_question_no: row?.matched_question_no ?? "",
      asset_count: Array.isArray(row?.assets) ? row.assets.length : 0,
      stem: truncate(question.question, 180)
    });
  }

  const orphanRows = rows.filter((row) => !targetQuestionIds.has(normalizeQuestionId(row.question_id)));
  const paperSummaries = Array.from(paperStats.values())
    .map((paper) => ({
      ...paper,
      safe_rate: paper.total ? Number((paper.has_safe_snapshot / paper.total).toFixed(3)) : 0,
      gap_count:
        paper.missing_row +
        paper.low_confidence_empty +
        paper.question_number_mismatch +
        paper.empty_after_filter
    }))
    .sort((a, b) => b.gap_count - a.gap_count || a.paper.localeCompare(b.paper));

  fs.mkdirSync(outputDir, { recursive: true });
  const detailsCsvPath = path.join(outputDir, "yangming_coverage_details.csv");
  const papersCsvPath = path.join(outputDir, "yangming_coverage_by_paper.csv");
  const summaryJsonPath = path.join(outputDir, "yangming_coverage_summary.json");
  const summaryMdPath = path.join(outputDir, "yangming_coverage_summary.md");

  fs.writeFileSync(detailsCsvPath, toCsv(detailRows), "utf8");
  fs.writeFileSync(
    papersCsvPath,
    toCsv(
      paperSummaries.map((paper) => ({
        paper: paper.paper,
        question_id: "",
        question_no: paper.total,
        subject: "",
        status: `gap=${paper.gap_count}; safe=${paper.has_safe_snapshot}; missing=${paper.missing_row}; mismatch=${paper.question_number_mismatch}; low_empty=${paper.low_confidence_empty}; filtered_empty=${paper.empty_after_filter}; text_only=${paper.text_only}`,
        match_status: "",
        match_score: paper.safe_rate,
        extracted_question_no: "",
        matched_question_no: "",
        asset_count: "",
        stem: ""
      }))
    ),
    "utf8"
  );
  fs.writeFileSync(
    summaryJsonPath,
    JSON.stringify(
      {
        rowsPath,
        generatedAt: new Date().toISOString(),
        excludedExamCodes: Array.from(EXCLUDED_EXAM_CODES),
        globalStats,
        orphanRowCount: orphanRows.length,
        topGapPapers: paperSummaries.slice(0, 25)
      },
      null,
      2
    ),
    "utf8"
  );
  fs.writeFileSync(
    summaryMdPath,
    [
      "# Yangming Coverage Audit",
      "",
      `Source rows: \`${rowsPath}\``,
      "",
      "## Summary",
      "",
      `- Target questions: ${globalStats.target_questions}`,
      `- Rows in import file: ${globalStats.row_count}`,
      `- Has safe screenshot: ${globalStats.has_safe_snapshot}`,
      `- Text only: ${globalStats.text_only}`,
      `- Missing row: ${globalStats.missing_row}`,
      `- Low confidence / empty: ${globalStats.low_confidence_empty}`,
      `- Question-number mismatch blocked: ${globalStats.question_number_mismatch}`,
      `- Empty after safety filter: ${globalStats.empty_after_filter}`,
      `- Orphan import rows: ${orphanRows.length}`,
      "",
      "## Top Gap Papers",
      "",
      "| Paper | Gap | Safe | Missing Row | Mismatch | Low Empty | Filtered Empty | Text Only |",
      "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
      ...paperSummaries.slice(0, 25).map(
        (paper) =>
          `| ${paper.paper} | ${paper.gap_count} | ${paper.has_safe_snapshot} | ${paper.missing_row} | ${paper.question_number_mismatch} | ${paper.low_confidence_empty} | ${paper.empty_after_filter} | ${paper.text_only} |`
      ),
      "",
      "## Outputs",
      "",
      `- Details CSV: \`${detailsCsvPath}\``,
      `- Paper CSV: \`${papersCsvPath}\``,
      `- Summary JSON: \`${summaryJsonPath}\``
    ].join("\n"),
    "utf8"
  );

  console.log(
    JSON.stringify(
      {
        globalStats,
        topGapPapers: paperSummaries.slice(0, 10),
        outputs: {
          detailsCsvPath,
          papersCsvPath,
          summaryJsonPath,
          summaryMdPath
        }
      },
      null,
      2
    )
  );
}

main();
