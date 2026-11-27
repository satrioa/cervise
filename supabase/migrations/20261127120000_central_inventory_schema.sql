-- Master data tenant. Baris cabang di tabel lama jadi "stok saja".
create table if not exists public.cervise_central_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  kind text not null check (kind in ('SPAREPART','PRODUCT')),
  sku text not null,
  name text not null,
  category text not null default 'Sparepart',
  cost integer not null default 0 check (cost >= 0),
  price integer not null default 0 check (price >= 0),
  is_active boolean not null default true,
  is_serialized boolean not null default false,
  imei text,
  barcode text,
  variant_type text not null default 'BARU' check (variant_type in ('BARU','BEKAS')),
  storage text,
  warna text,
  bh_percent integer check (bh_percent is null or bh_percent between 0 and 100),
  kondisi_notes text,
  garansi_days integer check (garansi_days is null or garansi_days > 0),
  parent_key text,
  stock_qty integer not null default 0 check (stock_qty >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists cervise_central_items_sku_key
  on public.cervise_central_items(organization_id, kind, sku) where not is_serialized;
create unique index if not exists cervise_central_items_imei_key
  on public.cervise_central_items(organization_id, imei) where imei is not null;
create index if not exists cervise_central_items_org_kind_idx
  on public.cervise_central_items(organization_id, kind, name);

alter table public.cervise_central_items enable row level security;
drop policy if exists cervise_central_items_select on public.cervise_central_items;
create policy cervise_central_items_select on public.cervise_central_items
  for select to authenticated
  using (public.is_platform_admin() or public.has_tenant_role(
    organization_id, array['MASTER_ADMIN','ADMIN','FRONTLINER','TECHNICIAN']::text[]));
grant select on public.cervise_central_items to authenticated;
grant all on public.cervise_central_items to service_role;

create table if not exists public.cervise_stock_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  central_item_id uuid references public.cervise_central_items(id) on delete set null,
  sku text not null,
  qty integer not null check (qty > 0),
  decided_qty integer check (decided_qty is null or decided_qty > 0),
  status text not null default 'PENDING' check (status in ('PENDING','APPROVED','REJECTED')),
  note text,
  rejection_reason text,
  requested_by uuid references public.profiles(id) on delete set null,
  decided_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index if not exists cervise_stock_requests_branch_status_idx
  on public.cervise_stock_requests(branch_id, status, created_at desc);
alter table public.cervise_stock_requests enable row level security;
drop policy if exists cervise_stock_requests_select on public.cervise_stock_requests;
create policy cervise_stock_requests_select on public.cervise_stock_requests
  for select to authenticated
  using (public.is_platform_admin() or public.has_tenant_role(
    organization_id, array['MASTER_ADMIN','ADMIN','FRONTLINER','TECHNICIAN']::text[]));
drop policy if exists cervise_stock_requests_insert on public.cervise_stock_requests;
create policy cervise_stock_requests_insert on public.cervise_stock_requests
  for insert to authenticated
  with check (public.is_platform_admin() or public.has_tenant_branch_role(
    organization_id, branch_id, array['ADMIN','FRONTLINER']::text[]));
drop policy if exists cervise_stock_requests_update on public.cervise_stock_requests;
create policy cervise_stock_requests_update on public.cervise_stock_requests
  for update to authenticated
  using (public.is_platform_admin() or public.has_tenant_role(organization_id, array['MASTER_ADMIN']::text[]))
  with check (public.is_platform_admin() or public.has_tenant_role(organization_id, array['MASTER_ADMIN']::text[]));
grant select, insert, update on public.cervise_stock_requests to authenticated;

alter table public.cervise_spareparts
  add column if not exists central_item_id uuid references public.cervise_central_items(id) on delete restrict;
alter table public.cervise_products
  add column if not exists central_item_id uuid references public.cervise_central_items(id) on delete restrict;
alter table public.cervise_stock_movements
  add column if not exists central_item_id uuid references public.cervise_central_items(id) on delete restrict;
alter table public.cervise_stock_movements
  add column if not exists is_central_side boolean not null default false;
alter table public.cervise_stock_movements
  add column if not exists request_id uuid references public.cervise_stock_requests(id) on delete set null;

alter table public.cervise_stock_movements
  drop constraint if exists cervise_stock_movements_reason_check;
alter table public.cervise_stock_movements
  add constraint cervise_stock_movements_reason_check check (reason in (
    'service_use','service_return','sale','sale_return','stock_adjust',
    'purchase','transfer_in','transfer_out',
    'central_purchase','distribute','request_in','return_to_central'));
