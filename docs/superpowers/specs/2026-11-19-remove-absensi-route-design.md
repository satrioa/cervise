# Hapus route `/absensi` dari app utama — Desain

Tanggal: 2026-11-19
Status: disetujui (brainstorming 2026-11-19)

## Tujuan

Menyisakan **satu** tempat absensi: `absen.kaggo.app` (kiosk dengan login email+PIN dan kamera yang langsung menyala dalam frame lingkaran). Halaman `/absensi` di app utama dihapus total; URL lama sengaja balas 404.

## Latar belakang

Awalnya ada dua halaman karena alur autentikasi berbeda:

- `/absensi` di app utama memakai sesi Supabase dan input file `capture="user"` (kamera tidak langsung menyala).
- `/absen-kiosk` adalah route internal hasil rewrite middleware untuk host `absen.kaggo.app`, memakai sesi PIN, kamera `getUserMedia` yang aktif saat mount, dan frame `rounded-full` (radius 100%).

User ingin satu halaman saja di subdomain dan tidak ingin alur "upload foto". Kiosk sudah memenuhi syarat kamera: tidak perlu perubahan UI kamera.

## Keputusan

1. Hapus direktori `src/app/absensi/` beserta page, layout, client, action, dan test-nya.
2. Hapus helper `getActiveTenantForAttendance` dari `src/lib/supabase/actor.ts` — hanya dipakai file yang dihapus.
3. Hapus `"absensi"` dari `ProtectedPathKind`, blok di `getProtectedPathKind()`, dan assertion terkait di `src/lib/auth/authorization.test.ts`.
4. Tidak ada redirect: `/absensi` balas 404.
5. Tidak mengubah database: `attendance_records`, view `attendance_rekap`, RPC `submit_attendance`/`submit_attendance_pin`, dan helper status tetap dipertahankan (dipakai kiosk & rekap).
6. Tidak ada komponen kamera bersama yang dibuat — kiosk sudah memiliki perilaku yang diminta.

## Non-goal

- Mengubah UI kiosk.
- Menghapus/mengganti halaman rekap `/app/laporan/absensi`.
- Mengubah migration atau data produksi.
- Redirect bookmark lama ke subdomain.

## Dampak file

- Hapus: `src/app/absensi/page.tsx`, `layout.tsx`, `absensi-client.tsx`, `actions.ts`, `actions.test.ts`.
- Modify: `src/lib/supabase/actor.ts`, `src/lib/auth/authorization.ts`, `src/lib/auth/authorization.test.ts`.

## Verifikasi

- Grep: tidak ada lagi referensi literal `/absensi` selain `/app/laporan/absensi`.
- `npm run test`, `npm run typecheck`, `npm run lint`, `npm run build`.
- Setelah deploy: `curl https://cervise.vercel.app/absensi` → 404; `https://cervise.vercel.app/absen-kiosk` → form PIN; `https://absen.kaggo.app/` → form PIN (setelah DNS CNAME aktif).

## Risiko

- Bookmark/tautan lama ke `/absensi` akan 404 — ini disengaja sesuai keputusan.
- `getActiveTenantForAttendance` dihapus; kalau ada pemanggil di luar `src/` (misal script), perlu dicek saat eksekusi.
