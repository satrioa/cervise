import { redirect } from "next/navigation";
import {
  getActiveTenant,
  getActiveTenantForBilling,
  type Actor,
} from "@/lib/supabase/actor";
import { canAccess, canWrite } from "@/lib/nav/manifest";

/**
 * Route guard per-role. Menyembunyikan menu di sidebar saja tidak cukup:
 * halaman tetap bisa dibuka lewat URL langsung. Guard ini menutup jalur itu di
 * server, sebelum komponen halaman dirender.
 *
 * `key` boleh berupa `href` penuh (`"/app/karyawan"`) atau `menuKeys`
 * (`"karyawan"`). Keduanya diteruskan ke `canAccess()`.
 */
export async function requireMenu(key: string): Promise<Actor> {
  const actor = await getActiveTenant();
  if (!canAccess(actor.role, key)) {
    redirect("/app?error=forbidden");
  }
  return actor;
}

/**
 * Guard untuk halaman penagihan.
 *
 * Perbedaannya hanya di sumber actor: tenant yang langganannya sudah berakhir
 * tidak melempar, jadi halaman tagihan tetap bisa dibaca dan dipakai membuat
 * invoice. Pemeriksaan role-nya identik - tenant terkunci bukan berarti siapa
 * pun boleh melihat harga paket.
 *
 * Hanya boleh dipakai untuk halaman yang benar-benar berisi tagihan. Halaman
 * lain tetap memakai `requireMenu`, supaya data tenant yang sudah tidak berhak
 * tidak ikut terbaca.
 */
export async function requireMenuForBilling(key: string): Promise<Actor> {
  const actor = await getActiveTenantForBilling();
  if (!canAccess(actor.role, key)) {
    redirect("/app?error=forbidden");
  }
  return actor;
}

/**
 * Untuk halaman read-only: tetap boleh dibuka, tapi aksi tulis tidak boleh.
 * Dibiarkan sebagai no-op guard supaya call site eksplisit dan mudah dicari,
 * dan supaya penambahan readOnly di masa depan cukup mengubah satu tempat.
 */
export async function requireMenuReadOnly(key: string): Promise<Actor> {
  return requireMenu(key);
}

export function assertCanWrite(actor: Actor, key: string): void {
  if (!canWrite(actor.role, key)) {
    throw new Error("Role tidak diizinkan mengubah data ini");
  }
}

export function assertCanRead(actor: Actor, key: string): void {
  if (!canAccess(actor.role, key)) {
    throw new Error("Role tidak diizinkan mengakses data ini");
  }
}
