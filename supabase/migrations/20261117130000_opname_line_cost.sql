-- Biaya satuan dibekukan bersama snapshot supaya ringkasan nilai selisih
-- tidak bergeser saat harga produk berubah setelah sesi dibuat.
alter table public.cervise_stock_opname_lines
  add column if not exists unit_cost integer not null default 0;
