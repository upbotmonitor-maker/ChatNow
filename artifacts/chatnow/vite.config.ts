import { defineConfig, type Plugin } from "vite";
  import react from "@vitejs/plugin-react";
  import tailwindcss from "@tailwindcss/vite";
  import path from "path";
  import fs from "fs";
  import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

  function firebaseSwPlugin(): Plugin {
    return {
      name: "firebase-sw-inject",
      closeBundle() {
        const config = {
          apiKey: process.env.VITE_FIREBASE_API_KEY ?? "",
          authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN ?? "",
          projectId: process.env.VITE_FIREBASE_PROJECT_ID ?? "",
          storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET ?? "",
          messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "",
          appId: process.env.VITE_FIREBASE_APP_ID ?? "",
        };

        const swContent = `importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
  importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

  firebase.initializeApp(${JSON.stringify(config)});
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const title = payload.notification?.title ?? "Yeni mesaj";
    const body = payload.notification?.body ?? "";
    const icon = payload.notification?.icon ?? "/favicon.svg";
    self.registration.showNotification(title, {
      body,
      icon,
      badge: "/favicon.svg",
      vibrate: [200, 100, 200],
      data: payload.data,
    });
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
  `;

        const outPath = path.resolve(import.meta.dirname, "dist/public/firebase-messaging-sw.js");
        fs.mkdirSync(path.dirname(outPath), { recursive: true });
        fs.writeFileSync(outPath, swContent, "utf-8");
        console.log("✅ firebase-messaging-sw.js generated with injected config");
      },
    };
  }

  const rawPort = process.env.PORT ?? "3000";
  const port = Number(rawPort) || 3000;
  const basePath = process.env.BASE_PATH ?? "/";

  export default defineConfig({
    base: basePath,
    plugins: [
      react(),
      tailwindcss(),
      runtimeErrorOverlay(),
      firebaseSwPlugin(),
      ...(process.env.NODE_ENV !== "production" &&
      process.env.REPL_ID !== undefined
        ? [
            await import("@replit/vite-plugin-cartographer").then((m) =>
              m.cartographer({
                root: path.resolve(import.meta.dirname, ".."),
              }),
            ),
            await import("@replit/vite-plugin-dev-banner").then((m) =>
              m.devBanner(),
            ),
          ]
        : []),
    ],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "src"),
        "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
      },
      dedupe: ["react", "react-dom"],
    },
    root: path.resolve(import.meta.dirname),
    build: {
      outDir: path.resolve(import.meta.dirname, "dist/public"),
      emptyOutDir: true,
    },
    server: {
      port,
      strictPort: true,
      host: "0.0.0.0",
      allowedHosts: true,
      fs: {
        strict: true,
      },
    },
    preview: {
      port,
      host: "0.0.0.0",
      allowedHosts: true,
    },
  });
  