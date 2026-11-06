-- Pembelian dan transfer stok sparepart antar cabang.
--
-- Keduanya lewat ledger yang sama (`cervise_stock_movements`), jadi alasan
-- baru perlu masuk ke constraint dan ke validator internal.

alter table public.cervise_stock_movements
  drop constraint if exists cervise_stock_movements_reason_check;

alter table public.cervise_stock_movements
  add constraint cervise_stock_movements_reason_check
  check (reason in (
    'service_use','service_return','sale','sale_return','stock_adjust',
    'purchase','transfer_in','transfer_out'
  ));

-- Internal helper: tambah alasan purchase/transfer ke daftar valid.
create or replace function public.apply_sparepart_stock_delta(
  p_sparepart_id uuid,
  p_delta integer,
  p_expected_stock integer default null,
  p_reason text default 'stock_adjust',
  p_servis_id uuid default null
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
  if p_reason not in (
    'service_use','service_return','sale','sale_return','stock_adjust',
    'purchase','transfer_in','transfer_out'
  ) then
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
    branch_id, sparepart_id, qty_delta, reason, servis_id, actor_id
  ) values (
    v_part.branch_id, p_sparepart_id, p_delta, p_reason, p_servis_id, auth.uid()
  );

  return v_next;
end;
$$;

revoke all on function public.apply_sparepart_stock_delta(uuid, integer, integer, text, uuid) from public;
revoke all on function public.apply_sparepart_stock_delta(uuid, integer, integer, text, uuid) from anon;
revoke all on function public.apply_sparepart_stock_delta(uuid, integer, integer, text, uuid) from authenticated;

-- Beli sparepart: stok bertambah, harga modal ikut diperbarui bila diisi.
create or replace function public.purchase_sparepart_stock(
  p_sparepart_id uuid,
  p_qty integer,
  p_unit_cost integer default null,
  p_expected_stock integer default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_part public.cervise_spareparts%rowtype;
begin
  if p_qty is null or p_qty <= 0 then
    raise exception 'jumlah pembelian harus lebih dari nol';
  end if;

  select * into v_part from public.cervise_spareparts where id = p_sparepart_id;
  if not found then
    raise exception 'sparepart tidak ditemukan';
  end if;

  if not (
    public.is_platform_admin()
    or public.has_tenant_branch_role(
      v_part.organization_id,
      v_part.branch_id,
      array['MASTER_ADMIN'::text, 'ADMIN'::text]
    )
  ) then
    raise exception 'role tidak diizinkan membeli stok';
  end if;

  if p_unit_cost is not null then
    if p_unit_cost < 0 then
      raise exception 'harga beli tidak boleh negatif';
    end if;
    update public.cervise_spareparts
    set cost = p_unit_cost, updated_at = now()
    where id = p_sparepart_id;
  end if;

  return public.apply_sparepart_stock_delta(p_sparepart_id, p_qty, p_expected_stock, 'purchase', null);
end;
$$;

revoke all on function public.purchase_sparepart_stock(uuid, integer, integer, integer) from public;
revoke all on function public.purchase_sparepart_stock(uuid, integer, integer, integer) from anon;
grant execute on function public.purchase_sparepart_stock(uuid, integer, integer, integer) to authenticated;

-- Transfer antar cabang: kurangi cabang asal, tambah di cabang tujuan.
-- SKU yang belum ada di cabang tujuan dibuat otomatis dengan harga yang sama.
create or replace function public.transfer_sparepart_stock(
  p_sparepart_id uuid,
  p_target_branch_id uuid,
  p_qty integer,
  p_expected_stock integer default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_src public.cervise_spareparts%rowtype;
  v_target public.cervise_spareparts%rowtype;
begin
  if p_qty is null or p_qty <= 0 then
    raise exception 'jumlah transfer harus lebih dari nol';
  end if;

  select * into v_src from public.cervise_spareparts where id = p_sparepart_id;
  if not found then
    raise exception 'sparepart tidak ditemukan';
  end if;

  if p_target_branch_id = v_src.branch_id then
    raise exception 'cabang tujuan harus berbeda';
  end if;

  if not (
    public.is_platform_admin()
    or (
      public.has_tenant_branch_role(
        v_src.organization_id,
        v_src.branch_id,
        array['MASTER_ADMIN'::text, 'ADMIN'::text]
      )
      and public.has_tenant_branch_role(
        v_src.organization_id,
        p_target_branch_id,
        array['MASTER_ADMIN'::text, 'ADMIN'::text]
      )
    )
  ) then
    raise exception 'role tidak diizinkan mentransfer stok';
  end if;

  insert into public.cervise_spareparts (
    organization_id, branch_id, sku, name, category, stock_qty, cost, price, is_active
  ) values (
    v_src.organization_id, p_target_branch_id, v_src.sku, v_src.name,
    v_src.category, 0, v_src.cost, v_src.price, true
  )
  on conflict (branch_id, sku) do update set updated_at = now()
  returning * into v_target;

  perform public.apply_sparepart_stock_delta(p_sparepart_id, -p_qty, p_expected_stock, 'transfer_out', null);
  perform public.apply_sparepart_stock_delta(v_target.id, p_qty, null, 'transfer_in', null);

  return v_target.id;
end;
$$;

revoke all on function public.transfer_sparepart_stock(uuid, uuid, integer, integer) from public;
revoke all on function public.transfer_sparepart_stock(uuid, uuid, integer, integer) from anon;
grant execute on function public.transfer_sparepart_stock(uuid, uuid, integer, integer) to authenticated;
