export function isSupabaseRecoveryMode() {
  const configured = process.env.NEXT_PUBLIC_SUPABASE_RECOVERY_MODE;
  if (configured === "false") return false;
  if (configured === "true") return true;

  // Keep the app usable while Supabase Auth/REST are timing out. Turn this off
  // from Vercel with NEXT_PUBLIC_SUPABASE_RECOVERY_MODE=false after DB recovery.
  return true;
}

export function getRecoveryTimestamp() {
  return new Date().toISOString();
}
