type ResponseContentItem = {
  type?: string;
  text?: string;
};

type ResponseOutputItem = {
  type?: string;
  content?: ResponseContentItem[];
};

type OpenAIResponsePayload = {
  service_tier?: string;
  output?: ResponseOutputItem[];
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
  error?: {
    message?: string;
  };
};

export function isOpenAIConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function getOpenAIModel(modelOverride?: string) {
  return modelOverride || process.env.OPENAI_MODEL || "gpt-5.4-mini";
}

export function extractOutputText(payload: OpenAIResponsePayload) {
  const messages = payload.output ?? [];
  return messages
    .flatMap((item) => item.content ?? [])
    .filter((content) => content.type === "output_text" && typeof content.text === "string")
    .map((content) => content.text)
    .join("\n\n")
    .trim();
}

export async function createOpenAIAnalysis(prompt: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const model = getOpenAIModel();

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      input: prompt,
      max_output_tokens: 1800,
      service_tier: "default"
    }),
    cache: "no-store"
  });

  const payload = (await response.json()) as OpenAIResponsePayload;

  if (!response.ok) {
    throw new Error(payload.error?.message || "OpenAI request failed.");
  }

  return {
    model,
    text: extractOutputText(payload),
    usage: {
      inputTokens: payload.usage?.input_tokens ?? 0,
      outputTokens: payload.usage?.output_tokens ?? 0,
      totalTokens:
        payload.usage?.total_tokens ??
        (payload.usage?.input_tokens ?? 0) + (payload.usage?.output_tokens ?? 0)
    }
  };
}

export function buildOpenAITextRequest(
  prompt: string,
  maxOutputTokens: number,
  model: string,
  reasoningEffort: "low" | "default" = "default"
) {
  if (reasoningEffort !== "low" && reasoningEffort !== "default") {
    throw new Error("Unsupported reasoning effort");
  }
  if (reasoningEffort === "low" && model !== "gpt-6.1-sol") {
    throw new Error("Low-effort override is only enabled for gpt-6.1-sol");
  }
  return {
    model,
    input: prompt,
    max_output_tokens: maxOutputTokens,
    service_tier: "default",
    ...(model === "gpt-6.1-sol" ? { prompt_cache_options: { mode: "explicit" } } : {}),
    ...(reasoningEffort === "low" ? { reasoning: { effort: "low" } } : {})
  };
}

export async function createOpenAIText(
  prompt: string,
  maxOutputTokens = 1800,
  modelOverride?: string,
  reasoningEffort: "low" | "default" = "default"
) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const model = getOpenAIModel(modelOverride);

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(buildOpenAITextRequest(prompt, maxOutputTokens, model, reasoningEffort)),
    cache: "no-store"
  });

  const payload = (await response.json()) as OpenAIResponsePayload;

  if (!response.ok) {
    throw new Error(payload.error?.message || "OpenAI request failed.");
  }

  return {
    model,
    text: extractOutputText(payload),
    usageKnown: payload.service_tier === "default" && Number.isSafeInteger(payload.usage?.input_tokens) && Number(payload.usage?.input_tokens) >= 0 &&
      Number.isSafeInteger(payload.usage?.output_tokens) && Number(payload.usage?.output_tokens) >= 0,
    usage: {
      inputTokens: payload.usage?.input_tokens ?? 0,
      outputTokens: payload.usage?.output_tokens ?? 0,
      totalTokens:
        payload.usage?.total_tokens ??
        (payload.usage?.input_tokens ?? 0) + (payload.usage?.output_tokens ?? 0)
    }
  };
}
