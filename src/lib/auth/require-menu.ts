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

/**
 * Halaman tagihan itu sendiri adalah jalur pemulihan, jadi-exempt dari
 * pemeriksaan role. Tanpa ini, role selain MASTER_ADMIN dialihkan ke
 * `/app?error=forbidden`, dan karena path itu bukan halaman tagihan, layout
 * akan melempar `subscription_expired` lagi - tenant terkunci berputar tanpa
 * henti dan tidak pernah bisa membayar.
 *
 * Pengecualian ini hanya untuk halaman tagihan. Guard role tetap berlaku untuk
 * key lain supaya jalur pemulihan tidak jadi jalan membuka halaman tenant lain.
 */
const BILLING_RECOVERY_KEY = "pengaturan_subscription";

export async function requireMenuForBilling(key: string): Promise<Actor> {
  const actor = await getActiveTenantForBilling();
  if (key !== BILLING_RECOVERY_KEY && !canAccess(actor.role, key)) {
    redirect("/app?error=forbidden");
  }
  return actor;
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
