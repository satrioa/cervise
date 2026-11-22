-- Kuota WhatsApp per paket disesuaikan. Tiket servis sengaja unlimited
-- (ticket_quota = null) untuk semua paket.
update public.packages
set whatsapp_quota = case code
  when 'trial' then 50
  when 'starter' then 100
  when 'business' then 300
  when 'custom' then 150
  else whatsapp_quota
end,
ticket_quota = null
where code in ('trial', 'starter', 'basic', 'pro', 'business', 'custom');
