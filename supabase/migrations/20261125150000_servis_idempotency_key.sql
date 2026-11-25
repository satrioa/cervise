-- Kunci idempotensi supaya pengiriman ulang aksi createServis tidak membuat
-- tiket kedua. Kolom nullable: tiket lama dan pemanggil tanpa kunci tetap
-- berperilaku seperti sebelumnya.
alter table public.cervise_services
  add column if not exists idempotency_key text;

create unique index if not exists cervise_services_branch_idempotency_key_idx
  on public.cervise_services(branch_id, idempotency_key)
  where idempotency_key is not null;
