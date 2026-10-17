-- Perketat caller_branch_role.
--
-- Versi lama hanya mengecek employees.profile_id, branch_id, dan
-- employees.is_active. Empat RPC memakainya sebagai satu-satunya penjaga
-- (set_service_status, consume_service_spareparts, return_service_spareparts,
-- mark_service_spareparts_kept) dan semuanya di-grant ke authenticated, jadi
-- bisa dipanggil langsung lewat REST.
--
-- Kondisi di bawah disalin dari can_access_tenant_branch
-- (20260925122000:103-136) yang dipakai semua policy tabel, supaya gerbang RPC
-- dan gerbang RLS menguji hal yang sama. Signature dan return type tidak
-- berubah, jadi keempat RPC tidak perlu disentuh.

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
  join public.branches branch on branch.id = employee.branch_id
  join public.organizations organization on organization.id = employee.organization_id
  join public.tenant_subscriptions subscription
    on subscription.organization_id = organization.id
  where employee.profile_id = auth.uid()
    and employee.branch_id = p_branch_id
    and employee.is_active = true
    and profile.is_active = true
    and branch.is_active = true
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