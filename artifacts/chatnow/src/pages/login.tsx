import { useState } from "react";
import { auth, db } from "@/lib/firebase";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [regUsername, setRegUsername] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      const userDoc = await getDoc(doc(db, "users", userCredential.user.uid));
      if (userDoc.exists() && userDoc.data().bannedAt) {
        await auth.signOut();
        toast({ title: "Hata", description: "Hesabınız yasaklanmıştır", variant: "destructive" });
      } else {
        await setDoc(doc(db, "users", userCredential.user.uid), {
          online: true,
          lastHeartbeat: serverTimestamp(),
        }, { merge: true });
        setLocation("/");
      }
    } catch (error: any) {
      toast({ title: "Giriş Hatası", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const usernameDoc = await getDoc(doc(db, "usernames", regUsername.toLowerCase()));
      if (usernameDoc.exists()) {
        throw new Error("Bu kullanıcı adı zaten alınmış.");
      }

      const userCredential = await createUserWithEmailAndPassword(auth, regEmail, regPassword);
      const uid = userCredential.user.uid;

      await setDoc(doc(db, "users", uid), {
        uid,
        username: regUsername,
        email: regEmail,
        online: true,
        lastHeartbeat: serverTimestamp(),
        createdAt: serverTimestamp(),
      });

      await setDoc(doc(db, "usernames", regUsername.toLowerCase()), { uid });

      setLocation("/");
    } catch (error: any) {
      toast({ title: "Kayıt Hatası", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
            <MessageSquare className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-4xl font-bold text-primary mb-2 tracking-tight">ChatNow</h1>
          <p className="text-muted-foreground">Gerçek zamanlı sohbet platformu</p>
        </div>

        <div className="p-6 md:p-8 bg-card border border-border rounded-2xl shadow-xl">
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login">Giriş Yap</TabsTrigger>
              <TabsTrigger value="register">Kayıt Ol</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <Input
                  type="email"
                  placeholder="E-posta"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
                <Input
                  type="password"
                  placeholder="Şifre"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Giriş yapılıyor..." : "Giriş Yap"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="register">
              <form onSubmit={handleRegister} className="space-y-4">
                <Input
                  placeholder="Kullanıcı Adı"
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value)}
                  required
                  minLength={3}
                  autoComplete="username"
                />
                <Input
                  type="email"
                  placeholder="E-posta"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
                <Input
                  type="password"
                  placeholder="Şifre (min. 6 karakter)"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Kayıt olunuyor..." : "Kayıt Ol"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
