// Cloud history can be delayed by cooldown, offline mode, or an unresolved read.
// This is permission to start from local history, not proof of cloud completeness.
export function practiceHistoryReadiness(localOwner: string | null, activeOwner: string, cloudPending: boolean) {
  const ready = localOwner !== null && localOwner === activeOwner;
  return { ready, usingLocalHistory: ready && cloudPending };
}
