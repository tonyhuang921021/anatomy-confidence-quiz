export type AIAccountBanRow = {
  user_email: string;
  banned_until: string;
  reason?: string | null;
  created_by_email?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export function normalizeEmail(email?: string | null) {
  return email?.trim().toLowerCase() || "";
}

export async function fetchAIAccountBan(supabase: any, email?: string | null) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;

  const { data, error } = await supabase
    .from("ai_account_bans")
    .select("user_email, banned_until, reason, created_by_email, created_at, updated_at")
    .eq("user_email", normalizedEmail)
    .maybeSingle();

  if (error) {
    const message = String(error.message ?? "");
    if (message.includes("ai_account_bans") && (message.includes("does not exist") || message.includes("Could not find"))) {
      return null;
    }
    throw error;
  }
  return (data as AIAccountBanRow | null) ?? null;
}

export async function getActiveAIAccountBan(supabase: any, email?: string | null) {
  const ban = await fetchAIAccountBan(supabase, email);
  if (!ban?.banned_until) return null;
  if (new Date(ban.banned_until).getTime() <= Date.now()) return null;
  return ban;
}
