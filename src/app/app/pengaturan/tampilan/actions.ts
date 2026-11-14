"use server";

import { revalidatePath } from "next/cache";
import { getActiveTenant } from "@/lib/supabase/actor";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAccess } from "@/lib/rbac";
import { readLacakAppearance } from "@/lib/operational/lacak-appearance";
import { safeExternalUrl } from "@/lib/public/testimonial";
import { MAX_BANNERS } from "@/lib/public/landing";
import {
  PHOTO_BUCKET,
  isSafeObjectPath,
  publicPhotoUrl,
  tenantLogoPath,
  validatePhotoFile,
} from "@/lib/photos";

/**
 * Menyimpan tampilan halaman Lacak publik untuk seluruh toko.
 *
 * Nilainya milik tenant, bukan milik profil: halaman Lacak dibaca pengunjung
 * tanpa sesi, jadi per-pengguna tidak akan pernah sampai ke sana.
 *
 * Wajib lewat service role dengan alasan yang sama seperti `updateBrand`:
 * `organizations` di-revoke dari `authenticated`, jadi menulis lewat anon key
 * selalu berakhir "permission denied". Baris org sudah dicegah oleh
 * canAccess + orgId dari actor, bukan oleh RLS.
 */
export async function saveLacakAppearance(input: {
  mode: string;
  palette: string;
  density: string;
  font: string;
}) {
  const actor = await requireStoreTampilanAdmin();

  // Jangan pernah menyimpan apa adanya: nilai ini nanti berakhir sebagai
  // atribut `data-*` di halaman publik. Yang tidak dikenal jatuh ke default.
  const appearance = readLacakAppearance(input);

  const { data, error } = await createAdminClient()
    .from("organizations")
    .update({ lacak_appearance: appearance })
    .eq("id", actor.orgId)
    .select("id, slug")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Organisasi tidak ditemukan");

  revalidatePath("/app/pengaturan/tampilan");
  // Pelanggan membuka /{slug}/lacak, jadi path itu harus disegarkan juga.
  const slug = (data as { slug?: string | null }).slug;
  if (slug) {
    revalidatePath(`/${slug}/lacak`);
    revalidatePath(`/${slug}/lacak`, "layout");
  }
  return { ok: true, appearance };
}

const TAGLINE_MAX = 120;

/** Actor yang boleh mengubah Tampilan Store/Lacak, atau lempar. */
async function requireStoreTampilanAdmin() {
  const actor = await getActiveTenant();
  if (!canAccess(actor.role, "pengaturan_tampilan")) {
    throw new Error("Role tidak diizinkan mengubah Tampilan Store");
  }
  if (!actor.orgId) throw new Error("Organisasi tidak ditemukan");
  return actor;
}

/** Actor yang boleh mengubah Tampilan Nota, atau lempar. */
async function requireNotaTampilanAdmin() {
  const actor = await getActiveTenant();
  if (!canAccess(actor.role, "pengaturan_tampilan_nota")) {
    throw new Error("Role tidak diizinkan mengubah Tampilan Nota");
  }
  if (!actor.orgId) throw new Error("Organisasi tidak ditemukan");
  return actor;
}

function teksAtauNull(value: unknown, batas: number, nama: string): string | null {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (trimmed.length > batas) throw new Error(`${nama} maksimal ${batas} karakter`);
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Menyimpan tagline dan tautan sosial tenant.
 *
 * Tautan sosial melewati `safeExternalUrl` yang sama dengan jalur baca: nilainya
 * berakhir di `href` halaman publik, jadi `javascript:` harus ditolak di sini
 * juga, bukan hanya saat ditampilkan.
 */
const FOOTER_NOTE_MAX = 200;
const RECEIPT_FOOTER_MAX = 200;

export async function saveLacakBranding(input: {
  tagline: string;
  instagramUrl: string;
  tiktokUrl: string;
  websiteUrl?: string;
  facebookUrl?: string;
  xUrl?: string;
  youtubeUrl?: string;
  whatsappUrl?: string;
  mapsUrl?: string;
  footerNote?: string;
}) {
  const actor = await requireStoreTampilanAdmin();

  const tagline = teksAtauNull(input.tagline, TAGLINE_MAX, "Tagline");
  const instagram = safeExternalUrl(input.instagramUrl);
  if (input.instagramUrl?.trim() && !instagram) throw new Error("Tautan Instagram tidak valid");
  const tiktok = safeExternalUrl(input.tiktokUrl);
  if (input.tiktokUrl?.trim() && !tiktok) throw new Error("Tautan TikTok tidak valid");
  const websiteUrl = input.websiteUrl ?? "";
  const facebookUrl = input.facebookUrl ?? "";
  const xUrl = input.xUrl ?? "";
  const youtubeUrl = input.youtubeUrl ?? "";
  const whatsappUrl = input.whatsappUrl ?? "";
  const mapsUrl = input.mapsUrl ?? "";
  const footerNoteInput = input.footerNote ?? "";

  const website = safeExternalUrl(websiteUrl);
  if (websiteUrl.trim() && !website) throw new Error("Tautan website tidak valid");
  const facebook = safeExternalUrl(facebookUrl);
  if (facebookUrl.trim() && !facebook) throw new Error("Tautan Facebook tidak valid");
  const x = safeExternalUrl(xUrl);
  if (xUrl.trim() && !x) throw new Error("Tautan X/Twitter tidak valid");
  const youtube = safeExternalUrl(youtubeUrl);
  if (youtubeUrl.trim() && !youtube) throw new Error("Tautan YouTube tidak valid");
  const whatsapp = safeExternalUrl(whatsappUrl);
  if (whatsappUrl.trim() && !whatsapp) throw new Error("Tautan WhatsApp tidak valid");
  const maps = safeExternalUrl(mapsUrl);
  if (mapsUrl.trim() && !maps) throw new Error("Tautan Google Maps tidak valid");
  const footerNote = teksAtauNull(footerNoteInput, FOOTER_NOTE_MAX, "Catatan footer");

  const { error } = await createAdminClient()
    .from("organizations")
    .update({
      tagline,
      instagram_url: instagram,
      tiktok_url: tiktok,
      website_url: website,
      facebook_url: facebook,
      x_url: x,
      youtube_url: youtube,
      whatsapp_url: whatsapp,
      maps_url: maps,
      footer_note: footerNote,
    })
    .eq("id", actor.orgId);

  if (error) throw new Error(error.message);
  revalidatePath("/app/pengaturan/tampilan");
  return { ok: true };
}

/**
 * Banner halaman Lacak: tiga slot gambar (maks 3) yang dipakai slider publik.
 * Path lama pada slot yang diganti/dihapus ikut dibersihkan dari storage supaya
 * tidak menumpuk file yatim.
 *
 * Slot diisi berurutan (0,1,2). Server menolak lompatan slot karena array
 * `text[]` yang berlubang akan menggeser urutan setelah dibaca ulang.
 */

/** Path banner yang tersimpan, sudah dibuang nilai yang tidak aman. */
function pathBanner(value: unknown): string[] {
  return (Array.isArray(value) ? value : []).filter((path): path is string => isSafeObjectPath(path));
}

function urlsBanner(paths: string[]): string[] {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return paths.map((path) => publicPhotoUrl(base, path)).filter((url): url is string => url !== null);
}

export async function uploadLacakBanner(formData: FormData) {
  const actor = await requireStoreTampilanAdmin();

  const entry = formData.get("file");
  if (!(entry instanceof File)) throw new Error("File tidak ditemukan");
  if (entry.size === 0) throw new Error("File kosong");

  const index = Number(formData.get("index"));
  if (!Number.isInteger(index) || index < 0 || index >= MAX_BANNERS) {
    throw new Error("Slot banner tidak valid");
  }

  const validation = validatePhotoFile(entry);
  if (!validation.ok) throw new Error(validation.error);

  const admin = createAdminClient();
  const { data: current, error: readError } = await admin
    .from("organizations")
    .select("banner_urls")
    .eq("id", actor.orgId)
    .maybeSingle();
  if (readError) throw new Error(readError.message);

  const existing = pathBanner(current?.banner_urls);
  if (index > existing.length) throw new Error("Isi banner mulai dari slot pertama");
  if (index === existing.length && existing.length >= MAX_BANNERS) {
    throw new Error(`Maksimal ${MAX_BANNERS} banner`);
  }

  const previous = existing[index] ?? null;
  const path = tenantLogoPath(actor.orgId!, validation.extension);

  const { error: uploadError } = await admin.storage
    .from(PHOTO_BUCKET)
    .upload(path, entry, { contentType: entry.type, upsert: false });
  if (uploadError) throw new Error(`Gagal mengunggah banner: ${uploadError.message}`);

  const next = [...existing];
  next[index] = path;

  const { error: writeError } = await admin
    .from("organizations")
    .update({ banner_urls: next })
    .eq("id", actor.orgId);
  if (writeError) {
    await hapusObjek(path);
    throw new Error(`Gagal menyimpan banner: ${writeError.message}`);
  }

  await hapusObjek(previous);
  revalidatePath("/app/pengaturan/tampilan");
  return { ok: true, urls: urlsBanner(next) };
}

export async function removeLacakBanner(index: number) {
  const actor = await requireStoreTampilanAdmin();
  if (!Number.isInteger(index) || index < 0 || index >= MAX_BANNERS) {
    throw new Error("Slot banner tidak valid");
  }

  const admin = createAdminClient();
  const { data: current, error: readError } = await admin
    .from("organizations")
    .select("banner_urls")
    .eq("id", actor.orgId)
    .maybeSingle();
  if (readError) throw new Error(readError.message);

  const existing = pathBanner(current?.banner_urls);
  const removed = existing[index] ?? null;
  const next = existing.filter((_, i) => i !== index);

  const { error } = await admin
    .from("organizations")
    .update({ banner_urls: next })
    .eq("id", actor.orgId);
  if (error) throw new Error(error.message);

  await hapusObjek(removed);
  revalidatePath("/app/pengaturan/tampilan");
  return { ok: true, urls: urlsBanner(next) };
}

/**
 * Path dari database bisa berisi apa saja, jadi jangan pernah meneruskannya
 * ke `remove()` tanpa validasi: salah validasi berarti menghapus objek orang
 * lain. Kegagalan hapus tidak membatalkan penghapusan kolom.
 */
async function hapusObjek(path: string | null | undefined): Promise<void> {
  if (!isSafeObjectPath(path)) return;
  const { error } = await createAdminClient().storage.from(PHOTO_BUCKET).remove([path]);
  if (error) {
    console.error("Gagal menghapus berkas banner lama:", error.message);
  }
}

export async function uploadLacakLogo(formData: FormData) {
  const actor = await requireStoreTampilanAdmin();

  const entry = formData.get("file");
  if (!(entry instanceof File)) throw new Error("File tidak ditemukan");
  if (entry.size === 0) throw new Error("File kosong");

  const validation = validatePhotoFile(entry);
  if (!validation.ok) throw new Error(validation.error);

  const admin = createAdminClient();
  const { data: current, error: readError } = await admin
    .from("organizations")
    .select("logo_url")
    .eq("id", actor.orgId)
    .maybeSingle();
  if (readError) throw new Error(readError.message);

  const previous = current?.logo_url ?? null;
  const path = tenantLogoPath(actor.orgId!, validation.extension);

  const { error: uploadError } = await admin.storage
    .from(PHOTO_BUCKET)
    .upload(path, entry, { contentType: entry.type, upsert: false });
  if (uploadError) throw new Error(`Gagal mengunggah logo: ${uploadError.message}`);

  const { error: writeError } = await admin
    .from("organizations")
    .update({ logo_url: path })
    .eq("id", actor.orgId);
  if (writeError) {
    await hapusObjek(path);
    throw new Error(`Gagal menyimpan logo: ${writeError.message}`);
  }

  await hapusObjek(previous);
  revalidatePath("/app/pengaturan/tampilan");
  return { ok: true, url: publicPhotoUrl(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", path) };
}

export async function removeLacakLogo() {
  const actor = await requireStoreTampilanAdmin();
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("organizations")
    .update({ logo_url: null })
    .eq("id", actor.orgId)
    .select("logo_url")
    .maybeSingle();
  if (error) throw new Error(error.message);

  await hapusObjek(data?.logo_url ?? null);
  revalidatePath("/app/pengaturan/tampilan");
  return { ok: true };
}

export async function saveReceiptAppearance(input: { footerText: string }) {
  const actor = await requireNotaTampilanAdmin();
  const receiptFooterText = teksAtauNull(input.footerText ?? "", RECEIPT_FOOTER_MAX, "Footer nota");
  const { error } = await createAdminClient()
    .from("organizations")
    .update({ receipt_footer_text: receiptFooterText })
    .eq("id", actor.orgId);
  if (error) throw new Error(error.message);
  revalidatePath("/app/pengaturan/nota");
  return { ok: true, receiptFooterText };
}

export async function uploadReceiptLogo(formData: FormData) {
  const actor = await requireNotaTampilanAdmin();
  const entry = formData.get("file");
  if (!(entry instanceof File)) throw new Error("File tidak ditemukan");
  if (entry.size === 0) throw new Error("File kosong");

  const validation = validatePhotoFile(entry);
  if (!validation.ok) throw new Error(validation.error);

  const admin = createAdminClient();
  const { data: current, error: readError } = await admin
    .from("organizations")
    .select("receipt_logo_url")
    .eq("id", actor.orgId)
    .maybeSingle();
  if (readError) throw new Error(readError.message);

  const previous = isSafeObjectPath(current?.receipt_logo_url) ? (current!.receipt_logo_url as string) : null;
  const path = tenantLogoPath(actor.orgId!, validation.extension);

  const { error: uploadError } = await admin.storage
    .from(PHOTO_BUCKET)
    .upload(path, entry, { contentType: entry.type, upsert: false });
  if (uploadError) throw new Error(`Gagal mengunggah logo nota: ${uploadError.message}`);

  const { error: writeError } = await admin
    .from("organizations")
    .update({ receipt_logo_url: path })
    .eq("id", actor.orgId);
  if (writeError) {
    await hapusObjek(path);
    throw new Error(`Gagal menyimpan logo nota: ${writeError.message}`);
  }

  await hapusObjek(previous);
  revalidatePath("/app/pengaturan/nota");
  return { ok: true, url: publicPhotoUrl(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", path) };
}

export async function removeReceiptLogo() {
  const actor = await requireNotaTampilanAdmin();
  const admin = createAdminClient();

  const { data: current, error: readError } = await admin
    .from("organizations")
    .select("receipt_logo_url")
    .eq("id", actor.orgId)
    .maybeSingle();
  if (readError) throw new Error(readError.message);

  const previous = isSafeObjectPath(current?.receipt_logo_url) ? (current!.receipt_logo_url as string) : null;
  const { error } = await admin
    .from("organizations")
    .update({ receipt_logo_url: null })
    .eq("id", actor.orgId);
  if (error) throw new Error(error.message);

  await hapusObjek(previous);
  revalidatePath("/app/pengaturan/nota");
  return { ok: true };
}

/** Pengaturan nota untuk cetak (bisa dibaca role yang boleh mencetak). */
export async function getReceiptAppearance() {
  const actor = await getActiveTenant();
  if (!actor.orgId) return { logoUrl: null as string | null, footerText: null as string | null };
  const { data } = await createAdminClient()
    .from("organizations")
    .select("logo_url, receipt_logo_url, receipt_footer_text")
    .eq("id", actor.orgId)
    .maybeSingle();
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const receiptLogo = publicPhotoUrl(base, (data as any)?.receipt_logo_url ?? null);
  const tenantLogo = publicPhotoUrl(base, (data as any)?.logo_url ?? null);
  return {
    logoUrl: receiptLogo ?? tenantLogo,
    footerText: (((data as any)?.receipt_footer_text as string | null | undefined) ?? "").trim() || null,
  };
}