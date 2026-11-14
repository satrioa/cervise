-- Pengaturan tampilan nota/struk: logo khusus nota dan teks footer.
-- Dipisah dari logo/banner halaman Lacak publik agar bisa dikonfigurasi mandiri.

alter table public.organizations
  add column if not exists receipt_logo_url text null,
  add column if not exists receipt_footer_text text null;

comment on column public.organizations.receipt_logo_url is 'Storage path logo yang dicetak di nota/struk (terpisah dari logo halaman Lacak).';
comment on column public.organizations.receipt_footer_text is 'Teks footer yang dicetak di nota/struk.';