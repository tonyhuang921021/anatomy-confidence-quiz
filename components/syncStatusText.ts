import type { AuthSyncStatus } from "@/components/AuthProvider";

export function getSyncStatusText(status: AuthSyncStatus, hasFallbackError = false) {
  if (status === "syncing") return "同步中";
  if (hasFallbackError || status === "error" || status === "idle") return "暫用本機，稍後補傳";
  return "已同步";
}

export function getSyncStatusTone(status: AuthSyncStatus, hasFallbackError = false) {
  if (status === "syncing") return "syncing";
  if (hasFallbackError || status === "error" || status === "idle") return "fallback";
  return "ready";
}
