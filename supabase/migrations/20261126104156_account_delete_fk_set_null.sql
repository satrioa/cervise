-- Hard delete akun (auth.users) dibekuk FK NO ACTION berikut. Referensi yang
-- boleh hilang di-set NULL agar riwayat bisnis tetap tersimpan. Dua FK yang
-- kolomnya NOT NULL (cervise_cash_sessions.employee_id dan
-- cervise_cash_session_handovers.handed_over_by) sengaja dibiarkan memblokir;
-- deleteOwnerAccount menolaknya lebih awal dengan pesan yang jelas.

alter table public.branches
  drop constraint if exists branches_owner_id_fkey,
  add constraint branches_owner_id_fkey
    foreign key (owner_id) references auth.users(id) on delete set null;

alter table public.services
  drop constraint if exists services_teknisi_id_fkey,
  add constraint services_teknisi_id_fkey
    foreign key (teknisi_id) references public.profiles(id) on delete set null;

alter table public.finance_tx
  drop constraint if exists finance_tx_created_by_fkey,
  add constraint finance_tx_created_by_fkey
    foreign key (created_by) references public.profiles(id) on delete set null;

alter table public.cervise_cash_session_handovers
  drop constraint if exists cervise_cash_session_handovers_resumed_by_fkey,
  add constraint cervise_cash_session_handovers_resumed_by_fkey
    foreign key (resumed_by) references public.profiles(id) on delete set null;
