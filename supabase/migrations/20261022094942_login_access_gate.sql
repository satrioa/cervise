-- Gerbang login harus bisa membedakan "tidak punya tenant" dari "punya tenant
-- tapi langganannya berakhir". Sebelumnya perbedaan itu tidak ada: RLS
-- menyembunyikan baris employees untuk tenant expired, lalu login membaca
-- hasil kosong itu sebagai "belum punya tenant" dan menampilkan onboarding.
--
-- Perbaikannya BUKAN melonggarkan RLS. is_tenant_member tetap menolak tenant
-- expired; yang baru adalah satu fungsi khusus yang hanya menjawab status
-- akses, tanpa mengembalikan isi tenant yang tidak aktif.

-- Satu definisi "langganan aktif" dipakai bersama oleh RLS dan gerbang login,
-- supaya keduanya tidak pernah berbeda tafsir.
create or replace function public.is_tenant_subscription_active(check_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organizations organization
    join public.tenant_subscriptions subscription
      on subscription.organization_id = organization.id
    where organization.id = check_organization_id
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

revoke all on function public.is_tenant_subscription_active(uuid) from public, anon, authenticated;

-- Semantik tidak berubah: tenant expired tetap tidak terlihat oleh RLS.
-- Isinya sekarang memanggil helper di atas agar definisinya tidak menyimpang.
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
    where employee.organization_id = check_organization_id
      and employee.profile_id = auth.uid()
      and employee.is_active = true
      and profile.is_active = true
      and public.is_tenant_subscription_active(check_organization_id)
  );
$$;

revoke all on function public.is_tenant_member(uuid) from public, anon;
grant execute on function public.is_tenant_member(uuid) to authenticated;

-- Pintu khusus login. Untuk tenant yang tidak aktif, fungsi ini HANYA
-- mengembalikan boolean: tidak ada id, nama, cabang, invoice, atau status
-- langganan yang bocor.
--
-- profile_active bernilai true kalau baris profiles belum ada: alur signup
-- fallback memang membuat profil baru saat onboarding, dan user seperti itu
-- harus tetap bisa masuk ke onboarding.
create or replace function public.get_my_login_access()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select auth.uid() as user_id
  ),
  my_employees as (
    select employee.organization_id
    from public.employees employee
    where employee.profile_id = (select user_id from me)
  ),
  my_active_memberships as (
    select employee.organization_id, employee.role
    from public.employees employee
    join public.profiles profile on profile.id = employee.profile_id
    where employee.profile_id = (select user_id from me)
      and employee.is_active = true
      and profile.is_active = true
      and public.is_tenant_subscription_active(employee.organization_id)
  )
  select jsonb_build_object(
    'is_platform_admin', public.is_platform_admin(),
    'profile_active', (
      (select user_id from me) is not null
      and coalesce(
        (
          select profile.is_active
          from public.profiles profile
          where profile.id = (select user_id from me)
        ),
        true
      )
    ),
    'active_memberships', coalesce(
      (
        select jsonb_agg(jsonb_build_object(
          'organization_id', organization_id,
          'role', role
        ))
        from my_active_memberships
      ),
      '[]'::jsonb
    ),
    'has_membership_record', (
      exists (select 1 from my_employees)
      or exists (
        select 1
        from public.organizations organization
        where organization.owner_profile_id = (select user_id from me)
      )
    ),
    'has_inactive_ownership', exists (
      select 1
      from public.organizations organization
      where organization.owner_profile_id = (select user_id from me)
        and not public.is_tenant_subscription_active(organization.id)
    )
  );
$$;

revoke all on function public.get_my_login_access() from public, anon;
grant execute on function public.get_my_login_access() to authenticated;

-- Guard pembuatan tenant. Baris employees sudah cukup untuk member; cek
-- owner_profile_id menutup celah owner yang baris employee-nya sudah hilang.
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
  ) or exists (
    select 1
    from public.organizations
    where owner_profile_id = v_user_id
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
