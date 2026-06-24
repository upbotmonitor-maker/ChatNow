import { getMessaging, getToken, onMessage } from "firebase/messaging";
  import { doc, setDoc } from "firebase/firestore";
  import app, { db } from "./firebase";

  const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string;

  let messagingInstance: ReturnType<typeof getMessaging> | null = null;

  function getMsg() {
    if (!messagingInstance) messagingInstance = getMessaging(app);
    return messagingInstance;
  }

  export async function requestNotificationPermission(uid: string): Promise<boolean> {
    if (!("Notification" in window)) return false;
    if (!("serviceWorker" in navigator)) return false;

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return false;

      // SW is pre-configured at build time — just register it
      const reg = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
      await navigator.serviceWorker.ready;

      const token = await getToken(getMsg(), {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: reg,
      });

      if (!token) return false;

      await setDoc(
        doc(db, "fcmTokens", uid),
        { token, updatedAt: new Date().toISOString() },
        { merge: true }
      );

      return true;
    } catch (e) {
      console.error("Push notification izni alınamadı:", e);
      return false;
    }
  }

  export function listenForegroundMessages(callback: (payload: any) => void) {
    try {
      return onMessage(getMsg(), callback);
    } catch {
      return () => {};
    }
  }
  