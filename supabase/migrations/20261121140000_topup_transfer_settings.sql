-- Rekening platform owner untuk transfer manual top-up WhatsApp.
-- Disimpan di platform_settings supaya bisa diubah owner tanpa deploy.
alter table public.platform_settings
  add column if not exists bank_name text,
  add column if not exists bank_account_name text,
  add column if not exists bank_account_number text;

-- Penanda bahwa tenant sudah mengirim konfirmasi WA ke owner.
-- Status invoice sengaja tetap 'pending' sampai owner approve/reject.
alter table public.invoices
  add column if not exists wa_confirmation_sent_at timestamptz;
