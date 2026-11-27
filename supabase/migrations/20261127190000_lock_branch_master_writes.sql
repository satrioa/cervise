-- Semua pembuatan item lewat RPC pusat; baris cabang hanya stok.
revoke all on public.cervise_spareparts from authenticated;
grant select on public.cervise_spareparts to authenticated;

revoke all on public.cervise_products from authenticated;
grant select on public.cervise_products to authenticated;
grant update (barcode, variant_type, storage, warna, bh_percent, kondisi_notes, garansi_days, imei, parent_key, is_serialized)
  on public.cervise_products to authenticated;

drop policy if exists cervise_spareparts_insert on public.cervise_spareparts;
drop policy if exists cervise_products_insert on public.cervise_products;
