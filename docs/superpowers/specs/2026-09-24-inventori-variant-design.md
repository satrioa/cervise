# Inventori Product Variant Design — Baru (Warna+Storage) & Bekas (IMEI)

**Date:** 2026-09-24  
**Status:** Draft → Approved (user approve 2026-09-24)  
**Scope:** Single spec for Inventori CRUD + Product list grouped variant (Baru vs Bekas per IMEI), POS integration.  
**Decisions:** Opsi A — single table `cervise_products` + `variant_type` (user chose A).

## 1. Overview

Inventori saat ini (`cervise_products`, `stock_qty` agregat, `is_serialized`) dan Sparepart (`inventory_items`) terpisah. Penjualan POS sudah handle `is_serialized` wajib IMEI 15 digit qty 1, tapi belum bedakan **Baru** (varian warna+storage, stok agregat) vs **Bekas** (varian per IMEI, tiap unit BH%/kondisi/garansi beda).

Goal: Tetap **1 Product list** (group by `parent_key` = slug `name`), di dalamnya 2 grup variant:
- **Baru:** `warna + storage` → stok agregat, tanpa IMEI.
- **Bekas:** `IMEI + storage + warna + BH% + kondisi + garansi` → stok 0/1 per IMEI, harga per unit bisa beda.

Tetap pakai `cervise_products` existing, tambah kolom nullable, validasi di app layer. POS kurangi stok sesuai tipe varian.

## 2. Data Model

### 2.1 Migration — tambah kolom ke `cervise_products` (existing columns: id, branch_id, sku, barcode, name, category, stock_qty, cost, price, is_serialized, is_active)
```sql
alter table cervise_products add column if not exists variant_type text check (variant_type in ('BARU','BEKAS')) default 'BARU';
alter table cervise_products add column if not exists storage text; -- "64 GB", "128 GB"
alter table cervise_products add column if not exists warna text; -- "Black"
alter table cervise_products add column if not exists bh_percent int check (bh_percent between 0 and 100);
alter table cervise_products add column if not exists kondisi_notes text;
alter table cervise_products add column if not exists garansi_days int check (garansi_days > 0);
alter table cervise_products add column if not exists imei text;
alter table cervise_products add column if not exists parent_key text; -- lower slug(name) e.g. "iphone-14-pro"
create unique index if not exists uq_products_branch_imei on cervise_products(branch_id, imei) where imei is not null;
create index if not exists idx_products_parent on cervise_products(branch_id, parent_key);
create index if not exists idx_products_variant on cervise_products(branch_id, variant_type);
```

- **Baru:** `variant_type='BARU'`, `is_serialized=false`, `imei=null`, `bh_percent=null`, `stock_qty` = agregat, `sku` auto `IP14P-B-64-BK` (prefix + B + storage + warna initial), `storage/warna` wajib, `garansi_days` null (garansi ikut global 90 hari atau per varian jika perlu).
- **Bekas:** `variant_type='BEKAS'`, `is_serialized=true`, `stock_qty` 0/1 (1=Tersedia, 0=Terjual/is_active=false), `imei` wajib 15 digit unique per branch, `storage/warna/bh_percent` wajib, `kondisi_notes` optional, `garansi_days` nullable (isi jika switch ON), `sku` auto `IP14P-BK-64-35693803` (suffix 8 digit IMEI), `cost/price` per unit.

Backfill: `update cervise_products set variant_type='BARU', parent_key=lower(regexp_replace(name,'[^a-z0-9]+','-','g')) where variant_type is null;`

### 2.2 Validation (app layer `src/app/app/penjualan/actions.ts` & `src/app/app/sparepart/actions.ts` future)
- Baru: `warna` 2-20 char, `storage` in [64,128,256,512] GB, `stock_qty >=0`, `cost/price >=0`, `imei is null`, `bh null`.
- Bekas: `imei ~ ^\d{15}$`, unique, `bh 0-100`, `storage/warna` wajib, `stock_qty 0/1`, `garansi_days >0` jika switch ON else null.

## 3. Product List UI (Grouped)

**Query:** `select * from cervise_products where branch_id=? and is_active=true order by parent_key, variant_type, storage` → group in-memory by `parent_key`.

**Card induk** `iPhone 14 Pro` header: `SKU induk`, `Kategori`, `Total stok 14 (Baru 11 + Bekas 3)` badge, `Total varian 4`.

```
CardFrame iPhone 14 Pro
├─ Baru — Varian warna & storage (stok agregat) [grid 2 col]
│  ├─ 64 GB • Black — SKU IP14P-B-64-BK — Stok 8 — Rp 15.5jt → 17.9jt — Tersedia
│  └─ 128 GB • Silver — SKU IP14P-B-128-SI — Stok 3 — Rp 17jt → 19.5jt — Menipis
│  // stok agregat dikurangi per qty
└─ Bekas — Varian per IMEI (stok 1 per unit) [list]
   ├─ 35693803 • 64 GB Black BH80% — Kondisi: lecet halus — Rp 9.5jt → 11.2jt — Garansi 30hr — Tersedia
   └─ 35693804 • 128 GB Gold BH88% — Mulus — Rp 11jt → 12.8jt — Terjual (opacity 50)
```

**Filter toolbar** (reuse `InventoryToolbar`): `Tipe: Semua/Baru/Bekas` + `Kategori + Stok + Sort harga/stok + Search (nama/sku/IMEI)` + `Sort BH` untuk Bekas. `w-full` search, `gap-1.5`, `py-2` fit-content.

**Empty:** `Empty` with `PackageIcon` if no product.

## 4. CRUD Forms

**Entry:** `Button Tambah Produk` → `JellyRadio Tipe: Baru | Bekas` (size sm).

**Form Baru (5 field + auto SKU):**
- `Nama produk*` (Autocomplete existing name → reuse parent_key, else create new parent)
- `Warna*` (Input, e.g. Black), `Storage*` (Select 64/128/256/512 GB), `Stok qty*` (number min 0), `Harga Modal*`, `Harga Jual*`
- Submit → `sku = genSkuBaru(name, storage, warna)` → `insert variant_type BARU`.

**Form Bekas (8 field):**
- `Nama produk*` (same autocomplete), `IMEI*` (15 digit, `inputMode numeric`, validasi unique), `Storage*`, `Warna*`, `BH%*` (Slider 0-100 or Input number), `Harga Modal*`, `Harga Jual*`, `Kondisi fisik notes` (Textarea optional), `Garansi [Switch OFF/ON → jika ON Input durasi hari* number >0]`
- `sku` auto `genSkuBekas(name, storage, imei suffix)`, `stock_qty=1`, `is_serialized=true`.

**Edit:** same form prefilled, `imei` readOnly jika Bekas (unique), `stock_qty` editable for Baru only.

**Delete:** `Bekas` Terjual (`stock_qty 0`) boleh hapus (archive `is_active=false`); `Baru` hapus jika `stock_qty 0` and no sales_items referencing. Confirm dialog.

**Validation messages** inline, `haptic(30)` on apply, `toast` on success.

## 5. POS Integration

- **Grid/List** product feed now flat list of **variants** (tiap varian = card). Badge `Baru/Bekas` + `BH80%` untuk Bekas.
- **Tambah ke keranjang:**
  - Baru: cek `stock_qty >= qty`, `qty` bisa >1, `is_serialized false`.
  - Bekas: `qty` paksa 1, cek `stock_qty 1`, pilih row IMEI spesifik, add to cart with `imei` snapshot.
- **Checkout `createSale`:** loop items → for Baru `update stock_qty = stock_qty - qty`; for Bekas `update stock_qty 1→0, is_active=false` + set `is_serialized` check IMEI duplicate. `discount_total` / promo stack tetap (subtotal dari `unit_price` per varian).
- **Item list cart:** Bekas row tampil `IMEI + BH + Garansi` chips.

## 6. Error Handling

- Duplikat IMEI (unique index) → catch `23505` → toast `IMEI sudah ada di cabang ini`.
- Stok Baru habis → `Tambah` disabled, toast `Melebihi stok`.
- Bekas Terjual → card `opacity-50`, `Tambah` disabled, tooltip `Terjual`.
- Garansi switch ON tapi durasi kosong → `Garansi wajib >0`.
- BH out of range → `BH 0-100`.

## 7. Testing

- **Unit:** `variant_type` validation, `imei` 15 digit, `bh` range, `sku` gen.
- **Integration:** Create Baru Black 64 stok 5 → POS jual 2 → stok 3. Create Bekas IMEI 3569 BH80 → POS jual 1 → stok 0 Terjual, tidak bisa jual lagi. Edit Baru stok, delete Bekas Terjual.
- **E2E:** Search `35693803` finds Bekas row, filter `Tipe Bekas` shows only Bekas, filter `Baru` hides Bekas.

## 8. Out of Scope

- Foto per unit Bekas (future: `product_images` table).
- Grade A/B/C auto dari BH (future).
- Import bulk IMEI CSV (future).

## 9. File Impact (est.)

- Migration: `supabase/migrations/xxxx_add_variant_to_products.sql`
- `src/app/app/penjualan/actions.ts` — add variant handling in `searchProductsForSale`, `createProduct`, `createSale` stock logic.
- `src/components/penjualan/penjualan-product-grid.tsx` — variant badge + BH.
- `src/app/app/sparepart/page.tsx` / `src/components/sparepart/*` — new `ProductVariantDialog` or reuse `SparepartForm` forked to `ProductForm` with Baru/Bekas toggle.
- `src/app/app/penjualan/penjualan-pos-client.tsx` — POS add to cart variant check.

---
Approved by user: 2026-09-24 — next step: `writing-plans` skill.
