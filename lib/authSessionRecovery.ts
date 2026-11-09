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

type SessionResult = { data: { session: Session | null }; error: unknown };
type SessionClient = { auth: {
  getSession: () => Promise<SessionResult>;
  refreshSession: () => Promise<SessionResult>;
} };

// React may still hold the pre-sleep token while the SDK has already refreshed.
// Read the SDK's current session, never supply a saved/rotated refresh token.
export async function resolveLiveAuthSessionForOwner(
  client: SessionClient,
  ownerId: string,
  timeoutMs = 6000
): Promise<Session> {
  const bounded = <T,>(work: Promise<T>, message: string) => new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    work.then(resolve, reject).finally(() => clearTimeout(timer));
  });
  const assertOwner = (value: Session | null) => {
    if (!value) throw authReauthenticationError();
    if (value.user?.id !== ownerId) throw new Error("登入帳號已變更，請在目前帳號重新讀取紀錄。");
    return value;
  };
  const current = await bounded(client.auth.getSession(), "登入狀態讀取逾時，本機紀錄仍保留。");
  if (current.error) throw isTerminalAuthError(current.error) ? authReauthenticationError() : current.error;
  let value = assertOwner(current.data.session);
  if (!isUsableAuthSession(value, 90_000)) {
    const refreshed = await bounded(client.auth.refreshSession(), "登入狀態刷新逾時，本機紀錄仍保留。");
    if (refreshed.error) throw isTerminalAuthError(refreshed.error) ? authReauthenticationError() : refreshed.error;
    value = assertOwner(refreshed.data.session);
  }
  if (!isUsableAuthSession(value)) throw authReauthenticationError();
  return value;
}
