-- PIN absen kiosk: hash bcrypt + rate limit + RPC tulis berbasis employee_id terverifikasi.
alter table public.employees
  add column if not exists pin_hash text,
  add column if not exists pin_updated_at timestamptz;

create table if not exists public.attendance_pin_attempts (
  email_key text primary key,
  failures integer not null default 0,
  locked_until timestamptz
);

revoke all on public.attendance_pin_attempts from anon, authenticated;
grant select, insert, update, delete on public.attendance_pin_attempts to service_role;

create or replace function public.set_employee_pin(
  p_employee_id uuid,
  p_pin text
) returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if p_pin is null or p_pin !~ '^[0-9]{6}$' then
    raise exception 'PIN harus 6 digit angka';
  end if;
  update public.employees
     set pin_hash = crypt(p_pin, gen_salt('bf')),
         pin_updated_at = now()
   where id = p_employee_id;
  if not found then
    raise exception 'Karyawan tidak ditemukan';
  end if;
end;
$$;

create or replace function public.verify_employee_pin(
  p_email text,
  p_pin text
) returns table (
  employee_id uuid,
  organization_id uuid,
  branch_id uuid,
  full_name text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_key text := lower(trim(coalesce(p_email, '')));
  v_attempt public.attendance_pin_attempts%rowtype;
  v_next_failures integer;
begin
  select * into v_attempt from public.attendance_pin_attempts where email_key = v_key;

  if found and v_attempt.locked_until is not null and v_attempt.locked_until > now() then
    raise exception 'Terlalu banyak percobaan. Coba lagi dalam 15 menit.';
  end if;

  if v_key <> '' and p_pin is not null and exists (
    select 1
    from public.employees e
    join public.profiles p on p.id = e.profile_id
    where lower(trim(p.email)) = v_key
      and e.is_active = true
      and p.is_active = true
      and e.pin_hash is not null
      and crypt(p_pin, e.pin_hash) = e.pin_hash
  ) then
    update public.attendance_pin_attempts
       set failures = 0, locked_until = null
     where email_key = v_key;
    return query
      select e.id, e.organization_id, e.branch_id, p.full_name
      from public.employees e
      join public.profiles p on p.id = e.profile_id
      where lower(trim(p.email)) = v_key
        and e.is_active = true
        and p.is_active = true
        and e.pin_hash is not null
        and crypt(p_pin, e.pin_hash) = e.pin_hash
      limit 1;
    return;
  end if;

  v_next_failures := coalesce(v_attempt.failures, 0) + 1;
  insert into public.attendance_pin_attempts (email_key, failures, locked_until)
  values (v_key, v_next_failures, case when v_next_failures >= 5 then now() + interval '15 minutes' else null end)
  on conflict (email_key) do update
     set failures = case when public.attendance_pin_attempts.locked_until > now()
                         then public.attendance_pin_attempts.failures
                         else v_next_failures end,
         locked_until = case when v_next_failures >= 5
                             then now() + interval '15 minutes' else null end;
  raise exception 'Email atau PIN salah';
end;
$$;

create or replace function public.submit_attendance_pin(
  p_employee_id uuid,
  p_kind text,
  p_selfie_path text,
  p_lat double precision,
  p_lng double precision,
  p_note text
) returns public.attendance_records
language plpgsql
security definer
set search_path = public, extensions
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
  where id = p_employee_id and is_active = true;
  if not found then
    raise exception 'Karyawan tidak ditemukan';
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

-- Semua RPC dipanggil dari server action memakai service_role.
revoke all on function public.set_employee_pin(uuid, text) from public, anon, authenticated;
revoke all on function public.verify_employee_pin(text, text) from public, anon, authenticated;
revoke all on function public.submit_attendance_pin(uuid, text, text, double precision, double precision, text) from public, anon, authenticated;
grant execute on function public.set_employee_pin(uuid, text) to service_role;
grant execute on function public.verify_employee_pin(text, text) to service_role;
grant execute on function public.submit_attendance_pin(uuid, text, text, double precision, double precision, text) to service_role;
