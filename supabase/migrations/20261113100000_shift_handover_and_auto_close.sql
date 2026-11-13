-- Serah terima shift + tutup otomatis per tenant.
--
-- Handover adalah EVENT, bukan kolom di sesi: satu sesi bisa diserahkan
-- berkali-kali sebelum akhirnya ditutup. Baris dengan `resumed_at is null`
-- adalah serah terima yang masih menunggu; index unik parsial memastikan
-- paling banyak satu per sesi.

alter table public.organizations
  add column if not exists auto_close_enabled boolean not null default true,
  add column if not exists auto_close_time time not null default '03:00';

create table if not exists public.cervise_cash_session_handovers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.cervise_cash_sessions(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  handed_over_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  resumed_by uuid references public.profiles(id),
  resumed_at timestamptz
);

-- Satu serah terima tertunda per sesi. Diserahkan dua kali tanpa dilanjutkan
-- akan ditolak database, bukan hanya oleh tombol di UI.
create unique index if not exists cervise_cash_session_handovers_pending_unique
  on public.cervise_cash_session_handovers(session_id)
  where resumed_at is null;

create index if not exists cervise_cash_session_handovers_session_idx
  on public.cervise_cash_session_handovers(session_id, created_at desc);

alter table public.cervise_cash_session_handovers enable row level security;

drop policy if exists cervise_cash_session_handovers_select on public.cervise_cash_session_handovers;
create policy cervise_cash_session_handovers_select on public.cervise_cash_session_handovers
  for select to authenticated
  using (
    public.is_platform_admin()
    or public.can_access_tenant_branch(
      branch_id,
      array['MASTER_ADMIN', 'ADMIN', 'FRONTLINER']::text[]
    )
  );

drop policy if exists cervise_cash_session_handovers_insert on public.cervise_cash_session_handovers;
create policy cervise_cash_session_handovers_insert on public.cervise_cash_session_handovers
  for insert to authenticated
  with check (
    public.is_platform_admin()
    or (
      handed_over_by = auth.uid()
      and public.can_access_tenant_branch(
        branch_id,
        array['MASTER_ADMIN', 'ADMIN', 'FRONTLINER']::text[]
      )
    )
  );

drop policy if exists cervise_cash_session_handovers_update on public.cervise_cash_session_handovers;
create policy cervise_cash_session_handovers_update on public.cervise_cash_session_handovers
  for update to authenticated
  using (
    public.is_platform_admin()
    or public.can_access_tenant_branch(
      branch_id,
      array['MASTER_ADMIN', 'ADMIN', 'FRONTLINER']::text[]
    )
  )
  with check (
    public.is_platform_admin()
    or public.can_access_tenant_branch(
      branch_id,
      array['MASTER_ADMIN', 'ADMIN', 'FRONTLINER']::text[]
    )
  );

grant select, insert, update on public.cervise_cash_session_handovers to authenticated;
grant select, insert, update, delete on public.cervise_cash_session_handovers to service_role;
revoke all on public.cervise_cash_session_handovers from anon;
