import type { Actor } from "@/lib/supabase/actor";
import { isMasterAdminRole } from "@/lib/auth/authorization";
import type { BranchOption } from "@/lib/supabase/branch-scope";

/**
 * Daftar cabang aktif yang bisa dipilih MASTER_ADMIN.
 *
 * Dibaca di server, bukan di klien, supaya label cabang yang tampil sudah
 * sesuai dengan scope yang dipakai seluruh server action pada request yang
 * sama. Dulu daftarnya diambil klien lewat cookie `cervise_org`, jadi ada
 * jendela singkat saat UI menampilkan "Semua cabang" padahal server masih
 * memproses cabang kepegawaian.
 *
 * Staf non-MASTER_ADMIN tidak perlu daftar: shell-nya mengunci satu cabang.
 */
export async function getBranchOptionsForActor(actor: Actor): Promise<BranchOption[]> {
  if (!isMasterAdminRole(actor.role)) return [];

  const { data, error } = await actor.supabase
    .from("branches")
    .select("id, name, city, phone")
    .eq("organization_id", actor.orgId)
    .eq("is_active", true)
    .order("name");
  if (error) return [];

  return ((data ?? []) as {
    id: string;
    name: string;
    city: string | null;
    phone: string | null;
  }[]).map((row) => ({
    id: row.id,
    label: row.name,
    meta: row.city || "Project",
    phone: row.phone ?? null,
  }));
}
