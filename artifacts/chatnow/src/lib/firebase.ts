import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
  import { getAuth, Auth } from "firebase/auth";
  import { getFirestore, Firestore } from "firebase/firestore";

  const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  };

  const configValid = !!(
    firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    firebaseConfig.appId
  );

  let app: FirebaseApp;
  let auth: Auth;
  let db: Firestore;

  if (configValid) {
    try {
      app = getApps().length ? getApp() : initializeApp(firebaseConfig);
      auth = getAuth(app);
      db = getFirestore(app);
    } catch (e) {
      console.error("[Firebase] Init failed:", e);
      // Fallback: re-use existing app or create a placeholder
      app = getApps()[0] ?? initializeApp(firebaseConfig, "fallback");
      auth = getAuth(app);
      db = getFirestore(app);
    }
  } else {
    console.warn(
      "[Firebase] Missing required env vars (VITE_FIREBASE_API_KEY, VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_APP_ID). " +
      "Firebase will not function. Set these in your Render Environment settings."
    );
    app = initializeApp(
      { apiKey: "placeholder", authDomain: "placeholder.firebaseapp.com", projectId: "placeholder", appId: "1:0:web:0" },
      "placeholder"
    );
    auth = getAuth(app);
    db = getFirestore(app);
  }

  export { auth, db };
  export default app;
  