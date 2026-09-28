-- Pemilik tenant dicatat eksplisit.
--
-- Sebelumnya "siapa pemilik tenant ini?" tidak punya jawaban yang jujur. Yang
-- ada hanya:
--   1. organizations.created_by - yang kebetulan diisi owner_user_id oleh
--      platform_create_tenant, jadi antara "yang membuat" dan "yang membeli"
--      tercampur dalam satu kolom.
--   2. employees.role = 'MASTER_ADMIN' - yang di beberapa tempat dibaca sebagai
--      penanda owner (post-login.ts memakai MASTER_ADMIN untuk deciding
--      "hasOwnerMembership").
--
-- Akibatnya master admin operasional dan pemilik yang membayar tenant terlihat
-- level-nya sama, dan tidak ada tempat yang bisa mencatat siapa yang
-- bertanggung jawab atas tagihan.
--
-- Kolom baru ini hanya menandai kepemilikan. Hak operasional tetap milik
-- employees.role, jadi tidak ada role baru yang harus dimasukkan ke APP_ROLE
-- (src/lib/nav/manifest.ts) - itu akan memaksa setiap entri navigasi
-- memutuskan perannya.

alter table public.organizations
  add column if not exists owner_profile_id uuid references auth.users(id) on delete set null;

comment on column public.organizations.owner_profile_id is
  'Profil yang memiliki/membayar tenant ini. Satu tenant satu pemilik. Berbeda dari employees.role, yang menggambarkan hak operasional.';

-- Backfill. created_by pada tenant yang dibuat lewat platform_create_tenant
-- sudah bernilai owner_user_id, dan pada tenant self-signup nilai itu juga
-- pemilik yang sama, jadi sumber ini konsisten untuk dua jalur pembuatan.
update public.organizations
set owner_profile_id = created_by
where owner_profile_id is null
  and created_by is not null;

create index if not exists organizations_owner_profile_id_idx
  on public.organizations(owner_profile_id);

-- Diisi saat tenant dibuat, mengikuti created_by, lalu tidak lagi disentuh.
-- Dipakai trigger, bukan penulisan manual di dalam platform_create_tenant dan
-- complete_tenant_onboarding: dua fungsi itu panjang dan sensitif, dan mengubah
-- keduanya hanya untuk menambah satu kolom berisiko menyalin logika yang salah
-- tanpa ketahuan. Trigger juga otomatis berlaku untuk jalur pembuatan tenant
-- di masa depan.
--
-- Hanya BEFORE INSERT. Kalau ikut ikut jalan di UPDATE, setiap perubahan
-- created_by diam-diam memindahkan kepemilikan - dan jawaban yang sudah
-- disepakati untuk proyek ini adalah ownership tidak bisa dipindahkan.
create or replace function public.set_tenant_owner_on_insert()
returns trigger
language plpgsql
as $$
begin
  if new.owner_profile_id is null and new.created_by is not null then
    new.owner_profile_id := new.created_by;
  end if;
  return new;
end;
$$;

drop trigger if exists organizations_set_owner_on_insert on public.organizations;
create trigger organizations_set_owner_on_insert
  before insert on public.organizations
  for each row
  execute function public.set_tenant_owner_on_insert();

-- Helper untuk RLS. Dipisah dari is_tenant_member karena yang dijawab berbeda:
-- "apakah dia anggota tenant ini" vs "apakah dia pemiliknya".
create or replace function public.is_tenant_owner(
  check_organization_id uuid,
  check_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organizations
    where id = check_organization_id
      and owner_profile_id = check_user_id
  );
$$;

revoke all on function public.is_tenant_owner(uuid, uuid) from public;

-- Pemilik harus tetap bisa membaca tenant-nya sendiri, termasuk kalau
-- employees row-nya nanti hilang karena dia dinonaktifkan sebagai admin -
-- tagihannya tidak ikut hilang hanya karena tidak lagi mengurusi operasional.
drop policy if exists organizations_select on public.organizations;
create policy organizations_select on public.organizations
for select to authenticated
using (
  public.is_platform_admin()
  or public.is_tenant_member(id)
  or created_by = auth.uid()
  or public.is_tenant_owner(id)
);
