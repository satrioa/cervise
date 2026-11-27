-- Klaim garansi: catatan audit (alasan, siapa, kapan) + servis turunan.
-- Status klaim sengaja TIDAK disimpan: ia mengikuti status servis klaim lewat
-- new_service_id, supaya tidak perlu sinkronisasi dengan set_service_status.

alter table public.cervise_services
  add column if not exists parent_service_id uuid references public.cervise_services(id) on delete set null;

create index if not exists cervise_services_parent_idx
  on public.cervise_services(parent_service_id)
  where parent_service_id is not null;

create table if not exists public.garansi_claims (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  original_service_id uuid not null references public.cervise_services(id) on delete cascade,
  new_service_id uuid references public.cervise_services(id) on delete set null,
  customer_id uuid references public.cervise_customers(id) on delete set null,
  reason text not null,
  note text,
  claimed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists garansi_claims_branch_idx on public.garansi_claims(branch_id, created_at desc);
create index if not exists garansi_claims_original_idx on public.garansi_claims(original_service_id);

alter table public.garansi_claims enable row level security;

revoke all on public.garansi_claims from anon, public;
grant select, insert, update on public.garansi_claims to authenticated;

drop policy if exists garansi_claims_select on public.garansi_claims;
create policy garansi_claims_select on public.garansi_claims for select to authenticated
  using (public.is_platform_admin() or public.can_access_tenant_branch(branch_id));

drop policy if exists garansi_claims_insert on public.garansi_claims;
create policy garansi_claims_insert on public.garansi_claims for insert to authenticated
  with check (public.is_platform_admin() or public.can_access_tenant_branch(branch_id, array['MASTER_ADMIN','ADMIN','FRONTLINER']::text[]));

drop policy if exists garansi_claims_update on public.garansi_claims;
create policy garansi_claims_update on public.garansi_claims for update to authenticated
  using (public.is_platform_admin() or public.can_access_tenant_branch(branch_id))
  with check (public.is_platform_admin() or public.can_access_tenant_branch(branch_id, array['MASTER_ADMIN','ADMIN','FRONTLINER']::text[]));
