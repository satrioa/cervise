"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { StarIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  deleteTestimonial,
  removeLacakBanner,
  removeLacakLogo,
  saveLacakBranding,
  saveTestimonial,
  uploadLacakBanner,
  uploadLacakLogo,
} from "@/app/app/pengaturan/tampilan/actions";
import { playPageTransition } from "@/components/layout/page-transition";
import type { PublicTenant } from "@/lib/public/landing";

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
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [busy, setBusy] = useState(false);

  const [nama, setNama] = useState("");
  const [isi, setIsi] = useState("");
  const [rating, setRating] = useState<number | null>(null);

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
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const hasil = await uploadLacakBanner(form);
      ganti({ bannerUrl: hasil.url ?? null });
      playPageTransition();
      router.refresh();
      toast.success("Banner diperbarui");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Gagal mengunggah banner");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleHapusBanner = async () => {
    setUploading(true);
    try {
      await removeLacakBanner();
      ganti({ bannerUrl: null });
      playPageTransition();
      router.refresh();
      toast.success("Banner dihapus, halaman memakai warna toko");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Gagal menghapus banner");
    } finally {
      setUploading(false);
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
      if (fileRef.current) fileRef.current.value = "";
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

  const handleTambah = async () => {
    setBusy(true);
    try {
      await saveTestimonial({ nama, isi, rating, urutan: 0 });
      setNama("");
      setIsi("");
      setRating(null);
      playPageTransition();
      router.refresh();
      toast.success("Testimoni ditambahkan");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Gagal menambah testimoni");
    } finally {
      setBusy(false);
    }
  };

  const handleHapus = async (id: string) => {
    setBusy(true);
    try {
      await deleteTestimonial(id);
      ganti({ testimonials: tenant.testimonials.filter((t) => t.id !== id) });
      playPageTransition();
      router.refresh();
      toast.success("Testimoni dihapus");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Gagal menghapus testimoni");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-12 space-y-10 border-t pt-10">
      <section>
        <SectionHead title="Logo" hint="Logo toko di header halaman Lacak. Kosongkan untuk memakai inisial nama toko." />
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <div className="relative h-20 w-20 overflow-hidden rounded-full border border-border/60 bg-muted/40">
            {tenant.logoUrl ? (
              <Image src={tenant.logoUrl} alt="Logo toko" fill sizes="80px" unoptimized className="object-contain p-2" />
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
        <SectionHead title="Banner" hint="Gambar di bagian atas halaman Lacak. Kosongkan untuk memakai warna toko." />
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <div className="relative h-28 w-full max-w-xs overflow-hidden rounded-xl border border-border/60 bg-muted/40">
            {tenant.bannerUrl ? (
              <Image src={tenant.bannerUrl} alt="Banner halaman Lacak" fill sizes="320px" unoptimized className="object-cover" />
            ) : (
              <div className="flex size-full items-center justify-center text-xs text-muted-foreground">
                Belum ada banner
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2">
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
            <Button size="sm" type="button" disabled={uploading} onClick={() => fileRef.current?.click()}>
              {uploading ? "Mengunggah..." : tenant.bannerUrl ? "Ganti banner" : "Unggah banner"}
            </Button>
            {tenant.bannerUrl ? (
              <Button size="sm" type="button" variant="outline" disabled={uploading} onClick={handleHapusBanner}>
                Hapus banner
              </Button>
            ) : null}
            <p className="max-w-xs text-[11px] text-muted-foreground">
              JPG, PNG, atau WEBP, maksimal 2.0 MB. Potret lebih baik supaya tidak terpotong di HP.
            </p>
          </div>
        </div>
      </section>

      <section>
        <SectionHead title="Tagline" hint="Kalimat besar di bawah nama toko." />
        <div className="mt-4 max-w-2xl space-y-4">
          <div className="space-y-1.5">
            <Label className="font-mono text-[10px] uppercase tracking-[0.2em]">Tagline</Label>
            <Input value={tagline} maxLength={120} onChange={(e) => setTagline(e.target.value)} placeholder="Servis Gadget Ter-murah Se-Indonesia" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="font-mono text-[10px] uppercase tracking-[0.2em]">Instagram</Label>
              <Input value={instagramUrl} onChange={(e) => setInstagramUrl(e.target.value)} placeholder="https://instagram.com/toko" />
            </div>
            <div className="space-y-1.5">
              <Label className="font-mono text-[10px] uppercase tracking-[0.2em]">TikTok</Label>
              <Input value={tiktokUrl} onChange={(e) => setTiktokUrl(e.target.value)} placeholder="https://tiktok.com/@toko" />
            </div>
            <div className="space-y-1.5">
              <Label className="font-mono text-[10px] uppercase tracking-[0.2em]">WhatsApp</Label>
              <Input value={whatsappUrl} onChange={(e) => setWhatsappUrl(e.target.value)} placeholder="https://wa.me/62812..." />
            </div>
            <div className="space-y-1.5">
              <Label className="font-mono text-[10px] uppercase tracking-[0.2em]">Website</Label>
              <Input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://toko.com" />
            </div>
            <div className="space-y-1.5">
              <Label className="font-mono text-[10px] uppercase tracking-[0.2em]">Facebook</Label>
              <Input value={facebookUrl} onChange={(e) => setFacebookUrl(e.target.value)} placeholder="https://facebook.com/toko" />
            </div>
            <div className="space-y-1.5">
              <Label className="font-mono text-[10px] uppercase tracking-[0.2em]">X / Twitter</Label>
              <Input value={xUrl} onChange={(e) => setXUrl(e.target.value)} placeholder="https://x.com/toko" />
            </div>
            <div className="space-y-1.5">
              <Label className="font-mono text-[10px] uppercase tracking-[0.2em]">YouTube</Label>
              <Input value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} placeholder="https://youtube.com/@toko" />
            </div>
            <div className="space-y-1.5">
              <Label className="font-mono text-[10px] uppercase tracking-[0.2em]">Google Maps</Label>
              <Input value={mapsUrl} onChange={(e) => setMapsUrl(e.target.value)} placeholder="https://maps.google.com/..." />
            </div>
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

      <section>
        <SectionHead
          title="Testimoni"
          hint="Ditulis manual oleh admin, bukan diambil dari data servis. Section tidak muncul di halaman kalau kosong."
        />

        {tenant.testimonials.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {tenant.testimonials.map((t) => (
              <li key={t.id} className="flex items-start gap-3 rounded-xl border border-border/60 bg-background/40 p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{t.nama}</span>
                    {t.rating !== null ? (
                      <span className="flex gap-0.5" aria-label={`${t.rating} dari 5`}>
                        {Array.from({ length: t.rating }, (_, i) => (
                          <StarIcon key={i} aria-hidden className="size-3 fill-primary text-primary" />
                        ))}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">{t.isi}</p>
                </div>
                <Button
                  size="icon"
                  type="button"
                  variant="ghost"
                  aria-label={`Hapus testimoni ${t.nama}`}
                  disabled={busy}
                  onClick={() => void handleHapus(t.id)}
                >
                  <Trash2Icon className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">Belum ada testimoni.</p>
        )}

        <div className="mt-5 max-w-2xl space-y-4 rounded-xl border border-border/60 bg-background/40 p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="font-mono text-[10px] uppercase tracking-[0.2em]">Nama</Label>
              <Input value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Budi Santoso" />
            </div>
            <div className="space-y-1.5">
              <Label className="font-mono text-[10px] uppercase tracking-[0.2em]">Rating</Label>
              <div className="flex gap-1 pt-1.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-label={`${n} bintang`}
                    aria-pressed={rating === n}
                    onClick={() => setRating(rating === n ? null : n)}
                    className="rounded p-1"
                  >
                    <StarIcon
                      className={
                        rating !== null && n <= rating
                          ? "size-5 fill-primary text-primary"
                          : "size-5 text-muted-foreground/40"
                      }
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="font-mono text-[10px] uppercase tracking-[0.2em]">Testimoni</Label>
            <Textarea value={isi} rows={3} maxLength={400} onChange={(e) => setIsi(e.target.value)} placeholder="Servis cepat, Done jam 2 sore." />
          </div>
          <div className="flex justify-end">
            <Button size="sm" type="button" disabled={busy || !nama.trim() || !isi.trim()} onClick={handleTambah}>
              {busy ? "Menyimpan..." : "Tambah testimoni"}
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