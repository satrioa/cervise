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
 * Aturan panjang dan karakter ikut migration `profiles_phone_charset`, supaya
 * penolakan di aplikasi dan di database tidak berbeda.
 */
export function validatePhone(raw: string | null | undefined): PhoneValidation {
  const trimmed = (raw ?? "").trim();
  if (trimmed === "") return { ok: true, value: null };

  if (trimmed.length > 24) {
    return { ok: false, error: "Nomor telepon terlalu panjang." };
  }

  if (!/^[0-9+\-\s()]+$/.test(trimmed)) {
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
