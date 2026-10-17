-- Waktu selesai servis, dipakai laporan performa teknisi dan insentif bulanan.
--
-- `updated_at` tidak bisa dipakai: `set_service_status` tidak menyentuhnya, jadi
-- kolom itu tidak pernah menandai kapan sebuah servis selesai. Log
-- `cervise_service_logs` sebenarnya merekam `status_change`, tapi tidak ada satu
-- pun baris untuk servis yang sudah selesai di database saat ini, jadi backfill
-- dari sana tidak menghasilkan apa-apa.

alter table public.cervise_services
  add column if not exists completed_at timestamptz;

create index if not exists cervise_services_completed_at_idx
  on public.cervise_services (branch_id, completed_at desc)
  where completed_at is not null;

create or replace function public.set_service_status(p_servis_id uuid, p_status text, p_note text default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_service public.cervise_services%rowtype;
  v_role text;
  v_allowed text[] := array['Masuk','Diagnosa','Menunggu Konfirmasi','Menunggu Sparepart','Dikerjakan','Selesai','Sudah Diambil','Batal'];
  v_parts integer;
begin
  if p_servis_id is null then
    raise exception 'servis wajib';
  end if;
  if p_status is null or not (p_status = any(v_allowed)) then
    raise exception 'status tidak dikenal';
  end if;

  select * into v_service
  from public.cervise_services
  where id = p_servis_id
  for update;

  if not found then
    raise exception 'servis tidak ditemukan';
  end if;

  v_role := public.caller_branch_role(v_service.branch_id);
  if not (public.is_platform_admin() or v_role in ('MASTER_ADMIN','ADMIN','FRONTLINER','TECHNICIAN')) then
    raise exception 'role tidak diizinkan mengubah status';
  end if;

  if v_service.status = p_status then
    return v_service.status;
  end if;

  if p_status = 'Batal' then
    select count(*) into v_parts
    from public.cervise_service_spareparts
    where servis_id = v_service.id and not is_returned;
    if v_parts > 0 then
      raise exception 'servis masih punya sparepart terpakai, putuskan dulu kembalikan ke stok atau tetap dipakai';
    end if;
  end if;

  -- completed_at diisi sekali saja, saat pertama kali masuk 'Selesai'. Status
  -- berikutnya ke 'Sudah Diambil' tidak menimpanya: tanggal selesai harus tetap
  -- menunjuk bulan saat servis itu selesai, bukan bulan diambil.
  update public.cervise_services
     set status = p_status,
         completed_at = case
           when p_status = 'Selesai' and completed_at is null then now()
           else completed_at
         end
   where id = v_service.id;

  insert into public.cervise_service_logs (branch_id, servis_id, actor_id, action, from_value, to_value, payload)
  values (
    v_service.branch_id, v_service.id, auth.uid(), 'status_change', v_service.status, p_status,
    case when p_note is null or trim(p_note) = '' then null else jsonb_build_object('note', trim(p_note)) end
  );

  return p_status;
end;
$$;

revoke all on function public.set_service_status(uuid, text, text) from public;
grant execute on function public.set_service_status(uuid, text, text) to authenticated;

-- Batasi mode insentif: kolomnya text tanpa CHECK, sehingga 'flat' atau salah
-- ketik lain bisa tersimpan tanpa ada yang menyadarinya. Baris lama yang
-- nilainya di luar daftar ini dibiarkan apa adanya supaya migrasi ini tidak
-- gagal; `readMode` di kode akan memperlakukannya sebagai 'percent'.
alter table public.branches
  drop constraint if exists branches_intensif_mode_check;

alter table public.branches
  add constraint branches_intensif_mode_check
  check (intensif_mode in ('percent', 'fixed', 'flat'));
