create extension if not exists pgcrypto;

do $$
begin
  create type public.platform_admin_role as enum ('owner', 'billing_admin');
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create type public.cervise_subscription_status as enum ('trial', 'active', 'grace', 'blocked', 'suspended', 'cancelled');
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create type public.cervise_invoice_type as enum ('initial', 'renewal', 'upgrade');
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create type public.cervise_invoice_status as enum ('pending', 'approved', 'rejected', 'voided');
exception
  when duplicate_object then null;
end;
$$;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and char_length(slug) between 3 and 63),
  created_by uuid references auth.users(id) on delete set null,
  owner_email text,
  owner_phone text,
  contact_phone text,
  status text not null default 'trial' check (status in ('trial', 'active', 'grace', 'blocked', 'suspended', 'cancelled')),
  paket text,
  trial_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.branches add column if not exists organization_id uuid references public.organizations(id) on delete set null;
alter table public.branches add column if not exists city text;
alter table public.branches add column if not exists phone text;
alter table public.branches add column if not exists logo_url text;
alter table public.branches add column if not exists is_active boolean not null default true;
alter table public.branches add column if not exists is_intensif_enabled boolean not null default true;
alter table public.branches add column if not exists intensif_mode text not null default 'percent';
alter table public.branches add column if not exists intensif_value integer not null default 5;
alter table public.branches add column if not exists intensif_target_count integer;
alter table public.branches add column if not exists updated_at timestamptz not null default now();

alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists settings jsonb not null default '{}'::jsonb;
alter table public.profiles add column if not exists is_active boolean not null default true;
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

create index if not exists branches_organization_id_idx on public.branches(organization_id);
create index if not exists branches_organization_active_idx on public.branches(organization_id, is_active);
create index if not exists profiles_branch_id_idx on public.profiles(branch_id);

with grouped as (
  select
    owner_id,
    min(name) as name,
    max(trial_ends_at) as trial_ends_at
  from public.branches
  where owner_id is not null
  group by owner_id
)
insert into public.organizations (name, slug, created_by, status, paket, trial_ends_at)
select
  grouped.name,
  coalesce(nullif(rtrim(left(regexp_replace(lower(trim(grouped.name)), '[^a-z0-9]+', '-', 'g'), 54), '-'), ''), 'tenant')
    || '-' || left(grouped.owner_id::text, 8),
  grouped.owner_id,
  'trial',
  'trial',
  grouped.trial_ends_at
from grouped
on conflict (slug) do nothing;

update public.branches
set organization_id = organizations.id
from public.organizations
where branches.organization_id is null
  and branches.owner_id = organizations.created_by;

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('MASTER_ADMIN', 'ADMIN', 'FRONTLINER', 'TECHNICIAN')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, profile_id)
);

create index if not exists employees_profile_id_idx on public.employees(profile_id, is_active);
create index if not exists employees_organization_id_idx on public.employees(organization_id, is_active);
create index if not exists employees_branch_id_idx on public.employees(branch_id, is_active);

create table if not exists public.platform_admins (
  profile_id uuid primary key references auth.users(id) on delete cascade,
  role public.platform_admin_role not null default 'owner',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.platform_admins (profile_id, role)
select id, 'owner'::public.platform_admin_role
from public.profiles
where lower(role) = 'super_owner'
on conflict (profile_id) do nothing;

create table if not exists public.platform_settings (
  id boolean primary key default true check (id),
  renewal_lead_days integer not null default 7 check (renewal_lead_days between 1 and 30),
  default_grace_days integer not null default 3 check (default_grace_days between 0 and 30),
  owner_whatsapp text,
  owner_email text,
  updated_at timestamptz not null default now()
);

insert into public.platform_settings (id)
values (true)
on conflict (id) do nothing;

create table if not exists public.packages (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 80),
  description text,
  monthly_price integer not null check (monthly_price >= 0),
  branch_limit integer not null check (branch_limit >= 1),
  user_limit integer check (user_limit is null or user_limit >= 1),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.packages (code, name, description, monthly_price, branch_limit, user_limit, sort_order)
values
  ('trial', 'Trial', 'Akses gratis 14 hari', 0, 1, 3, 10),
  ('basic', 'Basic', 'Untuk operasional satu toko', 199000, 1, 3, 20),
  ('pro', 'Pro', 'Untuk tenant multi-cabang', 499000, 3, 15, 30)
on conflict (code) do update
set name = excluded.name,
    description = excluded.description,
    monthly_price = excluded.monthly_price,
    branch_limit = excluded.branch_limit,
    user_limit = excluded.user_limit,
    sort_order = excluded.sort_order,
    is_active = true;

create table if not exists public.tenant_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id) on delete cascade,
  package_id uuid not null references public.packages(id),
  custom_monthly_price integer check (custom_monthly_price is null or custom_monthly_price >= 0),
  status public.cervise_subscription_status not null default 'trial',
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  grace_days integer not null default 3 check (grace_days between 0 and 30),
  activated_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tenant_subscriptions_status_end_idx on public.tenant_subscriptions(status, current_period_end);
create index if not exists tenant_subscriptions_package_id_idx on public.tenant_subscriptions(package_id);

create sequence if not exists public.platform_invoice_number_seq start 1;

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.tenant_subscriptions(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  package_id uuid not null references public.packages(id),
  invoice_number text not null unique,
  invoice_type public.cervise_invoice_type not null,
  status public.cervise_invoice_status not null default 'pending',
  amount integer not null check (amount >= 0),
  period_start timestamptz not null,
  period_end timestamptz not null,
  due_date timestamptz not null,
  attempt integer not null default 1 check (attempt >= 1),
  replacement_for_id uuid references public.invoices(id) on delete set null,
  whatsapp_sent_at timestamptz,
  paid_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  decision_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (subscription_id, invoice_type, period_start, attempt),
  check (period_end > period_start)
);

create index if not exists invoices_status_due_idx on public.invoices(status, due_date);
create index if not exists invoices_organization_created_idx on public.invoices(organization_id, created_at desc);
create index if not exists invoices_pending_period_idx on public.invoices(subscription_id, period_start, status);

create table if not exists public.platform_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists platform_audit_logs_entity_idx on public.platform_audit_logs(entity_type, entity_id, created_at desc);
create index if not exists platform_audit_logs_actor_idx on public.platform_audit_logs(actor_user_id, created_at desc);

create or replace function public.is_platform_admin(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.platform_admins
    where profile_id = check_user_id
      and is_active = true
  );
$$;

create or replace function public.is_tenant_member(check_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.employees
    where organization_id = check_organization_id
      and profile_id = auth.uid()
      and is_active = true
  );
$$;

create or replace function public.has_tenant_role(
  check_organization_id uuid,
  allowed_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.employees
    where organization_id = check_organization_id
      and profile_id = auth.uid()
      and is_active = true
      and role = any(allowed_roles)
  ) or exists (
    select 1
    from public.organizations
    where id = check_organization_id
      and created_by = auth.uid()
  );
$$;

revoke all on function public.is_platform_admin(uuid) from public;
revoke all on function public.is_tenant_member(uuid) from public;
revoke all on function public.has_tenant_role(uuid, text[]) from public;
grant execute on function public.is_platform_admin(uuid) to authenticated;
grant execute on function public.is_tenant_member(uuid) to authenticated;
grant execute on function public.has_tenant_role(uuid, text[]) to authenticated;

alter table public.organizations enable row level security;
alter table public.employees enable row level security;
alter table public.platform_admins enable row level security;
alter table public.platform_settings enable row level security;
alter table public.packages enable row level security;
alter table public.tenant_subscriptions enable row level security;
alter table public.invoices enable row level security;
alter table public.platform_audit_logs enable row level security;

drop policy if exists "branches own" on public.branches;
drop policy if exists "profiles own" on public.profiles;
drop policy if exists "profiles insert own" on public.profiles;

create policy organizations_select on public.organizations
for select to authenticated
using (public.is_platform_admin() or public.is_tenant_member(id) or created_by = auth.uid());

create policy organizations_insert on public.organizations
for insert to authenticated
with check (created_by = auth.uid());

create policy organizations_update on public.organizations
for update to authenticated
using (public.is_platform_admin() or created_by = auth.uid() or public.has_tenant_role(id, array['MASTER_ADMIN']))
with check (public.is_platform_admin() or created_by = auth.uid() or public.has_tenant_role(id, array['MASTER_ADMIN']));

create policy organizations_delete on public.organizations
for delete to authenticated
using (public.is_platform_admin());

create policy branches_select on public.branches
for select to authenticated
using (
  public.is_platform_admin()
  or owner_id = auth.uid()
  or (organization_id is not null and public.is_tenant_member(organization_id))
);

create policy branches_insert on public.branches
for insert to authenticated
with check (public.is_platform_admin() or (organization_id is not null and public.has_tenant_role(organization_id, array['MASTER_ADMIN', 'ADMIN'])));

create policy branches_update on public.branches
for update to authenticated
using (public.is_platform_admin() or (organization_id is not null and public.has_tenant_role(organization_id, array['MASTER_ADMIN', 'ADMIN'])))
with check (public.is_platform_admin() or (organization_id is not null and public.has_tenant_role(organization_id, array['MASTER_ADMIN', 'ADMIN'])));

create policy branches_delete on public.branches
for delete to authenticated
using (public.is_platform_admin() or (organization_id is not null and public.has_tenant_role(organization_id, array['MASTER_ADMIN'])));

create policy employees_select on public.employees
for select to authenticated
using (public.is_platform_admin() or public.is_tenant_member(organization_id));

create policy employees_insert on public.employees
for insert to authenticated
with check (public.is_platform_admin() or public.has_tenant_role(organization_id, array['MASTER_ADMIN']));

create policy employees_update on public.employees
for update to authenticated
using (public.is_platform_admin() or public.has_tenant_role(organization_id, array['MASTER_ADMIN']))
with check (public.is_platform_admin() or public.has_tenant_role(organization_id, array['MASTER_ADMIN']));

create policy employees_delete on public.employees
for delete to authenticated
using (public.is_platform_admin() or public.has_tenant_role(organization_id, array['MASTER_ADMIN']));

create policy profiles_select on public.profiles
for select to authenticated
using (
  id = auth.uid()
  or public.is_platform_admin()
  or exists (
    select 1
    from public.employees subject_employee
    join public.employees viewer_employee
      on viewer_employee.organization_id = subject_employee.organization_id
    where subject_employee.profile_id = profiles.id
      and subject_employee.is_active = true
      and viewer_employee.profile_id = auth.uid()
      and viewer_employee.is_active = true
  )
);

create policy profiles_insert on public.profiles
for insert to authenticated
with check (id = auth.uid() or public.is_platform_admin());

create policy profiles_update on public.profiles
for update to authenticated
using (
  id = auth.uid()
  or public.is_platform_admin()
  or exists (
    select 1
    from public.employees
    where employees.profile_id = profiles.id
      and public.has_tenant_role(employees.organization_id, array['MASTER_ADMIN'])
  )
)
with check (
  id = auth.uid()
  or public.is_platform_admin()
  or exists (
    select 1
    from public.employees
    where employees.profile_id = profiles.id
      and public.has_tenant_role(employees.organization_id, array['MASTER_ADMIN'])
  )
);

create policy profiles_delete on public.profiles
for delete to authenticated
using (id = auth.uid() or public.is_platform_admin());

create policy platform_admins_select on public.platform_admins
for select to authenticated
using (profile_id = auth.uid() or public.is_platform_admin());

create policy platform_admins_insert on public.platform_admins
for insert to authenticated
with check (public.is_platform_admin());

create policy platform_admins_update on public.platform_admins
for update to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

create policy platform_admins_delete on public.platform_admins
for delete to authenticated
using (public.is_platform_admin());

create policy platform_settings_select on public.platform_settings
for select to authenticated
using (public.is_platform_admin());

create policy platform_settings_update on public.platform_settings
for update to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

create policy packages_select on public.packages
for select to authenticated
using (is_active or public.is_platform_admin());

create policy packages_admin_insert on public.packages
for insert to authenticated
with check (public.is_platform_admin());

create policy packages_admin_update on public.packages
for update to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

create policy packages_admin_delete on public.packages
for delete to authenticated
using (public.is_platform_admin());

create policy subscriptions_select on public.tenant_subscriptions
for select to authenticated
using (public.is_platform_admin() or public.is_tenant_member(organization_id));

create policy invoices_select on public.invoices
for select to authenticated
using (public.is_platform_admin() or public.is_tenant_member(organization_id));

create policy audit_logs_select on public.platform_audit_logs
for select to authenticated
using (public.is_platform_admin());

create policy audit_logs_insert on public.platform_audit_logs
for insert to authenticated
with check (public.is_platform_admin());

grant select, insert, update, delete on public.organizations to authenticated;
grant select, insert, update, delete on public.branches to authenticated;
grant select, insert, update, delete on public.employees to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select on public.platform_admins to authenticated;
grant insert, update, delete on public.platform_admins to authenticated;
grant select, update on public.platform_settings to authenticated;
grant select, insert, update, delete on public.packages to authenticated;
grant select on public.tenant_subscriptions to authenticated;
grant select on public.invoices to authenticated;
grant select, insert on public.platform_audit_logs to authenticated;

create or replace function public.set_platform_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger organizations_set_updated_at
before update on public.organizations
for each row execute function public.set_platform_updated_at();

create trigger branches_set_updated_at
before update on public.branches
for each row execute function public.set_platform_updated_at();

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_platform_updated_at();

create trigger employees_set_updated_at
before update on public.employees
for each row execute function public.set_platform_updated_at();

create trigger platform_admins_set_updated_at
before update on public.platform_admins
for each row execute function public.set_platform_updated_at();

create trigger platform_settings_set_updated_at
before update on public.platform_settings
for each row execute function public.set_platform_updated_at();

create trigger packages_set_updated_at
before update on public.packages
for each row execute function public.set_platform_updated_at();

create trigger subscriptions_set_updated_at
before update on public.tenant_subscriptions
for each row execute function public.set_platform_updated_at();

create trigger invoices_set_updated_at
before update on public.invoices
for each row execute function public.set_platform_updated_at();

create or replace function public.sync_organization_subscription()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.organizations
  set
    status = new.status::text,
    paket = (select code from public.packages where id = new.package_id),
    trial_ends_at = new.trial_ends_at,
    updated_at = now()
  where id = new.organization_id;
  return new;
end;
$$;

create trigger subscriptions_sync_organization
after insert or update of package_id, status, trial_ends_at on public.tenant_subscriptions
for each row execute function public.sync_organization_subscription();

create or replace function public.create_trial_subscription_for_organization()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  trial_package_id uuid;
  grace_days integer;
begin
  select id into trial_package_id
  from public.packages
  where code = 'trial' and is_active = true
  limit 1;

  select default_grace_days into grace_days
  from public.platform_settings
  where id = true;

  if trial_package_id is null then
    raise exception 'Trial package is not configured';
  end if;

  insert into public.tenant_subscriptions (
    organization_id,
    package_id,
    status,
    trial_started_at,
    trial_ends_at,
    current_period_start,
    current_period_end,
    grace_days
  )
  values (
    new.id,
    trial_package_id,
    'trial',
    now(),
    now() + interval '14 days',
    now(),
    now() + interval '14 days',
    coalesce(grace_days, 3)
  )
  on conflict (organization_id) do nothing;

  return new;
end;
$$;

create trigger organizations_create_trial_subscription
after insert on public.organizations
for each row execute function public.create_trial_subscription_for_organization();

create or replace function public.enforce_subscription_branch_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed_branches integer;
  active_branches integer;
begin
  if new.organization_id is null or new.is_active = false then
    return new;
  end if;

  select packages.branch_limit into allowed_branches
  from public.tenant_subscriptions
  join public.packages on packages.id = tenant_subscriptions.package_id
  where tenant_subscriptions.organization_id = new.organization_id;

  if allowed_branches is null then
    return new;
  end if;

  select count(*) into active_branches
  from public.branches
  where organization_id = new.organization_id
    and is_active = true
    and (new.id is null or id <> new.id);

  if active_branches >= allowed_branches then
    raise exception 'Branch limit for the current package has been reached';
  end if;

  return new;
end;
$$;

create trigger branches_enforce_subscription_limit
before insert or update of organization_id, is_active on public.branches
for each row execute function public.enforce_subscription_branch_limit();

create or replace function public.next_platform_invoice_number()
returns text
language sql
volatile
set search_path = public
as $$
  select 'INV-' || to_char(now(), 'YYYYMM') || '-' || lpad(nextval('public.platform_invoice_number_seq')::text, 4, '0');
$$;

create or replace function public.platform_create_tenant(
  tenant_name text,
  tenant_slug text,
  owner_user_id uuid default null,
  owner_email text default null,
  owner_phone text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_organization_id uuid;
  new_branch_id uuid;
begin
  if not public.is_platform_admin(auth.uid()) then
    raise exception 'Platform admin access required';
  end if;

  if char_length(trim(tenant_name)) not between 1 and 120 then
    raise exception 'Tenant name is invalid';
  end if;

  if trim(tenant_slug) !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' or char_length(trim(tenant_slug)) not between 3 and 63 then
    raise exception 'Tenant slug is invalid';
  end if;

  if owner_user_id is not null then
    insert into public.profiles (id, email, full_name, role)
    values (owner_user_id, owner_email, owner_email, 'master_admin')
    on conflict (id) do update
    set email = excluded.email;
  end if;

  insert into public.organizations (
    name,
    slug,
    created_by,
    owner_email,
    owner_phone,
    contact_phone,
    status
  )
  values (
    trim(tenant_name),
    trim(tenant_slug),
    owner_user_id,
    owner_email,
    owner_phone,
    owner_phone,
    'trial'
  )
  returning id into new_organization_id;

  insert into public.branches (organization_id, owner_id, name, city, phone, is_active)
  values (new_organization_id, owner_user_id, 'Cabang Pusat', null, owner_phone, true)
  returning id into new_branch_id;

  if owner_user_id is not null then
    update public.profiles
    set
      branch_id = new_branch_id,
      role = 'master_admin'
    where id = owner_user_id;

    insert into public.employees (organization_id, branch_id, profile_id, role, is_active)
    values (new_organization_id, new_branch_id, owner_user_id, 'MASTER_ADMIN', true)
    on conflict (organization_id, profile_id) do update
    set branch_id = excluded.branch_id,
        role = 'MASTER_ADMIN',
        is_active = true;
  end if;

  insert into public.platform_audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    'tenant.created',
    'organization',
    new_organization_id,
    jsonb_build_object('name', trim(tenant_name), 'slug', trim(tenant_slug), 'owner_user_id', owner_user_id)
  );

  return new_organization_id;
end;
$$;

create or replace function public.platform_create_billing_invoice(
  target_organization_id uuid,
  target_package_id uuid,
  invoice_type public.cervise_invoice_type
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_subscription public.tenant_subscriptions%rowtype;
  target_package public.packages%rowtype;
  existing_invoice_id uuid;
  new_invoice_id uuid;
  effective_amount integer;
  invoice_period_start timestamptz;
  invoice_period_end timestamptz;
  invoice_attempt integer;
begin
  if not public.is_platform_admin(auth.uid())
    and not public.has_tenant_role(target_organization_id, array['MASTER_ADMIN']) then
    raise exception 'Tenant owner access required';
  end if;

  if invoice_type = 'renewal' and not public.is_platform_admin(auth.uid()) then
    raise exception 'Renewal invoices are created automatically';
  end if;

  select * into current_subscription
  from public.tenant_subscriptions
  where organization_id = target_organization_id
  for update;

  if current_subscription.id is null then
    raise exception 'Subscription not found';
  end if;

  select * into target_package
  from public.packages
  where id = target_package_id and is_active = true;

  if target_package.id is null then
    raise exception 'Package not found';
  end if;

  select id into existing_invoice_id
  from public.invoices
  where subscription_id = current_subscription.id
    and package_id = target_package_id
    and invoice_type = invoice_type
    and status in ('pending', 'approved')
  order by created_at desc
  limit 1;

  if existing_invoice_id is not null then
    return existing_invoice_id;
  end if;

  effective_amount := case
    when current_subscription.package_id = target_package_id
      and current_subscription.custom_monthly_price is not null
      then current_subscription.custom_monthly_price
    else target_package.monthly_price
  end;

  if invoice_type = 'renewal' then
    invoice_period_start := current_subscription.current_period_end;
    invoice_period_end := current_subscription.current_period_end + interval '1 month';
  else
    invoice_period_start := now();
    invoice_period_end := now() + interval '1 month';
  end if;

  select coalesce(max(attempt), 0) + 1 into invoice_attempt
  from public.invoices
  where subscription_id = current_subscription.id
    and invoice_type = invoice_type
    and period_start = invoice_period_start;

  insert into public.invoices (
    subscription_id,
    organization_id,
    package_id,
    invoice_number,
    invoice_type,
    amount,
    period_start,
    period_end,
    due_date,
    attempt
  )
  values (
    current_subscription.id,
    target_organization_id,
    target_package_id,
    public.next_platform_invoice_number(),
    invoice_type,
    effective_amount,
    invoice_period_start,
    invoice_period_end,
    least(invoice_period_end, now() + interval '7 days'),
    invoice_attempt
  )
  returning id into new_invoice_id;

  insert into public.platform_audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    'invoice.created',
    'invoice',
    new_invoice_id,
    jsonb_build_object('organization_id', target_organization_id, 'package_id', target_package_id, 'type', invoice_type, 'amount', effective_amount)
  );

  return new_invoice_id;
end;
$$;

create or replace function public.platform_approve_invoice(
  target_invoice_id uuid,
  approval_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  invoice_row public.invoices%rowtype;
  subscription_row public.tenant_subscriptions%rowtype;
  approved_period_start timestamptz;
  approved_period_end timestamptz;
begin
  if not public.is_platform_admin(auth.uid()) then
    raise exception 'Platform admin access required';
  end if;

  select * into invoice_row
  from public.invoices
  where id = target_invoice_id
  for update;

  if invoice_row.id is null or invoice_row.status <> 'pending' then
    raise exception 'Pending invoice not found';
  end if;

  select * into subscription_row
  from public.tenant_subscriptions
  where id = invoice_row.subscription_id
  for update;

  if invoice_row.invoice_type = 'renewal' then
    approved_period_start := greatest(subscription_row.current_period_end, now());
  else
    approved_period_start := now();
  end if;

  approved_period_end := approved_period_start + interval '1 month';

  update public.invoices
  set
    status = 'approved',
    period_start = approved_period_start,
    period_end = approved_period_end,
    paid_at = now(),
    approved_by = auth.uid(),
    decision_note = nullif(trim(approval_note), '')
  where id = target_invoice_id;

  update public.invoices
  set
    status = 'voided',
    decision_note = 'Voided after another invoice was approved'
  where subscription_id = invoice_row.subscription_id
    and id <> target_invoice_id
    and status = 'pending'
    and period_start = invoice_row.period_start;

  update public.tenant_subscriptions
  set
    package_id = invoice_row.package_id,
    custom_monthly_price = case
      when package_id = invoice_row.package_id then custom_monthly_price
      else null
    end,
    status = 'active',
    current_period_start = approved_period_start,
    current_period_end = approved_period_end,
    activated_at = coalesce(activated_at, now()),
    cancelled_at = null
  where id = invoice_row.subscription_id;

  insert into public.platform_audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    'invoice.approved',
    'invoice',
    target_invoice_id,
    jsonb_build_object('subscription_id', invoice_row.subscription_id, 'amount', invoice_row.amount, 'period_start', approved_period_start, 'period_end', approved_period_end)
  );

  return subscription_row.id;
end;
$$;

create or replace function public.platform_reject_invoice(
  target_invoice_id uuid,
  rejection_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  invoice_row public.invoices%rowtype;
  replacement_invoice_id uuid;
  replacement_attempt integer;
begin
  if not public.is_platform_admin(auth.uid()) then
    raise exception 'Platform admin access required';
  end if;

  if char_length(trim(rejection_reason)) < 3 then
    raise exception 'Rejection reason is required';
  end if;

  select * into invoice_row
  from public.invoices
  where id = target_invoice_id
  for update;

  if invoice_row.id is null or invoice_row.status <> 'pending' then
    raise exception 'Pending invoice not found';
  end if;

  update public.invoices
  set
    status = 'rejected',
    decision_note = trim(rejection_reason)
  where id = target_invoice_id;

  select coalesce(max(attempt), 0) + 1 into replacement_attempt
  from public.invoices
  where subscription_id = invoice_row.subscription_id
    and invoice_type = invoice_row.invoice_type
    and period_start = invoice_row.period_start;

  insert into public.invoices (
    subscription_id,
    organization_id,
    package_id,
    invoice_number,
    invoice_type,
    amount,
    period_start,
    period_end,
    due_date,
    attempt,
    replacement_for_id
  )
  values (
    invoice_row.subscription_id,
    invoice_row.organization_id,
    invoice_row.package_id,
    public.next_platform_invoice_number(),
    invoice_row.invoice_type,
    invoice_row.amount,
    invoice_row.period_start,
    invoice_row.period_end,
    greatest(now(), invoice_row.due_date),
    replacement_attempt,
    invoice_row.id
  )
  returning id into replacement_invoice_id;

  insert into public.platform_audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    'invoice.rejected',
    'invoice',
    target_invoice_id,
    jsonb_build_object('replacement_invoice_id', replacement_invoice_id, 'reason', trim(rejection_reason))
  );

  return replacement_invoice_id;
end;
$$;

create or replace function public.platform_update_subscription(
  target_organization_id uuid,
  target_package_id uuid,
  custom_monthly_price integer,
  target_grace_days integer,
  target_status public.cervise_subscription_status
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  subscription_id uuid;
begin
  if not public.is_platform_admin(auth.uid()) then
    raise exception 'Platform admin access required';
  end if;

  if custom_monthly_price is not null and custom_monthly_price < 0 then
    raise exception 'Custom price must be zero or greater';
  end if;

  if target_grace_days not between 0 and 30 then
    raise exception 'Grace days must be between 0 and 30';
  end if;

  update public.tenant_subscriptions
  set
    package_id = target_package_id,
    custom_monthly_price = custom_monthly_price,
    grace_days = target_grace_days,
    status = target_status,
    activated_at = case when target_status = 'active' then coalesce(activated_at, now()) else activated_at end,
    cancelled_at = case when target_status = 'cancelled' then coalesce(cancelled_at, now()) else null end
  where organization_id = target_organization_id
  returning id into subscription_id;

  if subscription_id is null then
    raise exception 'Subscription not found';
  end if;

  insert into public.platform_audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    'subscription.updated',
    'subscription',
    subscription_id,
    jsonb_build_object('package_id', target_package_id, 'custom_price', custom_monthly_price, 'grace_days', target_grace_days, 'status', target_status)
  );

  return subscription_id;
end;
$$;

create or replace function public.process_subscription_renewals()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  renewal_settings public.platform_settings%rowtype;
  subscription_row record;
  created_count integer := 0;
  next_period_end timestamptz;
  effective_amount integer;
  renewal_attempt integer;
begin
  select * into renewal_settings
  from public.platform_settings
  where id = true;

  update public.tenant_subscriptions
  set status = 'blocked'::public.cervise_subscription_status
  where status = 'trial'
    and trial_ends_at <= now();

  update public.tenant_subscriptions
  set status = case
    when current_period_end + (grace_days * interval '1 day') <= now() then 'blocked'::public.cervise_subscription_status
    else 'grace'::public.cervise_subscription_status
  end
  where status in ('active', 'grace')
    and current_period_end <= now();

  for subscription_row in
    select
      tenant_subscriptions.*,
      coalesce(tenant_subscriptions.custom_monthly_price, packages.monthly_price) as invoice_amount
    from public.tenant_subscriptions
    join public.packages on packages.id = tenant_subscriptions.package_id
    where tenant_subscriptions.status in ('active', 'grace')
      and tenant_subscriptions.current_period_end <= now() + (renewal_settings.renewal_lead_days * interval '1 day')
      and not exists (
        select 1
        from public.invoices
        where invoices.subscription_id = tenant_subscriptions.id
          and invoices.invoice_type = 'renewal'
          and invoices.period_start = tenant_subscriptions.current_period_end
          and invoices.status in ('pending', 'approved')
      )
    for update of tenant_subscriptions
  loop
    next_period_end := subscription_row.current_period_end + interval '1 month';
    effective_amount := subscription_row.invoice_amount;

    select coalesce(max(attempt), 0) + 1 into renewal_attempt
    from public.invoices
    where subscription_id = subscription_row.id
      and invoice_type = 'renewal'
      and period_start = subscription_row.current_period_end;

    insert into public.invoices (
      subscription_id,
      organization_id,
      package_id,
      invoice_number,
      invoice_type,
      amount,
      period_start,
      period_end,
      due_date,
      attempt
    )
    values (
      subscription_row.id,
      subscription_row.organization_id,
      subscription_row.package_id,
      public.next_platform_invoice_number(),
      'renewal',
      effective_amount,
      subscription_row.current_period_end,
      next_period_end,
      subscription_row.current_period_end,
      renewal_attempt
    );

    created_count := created_count + 1;
  end loop;

  return created_count;
end;
$$;

create or replace function public.get_platform_contact()
returns table (owner_whatsapp text, owner_email text)
language sql
stable
security definer
set search_path = public
as $$
  select owner_whatsapp, owner_email
  from public.platform_settings
  where id = true;
$$;

revoke all on function public.next_platform_invoice_number() from public;
revoke all on function public.process_subscription_renewals() from public;
revoke all on function public.platform_create_tenant(text, text, uuid, text, text) from public;
revoke all on function public.platform_create_billing_invoice(uuid, uuid, public.cervise_invoice_type) from public;
revoke all on function public.platform_approve_invoice(uuid, text) from public;
revoke all on function public.platform_reject_invoice(uuid, text) from public;
revoke all on function public.platform_update_subscription(uuid, uuid, integer, integer, public.cervise_subscription_status) from public;
revoke all on function public.get_platform_contact() from public;

grant execute on function public.platform_create_tenant(text, text, uuid, text, text) to authenticated;
grant execute on function public.platform_create_billing_invoice(uuid, uuid, public.cervise_invoice_type) to authenticated;
grant execute on function public.platform_approve_invoice(uuid, text) to authenticated;
grant execute on function public.platform_reject_invoice(uuid, text) to authenticated;
grant execute on function public.platform_update_subscription(uuid, uuid, integer, integer, public.cervise_subscription_status) to authenticated;
grant execute on function public.get_platform_contact() to authenticated;
grant execute on function public.process_subscription_renewals() to service_role;

create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;

select cron.schedule(
  'cervise-process-subscription-renewals',
  '5 * * * *',
  'select public.process_subscription_renewals()'
);
