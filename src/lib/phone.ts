// Aturan nomor telepon yang dipakai bersama: form karyawan, edit profil,
// dan pengiriman WhatsApp.
//
// Beberapa tempat lain masih punya versinya sendiri dan SENGAJA dibiarkan.
// - src/lib/auth/account-input.ts:92-98 menyimpan input mentah apa adanya, jadi
//   profiles.phone bisa berisi `0812 3456 7890`. Aturan di sini tidak boleh
//   berubah jadi bentuk kanonik, atau penulisan itu ikut gagal.
// - src/lib/operational/customer-list.ts punya fungsi bernama mirip untuk
//   tampilan saja, dan sengaja tidak menolak input lawas.
// - src/app/app/customer/actions.ts dan src/lib/platform/validation.ts punya
//   batas digit sendiri, 10-15, dan batas itu yang diikuti modul ini.
//
// Yang ditetapkan di sini adalah bentuk kanonik untuk DISIMPAN dan DIKIRIM.

/**
 * Kelas karakter dan batas panjang untuk input nomor telepon mentah.
 *
 * Dua konstanta ini sengaja diekspor, bukan ditulis inline di dalam
 * validatePhone, karena migration `profiles_phone_charset` menegakkan dua hal
 * yang sama persis di database. src/lib/auth/profile-phone-migration.test.ts
 * membandingkan literal SQL dengan konstanta di sini, jadi kalau salah satu
 * sisi berubah dan sisi lain tidak, test itu merah. Konkretnya begini:
 *
 *   PHONE_INPUT_PATTERN  ->  phone ~ '<pattern>'  di migration itu
 *   PHONE_MAX_LENGTH     ->  length(phone) <= <length>  di migration itu
 *
 * Isinya bentuk MASUK, bukan bentuk tersimpan. Normalisasi ke `62...` ada di
 * normalizePhone62() dan tidak ditegakkan di database, karena kolom menerima
 * input mentah apa adanya.
 */
export const PHONE_INPUT_PATTERN = "^[0-9+\\-\\s()]+$";
export const PHONE_MAX_LENGTH = 24;

/**
 * Mengubah apa pun yang diketik orang menjadi bentuk kanonik `62...`.
 * Mengembalikan null kalau nomornya tidak masuk akal, supaya pemanggil
 * bisa membedakan "tidak diisi" dari "diisi dengan tidak valid".
 */
export function normalizePhone62(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;

  let digits = String(raw).replace(/\D/g, "");
  if (digits.startsWith("0")) digits = `62${digits.slice(1)}`;
  else if (digits.startsWith("8")) digits = `62${digits}`;
  else if (digits.startsWith("62")) {
    // sudah kanonik
  } else {
    return null;
  }

  // 10-15 digit, mengikuti batas yang dipakai src/app/app/customer/actions.ts.
  // Batas itu longgar dengan sengaja: nomor yang ditolak di sini berarti
  // pelanggan tidak menerima notifikasi sama sekali, sedangkan nomor yang
  // kelewat longgar hanya ditolak Fonnte dan tercatat di log.
  if (digits.length < 10 || digits.length > 15) return null;
  return digits;
}

export type PhoneValidation =
  | { ok: true; value: string | null }
  | { ok: false; error: string };

/**
 * Validasi untuk form. Kosong itu sah, karena tidak semua role butuh nomor.
 *
 * Batas panjang dan kelas karakter di sini dibaca dari PHONE_MAX_LENGTH dan
 * PHONE_INPUT_PATTERN, bukan ditulis ulang, supaya tidak bisa menyimpang dari
 * constraint `profiles_phone_charset` yang menegakkan dua hal yang sama di
 * database. Yang tidak ditegakkan database adalah normalisasi ke `62...` dan
 * batas 10-15 digit, karena keduanya tidak berlaku pada input mentah.
 */
export function validatePhone(raw: string | null | undefined): PhoneValidation {
  const trimmed = (raw ?? "").trim();
  if (trimmed === "") return { ok: true, value: null };

  if (trimmed.length > PHONE_MAX_LENGTH) {
    return { ok: false, error: "Nomor telepon terlalu panjang." };
  }

  if (!new RegExp(PHONE_INPUT_PATTERN).test(trimmed)) {
    return {
      ok: false,
      error: "Nomor telepon hanya boleh berisi angka, spasi, dan + - ( ) .",
    };
  }

  const normalized = normalizePhone62(trimmed);
  if (!normalized) {
    return {
      ok: false,
      error: "Nomor telepon harus diawali 08 atau 62, contoh 081234567890.",
    };
  }

  return { ok: true, value: normalized };
}

/**
 * Bentuk yang dikirim ke Fonnte. Lebih ketat dari `normalizePhone62` karena
 * nomor yang tidak diawali 62 tidak akan sampai ke nomor Indonesia.
 */
export function toFonnteTarget(raw: string | null | undefined): string | null {
  const normalized = normalizePhone62(raw);
  if (!normalized || !normalized.startsWith("62")) return null;
  return normalized;
}
