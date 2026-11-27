# Batch Distribusi Stok Gudang Pusat — Design Spec

**Date:** 2026-11-27
**Status:** Approved by user (keputusan 1–4; desain bagian 1–3)

## Goal
Mempercepat distribusi stok gudang pusat ke cabang: master admin memilih beberapa item sekaligus, mengisi qty per item secara inline, melihat preview, lalu submit satu kali untuk seluruh daftar.

## Keputusan yang disetujui
1. **Atomik semua-atau-tidak-ada (A).** Satu transaksi; kalau satu baris gagal, tidak ada stok yang berpindah dan daftar gagal diberi pesan per SKU.
2. **Item serialized/IMEI tidak ikut batch (A).** Batch hanya item non-serial. Unit serialized tetap memakai alur distribusi satu-per-satu yang sudah ada.
3. **Preview dengan tombol Kembali (A).** Preview read-only; pengguna bisa kembali ke tabel editable sebelum konfirmasi.
4. **Pendekatan 1:** RPC batch baru memanggil `distribute_central_stock` per baris di dalam satu transaksi, bukan menulis ulang logika distribusi dan bukan loop dari client.

## Arsitektur
- Migration baru `supabase/migrations/20261127200000_batch_distribution.sql`:
  - `public.distribute_central_items_batch(p_target_branch_id uuid, p_items jsonb) returns jsonb`, `language plpgsql`, `security definer`, `set search_path = public`.
  - Cek `is_platform_admin() or has_tenant_role(..., ['MASTER_ADMIN'])` sekali di awal.
  - `p_items` berisi array `{central_item_id, qty, expected_stock}`. Tiap baris divalidasi qty bulat > 0, lalu diproses lewat `public.distribute_central_stock(item_id, p_target_branch_id, qty, expected_stock, null)`.
  - Satu exception dari baris mana pun menggagalkan seluruh fungsi; pesan error menyertakan SKU baris yang gagal. Return ringkasan `{lines, total_qty}` untuk toast.
  - `revoke all ... from public, anon;` lalu `grant execute ... to authenticated;`. Tidak membuat overload baru dari fungsi yang sudah ada.
- Server action baru `distributeCentralItemsBatch` di `src/app/app/sparepart/central-actions.ts`: menerima `{ targetBranchId, items: [{ id, qty, expectedStock }] }`, menolak array kosong/qty ≤ 0, meneruskan `expected_stock` per baris, memanggil RPC sekali, lalu `revalidatePath("/app/sparepart")` sekali.
- `distributeCentralStock` (action lama) tetap ada dan tetap dipakai UI untuk item serialized. Tidak ada perubahan pada ledger, helper stok, atau tabel master.

## Alur UI
- State: `draft` → `preview` → `saving` → (`done` | `error` kembali ke `draft`).
- `CentralStockDialogs` mode `distribute` menjadi dua langkah; mode `request` dan `approve` tidak berubah.
- Props baru `onReload`: callback halaman untuk memuat ulang daftar item tanpa menutup dialog; `onDone` tetap dipakai hanya saat sukses.
- Daftar yang bisa dipilih hanya `!is_serialized`. Jika pengguna perlu mendistribusikan unit serialized, tutup dialog dan pakai tombol Distribusi lama.

## Layout & validasi
- Popup `max-w-2xl`, `max-h-[90vh]`, flex kolom: header tetap, area isi `overflow-y-auto`, footer tombol selalu terlihat.
- Atas: select cabang tujuan (seperti sekarang).
- Tengah: select item non-serial + tombol "Tambah". SKU yang sudah ada di daftar ditolak dengan toast; pengguna mengedit qty pada baris yang sudah ada.
- Tabel: kolom `Nama item` (nama + SKU), `Stok gudang`, `Qty` (input number inline `inputMode="numeric"`, min 1, maks stok), dan tombol hapus baris. Wrapper `overflow-x-auto` dengan lebar minimum agar kolom tetap terbaca di mobile; scroll hanya di dalam dialog.
- Ringkasan live: jumlah item dan total unit. Tombol **Lanjut ke Preview** disabled sampai minimal satu baris valid.
- Preview: cabang tujuan + tabel ringkas (nama, stok sebelum → sesudah, qty), tombol **Kembali** dan **Konfirmasi**. Tidak ada edit inline di preview. Saat `saving`, tombol dinonaktifkan untuk mencegah dobel submit.

## Error handling
- Pesan RPC menyertakan SKU baris yang gagal, mis. `Baterai iPhone 12: stok berubah oleh transaksi lain`.
- Server action meneruskan pesan apa adanya; UI menampilkan toast error, tetap di `draft`, mempertahankan baris, lalu memanggil `onReload()` supaya angka stok tidak basi.
- Karena `expected_stock` per baris diambil dari snapshot preview dan seluruh batch satu transaksi, kegagalan satu baris tidak meninggalkan stok cabang yang setengah jadi.
- Validasi berlapis: UI → server action → RPC (role + stok). Tidak bergantung pada UI saja.

## Testing
- Migration test (string-assertion, pola repo): signature `distribute_central_items_batch`, cek MASTER_ADMIN, pemanggilan `distribute_central_stock` per baris, ACL revoke/grant, dan tidak ada definisi overload baru.
- Action test: meneruskan array item + `expected_stock`, menolak array kosong/qty ≤ 0, meneruskan error RPC, `revalidatePath` dipanggil sekali.
- UI test (`central-ui.test.ts`, string-assertion): state preview, tombol Kembali/Konfirmasi, kolom tabel, `overflow-x-auto`, filter `!is_serialized`, dan tombol disabled sebelum ada baris valid.

## Out of scope
- Batch untuk request/approve, batch unit serialized/IMEI, perubahan ledger/helper stok, dan dependency baru.
- Batas jumlah baris batch tidak ditambahkan di spec ini; batas delta ±1000 per item masih diwariskan dari helper lama.

## Risiko yang diketahui
- Stok yang tampil di tabel bisa berubah antara preview dan submit; diminimalisir dengan `expected_stock` + rollback penuh + reload saat gagal.
- Tabel di dalam dialog berisiko melebar di mobile; diminimalisir dengan wrapper `overflow-x-auto` dan footer yang tidak ikut scroll.
- Jumlah baris besar berarti banyak pemanggilan helper dalam satu transaksi; tidak ada load target untuk fitur ini.
