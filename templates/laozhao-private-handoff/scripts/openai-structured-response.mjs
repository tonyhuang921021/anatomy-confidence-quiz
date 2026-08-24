import { extractResponseText, sanitizeUsage } from "./handoff-runtime.mjs";

const API_URL = "https://api.openai.com/v1/responses";

function positiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

async function wait(milliseconds) {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function createStructuredResponse({ developerPrompt, userPrompt, schema, schemaName }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("缺少 OPENAI_API_KEY GitHub Actions secret。");
  if (process.env.PRIVATE_REPOSITORY_CONFIRMED !== "true") {
    throw new Error("Repository 尚未由 GitHub 確認為 Private，停止送出私人逐字稿。");
  }
  const model = process.env.OPENAI_MODEL || "gpt-5.6-sol";
  const reasoningEffort = process.env.OPENAI_REASONING_EFFORT || "high";
  const maxOutputTokens = positiveInteger(process.env.OPENAI_MAX_OUTPUT_TOKENS, 12000);
  const body = {
    model,
    store: false,
    reasoning: { effort: reasoningEffort },
    max_output_tokens: maxOutputTokens,
    input: [
      { role: "developer", content: [{ type: "input_text", text: developerPrompt }] },
      { role: "user", content: [{ type: "input_text", text: userPrompt }] }
    ],
    text: {
      verbosity: "low",
      format: { type: "json_schema", name: schemaName, strict: true, schema }
    }
  };

  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10 * 60 * 1000)
      });
      if (!response.ok) {
        let message = `OpenAI API 回傳 HTTP ${response.status}`;
        try {
          const errorBody = await response.json();
          if (typeof errorBody?.error?.message === "string") message += `：${errorBody.error.message}`;
        } catch {
          // Do not print a raw response that could contain private input.
        }
        const error = new Error(message);
        error.retryable = response.status === 429 || response.status >= 500;
        throw error;
      }
      const payload = await response.json();
      if (payload.status !== "completed") {
        throw new Error(`OpenAI 回應未完成：${payload.status ?? "unknown"}`);
      }
      return {
        data: JSON.parse(extractResponseText(payload)),
        metadata: {
          responseId: payload.id ?? null,
          model: payload.model ?? model,
          usage: sanitizeUsage(payload.usage)
        }
      };
    } catch (error) {
      lastError = error;
      if (attempt === 3 || error?.retryable === false) break;
      if (!error?.retryable && !(error instanceof TypeError)) break;
      await wait(1000 * 2 ** (attempt - 1));
    }
  }
  throw lastError;
}
