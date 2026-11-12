-- "Simpan subscription" menyimpan status 'active' tetapi tidak memperpanjang
-- current_period_end. Akses login dihitung dari
-- `current_period_end + grace_days` (lihat is_tenant_subscription_active),
-- jadi tenant dengan status active tetap ditolak setelah periode lama lewat.
-- Gejala nyata: owner mengubah status ke active + paket Pro, tetapi user
-- tenant tidak bisa login (tenant-inactive).
--
-- Perbaikan: saat status diubah ke 'active' dan periode sudah lewat/null,
-- mulai periode baru satu bulan. Status active yang periodenya masih
-- berjalan tidak diubah, supaya toggle active tidak menggandakan masa aktif.
create or replace function public.platform_update_subscription(
  target_organization_id uuid,
  target_package_id uuid,
  custom_monthly_price integer,
  target_grace_days integer,
  target_status public.cervise_subscription_status
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
  if not public.is_platform_admin(auth.uid()) then raise exception 'Platform admin access required'; end if;
  if custom_monthly_price is not null and custom_monthly_price < 0 then raise exception 'Custom price must be zero or greater'; end if;
  if target_grace_days not between 0 and 30 then raise exception 'Grace days must be between 0 and 30'; end if;
  update public.tenant_subscriptions set
    package_id = target_package_id,
    custom_monthly_price = custom_monthly_price,
    grace_days = target_grace_days,
    status = target_status,
    current_period_start = case
      when target_status = 'active'
        and (tenant_subscriptions.current_period_end is null or tenant_subscriptions.current_period_end <= now())
        then now()
      else current_period_start
    end,
    current_period_end = case
      when target_status = 'active'
        and (tenant_subscriptions.current_period_end is null or tenant_subscriptions.current_period_end <= now())
        then now() + interval '1 month'
      else current_period_end
    end,
    activated_at = case when target_status = 'active' then coalesce(activated_at, now()) else activated_at end,
    cancelled_at = case when target_status = 'cancelled' then coalesce(cancelled_at, now()) else null end
  where organization_id = target_organization_id
  returning id into subscription_id;
  if subscription_id is null then raise exception 'Subscription not found'; end if;
  insert into public.platform_audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'subscription.updated', 'subscription', subscription_id, jsonb_build_object('package_id', target_package_id, 'custom_price', custom_monthly_price, 'grace_days', target_grace_days, 'status', target_status));
  return subscription_id;
end;
$$;
