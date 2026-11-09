import type { Session } from "@supabase/supabase-js";

export const AUTH_RELOGIN_MESSAGE =
  "登入狀態已失效，請重新登入同一帳號後再同步。這台裝置的作答紀錄與待補傳資料仍保留。";

export function isUsableAuthSession(session: Session | null, leewayMs = 0, now = Date.now()) {
  return Boolean(session?.user?.id && session.access_token &&
    typeof session.expires_at === "number" && Number.isFinite(session.expires_at) &&
    session.expires_at * 1000 > now + leewayMs);
}

export function isTerminalAuthError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? error.code : null;
  return typeof code === "string" && [
    "refresh_token_already_used", "refresh_token_not_found", "session_not_found",
    "session_expired", "user_not_found", "bad_jwt", "auth_reauthentication_required"
  ].includes(code);
}

export function authReauthenticationError() {
  return Object.assign(new Error(AUTH_RELOGIN_MESSAGE), { code: "auth_reauthentication_required" });
}
