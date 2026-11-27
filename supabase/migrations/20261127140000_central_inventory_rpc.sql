-- RPC gudang pusat. Dua helper stok lama disalin utuh, hanya whitelist alasan
-- yang diperluas supaya ledger pusat bisa memakai alasan baru.
create or replace function public.apply_stock_delta(
  p_product_id uuid,
  p_delta integer,
  p_expected_stock integer default null,
  p_reason text default 'stock_adjust',
  p_servis_id uuid default null,
  p_sale_id uuid default null,
  p_notes text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product public.cervise_products%rowtype;
  v_next integer;
begin
  if p_delta is null or p_delta = 0 then
    raise exception 'delta stok tidak boleh nol';
  end if;
  if p_delta > 1000 or p_delta < -1000 then
    raise exception 'delta stok di luar batas';
  end if;
  if p_reason not in ('service_use','service_return','sale','sale_return','stock_adjust','purchase','transfer_in','transfer_out','central_purchase','distribute','request_in','return_to_central') then
    raise exception 'alasan perubahan stok tidak valid';
  end if;

  select * into v_product
  from public.cervise_products
  where id = p_product_id
  for update;

  if not found then
    raise exception 'produk tidak ditemukan';
  end if;

  if p_expected_stock is not null and p_expected_stock <> v_product.stock_qty then
    raise exception 'stok berubah oleh transaksi lain, muat ulang';
  end if;

  v_next := v_product.stock_qty + p_delta;
  if v_next < 0 then
    raise exception 'stok tidak cukup';
  end if;

  update public.cervise_products
  set stock_qty = v_next, updated_at = now()
  where id = p_product_id;

  insert into public.cervise_stock_movements (
    branch_id, product_id, qty_delta, reason, servis_id, sale_id, actor_id, notes
  ) values (
    v_product.branch_id, p_product_id, p_delta, p_reason, p_servis_id, p_sale_id, auth.uid(), p_notes
  );

  return v_next;
end;
$$;

-- Pakai signature 6 argumen yang aktif (bukan versi 5 argumen yang sudah
-- di-drop): kalau tidak, overload ganda bikin panggilan 5 argumen ambigu.
create or replace function public.apply_sparepart_stock_delta(
  p_sparepart_id uuid,
  p_delta integer,
  p_expected_stock integer default null,
  p_reason text default 'stock_adjust',
  p_servis_id uuid default null,
  p_notes text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_part public.cervise_spareparts%rowtype;
  v_next integer;
begin
  if p_delta is null or p_delta = 0 then
    raise exception 'delta stok tidak boleh nol';
  end if;
  if p_delta > 1000 or p_delta < -1000 then
    raise exception 'delta stok di luar batas';
  end if;
  if p_reason not in ('service_use','service_return','sale','sale_return','stock_adjust','purchase','transfer_in','transfer_out','central_purchase','distribute','request_in','return_to_central') then
    raise exception 'alasan perubahan stok tidak valid';
  end if;

  select * into v_part
  from public.cervise_spareparts
  where id = p_sparepart_id
  for update;

  if not found then
    raise exception 'sparepart tidak ditemukan';
  end if;

  if p_expected_stock is not null and p_expected_stock <> v_part.stock_qty then
    raise exception 'stok berubah oleh transaksi lain, muat ulang';
  end if;

  v_next := v_part.stock_qty + p_delta;
  if v_next < 0 then
    raise exception 'stok tidak cukup';
  end if;

  update public.cervise_spareparts
  set stock_qty = v_next, updated_at = now()
  where id = p_sparepart_id;

  insert into public.cervise_stock_movements (
    branch_id, sparepart_id, qty_delta, reason, servis_id, actor_id, notes
  ) values (
    v_part.branch_id, p_sparepart_id, p_delta, p_reason, p_servis_id, auth.uid(), p_notes
  );

  return v_next;
end;
$$;
revoke all on function public.apply_sparepart_stock_delta(uuid, integer, integer, text, uuid, text) from public;
revoke all on function public.apply_sparepart_stock_delta(uuid, integer, integer, text, uuid, text) from anon;
grant execute on function public.apply_sparepart_stock_delta(uuid, integer, integer, text, uuid, text) to authenticated;

-- Anchor ledger untuk sisi pusat: cabang pertama tenant (bukan gudang).
create or replace function public.central_ledger_branch(p_organization_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.branches where organization_id = p_organization_id order by created_at limit 1;
$$;
revoke all on function public.central_ledger_branch(uuid) from public, anon, authenticated;

create or replace function public.apply_central_stock_delta(
  p_central_item_id uuid, p_delta integer, p_expected_stock integer default null,
  p_reason text, p_branch_id uuid, p_request_id uuid default null
)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_item public.cervise_central_items%rowtype;
  v_next integer;
begin
  if p_delta is null or p_delta = 0 then raise exception 'delta stok tidak boleh nol'; end if;
  if p_delta > 1000 or p_delta < -1000 then raise exception 'delta stok di luar batas'; end if;
  if p_reason not in ('central_purchase','distribute','request_in','return_to_central') then
    raise exception 'alasan perubahan stok tidak valid';
  end if;
  select * into v_item from public.cervise_central_items where id = p_central_item_id for update;
  if not found then raise exception 'item pusat tidak ditemukan'; end if;
  if p_expected_stock is not null and p_expected_stock <> v_item.stock_qty then
    raise exception 'stok pusat berubah oleh transaksi lain, muat ulang';
  end if;
  v_next := v_item.stock_qty + p_delta;
  if v_next < 0 then raise exception 'stok pusat tidak cukup'; end if;
  update public.cervise_central_items set stock_qty = v_next, updated_at = now() where id = v_item.id;
  insert into public.cervise_stock_movements (
    branch_id, central_item_id, qty_delta, reason, is_central_side, request_id, actor_id
  ) values (p_branch_id, v_item.id, p_delta, p_reason, true, p_request_id, auth.uid());
  return v_next;
end;
$$;
revoke all on function public.apply_central_stock_delta(uuid, integer, integer, text, uuid, uuid) from public, anon, authenticated;

create or replace function public.create_central_item(
  p_organization_id uuid, p_kind text, p_sku text, p_name text, p_category text,
  p_cost integer, p_price integer, p_stock_qty integer default 0,
  p_is_serialized boolean default false, p_imei text default null, p_parent_key text default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_branch uuid;
begin
  if not (public.is_platform_admin() or public.has_tenant_role(p_organization_id, array['MASTER_ADMIN'::text])) then
    raise exception 'hanya master admin yang boleh membuat item';
  end if;
  if p_kind not in ('SPAREPART','PRODUCT') then raise exception 'jenis item tidak valid'; end if;
  if p_is_serialized and p_imei is null then raise exception 'IMEI wajib untuk unit serialized'; end if;
  insert into public.cervise_central_items (
    organization_id, kind, sku, name, category, cost, price, stock_qty, is_serialized, imei, parent_key
  ) values (
    p_organization_id, p_kind, trim(p_sku), trim(p_name), p_category, p_cost, p_price,
    0, p_is_serialized, p_imei, p_parent_key
  ) returning id into v_id;
  if p_stock_qty > 0 then
    v_branch := public.central_ledger_branch(p_organization_id);
    perform public.apply_central_stock_delta(v_id, p_stock_qty, null, 'central_purchase', v_branch, null);
  end if;
  return v_id;
end;
$$;
revoke all on function public.create_central_item(uuid, text, text, text, text, integer, integer, integer, boolean, text, text) from public, anon;
grant execute on function public.create_central_item(uuid, text, text, text, text, integer, integer, integer, boolean, text, text) to authenticated;

-- Edit master data hanya master admin; stok tidak disentuh di sini.
create or replace function public.update_central_item(
  p_central_item_id uuid, p_name text, p_category text, p_cost integer, p_price integer
)
returns void language plpgsql security definer set search_path = public as $$
declare v_item public.cervise_central_items%rowtype;
begin
  select * into v_item from public.cervise_central_items where id = p_central_item_id for update;
  if not found then raise exception 'item pusat tidak ditemukan'; end if;
  if not (public.is_platform_admin() or public.has_tenant_role(v_item.organization_id, array['MASTER_ADMIN'::text])) then
    raise exception 'hanya master admin yang boleh mengubah item';
  end if;
  update public.cervise_central_items
  set name = trim(p_name), category = p_category, cost = p_cost, price = p_price, updated_at = now()
  where id = v_item.id;
end;
$$;
revoke all on function public.update_central_item(uuid, text, text, integer, integer) from public, anon;
grant execute on function public.update_central_item(uuid, text, text, integer, integer) to authenticated;

create or replace function public.purchase_central_stock(
  p_central_item_id uuid, p_qty integer, p_unit_cost integer default null, p_expected_stock integer default null
)
returns integer language plpgsql security definer set search_path = public as $$
declare v_item public.cervise_central_items%rowtype;
begin
  if p_qty is null or p_qty <= 0 then raise exception 'jumlah pembelian harus lebih dari nol'; end if;
  select * into v_item from public.cervise_central_items where id = p_central_item_id for update;
  if not found then raise exception 'item pusat tidak ditemukan'; end if;
  if not (public.is_platform_admin() or public.has_tenant_role(v_item.organization_id, array['MASTER_ADMIN'::text])) then
    raise exception 'role tidak diizinkan membeli stok pusat';
  end if;
  if p_unit_cost is not null then
    if p_unit_cost < 0 then raise exception 'harga beli tidak boleh negatif'; end if;
    update public.cervise_central_items set cost = p_unit_cost, updated_at = now() where id = v_item.id;
  end if;
  return public.apply_central_stock_delta(
    v_item.id, p_qty, p_expected_stock, 'central_purchase',
    public.central_ledger_branch(v_item.organization_id), null);
end;
$$;
revoke all on function public.purchase_central_stock(uuid, integer, integer, integer) from public, anon;
grant execute on function public.purchase_central_stock(uuid, integer, integer, integer) to authenticated;
