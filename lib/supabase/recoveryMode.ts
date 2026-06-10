export function isSupabaseRecoveryMode() {
  const configured = process.env.NEXT_PUBLIC_SUPABASE_RECOVERY_MODE?.trim().toLowerCase();
  if (!configured) return false;
  if (["off", "false", "0", "no"].includes(configured)) return false;
  return ["on", "true", "1", "yes"].includes(configured);
}

export function getRecoveryTimestamp() {
  return new Date().toISOString();
}
