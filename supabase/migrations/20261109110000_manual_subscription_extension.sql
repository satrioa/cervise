-- Perpanjangan paket dilakukan manual oleh platform admin setelah pembayaran
-- diverifikasi lewat WhatsApp (belum ada payment gateway). Tanpa jejak
-- transaksi, laporan finance yang menjumlah invoice approved akan kehilangan
-- pembayaran manual. Karena itu setiap perpanjangan dicatat di
-- manual_subscription_payments.
--
-- `platform_extend_subscription` adalah satu-satunya jalur aktivasi:
-- - periode dimulai dari max(now, current_period_end) sehingga sisa masa aktif
--   tidak hilang saat diperpanjang lebih awal;
-- - paket dan harga ikut berubah pada saat yang sama (harga custom opsional);
-- - invoice reminder renewal yang sudah tercakup periode baru di-void supaya
--   admin tidak meng-approve pembayaran dua kali.
create table if not exists public.manual_subscription_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  subscription_id uuid not null references public.tenant_subscriptions(id) on delete cascade,
  package_id uuid not null references public.packages(id),
  amount integer not null check (amount >= 0),
  months integer not null check (months between 1 and 24),
  period_start timestamptz not null,
  period_end timestamptz not null,
  paid_via text not null default 'whatsapp',
  reference_note text,
  recorded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists manual_subscription_payments_org_idx
  on public.manual_subscription_payments (organization_id, created_at desc);

alter table public.manual_subscription_payments enable row level security;

drop policy if exists manual_subscription_payments_select on public.manual_subscription_payments;
create policy manual_subscription_payments_select on public.manual_subscription_payments
for select to authenticated
using (public.is_platform_admin());

grant select on public.manual_subscription_payments to authenticated;

create or replace function public.platform_extend_subscription(
  target_organization_id uuid,
  target_package_id uuid,
  custom_monthly_price integer,
  duration_months integer,
  reference_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_variable
declare
  subscription_row public.tenant_subscriptions%rowtype;
  target_package public.packages%rowtype;
  base_period_start timestamptz;
  new_period_end timestamptz;
  effective_monthly_price integer;
  payment_id uuid;
begin
  if not public.is_platform_admin(auth.uid()) then
    raise exception 'Platform admin access required';
  end if;
  if duration_months is null or duration_months < 1 or duration_months > 24 then
    raise exception 'Duration must be between 1 and 24 months';
  end if;
  if custom_monthly_price is not null and custom_monthly_price < 0 then
    raise exception 'Custom price must be zero or greater';
  end if;

  select * into target_package
  from public.packages
  where id = target_package_id and is_active = true;

  if target_package.id is null then
    raise exception 'Package not found';
  end if;

  select * into subscription_row
  from public.tenant_subscriptions
  where organization_id = target_organization_id
  for update;

  if subscription_row.id is null then
    raise exception 'Subscription not found';
  end if;

  -- Sambung periode yang masih berjalan; kalau sudah lewat, mulai sekarang.
  base_period_start := greatest(now(), coalesce(subscription_row.current_period_end, now()));
  new_period_end := base_period_start + (duration_months || ' months')::interval;
  effective_monthly_price := coalesce(custom_monthly_price, target_package.monthly_price);

  update public.tenant_subscriptions set
    package_id = target_package_id,
    custom_monthly_price = custom_monthly_price,
    status = 'active',
    current_period_start = case
      when subscription_row.current_period_end is null
        or subscription_row.current_period_end <= now()
        then base_period_start
      else subscription_row.current_period_start
    end,
    current_period_end = new_period_end,
    activated_at = coalesce(activated_at, now()),
    cancelled_at = null
  where id = subscription_row.id;

  insert into public.manual_subscription_payments (
    organization_id,
    subscription_id,
    package_id,
    amount,
    months,
    period_start,
    period_end,
    reference_note,
    recorded_by
  ) values (
    target_organization_id,
    subscription_row.id,
    target_package_id,
    effective_monthly_price * duration_months,
    duration_months,
    base_period_start,
    new_period_end,
    nullif(trim(reference_note), ''),
    auth.uid()
  )
  returning id into payment_id;

  -- Reminder H-7 untuk periode yang kini sudah tercakup tidak boleh di-approve
  -- lagi: approve akan memajukan periode dan menimpa paket dari invoice.
  update public.invoices
  set status = 'voided',
      decision_note = 'Dicover perpanjangan manual ' || to_char(now(), 'YYYY-MM-DD')
  where organization_id = target_organization_id
    and status = 'pending'
    and invoice_type = 'renewal'
    and period_end <= new_period_end;

  insert into public.platform_audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    'subscription.extended',
    'subscription',
    subscription_row.id,
    jsonb_build_object(
      'organization_id', target_organization_id,
      'package_id', target_package_id,
      'custom_price', custom_monthly_price,
      'months', duration_months,
      'amount', effective_monthly_price * duration_months,
      'period_start', base_period_start,
      'period_end', new_period_end,
      'reference_note', nullif(trim(reference_note), ''),
      'payment_id', payment_id
    )
  );

  return payment_id;
end;
$$;

-- Perubahan paket/harga/grace di luar perpanjangan. Tidak menyentuh periode
-- maupun status supaya tidak ada aktivasi diam-diam.
create or replace function public.platform_adjust_subscription(
  target_organization_id uuid,
  target_package_id uuid,
  custom_monthly_price integer,
  target_grace_days integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_variable
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

  update public.tenant_subscriptions set
    package_id = target_package_id,
    custom_monthly_price = custom_monthly_price,
    grace_days = target_grace_days
  where organization_id = target_organization_id
  returning id into subscription_id;

  if subscription_id is null then
    raise exception 'Subscription not found';
  end if;

  insert into public.platform_audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    'subscription.adjusted',
    'subscription',
    subscription_id,
    jsonb_build_object(
      'package_id', target_package_id,
      'custom_price', custom_monthly_price,
      'grace_days', target_grace_days
    )
  );

  return subscription_id;
end;
$$;

revoke all on function public.platform_extend_subscription(uuid, uuid, integer, integer, text) from public;
revoke all on function public.platform_adjust_subscription(uuid, uuid, integer, integer) from public;
grant execute on function public.platform_extend_subscription(uuid, uuid, integer, integer, text) to authenticated;
grant execute on function public.platform_adjust_subscription(uuid, uuid, integer, integer) to authenticated;
