-- Notifikasi in-app per role.
--
-- Baris notifikasi ditulis helper `notifyRoles` dari server action setelah
-- mutasi berhasil. Role disimpan sebagai audience, bukan fan-out per user,
-- supaya satu event cukup satu baris. Status baca disimpan terpisah per user.

create table if not exists public.cervise_app_notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  branch_id uuid,
  branch_label text,
  event text not null,
  audience_roles text[] not null,
  title text not null,
  body text not null,
  href text,
  created_at timestamptz not null default now()
);

create index if not exists cervise_app_notifications_org_created_idx
  on public.cervise_app_notifications (organization_id, created_at desc);
create index if not exists cervise_app_notifications_org_branch_idx
  on public.cervise_app_notifications (organization_id, branch_id);

create table if not exists public.cervise_app_notification_reads (
  notification_id uuid not null
    references public.cervise_app_notifications(id) on delete cascade,
  user_id uuid not null,
  read_at timestamptz not null default now(),
  primary key (notification_id, user_id)
);

alter table public.cervise_app_notifications enable row level security;
alter table public.cervise_app_notification_reads enable row level security;

drop policy if exists app_notifications_select on public.cervise_app_notifications;
create policy app_notifications_select on public.cervise_app_notifications
  for select to authenticated
  using (public.has_tenant_role(organization_id, array['MASTER_ADMIN','ADMIN','FRONTLINER','TECHNICIAN']::text[]));

drop policy if exists app_notifications_insert on public.cervise_app_notifications;
create policy app_notifications_insert on public.cervise_app_notifications
  for insert to authenticated
  with check (public.has_tenant_role(organization_id, array['MASTER_ADMIN','ADMIN','FRONTLINER','TECHNICIAN']::text[]));

drop policy if exists app_notification_reads_select on public.cervise_app_notification_reads;
create policy app_notification_reads_select on public.cervise_app_notification_reads
  for select to authenticated using (user_id = auth.uid());

drop policy if exists app_notification_reads_insert on public.cervise_app_notification_reads;
create policy app_notification_reads_insert on public.cervise_app_notification_reads
  for insert to authenticated with check (user_id = auth.uid());
