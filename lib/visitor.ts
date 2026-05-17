const VISITOR_STORAGE_KEY = "acq-visitor-id";

export function getOrCreateVisitorId() {
  if (typeof window === "undefined") return null;

  const existingId = window.localStorage.getItem(VISITOR_STORAGE_KEY);
  if (existingId) return existingId;

  const nextId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `visitor-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  window.localStorage.setItem(VISITOR_STORAGE_KEY, nextId);
  return nextId;
}

export { VISITOR_STORAGE_KEY };
