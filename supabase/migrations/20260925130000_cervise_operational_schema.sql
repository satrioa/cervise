alter table public.customers
  add column if not exists tags jsonb not null default '[]'::jsonb;

create table if not exists public.cervise_customers (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  name text not null,
  phone text not null,
  address text,
  tags jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (branch_id, phone)
);

create index if not exists cervise_customers_branch_idx on public.cervise_customers(branch_id, created_at desc);
create index if not exists cervise_customers_phone_idx on public.cervise_customers(phone);

create table if not exists public.cervise_services (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  customer_id uuid references public.cervise_customers(id) on delete set null,
  device text not null,
  complaint text,
  status text not null default 'Masuk' check (status in ('Masuk', 'Diagnosa', 'Menunggu Konfirmasi', 'Menunggu Sparepart', 'Dikerjakan', 'Selesai', 'Sudah Diambil', 'Batal')),
  teknisi_id uuid references public.profiles(id) on delete set null,
  price integer not null default 0 check (price >= 0),
  price_estimasi integer check (price_estimasi is null or price_estimasi >= 0),
  merk text,
  tipe text,
  imei1 text,
  imei2 text,
  kerusakan text[] not null default '{}',
  kelengkapan text[] not null default '{}',
  password_type text check (password_type is null or password_type in ('PIN', 'POLA')),
  password_value text,
  garansi_value integer check (garansi_value is null or garansi_value > 0),
  garansi_unit text check (garansi_unit is null or garansi_unit in ('hari', 'bulan', 'tahun')),
  kondisi_awal jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  garansi_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cervise_services_branch_status_idx on public.cervise_services(branch_id, status, created_at desc);
create index if not exists cervise_services_customer_idx on public.cervise_services(customer_id, created_at desc);
create index if not exists cervise_services_garansi_idx on public.cervise_services(garansi_until) where garansi_until is not null;
create index if not exists cervise_services_imei_idx on public.cervise_services(branch_id, imei1);

create table if not exists public.cervise_service_tags (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  name text not null,
  usage_count integer not null default 0 check (usage_count >= 0),
  created_at timestamptz not null default now(),
  unique (branch_id, name)
);

create index if not exists cervise_service_tags_usage_idx on public.cervise_service_tags(branch_id, usage_count desc);

create table if not exists public.cervise_kelengkapan_options (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (branch_id, name)
);

create table if not exists public.cervise_service_logs (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  servis_id uuid not null references public.cervise_services(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  from_value text,
  to_value text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists cervise_service_logs_service_idx on public.cervise_service_logs(servis_id, created_at desc);
create index if not exists cervise_service_logs_branch_idx on public.cervise_service_logs(branch_id, created_at desc);

create table if not exists public.cervise_sales (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  customer_id uuid references public.cervise_customers(id) on delete set null,
  sale_number text not null unique,
  subtotal integer not null default 0 check (subtotal >= 0),
  discount_total integer not null default 0 check (discount_total >= 0),
  total integer not null default 0 check (total >= 0),
  paid integer not null default 0 check (paid >= 0),
  payment_status text not null default 'belum_bayar',
  payment_method text,
  status text not null default 'selesai',
  kas_date date not null default current_date,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cervise_sales_branch_date_idx on public.cervise_sales(branch_id, kas_date desc, created_at desc);
create index if not exists cervise_sales_customer_idx on public.cervise_sales(customer_id, created_at desc);

create table if not exists public.cervise_sales_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.cervise_sales(id) on delete cascade,
  product_id uuid not null references public.cervise_products(id) on delete restrict,
  sku text not null,
  name text not null,
  category text,
  qty integer not null check (qty > 0),
  cost integer not null default 0 check (cost >= 0),
  unit_price integer not null default 0 check (unit_price >= 0),
  line_total integer not null default 0 check (line_total >= 0),
  is_serialized boolean not null default false,
  item_meta jsonb not null default '{}'::jsonb,
  qty_returned integer not null default 0 check (qty_returned >= 0),
  created_at timestamptz not null default now()
);

create index if not exists cervise_sales_items_sale_idx on public.cervise_sales_items(sale_id);
create index if not exists cervise_sales_items_product_idx on public.cervise_sales_items(product_id);

create table if not exists public.cervise_sparepart_categories (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  unique (branch_id, name)
);

create index if not exists cervise_sparepart_categories_branch_idx on public.cervise_sparepart_categories(branch_id, name);

alter table public.finance_tx
  add column if not exists metode text,
  add column if not exists keterangan text,
  add column if not exists servis_id uuid references public.cervise_services(id) on delete set null;

create index if not exists finance_tx_servis_idx on public.finance_tx(servis_id) where servis_id is not null;
create index if not exists finance_tx_branch_date_idx on public.finance_tx(branch_id, kas_date desc, created_at desc);

create or replace function public.cervise_sale_item_branch(check_sale_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select branch_id from public.cervise_sales where id = check_sale_id;
$$;

create or replace function public.cervise_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists cervise_services_updated_at on public.cervise_services;
create trigger cervise_services_updated_at before update on public.cervise_services for each row execute function public.cervise_touch_updated_at();
drop trigger if exists cervise_sales_updated_at on public.cervise_sales;
create trigger cervise_sales_updated_at before update on public.cervise_sales for each row execute function public.cervise_touch_updated_at();

alter table public.cervise_customers enable row level security;
alter table public.cervise_services enable row level security;
alter table public.cervise_service_tags enable row level security;
alter table public.cervise_kelengkapan_options enable row level security;
alter table public.cervise_service_logs enable row level security;
alter table public.cervise_sales enable row level security;
alter table public.cervise_sales_items enable row level security;
alter table public.cervise_sparepart_categories enable row level security;

drop policy if exists cervise_customers_select on public.cervise_customers;
create policy cervise_customers_select on public.cervise_customers for select to authenticated using (public.is_platform_admin() or public.can_access_tenant_branch(branch_id));
drop policy if exists cervise_customers_insert on public.cervise_customers;
create policy cervise_customers_insert on public.cervise_customers for insert to authenticated with check (public.is_platform_admin() or public.can_access_tenant_branch(branch_id, array['MASTER_ADMIN','ADMIN','FRONTLINER']::text[]));
drop policy if exists cervise_customers_update on public.cervise_customers;
create policy cervise_customers_update on public.cervise_customers for update to authenticated using (public.is_platform_admin() or public.can_access_tenant_branch(branch_id)) with check (public.is_platform_admin() or public.can_access_tenant_branch(branch_id, array['MASTER_ADMIN','ADMIN','FRONTLINER']::text[]));
drop policy if exists cervise_customers_delete on public.cervise_customers;
create policy cervise_customers_delete on public.cervise_customers for delete to authenticated using (public.is_platform_admin() or public.can_access_tenant_branch(branch_id, array['MASTER_ADMIN','ADMIN']::text[]));

drop policy if exists cervise_services_select on public.cervise_services;
create policy cervise_services_select on public.cervise_services for select to authenticated using (public.is_platform_admin() or public.can_access_tenant_branch(branch_id));
drop policy if exists cervise_services_insert on public.cervise_services;
create policy cervise_services_insert on public.cervise_services for insert to authenticated with check (public.is_platform_admin() or public.can_access_tenant_branch(branch_id, array['MASTER_ADMIN','ADMIN','FRONTLINER']::text[]));
drop policy if exists cervise_services_update on public.cervise_services;
create policy cervise_services_update on public.cervise_services for update to authenticated using (public.is_platform_admin() or public.can_access_tenant_branch(branch_id)) with check (public.is_platform_admin() or public.can_access_tenant_branch(branch_id, array['MASTER_ADMIN','ADMIN','FRONTLINER']::text[]));
drop policy if exists cervise_services_delete on public.cervise_services;
create policy cervise_services_delete on public.cervise_services for delete to authenticated using (public.is_platform_admin() or public.can_access_tenant_branch(branch_id, array['MASTER_ADMIN','ADMIN']::text[]));

drop policy if exists cervise_service_tags_select on public.cervise_service_tags;
create policy cervise_service_tags_select on public.cervise_service_tags for select to authenticated using (public.is_platform_admin() or public.can_access_tenant_branch(branch_id));
drop policy if exists cervise_service_tags_write on public.cervise_service_tags;
create policy cervise_service_tags_write on public.cervise_service_tags for all to authenticated using (public.is_platform_admin() or public.can_access_tenant_branch(branch_id, array['MASTER_ADMIN','ADMIN','FRONTLINER']::text[])) with check (public.is_platform_admin() or public.can_access_tenant_branch(branch_id, array['MASTER_ADMIN','ADMIN','FRONTLINER']::text[]));

drop policy if exists cervise_kelengkapan_options_select on public.cervise_kelengkapan_options;
create policy cervise_kelengkapan_options_select on public.cervise_kelengkapan_options for select to authenticated using (public.is_platform_admin() or public.can_access_tenant_branch(branch_id));
drop policy if exists cervise_kelengkapan_options_write on public.cervise_kelengkapan_options;
create policy cervise_kelengkapan_options_write on public.cervise_kelengkapan_options for all to authenticated using (public.is_platform_admin() or public.can_access_tenant_branch(branch_id, array['MASTER_ADMIN','ADMIN','FRONTLINER']::text[])) with check (public.is_platform_admin() or public.can_access_tenant_branch(branch_id, array['MASTER_ADMIN','ADMIN','FRONTLINER']::text[]));

drop policy if exists cervise_service_logs_select on public.cervise_service_logs;
create policy cervise_service_logs_select on public.cervise_service_logs for select to authenticated using (public.is_platform_admin() or public.can_access_tenant_branch(branch_id));
drop policy if exists cervise_service_logs_insert on public.cervise_service_logs;
create policy cervise_service_logs_insert on public.cervise_service_logs for insert to authenticated with check (public.is_platform_admin() or public.can_access_tenant_branch(branch_id, array['MASTER_ADMIN','ADMIN','FRONTLINER','TECHNICIAN']::text[]));

drop policy if exists cervise_sales_select on public.cervise_sales;
create policy cervise_sales_select on public.cervise_sales for select to authenticated using (public.is_platform_admin() or public.can_access_tenant_branch(branch_id));
drop policy if exists cervise_sales_insert on public.cervise_sales;
create policy cervise_sales_insert on public.cervise_sales for insert to authenticated with check (public.is_platform_admin() or public.can_access_tenant_branch(branch_id, array['MASTER_ADMIN','ADMIN','FRONTLINER']::text[]));
drop policy if exists cervise_sales_update on public.cervise_sales;
create policy cervise_sales_update on public.cervise_sales for update to authenticated using (public.is_platform_admin() or public.can_access_tenant_branch(branch_id)) with check (public.is_platform_admin() or public.can_access_tenant_branch(branch_id, array['MASTER_ADMIN','ADMIN','FRONTLINER']::text[]));
drop policy if exists cervise_sales_delete on public.cervise_sales;
create policy cervise_sales_delete on public.cervise_sales for delete to authenticated using (public.is_platform_admin() or public.can_access_tenant_branch(branch_id, array['MASTER_ADMIN','ADMIN']::text[]));

drop policy if exists cervise_sales_items_select on public.cervise_sales_items;
create policy cervise_sales_items_select on public.cervise_sales_items for select to authenticated using (public.is_platform_admin() or public.can_access_tenant_branch(public.cervise_sale_item_branch(sale_id)));
drop policy if exists cervise_sales_items_insert on public.cervise_sales_items;
create policy cervise_sales_items_insert on public.cervise_sales_items for insert to authenticated with check (public.is_platform_admin() or public.can_access_tenant_branch(public.cervise_sale_item_branch(sale_id), array['MASTER_ADMIN','ADMIN','FRONTLINER']::text[]));
drop policy if exists cervise_sales_items_update on public.cervise_sales_items;
create policy cervise_sales_items_update on public.cervise_sales_items for update to authenticated using (public.is_platform_admin() or public.can_access_tenant_branch(public.cervise_sale_item_branch(sale_id))) with check (public.is_platform_admin() or public.can_access_tenant_branch(public.cervise_sale_item_branch(sale_id), array['MASTER_ADMIN','ADMIN','FRONTLINER']::text[]));
drop policy if exists cervise_sales_items_delete on public.cervise_sales_items;
create policy cervise_sales_items_delete on public.cervise_sales_items for delete to authenticated using (public.is_platform_admin() or public.can_access_tenant_branch(public.cervise_sale_item_branch(sale_id), array['MASTER_ADMIN','ADMIN']::text[]));

drop policy if exists cervise_sparepart_categories_select on public.cervise_sparepart_categories;
create policy cervise_sparepart_categories_select on public.cervise_sparepart_categories for select to authenticated using (public.is_platform_admin() or public.can_access_tenant_branch(branch_id));
drop policy if exists cervise_sparepart_categories_insert on public.cervise_sparepart_categories;
create policy cervise_sparepart_categories_insert on public.cervise_sparepart_categories for insert to authenticated with check (public.is_platform_admin() or public.can_access_tenant_branch(branch_id, array['MASTER_ADMIN','ADMIN']::text[]));
drop policy if exists cervise_sparepart_categories_update on public.cervise_sparepart_categories;
create policy cervise_sparepart_categories_update on public.cervise_sparepart_categories for update to authenticated using (public.is_platform_admin() or public.can_access_tenant_branch(branch_id)) with check (public.is_platform_admin() or public.can_access_tenant_branch(branch_id, array['MASTER_ADMIN','ADMIN']::text[]));
drop policy if exists cervise_sparepart_categories_delete on public.cervise_sparepart_categories;
create policy cervise_sparepart_categories_delete on public.cervise_sparepart_categories for delete to authenticated using (public.is_platform_admin() or public.can_access_tenant_branch(branch_id, array['MASTER_ADMIN','ADMIN']::text[]));

grant select, insert, update, delete on public.cervise_customers, public.cervise_services, public.cervise_service_tags, public.cervise_kelengkapan_options, public.cervise_service_logs, public.cervise_sales, public.cervise_sales_items, public.cervise_sparepart_categories to authenticated;
grant select, insert, update, delete on public.cervise_customers, public.cervise_services, public.cervise_service_tags, public.cervise_kelengkapan_options, public.cervise_service_logs, public.cervise_sales, public.cervise_sales_items, public.cervise_sparepart_categories to service_role;
revoke all on public.cervise_customers, public.cervise_services, public.cervise_service_tags, public.cervise_kelengkapan_options, public.cervise_service_logs, public.cervise_sales, public.cervise_sales_items, public.cervise_sparepart_categories from anon;

create or replace view public.cervise_branches with (security_invoker = true) as
select id, name, logo_url from public.branches;
create or replace view public.cervise_finance_tx with (security_invoker = true) as
select id, branch_id, servis_id, type, amount, kas_date, metode, keterangan, description, created_by, created_at from public.finance_tx;
create or replace view public.cervise_spareparts with (security_invoker = true) as
select id, branch_id, category, stock_qty from public.cervise_products;

-- View kompatibilitas hanya baca: mencegah klien mengubah branches/finance_tx/stok langsung.
grant select on public.cervise_branches, public.cervise_finance_tx, public.cervise_spareparts to authenticated;
grant select on public.cervise_branches, public.cervise_finance_tx, public.cervise_spareparts to service_role;
revoke insert, update, delete on public.cervise_branches, public.cervise_finance_tx, public.cervise_spareparts from authenticated;
revoke all on public.cervise_branches, public.cervise_finance_tx, public.cervise_spareparts from anon;
