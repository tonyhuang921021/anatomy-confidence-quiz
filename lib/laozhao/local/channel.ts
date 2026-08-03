import { createLaoZhaoClientId } from "./ids";
import type { LaoZhaoLocalChange } from "./types";

const CHANNEL_NAME = "laozhao-anatomy-learning-changes";
const DOM_EVENT_NAME = "laozhao-anatomy-learning-change";
const SOURCE_ID = createLaoZhaoClientId("tab");

type LocalChangeListener = (change: LaoZhaoLocalChange) => void;

let channel: BroadcastChannel | null | undefined;
let customEventInstalled = false;
const listeners = new Set<LocalChangeListener>();

function isBrowser() {
  return typeof window !== "undefined";
}

function isLocalChange(value: unknown): value is LaoZhaoLocalChange {
  if (!value || typeof value !== "object") return false;
  const change = value as Partial<LaoZhaoLocalChange>;
  return (
    typeof change.sourceId === "string" &&
    (change.store === "progress" ||
      change.store === "bookmarks" ||
      change.store === "notes" ||
      change.store === "all") &&
    (change.action === "upsert" || change.action === "delete" || change.action === "clear") &&
    typeof change.changedAt === "number"
  );
}

function notify(change: LaoZhaoLocalChange, includeSelf = false) {
  if (!includeSelf && change.sourceId === SOURCE_ID) return;
  for (const listener of listeners) listener(change);
}

function ensureChannel() {
  if (!isBrowser() || typeof BroadcastChannel === "undefined") return null;
  if (channel !== undefined) return channel;

  try {
  channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (event) => {
      if (isLocalChange(event.data)) notify(event.data);
    };
    (channel as BroadcastChannel & { unref?: () => void }).unref?.();
  } catch {
    channel = null;
  }

  return channel;
}

function installCustomEventListener() {
  if (!isBrowser() || customEventInstalled) return;
  customEventInstalled = true;
  window.addEventListener(DOM_EVENT_NAME, (event) => {
    const detail = (event as CustomEvent<LaoZhaoLocalChange>).detail;
    if (isLocalChange(detail)) notify(detail, true);
  });
}

export function subscribeToLaoZhaoLocalChanges(listener: LocalChangeListener) {
  if (!isBrowser()) return () => undefined;
  listeners.add(listener);
  installCustomEventListener();
  ensureChannel();
  return () => listeners.delete(listener);
}

export function publishLaoZhaoLocalChange(
  change: Omit<LaoZhaoLocalChange, "sourceId" | "changedAt"> & { changedAt?: number }
) {
  if (!isBrowser()) return;

  const payload: LaoZhaoLocalChange = {
    ...change,
    sourceId: SOURCE_ID,
    changedAt: change.changedAt ?? Date.now()
  };

  installCustomEventListener();
  try {
    window.dispatchEvent(new CustomEvent(DOM_EVENT_NAME, { detail: payload }));
  } catch {
    // Same-tab notifications are only a freshness hint; persistence is already complete.
  }

  try {
    ensureChannel()?.postMessage(payload);
  } catch {
    // BroadcastChannel is optional. The local IndexedDB write remains durable.
  }
}

export function closeLaoZhaoLocalChangeChannelForTests() {
  try {
    channel?.close();
  } catch {
    // Ignore cleanup failures in restrictive browser environments.
  }
  channel = undefined;
  listeners.clear();
  customEventInstalled = false;
}
