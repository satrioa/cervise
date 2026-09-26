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
      and is_active = true
  ) then
    raise exception 'Anda sudah memiliki tenant';
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

revoke all on function public.complete_tenant_onboarding(text, text, text, text, text) from public;
revoke all on function public.complete_tenant_onboarding(text, text, text, text, text) from anon;
grant execute on function public.complete_tenant_onboarding(text, text, text, text, text) to authenticated;
