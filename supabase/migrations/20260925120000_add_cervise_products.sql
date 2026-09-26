create table if not exists public.cervise_products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  sku text not null,
  barcode text,
  name text not null,
  category text not null default 'Lainnya',
  stock_qty integer not null default 0 check (stock_qty >= 0),
  cost integer not null default 0 check (cost >= 0),
  price integer not null default 0 check (price >= 0),
  is_serialized boolean not null default false,
  is_active boolean not null default true,
  variant_type text not null default 'BARU' check (variant_type in ('BARU', 'BEKAS')),
  storage text,
  warna text,
  bh_percent integer check (bh_percent is null or bh_percent between 0 and 100),
  kondisi_notes text,
  garansi_days integer check (garansi_days is null or garansi_days > 0),
  imei text,
  parent_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (branch_id, sku)
);

create index if not exists cervise_products_branch_idx on public.cervise_products(branch_id, is_active);
create index if not exists cervise_products_organization_idx on public.cervise_products(organization_id, is_active);
create index if not exists cervise_products_parent_key_idx on public.cervise_products(parent_key, variant_type);
create unique index if not exists cervise_products_branch_imei_unique
  on public.cervise_products(branch_id, imei)
  where imei is not null;

create or replace function public.is_tenant_branch_member(check_organization_id uuid, check_branch_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.employees
    where profile_id = auth.uid()
      and organization_id = check_organization_id
      and branch_id = check_branch_id
      and is_active = true
  );
$$;

create or replace function public.has_tenant_branch_role(check_organization_id uuid, check_branch_id uuid, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.employees
    where profile_id = auth.uid()
      and organization_id = check_organization_id
      and branch_id = check_branch_id
      and is_active = true
      and role = any(allowed_roles)
  );
$$;

revoke all on function public.is_tenant_branch_member(uuid, uuid) from public;
revoke all on function public.has_tenant_branch_role(uuid, uuid, text[]) from public;
grant execute on function public.is_tenant_branch_member(uuid, uuid) to authenticated;
grant execute on function public.has_tenant_branch_role(uuid, uuid, text[]) to authenticated;

alter table public.cervise_products enable row level security;

drop policy if exists cervise_products_select on public.cervise_products;
drop policy if exists cervise_products_insert on public.cervise_products;
drop policy if exists cervise_products_update on public.cervise_products;
drop policy if exists cervise_products_delete on public.cervise_products;

create policy cervise_products_select
on public.cervise_products
for select
to authenticated
using (public.is_platform_admin() or public.is_tenant_branch_member(organization_id, branch_id));

create policy cervise_products_insert
on public.cervise_products
for insert
to authenticated
with check (
  public.is_platform_admin()
  or public.has_tenant_branch_role(organization_id, branch_id, array['MASTER_ADMIN', 'ADMIN', 'FRONTLINER']::text[])
);

create policy cervise_products_update
on public.cervise_products
for update
to authenticated
using (public.is_platform_admin() or public.is_tenant_branch_member(organization_id, branch_id))
with check (
  public.is_platform_admin()
  or public.has_tenant_branch_role(organization_id, branch_id, array['MASTER_ADMIN', 'ADMIN', 'FRONTLINER']::text[])
);

create policy cervise_products_delete
on public.cervise_products
for delete
to authenticated
using (public.is_platform_admin() or public.has_tenant_branch_role(organization_id, branch_id, array['MASTER_ADMIN', 'ADMIN']::text[]));

grant select, insert, update, delete on public.cervise_products to authenticated;
grant select, insert, update, delete on public.cervise_products to service_role;

create or replace function public.set_cervise_products_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists cervise_products_updated_at on public.cervise_products;
create trigger cervise_products_updated_at
before update on public.cervise_products
for each row
execute function public.set_cervise_products_updated_at();
