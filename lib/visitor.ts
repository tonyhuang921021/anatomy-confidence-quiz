const VISITOR_STORAGE_KEY = "acq-visitor-id";

export function getOrCreateVisitorId() {
  if (typeof window === "undefined") return null;

  let existingId: string | null = null;
  try {
    existingId = window.localStorage.getItem(VISITOR_STORAGE_KEY);
  } catch {
    existingId = null;
  }
  if (existingId) return existingId;

  const nextId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `visitor-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  try {
    window.localStorage.setItem(VISITOR_STORAGE_KEY, nextId);
  } catch {
    // Ignore storage write failures and still return an in-memory visitor id.
  }
  return nextId;
}

export { VISITOR_STORAGE_KEY };
