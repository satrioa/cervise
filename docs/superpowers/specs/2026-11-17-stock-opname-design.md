# Stock Opname — Design Spec

**Date:** 2026-11-17
**Status:** Approved by user (decisions 1–6)

## Goal
Fitur Stock Opname (hitung stok fisik) untuk **Produk/Inventori** dan **Sparepart**, dengan sesi terpisah per domain, snapshot baseline, review selisih, posting penyesuaian teraudit, riwayat, dan ekspor XLSX.

## Keputusan yang disetujui
1. **Model B — sesi terpisah per domain** (Produk dan Sparepart punya sesi masing-masing).
2. **Route** `/app/inventori/opname` dengan tab **Produk | Sparepart**; diakses dari header Inventori.
3. **Role:** Admin / Master Admin **boleh membuat, menghitung, dan memposting**. Frontliner & Teknisi **boleh menghitung draft**, tetapi **tidak boleh memposting** (dicegat di server action dan RPC).
4. **BEKAS dengan IMEI:** dihitung **per unit/IMEI** (rekomendasi). BARU dan Sparepart dihitung per `stock_qty`. Alasan: tiap unit BEKAS punya IMEI, kondisi (BH%), dan garansi unik; agregat qty menghilangkan telusur dan membuat selisih tidak bermakna.
5. **Ekspor XLSX** (summary + baris) memakai dependency `xlsx` yang sudah ada. **Tanpa foto bukti per baris.** Tidak menambah dependency baru.
6. **UI:** shadcn sebagai dasar + coss sebagai aksentuasi (`@coss/number-field`, `@coss/drawer`, `@coss/progress`). Sonner tetap dipakai untuk toast (jangan campur dengan coss `toastManager`).

## Alur
1. **Buat sesi** — domain (Produk/Sparepart), filter kategori opsional, catatan. Status `DRAFT`. Snapshot `stock_qty` sistem saat sesi dibuat.
2. **Hitung** — mobile-first: qty sistem, qty fisik (NumberField), badge selisih, scan barcode/IMEI (`BarcodeScannerDialog`), filter *belum dihitung / ada selisih / semua*, progress, auto-save draft.
3. **Tinjau** — ringkasan (total, terhitung, cocok, surplus, shortage, nilai selisih basis cost), tabel sortable, `Alert` untuk shortage, `AlertDialog` konfirmasi.
4. **Posting** — satu RPC atomik: lock sesi, untuk tiap baris dengan `delta ≠ 0` panggil `apply_stock_delta(..., 'stock_adjust', p_notes = 'opname:<session>:<line>')`, status `POSTED`, locked.
5. **Riwayat** — daftar sesi + detail + tautan ke `cervise_stock_movements`.

## Data
- Baru `cervise_stock_opname_sessions`: `id, organization_id, branch_id, domain, status, note, created_by, started_at, posted_at, posted_by`.
- Baru `cervise_stock_opname_lines`: `id, session_id, ref_id, sku, name, imei, snapshot_qty, counted_qty, notes, counted_by, counted_at`.
- Memakai ulang `cervise_stock_movements` (reason `stock_adjust`) — **tidak ada tabel movement baru**.
- Perlu `p_notes` opsional di `apply_stock_delta` / `adjust_product_stock` supaya movement bisa ditandai sesi (backward compatible lewat default param).
- RLS branch-scoped seperti tabel lain; RPC `post_stock_opname(p_session_id)` `security definer` + cek role/branch.

## Aturan UI/UX (dari skill)
- Mobile-first, target sentuh ≥44px, `inputMode="numeric"`, sticky footer dengan safe-area, **tanpa horizontal scroll**, virtualisasi >50 baris.
- `FieldGroup`+`Field` untuk form, `ToggleGroup` untuk filter, `Table` + `aria-sort` + `tabular-nums` desktop, `Badge` + ikon/teks untuk selisih (warna bukan satu-satunya penanda).
- `Empty`/`Skeleton` untuk empty/loading, `AlertDialog` untuk post/discard, `sonner` untuk feedback.
- Auto-save draft + indikator, error dekat field + recovery, `aria-live` untuk progress.
- Token semantik (light/dark), konsisten di style world **minimal / scifi / toy**, reduced-motion dihormati.

## Skenario yang harus dijaga
- Sesi DRAFT tidak boleh diposting dua kali (lock + status check).
- Konkurensi: `p_expected_stock` menolak penyesuaian jika stok berubah sejak snapshot.
- Role: frontliner/teknisi tidak bisa posting walau RPC database mengizinkan.
- BEKAS: unit IMEI tidak terhitung → delta −1 per unit; unit baru yang tidak ada di snapshot → delta +1.
- Ekspor tetap berfungsi saat sesi masih DRAFT maupun POSTED.

## Out of scope
- Foto bukti per baris, dependency baru, tabel movement baru, perubahan role di RPC `adjust_product_stock`.
