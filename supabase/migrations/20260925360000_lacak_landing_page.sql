-- Landing page branded untuk halaman Lacak publik.
--
-- Kolom ini milik tenant: halaman /{slug}/lacak dibaca pengunjung tanpa sesi,
-- jadi penampilannya harus sama untuk semua orang dan tidak boleh ikut
-- berubah karena preferensi satu akun.

alter table public.organizations
  add column if not exists banner_url text,
  add column if not exists tagline text,
  add column if not exists instagram_url text,
  add column if not exists tiktok_url text;

-- Testimoni ditulis manual oleh MASTER_ADMIN, bukan turunan dari data servis.
-- rating nullable karena admin boleh menyimpan testimoni tanpa bintang.
create table if not exists public.lacak_testimonials (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  nama text not null check (length(trim(nama)) > 0),
  isi text not null check (length(trim(isi)) > 0),
  rating smallint check (rating is null or rating between 1 and 5),
  urutan integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists lacak_testimonials_org_idx
  on public.lacak_testimonials (organization_id, urutan, created_at);

-- Halaman publiknya sudah dijaga service role di sisi aplikasi, tapi RLS
-- default (deny) tetap dipasang supaya tidak ada jalur baca lain yang
-- tidak sengaja terbuka.
alter table public.lacak_testimonials enable row level security;