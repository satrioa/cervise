-- Scope cabang untuk MASTER_ADMIN + isolasi PII antar cabang.
--
-- Latar belakang:
-- 1. Semua helper RLS mengunci `employee.branch_id = check_branch_id`. Akibatnya
--    MASTER_ADMIN yang memilih cabang lain di UI tetap hanya bisa membaca
--    cabang kepegawaiannya sendiri. Cookie pilihan cabang lalu hanya mengubah
--    label, bukan data yang terlihat.
-- 2. Policy employees/profiles memakai is_tenant_member(organization_id), jadi
--    staf satu cabang bisa membaca nama, telepon, dan email seluruh karyawan
--    di cabang lain.
-- 3. cervise_sales.sale_number UNIQUE global. next_sale_number menghitung per
--    cabang, jadi cabang kedua yang memulai dari SLV-2026-0001 menabrak nomor
--    cabang pertama dan pembayaran pertamanya gagal (23505).
--
-- Perubahan di sini:
-- - MASTER_ADMIN boleh mengakses cabang mana pun DALAM organisasinya sendiri.
--   Staf lain tetap terikat satu cabang. Pembatasan tulis mode "semua cabang"
--   dilakukan di aplikasi (requireWriteBranch), bukan dengan membuka RLS.
-- - employees/profiles dibatasi ke cabang yang sama (atau MASTER_ADMIN).
-- - sale_number unik per cabang, bukan global.

-- ---------------------------------------------------------------------------
-- 1. Nomor penjualan unik per cabang
-- ---------------------------------------------------------------------------
alter table public.cervise_sales
  drop constraint if exists cervise_sales_sale_number_key;

create unique index if not exists cervise_sales_branch_sale_number_key
  on public.cervise_sales (branch_id, sale_number);

-- ---------------------------------------------------------------------------
-- 2. Helper akses cabang: MASTER_ADMIN lintas cabang dalam organisasi
-- ---------------------------------------------------------------------------
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
    join public.branches branch on branch.id = check_branch_id
    join public.organizations organization on organization.id = employee.organization_id
    join public.tenant_subscriptions subscription
      on subscription.organization_id = organization.id
    where employee.profile_id = auth.uid()
      and employee.is_active = true
      and profile.is_active = true
      and branch.organization_id = employee.organization_id
      and branch.is_active = true
      and (
        employee.branch_id = check_branch_id
        or upper(employee.role) = 'MASTER_ADMIN'
      )
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
    join public.branches branch on branch.id = check_branch_id
    join public.organizations organization on organization.id = employee.organization_id
    join public.tenant_subscriptions subscription
      on subscription.organization_id = organization.id
    where employee.profile_id = auth.uid()
      and employee.organization_id = check_organization_id
      and employee.is_active = true
      and profile.is_active = true
      and branch.organization_id = employee.organization_id
      and branch.is_active = true
      and (
        employee.branch_id = check_branch_id
        or upper(employee.role) = 'MASTER_ADMIN'
      )
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
    join public.branches branch on branch.id = check_branch_id
    join public.organizations organization on organization.id = employee.organization_id
    join public.tenant_subscriptions subscription
      on subscription.organization_id = organization.id
    where employee.profile_id = auth.uid()
      and employee.organization_id = check_organization_id
      and employee.is_active = true
      and profile.is_active = true
      and employee.role = any(allowed_roles)
      and branch.organization_id = employee.organization_id
      and branch.is_active = true
      and (
        employee.branch_id = check_branch_id
        or upper(employee.role) = 'MASTER_ADMIN'
      )
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

revoke all on function public.has_tenant_branch_role(uuid, uuid, text[]) from public, anon;
grant execute on function public.has_tenant_branch_role(uuid, uuid, text[]) to authenticated;

-- RPC (set_service_status, consume/return spareparts) memakai fungsi ini
-- sebagai satu-satunya gerbang. Samakan aturannya dengan policy tabel.
create or replace function public.caller_branch_role(p_branch_id uuid)
returns text
language sql
stable
security definer
set search_path to 'public'
as $function$
  select employee.role
  from public.employees employee
  join public.profiles profile on profile.id = employee.profile_id
  join public.branches branch on branch.id = p_branch_id
  join public.organizations organization on organization.id = employee.organization_id
  join public.tenant_subscriptions subscription
    on subscription.organization_id = organization.id
  where employee.profile_id = auth.uid()
    and employee.is_active = true
    and profile.is_active = true
    and branch.organization_id = employee.organization_id
    and branch.is_active = true
    and (
      employee.branch_id = p_branch_id
      or upper(employee.role) = 'MASTER_ADMIN'
    )
    and organization.status not in ('blocked', 'suspended', 'cancelled')
    and (
      (subscription.status = 'trial' and subscription.trial_ends_at > now())
      or (
        subscription.status in ('active', 'grace')
        and subscription.current_period_end + (subscription.grace_days * interval '1 day') > now()
      )
    )
  limit 1;
$function$;

revoke all on function public.caller_branch_role(uuid) from public, anon;
grant execute on function public.caller_branch_role(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. PII karyawan: satu cabang, atau MASTER_ADMIN
-- ---------------------------------------------------------------------------
create or replace function public.can_view_employee(
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
    from public.employees viewer
    join public.profiles viewer_profile on viewer_profile.id = viewer.profile_id
    where viewer.profile_id = auth.uid()
      and viewer.organization_id = check_organization_id
      and viewer.is_active = true
      and viewer_profile.is_active = true
      and (
        upper(viewer.role) = 'MASTER_ADMIN'
        or viewer.branch_id is not distinct from check_branch_id
      )
  );
$$;

revoke all on function public.can_view_employee(uuid, uuid) from public, anon;
grant execute on function public.can_view_employee(uuid, uuid) to authenticated;

create or replace function public.can_view_profile(check_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.employees subject
    join public.employees viewer
      on viewer.organization_id = subject.organization_id
    join public.profiles viewer_profile on viewer_profile.id = viewer.profile_id
    where subject.profile_id = check_profile_id
      and subject.is_active = true
      and viewer.profile_id = auth.uid()
      and viewer.is_active = true
      and viewer_profile.is_active = true
      and (
        upper(viewer.role) = 'MASTER_ADMIN'
        or viewer.branch_id is not distinct from subject.branch_id
      )
  );
$$;

revoke all on function public.can_view_profile(uuid) from public, anon;
grant execute on function public.can_view_profile(uuid) to authenticated;

drop policy if exists employees_select on public.employees;
create policy employees_select on public.employees
for select to authenticated
using (
  public.is_platform_admin()
  or public.can_view_employee(organization_id, branch_id)
);

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
for select to authenticated
using (
  id = auth.uid()
  or public.is_platform_admin()
  or public.can_view_profile(id)
);
