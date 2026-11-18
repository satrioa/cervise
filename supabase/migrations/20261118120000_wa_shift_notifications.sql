-- Notifikasi buka/tutup shift WA. Outbox yang sama dipakai supaya retry,
-- dedupe, dan audit tetap satu jalur dengan notifikasi servis.

alter table public.cervise_notification_outbox
  add column if not exists payload jsonb;

alter table public.cervise_notification_outbox
  drop constraint if exists cervise_notification_outbox_event_check;
alter table public.cervise_notification_outbox
  add constraint cervise_notification_outbox_event_check
  check (event in ('servis_created', 'servis_status', 'shift_opened', 'shift_closed'));

alter table public.cervise_notification_outbox
  drop constraint if exists cervise_notification_outbox_to_kind_check;
alter table public.cervise_notification_outbox
  add constraint cervise_notification_outbox_to_kind_check
  check (to_kind in ('customer', 'technician', 'owner'));

create index if not exists cervise_notification_outbox_owner_shift_idx
  on public.cervise_notification_outbox (branch_id, event)
  where event in ('shift_opened', 'shift_closed');
