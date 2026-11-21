-- RPC yang dipanggil cron memakai service_role (tanpa auth.uid()).
-- Berikan bypass hanya untuk wa_quota_reset; endpoint cron sudah diamankan
-- CRON_SECRET. RPC lain tetap memakai client sesi pengguna.

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
  if coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') <> 'service_role'
     and not public.is_platform_admin(auth.uid()) then
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
