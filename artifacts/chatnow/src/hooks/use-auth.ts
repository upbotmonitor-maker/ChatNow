import { useState, useEffect, useRef } from 'react';
  import { auth, db } from '@/lib/firebase';
  import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
  import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';

  export interface UserData {
    uid: string;
    username: string;
    email: string;
    photoURL?: string;
    bio?: string;
    online: boolean;
    lastSeen?: any;
    lastHeartbeat?: any;
    createdAt: any;
    bannedAt?: any;
    role?: string;
    gifEnabled?: boolean;
    gifUrl?: string;
    gifStartTime?: any;
    gifExpireTime?: any;
    verified?: boolean;
    thinking?: boolean;
    generatingImage?: boolean;
  }

  export function useAuth() {
    const [user, setUser] = useState<FirebaseUser | null>(null);
    const [userData, setUserData] = useState<UserData | null>(null);
    const [loading, setLoading] = useState(true);
    const currentUserRef = useRef<FirebaseUser | null>(null);
    const offlineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const userDataUnsubRef = useRef<(() => void) | null>(null);

    const setOnline = async (uid: string) => {
      await setDoc(doc(db, 'users', uid), { online: true }, { merge: true });
    };

    const setOffline = async (uid: string) => {
      await setDoc(doc(db, 'users', uid), { online: false, lastSeen: serverTimestamp() }, { merge: true });
    };

    useEffect(() => {
      const fallbackTimer = setTimeout(() => setLoading(false), 5000);

      const unsubAuth = onAuthStateChanged(auth, async (currentUser) => {
        clearTimeout(fallbackTimer);
        setUser(currentUser);
        currentUserRef.current = currentUser;

        if (userDataUnsubRef.current) {
          userDataUnsubRef.current();
          userDataUnsubRef.current = null;
        }

        if (currentUser) {
          const userDocRef = doc(db, 'users', currentUser.uid);
          userDataUnsubRef.current = onSnapshot(userDocRef, async (snap) => {
            if (snap.exists()) {
              const data = snap.data() as UserData;
              if (data.bannedAt) {
                await auth.signOut();
                setUserData(null);
              } else {
                setUserData(data);
              }
            }
            setLoading(false);
          });
          await setOnline(currentUser.uid);
        } else {
          setUserData(null);
          setLoading(false);
        }
      });
      return () => {
        clearTimeout(fallbackTimer);
        unsubAuth();
        if (userDataUnsubRef.current) userDataUnsubRef.current();
      };
    }, []);

    useEffect(() => {
      const interval = setInterval(async () => {
        const uid = currentUserRef.current?.uid;
        if (!uid || document.hidden) return;
        await setDoc(doc(db, 'users', uid), { online: true }, { merge: true });
      }, 30_000);
      return () => clearInterval(interval);
    }, []);

    useEffect(() => {
      const handleVisibilityChange = async () => {
        const uid = currentUserRef.current?.uid;
        if (!uid) return;
        if (document.hidden) {
          offlineTimerRef.current = setTimeout(async () => {
            if (document.hidden) await setOffline(uid);
          }, 60_000);
        } else {
          if (offlineTimerRef.current) {
            clearTimeout(offlineTimerRef.current);
            offlineTimerRef.current = null;
          }
          await setOnline(uid);
        }
      };

      const handleBeforeUnload = () => {
        const uid = currentUserRef.current?.uid;
        if (!uid) return;
        setDoc(doc(db, 'users', uid), { online: false, lastSeen: serverTimestamp() }, { merge: true });
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('beforeunload', handleBeforeUnload);
        if (offlineTimerRef.current) clearTimeout(offlineTimerRef.current);
      };
    }, []);

    return { user, userData, loading };
  }
