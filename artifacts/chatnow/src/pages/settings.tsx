import { useState } from "react";
import { db } from "@/lib/firebase";
import { doc, setDoc, getDoc, deleteDoc } from "firebase/firestore";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { ArrowLeft, Upload, User } from "lucide-react";

export default function Settings() {
  const { user, userData } = useAuth();
  const [username, setUsername] = useState(userData?.username ?? "");
  const [bio, setBio] = useState(userData?.bio ?? "");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const uploadToImgBB = async (file: File): Promise<string> => {
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const formData = new FormData();
    formData.append("image", base64);
    const res = await fetch(`https://api.imgbb.com/1/upload?key=${import.meta.env.VITE_IMGBB_API_KEY}`, {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    if (!data.success) throw new Error("Resim yuklenemedi.");
    return data.data.url;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !userData) return;
    setLoading(true);
    try {
      const newUsername = username.trim();

      if (newUsername !== userData.username) {
        const usernameDoc = await getDoc(doc(db, "usernames", newUsername.toLowerCase()));
        if (usernameDoc.exists()) throw new Error("Bu kullanici adi zaten alinmis.");
        await deleteDoc(doc(db, "usernames", userData.username.toLowerCase()));
        await setDoc(doc(db, "usernames", newUsername.toLowerCase()), { uid: user.uid });
      }

      let photoURL = userData.photoURL ?? "";
      if (photoFile) {
        photoURL = await uploadToImgBB(photoFile);
      }

      await setDoc(doc(db, "users", user.uid), {
        username: newUsername,
        bio: bio.trim(),
        photoURL,
      }, { merge: true });

      toast({ title: "Profil guncellendi!" });
      setLocation("/");
    } catch (err: any) {
      toast({ title: "Hata", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const currentPhoto = preview ?? userData?.photoURL;

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold text-primary">Profil Ayarlari</h1>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <Avatar className="h-24 w-24 border-2 border-primary/30">
                {currentPhoto ? (
                  <AvatarImage src={currentPhoto} />
                ) : null}
                <AvatarFallback className="text-3xl bg-primary/10 text-primary">
                  <User className="h-10 w-10" />
                </AvatarFallback>
              </Avatar>
              <label className="absolute bottom-0 right-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center cursor-pointer hover:bg-primary/80 transition-colors">
                <Upload className="h-4 w-4 text-primary-foreground" />
                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
              </label>
            </div>
            <p className="text-xs text-muted-foreground">Profil fotografini degistirmek icin ikonuna tikla</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Kullanici Adi</label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                minLength={3}
                placeholder="kullanici_adi"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">E-posta</label>
              <Input value={userData?.email ?? ""} disabled className="opacity-50" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Hakkimda</label>
              <Input
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Kendinizi kisaca tanitin..."
                maxLength={150}
              />
              <p className="text-xs text-muted-foreground mt-1">{bio.length}/150</p>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Kaydediliyor..." : "Degisiklikleri Kaydet"}
          </Button>
        </form>
      </div>
    </div>
  );
}
