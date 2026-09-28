-- Pendekatan berbasis role untuk Cervise.
--
-- Spec: docs/superpowers/specs/2026-09-28-role-scoped-access-admin-design.md
--
-- Lima perubahan:
--   1. employees_insert/update/delete  -> ADMIN boleh, DIBATASI per cabang
--   2. branches_update                 -> ADMIN dicabut (read-only)
--   3. cervise_products write          -> keempat role boleh CRUD
--   4. cervise_sparepart_categories    -> TECHNICIAN boleh
--   5. adjust_product_stock()          -> TECHNICIAN boleh
--
-- Catatan soal (1). Policy lama memakai
--   has_tenant_role(organization_id, array['MASTER_ADMIN'])
-- yang tidak punya filter branch sama sekali: siapa pun yang punya role itu
-- di tenant tersebut bisa menyentuh baris karyawan di cabang mana pun. Begitu
-- ADMIN ikut diterima, filter branch menjadi wajib — kalau tidak, ADMIN di
-- cabang A bisa mengubah karyawan cabang B. Subquery di bawah membandingkan
-- branch milik baris TARGET (employees.branch_id) dengan branch milik caller.

-- ---------------------------------------------------------------------------
-- 1. employees: izinkan ADMIN, batasi ke cabang yang sama
-- ---------------------------------------------------------------------------

drop policy if exists employees_insert on public.employees;
create policy employees_insert on public.employees
for insert to authenticated
with check (
  public.is_platform_admin()
  or public.has_tenant_role(organization_id, array['MASTER_ADMIN']::text[])
  or exists (
    select 1
    from public.employees caller
    where caller.profile_id = auth.uid()
      and caller.organization_id = employees.organization_id
      and caller.branch_id = employees.branch_id
      and caller.role = 'ADMIN'
      and caller.is_active
  )
);

drop policy if exists employees_update on public.employees;
create policy employees_update on public.employees
for update to authenticated
using (
  public.is_platform_admin()
  or public.has_tenant_role(organization_id, array['MASTER_ADMIN']::text[])
  or exists (
    select 1
    from public.employees caller
    where caller.profile_id = auth.uid()
      and caller.organization_id = employees.organization_id
      and caller.branch_id = employees.branch_id
      and caller.role = 'ADMIN'
      and caller.is_active
  )
)
with check (
  public.is_platform_admin()
  or public.has_tenant_role(organization_id, array['MASTER_ADMIN']::text[])
  or exists (
    select 1
    from public.employees caller
    where caller.profile_id = auth.uid()
      and caller.organization_id = employees.organization_id
      and caller.branch_id = employees.branch_id
      and caller.role = 'ADMIN'
      and caller.is_active
  )
);

drop policy if exists employees_delete on public.employees;
create policy employees_delete on public.employees
for delete to authenticated
using (
  public.is_platform_admin()
  or public.has_tenant_role(organization_id, array['MASTER_ADMIN']::text[])
  or exists (
    select 1
    from public.employees caller
    where caller.profile_id = auth.uid()
      and caller.organization_id = employees.organization_id
      and caller.branch_id = employees.branch_id
      and caller.role = 'ADMIN'
      and caller.is_active
  )
);

-- ---------------------------------------------------------------------------
-- 2. branches: ADMIN read-only
-- ---------------------------------------------------------------------------
-- policy lama (20260925090000:336-339) mengizinkan ADMIN lewat
-- has_tenant_role(organization_id, ['MASTER_ADMIN','ADMIN']). ADMIN sekarang
-- hanya boleh membaca; perubahan data cabang milik MASTER_ADMIN.

drop policy if exists branches_update on public.branches;
create policy branches_update on public.branches
for update to authenticated
using (public.is_platform_admin() or (organization_id is not null and public.has_tenant_role(organization_id, array['MASTER_ADMIN']::text[])))
with check (public.is_platform_admin() or (organization_id is not null and public.has_tenant_role(organization_id, array['MASTER_ADMIN']::text[])));

-- ---------------------------------------------------------------------------
-- 3. cervise_products: semua role boleh CRUD
-- ---------------------------------------------------------------------------
-- Semua role boleh tulis metadata produk, termasuk FRONTLINER dan TEKNICIAN.
-- Kunci manager-only dari 20260925140000_lock_product_stock.sql dilonggarkan di
-- sini karena operasional harian butuh koreksi metadata dari kasir dan teknisi.
--
-- Yang TIDAK berubah: stock_qty tetap tidak bisa ditulis langsung. Grant update
-- kolom (20260925140000:20-23) tidak menyertakan stock_qty, jadi angka stok hanya
-- bisa berubah lewat adjust_product_stock() — yang sudah memeriksa role, branch,
-- dan optimistic lock di dalamnya.

drop policy if exists cervise_products_insert on public.cervise_products;
create policy cervise_products_insert
on public.cervise_products
for insert
to authenticated
with check (
  public.is_platform_admin()
  or public.has_tenant_branch_role(organization_id, branch_id, array['MASTER_ADMIN', 'ADMIN', 'FRONTLINER', 'TECHNICIAN']::text[])
);

drop policy if exists cervise_products_update on public.cervise_products;
create policy cervise_products_update
on public.cervise_products
for update
to authenticated
using (
  public.is_platform_admin()
  or public.has_tenant_branch_role(organization_id, branch_id, array['MASTER_ADMIN', 'ADMIN', 'FRONTLINER', 'TECHNICIAN']::text[])
)
with check (
  public.is_platform_admin()
  or public.has_tenant_branch_role(organization_id, branch_id, array['MASTER_ADMIN', 'ADMIN', 'FRONTLINER', 'TECHNICIAN']::text[])
);

drop policy if exists cervise_products_delete on public.cervise_products;
create policy cervise_products_delete
on public.cervise_products
for delete
to authenticated
using (
  public.is_platform_admin()
  or public.has_tenant_branch_role(organization_id, branch_id, array['MASTER_ADMIN', 'ADMIN', 'FRONTLINER', 'TECHNICIAN']::text[])
);

-- ---------------------------------------------------------------------------
-- 4. cervise_sparepart_categories: TECHNICIAN boleh CRUD
-- ---------------------------------------------------------------------------

drop policy if exists cervise_sparepart_categories_insert on public.cervise_sparepart_categories;
create policy cervise_sparepart_categories_insert on public.cervise_sparepart_categories
  for insert to authenticated
  with check (public.is_platform_admin() or public.can_access_tenant_branch(branch_id, array['MASTER_ADMIN','ADMIN','TECHNICIAN']::text[]));

drop policy if exists cervise_sparepart_categories_update on public.cervise_sparepart_categories;
create policy cervise_sparepart_categories_update on public.cervise_sparepart_categories
  for update to authenticated
  using (public.is_platform_admin() or public.can_access_tenant_branch(branch_id, array['MASTER_ADMIN','ADMIN','TECHNICIAN']::text[]))
  with check (public.is_platform_admin() or public.can_access_tenant_branch(branch_id, array['MASTER_ADMIN','ADMIN','TECHNICIAN']::text[]));

drop policy if exists cervise_sparepart_categories_delete on public.cervise_sparepart_categories;
create policy cervise_sparepart_categories_delete on public.cervise_sparepart_categories
  for delete to authenticated
  using (public.is_platform_admin() or public.can_access_tenant_branch(branch_id, array['MASTER_ADMIN','ADMIN','TECHNICIAN']::text[]));

-- ---------------------------------------------------------------------------
-- 5. adjust_product_stock(): TECHNICIAN boleh
-- ---------------------------------------------------------------------------
-- Fungsi ini tetap satu-satunya jalur perubahan stok. Melonggarkan Policy saja
-- tidak cukup — pengecekan role di dalam SECURITY DEFINER juga harus longgar.
create or replace function public.adjust_product_stock(
  p_product_id uuid,
  p_delta integer,
  p_expected_stock integer default null
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

  select * into v_product
  from public.cervise_products
  where id = p_product_id
  for update;

  if not found then
    raise exception 'produk tidak ditemukan';
  end if;

  if not (
    public.is_platform_admin()
    or public.has_tenant_branch_role(
      v_product.organization_id,
      v_product.branch_id,
      array['MASTER_ADMIN'::text, 'ADMIN'::text, 'FRONTLINER'::text, 'TECHNICIAN'::text]
    )
  ) then
    raise exception 'role tidak diizinkan mengubah stok';
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

  return v_next;
end;
$$;

revoke all on function public.adjust_product_stock(uuid, integer, integer) from public;
grant execute on function public.adjust_product_stock(uuid, integer, integer) to authenticated;
revoke all on function public.adjust_product_stock(uuid, integer, integer) from anon;

-- grant kolom tetap sama seperti 20260925140000; diulang agar migration ini
-- utuh kalau diterapkan ke database yang belum pernah menjalankan file itu.
grant update (sku, barcode, name, category, cost, price, is_active, variant_type, storage, warna, bh_percent, kondisi_notes, garansi_days, imei, parent_key)
  on table public.cervise_products to authenticated;
