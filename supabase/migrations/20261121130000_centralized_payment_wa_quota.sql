-- Centralized payment + tenant-level shared WhatsApp quota.
-- Additive: tidak menghapus tabel/kolom lama. organization_usage tetap dipertahankan
-- sebagai histori (read-only setelah cutover) untuk rollback.

-- Bukti pembayaran: bucket privat, tanpa policy storage.objects (server-only via admin client).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'payment-proofs', 'payment-proofs', false, 5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']::text[]
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 1. Katalog paket top-up (quantity pesan, bukan saldo rupiah)
-- ---------------------------------------------------------------------------
create table if not exists public.wa_topup_packages (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9_-]+$'),
  name text not null,
  message_quantity integer not null check (message_quantity > 0),
  price_idr integer not null check (price_idr > 0),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger wa_topup_packages_touch
before update on public.wa_topup_packages
for each row execute function public.cervise_touch_updated_at();

-- ---------------------------------------------------------------------------
-- 2. Invoice: tipe topup + provenance pembayaran
-- ---------------------------------------------------------------------------
do $$
begin
  alter type public.cervise_invoice_type add value if not exists 'topup';
end $$;

alter table public.invoices
  add column if not exists payment_provider text not null default 'manual_transfer',
  add column if not exists wa_topup_package_id uuid references public.wa_topup_packages(id) on delete set null,
  add column if not exists wa_message_quantity integer;

create index if not exists invoices_topup_package_idx
  on public.invoices (wa_topup_package_id) where wa_topup_package_id is not null;

-- ---------------------------------------------------------------------------
-- 3. Wallet kuota WA shared per tenant
-- ---------------------------------------------------------------------------
create table if not exists public.whatsapp_quota_wallets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id) on delete cascade,
  included_limit integer not null default 0 check (included_limit >= 0),
  included_used integer not null default 0 check (included_used >= 0),
  topup_balance integer not null default 0 check (topup_balance >= 0),
  period_start date not null default date_trunc('month', now())::date,
  period_end date not null default (date_trunc('month', now()) + interval '1 month')::date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wa_wallet_period_valid check (period_end > period_start)
);

create trigger whatsapp_quota_wallets_touch
before update on public.whatsapp_quota_wallets
for each row execute function public.cervise_touch_updated_at();

-- ---------------------------------------------------------------------------
-- 4. Log pemakaian: satu baris per pesan keluar, idempoten
-- ---------------------------------------------------------------------------
create table if not exists public.whatsapp_usage_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  idempotency_key text not null unique,
  provider_message_id text unique,
  message_type text not null,
  delivery_status text not null default 'reserved',
  quota_source text not null check (quota_source in ('included', 'topup', 'none')),
  quota_units integer not null default 1 check (quota_units >= 0),
  created_at timestamptz not null default now(),
  delivered_at timestamptz
);

create index if not exists wa_usage_logs_org_created_idx
  on public.whatsapp_usage_logs (organization_id, created_at desc);
create index if not exists wa_usage_logs_branch_created_idx
  on public.whatsapp_usage_logs (branch_id, created_at desc);
create index if not exists wa_usage_logs_provider_msg_idx
  on public.whatsapp_usage_logs (provider_message_id) where provider_message_id is not null;

-- ---------------------------------------------------------------------------
-- 5. Ledger kuota: append-only
-- ---------------------------------------------------------------------------
create table if not exists public.whatsapp_quota_ledger (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  transaction_type text not null check (transaction_type in
    ('included_reset', 'topup_purchase', 'message_consumption', 'refund', 'adjustment')),
  amount integer not null,
  balance_after integer not null,
  reference_id text not null,
  description text not null default '',
  reason text,
  actor_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists wa_ledger_reference_unique
  on public.whatsapp_quota_ledger (organization_id, reference_id, transaction_type);

create index if not exists wa_ledger_org_created_idx
  on public.whatsapp_quota_ledger (organization_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 6. Fulfillment & bukti pembayaran
-- ---------------------------------------------------------------------------
create table if not exists public.payment_fulfillments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null unique references public.invoices(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  fulfillment_type text not null check (fulfillment_type in ('subscription_period', 'wa_topup')),
  status text not null default 'pending' check (status in ('pending', 'succeeded', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  idempotency_key text not null unique,
  last_error text,
  fulfilled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger payment_fulfillments_touch
before update on public.payment_fulfillments
for each row execute function public.cervise_touch_updated_at();

create table if not exists public.payment_proofs (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  content_type text not null,
  size_bytes integer not null check (size_bytes > 0),
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists payment_proofs_invoice_idx
  on public.payment_proofs (invoice_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 7. RLS
-- ---------------------------------------------------------------------------
alter table public.wa_topup_packages enable row level security;
alter table public.whatsapp_quota_wallets enable row level security;
alter table public.whatsapp_usage_logs enable row level security;
alter table public.whatsapp_quota_ledger enable row level security;
alter table public.payment_fulfillments enable row level security;
alter table public.payment_proofs enable row level security;

drop policy if exists wa_topup_packages_select on public.wa_topup_packages;
create policy wa_topup_packages_select on public.wa_topup_packages
  for select to authenticated using (
    public.is_platform_admin(auth.uid())
    or (is_active and exists (
      select 1 from public.employees e
      where e.profile_id = auth.uid() and e.is_active = true
    ))
  );

drop policy if exists wa_wallet_select on public.whatsapp_quota_wallets;
create policy wa_wallet_select on public.whatsapp_quota_wallets
  for select to authenticated using (
    public.is_platform_admin(auth.uid())
    or public.is_tenant_member(organization_id)
    or public.is_tenant_owner(organization_id, auth.uid())
  );

drop policy if exists wa_usage_select on public.whatsapp_usage_logs;
create policy wa_usage_select on public.whatsapp_usage_logs
  for select to authenticated using (
    public.is_platform_admin(auth.uid())
    or public.is_tenant_member(organization_id)
    or public.is_tenant_owner(organization_id, auth.uid())
  );

drop policy if exists wa_ledger_select on public.whatsapp_quota_ledger;
create policy wa_ledger_select on public.whatsapp_quota_ledger
  for select to authenticated using (
    public.is_platform_admin(auth.uid())
    or public.is_tenant_member(organization_id)
    or public.is_tenant_owner(organization_id, auth.uid())
  );

drop policy if exists payment_fulfillments_select on public.payment_fulfillments;
create policy payment_fulfillments_select on public.payment_fulfillments
  for select to authenticated using (
    public.is_platform_admin(auth.uid())
    or public.is_tenant_member(organization_id)
    or public.is_tenant_owner(organization_id, auth.uid())
  );

drop policy if exists payment_proofs_select on public.payment_proofs;
create policy payment_proofs_select on public.payment_proofs
  for select to authenticated using (
    public.is_platform_admin(auth.uid())
    or public.is_tenant_member(organization_id)
    or public.is_tenant_owner(organization_id, auth.uid())
  );

-- Tidak ada policy INSERT/UPDATE/DELETE untuk client: semua tulis lewat RPC SECURITY DEFINER.

-- ---------------------------------------------------------------------------
-- 8. Unlimited employee & ticket; branch limit tetap
-- ---------------------------------------------------------------------------
update public.packages set user_limit = null, ticket_quota = null;
update public.packages set wa_per_ticket_block = 0 where wa_per_ticket_block is not null;

create or replace function public.reserve_service_ticket(p_organization_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period date;
  v_used integer;
begin
  if p_organization_id is null then
    raise exception 'organization wajib diisi';
  end if;
  if not (public.is_platform_admin(auth.uid()) or public.is_tenant_member(p_organization_id)
          or public.is_tenant_owner(p_organization_id, auth.uid())) then
    raise exception 'akses ditolak';
  end if;

  select coalesce(s.current_period_start::date, date_trunc('month', now())::date)
  into v_period
  from public.tenant_subscriptions s
  where s.organization_id = p_organization_id;

  if not found then
    raise exception 'Subscription tidak ditemukan';
  end if;

  insert into public.organization_usage (organization_id, period_start, services_used)
  values (p_organization_id, v_period, 1)
  on conflict (organization_id, period_start) do update
    set services_used = public.organization_usage.services_used + 1,
        updated_at = now()
  returning services_used into v_used;

  return jsonb_build_object(
    'allowed', true,
    'used', v_used,
    'limit', null,
    'period_start', v_period
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. RPC kuota atomik
-- ---------------------------------------------------------------------------
create or replace function public.wa_quota_reserve(
  p_organization_id uuid,
  p_idempotency_key text,
  p_message_type text default 'service',
  p_branch_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet public.whatsapp_quota_wallets%rowtype;
  v_existing public.whatsapp_usage_logs%rowtype;
  v_source text;
  v_log_id uuid;
  v_is_service boolean;
begin
  if p_organization_id is null or nullif(trim(p_idempotency_key), '') is null then
    raise exception 'organization dan idempotency key wajib diisi';
  end if;

  v_is_service := coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') = 'service_role';
  if not v_is_service and not (
    public.is_platform_admin(auth.uid())
    or public.is_tenant_member(p_organization_id)
    or public.is_tenant_owner(p_organization_id, auth.uid())
  ) then
    raise exception 'akses ditolak';
  end if;

  if p_branch_id is not null and not exists (
    select 1 from public.branches b
    where b.id = p_branch_id and b.organization_id = p_organization_id
  ) then
    raise exception 'Cabang bukan milik tenant ini';
  end if;

  select * into v_existing
  from public.whatsapp_usage_logs
  where idempotency_key = p_idempotency_key;

  if found then
    return jsonb_build_object(
      'allowed', v_existing.quota_source <> 'none',
      'already_accounted', true,
      'quota_source', v_existing.quota_source,
      'reservation_id', v_existing.id
    );
  end if;

  select * into v_wallet
  from public.whatsapp_quota_wallets
  where organization_id = p_organization_id
  for update;

  if not found then
    insert into public.whatsapp_quota_wallets (organization_id)
    values (p_organization_id)
    returning * into v_wallet;
    select * into v_wallet
    from public.whatsapp_quota_wallets
    where organization_id = p_organization_id
    for update;
  end if;

  if v_wallet.included_limit - v_wallet.included_used > 0 then
    v_source := 'included';
  elsif v_wallet.topup_balance > 0 then
    v_source := 'topup';
  else
    v_source := 'none';
  end if;

  insert into public.whatsapp_usage_logs (
    organization_id, branch_id, idempotency_key, message_type,
    delivery_status, quota_source, quota_units
  ) values (
    p_organization_id, p_branch_id, p_idempotency_key, p_message_type,
    case when v_source = 'none' then 'rejected' else 'reserved' end,
    v_source, 1
  )
  returning id into v_log_id;

  if v_source = 'included' then
    update public.whatsapp_quota_wallets
    set included_used = included_used + 1, updated_at = now()
    where id = v_wallet.id;
  elsif v_source = 'topup' then
    update public.whatsapp_quota_wallets
    set topup_balance = topup_balance - 1, updated_at = now()
    where id = v_wallet.id;
  end if;

  if v_source <> 'none' then
    insert into public.whatsapp_quota_ledger (
      organization_id, transaction_type, amount, balance_after,
      reference_id, description, actor_user_id
    ) values (
      p_organization_id, 'message_consumption', -1,
      case when v_source = 'included'
        then v_wallet.included_limit - v_wallet.included_used - 1
        else v_wallet.topup_balance - 1 end,
      p_idempotency_key, 'Pemakaian 1 pesan WA (' || v_source || ')', auth.uid()
    );
  end if;

  return jsonb_build_object(
    'allowed', v_source <> 'none',
    'already_accounted', false,
    'quota_source', v_source,
    'reservation_id', v_log_id
  );
end;
$$;

create or replace function public.wa_quota_finalize(
  p_idempotency_key text,
  p_provider_message_id text default null,
  p_status text default 'delivered'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_log public.whatsapp_usage_logs%rowtype;
  v_wallet public.whatsapp_quota_wallets%rowtype;
  v_failed boolean;
begin
  select * into v_log
  from public.whatsapp_usage_logs
  where idempotency_key = p_idempotency_key
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  v_failed := p_status in ('failed', 'rejected', 'undelivered', 'error');

  if v_failed and v_log.delivery_status not in ('failed', 'refunded') then
    select * into v_wallet
    from public.whatsapp_quota_wallets
    where organization_id = v_log.organization_id
    for update;

    if v_log.quota_source = 'included' then
      update public.whatsapp_quota_wallets
      set included_used = greatest(0, included_used - v_log.quota_units), updated_at = now()
      where id = v_wallet.id;
    elsif v_log.quota_source = 'topup' then
      update public.whatsapp_quota_wallets
      set topup_balance = topup_balance + v_log.quota_units, updated_at = now()
      where id = v_wallet.id;
    end if;

    if v_log.quota_source <> 'none' then
      insert into public.whatsapp_quota_ledger (
        organization_id, transaction_type, amount, balance_after,
        reference_id, description, actor_user_id
      ) values (
        v_log.organization_id, 'refund', v_log.quota_units,
        case when v_log.quota_source = 'included'
          then v_wallet.included_limit - greatest(0, v_wallet.included_used - v_log.quota_units)
          else v_wallet.topup_balance + v_log.quota_units end,
        p_idempotency_key || ':refund', 'Refund karena pesan gagal (' || p_status || ')', auth.uid()
      )
      on conflict do nothing;
    end if;

    update public.whatsapp_usage_logs
    set delivery_status = 'failed',
        provider_message_id = coalesce(p_provider_message_id, provider_message_id),
        delivered_at = null
    where id = v_log.id;

    return jsonb_build_object('ok', true, 'refunded', true);
  end if;

  if not v_failed and v_log.delivery_status not in ('delivered', 'sent') then
    update public.whatsapp_usage_logs
    set delivery_status = case when p_status = 'sent' then 'sent' else 'delivered' end,
        provider_message_id = coalesce(p_provider_message_id, provider_message_id),
        delivered_at = coalesce(delivered_at, now())
    where id = v_log.id;
  end if;

  return jsonb_build_object('ok', true, 'refunded', false);
end;
$$;

create or replace function public.wa_quota_release(p_idempotency_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.wa_quota_finalize(p_idempotency_key, null, 'failed');
end;
$$;

-- ---------------------------------------------------------------------------
-- 10. Reset periodik: hanya included yang di-reset, top-up dipertahankan
-- ---------------------------------------------------------------------------
create or replace function public.wa_quota_reset(
  p_organization_id uuid,
  p_period_start date,
  p_period_end date,
  p_included_limit integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet public.whatsapp_quota_wallets%rowtype;
begin
  if not public.is_platform_admin(auth.uid()) then
    raise exception 'Platform admin access required';
  end if;
  if p_organization_id is null or p_period_end <= p_period_start or p_included_limit < 0 then
    raise exception 'Parameter reset tidak valid';
  end if;

  select * into v_wallet
  from public.whatsapp_quota_wallets
  where organization_id = p_organization_id
  for update;

  if not found then
    insert into public.whatsapp_quota_wallets (
      organization_id, included_limit, included_used, period_start, period_end
    ) values (p_organization_id, p_included_limit, 0, p_period_start, p_period_end)
    returning * into v_wallet;
  else
    update public.whatsapp_quota_wallets
    set included_limit = p_included_limit,
        included_used = 0,
        period_start = p_period_start,
        period_end = p_period_end,
        updated_at = now()
    where id = v_wallet.id
    returning * into v_wallet;
  end if;

  insert into public.whatsapp_quota_ledger (
    organization_id, transaction_type, amount, balance_after,
    reference_id, description, actor_user_id
  ) values (
    p_organization_id, 'included_reset', p_included_limit,
    v_wallet.included_limit + v_wallet.topup_balance,
    p_organization_id::text || ':' || p_period_start::text || ':reset',
    'Reset kuota included periode ' || p_period_start::text || ' (top-up dipertahankan)',
    auth.uid()
  )
  on conflict do nothing;

  return jsonb_build_object('ok', true, 'topup_balance', v_wallet.topup_balance);
end;
$$;

-- ---------------------------------------------------------------------------
-- 11. Order top-up & penyesuaian saldo (owner)
-- ---------------------------------------------------------------------------
create or replace function public.platform_create_topup_order(
  p_organization_id uuid,
  p_package_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_pkg public.wa_topup_packages%rowtype;
  v_sub_id uuid;
  v_invoice_id uuid;
begin
  -- org dikirim client, tetapi keanggotaannya diverifikasi ulang di server.
  v_org := p_organization_id;
  if v_org is null then
    raise exception 'Organisasi tidak ditemukan';
  end if;
  if not (public.is_tenant_member(v_org) or public.is_tenant_owner(v_org, auth.uid())
          or public.is_platform_admin(auth.uid())) then
    raise exception 'akses ditolak';
  end if;

  select * into v_pkg
  from public.wa_topup_packages
  where id = p_package_id and is_active = true;
  if not found then
    raise exception 'Paket top-up tidak tersedia';
  end if;

  select id into v_sub_id
  from public.tenant_subscriptions
  where organization_id = v_org;
  if v_sub_id is null then
    raise exception 'Subscription tidak ditemukan';
  end if;

  -- Amount & quantity dihitung dari katalog DB, bukan dari client.
  insert into public.invoices (
    subscription_id, organization_id, package_id, invoice_number, invoice_type,
    status, amount, period_start, period_end, due_date, payment_provider,
    wa_topup_package_id, wa_message_quantity
  )
  select
    v_sub_id, v_org, s.package_id,
    'TOP-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(gen_random_uuid()::text, 1, 6)),
    'topup', 'pending', v_pkg.price_idr, now(), now() + interval '1 month',
    now() + interval '7 days', 'manual_transfer', v_pkg.id, v_pkg.message_quantity
  from public.tenant_subscriptions s
  where s.id = v_sub_id
  returning id into v_invoice_id;

  insert into public.platform_audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'topup_order.created', 'invoice', v_invoice_id,
    jsonb_build_object('organization_id', v_org, 'message_quantity', v_pkg.message_quantity, 'amount', v_pkg.price_idr));

  return v_invoice_id;
end;
$$;

create or replace function public.platform_adjust_wa_quota(
  p_organization_id uuid,
  p_amount integer,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet public.whatsapp_quota_wallets%rowtype;
  v_new_balance integer;
begin
  if not public.is_platform_admin(auth.uid()) then
    raise exception 'Platform admin access required';
  end if;
  if nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception 'Alasan penyesuaian wajib diisi';
  end if;
  if p_organization_id is null or p_amount = 0 then
    raise exception 'Parameter penyesuaian tidak valid';
  end if;

  select * into v_wallet
  from public.whatsapp_quota_wallets
  where organization_id = p_organization_id
  for update;

  if not found then
    insert into public.whatsapp_quota_wallets (organization_id)
    values (p_organization_id)
    returning * into v_wallet;
    select * into v_wallet
    from public.whatsapp_quota_wallets
    where organization_id = p_organization_id
    for update;
  end if;

  v_new_balance := greatest(0, v_wallet.topup_balance + p_amount);

  update public.whatsapp_quota_wallets
  set topup_balance = v_new_balance, updated_at = now()
  where id = v_wallet.id;

  insert into public.whatsapp_quota_ledger (
    organization_id, transaction_type, amount, balance_after,
    reference_id, description, reason, actor_user_id
  ) values (
    p_organization_id, 'adjustment', p_amount, v_new_balance,
    gen_random_uuid()::text, 'Penyesuaian saldo top-up oleh platform owner',
    trim(p_reason), auth.uid()
  );

  insert into public.platform_audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'wa_quota.adjusted', 'organization', p_organization_id,
    jsonb_build_object('amount', p_amount, 'balance_after', v_new_balance, 'reason', trim(p_reason)));

  return jsonb_build_object('ok', true, 'topup_balance', v_new_balance);
end;
$$;

-- ---------------------------------------------------------------------------
-- 12. Fulfillment idempoten + retryable
-- ---------------------------------------------------------------------------
create or replace function public.payment_apply_fulfillment(p_invoice_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice public.invoices%rowtype;
  v_fill public.payment_fulfillments%rowtype;
  v_wallet public.whatsapp_quota_wallets%rowtype;
  v_type text;
  v_new_balance integer;
begin
  select * into v_invoice
  from public.invoices
  where id = p_invoice_id
  for update;

  if not found or v_invoice.status <> 'approved' then
    raise exception 'Invoice tidak approved';
  end if;

  v_type := case when v_invoice.invoice_type = 'topup' then 'wa_topup' else 'subscription_period' end;

  insert into public.payment_fulfillments (
    invoice_id, organization_id, fulfillment_type, status, idempotency_key
  ) values (
    p_invoice_id, v_invoice.organization_id, v_type, 'pending',
    p_invoice_id::text || ':' || v_type
  )
  on conflict (invoice_id) do nothing;

  select * into v_fill
  from public.payment_fulfillments
  where invoice_id = p_invoice_id
  for update;

  if v_fill.status = 'succeeded' then
    return jsonb_build_object('ok', true, 'already_fulfilled', true, 'type', v_type);
  end if;

  if v_type = 'wa_topup' then
    select * into v_wallet
    from public.whatsapp_quota_wallets
    where organization_id = v_invoice.organization_id
    for update;

    if not found then
      insert into public.whatsapp_quota_wallets (organization_id)
      values (v_invoice.organization_id)
      returning * into v_wallet;
      select * into v_wallet
      from public.whatsapp_quota_wallets
      where organization_id = v_invoice.organization_id
      for update;
    end if;

    v_new_balance := v_wallet.topup_balance + coalesce(v_invoice.wa_message_quantity, 0);

    update public.whatsapp_quota_wallets
    set topup_balance = v_new_balance, updated_at = now()
    where id = v_wallet.id;

    insert into public.whatsapp_quota_ledger (
      organization_id, transaction_type, amount, balance_after,
      reference_id, description, actor_user_id
    ) values (
      v_invoice.organization_id, 'topup_purchase', coalesce(v_invoice.wa_message_quantity, 0),
      v_new_balance, p_invoice_id::text || ':topup_purchase',
      'Pembelian ' || coalesce(v_invoice.wa_message_quantity, 0) || ' pesan WA', auth.uid()
    )
    on conflict do nothing;
  else
    update public.tenant_subscriptions
    set package_id = v_invoice.package_id,
        custom_monthly_price = case
          when package_id = v_invoice.package_id then custom_monthly_price
          else null
        end,
        status = 'active',
        current_period_start = v_invoice.period_start,
        current_period_end = v_invoice.period_end,
        activated_at = coalesce(activated_at, now()),
        cancelled_at = null
    where id = v_invoice.subscription_id;
  end if;

  update public.payment_fulfillments
  set status = 'succeeded',
      attempts = attempts + 1,
      last_error = null,
      fulfilled_at = now(),
      updated_at = now()
  where id = v_fill.id;

  return jsonb_build_object('ok', true, 'already_fulfilled', false, 'type', v_type);
end;
$$;

create or replace function public.platform_retry_fulfillment(p_invoice_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fill public.payment_fulfillments%rowtype;
begin
  if not public.is_platform_admin(auth.uid()) then
    raise exception 'Platform admin access required';
  end if;

  select * into v_fill
  from public.payment_fulfillments
  where invoice_id = p_invoice_id
  for update;

  if not found then
    raise exception 'Fulfillment tidak ditemukan';
  end if;
  if v_fill.status = 'succeeded' then
    raise exception 'Fulfillment sudah berhasil';
  end if;

  return public.payment_apply_fulfillment(p_invoice_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- 13. Approval: status & fulfillment terpisah, dedup approval
-- ---------------------------------------------------------------------------
create or replace function public.platform_approve_invoice(
  target_invoice_id uuid,
  approval_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  invoice_row public.invoices%rowtype;
  approved_period_start timestamptz;
  approved_period_end timestamptz;
begin
  if not public.is_platform_admin(auth.uid()) then
    raise exception 'Platform admin access required';
  end if;

  select * into invoice_row
  from public.invoices
  where id = target_invoice_id
  for update;

  if invoice_row.id is null or invoice_row.status <> 'pending' then
    raise exception 'Pending invoice not found';
  end if;

  if invoice_row.invoice_type = 'topup' then
    approved_period_start := invoice_row.period_start;
    approved_period_end := invoice_row.period_end;
  elsif invoice_row.invoice_type = 'renewal' then
    select greatest(s.current_period_end, now()) into approved_period_start
    from public.tenant_subscriptions s where s.id = invoice_row.subscription_id;
    approved_period_end := approved_period_start + interval '1 month';
  else
    approved_period_start := now();
    approved_period_end := approved_period_start + interval '1 month';
  end if;

  update public.invoices
  set status = 'approved',
      period_start = approved_period_start,
      period_end = approved_period_end,
      paid_at = now(),
      approved_by = auth.uid(),
      decision_note = nullif(trim(approval_note), '')
  where id = target_invoice_id;

  -- Void sibling hanya untuk invoice langganan, bukan top-up.
  if invoice_row.invoice_type <> 'topup' then
    update public.invoices
    set status = 'voided',
        decision_note = 'Voided after another invoice was approved'
    where subscription_id = invoice_row.subscription_id
      and id <> target_invoice_id
      and status = 'pending'
      and period_start = invoice_row.period_start;
  end if;

  perform public.payment_apply_fulfillment(target_invoice_id);

  insert into public.platform_audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(), 'invoice.approved', 'invoice', target_invoice_id,
    jsonb_build_object('subscription_id', invoice_row.subscription_id, 'amount', invoice_row.amount,
      'invoice_type', invoice_row.invoice_type, 'period_start', approved_period_start,
      'period_end', approved_period_end)
  );

  return invoice_row.subscription_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 14. Rejection tetap meminta alasan (dipertahankan dari migrasi lama)
-- ---------------------------------------------------------------------------
-- platform_reject_invoice lama sudah memvalidasi alasan; tidak diubah.

-- ---------------------------------------------------------------------------
-- 15. Grant / revoke
-- ---------------------------------------------------------------------------
revoke all on function public.wa_quota_reserve(uuid, text, text, uuid) from public, anon;
grant execute on function public.wa_quota_reserve(uuid, text, text, uuid) to authenticated, service_role;

revoke all on function public.wa_quota_finalize(text, text, text) from public, anon;
grant execute on function public.wa_quota_finalize(text, text, text) to authenticated, service_role;

revoke all on function public.wa_quota_release(text) from public, anon;
grant execute on function public.wa_quota_release(text) to authenticated, service_role;

revoke all on function public.wa_quota_reset(uuid, date, date, integer) from public, anon;
grant execute on function public.wa_quota_reset(uuid, date, date, integer) to service_role;

revoke all on function public.platform_create_topup_order(uuid, uuid) from public, anon;
grant execute on function public.platform_create_topup_order(uuid, uuid) to authenticated, service_role;

revoke all on function public.platform_adjust_wa_quota(uuid, integer, text) from public, anon;
grant execute on function public.platform_adjust_wa_quota(uuid, integer, text) to authenticated, service_role;

revoke all on function public.payment_apply_fulfillment(uuid) from public, anon;
grant execute on function public.payment_apply_fulfillment(uuid) to service_role;

revoke all on function public.platform_retry_fulfillment(uuid) from public, anon;
grant execute on function public.platform_retry_fulfillment(uuid) to authenticated, service_role;

grant select on public.wa_topup_packages to authenticated;
grant select on public.whatsapp_quota_wallets to authenticated;
grant select on public.whatsapp_usage_logs to authenticated;
grant select on public.whatsapp_quota_ledger to authenticated;
grant select on public.payment_fulfillments to authenticated;
grant select on public.payment_proofs to authenticated;

-- ---------------------------------------------------------------------------
-- 16. Backfill wallet (data existing sangat kecil) — idempoten
-- ---------------------------------------------------------------------------
insert into public.whatsapp_quota_wallets (
  organization_id, included_limit, included_used, topup_balance, period_start, period_end
)
select
  u.organization_id,
  coalesce(p.whatsapp_quota, 0),
  coalesce(u.wa_included_used, 0),
  greatest(0, coalesce(u.wa_topup_granted, 0) - coalesce(u.wa_topup_used, 0)),
  u.period_start,
  u.period_start + interval '1 month'
from public.organization_usage u
join public.tenant_subscriptions s on s.organization_id = u.organization_id
join public.packages p on p.id = s.package_id
where u.period_start = (
  select max(u2.period_start) from public.organization_usage u2
  where u2.organization_id = u.organization_id
)
and not exists (
  select 1 from public.whatsapp_quota_wallets w where w.organization_id = u.organization_id
);

insert into public.whatsapp_quota_wallets (
  organization_id, included_limit, included_used, topup_balance, period_start, period_end
)
select s.organization_id, coalesce(p.whatsapp_quota, 0), 0, 0,
       date_trunc('month', now())::date, (date_trunc('month', now()) + interval '1 month')::date
from public.tenant_subscriptions s
join public.packages p on p.id = s.package_id
where not exists (
  select 1 from public.whatsapp_quota_wallets w where w.organization_id = s.organization_id
);

insert into public.whatsapp_quota_ledger (
  organization_id, transaction_type, amount, balance_after, reference_id, description
)
select organization_id, 'included_reset', included_limit,
       included_limit + topup_balance,
       organization_id::text || ':' || period_start::text || ':backfill',
       'Backfill wallet saat migrasi'
from public.whatsapp_quota_wallets
where not exists (
  select 1 from public.whatsapp_quota_ledger l
  where l.organization_id = whatsapp_quota_wallets.organization_id
    and l.reference_id = whatsapp_quota_wallets.organization_id::text || ':' || whatsapp_quota_wallets.period_start::text || ':backfill'
);
