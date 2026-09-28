-- Validasi nomor telepon di level database.
--
-- profiles.phone sudah ada dan bisa diubah sendiri oleh pemiliknya lewat hak
-- akses kolom self-service, jadi validasi di server action saja bisa dilewati
-- lewat PATCH /rest/v1/profiles. Aturan yang sama dengan validatePhone() di
-- src/lib/phone.ts, termasuk batas panjang 24 karakter, supaya penolakan di
-- aplikasi dan di database tidak berbeda.
--
-- Hak akses self-service tidak diubah di sini. Yang hilang adalah validasi,
-- bukan akses, dan hak akses itu dikunci oleh
-- src/lib/auth/security-migration.test.ts.
--
-- PENTING: constraint ini sengaja hanya mencerminkan KELAS KARAKTER dan batas
-- panjang, bukan bentuk kanonik. src/lib/auth/account-input.ts:108 masih
-- menyimpan input mentah apa adanya, jadi profiles.phone bisa berisi
-- `0812 3456 7890` atau +62 812-3456-7890. Kalau constraintnya ditulis bentuk
-- kanonik ^62[0-9]+$, penulisan nomor dari form karyawan akan gagal dan berubah
-- dari pesan galat yang ramah jadi error database.
--
-- Saat migration ini ditulis, 0 baris profiles.phone terisi di database live,
-- jadi constraint bisa langsung divalidasi tanpa membersihkan data lebih dulu
-- dan tanpa NOT VALID.

alter table public.profiles
  add constraint profiles_phone_charset
  check (phone is null or (length(phone) <= 24 and phone ~ '^[0-9+\-\s()]+$'));
