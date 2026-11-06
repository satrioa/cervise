-- Pisahkan stok sparepart dari katalog produk.
--
-- Sebelumnya `cervise_spareparts` hanya view di atas `cervise_products`, jadi
-- picker sparepart servis menampilkan semua produk jualan. Sekarang sparepart
-- punya tabel sendiri, stoknya dipotong/dikembalikan lewat RPC yang sama
-- dengan alur servis, dan baris produk sumbernya dinonaktifkan (bukan dihapus)
-- supaya riwayat penjualan/servis tetap valid.

-- 1. View lama diganti tabel nyata. Nama dipertahankan agar pembaca kategori
--    dan kode lama tetap menunjuk objek yang benar.
drop view if exists public.cervise_spareparts;

create table if not exists public.cervise_spareparts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  sku text not null,
  name text not null,
  category text not null default 'Sparepart',
  stock_qty integer not null default 0 check (stock_qty >= 0),
  cost integer not null default 0 check (cost >= 0),
  price integer not null default 0 check (price >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (branch_id, sku)
);

create index if not exists cervise_spareparts_branch_idx
  on public.cervise_spareparts(branch_id, name);

alter table public.cervise_spareparts enable row level security;

drop policy if exists cervise_spareparts_select on public.cervise_spareparts;
create policy cervise_spareparts_select on public.cervise_spareparts
  for select to authenticated
  using (public.is_platform_admin() or public.is_tenant_branch_member(organization_id, branch_id));

drop policy if exists cervise_spareparts_insert on public.cervise_spareparts;
create policy cervise_spareparts_insert on public.cervise_spareparts
  for insert to authenticated
  with check (
    public.is_platform_admin()
    or public.has_tenant_branch_role(organization_id, branch_id, array['MASTER_ADMIN'::text, 'ADMIN'::text])
  );

drop policy if exists cervise_spareparts_update on public.cervise_spareparts;
create policy cervise_spareparts_update on public.cervise_spareparts
  for update to authenticated
  using (
    public.is_platform_admin()
    or public.has_tenant_branch_role(organization_id, branch_id, array['MASTER_ADMIN'::text, 'ADMIN'::text])
  )
  with check (
    public.is_platform_admin()
    or public.has_tenant_branch_role(organization_id, branch_id, array['MASTER_ADMIN'::text, 'ADMIN'::text])
  );

drop policy if exists cervise_spareparts_delete on public.cervise_spareparts;
create policy cervise_spareparts_delete on public.cervise_spareparts
  for delete to authenticated
  using (
    public.is_platform_admin()
    or public.has_tenant_branch_role(organization_id, branch_id, array['MASTER_ADMIN'::text, 'ADMIN'::text])
  );

grant select, insert, delete on public.cervise_spareparts to authenticated;
-- stock_qty tidak bisa diubah langsung; perubahan stok lewat
-- adjust_sparepart_stock / alur servis supaya ledger tetap utuh.
grant update (sku, name, category, cost, price, is_active)
  on public.cervise_spareparts to authenticated;
grant select, insert, update, delete on public.cervise_spareparts to service_role;

-- 2. Pindahkan sparepart lama dari katalog produk. Patokannya kategori yang
--    terdaftar di cervise_sparepart_categories cabang tersebut, plus kategori
--    literal 'Sparepart' dari data lama.
insert into public.cervise_spareparts (
  organization_id, branch_id, sku, name, category, stock_qty, cost, price, is_active
)
select
  p.organization_id, p.branch_id, p.sku, p.name, p.category,
  p.stock_qty, p.cost, p.price, true
from public.cervise_products p
where p.is_active = true
  and (
    p.category = 'Sparepart'
    or exists (
      select 1
      from public.cervise_sparepart_categories c
      where c.branch_id = p.branch_id
        and c.name = p.category
    )
  )
on conflict (branch_id, sku) do nothing;

-- Produk sumber disembunyikan dari Inventori/POS, bukan dihapus: FK riwayat
-- penjualan dan baris servis lama masih menunjuk baris tersebut.
update public.cervise_products p
set is_active = false, updated_at = now()
where p.is_active = true
  and (
    p.category = 'Sparepart'
    or exists (
      select 1
      from public.cervise_sparepart_categories c
      where c.branch_id = p.branch_id
        and c.name = p.category
    )
  );

-- 3. Baris pemakaian sparepart pada servis: baris baru menunjuk sparepart_id,
--    baris lama (yang sudah terlanjur tercatat) tetap memakai product_id.
alter table public.cervise_service_spareparts
  add column if not exists sparepart_id uuid references public.cervise_spareparts(id) on delete restrict;

alter table public.cervise_service_spareparts
  alter column product_id drop not null;

create index if not exists cervise_service_spareparts_sparepart_idx
  on public.cervise_service_spareparts(sparepart_id);

-- 4. Ledger stok: satu baris bisa menunjuk produk atau sparepart, tidak keduanya.
alter table public.cervise_stock_movements
  add column if not exists sparepart_id uuid references public.cervise_spareparts(id) on delete restrict;

alter table public.cervise_stock_movements
  alter column product_id drop not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'cervise_stock_movements_owner_check'
  ) then
    alter table public.cervise_stock_movements
      add constraint cervise_stock_movements_owner_check
      check (product_id is not null or sparepart_id is not null);
  end if;
end;
$$;

create index if not exists cervise_stock_movements_sparepart_idx
  on public.cervise_stock_movements(sparepart_id, created_at desc);

-- 5. Perubahan stok sparepart, internal saja (tanpa grant ke klien).
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
  if p_reason not in ('service_use','service_return','sale','sale_return','stock_adjust') then
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

-- Wrapper klien untuk koreksi stok manual (manager/frontliner), selalu ber-ledger.
create or replace function public.adjust_sparepart_stock(
  p_sparepart_id uuid,
  p_delta integer,
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
  select * into v_part from public.cervise_spareparts where id = p_sparepart_id;
  if not found then
    raise exception 'sparepart tidak ditemukan';
  end if;

  if not (
    public.is_platform_admin()
    or public.has_tenant_branch_role(
      v_part.organization_id,
      v_part.branch_id,
      array['MASTER_ADMIN'::text, 'ADMIN'::text, 'FRONTLINER'::text]
    )
  ) then
    raise exception 'role tidak diizinkan mengubah stok';
  end if;

  return public.apply_sparepart_stock_delta(p_sparepart_id, p_delta, p_expected_stock, 'stock_adjust', null);
end;
$$;

revoke all on function public.adjust_sparepart_stock(uuid, integer, integer) from public;
revoke all on function public.adjust_sparepart_stock(uuid, integer, integer) from anon;
grant execute on function public.adjust_sparepart_stock(uuid, integer, integer) to authenticated;

-- 6. Konsumsi sparepart servis: baca tabel sparepart, bukan katalog produk.
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
  v_part public.cervise_spareparts%rowtype;
  v_sparepart_id uuid;
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
    v_sparepart_id := (v_item ->> 'sparepart_id')::uuid;
    v_qty := (v_item ->> 'qty')::integer;

    if v_sparepart_id is null then
      raise exception 'sparepart_id wajib';
    end if;
    if v_qty is null or v_qty <= 0 then
      raise exception 'qty harus bilangan bulat lebih dari 0';
    end if;
    if v_sparepart_id = any(v_seen) then
      raise exception 'sparepart hanya boleh satu baris';
    end if;
    v_seen := array_append(v_seen, v_sparepart_id);

    select * into v_part
    from public.cervise_spareparts
    where id = v_sparepart_id and branch_id = v_service.branch_id
    for update;

    if not found then
      raise exception 'sparepart tidak ditemukan di cabang ini';
    end if;
    if not v_part.is_active then
      raise exception 'sparepart % tidak aktif', v_part.name;
    end if;
    if v_qty > v_part.stock_qty then
      raise exception 'stok % tidak cukup (sisa %)', v_part.name, v_part.stock_qty;
    end if;

    insert into public.cervise_service_spareparts (
      branch_id, servis_id, sparepart_id, sku, name, category,
      qty, unit_price, cost, line_total, created_by
    ) values (
      v_service.branch_id, v_service.id, v_part.id, v_part.sku, v_part.name, v_part.category,
      v_qty, v_part.price, v_part.cost, v_part.price * v_qty, auth.uid()
    )
    returning * into v_row;

    perform public.apply_sparepart_stock_delta(
      v_part.id, -v_qty, v_part.stock_qty, 'service_use', v_service.id
    );

    insert into public.cervise_service_logs (branch_id, servis_id, actor_id, action, to_value, payload)
    values (
      v_service.branch_id, v_service.id, auth.uid(), 'add_sparepart', v_part.name,
      jsonb_build_object('sparepart_id', v_part.id, 'sku', v_part.sku, 'qty', v_qty, 'line_total', v_row.line_total)
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

-- 7. Pengembalian stok: baris baru kembali ke tabel sparepart, baris lama
--    (product_id terisi) tetap kembali ke stok katalog produk.
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
    if v_row.sparepart_id is not null then
      perform public.apply_sparepart_stock_delta(
        v_row.sparepart_id, v_row.qty, null, 'service_return', v_service.id
      );
    else
      perform public.apply_stock_delta(
        v_row.product_id, v_row.qty, null, 'service_return', v_service.id, null
      );
    end if;

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

create or replace function public.return_service_sparepart(p_sparepart_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.cervise_service_spareparts%rowtype;
  v_service public.cervise_services%rowtype;
  v_role text;
begin
  if p_sparepart_id is null then
    raise exception 'sparepart wajib';
  end if;
  if p_reason is null or length(trim(p_reason)) < 3 then
    raise exception 'alasan wajib diisi minimal 3 karakter';
  end if;

  select * into v_row
  from public.cervise_service_spareparts
  where id = p_sparepart_id
  for update;

  if not found then
    raise exception 'sparepart tidak ditemukan';
  end if;
  if v_row.is_returned then
    raise exception 'sparepart sudah dikembalikan';
  end if;

  select * into v_service
  from public.cervise_services
  where id = v_row.servis_id
  for update;

  if not found then
    raise exception 'servis tidak ditemukan';
  end if;
  if v_service.status in ('Batal', 'Sudah Diambil') then
    raise exception 'sparepart tidak bisa dihapus saat servis %', v_service.status;
  end if;

  v_role := public.caller_branch_role(v_service.branch_id);
  if not (public.is_platform_admin() or v_role in ('MASTER_ADMIN', 'ADMIN', 'FRONTLINER')) then
    raise exception 'role tidak diizinkan menghapus sparepart';
  end if;

  if v_row.sparepart_id is not null then
    perform public.apply_sparepart_stock_delta(
      v_row.sparepart_id, v_row.qty, null, 'service_return', v_service.id
    );
  else
    perform public.apply_stock_delta(
      v_row.product_id, v_row.qty, null, 'service_return', v_service.id, null
    );
  end if;

  update public.cervise_service_spareparts
  set is_returned = true, returned_at = now()
  where id = v_row.id;

  insert into public.cervise_service_logs (branch_id, servis_id, actor_id, action, to_value, payload)
  values (
    v_service.branch_id, v_service.id, auth.uid(), 'sparepart_return', v_row.name,
    jsonb_build_object('sparepart_line_id', v_row.id, 'sparepart_id', v_row.sparepart_id, 'product_id', v_row.product_id, 'qty', v_row.qty, 'reason', trim(p_reason))
  );
end;
$$;

revoke all on function public.return_service_spareparts(uuid, text) from public;
revoke all on function public.return_service_spareparts(uuid, text) from anon;
grant execute on function public.return_service_spareparts(uuid, text) to authenticated;

revoke all on function public.return_service_sparepart(uuid, text) from public;
revoke all on function public.return_service_sparepart(uuid, text) from anon;
grant execute on function public.return_service_sparepart(uuid, text) to authenticated;
