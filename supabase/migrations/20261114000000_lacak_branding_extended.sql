-- Perluasan branding & sosial untuk halaman Lacak publik.
-- Semua kolom nullable supaya tenant lama tetap render identik (fallback ke
-- perilaku sebelumnya: hanya IG/TikTok + alamat/telepon cabang aktif).

alter table public.organizations
  add column if not exists website_url text,
  add column if not exists facebook_url text,
  add column if not exists x_url text,
  add column if not exists youtube_url text,
  add column if not exists whatsapp_url text,
  add column if not exists maps_url text,
  add column if not exists footer_note text;

comment on column public.organizations.website_url is 'URL website resmi toko, ditampilkan di footer halaman Lacak.';
comment on column public.organizations.facebook_url is 'URL Facebook, ditampilkan di footer halaman Lacak.';
comment on column public.organizations.x_url is 'URL X/Twitter, ditampilkan di footer halaman Lacak.';
comment on column public.organizations.youtube_url is 'URL YouTube/channel, ditampilkan di footer halaman Lacak.';
comment on column public.organizations.whatsapp_url is 'Tautan WhatsApp (wa.me) yang ditampilkan di footer halaman Lacak.';
comment on column public.organizations.maps_url is 'Tautan Google Maps, ditampilkan di footer halaman Lacak.';
comment on column public.organizations.footer_note is 'Catatan singkat di footer halaman Lacak (maks 200 karakter).';