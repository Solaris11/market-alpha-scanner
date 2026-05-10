self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload = { body: event.data.text() };
    }
  }

  const title = typeof payload.title === "string" && payload.title.trim() ? payload.title : "TradeVeto mobile intelligence";
  const body = typeof payload.body === "string" && payload.body.trim() ? payload.body : "A TradeVeto update is ready.";
  const url = typeof payload.url === "string" && payload.url.startsWith("/") && !payload.url.startsWith("//") ? payload.url : "/mobile";

  event.waitUntil(
    self.registration.showNotification(title, {
      badge: typeof payload.badge === "string" ? payload.badge : "/apple-touch-icon.png",
      body,
      data: { url },
      icon: typeof payload.icon === "string" ? payload.icon : "/icon.png",
      tag: typeof payload.tag === "string" ? payload.tag : "tradeveto-mobile-intelligence",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data && typeof event.notification.data.url === "string" ? event.notification.data.url : "/mobile";
  const targetUrl = new URL(url, self.location.origin).href;
  event.waitUntil(
    clients.matchAll({ includeUncontrolled: true, type: "window" }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client && client.url.includes(self.location.origin)) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
      return undefined;
    }),
  );
});
