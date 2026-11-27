# Tabel data servis: waktu masuk, status ringkas, dan sort tanggal

## Konteks

Halaman `/app/servis` merender daftar servis sebagai tabel desktop dan kartu mobile. Kolom Tanggal Masuk hanya menampilkan tanggal (`d MMM yyyy`) karena `ServisListRow.date` dipotong dari `created_at`. Kolom Status memakai `StageTrack`, deretan delapan ikon kecil untuk semua tahap. Badge teks "HP Diambil" ditambahkan terpisah di samping `StageTrack`. Kolom Harga sudah punya tombol sort dengan ikon `ArrowUpDownIcon`/`ArrowUpIcon`/`ArrowDownIcon`; Tanggal Masuk belum.

## Tujuan

- Tanggal Masuk menampilkan tanggal dan jam WIB.
- Kolom Status menampilkan satu ikon sesuai status beserta labelnya, dan di bawahnya keterangan waktu terakhir update.
- Status "Sudah Diambil" diwakili oleh ikon status itu sendiri; badge "HP Diambil" dihapus.
- Tanggal Masuk bisa di-sort naik/turun seperti kolom Harga.

## Keputusan

- Format tanggal dan waktu persis `27/11/2026 | 14:32`, timezone `Asia/Jakarta`, jam 24 jam. Dipakai untuk Tanggal Masuk maupun baris "Terakhir update".
- Baris update ditulis persis `Terakhir update 27/11/2026 | 14:32`.
- Label status memakai nilai status persis dari database, mis. `Sudah Diambil` (bukan `Diambil` / `HP Diambil`).
- Urutan sort: `none → asc → desc → none`, diterapkan pada timestamp penuh `createdAt`, sebelum sort harga bila keduanya aktif.
- Perilaku diterapkan di tabel desktop dan kartu mobile agar konsisten.

## Data dan komponen

- `src/app/app/servis/actions.ts` (`getServisList`): tambah `updated_at` ke `select` dan ke tipe `serviceRows`.
- `src/lib/operational/servis-list.ts`:
  - `ServisServiceInput` tambah `updated_at: string | null`.
  - `ServisListRow` tambah `createdAt: string` (ISO penuh) dan `updatedAt: string` (fallback ke `created_at`).
  - `date` dipertahankan apa adanya (`created_at.slice(0, 10)`) karena dipakai filter tanggal.
- `src/lib/format.ts`: tambah `formatWibStamp(value: string | null | undefined): string` memakai `Intl.DateTimeFormat` dengan `timeZone: "Asia/Jakarta"`, `day/month/year 2-digit`, `hour/minute 2-digit`, `hourCycle: "h23"`. Kembalikan `—` untuk nilai kosong atau tidak valid.
- `src/app/app/servis/page.tsx`:
  - hapus `PickedUpBadge`;
  - tambah `ServisStatus({ stage, updatedAt })` yang mencari entri di `STAGES`, merender `Icon` + label `stage`, lalu baris `Terakhir update {formatWibStamp(updatedAt)}`;
  - sel Tanggal Masuk merender `formatWibStamp(r.createdAt)`;
  - sel Status (tabel dan kartu) memakai `ServisStatus`;
  - state `dateSort` dan tombol header bergaya Harga.

## Alternatif yang ditolak

- Logika inline tanpa helper: format WIB dan lookup ikon terduplikasi di dua tampilan.
- Menyembunyikan ikon `StageTrack` dengan CSS: markup timeline tetap ada dan perilakunya bergantung pada kelas CSS.

## Error handling dan edge case

- `updated_at` null → pakai `created_at` (baris lama belum pernah diubah).
- Tanggal tidak valid → `formatWibStamp` mengembalikan `—`, bukan `Invalid Date`.
- Sort tanggal tidak mengubah data; hanya mengurutkan salinan `rows`.

## Testing

- `src/lib/operational/servis-list.test.ts`: `createdAt` berisi ISO penuh dan `updatedAt` jatuh ke `created_at` bila null.
- Tes helper format di `src/lib/format.test.ts` (file baru): `2026-11-27T07:32:00.000Z` → `27/11/2026 | 14:32`; nilai invalid → `—`.
- `src/lib/ui-regressions.test.ts`: `page.tsx` tidak lagi memuat `PickedUpBadge`, memuat `ServisStatus` dua kali, memuat tombol sort `dateSort`, dan memuat format `Terakhir update`.
- Verifikasi: `npx tsc --noEmit`, `npm test -- --run`, `npm run build`.

## Lingkup

Enam file maksimal: actions, servis-list, format, page, dan dua file tes. Tidak ada migrasi, RLS, pricing, atau perubahan alur status.
