"use server";

import { revalidatePath } from "next/cache";
import { getActiveTenant } from "@/lib/supabase/actor";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAccess } from "@/lib/rbac";
import {
  PHOTO_BUCKET,
  isSafeObjectPath,
  productPhotoPath,
  publicPhotoUrl,
  validatePhotoFile,
} from "@/lib/photos";

/**
 * Foto produk memakai bucket yang sama dengan avatar. Bucket ini tidak punya
 * policy tulis untuk browser, jadi upload wajib lewat action dengan service
 * role. Karena service role melewati RLS, kepemilikan produk dan cabang harus
 * diperiksa di sini.
 */
async function requireProduct(productId: string) {
  const actor = await getActiveTenant();
  if (!canAccess(actor.role, "inventory")) {
    throw new Error("Role tidak diizinkan mengubah foto produk");
  }
  if (!actor.branchId) throw new Error("Cabang aktif belum dipilih");

  const { data, error } = await actor.supabase
    .from("cervise_products")
    .select("id, image_url")
    .eq("id", productId)
    .eq("branch_id", actor.branchId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Produk tidak ditemukan di cabang ini");
  return data as { id: string; image_url: string | null };
}

async function removeStoredObject(path: string | null | undefined): Promise<void> {
  if (!isSafeObjectPath(path)) return;
  const { error } = await createAdminClient().storage.from(PHOTO_BUCKET).remove([path]);
  if (error) console.error("gagal menghapus foto produk lama:", error.message);
}

export async function uploadProductPhoto(productId: string, formData: FormData) {
  const product = await requireProduct(productId);
  const entry = formData.get("file");
  if (!(entry instanceof File)) throw new Error("File tidak ditemukan");
  if (entry.size === 0) throw new Error("File kosong");

  const validation = validatePhotoFile(entry);
  if (!validation.ok) throw new Error(validation.error);

  const path = productPhotoPath(product.id, validation.extension);
  const admin = createAdminClient();
  const { error: uploadError } = await admin.storage
    .from(PHOTO_BUCKET)
    .upload(path, entry, { contentType: entry.type, upsert: false });
  if (uploadError) throw new Error(`Gagal mengunggah foto: ${uploadError.message}`);

  const { error: writeError } = await admin
    .from("cervise_products")
    .update({ image_url: path })
    .eq("id", product.id);
  if (writeError) {
    // Jangan tinggalkan file yang tidak dirujuk kolom mana pun.
    await removeStoredObject(path);
    throw new Error(`Gagal menyimpan foto produk: ${writeError.message}`);
  }

  await removeStoredObject(
    product.image_url?.startsWith(`products/${product.id}/`) ? product.image_url : null,
  );

  revalidatePath("/app/inventori");
  revalidatePath("/app/penjualan");
  return {
    ok: true as const,
    url: publicPhotoUrl(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", path),
  };
}
