-- Tenant yang trial-nya sudah habis tidak bisa membuat invoice upgrade.
--
-- `has_tenant_role()` ikut memeriksa status langganan: trial harus belum
-- kedaluwarsa, active/grace harus belum lewat masa grace. Akibatnya tenant
-- yang justru perlu membayar ditolak dengan "Tenant owner access required"
-- saat menekan "Pilih paket" - jalan buntu, karena satu-satunya cara keluar
-- adalah invoice yang gagal dibuat itu.
--
-- Halaman tagihan sendiri sudah sengaja dibuka untuk tenant kedaluwarsa
-- (`getActiveTenantForBilling`). Pemeriksaan di sini disamakan: yang dicek
-- hanya keanggotaan MASTER_ADMIN yang aktif, profil aktif, dan organisasi
-- yang tidak dinonaktifkan - bukan status langganan.
--
-- Perbaikan kedua: parameter `invoice_type` masih bentrok dengan kolom
-- invoices.invoice_type. Mengqualify sisi kolom saja tidak cukup - sisi kanan
-- yang telanjang tetap ambigu (SQLSTATE 42702), jadi setiap "Pilih paket"
-- gagal. `#variable_conflict use_variable` membuat nama telanjang mengacu ke
-- parameter, sementara `invoices.invoice_type` tetap mengacu ke kolom.
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
#variable_conflict use_variable
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
    and not exists (
      select 1
      from public.employees employee
      join public.profiles profile on profile.id = employee.profile_id
      join public.organizations organization on organization.id = employee.organization_id
      where employee.organization_id = target_organization_id
        and employee.profile_id = auth.uid()
        and employee.is_active = true
        and employee.role = 'MASTER_ADMIN'
        and profile.is_active = true
        and organization.status not in ('blocked', 'suspended', 'cancelled')
    ) then
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
    and invoices.invoice_type = invoice_type
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
    and invoices.invoice_type = invoice_type
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
