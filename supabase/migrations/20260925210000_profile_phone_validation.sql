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
-- adanya. Tiga penulis profiles.phone yang hidup sekarang, createKaryawan dan
-- updateKaryawan di src/app/app/karyawan/actions.ts serta updateProfile di
-- src/app/app/pengaturan/profil/actions.ts, tidak melakukan validasi nomor sama
-- sekali dan menyimpan input mentah apa adanya. validatePhone() baru dipasang
-- di jalur itu di task terpisah, dan sampai saat itu tiba bentuk kanonik tidak
-- bisa dijadikan syarat kolom.
--
-- PENTING: kalau suatu saat constraint ini ditulis ^62[0-9]+$, penulisan nomor
-- dari form karyawan akan gagal dan berubah dari pesan galat yang ramah jadi
-- error database. src/lib/auth/account-input.ts:108 juga menyimpan input mentah
-- apa adanya, jadi profiles.phone bisa berisi `0812 3456 7890` atau
-- +62 812-3456-7890, dan keduanya harus tetap diterima.
--
-- Saat migration ini ditulis, 0 baris profiles.phone terisi di database live,
-- jadi constraint bisa langsung divalidasi tanpa membersihkan data lebih dulu
-- dan tanpa NOT VALID.

alter table public.profiles
  add constraint profiles_phone_charset
  check (phone is null or (length(phone) <= 24 and phone ~ '^[0-9+\-\s()]+$'));
