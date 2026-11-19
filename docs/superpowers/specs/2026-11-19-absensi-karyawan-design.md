# Absensi Karyawan — Desain

Tanggal: 2026-11-19
Status: disetujui (brainstorming 2026-11-19)

## Tujuan

Karyawan mengisi absen **Masuk**/**Pulang** sendiri dari HP lewat halaman khusus di luar `/app`, dengan bukti foto selfie, koordinat GPS, dan catatan opsional. Manajer melihat rekap di dalam app utama. Jam kerja standar diatur per cabang supaya status Terlambat/Pulang awal bisa dihitung.

## Keputusan yang sudah disepakati

1. Mode: self check-in/out + rekap manajer (bukan input manual, bukan scan QR).
2. Route karyawan: `/absensi` — halaman mandiri di luar `/app`, tetap memakai login & tenant yang sama.
3. Rekap manajer: `/app/laporan/absensi` — di dalam app utama, terlihat di sidebar.
4. Semua 4 role (MASTER_ADMIN, ADMIN, FRONTLINER, TECHNICIAN) bisa absen; rekap hanya manajer.
5. Data absen: waktu (otomatis), selfie, koordinat GPS, catatan opsional. Tanpa QR.
6. Aturan waktu: jam standar per cabang (default 08.00–17.00), bukan jadwal shift.
7. Rekap wajib: tabel harian per karyawan, ringkasan per karyawan, export Excel + PDF.
8. `/absensi` **tidak** kena gate langganan; rekap di `/app` kena gate seperti biasa.
9. GPS v1 hanya menyimpan koordinat (DB belum punya koordinat cabang), tanpa penolakan radius.

## Non-goal (sengaja tidak dibuat)

- Izin / sakit / cuti dan alur persetujuannya.
- Jadwal shift (pagi/sore/malam).
- Notifikasi WhatsApp saat absen.
- Edit/hapus riwayat absen oleh karyawan.
- Validasi radius GPS terhadap lokasi cabang.

## Arsitektur & rute

### `/absensi` (karyawan)

- `src/app/absensi/page.tsx` — server component: `getActiveTenantForAttendance()` (helper baru di `src/lib/supabase/actor.ts`, memakai `resolveTenant({ allowExpiredSubscription: true })` seperti billing, karena `getActiveTenant()` menolak tenant yang trial-nya habis), ambil catatan hari ini (WIB), render klien. Helper ini tetap menegakkan pemeriksaan profil aktif, tenant, dan cabang.
- `src/app/absensi/absensi-client.tsx` — UI Masuk/Pulang, selfie via `<input type="file" accept="image/*" capture="user">` (kamera depan di HP, galeri di desktop), `geolocation`, catatan, toast `sonner`. Tidak perlu `getUserMedia`/canvas — file yang sama langsung divalidasi & diunggah server action.
- `src/app/absensi/actions.ts` — server action `submitAttendance(formData)` yang memanggil RPC `submit_attendance`.
- Layout minimal sendiri: logo Kaggo + nama karyawan + cabang. **Tanpa** AppShell/AppLayout/sidebar, agar tidak kena subscription gate.

Tiga keadaan halaman:

| Keadaan | UI |
| --- | --- |
| Belum ada `check_in_at` | Tombol **Masuk** |
| Sudah masuk, belum pulang | Tampil jam masuk, tombol **Pulang** |
| Keduanya terisi | Ringkasan hari ini, tombol nonaktif |

Kalau izin lokasi ditolak/gagal, absen tetap tersimpan dengan koordinat `null` dan penanda "Lokasi tidak tersedia". Selfie wajib dipilih; tanpa file, tombol absen dinonaktifkan dengan pesan jelas.

### Auth / middleware

- `src/lib/auth/authorization.ts`: tambah `"absensi"` ke `ProtectedPathKind`; `getProtectedPathKind()` mengenali `/absensi` dan prefix `/absensi/`.
- `middleware.ts` lalu otomatis mengarahkan user tanpa sesi ke `/login?next=/absensi` (alur yang sama dengan `/app`).
- Identitas organisasi, cabang, dan karyawan **tidak dipercaya dari klien** — diambil server dari `getActiveTenantForAttendance()` / `auth.uid()` di dalam RPC.
- `getActiveTenantForAttendance()` hanya untuk halaman & action absen. Jangan dipakai di halaman `/app` lain (mereka tetap memakai `getActiveTenant()` yang mengunci tenant expired).

### `/app/laporan/absensi` (manajer)

- `src/app/app/laporan/absensi/page.tsx` + `actions.ts`, dijaga `requireMenu("laporan_absensi")`.
- Entri baru di `NAV_ENTRIES` (`src/lib/nav/manifest.ts`):
  - `href: "/app/laporan/absensi"`, `key: "attendanceReport"`, `label: "Laporan Absensi"`
  - `group: "laporan"`, `roles: MANAGERS`, `surface: ["legacy"]`, `menuKeys: ["laporan_absensi"]`
  - `permission: "reports.attendance"`
- Izin baru `reports.attendance` ditambahkan ke `PERMISSION_CATALOG` grup `laporan` di `src/lib/auth/permissions.ts`.
- Label navigasi `attendanceReport` ditambahkan ke `messages/id.json` dan `messages/en.json` (`nav.items`).

## Data & RLS

Migration baru: `supabase/migrations/20261119120000_attendance.sql`.

### Tabel `public.attendance_records`

| Kolom | Tipe | Catatan |
| --- | --- | --- |
| `id` | uuid pk | `default gen_random_uuid()` |
| `organization_id` | uuid not null | → `organizations(id) on delete cascade` |
| `branch_id` | uuid not null | → `branches(id) on delete cascade` |
| `employee_id` | uuid not null | → `profiles(id) on delete cascade` |
| `attendance_date` | date not null | tanggal WIB, dihitung server |
| `check_in_at`, `check_out_at` | timestamptz | nullable |
| `check_in_selfie_path`, `check_out_selfie_path` | text | path di bucket foto |
| `check_in_lat`, `check_in_lng`, `check_out_lat`, `check_out_lng` | double precision | nullable |
| `note` | text | catatan opsional |
| `created_at`, `updated_at` | timestamptz | default `now()` |

- Constraint unik `(organization_id, employee_id, attendance_date)` — satu baris per karyawan per hari.
- Constraint `check_out_at is null or check_out_at > check_in_at`.
- Index `(organization_id, branch_id, attendance_date desc)`.

### RLS

Mengikuti pola `cervise_cash_sessions`:

- `SELECT`: `is_platform_admin()` OR (`can_access_tenant_branch(branch_id)` AND (`employee_id = auth.uid()` OR `can_access_tenant_branch(branch_id, array['MASTER_ADMIN','ADMIN'])`)). Urutan OR penting: `is_platform_admin()` lebih dulu.
- Penulisan **hanya** lewat RPC `submit_attendance(p_kind text, p_selfie_path text, p_lat double precision, p_lng double precision, p_note text)` — `security definer`, `set search_path = public`. RPC menyelesaikan identitas dari `auth.uid()`, menolak kind selain `check_in`/`check_out`, menolak check-in ganda dan check-out tanpa check-in, dan mengisi kolom yang sesuai.
- Tidak ada grant `INSERT`/`UPDATE`/`DELETE` langsung ke `authenticated` untuk tabel ini; `anon` dicabut semua. `service_role` tetap penuh.

### Jam standar per cabang

- Tambah kolom di `public.branches`: `check_in_time time not null default '08:00'`, `check_out_time time not null default '17:00'`.
- Form edit di halaman `/app/cabang` (hak tulis seperti cabang saat ini).
- Status dihitung saat membaca rekap, memakai waktu WIB (`at time zone 'Asia/Jakarta'`, pola sudah ada di migrasi cash session):
  - `check_out_at is null` → **Belum pulang**
  - jam masuk > `check_in_time` → **Terlambat**
  - jam pulang < `check_out_time` → **Pulang awal**
  - selainnya → **Hadir**

## Selfie & penyimpanan

- Server action mengunggah file ke bucket `PHOTO_BUCKET` (`cervise-photos`) lewat `createAdminClient()`, mengikuti pola `src/app/app/pengaturan/photo-actions.ts`.
- Path: `attendance/{organization_id}/{employee_id}/{tanggal}-{kind}-{acak}.jpg` — segmen acak mengikuti pola `photos.ts` supaya path tidak bisa ditebak dari id.
- ⚠️ Bucket bersifat publik; kerahasiaan bergantung pada path yang sulit ditebak. Tidak dibuat bucket privat di v1.

## Rekap & export

- Tabel harian: tanggal, nama, cabang, jam masuk, jam pulang, status, thumbnail selfie, koordinat, catatan. Filter: bulan, cabang, status.
- Ringkasan per karyawan: jumlah Hadir / Terlambat / Pulang awal / Belum pulang.
- Export memakai `GenericExportDialog` (`src/components/generic-export-dialog.tsx`) yang sudah mendukung CSV/XLSX/JSON/PDF — tidak perlu exporter baru.

## Error handling

- Check-in ganda, check-out tanpa check-in, selfie gagal, lokasi ditolak → pesan pengguna jelas via `sonner`.
- RPC melempar error jika argumen tidak valid; server action menerjemahkannya ke pesan Indonesia.
- Semua perhitungan tanggal memakai WIB, bukan timezone browser.

## Testing & verifikasi

- Unit test (vitest): fungsi hitung status (tepat waktu, terlambat, pulang awal, belum pulang) dan validasi RPC (kind invalid, check-in ganda, check-out tanpa check-in) — atau ekivalen murni jika RPC belum bisa di-test langsung.
- Verifikasi: `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`.

## Dampak ke file yang sudah ada

- `middleware.ts` / `src/lib/auth/authorization.ts` — path `/absensi`.
- `src/lib/nav/manifest.ts`, `src/lib/auth/permissions.ts`, `messages/id.json`, `messages/en.json` — menu & izin rekap.
- `src/app/app/cabang/*` — input jam standar cabang.
- `src/lib/supabase/actor.ts` — helper ekspor baru `getActiveTenantForAttendance`.
- `src/lib/photos.ts` — tidak diubah, hanya dipakai konstanta bucket-nya.

## Risiko yang diketahui

1. Foto selfie berada di bucket publik (lihat bagian Selfie).
2. GPS tidak divalidasi terhadap lokasi cabang; koordinat bisa salah/gagal dan tetap diterima.
3. Karyawan bisa absen walaupun tenant trial-nya habis — ini disengaja agar data kehadiran tidak bolong.
