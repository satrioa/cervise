-- Trigger trial membuat subscription otomatis saat organization dibuat.
-- Variabel `trial_days` bentrok dengan kolom `public.packages.trial_days`,
-- sehingga pemakaian kolom tanpa alias jadi ambigu (PostgREST 42702) dan
-- pembuatan tenant gagal. Qualify kolom dengan alias tabel.
create or replace function public.create_trial_subscription_for_organization()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  trial_package_id uuid;
  trial_length integer;
  grace_days integer;
begin
  select p.id, coalesce(p.trial_days, 5)
    into trial_package_id, trial_length
    from public.packages p
   where p.code = 'trial' and p.is_active = true
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
    now() + make_interval(days => trial_length),
    now(),
    now() + make_interval(days => trial_length),
    coalesce(grace_days, 3)
  )
  on conflict (organization_id) do nothing;

  return new;
end;
$function$;
