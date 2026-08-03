const KNOWN_PRODUCTION_HOSTS = new Set([
  "anatomy-confidence-quiz.vercel.app"
]);

function normalizeHostname(value: string | null | undefined) {
  if (!value) return "";
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return "";
  try {
    const parsed = trimmed.includes("://")
      ? new URL(trimmed)
      : new URL(`https://${trimmed}`);
    return parsed.hostname;
  } catch {
    return trimmed.split(":")[0] ?? "";
  }
}

export function isLaoZhaoPreviewPath(pathname: string) {
  return (
    pathname === "/courses/laozhao-anatomy" ||
    pathname.startsWith("/courses/laozhao-anatomy/") ||
    pathname === "/laozhao-preview" ||
    pathname.startsWith("/laozhao-preview/")
  );
}

export function isProductionRequest(
  host: string | null | undefined,
  env: Record<string, string | undefined> = process.env
) {
  if (env.VERCEL_ENV === "production") return true;
  const hostname = normalizeHostname(host);
  if (!hostname) return false;
  const configuredProductionHost = normalizeHostname(env.VERCEL_PROJECT_PRODUCTION_URL);
  return (
    KNOWN_PRODUCTION_HOSTS.has(hostname) ||
    Boolean(configuredProductionHost && hostname === configuredProductionHost)
  );
}

export function shouldBlockLaoZhaoPreviewRequest({
  pathname,
  host,
  env = process.env
}: {
  pathname: string;
  host: string | null | undefined;
  env?: Record<string, string | undefined>;
}) {
  return isLaoZhaoPreviewPath(pathname) && isProductionRequest(host, env);
}
