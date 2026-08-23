export type FeedbackIdentityIntent = "anonymous" | "authenticated" | "authentication-pending";

export function getFeedbackIdentityIntent(input: {
  isAnonymous: boolean;
  hasUser: boolean;
  accessToken?: string | null;
}): FeedbackIdentityIntent {
  if (!input.hasUser) return "anonymous";
  if (input.accessToken?.trim()) return "authenticated";
  return "authentication-pending";
}

export function getFeedbackAuthorizationHeaders(accessToken?: string | null): Record<string, string> {
  const normalizedToken = accessToken?.trim();
  return normalizedToken ? { Authorization: `Bearer ${normalizedToken}` } : {};
}
