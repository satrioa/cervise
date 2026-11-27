# Dock compact: item aktif hug-to-content dan ikon grid

## Konteks

`CompactDockNav` baru saja diubah menjadi pill (`src/components/layout/compact-dock-nav.tsx`). Item aktif memakai `flex-1` sehingga lebarnya mengisi sisa pill; pengguna melaporkan ini terlalu lebar. Tombol trigger menu memakai `PlusIcon`; pengguna ingin ikon grid empat kotak (`LayoutGrid`) seperti tombol menu lama di header.

## Tujuan

- Lebar item aktif mengikuti isi (ikon + label), bukan mengisi sisa pill.
- Tombol trigger menu memakai ikon `LayoutGrid`.

## Keputusan

- Hapus `flex-1` dari kelas tombol aktif; `px-4` dan `justify-start` tetap dipertahankan.
- `nav` pill tetap `flex-1`, jadi lebar pill tidak berubah.
- Ganti impor dan pemakaian `PlusIcon` dengan `LayoutGrid` (`className="size-5"`, outline empat kotak).
- `aria-label="Buka menu"` dan `onClick={onOpenMenu}` tidak berubah.

## Komponen dan alur

### `src/components/layout/compact-dock-nav.tsx`
- Impor: `LayoutGrid` menggantikan `PlusIcon` dari `lucide-react`.
- Kelas item aktif menjadi:
  `justify-start gap-2 rounded-full bg-card px-4 text-foreground shadow-sm dark:bg-neutral-800`
- Tombol menu:
  `<LayoutGrid className="size-5" />`.

### `src/components/layout/compact-dock-nav.test.ts`
- Assertion `flex-1 justify-start ...` diubah menjadi `justify-start gap-2 rounded-full bg-card px-4`.
- Assertion `<PlusIcon>` diubah menjadi `<LayoutGrid`.
- Assertion `bg-foreground text-background` dan `aria-label="Buka menu"` tetap.

## Alternatif yang ditolak

- Membatasi lebar dengan `max-w-*`: masih bisa terlihat terlalu lebar dan menambah aturan angka baru.
- Komponen item baru: perubahan hanya dua kelas + satu ikon, tidak perlu abstraksi.

## Error handling dan edge case

- Label panjang (`Penjualan`, `Sparepart`) tetap dipotong dengan `truncate`; `span` berada di dalam tombol yang kini hug-to-content, jadi lebar maksimal adalah lebar teks penuh.
- Item nonaktif tetap `size-11 shrink-0`, tidak terpengaruh.
- Saat dock disembunyikan, tombol grid ikut tersembunyi bersama wrapper.

## Testing

- `npx vitest run src/components/layout/compact-dock-nav.test.ts`
- `npx tsc --noEmit`
- `npm test -- --run`
- `npm run build`

## Lingkup

Satu file komponen dan satu file tes. Tidak ada perubahan data, rute, atau warna token.
