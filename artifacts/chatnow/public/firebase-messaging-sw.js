importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

// Config, ana sayfa tarafından postMessage ile gönderilir.
// Gelmeden önce gelen background mesajlar için de fallback olarak
// SW activate edildiğinde mesajlaşma başlatılır.
let messagingReady = false;

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "FIREBASE_CONFIG") {
    if (messagingReady) return;
    try {
      firebase.initializeApp(event.data.config);
      const messaging = firebase.messaging();
      messagingReady = true;

      messaging.onBackgroundMessage((payload) => {
        const { title, body, icon } = payload.notification ?? {};
        self.registration.showNotification(title ?? "Yeni mesaj", {
          body: body ?? "",
          icon: icon ?? "/favicon.svg",
          badge: "/favicon.svg",
          data: payload.data,
          vibrate: [200, 100, 200],
        });
      });
    } catch (e) {
      console.error("SW firebase init error:", e);
    }
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) return client.focus();
      }
      return clients.openWindow("/");
    })
  );
});
