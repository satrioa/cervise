"use server";

import { revalidatePath } from "next/cache";
import { getActiveTenant } from "@/lib/supabase/actor";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAccess } from "@/lib/rbac";
import { readLacakAppearance } from "@/lib/operational/lacak-appearance";
import { safeExternalUrl } from "@/lib/public/testimonial";
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
  const actor = await getActiveTenant();
  if (!canAccess(actor.role, "pengaturan_tampilan")) {
    throw new Error("Role tidak diizinkan mengubah tampilan Lacak");
  }
  if (!actor.orgId) throw new Error("Organisasi tidak ditemukan");

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

/** Actor yang boleh mengubah apa pun di halaman ini, atau lempar. */
async function requireTampilanAdmin() {
  const actor = await getActiveTenant();
  if (!canAccess(actor.role, "pengaturan_tampilan")) {
    throw new Error("Role tidak diizinkan mengubah tampilan Lacak");
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
export async function saveLacakBranding(input: {
  tagline: string;
  instagramUrl: string;
  tiktokUrl: string;
}) {
  const actor = await requireTampilanAdmin();

  const tagline = teksAtauNull(input.tagline, TAGLINE_MAX, "Tagline");
  const instagram = safeExternalUrl(input.instagramUrl);
  if (input.instagramUrl?.trim() && !instagram) throw new Error("Tautan Instagram tidak valid");
  const tiktok = safeExternalUrl(input.tiktokUrl);
  if (input.tiktokUrl?.trim() && !tiktok) throw new Error("Tautan TikTok tidak valid");

  const { error } = await createAdminClient()
    .from("organizations")
    .update({ tagline, instagram_url: instagram, tiktok_url: tiktok })
    .eq("id", actor.orgId);

  if (error) throw new Error(error.message);
  revalidatePath("/app/pengaturan/tampilan");
  return { ok: true };
}

/**
 * Testimoni ditulis manual oleh admin, bukan turunan dari data servis.
 *
 * `organization_id` selalu diambil dari actor, tidak pernah dari payload,
 * supaya admin tidak bisa menulis ke tenant lain hanya dengan mengubah form.
 */
export async function saveTestimonial(input: {
  nama: string;
  isi: string;
  rating: number | null;
  urutan: number;
}) {
  const actor = await requireTampilanAdmin();

  const nama = teksAtauNull(input.nama, 80, "Nama");
  const isi = teksAtauNull(input.isi, 400, "Testimoni");
  if (!nama) throw new Error("Nama testimoni wajib diisi");
  if (!isi) throw new Error("Isi testimoni wajib diisi");

  const rating =
    input.rating === null || input.rating === undefined
      ? null
      : typeof input.rating === "number" && Number.isInteger(input.rating) && input.rating >= 1 && input.rating <= 5
        ? input.rating
        : (() => {
            throw new Error("Rating harus antara 1 dan 5");
          })();

  const urutan = Number.isFinite(Number(input.urutan)) ? Math.trunc(Number(input.urutan)) : 0;

  const { error } = await createAdminClient()
    .from("lacak_testimonials")
    .insert({ organization_id: actor.orgId, nama, isi, rating, urutan });

  if (error) throw new Error(error.message);
  revalidatePath("/app/pengaturan/tampilan");
  return { ok: true };
}

export async function deleteTestimonial(id: string) {
  const actor = await requireTampilanAdmin();
  const bersih = typeof id === "string" ? id.trim() : "";
  if (!bersih) throw new Error("Id testimoni wajib diisi");

  // organization_id ikut jadi syarat: id saja tidak boleh cukup.
  const { error } = await createAdminClient()
    .from("lacak_testimonials")
    .delete()
    .eq("organization_id", actor.orgId)
    .eq("id", bersih);

  if (error) throw new Error(error.message);
  revalidatePath("/app/pengaturan/tampilan");
  return { ok: true };
}
/**
 * Banner memakai prefix `tenant-logos/` yang sama dengan logo, jadi
 * `isSafeObjectPath` sudah menerimanya tanpa perlu aturan path baru.
 *
 * Batas 2 MB mengikuti bucket. Foto potret dari HP sering lewat angka itu,
 * jadi kalau banner ditolak, kompres dulu - menaikkan batas bucket belum
 * disepakati.
 */
export async function uploadLacakBanner(formData: FormData) {
  const actor = await requireTampilanAdmin();

  const entry = formData.get("file");
  if (!(entry instanceof File)) throw new Error("File tidak ditemukan");
  if (entry.size === 0) throw new Error("File kosong");

  const validation = validatePhotoFile(entry);
  if (!validation.ok) throw new Error(validation.error);

  const admin = createAdminClient();
  const { data: current, error: readError } = await admin
    .from("organizations")
    .select("banner_url")
    .eq("id", actor.orgId)
    .maybeSingle();
  if (readError) throw new Error(readError.message);

  const previous = current?.banner_url ?? null;
  const path = tenantLogoPath(actor.orgId!, validation.extension);

  const { error: uploadError } = await admin.storage
    .from(PHOTO_BUCKET)
    .upload(path, entry, { contentType: entry.type, upsert: false });
  if (uploadError) throw new Error(`Gagal mengunggah banner: ${uploadError.message}`);

  const { error: writeError } = await admin
    .from("organizations")
    .update({ banner_url: path })
    .eq("id", actor.orgId);
  if (writeError) {
    await hapusObjek(path);
    throw new Error(`Gagal menyimpan banner: ${writeError.message}`);
  }

  await hapusObjek(previous);
  revalidatePath("/app/pengaturan/tampilan");
  return { ok: true, url: publicPhotoUrl(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", path) };
}

export async function removeLacakBanner() {
  const actor = await requireTampilanAdmin();
  const admin = createAdminClient();

  const { error } = await admin.from("organizations").update({ banner_url: null }).eq("id", actor.orgId);
  if (error) throw new Error(error.message);

  revalidatePath("/app/pengaturan/tampilan");
  return { ok: true };
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