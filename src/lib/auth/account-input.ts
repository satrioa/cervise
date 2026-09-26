/**
 * Nilai role dan validasi input untuk pembuatan akun.
 *
 * Ada dua tabel yang menyimpan role orang yang sama dengan KASUS BEDA:
 *   - public.profiles.role  -> huruf KECIL   (super_owner, master_admin, ...)
 *   - public.employees.role -> huruf BESAR  (MASTER_ADMIN, ADMIN, ...)
 *
 * profiles punya CHECK constraint huruf kecil di schema.sql:20, employees punya
 * CHECK huruf besar. Menulis 'MASTER_ADMIN' ke profiles akan gagal constraint,
 * dan sebaliknya. Karena itu kedua bentuk disimpan sebagai konstanta terpisah
 * di sini, bukan diketik ulang di tiap server action.
 *
 * Modul ini murni: tidak menyentuh database, sehingga bisa diuji langsung.
 */

export const PROFILE_ROLE = {
  MASTER_ADMIN: "master_admin",
  ADMIN: "admin",
  FRONTLINER: "frontliner",
  TECHNICIAN: "teknisi",
} as const;

export const EMPLOYEE_ROLE = {
  MASTER_ADMIN: "MASTER_ADMIN",
  ADMIN: "ADMIN",
  FRONTLINER: "FRONTLINER",
  TECHNICIAN: "TECHNICIAN",
} as const;

/** Satu-satunya cara yang benar mengisi baris profiles untuk sebuah role. */
export const EMPLOYEE_TO_PROFILE_ROLE: Readonly<Record<string, string>> = {
  [EMPLOYEE_ROLE.MASTER_ADMIN]: PROFILE_ROLE.MASTER_ADMIN,
  [EMPLOYEE_ROLE.ADMIN]: PROFILE_ROLE.ADMIN,
  [EMPLOYEE_ROLE.FRONTLINER]: PROFILE_ROLE.FRONTLINER,
  [EMPLOYEE_ROLE.TECHNICIAN]: PROFILE_ROLE.TECHNICIAN,
};

/**
 * Siapa yang boleh menambah atau mengubah baris employees.
 *
 * Ini mencerminkan policy database, bukan selera aplikasi:
 * employees_insert / employees_update di
 * 20260925090000_cervise_owner_platform_additive.sql hanya mengizinkan
 * has_tenant_role(organization_id, array['MASTER_ADMIN']) (atau platform admin).
 *
 *canAccess("pengaturan_general") dan requireManager() sama-sama menerima ADMIN,
 * sehingga ADMIN lolos cek aplikasi lalu ditolak RLS tanpa pesan yang berguna.
 * Gate di sini harus mengikuti database, bukan melebarinya.
 */
export function canManageEmployees(role: string | null | undefined): boolean {
  return (role ?? "").toUpperCase() === EMPLOYEE_ROLE.MASTER_ADMIN;
}

export type MasterAdminInput = {
  fullName: string;
  email: string;
  phone: string | null;
  branchId: string;
};
export type ValidatedMasterAdmin = {
  fullName: string;
  email: string;
  phone: string | null;
  branchId: string;
};

/**
 * Cukup konservatif: satu @, tidak ada spasi, domain punya titik. Tujuannya
 * menangkap ketikan salah, bukan memvalidasi RFC 5322 secara lengkap.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type Validation =
  | { ok: true; value: ValidatedMasterAdmin }
  | { ok: false; error: string };

export function validateMasterAdminInput(input: {
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  branchId?: string | null;
}): Validation {
  const fullName = (input.fullName ?? "").trim();
  if (fullName.length < 2) return { ok: false, error: "Nama wajib diisi (minimal 2 karakter)." };
  if (fullName.length > 80) return { ok: false, error: "Nama maksimal 80 karakter." };

  const email = (input.email ?? "").trim().toLowerCase();
  if (!email) return { ok: false, error: "Email wajib diisi." };
  if (email.length > 254) return { ok: false, error: "Email terlalu panjang." };
  if (!EMAIL_PATTERN.test(email)) return { ok: false, error: "Format email tidak valid." };

  const phoneRaw = (input.phone ?? "").trim();
  if (phoneRaw.length > 24) return { ok: false, error: "Nomor telepon terlalu panjang." };
  // Nomor telepon opsional. Kalau diisi, hanya angka dan beberapa tanda baca
  // yang diizinkan, supaya tidak bisa membawa markup atau script.
  if (phoneRaw && !/^[0-9+\-\s()]+$/.test(phoneRaw)) {
    return { ok: false, error: "Nomor telepon hanya boleh berisi angka, spasi, dan + - ( ) ." };
  }

  const branchId = (input.branchId ?? "").trim();
  if (!branchId) return { ok: false, error: "Cabang wajib dipilih." };

  return {
    ok: true,
    value: {
      fullName,
      email,
      phone: phoneRaw === "" ? null : phoneRaw,
      branchId,
    },
  };
}
