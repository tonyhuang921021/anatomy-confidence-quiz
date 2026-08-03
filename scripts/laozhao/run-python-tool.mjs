import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const toolName = process.argv[2];
const forwardedArgs = process.argv.slice(3);
const toolConfig = {
  transcribe: {
    script: resolve(repoRoot, "scripts/laozhao/transcribe-authorized-source.py"),
    imports: ["mlx_whisper"]
  },
  board: {
    script: resolve(repoRoot, "scripts/laozhao/extract-board-candidates.py"),
    imports: ["cv2", "numpy", "PIL"]
  }
};

function candidateFromToolPath() {
  const configuredTool = process.env.LAOZHAO_TRANSCRIBE_TOOL || process.env.LAOZHAO_CAPTURE_TOOL;
  if (!configuredTool) return null;
  const candidate = resolve(dirname(configuredTool), ".venv/bin/python3");
  return existsSync(candidate) ? candidate : null;
}

function pythonCandidates() {
  const localRuntime = resolve(repoRoot, ".venv-laozhao/bin/python3");
  return [...new Set([
    process.env.LAOZHAO_PYTHON,
    existsSync(localRuntime) ? localRuntime : null,
    candidateFromToolPath(),
    "python3"
  ].filter(Boolean))];
}

function runPython(python, args, options = {}) {
  return spawnSync(python, args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit",
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" }
  });
}

function hasCapabilities(python, imports) {
  const uniqueImports = [...new Set(imports)];
  const checks = uniqueImports.map((name) => (
    name === "mlx_whisper"
      ? `assert importlib.util.find_spec(${JSON.stringify(name)}) is not None`
      : `import ${name}`
  ));
  const result = runPython(
    python,
    ["-c", ["import importlib.util", ...checks].join("\n")],
    { capture: true }
  );
  return !result.error && result.status === 0;
}

function resolvePython(imports) {
  const candidates = pythonCandidates();
  const python = candidates.find((candidate) => hasCapabilities(candidate, imports));
  if (python) return python;
  throw new Error(
    `找不到可載入 ${[...new Set(imports)].join(", ")} 的 Python。請建立 .venv-laozhao，或設定有效的 LAOZHAO_PYTHON。`
  );
}

function main() {
  if (toolName === "check") {
    const python = resolvePython([...toolConfig.transcribe.imports, ...toolConfig.board.imports]);
    console.log(`老趙內容工具環境可用：${python}`);
    return;
  }
  const config = toolConfig[toolName];
  if (!config) throw new Error("用法：run-python-tool.mjs <transcribe|board|check> [...args]");
  const python = resolvePython(config.imports);
  const result = runPython(python, [config.script, ...forwardedArgs]);
  if (result.error) throw result.error;
  if (result.status !== 0) process.exitCode = result.status ?? 1;
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
