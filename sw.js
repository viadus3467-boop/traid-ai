const CACHE_NAME = "trade-ai-v5";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./assets/logo.png",
  "./assets/icon-maskable-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        const clone = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return networkResponse;
      })
      .catch(() => caches.match(event.request).then((cachedResponse) => cachedResponse || caches.match("./index.html"))),
  );
});

self.addEventListener("push", (event) => {
  const fallback = {
    title: "Attention: new signal",
    body: "A new strong signal is ready in Trade Ai.",
    tag: `push-${Date.now()}`,
    data: {
      url: "./",
    },
  };

  let payload = fallback;

  try {
    if (event.data) {
      payload = {
        ...fallback,
        ...event.data.json(),
      };
    }
  } catch {
    payload = fallback;
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "./assets/icon-maskable-512.png",
      badge: "./assets/icon-maskable-512.png",
      tag: payload.tag,
      data: payload.data,
      renotify: true,
      requireInteraction: false,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || "./";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clients) => {
      if (clients.length > 0) {
        const client = clients[0];
        if ("navigate" in client) {
          try {
            await client.navigate(targetUrl);
          } catch {
            // ignore navigation failures and just focus the app
          }
        }
        return client.focus();
      }

      return self.clients.openWindow(targetUrl);
    }),
  );
});
