import { useState } from "react";
import { db } from "@/lib/firebase";
import { doc, setDoc, Timestamp } from "firebase/firestore";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Gift, Clock, ArrowLeft, ExternalLink, CheckCircle, Loader2 } from "lucide-react";
import { useLocation } from "wouter";

async function gifToStaticUrl(gifUrl: string, imgbbKey: string): Promise<string | null> {
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("yüklenemedi"));
      img.src = gifUrl + (gifUrl.includes("?") ? "&" : "?") + "_cb=" + Date.now();
    });
    const size = 400;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const src = Math.min(img.naturalWidth, img.naturalHeight);
    const ox = (img.naturalWidth - src) / 2;
    const oy = (img.naturalHeight - src) / 2;
    ctx.drawImage(img, ox, oy, src, src, 0, 0, size, size);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.88));
    if (!blob) return null;
    const formData = new FormData();
    formData.append("image", blob, "profile_static.jpg");
    const r = await fetch(`https://api.imgbb.com/1/upload?key=${imgbbKey}`, { method: "POST", body: formData });
    const d = await r.json();
    return d.success ? (d.data.url as string) : null;
  } catch {
    return null;
  }
}

export default function Store() {
  const { user, userData } = useAuth();
  const [open, setOpen] = useState(false);
  const [gifUrl, setGifUrl] = useState("");
  const [duration, setDuration] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState("");
  const [previewError, setPreviewError] = useState(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const isGifActive = userData?.gifEnabled && userData?.gifExpireTime &&
    (userData.gifExpireTime.toDate() > new Date());

  const isValidGifUrl = gifUrl.trim().length > 5 &&
    (gifUrl.includes(".gif") || gifUrl.includes("giphy") || gifUrl.includes("tenor") || gifUrl.includes("media"));

  const handleClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!gifUrl.trim() || !isValidGifUrl) {
      toast({ title: "Hata", description: "Geçerli bir GIF URL giriniz.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const imgbbKey = import.meta.env.VITE_IMGBB_API_KEY as string;
      const now = Date.now();
      const expireMs = now + duration * 24 * 60 * 60 * 1000;

      setLoadingLabel("Statik fotoğraf oluşturuluyor...");
      const staticUrl = await gifToStaticUrl(gifUrl.trim(), imgbbKey);

      setLoadingLabel("Kaydediliyor...");
      const updateData: Record<string, any> = {
        gifEnabled: true,
        gifUrl: gifUrl.trim(),
        gifStartTime: Timestamp.fromMillis(now),
        gifExpireTime: Timestamp.fromMillis(expireMs),
        photoURL: staticUrl ?? gifUrl.trim(),
      };
      await setDoc(doc(db, "users", user.uid), updateData, { merge: true });

      toast({
        title: "🎉 GIF aktifleştirildi!",
        description: staticUrl
          ? `Profil fotoğrafın statik hale getirildi. GIF ${duration} gün aktif kalacak.`
          : `GIF ${duration} gün aktif kalacak. Profil fotoğrafı olarak GIF kullanılıyor.`,
      });
      setOpen(false);
      setGifUrl("");
    } catch (err: any) {
      toast({ title: "Hata", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
      setLoadingLabel("");
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold text-primary">Mağaza</h1>
        </div>

        {isGifActive && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-4 mb-4 flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-green-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-green-400">GIF Aktif!</p>
              <p className="text-xs text-muted-foreground">
                Bitiş: {userData.gifExpireTime.toDate().toLocaleString("tr-TR")}
              </p>
            </div>
            {userData.gifUrl && (
              <img src={userData.gifUrl} alt="GIF" className="h-12 w-12 rounded-full object-cover flex-shrink-0 border-2 border-green-500/30" />
            )}
          </div>
        )}

        <div className="bg-card border border-border rounded-2xl p-6 flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Gift className="h-7 w-7 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Profil GIF Hakkı</h2>
                <p className="text-sm text-muted-foreground">Profil kartın GIF ile canlanır.</p>
              </div>
            </div>
            <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Ücretsiz</Badge>
          </div>

          <ul className="text-sm text-muted-foreground space-y-2 pl-1">
            <li className="flex items-center gap-2"><Clock className="h-3 w-3 text-primary flex-shrink-0" /> 1 gün veya 2 gün seçeneği</li>
            <li className="flex items-center gap-2"><Clock className="h-3 w-3 text-primary flex-shrink-0" /> GIF'ten otomatik statik profil fotoğrafı oluşturulur</li>
            <li className="flex items-center gap-2"><Clock className="h-3 w-3 text-primary flex-shrink-0" /> Profil kartına tıklanınca GIF oynar</li>
            <li className="flex items-center gap-2"><Clock className="h-3 w-3 text-primary flex-shrink-0" /> Süre bitince statik fotoğraf kalır</li>
          </ul>

          <Button className="w-full" onClick={() => setOpen(true)}>
            {isGifActive ? "GIF'i Değiştir" : "GIF Hakkını Kullan"}
          </Button>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 mt-4">
          <h3 className="font-semibold text-sm mb-3">GIF URL nasıl alınır?</h3>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-bold flex-shrink-0 mt-0.5">1</div>
              <div>
                <p className="text-sm font-medium">Giphy'e git</p>
                <a href="https://giphy.com" target="_blank" rel="noreferrer" className="text-xs text-primary flex items-center gap-1 mt-0.5 hover:underline">
                  giphy.com <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-bold flex-shrink-0 mt-0.5">2</div>
              <p className="text-sm">Beğendiğin GIF'i bul → GIF'e tıkla → <strong>Paylaş</strong> → <strong>Link Kopyala</strong></p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-bold flex-shrink-0 mt-0.5">3</div>
              <p className="text-sm">Kopyaladığın linki aşağıya yapıştır → Önizlemeyi kontrol et → Aktifleştir</p>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={open} onOpenChange={(o) => { if (!loading) setOpen(o); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Profil GIF Ayarla</DialogTitle>
            <DialogDescription>GIF otomatik olarak statik profil fotoğrafına da dönüştürülür.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleClaim} className="space-y-4 mt-2">
            <div>
              <label className="text-sm font-medium mb-1 block">GIF URL</label>
              <Input
                placeholder="https://media.giphy.com/...gif"
                value={gifUrl}
                onChange={(e) => { setGifUrl(e.target.value); setPreviewError(false); }}
                required
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground mt-1">Giphy, Tenor veya direkt .gif linki</p>
            </div>

            {isValidGifUrl && !previewError && (
              <div className="flex flex-col items-center gap-2">
                <p className="text-xs text-muted-foreground self-start">Önizleme (GIF — profil kartında böyle oynar):</p>
                <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-primary/30 bg-secondary">
                  <img src={gifUrl.trim()} alt="GIF önizleme" className="w-full h-full object-cover"
                    onError={() => setPreviewError(true)} />
                </div>
                <p className="text-xs text-green-400">✓ GIF yüklendi</p>
              </div>
            )}
            {isValidGifUrl && previewError && (
              <p className="text-xs text-destructive">⚠ GIF yüklenemedi. URL'yi kontrol edin.</p>
            )}

            <div>
              <label className="text-sm font-medium mb-2 block">Süre</label>
              <div className="flex gap-2">
                <Button type="button" variant={duration === 1 ? "default" : "outline"} className="flex-1" onClick={() => setDuration(1)} disabled={loading}>1 Gün</Button>
                <Button type="button" variant={duration === 2 ? "default" : "outline"} className="flex-1" onClick={() => setDuration(2)} disabled={loading}>2 Gün</Button>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading || previewError}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {loadingLabel || "İşleniyor..."}
                </span>
              ) : "GIF'i Aktifleştir"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
