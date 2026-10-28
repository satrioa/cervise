-- Custom role (base-role bounded). Setiap role buatan memilih satu dasar
-- (ADMIN / FRONTLINER / TECHNICIAN) dan hanya boleh menyertakan subset
-- dari izin dasar tersebut. MASTER_ADMIN adalah plafon sistem, tidak
-- boleh menjadi dasar role buatan, dan tetap sebagai role bawaan.

-- 1. Tabel role, per organisasi.
create table if not exists public.cervise_roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  key text not null,
  name text not null,
  base_role text not null check (base_role in ('ADMIN', 'FRONTLINER', 'TECHNICIAN')),
  permissions text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cervise_roles_org_key unique (organization_id, key),
  constraint cervise_roles_org_name unique (organization_id, name),
  constraint cervise_roles_key_fmt check (key ~ '^[A-Z][A-Z0-9_]{2,31}$')
);

-- 2. Triggers tetap (updated_at) sama dengan tabel lain.
create or replace function public.cervise_touch_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists cervise_roles_updated_at on public.cervise_roles;
create trigger cervise_roles_updated_at before update on public.cervise_roles for each row execute procedure public.cervise_touch_updated_at();

-- 3. RLS: pembaca semua karyawan aktif organisasi; penulis hanya
-- Master Admin (seperti employees_insert/update lainnya).
alter table public.cervise_roles enable row level security;

drop policy if exists cervise_roles_select on public.cervise_roles;
create policy cervise_roles_select on public.cervise_roles
for select to authenticated using (public.is_tenant_member(organization_id));

drop policy if exists cervise_roles_insert on public.cervise_roles;
create policy cervise_roles_insert on public.cervise_roles
for insert to authenticated with check (public.has_tenant_role(organization_id, array['MASTER_ADMIN']));

drop policy if exists cervise_roles_update on public.cervise_roles;
create policy cervise_roles_update on public.cervise_roles
for update to authenticated using (public.has_tenant_role(organization_id, array['MASTER_ADMIN'])) with check (public.has_tenant_role(organization_id, array['MASTER_ADMIN']));

drop policy if exists cervise_roles_delete on public.cervise_roles;
create policy cervise_roles_delete on public.cervise_roles
for delete to authenticated using (public.has_tenant_role(organization_id, array['MASTER_ADMIN']));

-- 4. Kolom `role_key` di employees (tidak mengubah `employees.role`, jadi
-- RLS dan helper fungsi yang sudah ada tetap bekerja tanpa penulisan ulang).
alter table public.employees add column if not exists role_key text;

drop index if exists public.employees_role_key_idx;
create index employees_role_key_idx on public.employees(organization_id, role_key);

alter table public.employees
  drop constraint if exists employees_role_key_fkey;
alter table public.employees
  add constraint employees_role_key_fkey
  foreign key (organization_id, role_key) references public.cervise_roles(organization_id, key)
  on update cascade on delete restrict;

-- 5. Cadangan 3 sistem role per organisasi yang sudah ada, agar ukuran tabel
-- konsisten antara organisasi lama dan baru. Role sistem sebenarnya hanya
-- ada di kode aplikasi (lebih dari 3). Baris ini hanya mark-up pemeta.
insert into public.cervise_roles (organization_id, key, name, base_role, permissions, created_at, updated_at)
select o.id, 'ADMIN_DEFAULT', 'Admin', 'ADMIN', '{}', now(), now()
from public.organizations o
where not exists (
  select 1 from public.cervise_roles r
  where r.organization_id = o.id and r.key = 'ADMIN_DEFAULT'
);

-- 6. Persiapan agar `guard_employee_role_change` juga melindungi role_key.
-- Perubahan direktif di sini tidak menambahkan event baru, hanya memastikan
-- bahwa perubahan `employees.role` tetap only oleh MASTER_ADMIN; perubahan
-- `role_key` diserahkan ke gate aplikasi (`updateKaryawan` sudahcek base_role).
