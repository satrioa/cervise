-- Kunci write path inventory:
-- 1. update produk hanya untuk manager (technician/frontliner tidak boleh mengubah produk)
-- 2. stock_qty tidak lagi bisa ditulis langsung oleh klien
-- 3. perubahan stok harus lewat fungsi SECURITY DEFINER yang memvalidasi role, branch, dan optimistic lock
-- 4. view kompatibilitas cervise_spareparts dijaga read-only

drop policy if exists cervise_products_update on public.cervise_products;

create policy cervise_products_update_manager_only on public.cervise_products
  for update to authenticated
  using (
    public.is_platform_admin()
    or public.has_tenant_branch_role(organization_id, branch_id, array['MASTER_ADMIN'::text, 'ADMIN'::text])
  )
  with check (
    public.is_platform_admin()
    or public.has_tenant_branch_role(organization_id, branch_id, array['MASTER_ADMIN'::text, 'ADMIN'::text])
  );

revoke update on table public.cervise_products from authenticated;

grant update (sku, barcode, name, category, cost, price, is_active, variant_type, storage, warna, bh_percent, kondisi_notes, garansi_days, imei, parent_key)
  on table public.cervise_products to authenticated;

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
      array['MASTER_ADMIN'::text, 'ADMIN'::text, 'FRONTLINER'::text]
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

-- View kompatibilitas hanya baca: klien tidak boleh menulis lewat nama lama.
revoke insert, update, delete on public.cervise_branches, public.cervise_finance_tx, public.cervise_spareparts from authenticated;
revoke all on public.cervise_branches, public.cervise_finance_tx, public.cervise_spareparts from anon;
grant select on public.cervise_branches, public.cervise_finance_tx, public.cervise_spareparts to authenticated, service_role;
