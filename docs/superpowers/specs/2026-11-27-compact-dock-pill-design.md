# Dock compact mobile bergaya pill dengan trigger menu

## Konteks

`CompactDockNav` (`src/components/layout/compact-dock-nav.tsx`) saat ini menampilkan tiga tombol candy berbentuk kotak (`rounded-xl`, `size-12`) tanpa label, dengan fade hitam di belakangnya. Trigger menu sheet berada di header atas (`compact-bottom-bar.tsx:84-92`, tombol grid "Buka menu") dan diteruskan lewat prop `onOpenMenu` dari `CompactShellInner` (`compact-shell.tsx:327-333`).

Referensi yang diberikan pengguna: pill abu muda berisi item aktif "Home" dengan ikon + teks dalam latar putih, tiga ikon abu di sampingnya, serta satu tombol hitam bulat bertanda `+` di luar pill.

## Tujuan

- Dock Teknisi/Frontliner mengikuti bentuk pill referensi.
- Item aktif menampilkan ikon + label; item lain hanya ikon.
- Tombol `+` di dock membuka menu sheet; tombol grid di header dihapus.
- Tetap memakai token warna aplikasi dan mendukung dark mode.

## Keputusan

- Jumlah item tetap tiga: Home, Servis, dan Sparepart (Teknisi) / Penjualan (Frontliner).
- Label hanya tampil pada item aktif.
- Tombol `+` memakai `PlusIcon`, `aria-label="Buka menu"`, dan memanggil prop `onOpenMenu` yang diteruskan `CompactShellInner`.
- Warna mengikuti token: pill `bg-muted/80` + `ring-border/60`, item aktif `bg-card`/dark counterpart dengan `text-foreground`, item nonaktif `text-muted-foreground`, tombol `+` `bg-foreground text-background`.
- Tidak menambah rute, data, atau perubahan menu sheet.

## Komponen dan alur

### `src/components/layout/compact-dock-nav.tsx`
- Prop baru: `onOpenMenu: () => void`.
- Struktur:
  - wrapper `pointer-events-none fixed inset-x-0 bottom-0 z-30 ...` tetap seperti sekarang, termasuk `hidden` dan fade hitam `aria-hidden`;
  - baris `pointer-events-auto flex items-center gap-2 px-4 pt-2 pb-[calc(1.5rem+env(safe-area-inset-bottom))]`;
  - `<nav aria-label="Navigasi utama">` berupa pill `flex min-w-0 flex-1 items-center gap-1 rounded-full bg-muted/80 p-1.5 ring-1 ring-border/60 backdrop-blur`;
  - tiap item dirender dengan `Button` + `MainNavLink`, `variant="ghost"`, `size="icon-lg"`;
    - aktif: `flex-1 justify-start gap-2 rounded-full bg-card px-4 text-foreground shadow-sm dark:bg-neutral-800`, ikon + `<span className="truncate text-sm font-medium">{item.label}</span>`;
    - nonaktif: `size-11 shrink-0 rounded-full text-muted-foreground`, ikon saja;
  - ikon tetap `fill={active ? "currentColor" : "none"}`;
  - di luar pill: `<button type="button" onClick={onOpenMenu} aria-label="Buka menu" className="pointer-events-auto flex size-12 shrink-0 items-center justify-center rounded-full bg-foreground text-background shadow-lg"><PlusIcon className="size-5" /></button>`.

### `src/components/layout/compact-bottom-bar.tsx`
- Hapus tombol grid "Buka menu" (baris ~84-92) beserta prop `onOpenMenu` dari signature dan tipe props.
- Header mobile hanya berisi logo + judul; `LayoutGrid` tidak dipakai lagi di file ini bila tidak ada pemakaian lain.

### `src/components/layout/compact-shell.tsx`
- `<CompactDockNav role={actor.role} hidden={dockHidden} onOpenMenu={() => setMenuOpen(true)} />`.
- Hapus `onOpenMenu` dari pemanggilan `<CompactBottomBar>`.

## Alternatif yang ditolak

- Komponen dock baru: menduplikasi `isActive`, `MainNavLink`, dan item berbasis role.
- Menambah `+` tanpa menghapus tombol header: dua trigger menu dengan fungsi sama.
- Warna hitam/putih absolut referensi: tidak konsisten dengan tema dan dark mode aplikasi.

## Error handling dan edge case

- Aktif adalah `/app` (home): `isActive` sudah menangani persis `/app`; item lain memakai prefix.
- Label panjang (`Penjualan`, `Sparepart`) dipotong dengan `truncate`, sehingga pill tidak melewati lebar layar.
- Saat dock disembunyikan (`dockHidden`), seluruh baris termasuk tombol `+` ikut `translate-y-full opacity-0` seperti sebelumnya.
- Role tanpa akses Sparepart mendapat Penjualan seperti perilaku lama.

## Testing

- Perbarui `src/components/layout/compact-dock-nav.test.ts`: pill `rounded-full bg-muted/80`, label hanya untuk item aktif, tombol `PlusIcon` dengan `aria-label="Buka menu"` dan `onOpenMenu`.
- Perbarui test header mobile yang mengunci tombol grid lama agar menyatakan tombol itu tidak ada lagi.
- Verifikasi: `npx tsc --noEmit`, `npm test -- --run`, `npm run build`.

## Lingkup

Tiga file komponen/shell plus tes terkait. Tidak ada perubahan schema, server action, atau rute.
