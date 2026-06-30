import type { OptionKey, QuestionExplanationOverride } from "../types/quiz";

type ExplanationPayloadInput = {
  explanation?: unknown;
  detailExplanation?: unknown;
  analysis?: unknown;
  optionAnalysis?: unknown;
  option_analysis?: unknown;
  options?: unknown;
  memoryTip?: unknown;
  memory_tip?: unknown;
};

export type NormalizedQuestionExplanationPayload = {
  explanation: string;
  optionAnalysis: Partial<Record<OptionKey, string>>;
  memoryTip: string;
};

const OPTION_KEYS: OptionKey[] = ["A", "B", "C", "D", "E"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeOptionKey(value: unknown): OptionKey | null {
  const key = String(value ?? "").trim().toUpperCase();
  return OPTION_KEYS.includes(key as OptionKey) ? (key as OptionKey) : null;
}

export function normalizeQuestionOptionAnalysis(value: unknown): Partial<Record<OptionKey, string>> {
  if (!value || typeof value !== "object") return {};

  if (Array.isArray(value)) {
    return Object.fromEntries(
      value
        .map((item) => {
          if (!isRecord(item)) return null;
          const key = normalizeOptionKey(item.key ?? item.option ?? item.label);
          const text =
            typeof item.explanation === "string"
              ? item.explanation.trim()
              : typeof item.analysis === "string"
                ? item.analysis.trim()
                : typeof item.text === "string"
                  ? item.text.trim()
                  : "";
          if (!key || !text) return null;
          return [key, text] as const;
        })
        .filter((entry): entry is readonly [OptionKey, string] => Boolean(entry))
    );
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => {
        const normalizedKey = normalizeOptionKey(key);
        const normalizedValue =
          typeof item === "string"
            ? item.trim()
            : isRecord(item) && typeof item.explanation === "string"
              ? item.explanation.trim()
              : isRecord(item) && typeof item.analysis === "string"
                ? item.analysis.trim()
                : isRecord(item) && typeof item.text === "string"
                  ? item.text.trim()
                  : "";
        if (!normalizedKey || !normalizedValue) return null;
        return [normalizedKey, normalizedValue] as const;
      })
      .filter((entry): entry is readonly [OptionKey, string] => Boolean(entry))
  );
}

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseJsonObjectFromText(value: string): Record<string, unknown> | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const codeFenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidates = codeFenceMatch?.[1] ? [codeFenceMatch[1].trim(), trimmed] : [trimmed];

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (isRecord(parsed)) return parsed;
    } catch {
      // try substring below
    }

    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      try {
        const parsed = JSON.parse(candidate.slice(start, end + 1));
        if (isRecord(parsed)) return parsed;
      } catch {
        // keep looking
      }
    }
  }

  return null;
}

function mergeOptionAnalysis(
  primary: Partial<Record<OptionKey, string>>,
  fallback: Partial<Record<OptionKey, string>>
) {
  return Object.fromEntries(
    OPTION_KEYS
      .map((key) => {
        const value = primary[key]?.trim() || fallback[key]?.trim() || "";
        return value ? ([key, value] as const) : null;
      })
      .filter((entry): entry is readonly [OptionKey, string] => Boolean(entry))
  );
}

export function normalizeQuestionExplanationPayload(
  value: unknown,
  depth = 0
): NormalizedQuestionExplanationPayload | null {
  if (!isRecord(value) || depth > 3) return null;

  const record = value as ExplanationPayloadInput;
  const directExplanation =
    getString(record.explanation) ||
    getString(record.detailExplanation) ||
    getString(record.analysis);
  const directOptionAnalysis = normalizeQuestionOptionAnalysis(
    record.optionAnalysis ?? record.option_analysis ?? record.options
  );
  const directMemoryTip = getString(record.memoryTip) || getString(record.memory_tip);

  const nested = directExplanation ? parseJsonObjectFromText(directExplanation) : null;
  const nestedPayload = nested ? normalizeQuestionExplanationPayload(nested, depth + 1) : null;
  if (nestedPayload) {
    return {
      explanation: nestedPayload.explanation,
      optionAnalysis: mergeOptionAnalysis(nestedPayload.optionAnalysis, directOptionAnalysis),
      memoryTip: nestedPayload.memoryTip || directMemoryTip
    };
  }

  if (!directExplanation) return null;

  return {
    explanation: directExplanation,
    optionAnalysis: directOptionAnalysis,
    memoryTip: directMemoryTip
  };
}

export function normalizeQuestionExplanationOverride(
  override?: QuestionExplanationOverride | null
): QuestionExplanationOverride | null {
  if (!override) return null;

  const normalized = normalizeQuestionExplanationPayload({
    explanation: override.explanation,
    optionAnalysis: override.optionAnalysis,
    memoryTip: override.memoryTip
  });

  if (!normalized) {
    const explanation = override.explanation?.trim() ?? "";
    if (!explanation) return null;
    return {
      ...override,
      explanation,
      optionAnalysis: override.optionAnalysis ?? {},
      memoryTip: override.memoryTip ?? ""
    };
  }

  return {
    ...override,
    explanation: normalized.explanation,
    optionAnalysis: normalized.optionAnalysis,
    memoryTip: normalized.memoryTip
  };
}
