import { slugify } from "@/lib/tenant-slug";

/**
 * Aturan input tenant, dipakai bersama oleh form onboarding dan
 * completeOnboarding.
 *
 * Sebelumnya form hanya mengandalkan toast ("minimal 3 karakter") sementara
 * server menolak dengan pesan yang berbeda ("Nama tenant tidak valid" /
 * "Slug tenant tidak valid"). Dua aturan terpisah di dua tempat, dan yang
 * tampil berbeda dari yang benar-benar ditegakkan.
 *
 * Yang divalidasi di sini persis yang diperiksa server: nama tidak kosong, tidak
 * lebih dari 120 karakter, dan hasil slugify-nya pola slug yang valid dengan
 * panjang minimal 3. Kalau server berubah, test di bawah ikut menjaga.
 */

export const TENANT_NAME_MAX = 120;
export const TENANT_NAME_MIN = 3;
export const BRANCH_NAME_MAX = 50;

/** Panjang minimum slug, bukan panjang nama. "ab" tetap terlalu pendek. */
export const TENANT_SLUG_MIN = 3;

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Mengembalikan pesan error, atau null kalau nama tenant tidak bermasalah.
 * String kosong dianggap belum diisi, bukan error - pemanggil yang memutuskan
 * apakah field itu wajib.
 */
export function validateTenantName(raw: string): string | null {
  const name = raw.trim();
  if (name === "") return null;
  if (name.length > TENANT_NAME_MAX) {
    return `Nama tenant maksimal ${TENANT_NAME_MAX} karakter.`;
  }

  const slug = slugify(name);
  if (!SLUG_PATTERN.test(slug) || slug.length < TENANT_SLUG_MIN) {
    return `Nama tenant harus menghasilkan slug minimal ${TENANT_SLUG_MIN} karakter. Pakai huruf dan angka, misalnya "Cervise RBM".`;
  }
  return null;
}

/** Sama seperti validateTenantName, tapi field wajib: string kosong = error. */
export function validateRequiredTenantName(raw: string): string | null {
  if (raw.trim() === "") return "Nama tenant wajib diisi.";
  return validateTenantName(raw);
}

export function isTenantNameSubmittable(raw: string): boolean {
  return validateRequiredTenantName(raw) === null;
}
