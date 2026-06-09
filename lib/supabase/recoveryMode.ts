export function isSupabaseRecoveryMode() {
  const configured = process.env.NEXT_PUBLIC_SUPABASE_RECOVERY_MODE;
  if (configured === "off") return false;
  if (configured === "true") return true;

  // Keep the app usable while Supabase Auth/REST are timing out. Turn this off
  // only after DB recovery with NEXT_PUBLIC_SUPABASE_RECOVERY_MODE=off.
  // Older deployments may still have this set to "false"; do not let that
  // bypass the emergency circuit breaker during the current outage.
  return true;
}

export function getRecoveryTimestamp() {
  return new Date().toISOString();
}
