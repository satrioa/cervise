-- To-Do personal teknisi.
--
-- Spec: docs/superpowers/specs/2026-09-28-compact-shell-technician-dashboard-design.md
--
-- Satu tabel, tanpa organization_id. employee_id menunjuk ke profiles(id) dan
-- profiles tidak punya kolom tenant, jadi cakupan tenant ditegakkan lewat
-- branch_id + can_access_tenant_branch(). Menambah organization_id hanya
-- menjadi denormalisasi tanpa sumber kebenaran yang bisa di-update.
--
-- Yang menentukan: employee_id = auth.uid() ada di policy SELECT *dan* WRITE.
-- itu yang membuat "data disimpan tiap akun teknisi" benar di level database,
-- bukan hanya di level UI — teknisi lain di cabang yang sama tidak melihat
-- To-Do rekannya.

create table if not exists public.cervise_staff_todos (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  due_at timestamptz,
  done_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists cervise_staff_todos_owner_idx
  on public.cervise_staff_todos(employee_id, done_at, due_at);

create index if not exists cervise_staff_todos_branch_idx
  on public.cervise_staff_todos(branch_id, done_at);

alter table public.cervise_staff_todos enable row level security;

-- Platform admin boleh Maintenance. Semua orang lain hanya barisnya sendiri.
-- Template yang sama dipakai untuk keempat policy supaya tidak ada celah di
-- policy yang lupa ditambahkan.
drop policy if exists cervise_staff_todos_select on public.cervise_staff_todos;
create policy cervise_staff_todos_select on public.cervise_staff_todos
  for select to authenticated
  using (
    public.is_platform_admin()
    or (employee_id = auth.uid() and public.can_access_tenant_branch(branch_id))
  );

drop policy if exists cervise_staff_todos_insert on public.cervise_staff_todos;
create policy cervise_staff_todos_insert on public.cervise_staff_todos
  for insert to authenticated
  with check (
    public.is_platform_admin()
    or (employee_id = auth.uid() and public.can_access_tenant_branch(branch_id))
  );

drop policy if exists cervise_staff_todos_update on public.cervise_staff_todos;
create policy cervise_staff_todos_update on public.cervise_staff_todos
  for update to authenticated
  using (
    public.is_platform_admin()
    or (employee_id = auth.uid() and public.can_access_tenant_branch(branch_id))
  )
  with check (
    public.is_platform_admin()
    or (employee_id = auth.uid() and public.can_access_tenant_branch(branch_id))
  );

drop policy if exists cervise_staff_todos_delete on public.cervise_staff_todos;
create policy cervise_staff_todos_delete on public.cervise_staff_todos
  for delete to authenticated
  using (
    public.is_platform_admin()
    or (employee_id = auth.uid() and public.can_access_tenant_branch(branch_id))
  );

grant select, insert, update, delete on public.cervise_staff_todos to authenticated;
grant select, insert, update, delete on public.cervise_staff_todos to service_role;
revoke all on public.cervise_staff_todos from anon;
