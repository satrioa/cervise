-- Banner halaman Lacak menjadi slider maksimal 3 gambar.
-- `banner_url` lama dibiarkan sebagai legacy (tidak dibaca kode) supaya rollback
-- tidak kehilangan data; satu-satunya sumber kebenaran sekarang `banner_urls`.

alter table public.organizations
  add column if not exists banner_urls text[] not null default '{}';

update public.organizations
   set banner_urls = array[banner_url]
 where banner_url is not null
   and cardinality(banner_urls) = 0;

comment on column public.organizations.banner_urls is
  'Path objek banner halaman Lacak (maks 3, urutan tampil). Menggantikan banner_url.';
