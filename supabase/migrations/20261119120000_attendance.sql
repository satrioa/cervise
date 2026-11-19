-- Absensi karyawan: satu baris per karyawan per hari (WIB).
create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  employee_id uuid not null references public.profiles(id) on delete cascade,
  attendance_date date not null,
  check_in_at timestamptz,
  check_out_at timestamptz,
  check_in_selfie_path text,
  check_out_selfie_path text,
  check_in_lat double precision,
  check_in_lng double precision,
  check_out_lat double precision,
  check_out_lng double precision,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attendance_records_one_per_day
    unique (organization_id, employee_id, attendance_date),
  constraint attendance_records_checkout_valid
    check (check_out_at is null or (check_in_at is not null and check_out_at > check_in_at))
);

create index if not exists attendance_records_branch_date_idx
  on public.attendance_records(organization_id, branch_id, attendance_date desc);

alter table public.branches
  add column if not exists check_in_time time not null default '08:00',
  add column if not exists check_out_time time not null default '17:00';

alter table public.attendance_records enable row level security;

-- Urutan OR penting: is_platform_admin() lebih dulu, karena
-- can_access_tenant_branch() adalah SECURITY DEFINER yang membaca employees.
--
-- Baris milik sendiri sengaja TIDAK memakai can_access_tenant_branch(): helper
-- itu juga menguji langganan aktif, padahal /absensi harus tetap bisa dipakai
-- saat trial habis. Pemeriksian karyawan aktif tetap dilakukan langsung.
drop policy if exists attendance_records_select on public.attendance_records;
create policy attendance_records_select on public.attendance_records
  for select to authenticated
  using (
    public.is_platform_admin()
    or (
      employee_id = auth.uid()
      and exists (
        select 1 from public.employees e
        where e.profile_id = auth.uid() and e.is_active = true
      )
    )
    or public.can_access_tenant_branch(branch_id, array['MASTER_ADMIN', 'ADMIN']::text[])
  );

-- Tidak ada INSERT/UPDATE/DELETE langsung: semua tulis lewat RPC di bawah.
revoke all on public.attendance_records from anon;
revoke insert, update, delete on public.attendance_records from authenticated;
grant select on public.attendance_records to authenticated;
grant select, insert, update, delete on public.attendance_records to service_role;

create or replace function public.submit_attendance(
  p_kind text,
  p_selfie_path text,
  p_lat double precision,
  p_lng double precision,
  p_note text
) returns public.attendance_records
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee public.employees%rowtype;
  v_date date := (now() at time zone 'Asia/Jakarta')::date;
  v_row public.attendance_records%rowtype;
begin
  if p_kind not in ('check_in', 'check_out') then
    raise exception 'Jenis absen tidak valid';
  end if;
  if p_selfie_path is null or p_selfie_path = '' then
    raise exception 'Foto selfie wajib diisi';
  end if;

  select * into v_employee
  from public.employees
  where profile_id = auth.uid() and is_active = true;
  if not found then
    raise exception 'Data karyawan tidak ditemukan';
  end if;
  if v_employee.branch_id is null then
    raise exception 'Cabang karyawan belum ditetapkan';
  end if;

  if p_kind = 'check_in' then
    insert into public.attendance_records (
      organization_id, branch_id, employee_id, attendance_date,
      check_in_at, check_in_selfie_path, check_in_lat, check_in_lng, note
    ) values (
      v_employee.organization_id, v_employee.branch_id, v_employee.profile_id, v_date,
      now(), p_selfie_path, p_lat, p_lng, left(coalesce(p_note, ''), 500)
    )
    on conflict (organization_id, employee_id, attendance_date) do nothing
    returning * into v_row;
    if not found then
      raise exception 'Sudah absen masuk hari ini';
    end if;
  else
    update public.attendance_records
       set check_out_at = now(),
           check_out_selfie_path = p_selfie_path,
           check_out_lat = p_lat,
           check_out_lng = p_lng,
           note = coalesce(nullif(left(coalesce(p_note, ''), 500), ''), note),
           updated_at = now()
     where organization_id = v_employee.organization_id
       and employee_id = v_employee.profile_id
       and attendance_date = v_date
       and check_out_at is null
    returning * into v_row;
    if not found then
      raise exception 'Belum absen masuk atau sudah absen pulang hari ini';
    end if;
  end if;

  return v_row;
end;
$$;

revoke all on function public.submit_attendance(text, text, double precision, double precision, text) from public, anon;
grant execute on function public.submit_attendance(text, text, double precision, double precision, text) to authenticated;
grant execute on function public.submit_attendance(text, text, double precision, double precision, text) to service_role;

-- View untuk rekap: menggabungkan nama karyawan, nama cabang, dan jam standar.
-- security_invoker = true supaya RLS tabel tetap dipakai.
create or replace view public.attendance_rekap
  with (security_invoker = true) as
select a.*, p.full_name, b.name as branch_name,
       b.check_in_time, b.check_out_time
from public.attendance_records a
join public.profiles p on p.id = a.employee_id
join public.branches b on b.id = a.branch_id;
grant select on public.attendance_rekap to authenticated;
revoke all on public.attendance_rekap from anon;
