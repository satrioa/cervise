-- Penanda akun yang masih memakai password generated.
--
-- Akun yang dibuat admin (karyawan, master admin, owner tenant) dibuat dengan
-- password sementara. Sampai user menggantinya, dashboard menampilkan dialog
-- yang hanya meminta password baru + konfirmasi - tanpa meminta password
-- generated lagi.
--
-- Migrasi ini sengaja hanya berisi DDL sederhana. Penandaan akun BARU dilakukan
-- di server action pembuatnya (createKaryawan, createMasterAdmin, createTenant),
-- bukan di dalam fungsi database, supaya tidak perlu mengganti
-- platform_create_tenant.
alter table public.profiles
  add column if not exists must_change_password boolean not null default false;

comment on column public.profiles.must_change_password is
  'true = akun masih memakai password generated; dashboard meminta ganti password.';

-- Akun lama: tandai SEMUA profil yang ada saat migrasi ini dijalankan.
--
-- Deteksi "masih memakai password generated" tidak bisa dilakukan secara
-- akurat, dan ini sudah diuji ke data nyata:
--
--   * Password generated tidak pernah disimpan, jadi tidak ada yang bisa
--     dibandingkan - yang tersimpan hanya hash bcrypt.
--   * `auth.users.updated_at` TIDAK bisa dipakai sebagai bukti password sudah
--     diganti: kolom itu ikut bergerak saat login dan saat admin mengedit
--     email karyawan. Akun angle@ dan toying@ sudah berkali-kali login tetapi
--     masih memakai password generated, jadi heuristik timestamp justru
--     melewatkan akun yang justru harus diprompt.
--   * Jalur signup dan jalur buat-akun-admin sama-sama memanggil
--     `auth.admin.createUser`, jadi tidak ada jejak yang membedakan keduanya.
--
-- Karena itu penandaan dilakukan sekali untuk semua profil yang ada. Akun yang
-- password-nya memang sudah dipilih sendiri hanya melihat dialog ini sekali dan
-- boleh mengisi password yang sama lagi (form tidak memeriksa password lama).
-- Setelah migrasi, akun baru ditandai eksplisit di jalur pembuatannya, jadi
-- tidak ada gelombang kedua.
--
-- Untuk mengecualikan akun tertentu, tambahkan filter di sini SEBELUM menjalankan
-- migrasi, misalnya: ... and email not in ('owner@contoh.com').
update public.profiles
set must_change_password = true
where must_change_password = false;
