type ResponseContentItem = {
  type?: string;
  text?: string;
};

type ResponseOutputItem = {
  type?: string;
  content?: ResponseContentItem[];
};

type OpenAIResponsePayload = {
  output?: ResponseOutputItem[];
  error?: {
    message?: string;
  };
};

export function isOpenAIConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
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

  const model = process.env.OPENAI_MODEL || "gpt-5.2";

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      input: prompt,
      max_output_tokens: 1800
    }),
    cache: "no-store"
  });

  const payload = (await response.json()) as OpenAIResponsePayload;

  if (!response.ok) {
    throw new Error(payload.error?.message || "OpenAI request failed.");
  }

  return {
    model,
    text: extractOutputText(payload)
  };
}

export async function createOpenAIText(
  prompt: string,
  maxOutputTokens = 1800,
  modelOverride?: string
) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const model = modelOverride || process.env.OPENAI_MODEL || "gpt-5.2";

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      input: prompt,
      max_output_tokens: maxOutputTokens
    }),
    cache: "no-store"
  });

  const payload = (await response.json()) as OpenAIResponsePayload;

  if (!response.ok) {
    throw new Error(payload.error?.message || "OpenAI request failed.");
  }

  return {
    model,
    text: extractOutputText(payload)
  };
}
