-- Pricing v2: paket Trial/Starter/Business/Custom, kuota periodik, add-on,
-- trial konfigurabel. Semua perubahan additif: paket lama basic/pro tetap
-- ada (dinonaktifkan) supaya FK invoice/subscription tenant existing utuh.

-- ---------------------------------------------------------------------------
-- 1. Konfigurasi paket
-- ---------------------------------------------------------------------------
alter table public.packages
  add column if not exists annual_price integer,
  add column if not exists trial_days integer default 5,
  add column if not exists ticket_quota integer default 100,
  add column if not exists whatsapp_quota integer default 300,
  add column if not exists extra_branch_price integer not null default 79000,
  add column if not exists extra_employee_price integer not null default 12000,
  add column if not exists extra_ticket_block_price integer not null default 199000,
  add column if not exists ticket_block_size integer not null default 100,
  add column if not exists wa_per_ticket_block integer not null default 300,
  add column if not exists annual_multiplier integer not null default 10,
  add column if not exists is_recommended boolean not null default false;

-- Harga lama tetap dipakai tenant existing; paket baru aktif untuk yang baru.
insert into public.packages (
  code, name, description, monthly_price, annual_price,
  branch_limit, user_limit, ticket_quota, whatsapp_quota,
  trial_days, is_recommended, sort_order
)
values
  ('trial', 'Trial', 'Coba semua fitur utama selama 5 hari', 0, 0, 1, 5, 20, 60, 5, false, 10),
  ('starter', 'Starter', 'Untuk toko servis satu cabang', 299000, 2990000, 1, 5, 100, 300, null, false, 20),
  ('business', 'Business', 'Untuk bisnis servis beberapa cabang', 999000, 9990000, 3, 15, 500, 1500, null, true, 30),
  ('custom', 'Custom / Pay as You Grow', 'Harga mengikuti kebutuhan toko Anda', 999000, null, 3, 15, 500, 1500, null, false, 40)
on conflict (code) do update
set name = excluded.name,
    description = excluded.description,
    monthly_price = excluded.monthly_price,
    annual_price = excluded.annual_price,
    branch_limit = excluded.branch_limit,
    user_limit = excluded.user_limit,
    ticket_quota = excluded.ticket_quota,
    whatsapp_quota = excluded.whatsapp_quota,
    trial_days = excluded.trial_days,
    is_recommended = excluded.is_recommended,
    sort_order = excluded.sort_order,
    is_active = true;

update public.packages set is_active = false where code in ('basic', 'pro');

-- ---------------------------------------------------------------------------
-- 2. Subscription: periode tagihan & penanda pembatasan non-destruktif
-- ---------------------------------------------------------------------------
alter table public.tenant_subscriptions
  add column if not exists billing_period text not null default 'monthly'
    check (billing_period in ('monthly', 'annual'));

alter table public.organizations
  add column if not exists capacity_restricted boolean not null default false,
  add column if not exists restriction_reason text;

-- ---------------------------------------------------------------------------
-- 3. Pemakaian per periode (reset otomatis lewat baris periode baru)
-- ---------------------------------------------------------------------------
create table if not exists public.organization_usage (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  period_start date not null,
  services_used integer not null default 0 check (services_used >= 0),
  wa_included_used integer not null default 0 check (wa_included_used >= 0),
  wa_topup_granted integer not null default 0 check (wa_topup_granted >= 0),
  wa_topup_used integer not null default 0 check (wa_topup_used >= 0),
  updated_at timestamptz not null default now(),
  primary key (organization_id, period_start)
);

alter table public.organization_usage enable row level security;
revoke all on table public.organization_usage from anon, authenticated;
grant all on table public.organization_usage to service_role;

-- ---------------------------------------------------------------------------
-- 4. Trial mengikuti konfigurasi paket, bukan literal 14 hari
-- ---------------------------------------------------------------------------
create or replace function public.create_trial_subscription_for_organization()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  trial_package_id uuid;
  trial_days integer;
  grace_days integer;
begin
  select id, coalesce(trial_days, 5) into trial_package_id, trial_days
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
    now() + make_interval(days => trial_days),
    now(),
    now() + make_interval(days => trial_days),
    coalesce(grace_days, 3)
  )
  on conflict (organization_id) do nothing;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Batas karyawan aktif (backstop DB; pengecekan awal tetap di server action)
-- ---------------------------------------------------------------------------
create or replace function public.enforce_subscription_employee_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed_employees integer;
  active_employees integer;
begin
  if new.organization_id is null or new.is_active = false then
    return new;
  end if;

  select packages.user_limit into allowed_employees
  from public.tenant_subscriptions
  join public.packages on packages.id = tenant_subscriptions.package_id
  where tenant_subscriptions.organization_id = new.organization_id;

  if allowed_employees is null then
    return new;
  end if;

  select count(*) into active_employees
  from public.employees
  where organization_id = new.organization_id
    and is_active = true
    and (new.id is null or id <> new.id);

  if active_employees >= allowed_employees then
    raise exception 'Employee limit for the current package has been reached';
  end if;

  return new;
end;
$$;

drop trigger if exists employees_enforce_subscription_limit on public.employees;
create trigger employees_enforce_subscription_limit
before insert or update of organization_id, is_active on public.employees
for each row execute function public.enforce_subscription_employee_limit();

revoke all on function public.create_trial_subscription_for_organization() from public, anon;
grant execute on function public.create_trial_subscription_for_organization() to authenticated, service_role;
revoke all on function public.enforce_subscription_employee_limit() from public, anon;
grant execute on function public.enforce_subscription_employee_limit() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. RPC kuota atomik. Semua akses terverifikasi ulang di dalam fungsi.
-- ---------------------------------------------------------------------------
create or replace function public.reserve_service_ticket(p_organization_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer;
  v_period date;
  v_used integer;
begin
  if p_organization_id is null then
    raise exception 'organization wajib diisi';
  end if;
  if not (public.is_platform_admin() or public.is_tenant_member(p_organization_id)
          or public.is_tenant_owner(p_organization_id)) then
    raise exception 'akses ditolak';
  end if;

  select p.ticket_quota,
         coalesce(s.current_period_start::date, date_trunc('month', now())::date)
  into v_limit, v_period
  from public.tenant_subscriptions s
  join public.packages p on p.id = s.package_id
  where s.organization_id = p_organization_id;

  if not found then
    raise exception 'Subscription tidak ditemukan';
  end if;

  insert into public.organization_usage (organization_id, period_start, services_used)
  values (p_organization_id, v_period, 1)
  on conflict (organization_id, period_start) do update
    set services_used = public.organization_usage.services_used + 1,
        updated_at = now()
  where public.organization_usage.services_used < v_limit
  returning services_used into v_used;

  if v_used is null then
    select services_used into v_used
    from public.organization_usage
    where organization_id = p_organization_id and period_start = v_period;

    return jsonb_build_object(
      'allowed', false,
      'used', coalesce(v_used, 0),
      'limit', v_limit,
      'period_start', v_period
    );
  end if;

  -- Tiap tambahan 100 tiket di atas kuota paket memberi WA tambahan.
  update public.organization_usage u
  set wa_topup_granted = greatest(
        u.wa_topup_granted,
        ceil(greatest(v_used - coalesce(v_limit, 0), 0)::numeric
             / greatest(p.ticket_block_size, 1))::integer
          * p.wa_per_ticket_block
      ),
      updated_at = now()
  from public.tenant_subscriptions s
  join public.packages p on p.id = s.package_id
  where u.organization_id = p_organization_id
    and u.period_start = v_period
    and s.organization_id = p_organization_id;

  return jsonb_build_object(
    'allowed', true,
    'used', v_used,
    'limit', v_limit,
    'period_start', v_period
  );
end;
$$;

create or replace function public.consume_wa_quota(
  p_organization_id uuid,
  p_count integer default 1
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period date;
  v_included integer;
  v_included_used integer;
  v_granted integer;
  v_topup_used integer;
  v_take_included integer;
  v_take_topup integer;
begin
  if p_organization_id is null or p_count is null or p_count < 1 or p_count > 100 then
    raise exception 'parameter kuota tidak valid';
  end if;

  select p.whatsapp_quota,
         coalesce(s.current_period_start::date, date_trunc('month', now())::date)
  into v_included, v_period
  from public.tenant_subscriptions s
  join public.packages p on p.id = s.package_id
  where s.organization_id = p_organization_id;

  if not found then
    raise exception 'Subscription tidak ditemukan';
  end if;

  insert into public.organization_usage (organization_id, period_start)
  values (p_organization_id, v_period)
  on conflict (organization_id, period_start) do nothing;

  select wa_included_used, wa_topup_granted, wa_topup_used
  into v_included_used, v_granted, v_topup_used
  from public.organization_usage
  where organization_id = p_organization_id and period_start = v_period;

  v_take_included := least(p_count, greatest(coalesce(v_included, 0) - coalesce(v_included_used, 0), 0));
  v_take_topup := p_count - v_take_included;

  if v_take_topup > greatest(coalesce(v_granted, 0) - coalesce(v_topup_used, 0), 0) then
    return jsonb_build_object(
      'allowed', false,
      'included_limit', coalesce(v_included, 0),
      'included_used', coalesce(v_included_used, 0),
      'topup_granted', coalesce(v_granted, 0),
      'topup_used', coalesce(v_topup_used, 0),
      'period_start', v_period
    );
  end if;

  update public.organization_usage
  set wa_included_used = wa_included_used + v_take_included,
      wa_topup_used = wa_topup_used + v_take_topup,
      updated_at = now()
  where organization_id = p_organization_id and period_start = v_period;

  return jsonb_build_object(
    'allowed', true,
    'included', v_take_included,
    'topup', v_take_topup,
    'included_used', coalesce(v_included_used, 0) + v_take_included,
    'topup_used', coalesce(v_topup_used, 0) + v_take_topup,
    'period_start', v_period
  );
end;
$$;

-- Pengecekan tanpa pemakaian: dipakai dispatcher sebelum mengirim WA.
create or replace function public.check_wa_quota(
  p_organization_id uuid,
  p_count integer default 1
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_included integer;
  v_used integer;
  v_granted integer;
  v_topup_used integer;
begin
  if p_organization_id is null or p_count is null or p_count < 1 then
    return false;
  end if;

  select p.whatsapp_quota into v_included
  from public.tenant_subscriptions s
  join public.packages p on p.id = s.package_id
  where s.organization_id = p_organization_id;
  if not found then
    return false;
  end if;

  select wa_included_used, wa_topup_granted, wa_topup_used
  into v_used, v_granted, v_topup_used
  from public.organization_usage
  where organization_id = p_organization_id
    and period_start = coalesce(
      (select current_period_start::date from public.tenant_subscriptions where organization_id = p_organization_id),
      date_trunc('month', now())::date
    );

  return coalesce(v_included, 0) - coalesce(v_used, 0)
         + coalesce(v_granted, 0) - coalesce(v_topup_used, 0) >= p_count;
end;
$$;

create or replace function public.get_tenant_usage(p_organization_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if p_organization_id is null then
    raise exception 'organization wajib diisi';
  end if;
  if not (public.is_platform_admin() or public.is_tenant_member(p_organization_id)
          or public.is_tenant_owner(p_organization_id)) then
    raise exception 'akses ditolak';
  end if;

  select jsonb_build_object(
    'organization_id', u.organization_id,
    'period_start', u.period_start,
    'services_used', u.services_used,
    'ticket_limit', p.ticket_quota,
    'wa_included_used', u.wa_included_used,
    'wa_included_limit', p.whatsapp_quota,
    'wa_topup_granted', u.wa_topup_granted,
    'wa_topup_used', u.wa_topup_used
  ) into v_result
  from public.organization_usage u
  join public.tenant_subscriptions s on s.organization_id = u.organization_id
  join public.packages p on p.id = s.package_id
  where u.organization_id = p_organization_id
  order by u.period_start desc
  limit 1;

  return coalesce(v_result, 'null'::jsonb);
end;
$$;

-- reserve dipanggil oleh server action tenant (punya sesi), consume/check hanya
-- oleh backend service_role supaya tidak bisa dipanggil lintas tenant.
revoke all on function public.reserve_service_ticket(uuid) from public, anon;
grant execute on function public.reserve_service_ticket(uuid) to authenticated;
revoke all on function public.consume_wa_quota(uuid, integer) from public, anon, authenticated;
grant execute on function public.consume_wa_quota(uuid, integer) to service_role;
revoke all on function public.check_wa_quota(uuid, integer) from public, anon, authenticated;
grant execute on function public.check_wa_quota(uuid, integer) to service_role;
revoke all on function public.get_tenant_usage(uuid) from public, anon;
grant execute on function public.get_tenant_usage(uuid) to authenticated, service_role;
