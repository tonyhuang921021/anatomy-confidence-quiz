/** Initial sandbox is authenticated and explicitly allowlisted. Not a guest-payment flow. */
export async function authorizeSandboxTester({ authClient, accessToken, allowedUserIds }) {
  if (typeof window !== 'undefined') throw new Error('SERVER_ONLY');
  if (!authClient || typeof authClient.getUser !== 'function' || typeof accessToken !== 'string' || !accessToken || accessToken.length > 16384 || !Array.isArray(allowedUserIds) || allowedUserIds.length === 0) throw new Error('SANDBOX_ACCESS_DENIED');
  let result;
  try { result = await authClient.getUser(accessToken); } catch { throw new Error('SANDBOX_ACCESS_DENIED'); }
  const userId = result?.data?.user?.id;
  if (result?.error || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId || '') || !allowedUserIds.includes(userId)) throw new Error('SANDBOX_ACCESS_DENIED');
  return { ownerId: userId };
}
