-- Validasi nomor telepon di level database.
--
-- profiles.phone sudah ada dan bisa diubah sendiri oleh pemiliknya lewat grant
-- self-service, jadi validasi di server action saja bisa dilewati lewat
-- PATCH /rest/v1/profiles. Yang hilang adalah validasi, bukan akses, dan grant
-- self-service itu tidak diubah di sini: ia dikunci oleh
-- src/lib/auth/security-migration.test.ts.
--
-- Yang ditegakkan: KELAS KARAKTER dan BATAS PANJANG, persis sama dengan
-- PHONE_INPUT_PATTERN dan PHONE_MAX_LENGTH di src/lib/phone.ts.
-- src/lib/auth/profile-phone-migration.test.ts membandingkan literal SQL di
-- bawah dengan kedua konstanta itu, jadi keduanya tidak bisa berbeda diam-diam.
--
-- Yang SENGAJA tidak ditegakkan: normalisasi ke bentuk 62... dan batas 10-15
-- digit. validatePhone() di src/lib/phone.ts melakukan keduanya, tapi kolom ini
-- tidak bisa, karena validatePhone() mengembalikan nomor yang sudah
-- dinormalisasi untuk disimpan, sementara kolom ini menerima input mentah apa
-- adanya. Keempat jalur tulis yang lewat server action sekarang memanggil
-- validatePhone() sebelum menulis, jadi bentuk kanoniknya seragam:
-- createKaryawan dan updateKaryawan di src/app/app/karyawan/actions.ts,
-- updateProfile di src/app/app/pengaturan/profil/actions.ts, dan
-- createMasterAdmin di src/app/app/pengaturan/master-admin-actions.ts.
-- Yang masih bisa menulis input mentah adalah PATCH langsung ke
-- /rest/v1/profiles lewat grant self-service di paragraf pertama, yang tidak
-- melewati server action sama sekali.
--
-- PENTING: kalau suatu saat constraint ini ditulis ^62[0-9]+$, penulisan nomor
-- dari form karyawan akan gagal dan berubah dari pesan galat yang ramah jadi
-- error database. profiles.phone juga masih bisa berisi `0812 3456 7890` atau
-- +62 812-3456-7890, karena PATCH lewat grant self-service tidak melewati
-- validatePhone, dan kedua bentuk itu harus tetap diterima.
--
-- Saat migration ini ditulis, 0 baris profiles.phone terisi di database live,
-- jadi constraint bisa langsung divalidasi tanpa membersihkan data lebih dulu
-- dan tanpa NOT VALID.

alter table public.profiles
  add constraint profiles_phone_charset
  check (phone is null or (length(phone) <= 24 and phone ~ '^[0-9+\-\s()]+$'));
