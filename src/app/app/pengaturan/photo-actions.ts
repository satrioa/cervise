"use server";

import { revalidatePath } from "next/cache";
import { getActiveTenant } from "@/lib/supabase/actor";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAccess } from "@/lib/rbac";
import {
  PHOTO_BUCKET,
  accountPhotoPath,
  isSafeObjectPath,
  publicPhotoUrl,
  tenantLogoPath,
  validatePhotoFile,
} from "@/lib/photos";

/**
 * Bucket cervise-photos tidak punya policy storage.objects untuk
 * authenticated/anon, jadi tidak ada jalur tulis dari browser. Semua operasi
 * masuk lewat file ini, dan karena memakai service role, RLS tidak lagi
 * menjadi penjaga. Untuk itu setiap aksi di sini wajib:
 *   1. ambil actor dari getActiveTenant() (bukan dari parameter),
 *   2. cek peran,
 *   3. pakai hanya id milik actor itu sebagai prefix path.
 */

type Actor = Awaited<ReturnType<typeof getActiveTenant>>;

function requirePhotoAdmin(actor: Actor): void {
  if (!canAccess(actor.role, "pengaturan_general")) {
    throw new Error("Role tidak diizinkan mengubah pengaturan");
  }
}

function readUpload(formData: FormData): File {
  const entry = formData.get("file");
  if (!(entry instanceof File)) throw new Error("File tidak ditemukan");
  if (entry.size === 0) throw new Error("File kosong");
  return entry;
}

/** Hapus objek lama supaya bucket tidak menumpuk file yang sudah tidak terpakai. */
async function removeStoredObject(path: string | null | undefined): Promise<void> {
  // Path dari database bisa saja berisi apa saja, jadi jangan pernah
  // meneruskan path yang gagal validasi ke remove(): Salah validasi di sini
  // berarti menghapus objek milik orang lain.
  if (!isSafeObjectPath(path)) return;
  const admin = createAdminClient();
  const { error } = await admin.storage.from(PHOTO_BUCKET).remove([path]);
  // Kegagalan hapus file lama tidak boleh membatalkan pergantian foto: kolom
  // sudah menunjuk ke file baru, jadi sisa file lama cuma sampah storage.
  if (error) console.error("gagal menghapus file foto lama:", error.message);
}

function resolvePublicUrl(path: string): string | null {
  return publicPhotoUrl(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", path);
}

export async function uploadAccountPhoto(formData: FormData) {
  const actor = await getActiveTenant();
  const file = readUpload(formData);

  const validation = validatePhotoFile(file);
  if (!validation.ok) throw new Error(validation.error);

  const admin = createAdminClient();
  const { data: current, error: readError } = await admin
    .from("profiles")
    .select("avatar_url")
    .eq("id", actor.userId)
    .maybeSingle();
  if (readError) throw new Error(readError.message);

  const previousPath = current?.avatar_url ?? null;
  const path = accountPhotoPath(actor.userId, validation.extension);

  const { error: uploadError } = await admin.storage
    .from(PHOTO_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) throw new Error(`Gagal mengunggah foto: ${uploadError.message}`);

  const { error: writeError } = await admin
    .from("profiles")
    .update({ avatar_url: path })
    .eq("id", actor.userId);
  if (writeError) {
    // Jangan sampai ada file di storage yang tidak pernah dirujuk kolom.
    await removeStoredObject(path);
    throw new Error(`Gagal menyimpan foto: ${writeError.message}`);
  }

  await removeStoredObject(previousPath);

  revalidatePath("/app/pengaturan/profil");
  revalidatePath("/app");
  return { ok: true, url: resolvePublicUrl(path) };
}

export async function removeAccountPhoto() {
  const actor = await getActiveTenant();
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("profiles")
    .update({ avatar_url: null })
    .eq("id", actor.userId)
    .select("avatar_url")
    .maybeSingle();
  if (error) throw new Error(error.message);

  await removeStoredObject(data?.avatar_url ?? null);

  revalidatePath("/app/pengaturan/profil");
  revalidatePath("/app");
  return { ok: true };
}

export async function uploadTenantLogo(formData: FormData) {
  const actor = await getActiveTenant();
  requirePhotoAdmin(actor);
  const file = readUpload(formData);

  const validation = validatePhotoFile(file);
  if (!validation.ok) throw new Error(validation.error);

  const admin = createAdminClient();
  const { data: current, error: readError } = await admin
    .from("organizations")
    .select("logo_url")
    .eq("id", actor.orgId)
    .maybeSingle();
  if (readError) throw new Error(readError.message);

  const previousPath = current?.logo_url ?? null;
  const path = tenantLogoPath(actor.orgId, validation.extension);

  const { error: uploadError } = await admin.storage
    .from(PHOTO_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) throw new Error(`Gagal mengunggah logo: ${uploadError.message}`);

  const { error: writeError } = await admin
    .from("organizations")
    .update({ logo_url: path })
    .eq("id", actor.orgId);
  if (writeError) {
    await removeStoredObject(path);
    throw new Error(`Gagal menyimpan logo: ${writeError.message}`);
  }

  await removeStoredObject(previousPath);

  revalidatePath("/app/pengaturan");
  revalidatePath("/app");
  return { ok: true, url: resolvePublicUrl(path) };
}

export async function removeTenantLogo() {
  const actor = await getActiveTenant();
  requirePhotoAdmin(actor);
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("organizations")
    .update({ logo_url: null })
    .eq("id", actor.orgId)
    .select("logo_url")
    .maybeSingle();
  if (error) throw new Error(error.message);

  await removeStoredObject(data?.logo_url ?? null);

  revalidatePath("/app/pengaturan");
  revalidatePath("/app");
  return { ok: true };
}
