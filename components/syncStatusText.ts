import type { AuthSyncStatus } from "@/components/AuthProvider";

export function getSyncStatusText(
  status: AuthSyncStatus,
  hasFallbackError = false,
  pendingCompletedUploadCount = 0
) {
  if (status === "syncing") return "同步中";
  if (pendingCompletedUploadCount > 0) return `待補傳 ${pendingCompletedUploadCount} 回`;
  if (hasFallbackError || status === "error" || status === "idle") return "暫用本機，稍後補傳";
  return "已同步";
}

export function getSyncStatusTone(
  status: AuthSyncStatus,
  hasFallbackError = false,
  pendingCompletedUploadCount = 0
) {
  if (status === "syncing") return "syncing";
  if (pendingCompletedUploadCount > 0) return "fallback";
  if (hasFallbackError || status === "error" || status === "idle") return "fallback";
  return "ready";
}
