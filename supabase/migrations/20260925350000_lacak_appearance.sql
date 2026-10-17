-- Pengaturan tampilan halaman Lacak publik per toko.
--
-- Disimpan di organizations karena Lacak dibaca lewat slug tanpa login, jadi
-- sumbernya harus milik tenant, bukan milik profil pengguna. Nilai ditulis
-- hanya oleh MASTER_ADMIN lewat halaman /app/pengaturan/tampilan.

alter table public.organizations
  add column if not exists lacak_appearance jsonb not null default '{}'::jsonb;
