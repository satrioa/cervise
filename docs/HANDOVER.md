# Serah terima mesin

Ditulis 17 Oktober 2026, saat repo dipindah ke komputer baru.
Semua state project ada di `docs/superpowers/plans/2026-10-17-commit-dan-keamanan.md`
-- baca itu dulu untuk tahu pekerjaan berikutnya.

> **Penting (26 Oktober 2026):** pekerjaan yang masih tertunda dari semua
> sesi sebelumnya ada di [`docs/UNFINISHED.md`](./UNFINISHED.md). Baca file itu
> sebelum mulai bekerja -- di sana ada daftar migrasi yang belum ter-apply,
> commit yang belum di-push, dan pekerjaan setengah jalan.

## Sebelum packing, ambil ini dari komputer lama

Dua nilai ini **tidak ada di repo** dan tidak bisa di-regenerate:

- `FONNTE_TOKEN` -- token Fonnte, tanpa ini notifikasi WhatsApp tidak terkirim
- `CRON_SECRET` -- tanpa ini route cron `/api/cron/*` menolak semua request

Ambil dari password manager, bukan dari repo. Kalau salah satu hilang,
cron dan notifikasi WhatsApp diam-diam mati.

## Setup di mesin baru

```powershell
git clone https://github.com/satrioa/cervise.git
cd cervise
npm install
Copy-Item .env.example .env.local   # lalu isi dengan nilai asli
npm run dev
```

Nilai yang harus diisi, sesuai nama yang benar-benar dipakai `.env.local`:

| Nama | Sumber |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Dashboard Supabase > Project Settings > API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | sama |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | sama (versi baru, mulai dipakai) |
| `SUPABASE_SERVICE_ROLE_KEY` | sama -- **jangan pernah** masuk ke kode client |
| `FONNTE_TOKEN` | password manager |
| `CRON_SECRET` | password manager, string acak panjang |

Catatan: `.env.example` masih menyebut `OWNER_WHATSAPP_NUMBER` yang tidak
ada di `.env.local`, dan belum menyebut `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
Ikuti tabel di atas, bukan file example.

## Versi tool

Dibangun dan dites dengan Node **v26.1.0** dan npm 11. `package.json` tidak
punya field `engines`, jadi versi lain kemungkinan besar jalan, tapi ini
yang sudah terbukti.

Jangan pakai `bun`. `bun.lock` sengaja masuk `.gitignore` supaya tidak ada
dua lockfile dengan resolusi versi berbeda.

## Gerbang sebelum commit

```powershell
npm run typecheck    # wajib hijau
npm test             # wajib hijau, 1452 test di 128 file
npm run lint         # merah, sudah begitu sejak lama -- baca catatan di bawah
```

Catatan: `npm` diblokir PowerShell di mesin ini (Execution Policy menahan
`npm.ps1`). Pakai `cmd /c "npm ..."` atau `npm.cmd`.

## Dua hal yang akan mengejutkan

### 1. Migrasi: nomor versi lokal tidak sama dengan yang ter-apply

Tiga migration terakhir sudah lebih dulu ter-apply ke Supabase dengan
nomor versi yang dibuat Supabase, bukan dengan nama file di repo:

| Nama file di repo | Nomor versi di database |
| --- | --- |
| `20260925340000_service_completed_at.sql` | `20260930102838` |
| `20260925350000_lacak_appearance.sql` | `20260930111011` |
| `20260925360000_lacak_landing_page.sql` | ter-apply 17 Okt 2026 |

**Jangan `supabase db push` buta.** Perintah itu akan mencoba menerapkan
ulang dua migration yang sudah jalan. Kalau memang perlu menerapkan
migration baru, pakai MCP `apply_migration` seperti yang sudah dilakukan
sebelumnya, supaya penomoran tetap konsisten dengan yang sudah ada.

### 1b. Dua migration belum ter-apply

Per 26 Oktober 2026, `20261023120000_branch_scope_and_admin_access.sql` dan
`20261024120000_service_pickup_signature.sql` masih **belum** masuk ke
database produksi. Detail, cara apply, dan perintah verifikasi ada di
[`docs/UNFINISHED.md`](./UNFINISHED.md) bagian 1.

### 2. `npm run lint` merah, dan itu sudah lama

Sekitar 323 error, 260 di antaranya `no-explicit-any` di file yang tidak
disentuh berbulan-bulan (`src/i18n/request.ts`, `src/lib/format.ts`,
`src/components/ui/button.tsx`, dan seterusnya). Baseline ini bukan
warisan working set baru.

Yang sengaja diperbaiki di working set terakhir: 5 error
`no-explicit-any` di `src/components/settings-appearance-landing.tsx`.

Yang sengaja **tidak** diperbaiki: 4 error di
`src/components/interior/floating-label.tsx` (2 `set-state-in-effect`,
2 `immutability`). Aturan yang sama sudah dilanggar 26 dan 3 kali di file
yang sudah ter-commit, jadi ini konsisten dengan gaya kode yang ada.
Perbaikannya berarti mengubah API hook dan satu pemanggil, dan tidak
sedang diminta. Kalau nanti dibersihkan, mulai dari situ.

## File yang sengaja tidak masuk git

- `supabase/.seed-ids.json` -- id baris hasil seed, regenerate dengan
  menjalankan seed lagi
- `.next/`, `node_modules/`, `*.tsbuildinfo`, `next-env.d.ts`
- `.originkit/`

## Deploy

Vercel terhubung lewat GitHub, jadi push ke `main` sudah cukup untuk
deploy. Tidak ada langkah manual. Kalau perlu memicu deploy tanpa push,
pakai Vercel MCP.
