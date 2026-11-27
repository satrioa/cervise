-- Constraint lama (branch_id, sku) menyatukan dua unit serialized yang berbeda
-- IMEI di cabang yang sama. Ganti dengan indeks parsial: SKU untuk barang biasa,
-- IMEI untuk unit serialized.
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'cervise_products_branch_id_sku_key'
      and conrelid = 'public.cervise_products'::regclass
  ) then
    alter table public.cervise_products drop constraint cervise_products_branch_id_sku_key;
  end if;
end $$;

create unique index if not exists cervise_products_branch_sku_non_serial_idx
  on public.cervise_products(branch_id, sku) where not is_serialized;
create unique index if not exists cervise_products_branch_imei_idx
  on public.cervise_products(branch_id, imei) where imei is not null;

-- Signature lama di-drop supaya tidak ada overload ganda (named-arg caller).
drop function if exists public.distribute_central_stock(uuid, uuid, integer, integer, text);
create or replace function public.distribute_central_stock(
  p_central_item_id uuid, p_target_branch_id uuid, p_qty integer,
  p_expected_stock integer default null, p_imei text default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_item public.cervise_central_items%rowtype;
  v_result uuid;
begin
  if p_qty is null or p_qty <= 0 then raise exception 'jumlah distribusi harus lebih dari nol'; end if;
  select * into v_item from public.cervise_central_items where id = p_central_item_id for update;
  if not found then raise exception 'item pusat tidak ditemukan'; end if;
  if not (public.is_platform_admin() or public.has_tenant_role(v_item.organization_id, array['MASTER_ADMIN'::text])) then
    raise exception 'role tidak diizinkan mendistribusikan stok';
  end if;
  if not exists (select 1 from public.branches where id = p_target_branch_id and organization_id = v_item.organization_id) then
    raise exception 'cabang tujuan tidak ditemukan';
  end if;
  if v_item.is_serialized then
    if p_qty <> 1 then raise exception 'unit serialized hanya satu per distribusi'; end if;
    if p_imei is null or v_item.imei <> p_imei or v_item.stock_qty < 1 then
      raise exception 'unit IMEI tidak tersedia di gudang';
    end if;
  elsif v_item.stock_qty < p_qty then
    raise exception 'stok pusat tidak cukup';
  end if;

  if v_item.kind = 'SPAREPART' then
    insert into public.cervise_spareparts (organization_id, branch_id, central_item_id, sku, name, category, stock_qty, cost, price, is_active)
    values (v_item.organization_id, p_target_branch_id, v_item.id, v_item.sku, v_item.name, v_item.category, 0, v_item.cost, v_item.price, true)
    on conflict (branch_id, sku) do update set central_item_id = excluded.central_item_id, is_active = excluded.is_active, updated_at = now()
    returning id into v_result;
    perform public.apply_sparepart_stock_delta(v_result, p_qty, null, 'distribute', null);
  else
    if v_item.is_serialized then
      insert into public.cervise_products (organization_id, branch_id, central_item_id, sku, name, category, stock_qty, cost, price, is_serialized, imei, parent_key, is_active)
      values (v_item.organization_id, p_target_branch_id, v_item.id, v_item.sku, v_item.name, v_item.category, 0, v_item.cost, v_item.price, v_item.is_serialized, v_item.imei, v_item.parent_key, true)
      on conflict (branch_id, imei) where imei is not null do update set central_item_id = excluded.central_item_id, is_active = excluded.is_active, name = excluded.name, category = excluded.category, cost = excluded.cost, price = excluded.price, updated_at = now()
      returning id into v_result;
    else
      insert into public.cervise_products (organization_id, branch_id, central_item_id, sku, name, category, stock_qty, cost, price, is_serialized, imei, parent_key, is_active)
      values (v_item.organization_id, p_target_branch_id, v_item.id, v_item.sku, v_item.name, v_item.category, 0, v_item.cost, v_item.price, v_item.is_serialized, v_item.imei, v_item.parent_key, true)
      on conflict (branch_id, sku) where not is_serialized do update set central_item_id = excluded.central_item_id, is_active = excluded.is_active, name = excluded.name, category = excluded.category, cost = excluded.cost, price = excluded.price, updated_at = now()
      returning id into v_result;
    end if;
    perform public.apply_stock_delta(v_result, p_qty, null, 'distribute', null, null, null);
  end if;

  perform public.apply_central_stock_delta(v_item.id, -p_qty, p_expected_stock, 'distribute', p_target_branch_id, null);
  return v_result;
end;
$$;
revoke all on function public.distribute_central_stock(uuid, uuid, integer, integer, text) from public, anon;
grant execute on function public.distribute_central_stock(uuid, uuid, integer, integer, text) to authenticated;

-- Edit master juga menyebar ke baris stok cabang yang tertaut.
drop function if exists public.update_central_item(uuid, text, text, integer, integer);
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
  where id = v_item.id
  returning * into v_item;
  update public.cervise_spareparts set name = v_item.name, category = v_item.category, cost = v_item.cost, price = v_item.price, updated_at = now() where central_item_id = v_item.id;
  update public.cervise_products set name = v_item.name, category = v_item.category, cost = v_item.cost, price = v_item.price, updated_at = now() where central_item_id = v_item.id;
end;
$$;
revoke all on function public.update_central_item(uuid, text, text, integer, integer) from public, anon;
grant execute on function public.update_central_item(uuid, text, text, integer, integer) to authenticated;
