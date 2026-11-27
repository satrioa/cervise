-- Jalankan sekali, di luar jam operasional. Snapshot tabel sebelum deploy.
-- shortcut: migrasi hanya dijalankan sekali pada snapshot bersih; jika perlu re-run, tambahkan penanda migrasi — upgrade saat ada kebutuhan re-run.
begin;

-- Baris ledger sisi-pusat hanya punya central_item_id.
alter table public.cervise_stock_movements
  drop constraint if exists cervise_stock_movements_owner_check;
alter table public.cervise_stock_movements
  add constraint cervise_stock_movements_owner_check
  check (product_id is not null or sparepart_id is not null or central_item_id is not null);

-- Sparepart: satu baris pusat per (org, sku), stok = total semua cabang.
insert into public.cervise_central_items (
  organization_id, kind, sku, name, category, cost, price, is_active, stock_qty
)
select organization_id, 'SPAREPART', sku,
       (array_agg(name order by created_at, id))[1],
       (array_agg(category order by created_at, id))[1],
       (array_agg(cost order by created_at, id))[1],
       (array_agg(price order by created_at, id))[1],
       true,
       sum(stock_qty)::integer
from public.cervise_spareparts
group by organization_id, sku
on conflict do nothing;

-- Produk non-serial: pola sama.
insert into public.cervise_central_items (
  organization_id, kind, sku, name, category, cost, price, is_active,
  barcode, variant_type, storage, warna, bh_percent, kondisi_notes, garansi_days, parent_key, stock_qty
)
select organization_id, 'PRODUCT', sku,
       (array_agg(name order by created_at, id))[1],
       (array_agg(category order by created_at, id))[1],
       (array_agg(cost order by created_at, id))[1],
       (array_agg(price order by created_at, id))[1],
       true,
       (array_agg(barcode order by created_at, id))[1],
       (array_agg(variant_type order by created_at, id))[1],
       (array_agg(storage order by created_at, id))[1],
       (array_agg(warna order by created_at, id))[1],
       (array_agg(bh_percent order by created_at, id))[1],
       (array_agg(kondisi_notes order by created_at, id))[1],
       (array_agg(garansi_days order by created_at, id))[1],
       (array_agg(parent_key order by created_at, id))[1],
       sum(stock_qty)::integer
from public.cervise_products
where not is_serialized
group by organization_id, sku
on conflict do nothing;

-- Produk serialized: satu baris pusat per IMEI (bukan per SKU).
insert into public.cervise_central_items (
  organization_id, kind, sku, name, category, cost, price, is_active, is_serialized, imei,
  variant_type, storage, warna, bh_percent, kondisi_notes, garansi_days, parent_key, stock_qty
)
select organization_id, 'PRODUCT', sku, name, category, cost, price, true, true, imei,
       variant_type, storage, warna, bh_percent, kondisi_notes, garansi_days, parent_key, 1
from public.cervise_products
where is_serialized and imei is not null and stock_qty > 0
on conflict (organization_id, imei) where is_serialized and imei is not null do nothing;

-- Snapshot SEBELUM stok cabang di-set 0: kalau tidak, qty ledger jadi nol.
create temp table central_migrate_sparepart as
select s.id as row_id, s.branch_id, c.id as central_item_id, s.stock_qty as qty
from public.cervise_spareparts s
join public.cervise_central_items c
  on c.organization_id = s.organization_id and c.kind = 'SPAREPART' and c.sku = s.sku
where s.stock_qty <> 0;

create temp table central_migrate_product as
select p.id as row_id, p.branch_id, c.id as central_item_id, p.stock_qty as qty
from public.cervise_products p
join public.cervise_central_items c
  on c.organization_id = p.organization_id and c.kind = 'PRODUCT'
  and ((not p.is_serialized and c.sku = p.sku and not c.is_serialized)
       or (p.is_serialized and c.imei = p.imei))
where p.stock_qty <> 0;

-- Ledger: dua baris return_to_central per baris stok lama (cabang -, pusat +).
insert into public.cervise_stock_movements (
  branch_id, sparepart_id, central_item_id, qty_delta, reason, is_central_side, actor_id
)
select branch_id, row_id, central_item_id, -qty, 'return_to_central', false, null
from central_migrate_sparepart;

insert into public.cervise_stock_movements (
  branch_id, product_id, central_item_id, qty_delta, reason, is_central_side, actor_id
)
select branch_id, row_id, central_item_id, -qty, 'return_to_central', false, null
from central_migrate_product;

insert into public.cervise_stock_movements (
  branch_id, central_item_id, qty_delta, reason, is_central_side, actor_id
)
select branch_id, central_item_id, qty, 'return_to_central', true, null
from central_migrate_sparepart;

insert into public.cervise_stock_movements (
  branch_id, central_item_id, qty_delta, reason, is_central_side, actor_id
)
select branch_id, central_item_id, qty, 'return_to_central', true, null
from central_migrate_product;

-- Baru setelah ledger tercatat, stok cabang di-set 0 dan ditautkan ke pusat.
update public.cervise_spareparts
set stock_qty = 0,
    central_item_id = c.id,
    updated_at = now()
from public.cervise_central_items c
where c.organization_id = cervise_spareparts.organization_id
  and c.kind = 'SPAREPART'
  and c.sku = cervise_spareparts.sku;

update public.cervise_products
set stock_qty = 0,
    central_item_id = c.id,
    updated_at = now()
from public.cervise_central_items c
where c.organization_id = cervise_products.organization_id
  and c.kind = 'PRODUCT'
  and ((not cervise_products.is_serialized and c.sku = cervise_products.sku and not c.is_serialized)
       or (cervise_products.is_serialized and c.imei = cervise_products.imei));

commit;
