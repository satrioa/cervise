-- Mention customer dan servis di To-Do teknisi.
--
-- Catatan teknisi sering menyebut "telp Cek HP Budi" atau "SRV-0142 waiting
-- part". Kalau hanya teks, begitu customer di-rename catatan jadi salah, dan
-- tidak ada jalan membuka servis yang dimaksud dari catatannya.
--
-- Karena itu mention disimpan sebagai referensi: customer_id / servis_id.
-- Label yang tampil dibaca ulang dari tabel tujuan saat catatan dimuat, jadi
-- rename di customer atau servis ikut tercermin di catatan.
--
-- Satu catatan boleh punya banyak mention, jadi tabel terpisah -- bukan kolom
-- di cervise_staff_todos. Tabel terpisah juga yang membuat menghapus catatan
-- ikut membersihkan mention-nya lewat cascade.

create table if not exists public.cervise_todo_mentions (
  id uuid primary key default gen_random_uuid(),
  todo_id uuid not null references public.cervise_staff_todos(id) on delete cascade,
  customer_id uuid references public.cervise_customers(id) on delete set null,
  servis_id uuid references public.cervise_services(id) on delete set null,
  created_at timestamptz not null default now(),
  -- Minimal salah satu harus terisi. Tanpa ini baris kosong bisa masuk dan
  -- tidak punya tujuan yang bisa dibuka.
  constraint cervise_todo_mentions_target_check
    check (customer_id is not null or servis_id is not null)
);

create index if not exists cervise_todo_mentions_todo_idx
  on public.cervise_todo_mentions(todo_id, created_at);

-- Mention customer yang sama dalam satu catatan tidak perlu diulang.
create unique index if not exists cervise_todo_mentions_unique_customer
  on public.cervise_todo_mentions(todo_id, customer_id)
  where customer_id is not null;

create unique index if not exists cervise_todo_mentions_unique_servis
  on public.cervise_todo_mentions(todo_id, servis_id)
  where servis_id is not null;

alter table public.cervise_todo_mentions enable row level security;

-- Kepemilikan mengikuti To-Do induknya, bukan employee_id terpisah.
--
-- `exists` ke `cervise_staff_todos` dengan `employee_id = auth.uid()` adalah
-- yang menjaga integritas: tanpa itu, teknisi bisa membuat mention untuk
-- catatan rekan satu cabang, karena policy select tabel mentions sendiri
-- akan mengizinkannya begitu todo_id-nya valid.
create or replace function public.owns_staff_todo(target_todo_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.cervise_staff_todos t
    where t.id = target_todo_id and t.employee_id = auth.uid()
  );
$$;

revoke all on function public.owns_staff_todo(uuid) from public;
grant execute on function public.owns_staff_todo(uuid) to authenticated;

drop policy if exists cervise_todo_mentions_select on public.cervise_todo_mentions;
create policy cervise_todo_mentions_select on public.cervise_todo_mentions
  for select to authenticated
  using (
    public.is_platform_admin()
    or public.owns_staff_todo(todo_id)
  );

drop policy if exists cervise_todo_mentions_insert on public.cervise_todo_mentions;
create policy cervise_todo_mentions_insert on public.cervise_todo_mentions
  for insert to authenticated
  with check (
    public.is_platform_admin()
    or public.owns_staff_todo(todo_id)
  );

-- Update tidak dipakai: mention dihapus dan ditambah ulang kalau targetnya
-- salah. Policy-nya tetap ada supaya baris tidak bisa diubah ke todo lain.
drop policy if exists cervise_todo_mentions_update on public.cervise_todo_mentions;
create policy cervise_todo_mentions_update on public.cervise_todo_mentions
  for update to authenticated
  using (
    public.is_platform_admin()
    or public.owns_staff_todo(todo_id)
  )
  with check (
    public.is_platform_admin()
    or public.owns_staff_todo(todo_id)
  );

drop policy if exists cervise_todo_mentions_delete on public.cervise_todo_mentions;
create policy cervise_todo_mentions_delete on public.cervise_todo_mentions
  for delete to authenticated
  using (
    public.is_platform_admin()
    or public.owns_staff_todo(todo_id)
  );

grant select, insert, update, delete on public.cervise_todo_mentions to authenticated;
grant select, insert, update, delete on public.cervise_todo_mentions to service_role;
revoke all on public.cervise_todo_mentions from anon;
