export const SANDBOX_EDGE_URL: string;
export function handleSandboxEdgeRequest(operation: 'checkout' | 'status' | 'reconcile' | 'donor-consent', request: Request): Promise<Response>;
export function handleConfiguredSandboxRequest(operation: 'checkout' | 'status' | 'reconcile' | 'donor-consent', request: Request): Promise<Response>;
