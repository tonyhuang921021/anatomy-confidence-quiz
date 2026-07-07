"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";

export function useCloudHistoryHydration(enabled = true) {
  const { user, syncStatus, refreshCloudData } = useAuth();
  const hydratedUserRef = useRef<string | null>(null);
  const hydratingUserRef = useRef<string | null>(null);
  const [hydratingUserId, setHydratingUserId] = useState<string | null>(null);
  const userId = user?.id ?? null;

  useEffect(() => {
    if (!enabled || !userId || syncStatus === "syncing") return;
    if (hydratedUserRef.current === userId || hydratingUserRef.current === userId) return;
    hydratingUserRef.current = userId;
    setHydratingUserId(userId);

    void refreshCloudData({
      hydrateRemoteHistory: true,
      historyHydration: true,
      automatic: true
    }).finally(() => {
      if (hydratingUserRef.current !== userId) return;
      hydratingUserRef.current = null;
      hydratedUserRef.current = userId;
      setHydratingUserId((current) => (current === userId ? null : current));
    });
  }, [enabled, refreshCloudData, syncStatus, userId]);

  return Boolean(
    enabled &&
      userId &&
      (hydratedUserRef.current !== userId || hydratingUserId === userId)
  );
}
