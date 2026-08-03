export function createLaoZhaoClientId(prefix: "bookmark" | "note" | "tab" = "note") {
  const randomUuid =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : null;

  if (randomUuid) return `laozhao-${prefix}-${randomUuid}`;

  return `laozhao-${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 12)}`;
}
