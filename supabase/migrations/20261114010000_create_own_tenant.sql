-- Pembuatan tenant oleh pemilik tenant itu sendiri (flow /dashboard/tenant).
--
-- Bedanya dengan complete_tenant_onboarding: user di sini SUDAH punya tenant
-- (peran MASTER_ADMIN), jadi guard "belum punya tenant" tidak dipakai. Yang
-- dipakai adalah:
--   - belum platform admin,
--   - profil aktif,
--   - punya minimal satu peran MASTER_ADMIN aktif,
--   - jumlah tenant (peran MASTER_ADMIN aktif) < batas 5.
--
-- Tenant baru selalu mulai status trial (trigger organizations_create_trial_
-- subscription membuat subscription trial otomatis). Paket berbayar ditambah
-- lewat platform_create_billing_invoice dari aplikasi setelah RPC sukses.

create or replace function public.create_own_tenant(
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
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

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
    from public.employees employee
    where employee.profile_id = v_user_id
      and employee.is_active = true
      and upper(employee.role) = 'MASTER_ADMIN'
  ) then
    if (
      select count(*)
      from public.employees employee
      where employee.profile_id = v_user_id
        and employee.is_active = true
        and upper(employee.role) = 'MASTER_ADMIN'
    ) >= 5 then
      raise exception 'Batas maksimal 5 tenant per akun';
    end if;
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
    coalesce(nullif(trim(p_branch_name), ''), 'Cabang Pusat'),
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

  insert into public.platform_audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (
    v_user_id,
    'tenant.created',
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

revoke all on function public.create_own_tenant(text, text, text, text, text) from public, anon;
grant execute on function public.create_own_tenant(text, text, text, text, text) to authenticated;

-- Pemilik tenant harus bisa membaca subscription/invoice miliknya sendiri
-- (termasuk tenant trial kedaluwarsa) agar pemilih tenant bisa menampilkan
-- paket/status dan billing tetap bisa ditindaklanjuti.
drop policy if exists subscriptions_select on public.tenant_subscriptions;
create policy subscriptions_select on public.tenant_subscriptions
for select to authenticated
using (public.is_platform_admin() or public.is_tenant_member(organization_id) or public.is_tenant_owner(organization_id));

drop policy if exists invoices_select on public.invoices;
create policy invoices_select on public.invoices
for select to authenticated
using (public.is_platform_admin() or public.is_tenant_member(organization_id) or public.is_tenant_owner(organization_id));
