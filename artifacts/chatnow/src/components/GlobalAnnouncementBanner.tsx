import { useEffect, useRef, useState } from "react";
  import { db, auth } from "@/lib/firebase";
  import { doc, onSnapshot } from "firebase/firestore";
  import { onAuthStateChanged } from "firebase/auth";

  interface AnnouncementDoc {
    senderName: string;
    text: string;
    publishedAt: any;
  }

  const LS_KEY = "chatnow_last_announcement";

  export default function GlobalAnnouncementBanner() {
    const [visible, setVisible] = useState(false);
    const [exiting, setExiting] = useState(false);
    const [announcement, setAnnouncement] = useState<AnnouncementDoc | null>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const unsubRef = useRef<(() => void) | null>(null);

    const dismiss = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setExiting(true);
      setTimeout(() => {
        setVisible(false);
        setExiting(false);
      }, 400);
    };

    useEffect(() => {
      const unsubAuth = onAuthStateChanged(auth, (user) => {
        if (unsubRef.current) {
          unsubRef.current();
          unsubRef.current = null;
        }

        if (!user) return;

        const unsub = onSnapshot(doc(db, "events", "globalAnnouncement"), (snap) => {
          if (!snap.exists()) return;
          const data = snap.data() as AnnouncementDoc;
          if (!data.publishedAt) return;

          const key = data.publishedAt?.toMillis?.()?.toString() ?? String(data.publishedAt);
          const lastSeen = localStorage.getItem(LS_KEY);

          if (key && key !== lastSeen) {
            localStorage.setItem(LS_KEY, key);
            setAnnouncement(data);
            setExiting(false);
            setVisible(true);

            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => {
              dismiss();
            }, 8000);
          }
        });

        unsubRef.current = unsub;
      });

      return () => {
        unsubAuth();
        if (unsubRef.current) unsubRef.current();
        if (timerRef.current) clearTimeout(timerRef.current);
      };
    }, []);

    if (!visible || !announcement) return null;

    return (
      <div
        className={`fixed top-0 left-0 right-0 z-[9999] ${exiting ? "announcement-exit" : "announcement-enter-top"}`}
        style={{ animationFillMode: "forwards" }}
      >
        <div
          className="flex items-center gap-2.5 px-4 py-3 border-b border-blue-500/40"
          style={{
            background: "linear-gradient(90deg, rgba(10,15,40,0.97) 0%, rgba(20,30,80,0.97) 100%)",
            backdropFilter: "blur(16px)",
            boxShadow: "0 2px 20px rgba(59,130,246,0.2)",
          }}
        >
          <span className="font-bold text-blue-300 text-sm whitespace-nowrap">
            {announcement.senderName}
          </span>

          <img src="/announcement-badge.png" alt="" className="w-5 h-5 flex-shrink-0" />

          <span className="text-white/40 text-sm">:</span>

          <span className="text-white/90 text-sm flex-1 truncate">
            {announcement.text}
          </span>

          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500/20">
            <div
              className="h-full bg-blue-500"
              style={{ animation: "annBar 8s linear forwards" }}
            />
          </div>

          <button
            onClick={dismiss}
            className="flex-shrink-0 w-5 h-5 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/50 hover:text-white text-[10px] transition-all"
          >
            ✕
          </button>
        </div>

        <style>{`
          @keyframes annBar { from { width: 100%; } to { width: 0%; } }
          @keyframes annSlideDown { from { opacity: 0; transform: translateY(-100%); } to { opacity: 1; transform: translateY(0); } }
          @keyframes annSlideUp { from { opacity: 1; transform: translateY(0); } to { opacity: 0; transform: translateY(-100%); } }
          .announcement-enter-top { animation: annSlideDown 0.35s cubic-bezier(0.16,1,0.3,1) forwards; }
          .announcement-exit { animation: annSlideUp 0.4s ease-in forwards; }
        `}</style>
      </div>
    );
  }
  