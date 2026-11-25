-- Wallet bisa terbentuk dengan included_limit = 0 (mis. saat RPC reservasi
-- dipanggil sebelum paket aktif terbaca). Sinkronkan dari paket langganan
-- supaya kuota tidak permanen nol sampai siklus berikutnya.
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
  v_package_quota integer;
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

  select coalesce(p.whatsapp_quota, 0) into v_package_quota
  from public.tenant_subscriptions s
  join public.packages p on p.id = s.package_id
  where s.organization_id = p_organization_id
  limit 1;
  v_package_quota := coalesce(v_package_quota, 0);

  select * into v_wallet
  from public.whatsapp_quota_wallets
  where organization_id = p_organization_id
  for update;

  if not found then
    insert into public.whatsapp_quota_wallets (organization_id, included_limit)
    values (p_organization_id, v_package_quota)
    returning * into v_wallet;
    select * into v_wallet
    from public.whatsapp_quota_wallets
    where organization_id = p_organization_id
    for update;
  elsif v_wallet.included_limit = 0 and v_package_quota > 0 then
    -- short-circuit: wallet lama yang limitnya 0 ikut kuota paket aktif.
    update public.whatsapp_quota_wallets
    set included_limit = v_package_quota, updated_at = now()
    where id = v_wallet.id
    returning * into v_wallet;
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

-- Data yang sudah terlanjur: samakan limit wallet yang masih 0 dengan paket aktif.
update public.whatsapp_quota_wallets w
set included_limit = p.whatsapp_quota, updated_at = now()
from public.tenant_subscriptions s
join public.packages p on p.id = s.package_id
where w.organization_id = s.organization_id
  and w.included_limit = 0
  and coalesce(p.whatsapp_quota, 0) > 0;
