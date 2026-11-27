# Halaman Stock Opname Sparepart terpisah

## Konteks

Alur opname sudah mendukung dua domain di `/app/inventori/opname`: tab **Produk** dan **Sparepart** (`opname-client.tsx:160-183`). `createSession("sparepart")` mengambil baris dari `cervise_spareparts` (`actions.ts:113-120`), dan sesi disimpan dengan kolom `domain`. Detail sesi `/app/inventori/opname/[id]` sudah domain-aware.

Yang belum ada: akses ke opname dari halaman `/app/sparepart`. Header Sparepart punya tombol Beli, Transfer, Kategori, dan Tambah, tetapi tidak ada tombol Stock Opname seperti di `inventori-header-actions.tsx:30-35`.

## Tujuan

- Dari `/app/sparepart`, kasir bisa langsung membuka halaman opname khusus sparepart.
- Halaman itu hanya menampilkan sesi sparepart, tanpa tab Produk.

## Keputusan

- Rute baru: `/app/sparepart/opname`.
- Halaman baru memakai komponen `OpnameClient` yang sudah ada dengan prop baru `lockedDomain="sparepart"`.
- Detail sesi tetap memakai `/app/inventori/opname/[id]`; tidak membuat rute detail baru.
- Tombol di header Sparepart ditampilkan untuk semua role; izin posting tetap berada di `OPNAME_POSTER_ROLES` dan RPC `post_stock_opname`.
- Tidak ada perubahan DB, migrasi, RPC, atau logika snapshot/posting.

## Komponen dan alur

### `src/app/app/sparepart/opname/page.tsx` (baru)
- Server component dengan `requireMenu("kategori_sparepart")`, sama seperti `/app/sparepart/page.tsx`.
- Ambil `listSessions("sparepart")`, tentukan `canPost` dari `OPNAME_POSTER_ROLES`.
- Render `PageHeader` berjudul "Stock Opname Sparepart" dan `<OpnameClient lockedDomain="sparepart" products={[]} spareparts={sessions} canPost={canPost} />`.

### `src/app/app/inventori/opname/opname-client.tsx`
- `OpnameClient` menerima prop opsional `lockedDomain?: Domain`.
- `useState<Domain>(lockedDomain ?? "product")`.
- Bila `lockedDomain` diisi: jangan render `Tabs`; langsung render `SessionList` untuk domain itu saja.
- Bila tidak diisi: tampilan dan perilaku persis seperti sekarang.
- `create()` tetap memakai nilai `domain` yang terkunci.
- `refresh()` tetap mengambil `listSessions("product")` dan `listSessions("sparepart")` seperti sekarang.

### `src/app/app/sparepart/sparepart-client.tsx`
- Tambah impor `PackageCheckIcon` dari `lucide-react`.
- Di `PageHeader.actions`, sebelum tombol Beli Sparepart, tambahkan:
  `<Button variant="outline" size="sm" className="h-8" render={<Link href="/app/sparepart/opname" />}><PackageCheckIcon className="size-3.5" /> Stock Opname</Button>`
- Tidak ada pengecekan `canManage` pada tombol ini.

## Alternatif yang ditolak

- Client component opname baru khusus sparepart: menduplikasi dialog buat/cancel, refresh, dan export.
- Hanya mengubah tombol pointing ke `/app/inventori/opname`: tidak menghasilkan halaman terpisah sesuai permintaan.
- Query param `?domain=sparepart` pada halaman opname lama: tab Produk tetap terlihat.

## Error handling dan edge case

- Cabang belum dipilih: `createSession` sudah melempar "Pilih cabang dulu sebelum stock opname"; halaman baru tidak mengubahnya.
- Tidak ada sparepart di cabang: `createSession` sudah melempar "Tidak ada barang untuk dihitung di cabang ini".
- Role tanpa izin posting: tombol Buat Sesi/Sesi masih tampil, tetapi aksi posting ditolak oleh UI + RPC seperti di halaman lama.

## Testing

- Tes sumber: `sparepart-client.tsx` memiliki tautan `/app/sparepart/opname` dan `PackageCheckIcon`.
- Tes sumber: rute `src/app/app/sparepart/opname/page.tsx` memanggil `requireMenu("kategori_sparepart")`, `listSessions("sparepart")`, dan `<OpnameClient lockedDomain="sparepart"`; tidak merender tab Produk.
- Tes sumber: `src/app/app/inventori/opname/opname-client.tsx` memakai `lockedDomain ?? "product"` dan menyembunyikan `Tabs` saat terkunci.
- Verifikasi: `npx tsc --noEmit`, `npm test -- --run`, `npm run build`.

## Lingkup

Tiga file kode/sumber (satu file baru, dua dimodifikasi) plus tes. Tidak menyentuh data, RPC, atau alur opname yang sudah ada.
