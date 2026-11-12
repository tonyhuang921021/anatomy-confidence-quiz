import type { SandboxPublicConfig } from './sandbox-ui.mjs';
export function readSandboxPublicAuthConfiguration(env?: Record<string, string | undefined>): SandboxPublicConfig | null;
export function handleSandboxTestAuth(operation: 'config' | 'session', request: Request): Promise<Response>;
