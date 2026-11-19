/** Names are independent metadata: never merge them into immutable answer receipts. */
export const MAX_SESSION_NAME_LENGTH = 80;
export const GUEST_SESSION_NAMES_KEY = "medquiz-guest-session-names-v1";

export function canonicalNameSessionId(id: string) {
  return id.replace(/^user-[^:]+:/, "");
}

export function ownedNameSessionId(owner: string, value: unknown): string | null {
  if (typeof value !== "string" || !value || value.length > 240) return null;
  if (value.startsWith("user-") && value.includes(":")) {
    if (!value.startsWith(`user-${owner}:`)) return null;
  }
  const id = canonicalNameSessionId(value);
  return id ? `user-${owner}:${id}` : null;
}

export function normalizeSessionName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim();
  return name.length <= MAX_SESSION_NAME_LENGTH ? name : null;
}

export function parseGuestSessionNames(raw: string | null): Record<string, string> {
  if (!raw) return {};
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter(([id, name]) =>
      id.length > 0 && id.length <= 240 && normalizeSessionName(name) !== null
    ));
  } catch {
    return {};
  }
}
