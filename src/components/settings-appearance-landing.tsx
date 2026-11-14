"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Images, PlusIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  removeLacakBanner,
  removeLacakLogo,
  saveLacakBranding,
  uploadLacakBanner,
  uploadLacakLogo,
} from "@/app/app/pengaturan/tampilan/actions";
import { playPageTransition } from "@/components/layout/page-transition";
import { MAX_BANNERS, type PublicTenant } from "@/lib/public/landing";

/**
 * Banner, tagline, sosial, dan testimoni - data yang dipakai header dan
 * footer halaman Lacak. Sengaja diletakkan di halaman Tampilan, bukan
 * Pengaturan Umum: semuanya hanya berpengaruh ke halaman publik Lacak.
 */
export function LandingSection({
  tenant,
  onSaved,
}: {
  tenant: PublicTenant;
  onSaved: (next: PublicTenant) => void;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const logoFileRef = useRef<HTMLInputElement>(null);

  const [tagline, setTagline] = useState(tenant.tagline ?? "");
  const [instagramUrl, setInstagramUrl] = useState(tenant.instagramUrl ?? "");
  const [tiktokUrl, setTiktokUrl] = useState(tenant.tiktokUrl ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(tenant.websiteUrl ?? "");
  const [facebookUrl, setFacebookUrl] = useState(tenant.facebookUrl ?? "");
  const [xUrl, setXUrl] = useState(tenant.xUrl ?? "");
  const [youtubeUrl, setYoutubeUrl] = useState(tenant.youtubeUrl ?? "");
  const [whatsappUrl, setWhatsappUrl] = useState(tenant.whatsappUrl ?? "");
  const [mapsUrl, setMapsUrl] = useState(tenant.mapsUrl ?? "");
  const [footerNote, setFooterNote] = useState(tenant.footerNote ?? "");
  const [bannerUrls, setBannerUrls] = useState<string[]>(tenant.bannerUrls);
  const [shownSocials, setShownSocials] = useState<Set<string>>(() => {
    const s = new Set<string>(["instagram"]);
    if (tenant.tiktokUrl) s.add("tiktok");
    if (tenant.whatsappUrl) s.add("whatsapp");
    if (tenant.websiteUrl) s.add("website");
    if (tenant.facebookUrl) s.add("facebook");
    if (tenant.xUrl) s.add("x");
    if (tenant.youtubeUrl) s.add("youtube");
    if (tenant.mapsUrl) s.add("maps");
    return s;
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<number | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const slotRef = useRef(0);

  const ganti = (patch: Partial<PublicTenant>) => onSaved({ ...tenant, ...patch });

  const handleSimpan = async () => {
    setSaving(true);
    try {
      await saveLacakBranding({
        tagline,
        instagramUrl,
        tiktokUrl,
        websiteUrl,
        facebookUrl,
        xUrl,
        youtubeUrl,
        whatsappUrl,
        mapsUrl,
        footerNote,
      });
      ganti({
        tagline: tagline.trim() || null,
        instagramUrl: instagramUrl.trim() || null,
        tiktokUrl: tiktokUrl.trim() || null,
        websiteUrl: websiteUrl.trim() || null,
        facebookUrl: facebookUrl.trim() || null,
        xUrl: xUrl.trim() || null,
        youtubeUrl: youtubeUrl.trim() || null,
        whatsappUrl: whatsappUrl.trim() || null,
        mapsUrl: mapsUrl.trim() || null,
        footerNote: footerNote.trim() || null,
      });
      playPageTransition();
      router.refresh();
      toast.success("Identitas toko untuk halaman Lacak disimpan");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async (file: File) => {
    const index = slotRef.current;
    setUploading(index);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("index", String(index));
      const hasil = await uploadLacakBanner(form);
      setBannerUrls(hasil.urls);
      ganti({ bannerUrls: hasil.urls });
      playPageTransition();
      router.refresh();
      toast.success("Banner diperbarui");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Gagal mengunggah banner");
    } finally {
      setUploading(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleHapusBanner = async (index: number) => {
    setUploading(index);
    try {
      const hasil = await removeLacakBanner(index);
      setBannerUrls(hasil.urls);
      ganti({ bannerUrls: hasil.urls });
      playPageTransition();
      router.refresh();
      toast.success("Banner dihapus");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Gagal menghapus banner");
    } finally {
      setUploading(null);
    }
  };

  const handleUploadLogo = async (file: File) => {
    setUploadingLogo(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const hasil = await uploadLacakLogo(form);
      ganti({ logoUrl: hasil.url ?? null });
      playPageTransition();
      router.refresh();
      toast.success("Logo diperbarui");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Gagal mengunggah logo");
    } finally {
      setUploadingLogo(false);
      if (logoFileRef.current) logoFileRef.current.value = "";
    }
  };

  const handleHapusLogo = async () => {
    setUploadingLogo(true);
    try {
      await removeLacakLogo();
      ganti({ logoUrl: null });
      playPageTransition();
      router.refresh();
      toast.success("Logo dihapus");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Gagal menghapus logo");
    } finally {
      setUploadingLogo(false);
    }
  };

  return (
    <div className="mt-12 space-y-10 border-t pt-10">
      <section>
        <SectionHead title="Logo" hint="Tampil bulat di bar atas halaman Lacak — gunakan gambar persegi (1:1). Kosongkan untuk memakai inisial nama toko." />
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <div className="relative h-14 w-14 overflow-hidden rounded-full border border-border/60 bg-muted/40">
            {tenant.logoUrl ? (
              <Image src={tenant.logoUrl} alt="Logo toko" fill sizes="80px" unoptimized className="object-cover" />
            ) : (
              <div className="flex size-full items-center justify-center text-xs text-muted-foreground">
                Belum ada logo
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <input
              ref={logoFileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleUploadLogo(file);
              }}
            />
            <Button size="sm" type="button" disabled={uploadingLogo} onClick={() => logoFileRef.current?.click()}>
              {uploadingLogo ? "Mengunggah..." : tenant.logoUrl ? "Ganti logo" : "Unggah logo"}
            </Button>
            {tenant.logoUrl ? (
              <Button size="sm" type="button" variant="outline" disabled={uploadingLogo} onClick={handleHapusLogo}>
                Hapus logo
              </Button>
            ) : null}
            <p className="max-w-xs text-[11px] text-muted-foreground">
              JPG, PNG, atau WEBP, maksimal 2.0 MB. Logo kotak/square lebih cocok.
            </p>
          </div>
        </div>
      </section>

      <section className="mt-10">
        <SectionHead
          title="Banner"
          hint="Slider di bagian atas halaman Lacak. Maksimal 3 gambar, kosongkan untuk memakai warna toko."
        />
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleUpload(file);
          }}
        />
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {Array.from({ length: MAX_BANNERS }, (_, index) => {
            const url = bannerUrls[index];
            const sibuk = uploading === index;
            return (
              <div key={index} className="space-y-2">
                <div className="relative aspect-[2/1] overflow-hidden rounded-xl border border-border/60 bg-muted/40">
                  {url ? (
                    <Image src={url} alt={`Banner ${index + 1}`} fill sizes="320px" unoptimized className="object-cover" />
                  ) : (
                    <div className="flex size-full flex-col items-center justify-center gap-1 text-xs text-muted-foreground">
                      <Images className="size-5" aria-hidden />
                      Slot {index + 1}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    type="button"
                    variant={url ? "outline" : "default"}
                    disabled={uploading !== null}
                    onClick={() => {
                      slotRef.current = index;
                      fileRef.current?.click();
                    }}
                  >
                    {sibuk ? "Mengunggah..." : url ? "Ganti" : "Unggah"}
                  </Button>
                  {url ? (
                    <Button
                      size="sm"
                      type="button"
                      variant="ghost"
                      disabled={uploading !== null}
                      onClick={() => void handleHapusBanner(index)}
                    >
                      Hapus
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-2 max-w-lg text-[11px] text-muted-foreground">
          JPG, PNG, atau WEBP, maksimal 2.0 MB per gambar. Rasio 2:1 (contoh 1200 × 600 px) supaya tidak terpotong.
        </p>
      </section>

      <section>
        <SectionHead title="Tagline" hint="Kalimat besar di bawah nama toko." />
        <div className="mt-4 max-w-2xl space-y-4">
          <div className="space-y-1.5">
            <Label className="font-mono text-[10px] uppercase tracking-[0.2em]">Tagline</Label>
            <Input value={tagline} maxLength={120} onChange={(e) => setTagline(e.target.value)} placeholder="Servis Gadget Ter-murah Se-Indonesia" />
          </div>
          <div className="max-w-2xl space-y-4">
            {shownSocials.has("instagram") ? (
              <div className="space-y-1.5">
                <Label className="font-mono text-[10px] uppercase tracking-[0.2em]">Instagram</Label>
                <Input value={instagramUrl} onChange={(e) => setInstagramUrl(e.target.value)} placeholder="https://instagram.com/toko" />
              </div>
            ) : null}
            {shownSocials.has("tiktok") ? (
              <div className="space-y-1.5">
                <Label className="font-mono text-[10px] uppercase tracking-[0.2em]">TikTok</Label>
                <Input value={tiktokUrl} onChange={(e) => setTiktokUrl(e.target.value)} placeholder="https://tiktok.com/@toko" />
              </div>
            ) : null}
            {shownSocials.has("whatsapp") ? (
              <div className="space-y-1.5">
                <Label className="font-mono text-[10px] uppercase tracking-[0.2em]">WhatsApp</Label>
                <Input value={whatsappUrl} onChange={(e) => setWhatsappUrl(e.target.value)} placeholder="https://wa.me/62812..." />
              </div>
            ) : null}
            {shownSocials.has("website") ? (
              <div className="space-y-1.5">
                <Label className="font-mono text-[10px] uppercase tracking-[0.2em]">Website</Label>
                <Input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://toko.com" />
              </div>
            ) : null}
            {shownSocials.has("facebook") ? (
              <div className="space-y-1.5">
                <Label className="font-mono text-[10px] uppercase tracking-[0.2em]">Facebook</Label>
                <Input value={facebookUrl} onChange={(e) => setFacebookUrl(e.target.value)} placeholder="https://facebook.com/toko" />
              </div>
            ) : null}
            {shownSocials.has("x") ? (
              <div className="space-y-1.5">
                <Label className="font-mono text-[10px] uppercase tracking-[0.2em]">X / Twitter</Label>
                <Input value={xUrl} onChange={(e) => setXUrl(e.target.value)} placeholder="https://x.com/toko" />
              </div>
            ) : null}
            {shownSocials.has("youtube") ? (
              <div className="space-y-1.5">
                <Label className="font-mono text-[10px] uppercase tracking-[0.2em]">YouTube</Label>
                <Input value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} placeholder="https://youtube.com/@toko" />
              </div>
            ) : null}
            {shownSocials.has("maps") ? (
              <div className="space-y-1.5">
                <Label className="font-mono text-[10px] uppercase tracking-[0.2em]">Google Maps</Label>
                <Input value={mapsUrl} onChange={(e) => setMapsUrl(e.target.value)} placeholder="https://maps.google.com/..." />
              </div>
            ) : null}

            {shownSocials.size < 8 ? (
              <Popover>
                <PopoverTrigger render={<Button size="sm" type="button" variant="outline" className="w-fit"><PlusIcon className="size-3.5" /> Tambah sosial</Button>} />
                <PopoverContent align="start" className="w-48">
                  <div className="flex flex-col gap-1">
                    {[
                      { key: "tiktok", label: "TikTok" },
                      { key: "whatsapp", label: "WhatsApp" },
                      { key: "website", label: "Website" },
                      { key: "facebook", label: "Facebook" },
                      { key: "x", label: "X / Twitter" },
                      { key: "youtube", label: "YouTube" },
                      { key: "maps", label: "Google Maps" },
                    ]
                      .filter((item) => !shownSocials.has(item.key))
                      .map((item) => (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() =>
                            setShownSocials((prev) => {
                              const next = new Set(prev);
                              next.add(item.key);
                              return next;
                            })
                          }
                          className="rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                        >
                          {item.label}
                        </button>
                      ))}
                  </div>
                </PopoverContent>
              </Popover>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label className="font-mono text-[10px] uppercase tracking-[0.2em]">Catatan footer</Label>
            <Input value={footerNote} maxLength={200} onChange={(e) => setFooterNote(e.target.value)} placeholder="Jam operasional: Senin-Sabtu 09:00-18:00" />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Tautan hanya bisa diisi dengan http:// atau https://. Alamat dan nomor telepon diambil dari
            cabang yang aktif.
          </p>
          <div className="flex justify-end">
            <Button size="sm" type="button" disabled={saving} onClick={handleSimpan}>
              {saving ? "Menyimpan..." : "Simpan identitas"}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

function SectionHead({ title, hint }: { title: string; hint?: string }) {
  return (
    <div>
      <h2 className="font-heading text-base">{title}</h2>
      {hint ? <p className="mt-0.5 text-sm text-muted-foreground">{hint}</p> : null}
    </div>
  );
}