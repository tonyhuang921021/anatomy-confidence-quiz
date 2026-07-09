"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";

type CloudHistoryHydrationOptions = {
  force?: boolean;
  readRemoteOnly?: boolean;
};

export function useCloudHistoryHydration(
  enabled = true,
  options: CloudHistoryHydrationOptions = {}
) {
  const { user, syncStatus, refreshCloudData } = useAuth();
  const hydratedUserRef = useRef<string | null>(null);
  const hydratingUserRef = useRef<string | null>(null);
  const [hydratingUserId, setHydratingUserId] = useState<string | null>(null);
  const userId = user?.id ?? null;
  const force = options.force === true;
  const readRemoteOnly = options.readRemoteOnly === true;
  const hydrationKey = userId
    ? `${userId}:${force ? "forced" : "auto"}:${readRemoteOnly ? "read" : "sync"}`
    : null;

  useEffect(() => {
    if (!enabled || !userId || !hydrationKey || syncStatus === "syncing") return;
    if (hydratedUserRef.current === hydrationKey || hydratingUserRef.current === hydrationKey) return;
    hydratingUserRef.current = hydrationKey;
    setHydratingUserId(hydrationKey);

    void refreshCloudData({
      hydrateRemoteHistory: true,
      historyHydration: true,
      automatic: !force,
      force,
      readRemoteOnly
    }).finally(() => {
      if (hydratingUserRef.current !== hydrationKey) return;
      hydratingUserRef.current = null;
      hydratedUserRef.current = hydrationKey;
      setHydratingUserId((current) => (current === hydrationKey ? null : current));
    });
  }, [enabled, force, hydrationKey, readRemoteOnly, refreshCloudData, syncStatus, userId]);

  return Boolean(
    enabled &&
      userId &&
      hydrationKey &&
      (hydratedUserRef.current !== hydrationKey || hydratingUserId === hydrationKey)
  );
}
