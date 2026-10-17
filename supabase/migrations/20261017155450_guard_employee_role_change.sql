-- Cegah ADMIN mengangkat dirinya sendiri jadi MASTER_ADMIN lewat REST.
--
-- Policy employees_insert/employees_update (20260925220000) mengizinkan ADMIN
-- menulis baris employees di cabangnya, dan grant kolomnya memuat `role`.
-- Tanpa trigger di sini, satu PATCH /rest/v1/employees dengan
-- {"role":"MASTER_ADMIN"} sudah cukup: policy lolos, grant mengizinkan
-- kolomnya, dan semua penjaga role di aplikasi (canManageEmployees) dilewati.
--
-- Yang diizinkan:
--   - platform admin, untuk provisioning apa pun
--   - MASTER_ADMIN dari tenant yang sama, untuk menunjuk/mengganti karyawan
--   - baris MASTER_ADMIN pertama di sebuah organisasi, untuk onboarding
--
-- Onboarding dilakukan oleh pengguna yang belum punya baris employees sama
-- sekali (complete_tenant_onboarding menolak kalau sudah punya), jadi kasus
-- "belum punya baris" harus tetap boleh atau tenant tidak akan pernah bisa
-- dibuat.

create or replace function public.guard_employee_role_change()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if public.is_platform_admin() then
    return new;
  end if;

  -- sudah MASTER_ADMIN di tenant yang sama
  if public.has_tenant_role(old.organization_id, array['MASTER_ADMIN']::text[]) then
    return new;
  end if;

  -- belum punya baris employees sama sekali di organisasi ini: onboarding
  if not exists (
    select 1 from public.employees existing
    where existing.profile_id = auth.uid()
      and existing.organization_id = old.organization_id
      and existing.is_active = true
  ) then
    return new;
  end if;

  raise exception 'Hanya platform admin atau MASTER_ADMIN yang dapat mengubah role karyawan'
    using errcode = '42501';
end;
$function$;

drop trigger if exists guard_employee_role_change on public.employees;

create trigger guard_employee_role_change
before insert or update on public.employees
for each row
execute function public.guard_employee_role_change();