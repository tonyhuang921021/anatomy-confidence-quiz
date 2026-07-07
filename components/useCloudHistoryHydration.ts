"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/components/AuthProvider";

export function useCloudHistoryHydration(enabled = true) {
  const { user, syncStatus, refreshCloudData } = useAuth();
  const hydratedUserRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !user?.id || syncStatus === "syncing") return;
    if (hydratedUserRef.current === user.id) return;
    hydratedUserRef.current = user.id;

    void refreshCloudData({
      hydrateRemoteHistory: true,
      historyHydration: true,
      automatic: true
    });
  }, [enabled, refreshCloudData, syncStatus, user?.id]);
}
