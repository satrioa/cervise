-- Ambang pengingat stok habis diatur per sparepart.
-- Baris lama otomatis dapat nilai 5, sehingga tidak ada peringatan yang
-- mendadak hilang atau muncul setelah migrasi.
alter table public.cervise_spareparts
  add column if not exists low_stock_threshold integer not null default 5;

alter table public.cervise_spareparts
  drop constraint if exists cervise_spareparts_low_stock_threshold_check;

alter table public.cervise_spareparts
  add constraint cervise_spareparts_low_stock_threshold_check
  check (low_stock_threshold >= 0);
