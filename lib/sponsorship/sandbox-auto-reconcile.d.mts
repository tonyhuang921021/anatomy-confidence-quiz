export type SandboxAutoReconcileOutcome = 'pending' | 'terminal' | 'blocked' | 'busy';
export type SandboxAutoReconcileState = 'waiting' | 'running' | 'paused' | 'exhausted' | 'stopped';
export type SandboxAutoReconciler = { resume(): void; pause(): void; cancel(): void; stop(): void };
export const AUTO_RECONCILE_DELAYS_MS: readonly number[];
export const AUTO_RECONCILE_WINDOW_MS: number;
export function createSandboxAutoReconciler(options: {
  run: () => Promise<SandboxAutoReconcileOutcome>; onState: (state: SandboxAutoReconcileState) => void;
  now?: () => number; setTimer?: (callback: () => void, delay: number) => number; clearTimer?: (timer: number) => void;
}): SandboxAutoReconciler;
