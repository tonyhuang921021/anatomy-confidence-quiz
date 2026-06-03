import { createClient } from "@supabase/supabase-js";
import type { OpenAIBudgetStatus } from "@/types/quiz";

const AI_BUDGET_SETTING_KEY = "openai_budget_usd";
const COST_CACHE_TTL_MS = 60 * 60 * 1000;
const DEFAULT_COSTS_START_DATE = "2024-01-01";

type SiteSettingRow = {
  setting_key: string;
  value: Record<string, unknown> | null;
};

type OpenAICostsPayload = {
  data?: {
    results?: {
      amount?: {
        value?: number;
        currency?: string;
      };
    }[];
  }[];
  has_more?: boolean;
  next_page?: string | null;
  error?: {
    message?: string;
  };
};

let cachedCosts:
  | {
      usedUsd: number;
      updatedAt: string;
      expiresAt: number;
    }
  | null = null;

export function getServiceSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return null;
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

function roundUsd(value: number) {
  const normalized = Number(value);
  if (!Number.isFinite(normalized)) return 0;
  return Math.max(0, Number(normalized.toFixed(2)));
}

function getFallbackBudgetUsd() {
  const value = Number(process.env.OPENAI_BUDGET_USD ?? process.env.OPENAI_MONTHLY_BUDGET_USD ?? 0);
  return Number.isFinite(value) && value > 0 ? roundUsd(value) : 0;
}

export async function loadOpenAIBudgetUsd(supabase = getServiceSupabaseClient()) {
  if (!supabase) return getFallbackBudgetUsd();

  const { data, error } = await supabase
    .from("site_settings")
    .select("setting_key, value")
    .eq("setting_key", AI_BUDGET_SETTING_KEY)
    .maybeSingle();

  if (error) {
    const message = String(error.message ?? "");
    if (message.includes("site_settings") || message.includes("Could not find")) {
      return getFallbackBudgetUsd();
    }
    throw error;
  }

  const row = data as SiteSettingRow | null;
  const value = Number(row?.value?.budgetUsd ?? 0);
  return Number.isFinite(value) && value > 0 ? roundUsd(value) : getFallbackBudgetUsd();
}

export async function saveOpenAIBudgetUsd(budgetUsd: number, supabase = getServiceSupabaseClient()) {
  if (!supabase) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY 尚未設定，無法儲存 AI 補強基金預算。");
  }

  const normalizedBudget = Number.isFinite(budgetUsd) && budgetUsd > 0 ? roundUsd(budgetUsd) : 0;
  const { error } = await supabase.from("site_settings").upsert(
    {
      setting_key: AI_BUDGET_SETTING_KEY,
      value: {
        budgetUsd: normalizedBudget
      },
      updated_at: new Date().toISOString()
    },
    { onConflict: "setting_key" }
  );

  if (error) throw error;
  return normalizedBudget;
}

function getCostRangeUnixSeconds() {
  const now = new Date();
  const configuredStartDate = process.env.OPENAI_COSTS_START_DATE ?? DEFAULT_COSTS_START_DATE;
  const start = new Date(`${configuredStartDate}T00:00:00.000Z`);
  const safeStart = Number.isNaN(start.getTime()) ? new Date(`${DEFAULT_COSTS_START_DATE}T00:00:00.000Z`) : start;
  return {
    startTime: Math.floor(safeStart.getTime() / 1000),
    endTime: Math.floor(now.getTime() / 1000)
  };
}

async function fetchOpenAICostsUsd() {
  if (cachedCosts && cachedCosts.expiresAt > Date.now()) {
    return cachedCosts;
  }

  const adminKey = process.env.OPENAI_ADMIN_KEY;
  if (!adminKey) {
    throw new Error("OPENAI_ADMIN_KEY 尚未設定。");
  }

  const { startTime, endTime } = getCostRangeUnixSeconds();
  let nextPage: string | null | undefined;
  let usedUsd = 0;
  let pageCount = 0;

  do {
    const params = new URLSearchParams({
      start_time: String(startTime),
      end_time: String(endTime),
      bucket_width: "1d",
      limit: "180"
    });
    if (nextPage) params.set("page", nextPage);

    const response = await fetch(`https://api.openai.com/v1/organization/costs?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${adminKey}`,
        "Content-Type": "application/json"
      },
      cache: "no-store"
    });

    const payload = (await response.json().catch(() => null)) as OpenAICostsPayload | null;
    if (!response.ok) {
      throw new Error(payload?.error?.message || "OpenAI Costs API 查詢失敗。");
    }

    for (const bucket of payload?.data ?? []) {
      for (const result of bucket.results ?? []) {
        if ((result.amount?.currency ?? "usd").toLowerCase() !== "usd") continue;
        usedUsd += Number(result.amount?.value ?? 0);
      }
    }

    nextPage = payload?.next_page;
    pageCount += 1;
  } while (nextPage && pageCount < 24);

  cachedCosts = {
    usedUsd: roundUsd(usedUsd),
    updatedAt: new Date().toISOString(),
    expiresAt: Date.now() + COST_CACHE_TTL_MS
  };

  return cachedCosts;
}

export async function loadOpenAIBudgetStatus(): Promise<OpenAIBudgetStatus> {
  const budgetUsd = await loadOpenAIBudgetUsd();
  const base = {
    enabled: budgetUsd > 0,
    budgetUsd,
    currency: "usd" as const,
    updatedAt: new Date().toISOString()
  };

  if (budgetUsd <= 0) {
    return {
      ...base,
      source: "unavailable",
      message: "AI 補強基金預算尚未設定。"
    };
  }

  try {
    const costs = await fetchOpenAICostsUsd();
    const usedUsd = costs.usedUsd;
    return {
      ...base,
      usedUsd,
      remainingUsd: roundUsd(budgetUsd - usedUsd),
      source: "openai_costs",
      updatedAt: costs.updatedAt
    };
  } catch (error) {
    return {
      ...base,
      source: "unavailable",
      message: error instanceof Error ? error.message : "OpenAI 成本資料暫時無法讀取。"
    };
  }
}
