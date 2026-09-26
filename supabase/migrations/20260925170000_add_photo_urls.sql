-- Foto akun (profiles.avatar_url) + logo tenant (organizations.logo_url).
--
-- Bucket Cervise sengaja TIDAK diberi policy storage.objects untuk
-- authenticated/anon. Konsekuensinya:
--   - browser tidak bisa menulis ke bucket ini secara langsung
--   - seluruh upload/remove harus lewat server action yang memeriksa
--     kepemilikan (src/lib/photos.ts + src/app/app/pengaturan/*)
--   - pembacaan tetap bisa lewat URL publik karena bucket public = true,
--     dan nama file-nya diacak sehingga tidak bisa ditebak
--
-- Kolom baru sengaja TIDAK ditambah ke grant update di
-- 20260925122000_harden_auth_rls.sql. Penulisan lewat service role dari
-- server action, supaya tabel yang sengaja dikunci tidak dilonggarkan.

-- 1. Kolom penyimpanan path foto
alter table public.profiles add column if not exists avatar_url text;
alter table public.organizations add column if not exists logo_url text;

comment on column public.profiles.avatar_url is
  'Path objek di bucket cervise-photos, relatif terhadap bucket root. Null = belum ada foto.';
comment on column public.organizations.logo_url is
  'Path objek di bucket cervise-photos, relatif terhadap bucket root. Null = belum ada logo.';

-- 2. Bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'cervise-photos',
  'cervise-photos',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- 3. Hapus policy storage.objects yang mungkin pernah dibuat untuk bucket ini.
--    posthak: upload hanya boleh lewat server action, bukan dari browser.
drop policy if exists "cervise photos select" on storage.objects;
drop policy if exists "cervise photos insert" on storage.objects;
drop policy if exists "cervise photos update" on storage.objects;
drop policy if exists "cervise photos delete" on storage.objects;
