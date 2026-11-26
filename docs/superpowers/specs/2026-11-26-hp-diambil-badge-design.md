# Badge "HP Diambil" pada daftar servis

## Konteks

Halaman `/app/servis` menampilkan daftar servis dalam dua tampilan: tabel desktop dan kartu mobile. Kolom `Status` memakai `StageTrack` (deretan ikon kecil untuk semua tahap). Tahap `"Sudah Diambil"` sudah ada di `STAGES`, tetapi hanya tampil sebagai ikon `TruckIcon` tanpa label teks. Tidak ada badge bertuliskan "HP Diambil" di kedua tampilan tersebut.

## Tujuan

Menandai secara visual baris servis yang HP-nya sudah diserahkan ke pelanggan, tanpa menambah kolom, query, atau perubahan schema.

## Keputusan

- Badge hanya muncul ketika `status === "Sudah Diambil"`. Status `"Selesai"` tidak mendapat badge (belum diambil).
- Badge berupa teks "HP Diambil" memakai komponen `Badge` yang sudah dipakai halaman ini.
- Badge ditempatkan di samping `StageTrack`, bukan menggantikannya.
- Sumber data tetap `r.status` dari `ServisListRow` yang sudah ada.

## Komponen dan alur

- File: `src/app/app/servis/page.tsx`.
- Tambah pembungkus kecil `PickedUpBadge({ status }: { status: Stage })` di dekat `PaymentBadge`. Mengembalikan `null` untuk status selain `"Sudah Diambil"`, sehingga tidak ada cabang bersarang di dua tempat pemakaian.
- Pasang `<PickedUpBadge status={r.status} />` pada:
  1. sel `Status` tabel desktop (baris ~1026),
  2. blok `StageTrack` kartu mobile (baris ~1066).
- Tidak ada perubahan migrasi, RLS, server action, atau query.

## Alternatif yang ditolak

- Kolom baru "HP Diambil": memakan ruang, mengubah `colSpan`, dan harus mengubah layout kartu.
- Mengubah `StageTrack` menjadi badge teks untuk semua status: di luar lingkup dan mengubah tampilan yang sudah mapan.

## Error handling dan edge case

- Tidak ada input baru, jadi tidak ada jalur error baru.
- Jika data lama memakai status selain `"Sudah Diambil"`, badge tidak muncul — perilaku ini disengaja.

## Testing

- Satu tes regresi di `src/lib/ui-regressions.test.ts` membaca sumber `src/app/app/servis/page.tsx` dan memastikan:
  - ada pembandingan `status === "Sudah Diambil"`,
  - teks "HP Diambil" muncul minimal dua kali (pemakaian di tabel dan di kartu).
- Verifikasi dengan `npx tsc --noEmit`, `npm test -- --run`, `npm run build`.

## Lingkup

Satu file komponen + satu file tes. Tidak menyentuh data, pricing, atau alur status servis.
