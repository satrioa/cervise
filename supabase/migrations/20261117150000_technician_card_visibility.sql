-- Target dan visibilitas kartu Target/Intensif Saya di dashboard teknisi.
-- Default mengikuti perilaku lama: target jumlah servis, dua kartu tampil.

alter table public.branches
  add column if not exists target_type text not null default 'jumlah_servis',
  add column if not exists target_value integer,
  add column if not exists show_target_to_teknisi boolean not null default true,
  add column if not exists show_intensif_to_teknisi boolean not null default true;

alter table public.branches
  drop constraint if exists branches_target_type_check;
alter table public.branches
  add constraint branches_target_type_check
  check (target_type in ('penghasilan', 'jumlah_servis'));
