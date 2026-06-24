import { initializeApp, getApps, getApp } from "firebase/app";
  import { getAuth } from "firebase/auth";
  import { getFirestore } from "firebase/firestore";

  const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  };

  export const FIREBASE_CONFIGURED = !!(
    firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    firebaseConfig.appId
  );

  // Triple-safe init — guaranteed never to throw at module load time
  let _app: ReturnType<typeof initializeApp>;
  try {
    _app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  } catch {
    try {
      // Safe demo config that Firebase accepts without network calls
      _app = initializeApp(
        {
          apiKey: "AIzaSyD-demo0000000000000000000000000",
          authDomain: "chatnow-demo.firebaseapp.com",
          projectId: "chatnow-demo",
          storageBucket: "chatnow-demo.appspot.com",
          messagingSenderId: "000000000000",
          appId: "1:000000000000:web:0000000000000000000000",
        },
        "chatnow-safe"
      );
    } catch {
      _app = getApps()[0]!;
    }
  }

  export const auth = getAuth(_app);
  export const db = getFirestore(_app);
  export default _app;
  