export function sandboxRoutesEnabled(env?: Record<string, string | undefined>): boolean;
export function handleSandboxRequest(operation: 'checkout' | 'status' | 'reconcile', request: Request): Promise<Response>;
