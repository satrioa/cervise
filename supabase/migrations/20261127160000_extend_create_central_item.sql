-- Hapus overload lama: named-arg caller tidak bisa membedakan dua signature.
drop function if exists public.create_central_item(uuid, text, text, text, text, integer, integer, integer, boolean, text, text);
-- Signature tunggal dengan default pada tujuh argumen baru melayani semua caller.
create or replace function public.create_central_item(
  p_organization_id uuid, p_kind text, p_sku text, p_name text, p_category text,
  p_cost integer, p_price integer, p_stock_qty integer default 0,
  p_is_serialized boolean default false, p_imei text default null, p_parent_key text default null,
  p_barcode text default null, p_variant_type text default 'BARU', p_storage text default null,
  p_warna text default null, p_bh_percent integer default null, p_kondisi_notes text default null,
  p_garansi_days integer default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_branch uuid;
begin
  if not (public.is_platform_admin() or public.has_tenant_role(p_organization_id, array['MASTER_ADMIN'::text])) then
    raise exception 'hanya master admin yang boleh membuat item';
  end if;
  if p_kind not in ('SPAREPART','PRODUCT') then raise exception 'jenis item tidak valid'; end if;
  if p_stock_qty < 0 then raise exception 'stok awal tidak boleh negatif'; end if;
  if p_is_serialized and p_imei is null then raise exception 'IMEI wajib untuk unit serialized'; end if;
  if p_is_serialized and p_stock_qty > 1 then raise exception 'unit serialized hanya boleh satu stok'; end if;
  if p_variant_type not in ('BARU','BEKAS') then raise exception 'jenis varian tidak valid'; end if;
  insert into public.cervise_central_items (
    organization_id, kind, sku, name, category, cost, price, stock_qty, is_serialized, imei, parent_key,
    barcode, variant_type, storage, warna, bh_percent, kondisi_notes, garansi_days
  ) values (
    p_organization_id, p_kind, trim(p_sku), trim(p_name), p_category, p_cost, p_price,
    0, p_is_serialized, p_imei, p_parent_key,
    p_barcode, p_variant_type, p_storage, p_warna, p_bh_percent, p_kondisi_notes, p_garansi_days
  ) returning id into v_id;
  if p_stock_qty > 0 then
    v_branch := public.central_ledger_branch(p_organization_id);
    perform public.apply_central_stock_delta(v_id, p_stock_qty, null, 'central_purchase', v_branch, null);
  end if;
  return v_id;
end;
$$;
revoke all on function public.create_central_item(uuid, text, text, text, text, integer, integer, integer, boolean, text, text, text, text, text, text, integer, text, integer) from public, anon;
grant execute on function public.create_central_item(uuid, text, text, text, text, integer, integer, integer, boolean, text, text, text, text, text, text, integer, text, integer) to authenticated;
