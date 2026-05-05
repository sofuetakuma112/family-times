// Service Worker for Push Notifications and PWA caching

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Push notification handler
self.addEventListener("push", (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();

    const options = {
      body: data.body || "",
      icon: data.icon || "/homeicon_192.png",
      badge: "/homeicon_192.png",
      tag: data.tag || "default",
      data: data.data || {},
      renotify: true,
    };

    // Set app badge if supported
    if (data.data?.badgeCount && navigator.setAppBadge) {
      navigator.setAppBadge(parseInt(data.data.badgeCount, 10));
    }

    event.waitUntil(
      self.registration.showNotification(data.title || "Family Times", options),
    );
  } catch {
    // Fallback for text payloads
    event.waitUntil(
      self.registration.showNotification("Family Times", {
        body: event.data.text(),
        icon: "/homeicon_192.png",
      }),
    );
  }
});

// Notification click handler
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  // Clear badge
  if (navigator.clearAppBadge) {
    navigator.clearAppBadge();
  }

  const data = event.notification.data || {};
  const url = data.url || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        // Focus existing window if found
        for (const client of clients) {
          if (client.url.includes(self.location.origin)) {
            client.focus();
            if (data.channelId) {
              client.postMessage({
                type: "notification-click",
                ...data,
              });
            }
            return;
          }
        }
        // Open new window
        return self.clients.openWindow(url);
      }),
  );
});
