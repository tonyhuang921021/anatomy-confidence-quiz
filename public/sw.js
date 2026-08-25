const PUSH_SW_VERSION = "feedback-push-v1";

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
  );
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data?.json() ?? {};
  } catch {
    payload = {};
  }

  const title = typeof payload.title === "string" ? payload.title : "留言板有新動態";
  const body = typeof payload.body === "string" ? payload.body : "打開留言板查看內容。";
  const tag = typeof payload.tag === "string" ? payload.tag : "feedback-update";
  const url = typeof payload.url === "string" && payload.url.startsWith("/")
    ? payload.url
    : "/#feedback";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icon-192.png",
      tag,
      renotify: true,
      data: { url }
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const rawUrl = event.notification.data?.url;
  const target = new URL(
    typeof rawUrl === "string" && rawUrl.startsWith("/") ? rawUrl : "/#feedback",
    self.location.origin
  ).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clients) => {
      for (const client of clients) {
        if ("navigate" in client) await client.navigate(target);
        if ("focus" in client) return client.focus();
      }
      return self.clients.openWindow(target);
    })
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "PING") {
    event.source?.postMessage({ type: "PONG", version: PUSH_SW_VERSION });
  }
});
