-- Pemakaian sparepart pada servis + ledger stok + penulisan status servis.
-- Semua invariants ditegakkan di database: teknisi hanya boleh memakai sparepart saat
-- status Dikerjakan, stok tidak bisa ditulis langsung, dan setiap perubahan stok
-- tercatat di cervise_stock_movements.

-- 1. Tabel line item sparepart yang dipakai sebuah servis
create table if not exists public.cervise_service_spareparts (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  servis_id uuid not null references public.cervise_services(id) on delete cascade,
  product_id uuid not null references public.cervise_products(id) on delete restrict,
  sku text not null,
  name text not null,
  category text,
  qty integer not null check (qty > 0),
  unit_price integer not null default 0 check (unit_price >= 0),
  cost integer not null default 0 check (cost >= 0),
  line_total integer not null default 0 check (line_total >= 0),
  is_returned boolean not null default false,
  returned_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check ((is_returned and returned_at is not null) or (not is_returned and returned_at is null))
);

create index if not exists cervise_service_spareparts_servis_idx
  on public.cervise_service_spareparts(servis_id, created_at);
create index if not exists cervise_service_spareparts_product_idx
  on public.cervise_service_spareparts(product_id);

-- 2. Ledger perubahan stok (insert-only lewat RPC)
create table if not exists public.cervise_stock_movements (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  product_id uuid not null references public.cervise_products(id) on delete restrict,
  qty_delta integer not null check (qty_delta <> 0),
  reason text not null check (reason in ('service_use','service_return','sale','sale_return','stock_adjust')),
  servis_id uuid references public.cervise_services(id) on delete set null,
  sale_id uuid references public.cervise_sales(id) on delete set null,
  notes text,
  actor_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists cervise_stock_movements_branch_idx
  on public.cervise_stock_movements(branch_id, created_at desc);
create index if not exists cervise_stock_movements_product_idx
  on public.cervise_stock_movements(product_id, created_at desc);

-- 3. Nomor servis yang human readable
alter table public.cervise_services add column if not exists service_number text;

do $$
declare
  v_branch uuid;
begin
  for v_branch in
    select branch_id from public.cervise_services where service_number is null group by branch_id
  loop
    update public.cervise_services s
    set service_number = 'SRV-LEGACY-' || lpad(
      row_number() over (order by s.created_at)::text, 4, '0'
    )
    where s.branch_id = v_branch and s.service_number is null;
  end loop;
end;
$$;

create unique index if not exists cervise_services_service_number_idx
  on public.cervise_services(branch_id, service_number)
  where service_number is not null;

-- 4. Penomoran servis berikutnya, diserialisasi per cabang lewat lock baris branch
create or replace function public.next_service_number(p_branch_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next integer;
  v_year text;
begin
  if not (
    public.is_platform_admin()
    or public.can_access_tenant_branch(p_branch_id)
  ) then
    raise exception 'branch tidak diizinkan';
  end if;

  perform 1 from public.branches where id = p_branch_id for update;

  v_year := to_char(current_date, 'YYYY');
  select coalesce(max(substring(service_number from 10)::integer), 0) + 1
    into v_next
  from public.cervise_services
  where branch_id = p_branch_id
    and service_number like 'SRV-' || v_year || '-%';

  return 'SRV-' || v_year || '-' || lpad(v_next::text, 4, '0');
end;
$$;

revoke all on function public.next_service_number(uuid) from public;
grant execute on function public.next_service_number(uuid) to authenticated;
revoke all on function public.next_service_number(uuid) from anon;

-- 5. apply_stock_delta: perubahan stok inti, TANPA role check dan TANPA grant ke klien.
--    Hanya SECURITY DEFINER function lain yang boleh memanggilnya, sehingga teknisi
--    bisa memakai sparepart tanpa pernah bisa menyentuh stok di luar alur servis.
create or replace function public.apply_stock_delta(
  p_product_id uuid,
  p_delta integer,
  p_expected_stock integer default null,
  p_reason text default 'stock_adjust',
  p_servis_id uuid default null,
  p_sale_id uuid default null
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
    branch_id, product_id, qty_delta, reason, servis_id, sale_id, actor_id
  ) values (
    v_product.branch_id, p_product_id, p_delta, p_reason, p_servis_id, p_sale_id, auth.uid()
  );

  return v_next;
end;
$$;

revoke all on function public.apply_stock_delta(uuid, integer, integer, text, uuid, uuid) from public;
revoke all on function public.apply_stock_delta(uuid, integer, integer, text, uuid, uuid) from anon;
revoke all on function public.apply_stock_delta(uuid, integer, integer, text, uuid, uuid) from authenticated;

-- Wrapper untuk klien: hanya manager/frontliner, dan selalu menulis ledger.
drop function if exists public.adjust_product_stock(uuid, integer, integer);

create or replace function public.adjust_product_stock(
  p_product_id uuid,
  p_delta integer,
  p_expected_stock integer default null,
  p_reason text default 'stock_adjust',
  p_servis_id uuid default null,
  p_sale_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product public.cervise_products%rowtype;
begin
  select * into v_product from public.cervise_products where id = p_product_id;
  if not found then
    raise exception 'produk tidak ditemukan';
  end if;

  if not (
    public.is_platform_admin()
    or public.has_tenant_branch_role(
      v_product.organization_id,
      v_product.branch_id,
      array['MASTER_ADMIN'::text, 'ADMIN'::text, 'FRONTLINER'::text]
    )
  ) then
    raise exception 'role tidak diizinkan mengubah stok';
  end if;

  return public.apply_stock_delta(p_product_id, p_delta, p_expected_stock, p_reason, p_servis_id, p_sale_id);
end;
$$;

revoke all on function public.adjust_product_stock(uuid, integer, integer, text, uuid, uuid) from public;
grant execute on function public.adjust_product_stock(uuid, integer, integer, text, uuid, uuid) to authenticated;
revoke all on function public.adjust_product_stock(uuid, integer, integer, text, uuid, uuid) from anon;

-- 6. Helper internal:ROLE pemanggil pada sebuah cabang
create or replace function public.caller_branch_role(p_branch_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select e.role
  from public.employees e
  where e.profile_id = auth.uid()
    and e.branch_id = p_branch_id
    and e.is_active = true
  limit 1;
$$;

revoke all on function public.caller_branch_role(uuid) from public;
grant execute on function public.caller_branch_role(uuid) to authenticated;
revoke all on function public.caller_branch_role(uuid) from anon;

-- 7. Konsumsi sparepart untuk sebuah servis (atomik)
create or replace function public.consume_service_spareparts(
  p_servis_id uuid,
  p_items jsonb,
  p_set_status boolean default false
)
returns setof public.cervise_service_spareparts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_service public.cervise_services%rowtype;
  v_role text;
  v_item jsonb;
  v_product public.cervise_products%rowtype;
  v_product_id uuid;
  v_qty integer;
  v_seen uuid[] := '{}';
  v_row public.cervise_service_spareparts%rowtype;
begin
  if p_servis_id is null then
    raise exception 'servis wajib';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'pilih minimal 1 sparepart';
  end if;

  select * into v_service
  from public.cervise_services
  where id = p_servis_id
  for update;

  if not found then
    raise exception 'servis tidak ditemukan';
  end if;

  v_role := public.caller_branch_role(v_service.branch_id);
  if not (public.is_platform_admin() or v_role in ('MASTER_ADMIN','ADMIN','FRONTLINER','TECHNICIAN')) then
    raise exception 'role tidak diizinkan memakai sparepart';
  end if;
  if v_role = 'TECHNICIAN' and v_service.status <> 'Dikerjakan' then
    raise exception 'teknisi hanya bisa memakai sparepart saat status Dikerjakan';
  end if;
  if v_service.status = 'Batal' or v_service.status = 'Sudah Diambil' then
    raise exception 'servis sudah selesai, tidak bisa menambah sparepart';
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item ->> 'product_id')::uuid;
    v_qty := (v_item ->> 'qty')::integer;

    if v_product_id is null then
      raise exception 'product_id wajib';
    end if;
    if v_qty is null or v_qty <= 0 then
      raise exception 'qty harus bilangan bulat lebih dari 0';
    end if;
    if v_product_id = any(v_seen) then
      raise exception 'produk hanya boleh satu baris';
    end if;
    v_seen := array_append(v_seen, v_product_id);

    select * into v_product
    from public.cervise_products
    where id = v_product_id and branch_id = v_service.branch_id
    for update;

    if not found then
      raise exception 'produk tidak ditemukan di cabang ini';
    end if;
    if not v_product.is_active then
      raise exception 'produk % tidak aktif', v_product.name;
    end if;
    if v_product.is_serialized and v_qty <> 1 then
      raise exception '% wajib qty 1', v_product.name;
    end if;
    if v_qty > v_product.stock_qty then
      raise exception 'stok % tidak cukup (sisa %)', v_product.name, v_product.stock_qty;
    end if;

    insert into public.cervise_service_spareparts (
      branch_id, servis_id, product_id, sku, name, category,
      qty, unit_price, cost, line_total, created_by
    ) values (
      v_service.branch_id, v_service.id, v_product.id, v_product.sku, v_product.name, v_product.category,
      v_qty, v_product.price, v_product.cost, v_product.price * v_qty, auth.uid()
    )
    returning * into v_row;

    perform public.apply_stock_delta(
      v_product.id, -v_qty, v_product.stock_qty, 'service_use', v_service.id, null
    );

    insert into public.cervise_service_logs (branch_id, servis_id, actor_id, action, to_value, payload)
    values (
      v_service.branch_id, v_service.id, auth.uid(), 'add_sparepart', v_product.name,
      jsonb_build_object('product_id', v_product.id, 'sku', v_product.sku, 'qty', v_qty, 'line_total', v_row.line_total)
    );

    return next v_row;
  end loop;

  if p_set_status and v_service.status = 'Menunggu Konfirmasi' then
    update public.cervise_services set status = 'Dikerjakan' where id = v_service.id;
    insert into public.cervise_service_logs (branch_id, servis_id, actor_id, action, from_value, to_value)
    values (v_service.branch_id, v_service.id, auth.uid(), 'status_change', v_service.status, 'Dikerjakan');
  end if;

  return;
end;
$$;

revoke all on function public.consume_service_spareparts(uuid, jsonb, boolean) from public;
grant execute on function public.consume_service_spareparts(uuid, jsonb, boolean) to authenticated;
revoke all on function public.consume_service_spareparts(uuid, jsonb, boolean) from anon;

-- 8. Kembalikan sparepart ke stok karena pembatalan
create or replace function public.return_service_spareparts(p_servis_id uuid, p_reason text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_service public.cervise_services%rowtype;
  v_role text;
  v_row public.cervise_service_spareparts%rowtype;
  v_count integer := 0;
begin
  if p_servis_id is null then
    raise exception 'servis wajib';
  end if;
  if p_reason is null or length(trim(p_reason)) < 3 then
    raise exception 'alasan wajib diisi minimal 3 karakter';
  end if;

  select * into v_service
  from public.cervise_services
  where id = p_servis_id
  for update;

  if not found then
    raise exception 'servis tidak ditemukan';
  end if;

  v_role := public.caller_branch_role(v_service.branch_id);
  if not (public.is_platform_admin() or v_role in ('MASTER_ADMIN','ADMIN','FRONTLINER','TECHNICIAN')) then
    raise exception 'role tidak diizinkan membatalkan servis';
  end if;

  for v_row in
    select * from public.cervise_service_spareparts
    where servis_id = v_service.id and not is_returned
    order by created_at
    for update
  loop
    perform public.apply_stock_delta(
      v_row.product_id, v_row.qty, null, 'service_return', v_service.id, null
    );

    update public.cervise_service_spareparts
    set is_returned = true, returned_at = now()
    where id = v_row.id;

    v_count := v_count + 1;
  end loop;

  insert into public.cervise_service_logs (branch_id, servis_id, actor_id, action, to_value, payload)
  values (
    v_service.branch_id, v_service.id, auth.uid(), 'return_sparepart', trim(p_reason),
    jsonb_build_object('lines', v_count, 'decision', 'return')
  );

  return v_count;
end;
$$;

revoke all on function public.return_service_spareparts(uuid, text) from public;
grant execute on function public.return_service_spareparts(uuid, text) to authenticated;
revoke all on function public.return_service_spareparts(uuid, text) from anon;

-- 9. Pembatalan dengan sparepart tetap terpakai: alasan wajib tercatat
create or replace function public.mark_service_spareparts_kept(p_servis_id uuid, p_reason text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_service public.cervise_services%rowtype;
  v_role text;
  v_count integer;
begin
  if p_servis_id is null then
    raise exception 'servis wajib';
  end if;
  if p_reason is null or length(trim(p_reason)) < 3 then
    raise exception 'alasan wajib diisi minimal 3 karakter';
  end if;

  select * into v_service
  from public.cervise_services
  where id = p_servis_id
  for update;

  if not found then
    raise exception 'servis tidak ditemukan';
  end if;

  v_role := public.caller_branch_role(v_service.branch_id);
  if not (public.is_platform_admin() or v_role in ('MASTER_ADMIN','ADMIN','FRONTLINER','TECHNICIAN')) then
    raise exception 'role tidak diizinkan membatalkan servis';
  end if;

  select count(*) into v_count
  from public.cervise_service_spareparts
  where servis_id = v_service.id and not is_returned;

  insert into public.cervise_service_logs (branch_id, servis_id, actor_id, action, to_value, payload)
  values (
    v_service.branch_id, v_service.id, auth.uid(), 'keep_sparepart', trim(p_reason),
    jsonb_build_object('lines', v_count, 'decision', 'keep_consumed')
  );

  return v_count;
end;
$$;

revoke all on function public.mark_service_spareparts_kept(uuid, text) from public;
grant execute on function public.mark_service_spareparts_kept(uuid, text) to authenticated;
revoke all on function public.mark_service_spareparts_kept(uuid, text) from anon;

-- 10. Satu-satunya penulis status servis
create or replace function public.set_service_status(p_servis_id uuid, p_status text, p_note text default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_service public.cervise_services%rowtype;
  v_role text;
  v_allowed text[] := array['Masuk','Diagnosa','Menunggu Konfirmasi','Menunggu Sparepart','Dikerjakan','Selesai','Sudah Diambil','Batal'];
  v_parts integer;
begin
  if p_servis_id is null then
    raise exception 'servis wajib';
  end if;
  if p_status is null or not (p_status = any(v_allowed)) then
    raise exception 'status tidak dikenal';
  end if;

  select * into v_service
  from public.cervise_services
  where id = p_servis_id
  for update;

  if not found then
    raise exception 'servis tidak ditemukan';
  end if;

  v_role := public.caller_branch_role(v_service.branch_id);
  if not (public.is_platform_admin() or v_role in ('MASTER_ADMIN','ADMIN','FRONTLINER','TECHNICIAN')) then
    raise exception 'role tidak diizinkan mengubah status';
  end if;

  if v_service.status = p_status then
    return v_service.status;
  end if;

  if p_status = 'Batal' then
    select count(*) into v_parts
    from public.cervise_service_spareparts
    where servis_id = v_service.id and not is_returned;
    if v_parts > 0 then
      raise exception 'servis masih punya sparepart terpakai, putuskan dulu kembalikan ke stok atau tetap terpakai';
    end if;
  end if;

  update public.cervise_services set status = p_status where id = v_service.id;

  insert into public.cervise_service_logs (branch_id, servis_id, actor_id, action, from_value, to_value, payload)
  values (
    v_service.branch_id, v_service.id, auth.uid(), 'status_change', v_service.status, p_status,
    case when p_note is null or trim(p_note) = '' then null else jsonb_build_object('note', trim(p_note)) end
  );

  return p_status;
end;
$$;

revoke all on function public.set_service_status(uuid, text, text) from public;
grant execute on function public.set_service_status(uuid, text, text) to authenticated;
revoke all on function public.set_service_status(uuid, text, text) from anon;

-- 11. RLS: dua tabel baru hanya bisa dibaca klien; semua tulis lewat RPC di atas
alter table public.cervise_service_spareparts enable row level security;
alter table public.cervise_stock_movements enable row level security;

drop policy if exists cervise_service_spareparts_select on public.cervise_service_spareparts;
create policy cervise_service_spareparts_select on public.cervise_service_spareparts
  for select to authenticated
  using (public.is_platform_admin() or public.can_access_tenant_branch(branch_id));

drop policy if exists cervise_stock_movements_select on public.cervise_stock_movements;
create policy cervise_stock_movements_select on public.cervise_stock_movements
  for select to authenticated
  using (public.is_platform_admin() or public.can_access_tenant_branch(branch_id));

grant select on public.cervise_service_spareparts, public.cervise_stock_movements to authenticated;
grant select, insert, update, delete on public.cervise_service_spareparts, public.cervise_stock_movements to service_role;
revoke all on public.cervise_service_spareparts, public.cervise_stock_movements from anon;

grant update (service_number) on public.cervise_services to authenticated;

