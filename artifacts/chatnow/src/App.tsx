import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect, useState, useCallback, useRef } from "react";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Login from "@/pages/login";
import Admin from "@/pages/admin";
import Store from "@/pages/store";
import SplashScreen from "@/components/SplashScreen";
import Settings from "@/pages/settings";
import GlobalAnnouncementBanner from "@/components/GlobalAnnouncementBanner";
import { db, auth } from "@/lib/firebase";
import { onSnapshot, doc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { Wrench } from "lucide-react";

const queryClient = new QueryClient();

function useHashLocation(): [string, (to: string) => void] {
  const getHash = () => window.location.hash.replace(/^#/, "") || "/";
  const [loc, setLoc] = useState(getHash);

  useEffect(() => {
    const handler = () => setLoc(getHash());
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);

  const navigate = useCallback((to: string) => {
    window.location.hash = to;
  }, []);

  return [loc, navigate];
}

function MaintenancePage() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-6">
      <div className="text-center max-w-md">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-yellow-500/10 mb-6">
          <Wrench className="h-10 w-10 text-yellow-400" />
        </div>
        <h1 className="text-3xl font-bold mb-3">Bakım Modu</h1>
        <p className="text-muted-foreground text-base leading-relaxed">
          Sitemiz şu anda bakım çalışmaları nedeniyle geçici olarak erişime kapalıdır.
          <br />
          Kısa süre içinde geri döneceğiz.
        </p>
        <div className="mt-8 flex items-center justify-center gap-2 text-sm text-yellow-400 bg-yellow-500/10 rounded-xl px-5 py-3">
          <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
          Çalışmalar devam ediyor…
        </div>
      </div>
    </div>
  );
}

function Router({ maintenanceActive }: { maintenanceActive: boolean }) {
  const [loc] = useHashLocation();

  if (maintenanceActive && loc !== "/admin") {
    return <MaintenancePage />;
  }

  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/login" component={Login} />
      <Route path="/admin" component={Admin} />
      <Route path="/store" component={Store} />
      <Route path="/settings" component={Settings} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [splashDone, setSplashDone] = useState(false);
  const [maintenanceActive, setMaintenanceActive] = useState(false);
  const maintenanceUnsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  useEffect(() => {
    const startListener = () => {
      if (maintenanceUnsubRef.current) {
        maintenanceUnsubRef.current();
        maintenanceUnsubRef.current = null;
      }
      maintenanceUnsubRef.current = onSnapshot(
        doc(db, "events", "maintenance"),
        (snap) => {
          setMaintenanceActive(snap.exists() && snap.data().active === true);
        },
        () => {
          setMaintenanceActive(false);
        }
      );
    };

    startListener();

    const unsubAuth = onAuthStateChanged(auth, () => {
      startListener();
    });

    return () => {
      unsubAuth();
      maintenanceUnsubRef.current?.();
    };
  }, []);

  return (
    <>
      {!splashDone && <SplashScreen onDone={() => setSplashDone(true)} />}
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter hook={useHashLocation}>
            <Router maintenanceActive={maintenanceActive} />
          </WouterRouter>
          <Toaster />
          {!maintenanceActive && <GlobalAnnouncementBanner />}
        </TooltipProvider>
      </QueryClientProvider>
    </>
  );
}

export default App;
