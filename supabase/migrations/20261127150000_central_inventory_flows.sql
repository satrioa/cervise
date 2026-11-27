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
    if p_imei is null or v_item.imei <> p_imei or v_item.stock_qty < 1 then
      raise exception 'unit IMEI tidak tersedia di gudang';
    end if;
  elsif v_item.stock_qty < p_qty then
    raise exception 'stok pusat tidak cukup';
  end if;

  if v_item.kind = 'SPAREPART' then
    insert into public.cervise_spareparts (organization_id, branch_id, central_item_id, sku, name, category, stock_qty, cost, price, is_active)
    values (v_item.organization_id, p_target_branch_id, v_item.id, v_item.sku, v_item.name, v_item.category, 0, v_item.cost, v_item.price, true)
    on conflict (branch_id, sku) do update set central_item_id = excluded.central_item_id, updated_at = now()
    returning id into v_result;
    perform public.apply_sparepart_stock_delta(v_result, p_qty, null, 'distribute', null);
  else
    insert into public.cervise_products (organization_id, branch_id, central_item_id, sku, name, category, stock_qty, cost, price, is_serialized, imei, parent_key, is_active)
    values (v_item.organization_id, p_target_branch_id, v_item.id, v_item.sku, v_item.name, v_item.category, 0, v_item.cost, v_item.price, v_item.is_serialized, v_item.imei, v_item.parent_key, true)
    on conflict (branch_id, sku) do update set central_item_id = excluded.central_item_id, updated_at = now()
    returning id into v_result;
    perform public.apply_stock_delta(v_result, p_qty, null, 'distribute', null, null, null);
  end if;

  perform public.apply_central_stock_delta(v_item.id, -p_qty, p_expected_stock, 'distribute', p_target_branch_id, null);
  return v_result;
end;
$$;
revoke all on function public.distribute_central_stock(uuid, uuid, integer, integer, text) from public, anon;
grant execute on function public.distribute_central_stock(uuid, uuid, integer, integer, text) to authenticated;

create or replace function public.request_stock(p_branch_id uuid, p_sku text, p_qty integer)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_id uuid; v_sku text := trim(p_sku);
begin
  if p_qty is null or p_qty <= 0 then raise exception 'jumlah request harus lebih dari nol'; end if;
  select organization_id into v_org from public.branches where id = p_branch_id;
  if v_org is null then raise exception 'cabang tidak ditemukan'; end if;
  if not (public.is_platform_admin() or public.has_tenant_branch_role(v_org, p_branch_id, array['ADMIN','FRONTLINER']::text[])) then
    raise exception 'role tidak diizinkan request stok';
  end if;
  if exists (select 1 from public.cervise_stock_requests where branch_id = p_branch_id and sku = v_sku and status = 'PENDING') then
    raise exception 'request sudah menunggu persetujuan';
  end if;
  insert into public.cervise_stock_requests (organization_id, branch_id, sku, qty, requested_by)
  values (v_org, p_branch_id, v_sku, p_qty, auth.uid()) returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.request_stock(uuid, text, integer) from public, anon;
grant execute on function public.request_stock(uuid, text, integer) to authenticated;

create or replace function public.approve_stock_request(
  p_request_id uuid, p_decided_qty integer, p_central_item_id uuid default null, p_expected_stock integer default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_req public.cervise_stock_requests%rowtype; v_item public.cervise_central_items%rowtype; v_branch_stock uuid;
begin
  if p_decided_qty is null or p_decided_qty <= 0 then raise exception 'jumlah persetujuan harus lebih dari nol'; end if;
  select * into v_req from public.cervise_stock_requests where id = p_request_id for update;
  if not found then raise exception 'request tidak ditemukan'; end if;
  if v_req.status <> 'PENDING' then raise exception 'request sudah diproses'; end if;
  if not (public.is_platform_admin() or public.has_tenant_role(v_req.organization_id, array['MASTER_ADMIN'::text])) then
    raise exception 'hanya master admin yang boleh menyetujui request';
  end if;
  if p_decided_qty > v_req.qty then raise exception 'jumlah persetujuan melebihi request'; end if;
  select * into v_item from public.cervise_central_items where id = p_central_item_id for update;
  if not found then raise exception 'item pusat tidak ditemukan'; end if;
  if v_item.sku <> v_req.sku then raise exception 'item tidak sesuai request'; end if;
  if v_item.is_serialized then
    if p_decided_qty <> 1 then raise exception 'unit serialized hanya satu per request'; end if;
  end if;
  -- Baris cabang dibuat/ditambah dulu; stok pusat dipotong terakhir supaya
  -- kegagalan apa pun menggagalkan seluruh transaksi.
  v_branch_stock := public.distribute_central_stock(v_item.id, v_req.branch_id, p_decided_qty, p_expected_stock, v_item.imei);
  update public.cervise_stock_requests
  set status = 'APPROVED', decided_qty = p_decided_qty, central_item_id = v_item.id,
      decided_by = auth.uid(), decided_at = now()
  where id = v_req.id;
  return v_branch_stock;
end;
$$;
revoke all on function public.approve_stock_request(uuid, integer, uuid, integer) from public, anon;
grant execute on function public.approve_stock_request(uuid, integer, uuid, integer) to authenticated;

create or replace function public.reject_stock_request(p_request_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_req public.cervise_stock_requests%rowtype;
begin
  if p_reason is null or length(trim(p_reason)) < 3 then raise exception 'alasan wajib diisi minimal 3 karakter'; end if;
  select * into v_req from public.cervise_stock_requests where id = p_request_id for update;
  if not found then raise exception 'request tidak ditemukan'; end if;
  if v_req.status <> 'PENDING' then raise exception 'request sudah diproses'; end if;
  if not (public.is_platform_admin() or public.has_tenant_role(v_req.organization_id, array['MASTER_ADMIN'::text])) then
    raise exception 'hanya master admin yang boleh menolak request';
  end if;
  update public.cervise_stock_requests
  set status = 'REJECTED', rejection_reason = trim(p_reason), decided_by = auth.uid(), decided_at = now()
  where id = v_req.id;
end;
$$;
revoke all on function public.reject_stock_request(uuid, text) from public, anon;
grant execute on function public.reject_stock_request(uuid, text) to authenticated;

create or replace function public.return_stock_to_central(p_branch_stock_id uuid, p_qty integer)
returns integer language plpgsql security definer set search_path = public as $$
declare v_part public.cervise_spareparts%rowtype; v_prod public.cervise_products%rowtype; v_item_id uuid; v_org uuid; v_branch uuid; v_next integer;
begin
  if p_qty is null or p_qty <= 0 then raise exception 'jumlah pengembalian harus lebih dari nol'; end if;
  select * into v_part from public.cervise_spareparts where id = p_branch_stock_id for update;
  if found then
    v_item_id := v_part.central_item_id; v_org := v_part.organization_id; v_branch := v_part.branch_id;
    if v_part.stock_qty < p_qty then raise exception 'stok cabang tidak cukup'; end if;
    v_next := public.apply_sparepart_stock_delta(v_part.id, -p_qty, null, 'return_to_central', null);
  else
    select * into v_prod from public.cervise_products where id = p_branch_stock_id for update;
    if not found then raise exception 'stok cabang tidak ditemukan'; end if;
    v_item_id := v_prod.central_item_id; v_org := v_prod.organization_id; v_branch := v_prod.branch_id;
    if v_prod.stock_qty < p_qty then raise exception 'stok cabang tidak cukup'; end if;
    v_next := public.apply_stock_delta(v_prod.id, -p_qty, null, 'return_to_central', null, null, null);
  end if;
  if not (public.is_platform_admin() or public.has_tenant_role(v_org, array['MASTER_ADMIN'::text])) then
    raise exception 'hanya master admin yang boleh menarik stok ke pusat';
  end if;
  perform public.apply_central_stock_delta(v_item_id, p_qty, null, 'return_to_central', v_branch, null);
  return v_next;
end;
$$;
revoke all on function public.return_stock_to_central(uuid, integer) from public, anon;
grant execute on function public.return_stock_to_central(uuid, integer) to authenticated;
