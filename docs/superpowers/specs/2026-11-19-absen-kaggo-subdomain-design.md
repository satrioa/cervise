# Absensi mandiri di `absen.kaggo.app` — Desain

Tanggal: 2026-11-19
Status: disetujui (brainstorming 2026-11-19)

## Tujuan

Memberi absensi "front door" sendiri di subdomain `absen.kaggo.app`: karyawan membuka root domain tanpa slug, masuk dengan **email + PIN**, lalu melihat kamera selfie melingkar, tombol **[Absen Masuk]** / **[Absen Pulang]**, dan tabel log harian yang langsung terisi. App utama untuk sementara tetap di `cervise.vercel.app`; kepindahan ke `kaggo.app` adalah tahap 2.

## Keputusan

1. Host: `absen.kaggo.app` (tahap 1), app utama tetap `cervise.vercel.app`. Apex `kaggo.app` dipakai app utama di tahap 2.
2. Satu codebase & satu project Vercel (`cervise`), bukan repo terpisah.
3. Autentikasi kiosk memakai **email + PIN 6 digit** yang disimpan sebagai hash di DB — bukan password Supabase.
4. PIN ditetapkan admin lewat form tambah/edit karyawan; berlaku juga untuk karyawan existing.
5. Sesi kiosk: cookie httpOnly bertanda tangan, berlaku 12 jam, host-only di `absen.kaggo.app`.
6. Sesi kiosk **terpisah** dari sesi Supabase app utama (diterima di tahap 1). Tahap 2 baru memakai domain cookie `.kaggo.app` agar sekali login untuk dua host.
7. Selfie: preview kamera depan melingkar; frame diambil saat tombol ditekan (foto berbeda untuk Masuk dan Pulang).
8. GPS opsional, diminta bersamaan dengan tombol; gagal → tetap absen dengan penanda lokasi tidak tersedia.
9. Tabel log: satu baris per hari, maksimal 7 hari terakhir, kolom Tanggal | Masuk | Pulang | Status.
10. Data absensi tetap memakai tabel `attendance_records` — tidak ada duplikasi tabel.

## Non-goal

- Pindahnya app utama ke `kaggo.app` dan cookie bersama `.kaggo.app` (tahap 2).
- Izin/sakit/cuti, jadwal shift, QR, notifikasi WhatsApp absen.
- Menghapus halaman `/absensi` yang sudah ada di app utama — tetap dipertahankan untuk sementara.

## Domain & routing

- DNS registrar: `CNAME absen.kaggo.app → cname.vercel-dns.com` (dilakukan pemilik domain).
- Vercel: tambahkan `absen.kaggo.app` sebagai domain production project `cervise`.
- `middleware.ts`: jika `request.nextUrl.hostname === "absen.kaggo.app"`, rewrite ke path internal `/absen-kiosk` (semua path di host itu), sebelum logika protected-path yang ada. Aset `_next` dan API tidak terkena rewrite (matcher sudah mengecualikan).
- `/absen-kiosk/page.tsx` hanya dirender lewat rewrite host tersebut; URL yang terlihat pengguna tetap `https://absen.kaggo.app/`.
- Env baru: `ABSEN_SESSION_SECRET` (HMAC untuk cookie sesi PIN) di Vercel production.
- Tidak ada perubahan allowlist redirect Supabase di tahap 1: alur PIN tidak memakai Supabase Auth.

## Data & RPC baru

Migration `supabase/migrations/20261119120000_attendance_pin.sql`:

- `alter table public.employees add column if not exists pin_hash text, add column if not exists pin_updated_at timestamptz;`
- `create table if not exists public.attendance_pin_attempts (email_key text primary key, failures integer not null default 0, locked_until timestamptz);`
- `public.set_employee_pin(p_employee_id uuid, p_pin text)` — `security definer`, validasi 6 digit, `crypt(p_pin, gen_salt('bf'))`, tulis `pin_hash` + `pin_updated_at`. Dipanggil hanya dari server action yang sudah lolos `requireMenu("karyawan")` / izin tulis karyawan.
- `public.verify_employee_pin(p_email text, p_pin text)` — `security definer`, `set search_path = public`:
  - kunci 15 menit setelah 5 kegagalan per `lower(email)`;
  - join `employees` → `profiles`, syarat `is_active = true`, `pin_hash is not null`, `crypt(p_pin, pin_hash) = pin_hash`;
  - mengembalikan `employee_id`, `organization_id`, `branch_id`, `full_name`; error selalu generik "Email atau PIN salah".
- `public.submit_attendance_pin(p_employee_id uuid, p_kind text, p_selfie_path text, p_lat double precision, p_lng double precision, p_note text)` — `security definer`, memakai logika yang sama dengan `submit_attendance` (satu baris/hari WIB, check-in ganda & check-out tanpa check-in ditolak), tapi identitas karyawan berasal dari parameter server yang sudah diverifikasi, bukan `auth.uid()`. RPC lama tidak diubah.

## Sesi & keamanan

- `src/lib/attendance/session.ts`: `signSession(payload)` / `verifySession(token)` memakai HMAC-SHA256 dengan `ABSEN_SESSION_SECRET`; payload `{ employeeId, organizationId, branchId, name, exp }`; `exp` 12 jam.
- Server action `loginWithPin(formData)` memanggil `verify_employee_pin`, lalu `cookies().set("kaggo_absen_session", token, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 43200 })`.
- Setiap server component/action kiosk memanggil `verifySession()`; `employee_id` untuk `submit_attendance_pin` diambil dari cookie, **tidak pernah** dari FormData.
- Tidak ada daftar email yang bisa ditebak lewat pesan error; rate limit mengikat `lower(email)`.

## UI & alur

- `/absen-kiosk/page.tsx` (server): verifikasi cookie. Tidak ada sesi → render `PinLogin`; ada sesi → render `AbsenKioskClient` dengan data hari ini dan 7 hari terakhir dari `attendance_rekap`.
- `PinLogin`: input Email + PIN 6 digit (`inputMode="numeric"`), tombol Masuk, pesan error generik.
- `AbsenKioskClient`:
  - `getUserMedia({ video: { facingMode: "user" } })`, preview dalam wadah `aspect-square rounded-full overflow-hidden`; pesan jelas kalau kamera ditolak/tidak ada.
  - Tombol **[Absen Masuk]** dan **[Absen Pulang]**; tiap tombol mengambil frame saat ditekan → canvas square crop → Blob JPG → File.
  - `navigator.geolocation.getCurrentPosition` timeout 8 detik; kegagalan → `toast.info` dan tetap kirim dengan koordinat `null`.
  - Tombol Masuk nonaktif kalau `check_in_at` sudah ada; Pulang nonaktif kalau `check_out_at` sudah ada; kalau keduanya ada tampil "Absen hari ini selesai".
  - Upload selfie lewat server action dengan pola `attendancePhotoPath` + `PHOTO_BUCKET` yang sudah ada; path `attendance/{org}/{employee}/{tanggal}-{in|out}-{acak}.jpg`.
- Tabel log harian: satu baris per hari (maks 7), kolom Tanggal | Masuk | Pulang | Status, diperbarui setelah aksi sukses via `router.refresh()`.

## Form karyawan

- `/app/karyawan` tambah field **PIN absen (6 digit)** di dialog tambah dan edit; saat simpan dipanggil `set_employee_pin`. Field kosong = tidak mengubah PIN yang sudah ada.
- PIN tidak pernah ditampilkan lagi setelah disimpan (kolom hash saja).

## Error handling

- PIN salah / akun nonaktif → "Email atau PIN salah".
- Rate limit aktif → "Terlalu banyak percobaan. Coba lagi dalam 15 menit."
- Kamera ditolak → pesan di area preview; tombol tetap bisa dipakai hanya jika ada file hasil jepretan.
- GPS ditolak → absen tetap tersimpan dengan penanda "Lokasi tidak tersedia".
- Sesi invalid/kedaluwarsa → kembali ke form PIN.
- Check-in ganda / check-out tanpa check-in → pesan dari RPC via `sonner`.

## Testing & verifikasi

- Unit test (vitest): validasi PIN 6 digit, HMAC sign/verify (termasuk payload yang diubah & expiry), logika rate-limit 5 gagal/15 menit.
- Mock test server action: `employee_id` yang dipakai RPC berasal dari cookie, bukan FormData; PIN salah tidak menghasilkan cookie.
- Verifikasi: `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`.
- Smoke manual: set PIN via `/app/karyawan` → buka `https://absen.kaggo.app/` → login → jepret Masuk & Pulang → tabel log terisi; cek cookie httpOnly & secure di browser.

## Dampak ke file yang sudah ada

- `middleware.ts` — rewrite host `absen.kaggo.app`.
- `src/app/app/karyawan/*` — field PIN & pemanggilan `set_employee_pin`.
- `src/lib/photos.ts` — sudah dipakai, tidak diubah.
- Env Vercel `ABSEN_SESSION_SECRET` (baru).

## Risiko

1. PIN 6 digit rentan brute-force; rate limit per email + cookie 12 jam adalah mitigasi minimum, bukan MFA.
2. Sesi kiosk terpisah dari app utama sampai tahap 2 — karyawan bisa perlu login dua kali di periode transisi.
3. Selfie tetap tersimpan di bucket publik dengan path acak (bukan bucket privat).
4. Rewrite berbasis hostname mudah salah kalau domain produksi berubah; perlu test pada host `absen.kaggo.app` setelah DNS aktif.
