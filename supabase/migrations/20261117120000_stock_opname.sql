-- Stock opname: sesi hitung fisik terpisah per domain (product/sparepart).
-- Penyesuaian stok tetap lewat ledger cervise_stock_movements yang sudah ada.

create table if not exists public.cervise_stock_opname_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  domain text not null check (domain in ('product','sparepart')),
  status text not null default 'DRAFT' check (status in ('DRAFT','POSTED','CANCELLED')),
  note text,
  created_by uuid references public.profiles(id) on delete set null,
  posted_by uuid references public.profiles(id) on delete set null,
  started_at timestamptz not null default now(),
  posted_at timestamptz
);

create table if not exists public.cervise_stock_opname_lines (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.cervise_stock_opname_sessions(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  ref_id uuid not null,
  sku text,
  name text,
  imei text,
  snapshot_qty integer not null,
  counted_qty integer not null default 0,
  notes text,
  counted_by uuid references public.profiles(id) on delete set null,
  counted_at timestamptz,
  unique (session_id, ref_id, imei)
);

create index if not exists cervise_stock_opname_lines_session_idx
  on public.cervise_stock_opname_lines(session_id);
create index if not exists cervise_stock_opname_sessions_branch_idx
  on public.cervise_stock_opname_sessions(branch_id, started_at desc);

-- Pabrik catatan opname: helper stock perlu p_notes supaya movement bisa ditandai.
-- Tanda tangan lama di-drop supaya pemanggil 6-arg/5-arg tetap resolusi ke
-- versi baru lewat default parameter.
drop function if exists public.apply_stock_delta(uuid, integer, integer, text, uuid, uuid);
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
  if p_reason not in ('service_use','service_return','sale','sale_return','stock_adjust') then
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

drop function if exists public.apply_sparepart_stock_delta(uuid, integer, integer, text, uuid);
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
    branch_id, sparepart_id, qty_delta, reason, servis_id, actor_id, notes
  ) values (
    v_part.branch_id, p_sparepart_id, p_delta, p_reason, p_servis_id, auth.uid(), p_notes
  );

  return v_next;
end;
$$;

-- Posting atomik: lock sesi, validasi role/branch/status, lalu sesuaikan stok
-- lewat helper yang sesuai domainnya.
create or replace function public.post_stock_opname(p_session_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.cervise_stock_opname_sessions%rowtype;
  v_line record;
  v_delta integer;
  v_count integer := 0;
begin
  select * into v_session
  from public.cervise_stock_opname_sessions
  where id = p_session_id
  for update;

  if not found then
    raise exception 'Sesi tidak ditemukan';
  end if;
  if not public.has_tenant_branch_role(
    v_session.organization_id,
    v_session.branch_id,
    array['MASTER_ADMIN'::text, 'ADMIN'::text]
  ) then
    raise exception 'Hanya admin yang boleh memposting opname';
  end if;
  if v_session.status <> 'DRAFT' then
    raise exception 'Sesi sudah diposting/dibatalkan';
  end if;

  for v_line in
    select * from public.cervise_stock_opname_lines where session_id = p_session_id
  loop
    v_delta := v_line.counted_qty - v_line.snapshot_qty;
    if v_delta <> 0 then
      if v_session.domain = 'product' then
        perform public.apply_stock_delta(
          v_line.ref_id, v_delta, v_line.snapshot_qty, 'stock_adjust',
          null, null, 'opname:' || p_session_id || ':' || v_line.id
        );
      else
        perform public.apply_sparepart_stock_delta(
          v_line.ref_id, v_delta, v_line.snapshot_qty, 'stock_adjust',
          null, 'opname:' || p_session_id || ':' || v_line.id
        );
      end if;
      v_count := v_count + 1;
    end if;
  end loop;

  update public.cervise_stock_opname_sessions
  set status = 'POSTED', posted_at = now(), posted_by = auth.uid()
  where id = p_session_id;

  return v_count;
end;
$$;

revoke all on function public.apply_stock_delta(uuid, integer, integer, text, uuid, uuid, text) from public;
revoke all on function public.apply_stock_delta(uuid, integer, integer, text, uuid, uuid, text) from anon;
grant execute on function public.apply_stock_delta(uuid, integer, integer, text, uuid, uuid, text) to authenticated;

revoke all on function public.apply_sparepart_stock_delta(uuid, integer, integer, text, uuid, text) from public;
revoke all on function public.apply_sparepart_stock_delta(uuid, integer, integer, text, uuid, text) from anon;
grant execute on function public.apply_sparepart_stock_delta(uuid, integer, integer, text, uuid, text) to authenticated;

revoke all on function public.post_stock_opname(uuid) from public;
revoke all on function public.post_stock_opname(uuid) from anon;
grant execute on function public.post_stock_opname(uuid) to authenticated;

-- RLS branch-scoped, mengikuti pola cervise_stock_movements.
alter table public.cervise_stock_opname_sessions enable row level security;
alter table public.cervise_stock_opname_lines enable row level security;

drop policy if exists cervise_stock_opname_sessions_rw on public.cervise_stock_opname_sessions;
create policy cervise_stock_opname_sessions_rw on public.cervise_stock_opname_sessions
  for all to authenticated
  using (public.is_platform_admin() or public.can_access_tenant_branch(branch_id))
  with check (public.is_platform_admin() or public.can_access_tenant_branch(branch_id));

drop policy if exists cervise_stock_opname_lines_rw on public.cervise_stock_opname_lines;
create policy cervise_stock_opname_lines_rw on public.cervise_stock_opname_lines
  for all to authenticated
  using (public.is_platform_admin() or public.can_access_tenant_branch(branch_id))
  with check (public.is_platform_admin() or public.can_access_tenant_branch(branch_id));

grant select, insert, update, delete on public.cervise_stock_opname_sessions to authenticated;
grant select, insert, update, delete on public.cervise_stock_opname_lines to authenticated;
