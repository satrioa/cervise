"use server";

import { revalidatePath } from "next/cache";
import { getActiveTenant } from "@/lib/supabase/actor";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateTempPassword } from "@/lib/auth/password";
import {
  EMPLOYEE_ROLE,
  PROFILE_ROLE,
  validateMasterAdminInput,
} from "@/lib/auth/account-input";

/**
 * Brand access: membuat akun Master Admin untuk satu cabang.
 *
 * Sebelumnya card "Brand access" di /app/pengaturan hanya menampilkan toast
 * palsu yang menyebut "hubungkan ke supabase.auth.admin.createUser nanti".
 * Card itu sekarang benar-benar membuat akun, dengan password sementara yang
 * ditampilkan sekali.
 */

/**
 * Gate-nya sengaja TIDAK memakai canAccess("pengaturan_general") yang juga
 * mengizinkan role ADMIN. Policy employees_insert di
 * 20260925090000_cervise_owner_platform_additive.sql:349 hanya menerima
 * has_tenant_role(..., ['MASTER_ADMIN']), jadi ADMIN akan lolos cek aplikasi
 * lalu ditolak RLS tanpa pesan yang jelas. Persempit di sini supaya user tidak
 * melihat tombol yang pasti gagal.
 */
function requireMasterAdminStrict(role: string): void {
  if (role !== EMPLOYEE_ROLE.MASTER_ADMIN) {
    throw new Error("Hanya Master Admin yang bisa menambah Master Admin lain.");
  }
}

export type CreateMasterAdminResult = {
  ok: boolean;
  tempPassword?: string;
  email?: string;
};

export async function createMasterAdmin(input: {
  fullName: string;
  email: string;
  phone: string | null;
  branchId: string;
}): Promise<CreateMasterAdminResult> {
  const actor = await getActiveTenant();
  requireMasterAdminStrict(actor.role);

  // Branch selector memakai sentinel "all" untuk "Semua cabang". Server yang
  // me-resolve, karena id cabang milik actor tidak diketahui di client.
  const requestedBranchId = input.branchId?.trim() ?? "";
  const branchId = requestedBranchId === "all" ? (actor.branchId ?? "") : requestedBranchId;

  const validation = validateMasterAdminInput({ ...input, branchId });
  if (!validation.ok) throw new Error(validation.error);
  const { fullName, email, phone } = validation.value;

  // Cabang wajib milik organisasi actor. Tanpa cek ini, MASTER_ADMIN satu
  // tenant bisa menunjuk branch_id tenant lain.
  const { data: branch, error: branchError } = await actor.supabase
    .from("branches")
    .select("id")
    .eq("id", branchId)
    .eq("organization_id", actor.orgId)
    .eq("is_active", true)
    .maybeSingle();
  if (branchError) throw new Error(branchError.message);
  if (!branch) throw new Error("Cabang tidak ditemukan di organisasi ini.");

  const admin = createAdminClient();
  const tempPassword = generateTempPassword();

  // 1. Akun auth. email_confirm: true karena tidak ada alur email verifikasi
  //    di aplikasi ini - login murni password.
  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (authError) {
    if (/already|registered|exists/i.test(authError.message)) {
      throw new Error("Email tersebut sudah terdaftar. Gunakan email lain.");
    }
    throw new Error(authError.message);
  }

  const userId = created.user.id;

  // 2. Baris profiles. profiles.role memakai huruf kecil (CHECK constraint di
  //    schema.sql:20), jadi di sini MUSTAHIL memakai EMPLOYEE_ROLE yang huruf
  //    besar - keduanya akan ditolak.
  const { error: profileError } = await admin.from("profiles").upsert(
    { id: userId, full_name: fullName, phone, email, role: PROFILE_ROLE.MASTER_ADMIN },
    { onConflict: "id" },
  );
  if (profileError) {
    await admin.auth.admin.deleteUser(userId);
    throw new Error(`Gagal membuat profil: ${profileError.message}`);
  }

  // 3. Baris employees. employees.role memakai huruf besar, dan policy-nya
  //    hanya mengizinkan MASTER_ADMIN.
  const { data: employee, error: employeeError } = await actor.supabase
    .from("employees")
    .insert({
      organization_id: actor.orgId,
      branch_id: branchId,
      profile_id: userId,
      role: EMPLOYEE_ROLE.MASTER_ADMIN,
      is_active: true,
    })
    .select("id")
    .maybeSingle();
  if (employeeError || !employee) {
    // Rollback harus menghapus baris profiles juga. Versi lama di
    // createKaryawan hanya menghapus user auth, meninggalkan baris profiles
    // yatim - yang membuat email itu dianggap "sudah dipakai" padahal akunnya
    // tidak pernah benar-benar ada.
    await admin.from("profiles").delete().eq("id", userId);
    await admin.auth.admin.deleteUser(userId);
    const detail = employeeError?.message ?? "Tidak dapat membuat data karyawan.";
    if (/employees_insert|row-level security|permission denied/i.test(detail)) {
      throw new Error("Gagal membuat data karyawan. Periksa hak akses Anda di cabang ini.");
    }
    throw new Error(detail);
  }

  revalidatePath("/app/pengaturan");
  revalidatePath("/app/karyawan");
  return { ok: true, tempPassword, email };
}
