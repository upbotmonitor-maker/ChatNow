import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { db, auth } from "@/lib/firebase";
import { collection, onSnapshot, query, orderBy, setDoc, doc, serverTimestamp, addDoc, limitToLast, limit } from "firebase/firestore";
import { requestNotificationPermission, listenForegroundMessages } from "@/lib/notifications";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LogOut, Store, Settings, Send, Smile, ArrowLeft, MessageSquare, Image, Mic, Play, Pause, X, Globe, Brain, Sparkles } from "lucide-react";
import { UserData } from "@/hooks/use-auth";
import EmojiPicker, { Theme } from "emoji-picker-react";

interface Message {
  id: string;
  senderId: string;
  text?: string;
  imageUrl?: string;
  audioData?: string;
  createdAt: any;
  type: "text" | "image" | "voice" | "system";
}

interface ParallelUniverseState {
  active: boolean;
  scheduledAt?: any;
  shuffledMap?: Record<string, { username: string; photoURL?: string }>;
}

interface GlobalMessage {
  id: string;
  senderId: string;
  username: string;
  text: string;
  createdAt: any;
  verified?: boolean;
}

function getConversationId(uid1: string, uid2: string) {
  return [uid1, uid2].sort().join("_");
}

function formatLastSeen(lastSeen: any): string {
  if (!lastSeen) return "Çevrimdışı";
  const date = lastSeen.toDate ? lastSeen.toDate() : new Date(lastSeen);
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return "Az önce görüldü";
  if (diff < 3600) return `${Math.floor(diff / 60)} dakika önce görüldü`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} saat önce görüldü`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} gün önce görüldü`;
  return date.toLocaleDateString("tr-TR");
}

async function uploadToImgbb(file: File): Promise<string> {
  const apiKey = import.meta.env.VITE_IMGBB_API_KEY;
  const formData = new FormData();
  formData.append("image", file);
  const res = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, { method: "POST", body: formData });
  const data = await res.json();
  if (!data.success) throw new Error("imgbb yükleme başarısız: " + JSON.stringify(data));
  return data.data.display_url as string;
}

function AudioPlayer({ src, isOwn }: { src: string; isOwn: boolean }) {
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else { a.play().catch(() => {}); setPlaying(true); }
  };

  const fmt = (s: number) => {
    if (!isFinite(s) || isNaN(s)) return "--:--";
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  };

  const progress = isFinite(duration) && duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex items-center gap-2 px-3 py-2.5 w-[220px] md:w-[260px]">
      <audio ref={audioRef} src={src}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime ?? 0)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
        onEnded={() => { setPlaying(false); setCurrentTime(0); }} />

      <button onClick={toggle}
        className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
          isOwn ? "bg-white/20 hover:bg-white/30 text-white" : "bg-primary hover:bg-primary/80 text-white"
        }`}>
        {playing
          ? <Pause className="h-4 w-4" />
          : <Play className="h-4 w-4 ml-0.5" />}
      </button>

      <div className="flex-1 flex flex-col gap-1 min-w-0">
        <div className="relative h-2 rounded-full overflow-hidden cursor-pointer"
          style={{ background: isOwn ? "rgba(255,255,255,0.25)" : "rgba(139,92,246,0.2)" }}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = (e.clientX - rect.left) / rect.width;
            if (audioRef.current && isFinite(duration)) {
              audioRef.current.currentTime = pct * duration;
              setCurrentTime(pct * duration);
            }
          }}>
          <div className="absolute inset-y-0 left-0 rounded-full transition-all"
            style={{
              width: `${progress}%`,
              background: isOwn ? "rgba(255,255,255,0.9)" : "rgb(139,92,246)",
            }} />
        </div>
        <span className={`text-[10px] ${isOwn ? "text-white/70" : "text-muted-foreground"}`}>
          {fmt(currentTime)}{isFinite(duration) && duration > 0 ? ` / ${fmt(duration)}` : ""}
        </span>
      </div>
    </div>
  );
}

function useCountdown(targetDate: Date | null): string {
  const [remaining, setRemaining] = useState("");
  useEffect(() => {
    if (!targetDate) { setRemaining(""); return; }
    const tick = () => {
      const diff = Math.max(0, targetDate.getTime() - Date.now());
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(diff === 0 ? "" : `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetDate]);
  return remaining;
}

export default function Home() {
  const { user, userData, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [users, setUsers] = useState<UserData[]>([]);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [activeUser, setActiveUser] = useState<UserData | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<UserData | null>(null);
  const [parallelUniverse, setParallelUniverse] = useState<ParallelUniverseState | null>(null);
  const [globalChatActive, setGlobalChatActive] = useState(false);
  const [globalChatOpen, setGlobalChatOpen] = useState(false);
  const [notifBanner, setNotifBanner] = useState(false);
  const [discoActive, setDiscoActive] = useState(false);
  const [confettiActive, setConfettiActive] = useState(false);
  const [emojiRainActive, setEmojiRainActive] = useState(false);
  const [emojiRainText, setEmojiRainText] = useState("🎉");
  const [tickerActive, setTickerActive] = useState(false);
  const [tickerText, setTickerText] = useState("");
  const [globalMessages, setGlobalMessages] = useState<GlobalMessage[]>([]);
  const [globalMsgText, setGlobalMsgText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const globalEndRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingRef = useRef(false);

  const puScheduledDate = parallelUniverse?.scheduledAt
    ? (parallelUniverse.scheduledAt.toDate ? parallelUniverse.scheduledAt.toDate() : new Date(parallelUniverse.scheduledAt))
    : null;
  const countdown = useCountdown(puScheduledDate);

  useEffect(() => {
    if (!loading && !user) setLocation("/login");
  }, [user, loading, setLocation]);

  // Push notification banner — user hazır olunca hemen kontrol et
  useEffect(() => {
    if (!user) return;
    if ("Notification" in window && Notification.permission !== "granted") {
      setNotifBanner(true);
    }
  }, [user?.uid]);

  // Foreground mesaj dinleyici
  useEffect(() => {
    if (!user) return;
    const unsub = listenForegroundMessages((payload) => {
      const title = payload?.notification?.title ?? "Yeni mesaj";
      const body = payload?.notification?.body ?? "";
      if (document.hasFocus()) return;
      if (Notification.permission === "granted") {
        new Notification(title, { body, icon: "/favicon.svg" });
      }
    });
    return () => { if (typeof unsub === "function") unsub(); };
  }, [user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleEnableNotifications = async () => {
    setNotifBanner(false);
    if (!user) return;
    await requestNotificationPermission(user.uid);
  };

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "users"), orderBy("username"), limit(500));
    const unsub = onSnapshot(q, (snap) => {
      const list: UserData[] = [];
      snap.forEach((d) => {
        const data = d.data() as UserData;
        if (data.uid !== user.uid && !data.bannedAt) list.push(data);
      });
      setUsers(list);
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, "events", "parallelUniverse"), (snap) => {
      if (snap.exists()) setParallelUniverse(snap.data() as ParallelUniverseState);
      else setParallelUniverse(null);
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, "events", "globalChat"), (snap) => {
      const active = snap.exists() && snap.data().active === true;
      setGlobalChatActive(active);
      if (!active) setGlobalChatOpen(false);
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "globalMessages"), orderBy("createdAt"), limitToLast(80));
    const unsub = onSnapshot(q, (snap) => {
      const msgs: GlobalMessage[] = [];
      snap.forEach((d) => msgs.push({ id: d.id, ...d.data() } as GlobalMessage));
      setGlobalMessages(msgs);
      setTimeout(() => globalEndRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
    }, (err) => {
      console.error("globalMessages snapshot error:", err.code, err.message);
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const u1 = onSnapshot(doc(db, "events", "disco"), (s) => { setDiscoActive(s.exists() && s.data().active === true); });
    const u2 = onSnapshot(doc(db, "events", "confetti"), (s) => { setConfettiActive(s.exists() && s.data().active === true); });
    const u3 = onSnapshot(doc(db, "events", "emojiRain"), (s) => { setEmojiRainActive(s.exists() && s.data().active === true); if (s.exists()) setEmojiRainText(s.data().emoji ?? "🎉"); });
    const u4 = onSnapshot(doc(db, "events", "ticker"), (s) => { setTickerActive(s.exists() && s.data().active === true); if (s.exists()) setTickerText(s.data().text ?? ""); });
    return () => { u1(); u2(); u3(); u4(); };
  }, [user]);

  const sendGlobalMessage = async () => {
    if (!globalMsgText.trim() || !user || !userData) return;
    const text = globalMsgText.trim();
    setGlobalMsgText("");
    await addDoc(collection(db, "globalMessages"), {
      senderId: user.uid,
      username: userData.username,
      verified: userData.verified ?? false,
      text,
      createdAt: serverTimestamp(),
    });
  };

  useEffect(() => {
    if (!activeChat || !user) return;
    const q = query(collection(db, "conversations", activeChat, "messages"), orderBy("createdAt"), limitToLast(80));
    const unsub = onSnapshot(q, (snap) => {
      const msgs: Message[] = [];
      snap.forEach((d) => msgs.push({ id: d.id, ...d.data() } as Message));
      setMessages(msgs);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    });
    const typingUnsub = onSnapshot(doc(db, "typing", activeChat), (d) => {
      setOtherUserTyping(d.exists() && activeUser ? d.data()[activeUser.uid] === true : false);
    });
    return () => { unsub(); typingUnsub(); };
  }, [activeChat, user, activeUser]);

  const getDisplayName = (uid: string, fallback: string) => {
    if (parallelUniverse?.active && parallelUniverse.shuffledMap?.[uid]) {
      return parallelUniverse.shuffledMap[uid].username;
    }
    return fallback;
  };

  const getDisplayPhoto = (uid: string, fallback?: string) => {
    if (parallelUniverse?.active && parallelUniverse.shuffledMap?.[uid]?.photoURL) {
      return parallelUniverse.shuffledMap[uid].photoURL;
    }
    return fallback;
  };

  const handleSignOut = async () => {
    if (user) await setDoc(doc(db, "users", user.uid), { online: false, lastSeen: serverTimestamp() }, { merge: true });
    await auth.signOut();
  };

  const openChat = (targetUser: UserData) => {
    if (!user) return;
    setActiveChat(getConversationId(user.uid, targetUser.uid));
    setActiveUser(targetUser);
    setShowSidebar(false);
  };

  const goBack = () => {
    setShowSidebar(true);
    setActiveChat(null);
    setActiveUser(null);
    setMessages([]);
  };

  const updateConversation = async (lastMessage: string) => {
    if (!activeChat || !activeUser || !user) return;
    await setDoc(doc(db, "conversations", activeChat), {
      participants: [user.uid, activeUser.uid],
      lastMessage,
      lastMessageTime: serverTimestamp(),
      lastMessageBy: user.uid,
    }, { merge: true });
  };

  const sendPushNotification = async (toUserId: string, text: string, type = "text") => {
    if (!userData) return;
    try {
      const apiBase = import.meta.env.VITE_API_URL ?? "";
        await fetch(`${apiBase}/api/notifications/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toUserId, senderName: userData.username, text, type }),
      });
    } catch {}
  };

  const sendMessage = async () => {
    if (!messageText.trim() || !user || !activeChat || !activeUser) return;
    const text = messageText;
    setMessageText("");
    await setDoc(doc(db, "typing", activeChat), { [user.uid]: false }, { merge: true });
    await addDoc(collection(db, "conversations", activeChat, "messages"), {
      senderId: user.uid, text, createdAt: serverTimestamp(), type: "text",
    });
    await updateConversation(text);
    void sendPushNotification(activeUser.uid, text, "text");
  };

  const sendImageMessage = async (file: File) => {
    if (!user || !activeChat) return;
    setUploadingImage(true);
    try {
      const url = await uploadToImgbb(file);
      await addDoc(collection(db, "conversations", activeChat, "messages"), {
        senderId: user.uid, imageUrl: url, createdAt: serverTimestamp(), type: "image",
      });
      await updateConversation("📷 Fotoğraf");
      if (userData?.generatingImage) {
        await setDoc(doc(db, "users", user.uid), { generatingImage: false }, { merge: true });
      }
      if (activeUser) void sendPushNotification(activeUser.uid, "📷 Fotoğraf", "image");
    } catch (e: any) {
      alert("Fotoğraf yüklenemedi: " + e.message);
    } finally {
      setUploadingImage(false);
    }
  };

  const startRecording = useCallback(async () => {
    if (recordingRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/ogg";
      const recorder = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.start(100);
      mediaRecorderRef.current = recorder;
      recordingRef.current = true;
      setIsRecording(true);
    } catch (e) {
      console.error("Mikrofon erişimi reddedildi", e);
    }
  }, []);

  const stopRecording = useCallback(async () => {
    if (!recordingRef.current) return;
    recordingRef.current = false;
    setIsRecording(false);
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    recorder.stop();
    recorder.stream.getTracks().forEach((t) => t.stop());
    mediaRecorderRef.current = null;
    const uid = user?.uid;
    const chatId = activeChat;
    if (!uid || !chatId) return;
    recorder.onstop = () => {
      const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType });
      if (blob.size < 500) return;
      const reader = new FileReader();
      reader.onloadend = async () => {
        const audioData = reader.result as string;
        await addDoc(collection(db, "conversations", chatId, "messages"), {
          senderId: uid, audioData, createdAt: serverTimestamp(), type: "voice",
        });
        await updateConversation("🎤 Sesli mesaj");
      };
      reader.readAsDataURL(blob);
    };
  }, [user, activeChat]);

  // Dedicated real-time listener directly on activeUser's Firestore document.
  // This is more reliable than syncing from the users collection because it
  // bypasses any collection-level caching and fires immediately when any field
  // (e.g. `thinking`) changes — ensuring both sides see the animation at once.
  useEffect(() => {
    if (!activeUser?.uid) return;
    const unsub = onSnapshot(doc(db, "users", activeUser.uid), (snap) => {
      if (snap.exists()) {
        setActiveUser((prev) => prev ? { ...prev, ...(snap.data() as UserData) } : null);
      }
    });
    return () => unsub();
  }, [activeUser?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTyping = async (text: string) => {
    setMessageText(text);
    if (!user || !activeChat) return;
    if (text.length > 0 && !isTyping) {
      setIsTyping(true);
      await setDoc(doc(db, "typing", activeChat), { [user.uid]: true }, { merge: true });
    } else if (text.length === 0 && isTyping) {
      setIsTyping(false);
      await setDoc(doc(db, "typing", activeChat), { [user.uid]: false }, { merge: true });
    }
  };

  const onEmojiClick = (emojiObject: any) => handleTyping(messageText + emojiObject.emoji);

  const toggleThinking = async () => {
    if (!user || !userData) return;
    const next = !userData.thinking;
    await setDoc(doc(db, "users", user.uid), { thinking: next }, { merge: true });
  };

  const toggleGeneratingImage = async () => {
    if (!user || !userData) return;
    const next = !userData.generatingImage;
    await setDoc(doc(db, "users", user.uid), { generatingImage: next }, { merge: true });
  };

  if (loading) {
    return (
      <div style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#0d0e11" }}>
        <div style={{ width: 36, height: 36, border: "3px solid rgba(255,255,255,0.12)", borderTop: "3px solid #a78bfa", borderRadius: "50%", animation: "hspin 0.9s linear infinite" }} />
        <p style={{ color: "rgba(255,255,255,0.45)", marginTop: 12, fontSize: 14, fontFamily: "system-ui, sans-serif" }}>Yükleniyor...</p>
        <style>{"@keyframes hspin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}"}</style>
      </div>
    );
  }

  if (!user || !userData) return null;

  const renderProfilePhoto = (u: UserData, size: string = "h-10 w-10", showGif: boolean = false) => {
    const isGifActive = showGif && u.gifEnabled && u.gifUrl && u.gifExpireTime && (u.gifExpireTime.toDate() > new Date());
    const displayPhoto = getDisplayPhoto(u.uid, u.photoURL);
    const displayName = getDisplayName(u.uid, u.username);
    return (
      <Avatar className={`${size} border-2 border-transparent hover:border-primary transition-all cursor-pointer flex-shrink-0`} onClick={() => setSelectedProfile(u)}>
        {isGifActive && !parallelUniverse?.active ? (
          <img src={u.gifUrl} alt={displayName} className="w-full h-full object-cover rounded-full" style={{ display: "block" }} />
        ) : (
          <>
            <AvatarImage src={displayPhoto} className="object-cover" />
            <AvatarFallback className="bg-primary/20 text-primary font-semibold">{displayName?.[0]?.toUpperCase()}</AvatarFallback>
          </>
        )}
      </Avatar>
    );
  };

  const renderStatusText = (u: UserData) => {
    if (u.online) return <span className="text-green-400">Çevrimiçi</span>;
    if (u.lastSeen) return <span className="text-muted-foreground">{formatLastSeen(u.lastSeen)}</span>;
    return <span className="text-muted-foreground">Çevrimdışı</span>;
  };

  const renderMessage = (msg: Message) => {
    const isMe = msg.senderId === user.uid;
    const sender = isMe ? userData : activeUser!;
    const displayName = getDisplayName(msg.senderId, sender?.username ?? "?");
    return (
      <div key={msg.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
        <div className="flex items-end gap-2 max-w-[85%] md:max-w-[70%]">
          {!isMe && <div className="pointer-events-none flex-shrink-0">{renderProfilePhoto(sender, "h-7 w-7 md:h-8 md:w-8")}</div>}
          <div className={`rounded-2xl overflow-hidden ${isMe ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-secondary text-secondary-foreground rounded-bl-sm"}`}>
            {msg.type === "image" && msg.imageUrl && (
              <img
                src={msg.imageUrl}
                alt="Fotoğraf"
                className="max-w-[240px] max-h-[320px] object-cover cursor-pointer block"
                referrerPolicy="no-referrer"
                crossOrigin="anonymous"
                onClick={() => setLightboxUrl(msg.imageUrl!)}
              />
            )}
            {msg.type === "voice" && msg.audioData && (
              <AudioPlayer src={msg.audioData} isOwn={isMe} />
            )}
            {(msg.type === "text" || msg.type === "system") && msg.text && (
              <p className="text-sm break-words px-3 py-2">{msg.text}</p>
            )}
          </div>
        </div>
        <span className="text-[10px] text-muted-foreground mt-1 mx-9 md:mx-10">
          {displayName} · {msg.createdAt?.toDate?.().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
    );
  };

  const myOnline = userData.online;
  const isPUActive = parallelUniverse?.active === true;
  const showCountdown = !isPUActive && countdown && puScheduledDate && puScheduledDate > new Date();

  return (
    <div className="flex h-screen overflow-hidden bg-background flex-col">
      {discoActive && <div className="chatnow-disco-overlay" />}
      {confettiActive && [0,1,2,3,4,5].map(i => <div key={i} className="chatnow-confetti-piece" style={{left:((i*17+3)%93)+"%",animationDelay:(i*0.5)+"s",background:["#ff4f9a","#ffd700","#00e0ff","#7c3aed","#22c55e","#f97316"][i]}} />)}
      {emojiRainActive && [0,1,2,3,4,5,6,7].map(i => <div key={i} className="chatnow-emoji-piece" style={{left:((i*13+5)%93)+"%",animationDelay:(i*0.4)+"s"}}>{emojiRainText}</div>)}
      {tickerActive && tickerText && (
        <div className="w-full overflow-hidden flex-shrink-0 bg-gradient-to-r from-orange-600 via-red-600 to-orange-600 border-b border-orange-400/40" style={{height:"36px"}}>
          <div className="flex h-full items-center">
            <span className="text-white text-sm font-bold px-3 flex-shrink-0">📢</span>
            <div className="overflow-hidden flex-1">
              <span className="chatnow-ticker text-white text-sm font-medium whitespace-nowrap inline-block">{tickerText} &nbsp;&nbsp; {tickerText} &nbsp;&nbsp; {tickerText}</span>
            </div>
          </div>
        </div>
      )}
      {/* Parallel Universe Countdown Banner */}
      {showCountdown && (
        <div className="w-full bg-gradient-to-r from-purple-900/90 via-indigo-900/90 to-purple-900/90 border-b border-purple-500/40 px-4 py-2 flex items-center justify-center gap-3 text-sm countdown-pulse z-20">
          <span className="text-2xl">🌀</span>
          <span className="text-purple-200 font-medium">Paralel Evren Olayı başlıyor:</span>
          <span className="font-mono font-bold text-purple-100 text-base tracking-widest bg-purple-800/50 px-3 py-0.5 rounded-lg">{countdown}</span>
        </div>
      )}

      {/* Parallel Universe Active Banner */}
      {isPUActive && (
        <div className="w-full bg-gradient-to-r from-red-900/90 via-orange-900/90 to-red-900/90 border-b border-red-500/40 px-4 py-2 flex items-center justify-center gap-3 text-sm z-20">
          <span className="text-xl">🔴</span>
          <span className="text-red-200 font-semibold">PARALEL EVREN AKTİF — Kimse kim olduğunu bilmiyor! 🕵️‍♂️</span>
          <span className="text-xl">🔴</span>
        </div>
      )}

      {/* Bildirim izni banner */}
      {notifBanner && (
        <div className="w-full bg-primary/10 border-b border-primary/20 px-4 py-2 flex items-center justify-between gap-3 text-sm z-20">
          <span className="text-foreground/80 flex items-center gap-2">
            🔔 <span>
              {Notification.permission === "denied"
                ? "Bildirimler engellendi. Tarayıcı ayarlarından etkinleştirin."
                : "Mesaj geldiğinde haberdar olmak ister misin?"}
            </span>
          </span>
          <div className="flex items-center gap-2 flex-shrink-0">
            {Notification.permission !== "denied" && (
              <button
                onClick={handleEnableNotifications}
                className="bg-primary text-primary-foreground text-xs px-3 py-1 rounded-full font-medium hover:opacity-90 transition-opacity"
              >
                Bildirimleri Aç
              </button>
            )}
            <button
              onClick={() => setNotifBanner(false)}
              className="text-muted-foreground hover:text-foreground text-xs px-2 py-1 rounded transition-colors"
            >
              {Notification.permission === "denied" ? "Tamam" : "Hayır"}
            </button>
          </div>
        </div>
      )}
      <div className="flex flex-1 overflow-hidden">
        {/* Image lightbox */}
        {lightboxUrl && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)" }}
            onClick={() => setLightboxUrl(null)}>
            <button
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all z-10"
              onClick={() => setLightboxUrl(null)}>
              <X className="h-5 w-5" />
            </button>
            <img
              src={lightboxUrl}
              alt="Fotoğraf"
              className="max-w-[95vw] max-h-[90vh] object-contain rounded-xl shadow-2xl"
              referrerPolicy="no-referrer"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}

        {/* Sidebar */}
        <div className={`${showSidebar ? "flex" : "hidden"} md:flex w-full md:w-80 lg:w-96 border-r border-border flex-col bg-card/50 absolute md:relative inset-0 z-10 md:z-auto`}>
          <div className="p-3 md:p-4 border-b border-border flex items-center justify-between gap-2 flex-shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative flex-shrink-0">
                {renderProfilePhoto(userData)}
                <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-background ${myOnline ? "bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]" : "bg-gray-500"}`} />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate">{userData.username}</p>
                <p className={`text-xs font-medium ${myOnline ? "text-green-400" : "text-muted-foreground"}`}>{myOnline ? "Çevrimiçi" : "Çevrimdışı"}</p>
              </div>
            </div>
            <div className="flex gap-1 flex-shrink-0">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setLocation("/settings")}><Settings className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleSignOut}><LogOut className="h-4 w-4" /></Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-1">
            {globalChatActive && (
              <div
                className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all duration-150 mb-2 ${globalChatOpen ? "bg-green-500/20 border border-green-500/40" : "hover:bg-green-500/10 border border-green-500/20"}`}
                onClick={() => { setGlobalChatOpen(true); setActiveChat(null); setActiveUser(null); setShowSidebar(false); }}
              >
                <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                  <Globe className="h-5 w-5 text-green-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-green-400">🌍 Global Sohbet</p>
                  <p className="text-xs text-green-400/60">Herkese açık sohbet odası</p>
                </div>
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
              </div>
            )}
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">Sohbetler ({users.length})</p>
            {users.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                <MessageSquare className="h-8 w-8 opacity-30" />
                <p className="text-sm">Henüz kullanıcı yok</p>
              </div>
            )}
            {users.map((u) => (
              <div key={u.uid}
                className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all duration-150 ${activeUser?.uid === u.uid ? "bg-primary/20 border border-primary/30" : "hover:bg-accent border border-transparent"}`}
                onClick={() => openChat(u)}>
                <div className="relative pointer-events-none flex-shrink-0">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={getDisplayPhoto(u.uid, u.photoURL)} />
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold">{getDisplayName(u.uid, u.username)?.[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                  {u.online && <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-background shadow-[0_0_8px_rgba(34,197,94,0.5)]" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <p className="font-medium text-sm truncate">{getDisplayName(u.uid, u.username)}</p>
                    {u.verified && !isPUActive && <img src="/verified-badge.png" alt="Onaylı" className="h-4 w-4 flex-shrink-0" />}
                  </div>
                  <p className="text-xs truncate">{renderStatusText(u)}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 md:p-4 border-t border-border flex-shrink-0">
            <Button variant="outline" className="w-full gap-2 justify-start" onClick={() => setLocation("/store")}>
              <Store className="h-4 w-4 text-primary flex-shrink-0" />
              <span className="text-primary font-medium">Mağaza</span>
            </Button>
          </div>
        </div>

        {/* Chat area */}
        <div className={`${!showSidebar ? "flex" : "hidden"} md:flex flex-1 flex-col bg-background relative w-full md:w-auto absolute md:relative inset-0 z-10 md:z-auto`}>
          {globalChatOpen ? (
            <div className="h-full flex flex-col">
              {/* Global Chat Header */}
              <div className="h-14 md:h-16 border-b border-border flex items-center px-3 md:px-6 bg-card/50 shadow-sm z-10 gap-2 flex-shrink-0">
                <Button variant="ghost" size="icon" className="md:hidden h-8 w-8 flex-shrink-0" onClick={() => { setGlobalChatOpen(false); setShowSidebar(true); }}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="w-9 h-9 rounded-full bg-green-500/20 flex items-center justify-center">
                  <Globe className="h-5 w-5 text-green-400" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-green-400">🌍 Global Sohbet</p>
                  <p className="text-xs text-muted-foreground">Herkese açık sohbet odası</p>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1.5 font-mono text-sm">
                {globalMessages.length === 0 && (
                  <p className="text-center text-muted-foreground text-xs py-8">Henüz mesaj yok. İlk mesajı sen at!</p>
                )}
                {globalMessages.map((msg) => (
                  <div key={msg.id} className={`flex items-baseline gap-1 ${msg.senderId === user?.uid ? "text-primary" : "text-foreground"}`}>
                    <span className={`font-bold whitespace-nowrap ${msg.senderId === user?.uid ? "text-primary" : "text-blue-300"}`}>
                      [{msg.username}]
                    </span>
                    {msg.verified && <img src="/verified-badge.png" alt="" className="h-3.5 w-3.5 inline-block flex-shrink-0 translate-y-0.5" />}
                    <span className="text-white/40 mx-0.5">:</span>
                    <span className="break-words flex-1">{msg.text}</span>
                  </div>
                ))}
                <div ref={globalEndRef} />
              </div>

              {/* Input */}
              <div className="border-t border-border p-3 flex gap-2 flex-shrink-0">
                <input
                  className="flex-1 bg-card border border-border rounded-xl px-4 py-2 text-sm outline-none focus:border-green-500/50 font-mono"
                  placeholder="Mesajını yaz..."
                  value={globalMsgText}
                  onChange={(e) => setGlobalMsgText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendGlobalMessage(); } }}
                />
                <Button size="icon" className="bg-green-600 hover:bg-green-500 text-white flex-shrink-0" onClick={() => void sendGlobalMessage()} disabled={!globalMsgText.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : activeChat && activeUser ? (
            <div className="h-full flex flex-col">
              <div className="h-14 md:h-16 border-b border-border flex items-center px-3 md:px-6 bg-card/50 shadow-sm z-10 gap-2 flex-shrink-0">
                <Button variant="ghost" size="icon" className="md:hidden h-8 w-8 flex-shrink-0" onClick={goBack}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative flex-shrink-0">
                    {renderProfilePhoto(activeUser, "h-9 w-9 md:h-10 md:w-10")}
                    {activeUser.online && <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-background" />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1">
                      <p className="font-semibold text-sm truncate">{getDisplayName(activeUser.uid, activeUser.username)}</p>
                      {activeUser.verified && !isPUActive && <img src="/verified-badge.png" alt="Onaylı" className="h-4 w-4 flex-shrink-0" />}
                    </div>
                    <p className="text-xs text-primary truncate">
                      {otherUserTyping ? "yazıyor..." : activeUser.online ? "Çevrimiçi" : activeUser.lastSeen ? formatLastSeen(activeUser.lastSeen) : "Çevrimdışı"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-3 md:p-6 space-y-3">
                {messages.map(renderMessage)}
                {/* Karşıdaki kişi AssistGPT → sol tarafta Thinking balonu */}
                {activeUser?.thinking && activeUser?.username === "AssistGPT" && (
                  <div className="flex items-end gap-2">
                    <div className="pointer-events-none flex-shrink-0">{renderProfilePhoto(activeUser, "h-7 w-7")}</div>
                    <div className="bg-black rounded-2xl rounded-bl-sm px-5 py-3 border border-zinc-800 min-w-[100px]">
                      <span className="thinking-shimmer-text text-sm">Thinking</span>
                    </div>
                  </div>
                )}
                {/* Sen AssistGPT isen → sağ tarafta kendi Thinking balonun */}
                {userData?.username === "AssistGPT" && userData?.thinking && (
                  <div className="flex flex-col items-end">
                    <div className="bg-zinc-900 border border-zinc-700 rounded-2xl rounded-br-sm px-5 py-3 min-w-[100px]">
                      <span className="thinking-shimmer-text text-sm">Thinking</span>
                    </div>
                  </div>
                )}
                {/* Karşıdaki kişi AssistGPT → sol tarafta Görsel oluşturuluyor */}
                {activeUser?.generatingImage && activeUser?.username === "AssistGPT" && (
                  <div className="flex items-end gap-2">
                    <div className="pointer-events-none flex-shrink-0">{renderProfilePhoto(activeUser, "h-7 w-7")}</div>
                    <div className="bg-zinc-950 rounded-2xl rounded-bl-sm px-4 py-3 border border-zinc-800">
                      <p className="thinking-shimmer-text text-sm mb-2">Görsel oluşturuluyor</p>
                      <div className="image-gen-placeholder" />
                    </div>
                  </div>
                )}
                {/* Sen AssistGPT isen → sağ tarafta kendi Görsel oluşturuluyor balonun */}
                {userData?.username === "AssistGPT" && userData?.generatingImage && (
                  <div className="flex flex-col items-end">
                    <div className="bg-zinc-950 rounded-2xl rounded-br-sm px-4 py-3 border border-zinc-800">
                      <p className="thinking-shimmer-text text-sm mb-2">Görsel oluşturuluyor</p>
                      <div className="image-gen-placeholder" />
                    </div>
                  </div>
                )}
                {/* Yazıyor... göstergesi (Thinking ve generatingImage aktif değilken) */}
                {otherUserTyping && !activeUser?.thinking && !activeUser?.generatingImage && (
                  <div className="flex items-end gap-2">
                    <div className="pointer-events-none flex-shrink-0">{renderProfilePhoto(activeUser, "h-7 w-7")}</div>
                    <div className="bg-secondary rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1 items-center">
                      <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
                      <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
                      <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="p-3 md:p-4 bg-card/50 border-t border-border flex-shrink-0">
                <div className="flex gap-1.5 items-center">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary flex-shrink-0 h-9 w-9">
                        <Smile className="h-5 w-5" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent side="top" align="start" className="w-auto p-0 border-none bg-transparent shadow-none">
                      <EmojiPicker theme={Theme.DARK} onEmojiClick={onEmojiClick} />
                    </PopoverContent>
                  </Popover>

                  {userData?.username === "AssistGPT" && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        title={userData.thinking ? "Thinking modu kapat" : "Thinking modu aç"}
                        onClick={toggleThinking}
                        className={`flex-shrink-0 h-9 w-9 transition-all ${
                          userData.thinking
                            ? "text-white bg-zinc-800 hover:bg-zinc-700"
                            : "text-muted-foreground hover:text-primary"
                        }`}
                      >
                        <Brain className="h-5 w-5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title={userData.generatingImage ? "Görsel oluşturma kapat" : "Görsel oluşturuluyor modu aç"}
                        onClick={toggleGeneratingImage}
                        className={`flex-shrink-0 h-9 w-9 transition-all ${
                          userData.generatingImage
                            ? "text-purple-300 bg-purple-900/40 hover:bg-purple-900/60"
                            : "text-muted-foreground hover:text-primary"
                        }`}
                      >
                        <Sparkles className="h-5 w-5" />
                      </Button>
                    </>
                  )}

                  <input ref={imageInputRef} type="file" accept="image/*" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) sendImageMessage(f); e.target.value = ""; }} />
                  <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary flex-shrink-0 h-9 w-9"
                    onClick={() => imageInputRef.current?.click()} disabled={uploadingImage}>
                    {uploadingImage
                      ? <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      : <Image className="h-5 w-5" />}
                  </Button>

                  <input
                    className="flex-1 bg-input/50 rounded-full px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 border border-border placeholder:text-muted-foreground transition-all min-w-0"
                    placeholder="Bir mesaj yazın..."
                    value={messageText}
                    onChange={(e) => handleTyping(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  />

                  {messageText.trim() ? (
                    <Button className="rounded-full h-9 w-9 p-0 flex-shrink-0" onClick={sendMessage}>
                      <Send className="h-4 w-4 ml-0.5" />
                    </Button>
                  ) : (
                    <button
                      className={`rounded-full h-9 w-9 flex items-center justify-center flex-shrink-0 transition-all select-none ${
                        isRecording
                          ? "bg-red-500 text-white shadow-[0_0_12px_rgba(239,68,68,0.5)]"
                          : "bg-primary text-primary-foreground"
                      }`}
                      onMouseDown={startRecording}
                      onMouseUp={stopRecording}
                      onMouseLeave={() => { if (isRecording) stopRecording(); }}
                      onTouchStart={(e) => { e.preventDefault(); startRecording(); }}
                      onTouchEnd={(e) => { e.preventDefault(); stopRecording(); }}
                    >
                      <Mic className={`h-4 w-4 ${isRecording ? "animate-pulse" : ""}`} />
                    </button>
                  )}
                </div>
                {isRecording && (
                  <p className="text-xs text-red-400 text-center mt-2 animate-pulse">🔴 Kayıt yapılıyor... Bırakınca gönderilecek</p>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full hidden md:flex items-center justify-center text-muted-foreground flex-col gap-4">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                <MessageSquare className="h-7 w-7" />
              </div>
              <div className="text-center">
                <p className="font-medium">Sohbet seçin</p>
                <p className="text-sm text-muted-foreground mt-1">Sol taraftan bir kullanıcı seçerek sohbet başlatın</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <Dialog open={!!selectedProfile} onOpenChange={(o) => !o && setSelectedProfile(null)}>
        <DialogContent className="sm:max-w-md mx-4">
          {selectedProfile && (
            <>
              <DialogHeader><DialogTitle>Kullanıcı Profili</DialogTitle></DialogHeader>
              <div className="flex flex-col items-center gap-4 py-4">
                <div className="relative">
                  {renderProfilePhoto(selectedProfile, "h-24 w-24", true)}
                  {selectedProfile.online && <div className="absolute bottom-1 right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-background" />}
                </div>
                <div className="text-center">
                  <h3 className="text-xl font-bold">{getDisplayName(selectedProfile.uid, selectedProfile.username)}</h3>
                  <p className="text-sm mt-1">{renderStatusText(selectedProfile)}</p>
                </div>
                {selectedProfile.bio && (
                  <div className="w-full mt-2 p-4 bg-secondary/50 rounded-xl">
                    <p className="text-sm italic text-center">"{selectedProfile.bio}"</p>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
