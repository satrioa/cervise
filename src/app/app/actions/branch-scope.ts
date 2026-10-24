"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { isMasterAdminRole } from "@/lib/auth/authorization";
import { getActiveTenant } from "@/lib/supabase/actor";
import {
  BRANCH_SCOPE_ALL,
  BRANCH_SCOPE_COOKIE,
  LEGACY_BRANCH_COOKIE,
} from "@/lib/supabase/branch-scope";

const COOKIE_OPTIONS = {
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};

/**
 * Simpan pilihan cabang di cookie yang dibaca server.
 *
 * Ini pengganti `document.cookie` di BranchProvider. Cookie klien dulu hanya
 * mengubah label; `getActiveTenant()` tetap memakai `employees.branch_id`,
 * jadi penulisan mendarat di cabang yang salah. Di sini pilihan divalidasi
 * terhadap cabang aktif milik organisasi sebelum disimpan.
 */
export async function setBranchScope(scope: string): Promise<{ ok: true; scope: string }> {
  const actor = await getActiveTenant();
  if (!isMasterAdminRole(actor.role)) {
    throw new Error("Hanya Master Admin yang bisa memilih cabang");
  }

  const accessible = actor.accessibleBranchIds ?? [];
  const value = scope === BRANCH_SCOPE_ALL ? BRANCH_SCOPE_ALL : scope;

  if (value === BRANCH_SCOPE_ALL) {
    if (accessible.length <= 1) throw new Error("Hanya ada satu cabang aktif");
  } else if (!accessible.includes(value)) {
    throw new Error("Cabang tidak valid untuk tenant ini");
  }

  const cookieStore = await cookies();
  cookieStore.set(BRANCH_SCOPE_COOKIE, value, COOKIE_OPTIONS);
  // Cookie lama tetap dijaga selama masa transisi supaya pembaca lain tidak
  // melihat cabang basi ketika mode `all` dipilih.
  if (value === BRANCH_SCOPE_ALL) {
    cookieStore.delete(LEGACY_BRANCH_COOKIE);
  } else {
    cookieStore.set(LEGACY_BRANCH_COOKIE, value, COOKIE_OPTIONS);
  }

  revalidatePath("/app", "layout");
  return { ok: true, scope: value };
}
