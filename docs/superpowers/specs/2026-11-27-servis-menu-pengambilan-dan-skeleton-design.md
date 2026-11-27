# Menu pengambilan servis dan skeleton dialog bayar

## Konteks

Halaman `/app/servis` memakai `ServisContextMenu` untuk desktop (portal) dan mobile (bottom sheet), serta `SwipeActions` untuk aksi geser di kartu mobile. Saat ini:

- Menu "Bayar sekarang" muncul untuk status `Selesai` **dan** `Sudah Diambil` (`servis-context-menu.tsx:173`), walaupun status akhir seharusnya tidak perlu ditagih lagi.
- Swipe "Bayar" justru hilang saat pembayaran `Lunas` (`page.tsx:643-654`), padahal saat itulah pengguna perlu mengambil HP.
- Dialog `ServisPaymentDialog` saat memuat data hanya menampilkan satu blok `Skeleton h-40` (`servis-payment-dialog.tsx:121`), tidak menyerupai layout dua kolom setelah data siap.

Alur sistem: pembayaran harus lunas lebih dulu, baru status boleh menjadi `Sudah Diambil` lewat dialog tanda tangan.

## Tujuan

- Servis lunas dan belum diambil: menu konteks dan swipe menawarkan **Diambil**.
- Servis belum lunas: tetap menawarkan **Bayar**.
- Servis sudah diambil: tidak menawarkan **Bayar** maupun **Diambil**.
- Skeleton dialog bayar mengikuti bentuk konten akhirnya.

## Keputusan

- Kondisi memakai `servis.payment === "Lunas"` di `ServisContextMenu` dan `getPaymentStatus(s) === "Lunas"` di `page.tsx`; keduanya berasal dari `mapServisListRows`.
- Status `Sudah Diambil` ditentukan dari `servis.status`.
- Aksi **Diambil** memanggil `onStatusChange(servis, "Sudah Diambil")` (desktop + sheet) dan `handleStatusChange(s, "Sudah Diambil")` (swipe), sehingga tetap lewat dialog tanda tangan yang sudah ada.
- Aksi swipe **Diambil** memakai `keepRow: true`, mengikuti aksi swipe lain yang membuka modal.
- Tidak ada server action, migrasi, atau perubahan alur status baru.

## Komponen dan alur

### `src/components/servis-context-menu.tsx`
- Ganti `isPaidStage` dengan `isPaid` dan `isPickedUp`.
- Di menu desktop dan sheet mobile, blok bersyarat:
  - `isPaid && !isPickedUp` → item **Diambil** (ikon `TruckIcon` dari lucide-react), panggil `onStatusChange(servis, "Sudah Diambil")`.
  - `!isPaid` → item **Bayar sekarang** seperti sekarang.
  - `isPaid && isPickedUp` → tidak ada keduanya.
- Item lain (Lihat detail, Edit, Print, WA, Ubah status, Hapus) tidak berubah.

### `src/app/app/servis/page.tsx`
- `leadingActions(s)`:
  - lunas & belum diambil → `{ label: "Diambil", icon: TruckIcon, tone: "accent", keepRow: true, onSelect: () => handleStatusChange(s, "Sudah Diambil") }`;
  - belum lunas → aksi **Bayar** seperti sekarang;
  - lunas & sudah diambil → `[]`.
- Impor `TruckIcon` dari `lucide-react`.

### `src/components/servis/servis-payment-dialog.tsx`
- Tambah komponen lokal `PaymentDialogSkeleton` yang memakai grid sama dengan konten siap:
  `grid gap-4 md:h-full md:grid-cols-[minmax(0,35fr)_minmax(0,65fr)]`.
  - Kiri: kartu `rounded-lg border bg-muted/30 p-4` berisi skeleton judul, device, nomor, badge, label kerusakan, dan baris sparepart.
  - Kanan: skeleton ringkasan nominal serta skeleton tombol.
- Ganti `<Skeleton className="h-40 w-full" />` dengan `<PaymentDialogSkeleton />`.

## Alternatif yang ditolak

- Menambah prop `paymentStatus` ke `ServisContextMenu`: eksplisit, tapi menyentuh tiga pemanggilan tanpa manfaat tambahan karena `servis.payment` sudah tersedia.
- Menduplikasi kondisi secara terpisah di menu dan swipe: rawan drift saat aturan pembayaran berubah.

## Error handling dan edge case

- Baris lama tanpa `payment` dan tanpa `paidAmount`: `getPaymentStatus` di halaman tetap memakai fallback yang ada; context menu memakai `servis.payment` yang sudah diisi `mapServisListRows`.
- Status `Sudah Diambil` dengan tagihan belum lunas dianggap tidak mungkin oleh sistem; tidak ada menu yang ditambahkan untuk kondisi itu.
- Skeleton hanya tampil saat `data?.key !== servisId`; tidak mengubah perilaku saat error (tetap merender panel dengan data kosong).

## Testing

- `src/app/app/servis/page-swipe-actions.test.ts`: swipe **Bayar** saat belum lunas, **Diambil** saat lunas & belum diambil, kosong saat sudah diambil; aksinya memanggil `handleStatusChange(..., "Sudah Diambil")`.
- Test sumber `servis-context-menu`: menu desktop dan sheet memakai `isPaid`/`isPickedUp`, label **Diambil**, dan tidak lagi memakai `isPaidStage` untuk menentukan Bayar.
- Test sumber `servis-payment-dialog`: skeleton tidak lagi `h-40` dan memakai grid dua kolom yang sama dengan konten.
- Verifikasi: `npx tsc --noEmit`, `npm test -- --run`, `npm run build`.

## Lingkup

Tiga file komponen/halaman plus file tes terkait. Tidak menyentuh DB, RLS, pricing, atau server action.
