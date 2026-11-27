# Gudang Pusat Inventori — Design Spec

**Date:** 2026-11-27
**Status:** Approved by user (keputusan 1–8; desain bagian 1–3)

## Goal
Item inventori/sparepart menjadi **master data tenant** yang disimpan di satu gudang pusat. Master admin mengisi stok pusat lalu mendistribusikannya ke cabang; cabang tidak membuat item baru, hanya melihat daftar item pusat dengan stoknya masing-masing dan mengajukan request stok yang perlu persetujuan master admin.

## Keputusan yang disetujui
1. **Stok pusat nyata** (bukan katalog tanpa stok, bukan sekadar memakai cabang pertama sebagai gudang). Stok pusat berkurang saat barang didistribusikan.
2. **Cakupan: sparepart + produk/inventori**, termasuk unit bekas/serialized (IMEI). Produk tidak lagi ditunda.
3. **Cabang tidak bisa membuat item baru.** ADMIN/FRONTLINER cabang hanya bisa mengajukan request stok ke gudang pusat.
4. **Request perlu persetujuan master admin.** Bisa ditolak dengan alasan; approve sebagian (partial) diperbolehkan dan qty final tercatat.
5. **Migrasi C:** seluruh stok cabang ditarik ke pusat, cabang menjadi 0, lalu master admin mendistribusikan ulang. Dilakukan sekaligus dalam satu transaksi + snapshot, di luar jam operasional.
6. **Modal & harga jual jadi master data tenant**, sama untuk semua cabang (tanpa override per cabang).
7. **Pendekatan 1:** tabel master pusat baru; tabel cabang yang ada tetap dipakai sebagai baris stok saja.
8. **UI satu halaman** `/app/sparepart` dengan toggle scope **Gudang Pusat / Cabang**, bukan halaman/route baru.

## Model data
- **`cervise_central_items`** (baru, tenant-scoped): `id, organization_id, kind (SPAREPART|PRODUCT), sku, name, category, cost, price, is_active, is_serialized, imei, variant_type, storage, warna, bh_percent, kondisi_notes, garansi_days, parent_key, stock_qty, created_at, updated_at`. Satu baris per SKU untuk sparepart/produk non-serial; **satu baris per unit IMEI** untuk produk serialized. Unique `(organization_id, kind, sku)` untuk item non-serial; untuk produk serialized uniqueness memakai `(organization_id, imei)` (SKU boleh sama antar unit dari model yang sama). Hanya master admin yang boleh menulis.
- **`cervise_spareparts` & `cervise_products`** tetap ada sebagai **baris stok cabang**, ditambah `central_item_id uuid references cervise_central_items(id)`. `stock_qty` kini berarti stok cabang. Kolom nama/SKU/harga jadi salinan dari master yang disinkronkan agar POS & servis tetap membaca seperti sekarang; klien cabang tidak mendapat grant update untuk kolom tersebut.
- **`cervise_stock_movements`** ditambah `central_item_id`. Alasan baru: `central_purchase` (barang masuk pusat), `distribute` (push pusat → cabang), `request_in` (approve request), `return_to_central`. Setiap perpindahan menulis **dua baris ledger dalam satu transaksi** (pusat berkurang, cabang bertambah), mengikuti pola `transfer_sparepart_stock` yang sudah ada. Movement lama tidak diubah.
- **`cervise_stock_requests`** (baru): `id, organization_id, branch_id, central_item_id, qty, decided_qty, status (PENDING|APPROVED|REJECTED), note, rejection_reason, requested_by, decided_by, created_at, decided_at`. Untuk serialized, request berbasis SKU/`parent_key`; master admin memilih unit IMEI tertentu saat approve.

## Alur
1. **Master admin tambah item** → masuk `cervise_central_items` dengan stok pusat. Pembelian/stok awal memakai `central_purchase` (bukan langsung menambah baris cabang seperti `createSparepart`/`purchase_sparepart_stock` sekarang).
2. **Master admin distribusi** → pilih item, cabang tujuan, qty (atau unit IMEI untuk serialized) → stok pusat turun, baris stok cabang dibuat/ditambah, dua baris ledger `distribute`. Satu transaksi; stok pusat tidak boleh minus.
3. **Cabang request** → ADMIN/FRONTLINER membuat `cervise_stock_requests`. **Belum ada stok yang berubah.**
4. **Master admin approve/tolak** → approve = stok pusat turun & stok cabang naik (boleh partial; `decided_qty` tercatat), tolak = status `REJECTED` + alasan, stok tidak berubah.
5. **Pemakaian di cabang** (servis & POS) tetap membaca/memotong baris stok cabang; ledger `service_use`/`sale` tidak diubah.
6. **Tarik kembali ke pusat** → `return_to_central`, kebalikan distribusi, untuk stok cabang yang belum terpakai.

## Akses & RLS (ditegakkan di database, bukan hanya UI)
- Tulis `cervise_central_items`, distribusi, approve/reject request: **MASTER_ADMIN** (atau platform admin).
- Buat request: **ADMIN/FRONTLINER** cabang. Lihat daftar item: semua anggota cabang. **TECHNICIAN** hanya select.
- Cabang melihat **semua item dari pusat** tetapi hanya `stock_qty` cabangnya sendiri; angka stok pusat tidak ditampilkan ke cabang.
- Kolom master (`sku`, `name`, `category`, `cost`, `price`, atribut variant) tidak di-grant untuk klien cabang; perubahan hanya lewat master admin lalu disinkronkan ke baris cabang.
- Semua RPC penulisan stok `security definer` + cek role + `expected_stock` seperti pola yang ada.

## Migrasi
- Snapshot/backup `cervise_spareparts` & `cervise_products` lebih dulu; jalankan migrasi satu transaksi di luar jam operasional.
- Tiap SKU/IMEI yang ada dibuatkan baris `cervise_central_items`; `stock_qty` = total stok semua cabang. Modal/harga diambil dari baris **tertua** (`created_at` terawal) supaya deterministik.
- Stok cabang di-set 0 **lewat ledger** (dua baris `return_to_central`: cabang berkurang, pusat bertambah), bukan update diam-diam. Riwayat ledger lama dipertahankan utuh.
- Setelah migrasi semua cabang berstok 0 sampai master admin selesai distribusi.

## UI — `/app/sparepart` satu halaman
- **Master admin:** toggle scope **Gudang Pusat / Cabang**. Scope Pusat → daftar item + stok pusat, tombol Tambah item, Beli stok, Distribusi, tab Request (approve/tolak/partial). Scope Cabang → stok cabang + distribusi antar cabang.
- **ADMIN/FRONTLINER:** daftar item dari pusat + stok cabang sendiri, tombol **Request stok**; tidak ada tombol Tambah item.
- **TECHNICIAN:** lihat saja.
- Daftar cabang selalu menampilkan item pusat ("mengikuti gudang") dengan stok masing-masing.

## Error handling
- Stok pusat tidak cukup → transaksi ditolak penuh, tanpa perubahan sebagian.
- Request `PENDING` ganda untuk item yang sama → ditolak.
- Approve konkuren memakai `expected_stock` (pola RPC lama): jika stok berubah sejak dibaca, minta muat ulang.
- Serialized: unit IMEI yang sudah didistribusikan tidak bisa dipilih lagi; gagal → pilih unit lain, ledger tetap konsisten.
- Kegagalan tulis ledger menggagalkan seluruh transaksi (rollback).

## Testing
- **Migrasi:** total stok sebelum/sesudah harus sama; ledger lama tetap terbaca; semua baris cabang tertaut `central_item_id`.
- **RPC:** distribusi, approve/reject/partial request, stok pusat tidak cukup, pindah unit IMEI, rollback saat ledger gagal, tarik kembali ke pusat.
- **RLS:** cabang tidak bisa insert `cervise_central_items` atau edit harga; technician hanya select; request hanya untuk cabang sendiri.
- **UI:** scope toggle, daftar item pusat tampil di cabang dengan stok cabang, tombol request tidak tampil untuk technician.

## Skenario yang harus dijaga
- Serialized: tiap IMEI adalah satu unit, bukan angka agregat; perpindahan unit bersifat atomik.
- Konkurensi distribusi vs approve vs pemakaian cabang memakai `expected_stock`.
- Semua perpindahan punya pasangan baris ledger dengan `central_item_id`.
- Produk hasil opname cabang tetap memakai `stock_adjust` di cabang, **tidak** memotong stok pusat (disebutkan eksplisit sebagai celah yang disengaja, tidak diperbaiki di spec ini).

## Out of scope
- Halaman/route baru, override harga per cabang, edisi item langsung dari cabang.
- Perubahan alur POS/servis di cabang selain sumber stok yang kini berasal dari distribusi pusat.
- Penyesuaian celah opname cabang terhadap stok pusat.
- Dependency baru.
