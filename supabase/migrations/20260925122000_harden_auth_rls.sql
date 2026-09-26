revoke all on function public.process_subscription_renewals() from public, anon, authenticated;
grant execute on function public.process_subscription_renewals() to service_role;

revoke all on function public.is_platform_admin(uuid) from public, anon;
grant execute on function public.is_platform_admin(uuid) to authenticated;
revoke all on function public.is_tenant_member(uuid) from public, anon;
grant execute on function public.is_tenant_member(uuid) to authenticated;
revoke all on function public.has_tenant_role(uuid, text[]) from public, anon;
grant execute on function public.has_tenant_role(uuid, text[]) to authenticated;

revoke all on function public.platform_create_tenant(text, text, uuid, text, text) from public, anon;
grant execute on function public.platform_create_tenant(text, text, uuid, text, text) to authenticated;
revoke all on function public.platform_create_billing_invoice(uuid, uuid, public.cervise_invoice_type) from public, anon;
grant execute on function public.platform_create_billing_invoice(uuid, uuid, public.cervise_invoice_type) to authenticated;
revoke all on function public.platform_approve_invoice(uuid, text) from public, anon;
grant execute on function public.platform_approve_invoice(uuid, text) to authenticated;
revoke all on function public.platform_reject_invoice(uuid, text) from public, anon;
grant execute on function public.platform_reject_invoice(uuid, text) to authenticated;
revoke all on function public.platform_update_subscription(uuid, uuid, integer, integer, public.cervise_subscription_status) from public, anon;
grant execute on function public.platform_update_subscription(uuid, uuid, integer, integer, public.cervise_subscription_status) to authenticated;
revoke all on function public.get_platform_contact() from public, anon;
grant execute on function public.get_platform_contact() to authenticated;
revoke all on function public.complete_tenant_onboarding(text, text, text, text, text) from public, anon;
grant execute on function public.complete_tenant_onboarding(text, text, text, text, text) to authenticated;

revoke all on function public.create_trial_subscription_for_organization() from public, anon, authenticated;
revoke all on function public.enforce_subscription_branch_limit() from public, anon, authenticated;
revoke all on function public.sync_organization_subscription() from public, anon, authenticated;
revoke all on function public.set_platform_updated_at() from public, anon, authenticated;
revoke all on function public.set_garansi() from public, anon, authenticated;
revoke all on function public.next_platform_invoice_number() from public, anon, authenticated;

revoke all on table public.customers, public.services, public.spareparts, public.finance_tx from public, anon;
revoke insert, update, delete on table public.profiles from authenticated;
grant update (full_name, phone, settings) on table public.profiles to authenticated;
revoke insert, update, delete on table public.organizations from authenticated;

create or replace function public.is_tenant_member(check_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.employees employee
    join public.profiles profile on profile.id = employee.profile_id
    join public.organizations organization on organization.id = employee.organization_id
    join public.tenant_subscriptions subscription on subscription.organization_id = organization.id
    where employee.organization_id = check_organization_id
      and employee.profile_id = auth.uid()
      and employee.is_active = true
      and profile.is_active = true
      and organization.status not in ('blocked', 'suspended', 'cancelled')
      and (
        (subscription.status = 'trial' and subscription.trial_ends_at > now())
        or (
          subscription.status in ('active', 'grace')
          and subscription.current_period_end + (subscription.grace_days * interval '1 day') > now()
        )
      )
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
    from public.employees employee
    join public.profiles profile on profile.id = employee.profile_id
    join public.organizations organization on organization.id = employee.organization_id
    join public.tenant_subscriptions subscription on subscription.organization_id = organization.id
    where employee.organization_id = check_organization_id
      and employee.profile_id = auth.uid()
      and employee.is_active = true
      and profile.is_active = true
      and employee.role = any(allowed_roles)
      and organization.status not in ('blocked', 'suspended', 'cancelled')
      and (
        (subscription.status = 'trial' and subscription.trial_ends_at > now())
        or (
          subscription.status in ('active', 'grace')
          and subscription.current_period_end + (subscription.grace_days * interval '1 day') > now()
        )
      )
  );
$$;

revoke all on function public.is_tenant_member(uuid) from public, anon;
grant execute on function public.is_tenant_member(uuid) to authenticated;
revoke all on function public.has_tenant_role(uuid, text[]) from public, anon;
grant execute on function public.has_tenant_role(uuid, text[]) to authenticated;

create or replace function public.can_access_tenant_branch(
  check_branch_id uuid,
  allowed_roles text[] default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.employees employee
    join public.profiles profile on profile.id = employee.profile_id
    join public.branches branch on branch.id = employee.branch_id
    join public.organizations organization on organization.id = employee.organization_id
    join public.tenant_subscriptions subscription on subscription.organization_id = organization.id
    where employee.profile_id = auth.uid()
      and employee.is_active = true
      and profile.is_active = true
      and branch.id = check_branch_id
      and branch.organization_id = employee.organization_id
      and branch.is_active = true
      and (allowed_roles is null or employee.role = any(allowed_roles))
      and organization.status not in ('blocked', 'suspended', 'cancelled')
      and (
        (subscription.status = 'trial' and subscription.trial_ends_at > now())
        or (
          subscription.status in ('active', 'grace')
          and subscription.current_period_end + (subscription.grace_days * interval '1 day') > now()
        )
      )
  );
$$;

revoke all on function public.can_access_tenant_branch(uuid, text[]) from public, anon;
grant execute on function public.can_access_tenant_branch(uuid, text[]) to authenticated;

create or replace function public.is_tenant_branch_member(
  check_organization_id uuid,
  check_branch_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.employees employee
    join public.profiles profile on profile.id = employee.profile_id
    join public.branches branch on branch.id = employee.branch_id
    join public.organizations organization on organization.id = employee.organization_id
    join public.tenant_subscriptions subscription on subscription.organization_id = organization.id
    where employee.profile_id = auth.uid()
      and employee.organization_id = check_organization_id
      and employee.branch_id = check_branch_id
      and employee.is_active = true
      and profile.is_active = true
      and branch.organization_id = employee.organization_id
      and branch.is_active = true
      and organization.status not in ('blocked', 'suspended', 'cancelled')
      and (
        (subscription.status = 'trial' and subscription.trial_ends_at > now())
        or (
          subscription.status in ('active', 'grace')
          and subscription.current_period_end + (subscription.grace_days * interval '1 day') > now()
        )
      )
  );
$$;

create or replace function public.has_tenant_branch_role(
  check_organization_id uuid,
  check_branch_id uuid,
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
    from public.employees employee
    join public.profiles profile on profile.id = employee.profile_id
    join public.branches branch on branch.id = employee.branch_id
    join public.organizations organization on organization.id = employee.organization_id
    join public.tenant_subscriptions subscription on subscription.organization_id = organization.id
    where employee.profile_id = auth.uid()
      and employee.organization_id = check_organization_id
      and employee.branch_id = check_branch_id
      and employee.is_active = true
      and profile.is_active = true
      and employee.role = any(allowed_roles)
      and branch.organization_id = employee.organization_id
      and branch.is_active = true
      and organization.status not in ('blocked', 'suspended', 'cancelled')
      and (
        (subscription.status = 'trial' and subscription.trial_ends_at > now())
        or (
          subscription.status in ('active', 'grace')
          and subscription.current_period_end + (subscription.grace_days * interval '1 day') > now()
        )
      )
  );
$$;

revoke all on function public.is_tenant_branch_member(uuid, uuid) from public, anon;
grant execute on function public.is_tenant_branch_member(uuid, uuid) to authenticated;
revoke all on function public.has_tenant_branch_role(uuid, uuid, text[]) from public, anon;
grant execute on function public.has_tenant_branch_role(uuid, uuid, text[]) to authenticated;

drop policy if exists "customers branch isolation" on public.customers;
create policy customers_select on public.customers
for select to authenticated
using (public.can_access_tenant_branch(branch_id));
create policy customers_insert on public.customers
for insert to authenticated
with check (public.can_access_tenant_branch(branch_id));
create policy customers_update on public.customers
for update to authenticated
using (public.can_access_tenant_branch(branch_id))
with check (public.can_access_tenant_branch(branch_id));
create policy customers_delete on public.customers
for delete to authenticated
using (public.can_access_tenant_branch(branch_id));

drop policy if exists "services branch isolation" on public.services;
create policy services_select on public.services
for select to authenticated
using (public.can_access_tenant_branch(branch_id));
create policy services_insert on public.services
for insert to authenticated
with check (public.can_access_tenant_branch(branch_id));
create policy services_update on public.services
for update to authenticated
using (public.can_access_tenant_branch(branch_id))
with check (public.can_access_tenant_branch(branch_id));
create policy services_delete on public.services
for delete to authenticated
using (public.can_access_tenant_branch(branch_id));

drop policy if exists "spareparts branch isolation" on public.spareparts;
create policy spareparts_select on public.spareparts
for select to authenticated
using (public.can_access_tenant_branch(branch_id));
create policy spareparts_insert on public.spareparts
for insert to authenticated
with check (public.can_access_tenant_branch(branch_id, array['MASTER_ADMIN', 'ADMIN']));
create policy spareparts_update on public.spareparts
for update to authenticated
using (public.can_access_tenant_branch(branch_id, array['MASTER_ADMIN', 'ADMIN']))
with check (public.can_access_tenant_branch(branch_id, array['MASTER_ADMIN', 'ADMIN']));
create policy spareparts_delete on public.spareparts
for delete to authenticated
using (public.can_access_tenant_branch(branch_id, array['MASTER_ADMIN', 'ADMIN']));

drop policy if exists "finance branch isolation" on public.finance_tx;
create policy finance_select on public.finance_tx
for select to authenticated
using (public.can_access_tenant_branch(branch_id));
create policy finance_insert on public.finance_tx
for insert to authenticated
with check (public.can_access_tenant_branch(branch_id, array['MASTER_ADMIN', 'ADMIN', 'FRONTLINER']));
create policy finance_update on public.finance_tx
for update to authenticated
using (public.can_access_tenant_branch(branch_id, array['MASTER_ADMIN', 'ADMIN']))
with check (public.can_access_tenant_branch(branch_id, array['MASTER_ADMIN', 'ADMIN']));
create policy finance_delete on public.finance_tx
for delete to authenticated
using (public.can_access_tenant_branch(branch_id, array['MASTER_ADMIN', 'ADMIN']));

create or replace function public.set_garansi()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'Sudah Diambil' and old.status is distinct from 'Sudah Diambil' then
    new.garansi_until := now() + interval '90 days';
  end if;
  return new;
end;
$$;

create or replace function public.validate_employee_branch_organization()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.branches branch
    where branch.id = new.branch_id
      and branch.organization_id = new.organization_id
      and branch.is_active = true
  ) then
    raise exception 'Employee branch must be active and belong to the organization' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists employees_validate_branch_organization on public.employees;
create trigger employees_validate_branch_organization
before insert or update of organization_id, branch_id on public.employees
for each row execute function public.validate_employee_branch_organization();

create or replace function public.complete_tenant_onboarding(
  p_tenant_name text,
  p_tenant_slug text,
  p_branch_name text default 'Cabang Pusat',
  p_branch_city text default null,
  p_branch_phone text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_user_email text;
  v_user_name text;
  v_organization_id uuid;
  v_branch_id uuid;
  v_branch_name text := coalesce(nullif(trim(p_branch_name), ''), 'Cabang Pusat');
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  if exists (
    select 1
    from public.platform_admins
    where profile_id = v_user_id
      and is_active = true
  ) then
    raise exception 'Platform admin tidak dapat membuat tenant' using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.profiles
    where id = v_user_id
      and is_active = false
  ) then
    raise exception 'Profil tidak aktif' using errcode = '42501';
  end if;

  if char_length(trim(p_tenant_name)) not between 1 and 120 then
    raise exception 'Tenant name is invalid';
  end if;

  if trim(p_tenant_slug) !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' or char_length(trim(p_tenant_slug)) not between 3 and 63 then
    raise exception 'Tenant slug is invalid';
  end if;

  if exists (
    select 1
    from public.employees
    where profile_id = v_user_id
  ) then
    raise exception 'Anda sudah memiliki tenant' using errcode = '42501';
  end if;

  select email, coalesce(raw_user_meta_data ->> 'full_name', email, 'Pengguna')
  into v_user_email, v_user_name
  from auth.users
  where id = v_user_id;

  insert into public.profiles (id, email, full_name, role, is_active)
  values (v_user_id, v_user_email, v_user_name, 'master_admin', true)
  on conflict (id) do update
    set email = excluded.email,
        is_active = true;

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
    trim(p_tenant_name),
    trim(p_tenant_slug),
    v_user_id,
    v_user_email,
    nullif(trim(p_branch_phone), ''),
    nullif(trim(p_branch_phone), ''),
    'trial'
  )
  returning id into v_organization_id;

  insert into public.branches (
    organization_id,
    owner_id,
    name,
    city,
    phone,
    address,
    is_active
  )
  values (
    v_organization_id,
    v_user_id,
    v_branch_name,
    nullif(trim(p_branch_city), ''),
    nullif(trim(p_branch_phone), ''),
    nullif(trim(p_branch_city), ''),
    true
  )
  returning id into v_branch_id;

  update public.profiles
  set branch_id = v_branch_id
  where id = v_user_id;

  insert into public.employees (
    organization_id,
    branch_id,
    profile_id,
    role,
    is_active
  )
  values (
    v_organization_id,
    v_branch_id,
    v_user_id,
    'MASTER_ADMIN',
    true
  )
  on conflict (organization_id, profile_id) do update
    set branch_id = excluded.branch_id,
        role = 'MASTER_ADMIN',
        is_active = true;

  insert into public.platform_audit_logs (
    actor_user_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    v_user_id,
    'tenant.onboarding_completed',
    'organization',
    v_organization_id,
    jsonb_build_object('branch_id', v_branch_id, 'slug', trim(p_tenant_slug))
  );

  return jsonb_build_object(
    'organization_id', v_organization_id,
    'branch_id', v_branch_id
  );
end;
$$;
