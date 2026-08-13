const RECOVERY_SW_VERSION = "pwa-recovery-v5";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key.startsWith("pwa-")).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
      .then(() => self.registration.unregister())
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "PING") {
    event.source?.postMessage({ type: "PONG", version: RECOVERY_SW_VERSION });
  }
});
