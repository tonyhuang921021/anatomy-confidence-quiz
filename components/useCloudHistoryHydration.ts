"use client";

import { useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";

export function useCloudHistoryHydration(enabled = true) {
  const { user, syncStatus, refreshCloudData } = useAuth();

  useEffect(() => {
    if (!enabled || !user?.id || syncStatus === "syncing") return;
    void refreshCloudData({
      hydrateRemoteHistory: true,
      historyHydration: true,
      automatic: true
    });
  }, [enabled, refreshCloudData, syncStatus, user?.id]);
}
