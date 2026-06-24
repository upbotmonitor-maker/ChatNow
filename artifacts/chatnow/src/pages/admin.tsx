
  // Ticker listener
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "events", "ticker"), (snap) => {
      if (snap.exists()) {
        setTickerActive(snap.data().active === true);
        if (snap.data().text) setTickerText(snap.data().text);
      } else {
        setTickerActive(false);
      }
    });
    return unsub;
  }, []);
import { useState, useEffect, useRef } from "react";
import { db, auth } from "@/lib/firebase";
import { signInAnonymously } from "firebase/auth";
import { collection, onSnapshot, doc, updateDoc, deleteDoc, query, orderBy, getDocs, Timestamp, setDoc } from "firebase/firestore";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
  import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { ArrowLeft, Users, MessageSquare, Wifi, Search, Ban, Trash2, Eye, Megaphone, Globe, Clock, MessageCircle, Wrench } from "lucide-react";
import type { UserData } from "@/hooks/use-auth";

interface Message {
  id: string;
  senderId: string;
  text: string;
  createdAt: any;
}

interface Conversation {
  id: string;
  participants: string[];
  lastMessage?: string;
}

interface ParallelUniverseState {
  active: boolean;
  scheduledAt?: any;
  shuffledMap?: Record<string, { username: string; photoURL?: string }>;
}

const ADMIN_PASSWORD = "9999";

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

export default function Admin() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState(false);
  const [users, setUsers] = useState<UserData[]>([]);
  const [search, setSearch] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [convMessages, setConvMessages] = useState<Message[]>([]);
  const [convSearch, setConvSearch] = useState("");
  const [selectedProfile, setSelectedProfile] = useState<UserData | null>(null);
  const [onlineCount, setOnlineCount] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [globalChatActive, setGlobalChatActive] = useState(false);
  const [globalChatLoading, setGlobalChatLoading] = useState(false);

  const [maintenanceActive, setMaintenanceActive] = useState(false);
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);
    const [tickerActive, setTickerActive] = useState(false);
    const [tickerLoading, setTickerLoading] = useState(false);
    const [tickerText, setTickerText] = useState("🎉 Hoş geldiniz! ChatNow'a hoş geldiniz!");
    const [discoActive, setDiscoActive] = useState(false);
    const [discoLoading, setDiscoLoading] = useState(false);
    const [confettiActive, setConfettiActive] = useState(false);
    const [confettiLoading, setConfettiLoading] = useState(false);
    const [emojiRainActive, setEmojiRainActive] = useState(false);
    const [emojiRainLoading, setEmojiRainLoading] = useState(false);
    const [emojiRainText, setEmojiRainText] = useState("🎉");

  const [annSender, setAnnSender] = useState("Admin");
  const [annText, setAnnText] = useState("");
  const [annLoading, setAnnLoading] = useState(false);

  const [puState, setPuState] = useState<ParallelUniverseState | null>(null);
  const [puLoading, setPuLoading] = useState(false);

  const [cdMode, setCdMode] = useState<"duration" | "clock">("duration");
  const [cdHours, setCdHours] = useState("0");
  const [cdMinutes, setCdMinutes] = useState("5");
  const [cdSeconds, setCdSeconds] = useState("0");
  const [cdClockTime, setCdClockTime] = useState("");
  const [cdLoading, setCdLoading] = useState(false);
  const autoStartFiredRef = useRef(false);

  const puScheduledDate = puState?.scheduledAt
    ? (puState.scheduledAt.toDate ? puState.scheduledAt.toDate() : new Date(puState.scheduledAt))
    : null;
  const countdown = useCountdown(puScheduledDate);

  useEffect(() => {
    if (!puScheduledDate || puState?.active) {
      autoStartFiredRef.current = false;
      return;
    }
    const diff = puScheduledDate.getTime() - Date.now();
    if (diff <= 0 && !autoStartFiredRef.current) {
      autoStartFiredRef.current = true;
      void handleStartParallelUniverse(true);
      return;
    }
    if (diff > 0) {
      const timer = setTimeout(() => {
        if (!autoStartFiredRef.current) {
          autoStartFiredRef.current = true;
          void handleStartParallelUniverse(true);
        }
      }, diff);
      return () => clearTimeout(timer);
    }
    return;
  }, [puScheduledDate, puState?.active]);

  useEffect(() => {
    if (!authed) return;
    const unsub = onSnapshot(collection(db, "users"), (snap) => {
      const list: UserData[] = [];
      let online = 0;
      snap.forEach((d) => {
        const data = d.data() as UserData;
        list.push(data);
        if (data.online) online++;
      });
      list.sort((a, b) => (a.username ?? "").localeCompare(b.username ?? ""));
      setUsers(list);
      setOnlineCount(online);
    });
    return () => unsub();
  }, [authed]);

  useEffect(() => {
    if (!authed) return;
    const unsub = onSnapshot(collection(db, "conversations"), (snap) => {
      const list: Conversation[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Conversation));
      setConversations(list);
    });
    return () => unsub();
  }, [authed]);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "events", "globalChat"), (snap) => {
      setGlobalChatActive(snap.exists() ? snap.data().active === true : false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "events", "maintenance"), (snap) => {
      setMaintenanceActive(snap.exists() && snap.data().active === true);
    });
    return () => unsub();
  }, []);

  const handleToggleMaintenance = async () => {
    setMaintenanceLoading(true);
    try {
      const next = !maintenanceActive;
      await setDoc(doc(db, "events", "maintenance"), { active: next });
      toast({ title: next ? "🔧 Bakım modu açıldı" : "✅ Bakım modu kapatıldı" });
    } catch (err: any) {
      toast({ title: "Hata", description: err.message, variant: "destructive" });
    } finally {
      setMaintenanceLoading(false);
    }
  };


    const handleToggleDisco = async () => {
      setDiscoLoading(true);
      const next = !discoActive;
      await setDoc(doc(db, "events", "disco"), { active: next });
      toast({ title: next ? "🪩 Disco Modu açıldı!" : "Disco Modu kapatıldı" });
      setDiscoLoading(false);
    };

    const handleToggleConfetti = async () => {
      setConfettiLoading(true);
      const next = !confettiActive;
      await setDoc(doc(db, "events", "confetti"), { active: next });
      toast({ title: next ? "🎊 Konfeti Partisi başladı!" : "Konfeti kapatıldı" });
      setConfettiLoading(false);
    };

    const handleToggleEmojiRain = async () => {
      setEmojiRainLoading(true);
      const next = !emojiRainActive;
      await setDoc(doc(db, "events", "emojiRain"), { active: next, emoji: emojiRainText });
      toast({ title: next ? `${emojiRainText} Emoji Yağmuru başladı!` : "Emoji Yağmuru kapatıldı" });
      setEmojiRainLoading(false);
    };
    const handleToggleTicker = async () => {
      setTickerLoading(true);
      const next = !tickerActive;
      await setDoc(doc(db, "events", "ticker"), { active: next, text: tickerText });
      toast({ title: next ? "📢 Kayan Duyuru yayında!" : "Kayan Duyuru durduruldu" });
      setTickerLoading(false);
    };

    const handleToggleGlobalChat = async () => {
    setGlobalChatLoading(true);
    try {
      const next = !globalChatActive;
      await setDoc(doc(db, "events", "globalChat"), { active: next });
      toast({ title: next ? "🌍 Global Sohbet açıldı" : "Global Sohbet kapatıldı" });
    } catch (err: any) {
      toast({ title: "Hata", description: err.message, variant: "destructive" });
    } finally {
      setGlobalChatLoading(false);
    }
  };

  useEffect(() => {
    if (!authed) return;
    const unsub = onSnapshot(doc(db, "events", "parallelUniverse"), (snap) => {
      if (snap.exists()) setPuState(snap.data() as ParallelUniverseState);
      else setPuState(null);
    });
    return () => unsub();
  }, [authed]);

  const loadConvMessages = async (conv: Conversation) => {
    setSelectedConv(conv);
    try {
      const q = query(collection(db, "conversations", conv.id, "messages"), orderBy("createdAt"));
      const snap = await getDocs(q);
      const msgs: Message[] = [];
      snap.forEach((d) => msgs.push({ id: d.id, ...d.data() } as Message));
      setConvMessages(msgs);
    } catch {
      setConvMessages([]);
    }
  };

  const verifyUser = async (u: UserData) => {
    try {
      await updateDoc(doc(db, "users", u.uid), { verified: true });
      toast({ title: "✅ Onaylandı", description: `@${u.username} artık onaylı.` });
    } catch (err: any) {
      toast({ title: "Hata", description: err.message, variant: "destructive" });
    }
  };

  const unverifyUser = async (u: UserData) => {
    try {
      await updateDoc(doc(db, "users", u.uid), { verified: false });
      toast({ title: "Onay kaldırıldı", description: `@${u.username} onayı kaldırıldı.` });
    } catch (err: any) {
      toast({ title: "Hata", description: err.message, variant: "destructive" });
    }
  };

  const banUser = async (u: UserData) => {
    try {
      await updateDoc(doc(db, "users", u.uid), { bannedAt: Timestamp.now() });
      toast({ title: "Kullanıcı yasaklandı", description: `@${u.username} banlı.` });
    } catch (err: any) {
      toast({ title: "Hata", description: err.message, variant: "destructive" });
    }
  };

  const unbanUser = async (u: UserData) => {
    try {
      await updateDoc(doc(db, "users", u.uid), { bannedAt: null });
      toast({ title: "Ban kaldırıldı" });
    } catch (err: any) {
      toast({ title: "Hata", description: err.message, variant: "destructive" });
    }
  };

  const deleteUser = async (u: UserData) => {
    if (!confirm(`@${u.username} silinsin mi?`)) return;
    try {
      await deleteDoc(doc(db, "users", u.uid));
      try { await deleteDoc(doc(db, "usernames", u.username.toLowerCase())); } catch {}
      toast({ title: "Kullanıcı silindi" });
    } catch (err: any) {
      toast({ title: "Hata", description: err.message, variant: "destructive" });
    }
  };

  const deleteAllUsers = async () => {
    if (!confirm("TÜM hesaplar ve sohbetler silinecek! Geri alınamaz. Emin misiniz?")) return;
    if (!confirm("Son onay: Tüm verileri silmek istiyorsunuz!")) return;
    setDeleting(true);
    let deleted = 0;
    let failed = 0;
    try {
      const [usersSnap, usernamesSnap, convsSnap] = await Promise.all([
        getDocs(collection(db, "users")),
        getDocs(collection(db, "usernames")),
        getDocs(collection(db, "conversations")),
      ]);
      const all = [...usersSnap.docs, ...usernamesSnap.docs, ...convsSnap.docs];
      for (const d of all) {
        try { await deleteDoc(d.ref); deleted++; } catch { failed++; }
      }
      toast({
        title: deleted > 0 ? "Silindi" : "Silinemedi",
        description: `${deleted} belge silindi${failed > 0 ? `, ${failed} belgede yetki hatası` : ""}.`,
        variant: failed > 0 && deleted === 0 ? "destructive" : "default",
      });
    } catch (err: any) {
      toast({ title: "Hata", description: err.message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const publishAnnouncement = async (senderName: string, text: string) => {
    await setDoc(doc(db, "events", "globalAnnouncement"), {
      senderName,
      text,
      publishedAt: Timestamp.now(),
    });
  };

  const handlePublishAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!annText.trim()) return;
    setAnnLoading(true);
    try {
      await publishAnnouncement(annSender.trim() || "Admin", annText.trim());
      toast({ title: "✅ Duyuru gönderildi!", description: "Tüm kullanıcılara gösterilecek." });
      setAnnText("");
    } catch (err: any) {
      toast({ title: "Hata", description: err.message, variant: "destructive" });
    } finally {
      setAnnLoading(false);
    }
  };

  async function handleStartParallelUniverse(fromTimer = false) {
    setPuLoading(true);
    try {
      const usersSnap = await getDocs(collection(db, "users"));
      const allUsers: { uid: string; username: string; photoURL?: string }[] = [];
      usersSnap.forEach((d) => {
        const data = d.data();
        if (data.uid && data.username) {
          allUsers.push({ uid: data.uid, username: data.username, photoURL: data.photoURL });
        }
      });

      if (allUsers.length < 2) {
        if (!fromTimer) toast({ title: "Yeterli kullanıcı yok", description: "En az 2 kullanıcı gerekli.", variant: "destructive" });
        return;
      }

      const shuffledNames = [...allUsers.map((u) => ({ username: u.username, photoURL: u.photoURL }))];
      for (let i = shuffledNames.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledNames[i], shuffledNames[j]] = [shuffledNames[j], shuffledNames[i]];
      }

      const shuffledMap: Record<string, { username: string; photoURL?: string }> = {};
      for (let i = 0; i < allUsers.length; i++) {
        let idx = i;
        if (shuffledNames[idx].username === allUsers[i].username) {
          idx = (i + 1) % allUsers.length;
        }
        shuffledMap[allUsers[i].uid] = {
          username: shuffledNames[idx].username,
          photoURL: shuffledNames[idx].photoURL,
        };
      }

      await setDoc(doc(db, "events", "parallelUniverse"), {
        active: true,
        scheduledAt: null,
        shuffledMap,
      });

      await publishAnnouncement(
        "🌀 Sistem",
        "🔴 PARALEL EVREN BAŞLADI! Kimse kim olduğunu bilmiyor... Kimin eli kimin cebinde? 🕵️‍♂️🔥"
      );

      if (!fromTimer) toast({ title: "🌀 Paralel Evren Başlatıldı!", description: "Tüm kimlikler karıştırıldı." });
    } catch (err: any) {
      if (!fromTimer) toast({ title: "Hata", description: err.message, variant: "destructive" });
    } finally {
      setPuLoading(false);
    }
  }

  const handleStopParallelUniverse = async () => {
    setPuLoading(true);
    try {
      await setDoc(doc(db, "events", "parallelUniverse"), {
        active: false,
        scheduledAt: null,
        shuffledMap: {},
      });
      await publishAnnouncement(
        "🌀 Sistem",
        "🟢 Paralel Evren sona erdi! Herkes kendi bedenine döndü. Gerçek kimlikler geri geldi! ✨"
      );
      toast({ title: "✅ Paralel Evren durduruldu." });
    } catch (err: any) {
      toast({ title: "Hata", description: err.message, variant: "destructive" });
    } finally {
      setPuLoading(false);
    }
  };

  const handleScheduleCountdown = async (e: React.FormEvent) => {
    e.preventDefault();
    setCdLoading(true);
    try {
      let targetMs: number;

      if (cdMode === "duration") {
        const h = parseInt(cdHours) || 0;
        const m = parseInt(cdMinutes) || 0;
        const s = parseInt(cdSeconds) || 0;
        const totalMs = (h * 3600 + m * 60 + s) * 1000;
        if (totalMs <= 0) throw new Error("Geçerli bir süre girin.");
        targetMs = Date.now() + totalMs;
      } else {
        const [hh, mm] = (cdClockTime || "").split(":").map(Number);
        if (isNaN(hh) || isNaN(mm)) throw new Error("Geçerli bir saat girin (SS:DD).");
        const turkeyOffset = 3 * 60;
        const now = new Date();
        const localOffset = -now.getTimezoneOffset();
        const diffMs = (turkeyOffset - localOffset) * 60 * 1000;
        const nowTurkey = new Date(now.getTime() + diffMs);
        const target = new Date(nowTurkey);
        target.setHours(hh, mm, 0, 0);
        if (target.getTime() <= nowTurkey.getTime()) {
          target.setDate(target.getDate() + 1);
        }
        targetMs = target.getTime() - diffMs;
      }

      autoStartFiredRef.current = false;
      await setDoc(doc(db, "events", "parallelUniverse"), {
        active: false,
        scheduledAt: Timestamp.fromMillis(targetMs),
        shuffledMap: {},
      });

      toast({ title: "⏰ Geri sayım başlatıldı!", description: "Süre dolunca Paralel Evren otomatik başlayacak." });
    } catch (err: any) {
      toast({ title: "Hata", description: err.message, variant: "destructive" });
    } finally {
      setCdLoading(false);
    }
  };

  const handleCancelCountdown = async () => {
    try {
      autoStartFiredRef.current = true;
      await setDoc(doc(db, "events", "parallelUniverse"), {
        active: false,
        scheduledAt: null,
        shuffledMap: {},
      });
      toast({ title: "⏹ Geri sayım iptal edildi." });
    } catch (err: any) {
      toast({ title: "Hata", description: err.message, variant: "destructive" });
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      try {
        if (!auth.currentUser) await signInAnonymously(auth);
      } catch {}
      setAuthed(true);
      try { await setDoc(doc(db, "config", "admin"), { uid: auth.currentUser?.uid }, { merge: true }); } catch (_e) {}
        try { await setDoc(doc(db, "config", "admin"), { uid: auth.currentUser?.uid }, { merge: true }); } catch (_e) {}
      setPasswordError(false);
    } else {
      setPasswordError(true);
    }
  };

  const getUsernameById = (uid: string) => {
    const found = users.find((u) => u.uid === uid);
    return found?.username ?? uid.slice(0, 8);
  };

  const filteredUsers = users.filter((u) =>
    (u.username ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const filteredConvs = convSearch
    ? conversations.filter((c) =>
        c.participants.some((uid) =>
          getUsernameById(uid).toLowerCase().includes(convSearch.toLowerCase())
        )
      )
    : conversations;

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-8 shadow-xl">
          <h1 className="text-2xl font-bold text-primary mb-2">Admin Paneli</h1>
          <p className="text-muted-foreground text-sm mb-6">Giriş için şifre gereklidir.</p>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <Input
              type="password"
              placeholder="Şifre"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
            {passwordError && <p className="text-destructive text-sm">Yanlış şifre.</p>}
            <Button type="submit" className="w-full">Giriş</Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold text-primary">Admin Paneli</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-card border border-border rounded-xl p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Toplam Kullanıcı</p>
              <p className="text-2xl font-bold">{users.length}</p>
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <MessageSquare className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Toplam Sohbet</p>
              <p className="text-2xl font-bold">{conversations.length}</p>
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
              <Wifi className="h-6 w-6 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Çevrimiçi</p>
              <p className="text-2xl font-bold">{onlineCount}</p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="events">
          <TabsList className="mb-6 flex-wrap h-auto gap-1">
            <TabsTrigger value="events" className="gap-1.5">
              <Globe className="h-4 w-4" /> Duyurular &amp; Etkinlikler
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-1.5">
              <Users className="h-4 w-4" /> Kullanıcılar
            </TabsTrigger>
            <TabsTrigger value="logs" className="gap-1.5">
              <MessageSquare className="h-4 w-4" /> Sohbet Logları
            </TabsTrigger>
          </TabsList>

          {/* ── EVENTS TAB ───────────────────────────────────── */}
          <TabsContent value="events" className="space-y-6">

            {/* Global Chat */}
            <div className="bg-card border border-border rounded-2xl p-6">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                    <MessageCircle className="h-5 w-5 text-green-400" />
                  </div>
                  <div>
                    <h2 className="font-bold text-lg">Global Sohbet</h2>
                    <p className="text-xs text-muted-foreground">Tüm kullanıcılar tek odada sohbet eder</p>
                  </div>
                </div>
                <Button
                  onClick={handleToggleGlobalChat}
                  disabled={globalChatLoading}
                  className={globalChatActive
                    ? "bg-red-600 hover:bg-red-500 text-white"
                    : "bg-green-600 hover:bg-green-500 text-white"}
                >
                  {globalChatLoading ? "..." : globalChatActive ? "🔴 Kapat" : "🟢 Aç"}
                </Button>
              </div>
              {globalChatActive && (
                <div className="mt-4 flex items-center gap-2 text-sm text-green-400 bg-green-500/10 rounded-xl px-4 py-2">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  Global Sohbet şu an aktif
                </div>
              )}
            </div>

            {/* Maintenance Mode */}
            <div className="bg-card border border-border rounded-2xl p-6">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center">
                    <Wrench className="h-5 w-5 text-yellow-400" />
                  </div>
                  <div>
                    <h2 className="font-bold text-lg">Bakım Modu</h2>
                    <p className="text-xs text-muted-foreground">Açıkken sadece /#/admin erişilebilir, diğerleri bakım sayfası görür</p>
                  </div>
                </div>
                <Button
                  onClick={handleToggleMaintenance}
                  disabled={maintenanceLoading}
                  className={maintenanceActive
                    ? "bg-green-600 hover:bg-green-500 text-white"
                    : "bg-yellow-600 hover:bg-yellow-500 text-white"}
                >
                  {maintenanceLoading ? "..." : maintenanceActive ? "✅ Kapat" : "🔧 Aç"}
                </Button>
              </div>
              {maintenanceActive && (
                <div className="mt-4 flex items-center gap-2 text-sm text-yellow-400 bg-yellow-500/10 rounded-xl px-4 py-2">
                  <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                  Bakım modu aktif — kullanıcılar siteye erişemiyor
                </div>
              )}
            </div>

            {/* Global Announcement */}
            <div className="bg-card border border-border rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <Megaphone className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <h2 className="font-bold text-lg">Global Duyuru</h2>
                  <p className="text-xs text-muted-foreground">Tüm kullanıcılara 10 saniyelik banner göster</p>
                </div>
              </div>
              <form onSubmit={handlePublishAnnouncement} className="space-y-3">
                <div className="flex gap-3 items-center">
                  <label className="text-xs text-muted-foreground w-20 flex-shrink-0">Gönderen</label>
                  <Input
                    value={annSender}
                    onChange={(e) => setAnnSender(e.target.value)}
                    placeholder="Admin"
                  />
                </div>
                <div className="flex gap-3 items-center">
                  <label className="text-xs text-muted-foreground w-20 flex-shrink-0">Mesaj</label>
                  <Input
                    value={annText}
                    onChange={(e) => setAnnText(e.target.value)}
                    placeholder="Duyuru metnini yazın..."
                    required
                  />
                </div>
                <div className="flex justify-end">
                  <Button type="submit" disabled={annLoading || !annText.trim()}
                    className="bg-blue-600 hover:bg-blue-500 text-white gap-2">
                    <Megaphone className="h-4 w-4" />
                    {annLoading ? "Gönderiliyor..." : "Duyuruyu Gönder"}
                  </Button>
                </div>
              </form>
            </div>

            {/* Kayan Duyuru Ticker */}
            <div className="bg-card border border-border rounded-2xl p-6">
              <div className="flex items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                    <span className="text-xl">📢</span>
                  </div>
                  <div>
                    <h2 className="font-bold text-lg">Kayan Duyuru</h2>
                    <p className="text-xs text-muted-foreground">Üstte soldan sağa akan duyuru bandı</p>
                  </div>
                </div>
                <Button
                  onClick={handleToggleTicker}
                  disabled={tickerLoading}
                  className={tickerActive
                    ? "bg-red-600 hover:bg-red-500 text-white"
                    : "bg-orange-600 hover:bg-orange-500 text-white"}
                >
                  {tickerLoading ? "..." : tickerActive ? "🔴 Kapat" : "🟢 Aç"}
                </Button>
              </div>
              <div className="flex gap-2">
                <Input
                  value={tickerText}
                  onChange={(e) => setTickerText(e.target.value)}
                  placeholder="Kayan duyuru metni yazın..."
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  onClick={async () => {
                    await setDoc(doc(db, "events", "ticker"), { active: tickerActive, text: tickerText });
                    toast({ title: "✅ Metin güncellendi" });
                  }}
                  disabled={!tickerText.trim()}
                >
                  Kaydet
                </Button>
              </div>
              {tickerActive && (
                <div className="mt-3 flex items-center gap-2 text-sm text-orange-400 bg-orange-500/10 rounded-xl px-4 py-2">
                  <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
                  Kayan duyuru şu an yayında
                </div>
              )}
            </div>

            {/* Parallel Universe */}
            <div className="bg-card border border-border rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                  <span className="text-xl">🌀</span>
                </div>
                <div className="flex-1">
                  <h2 className="font-bold text-lg">Paralel Evren Kimlik Değişim Olayı</h2>
                  <p className="text-xs text-muted-foreground">Tüm kullanıcıların kimlikleri rastgele karıştırılır</p>
                </div>
                <div>
                  {puState?.active ? (
                    <Badge className="bg-red-500/20 text-red-400 border-red-500/30 animate-pulse">🔴 AKTİF</Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">Pasif</Badge>
                  )}
                </div>
              </div>

              {puState?.active ? (
                <div className="space-y-4">
                  <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                    <p className="text-sm text-red-300 font-medium">🔴 Paralel Evren şu an aktif!</p>
                    <p className="text-xs text-red-300/70 mt-1">
                      {Object.keys(puState.shuffledMap ?? {}).length} kullanıcının kimliği karıştırıldı.
                    </p>
                  </div>
                  <Button
                    className="w-full bg-green-700 hover:bg-green-600 text-white gap-2"
                    onClick={handleStopParallelUniverse}
                    disabled={puLoading}
                  >
                    {puLoading ? "Durduruluyor..." : "🟢 Paralel Evreni Durdur"}
                  </Button>

                  {puState.shuffledMap && Object.keys(puState.shuffledMap).length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-2">Kimlik Haritası</p>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {Object.entries(puState.shuffledMap).map(([uid, fake]) => {
                          const real = users.find((u) => u.uid === uid);
                          return real ? (
                            <div key={uid} className="flex items-center gap-2 text-xs bg-secondary/50 rounded-lg px-3 py-2">
                              <span className="text-muted-foreground font-medium">{real.username}</span>
                              <span className="text-muted-foreground/50">→</span>
                              <span className="text-purple-300 font-medium">{fake.username}</span>
                            </div>
                          ) : null;
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Başlatınca tüm kullanıcıların görünen adı ve fotoğrafı rastgele değiştirilir.
                    Durdurulunca herkes kendi kimliğine döner.
                  </p>
                  <Button
                    className="w-full bg-purple-700 hover:bg-purple-600 text-white gap-2"
                    onClick={() => handleStartParallelUniverse(false)}
                    disabled={puLoading}
                  >
                    {puLoading ? "Başlatılıyor..." : "🌀 Paralel Evreni Şimdi Başlat"}
                  </Button>
                </div>
              )}
            </div>

            {/* Countdown Scheduler */}
            <div className="bg-card border border-border rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-orange-400" />
                </div>
                <div>
                  <h2 className="font-bold text-lg">Geri Sayım Zamanlayıcı</h2>
                  <p className="text-xs text-muted-foreground">Süre dolunca Paralel Evren otomatik başlar</p>
                </div>
              </div>

              {!puState?.active && countdown && (
                <div className="bg-purple-900/30 border border-purple-500/30 rounded-xl p-4 mb-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs text-purple-300/70 mb-1">Geri sayım aktif</p>
                    <p className="font-mono text-3xl font-bold text-purple-200 tracking-widest">{countdown}</p>
                  </div>
                  <Button variant="outline" size="sm"
                    className="text-destructive border-destructive/30 hover:bg-destructive/10"
                    onClick={handleCancelCountdown}>
                    İptal Et
                  </Button>
                </div>
              )}

              {(!countdown || puState?.active) && (
                <form onSubmit={handleScheduleCountdown} className="space-y-4">
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={cdMode === "duration" ? "default" : "outline"}
                      size="sm"
                      className="flex-1"
                      onClick={() => setCdMode("duration")}
                    >
                      ⏱ Süre ile
                    </Button>
                    <Button
                      type="button"
                      variant={cdMode === "clock" ? "default" : "outline"}
                      size="sm"
                      className="flex-1"
                      onClick={() => setCdMode("clock")}
                    >
                      🕐 Türkiye Saati ile
                    </Button>
                  </div>

                  {cdMode === "duration" ? (
                    <div className="flex gap-2 items-center">
                      <div className="flex-1">
                        <label className="text-xs text-muted-foreground block mb-1 text-center">Saat</label>
                        <Input type="number" min="0" max="23" value={cdHours}
                          onChange={(e) => setCdHours(e.target.value)}
                          className="text-center font-mono text-lg" />
                      </div>
                      <span className="text-2xl text-muted-foreground font-bold mt-4">:</span>
                      <div className="flex-1">
                        <label className="text-xs text-muted-foreground block mb-1 text-center">Dakika</label>
                        <Input type="number" min="0" max="59" value={cdMinutes}
                          onChange={(e) => setCdMinutes(e.target.value)}
                          className="text-center font-mono text-lg" />
                      </div>
                      <span className="text-2xl text-muted-foreground font-bold mt-4">:</span>
                      <div className="flex-1">
                        <label className="text-xs text-muted-foreground block mb-1 text-center">Saniye</label>
                        <Input type="number" min="0" max="59" value={cdSeconds}
                          onChange={(e) => setCdSeconds(e.target.value)}
                          className="text-center font-mono text-lg" />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="text-xs text-muted-foreground block">Türkiye Saati (SS:DD)</label>
                      <Input
                        type="time"
                        value={cdClockTime}
                        onChange={(e) => setCdClockTime(e.target.value)}
                        className="font-mono text-lg"
                        required={cdMode === "clock"}
                      />
                      <p className="text-xs text-muted-foreground">
                        Seçilen saat geçtiyse yarın aynı saatte tetiklenir.
                      </p>
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="w-full bg-orange-700 hover:bg-orange-600 text-white gap-2"
                    disabled={cdLoading || puState?.active}
                  >
                    <Clock className="h-4 w-4" />
                    {cdLoading ? "Ayarlanıyor..." : "⏰ Geri Sayımı Başlat"}
                  </Button>
                  {puState?.active && (
                    <p className="text-xs text-muted-foreground text-center">Önce aktif Paralel Evreni durdurun.</p>
                  )}
                </form>
              )}
            </div>
          </TabsContent>

          {/* ── USERS TAB ────────────────────────────────────── */}
          <TabsContent value="users">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 bg-card border border-border rounded-lg px-3">
                <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <Input
                  className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                  placeholder="Kullanıcı ara..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive border-destructive/30 hover:bg-destructive/10 whitespace-nowrap flex-shrink-0"
                onClick={deleteAllUsers}
                disabled={deleting}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                {deleting ? "Siliniyor..." : "Tümünü Sil"}
              </Button>
            </div>
            <div className="space-y-2">
              {filteredUsers.map((u) => (
                <div key={u.uid} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
                  <div className="relative flex-shrink-0">
                    <Avatar>
                      <AvatarImage src={u.photoURL} />
                      <AvatarFallback>{(u.username ?? "?")[0].toUpperCase()}</AvatarFallback>
                    </Avatar>
                    {u.online && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold">{u.username}</p>
                      {u.verified && <img src="/verified-badge.png" alt="Onaylı" className="h-4 w-4 inline-block" />}
                      {u.bannedAt && <Badge variant="destructive" className="text-xs">Banlı</Badge>}
                      {u.online && <Badge variant="outline" className="text-xs text-green-500 border-green-500/30">Çevrimiçi</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                    <Button variant="ghost" size="icon" onClick={() => setSelectedProfile(u)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    {u.verified ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-blue-400 border-blue-400/30 hover:bg-blue-400/10 gap-1"
                        onClick={() => unverifyUser(u)}
                      >
                        <img src="/verified-badge.png" alt="" className="h-3.5 w-3.5" /> Onayı Kaldır
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-blue-400 border-blue-400/30 hover:bg-blue-400/10 gap-1"
                        onClick={() => verifyUser(u)}
                      >
                        <img src="/verified-badge.png" alt="" className="h-3.5 w-3.5" /> Onayla
                      </Button>
                    )}
                    {u.bannedAt ? (
                      <Button variant="outline" size="sm" onClick={() => unbanUser(u)}>
                        Ban Kaldır
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-orange-400 border-orange-400/30 hover:bg-orange-400/10"
                        onClick={() => banUser(u)}
                      >
                        <Ban className="h-4 w-4 mr-1" /> Banla
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="icon"
                      className="text-destructive border-destructive/30 hover:bg-destructive/10"
                      onClick={() => deleteUser(u)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {filteredUsers.length === 0 && (
                <p className="text-center text-muted-foreground text-sm py-8">Kullanıcı bulunamadı.</p>
              )}
            </div>
          </TabsContent>

          {/* ── LOGS TAB ─────────────────────────────────────── */}
          <TabsContent value="logs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="mb-3 flex items-center gap-2 bg-card border border-border rounded-lg px-3">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <Input
                    className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                    placeholder="Kullanıcı adına göre filtrele..."
                    value={convSearch}
                    onChange={(e) => setConvSearch(e.target.value)}
                  />
                </div>
                <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                  {filteredConvs.map((c) => (
                    <div
                      key={c.id}
                      className={`bg-card border rounded-xl p-3 cursor-pointer transition-colors ${
                        selectedConv?.id === c.id
                          ? "border-primary/50 bg-primary/10"
                          : "border-border hover:border-primary/30"
                      }`}
                      onClick={() => loadConvMessages(c)}
                    >
                      <p className="text-sm font-medium">
                        {c.participants.map((uid) => getUsernameById(uid)).join(" - ")}
                      </p>
                      {c.lastMessage && (
                        <p className="text-xs text-muted-foreground truncate mt-1">{c.lastMessage}</p>
                      )}
                    </div>
                  ))}
                  {filteredConvs.length === 0 && (
                    <p className="text-center text-muted-foreground text-sm py-8">Sohbet bulunamadı.</p>
                  )}
                </div>
              </div>
              <div className="bg-card border border-border rounded-xl p-4 max-h-[60vh] overflow-y-auto">
                {selectedConv ? (
                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-muted-foreground border-b border-border pb-2">
                      {selectedConv.participants.map((uid) => getUsernameById(uid)).join(" / ")}
                    </p>
                    {convMessages.map((m) => (
                      <div key={m.id} className="text-sm">
                        <span className="text-primary font-medium">{getUsernameById(m.senderId)}: </span>
                        <span>{m.text}</span>
                        {m.createdAt && (
                          <span className="text-muted-foreground text-xs ml-2">
                            {m.createdAt.toDate().toLocaleString("tr-TR")}
                          </span>
                        )}
                      </div>
                    ))}
                    {convMessages.length === 0 && (
                      <p className="text-muted-foreground text-sm">Mesaj bulunamadı.</p>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                    Sol taraftan bir sohbet seçin
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={!!selectedProfile} onOpenChange={(o) => !o && setSelectedProfile(null)}>
        <DialogContent className="sm:max-w-md">
          {selectedProfile && (
            <>
              <DialogHeader>
                <DialogTitle>Kullanıcı Profili</DialogTitle>
                <DialogDescription>{selectedProfile.email}</DialogDescription>
              </DialogHeader>
              <div className="flex flex-col items-center gap-4 py-4">
                <Avatar className="h-20 w-20 border-2 border-primary/30">
                  <AvatarImage src={selectedProfile.photoURL} />
                  <AvatarFallback className="text-2xl">
                    {(selectedProfile.username ?? "?")[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="text-center">
                  <h3 className="text-xl font-bold">{selectedProfile.username}</h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedProfile.online ? "Çevrimiçi" : "Çevrimdışı"}
                  </p>
                  {selectedProfile.bannedAt && (
                    <Badge variant="destructive" className="mt-1">Banlı</Badge>
                  )}
                </div>
                {selectedProfile.bio && (
                  <p className="text-sm text-center text-muted-foreground italic">
                    "{selectedProfile.bio}"
                  </p>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
