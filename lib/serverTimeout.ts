export class ServerTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ServerTimeoutError";
  }
}

export function isServerTimeoutError(error: unknown) {
  return error instanceof ServerTimeoutError;
}

export async function withServerTimeout<T>(
  promise: PromiseLike<T>,
  timeoutMs: number,
  message = "伺服器讀取逾時"
) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new ServerTimeoutError(message)), timeoutMs);
  });

  try {
    return await Promise.race([Promise.resolve(promise), timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
