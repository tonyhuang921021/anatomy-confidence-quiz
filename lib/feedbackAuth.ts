export type FeedbackIdentityIntent = "anonymous" | "authenticated" | "authentication-pending";

export function getFeedbackIdentityIntent(input: {
  isAnonymous: boolean;
  hasUser: boolean;
  accessToken?: string | null;
}): FeedbackIdentityIntent {
  if (input.isAnonymous || !input.hasUser) return "anonymous";
  return input.accessToken?.trim() ? "authenticated" : "authentication-pending";
}

export function getFeedbackAuthorizationHeaders(accessToken?: string | null): Record<string, string> {
  const normalizedToken = accessToken?.trim();
  return normalizedToken ? { Authorization: `Bearer ${normalizedToken}` } : {};
}
