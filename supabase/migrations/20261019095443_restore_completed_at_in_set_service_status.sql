-- Pulihkan completed_at yang hilang dari set_service_status.
--
-- 20260925340000_service_completed_at.sql menambah kolom completed_at dan
-- mengisi now() saat status pertama kali Selesai. Nilainya dibaca oleh
-- Laporan Performa Teknisi dan insentif bulanan.
--
-- 20261018112050_tag_counter_garansi_pickup menimpa set_service_status dengan
-- create or replace untuk menambahkan garansi dihitung dari waktu pengambilan.
-- create or replace mengganti SELURUH badan fungsi, bukan menambah - jadi
-- completed_at ikut hilang. Akibatnya kolom tidak pernah terisi lagi, dan
-- performa teknisi beserta insentifnya menghitung nol.
--
-- Dua bug yang sudah dilaporkan ikut diperbaiki di baris yang sama:
--
--   - Hanya 'Selesai' yang dulu mengisi completed_at. Servis yang dilompati
--     ke 'Sudah Diambil' tanpa pernah lewat 'Selesai' tidak pernah terhitung
--     sebagai pekerjaan selesai.
--   - Status 'Batal' dulu membiarkan completed_at apa adanya, jadi pekerjaan
--     yang dibatalkan masih terhitung selesai untuk performa dan insentif.
--
-- Logika garansi_until dari migration sebelumnya dipertahankan apa adanya.

create or replace function public.set_service_status(
  p_servis_id uuid,
  p_status text,
  p_note text default null
)
returns text
language plpgsql
security definer
set search_path = 'public'
as $function$
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

  update public.cervise_services
  set status = p_status,
      -- Garansi dihitung dari waktu pengambilan, bukan dari saat servis masuk.
      -- make_interval dipakai supaya perkalian integer tidak meluap.
      garansi_until = case
        when p_status = 'Sudah Diambil' then v_service.garansi_until
        when v_service.garansi_value is null or v_service.garansi_value <= 0 then null
        when v_service.garansi_unit = 'tahun' then now() + make_interval(secs => v_service.garansi_value * 365 * 86400.0)
        when v_service.garansi_unit = 'bulan' then now() + make_interval(secs => v_service.garansi_value * 30 * 86400.0)
        else now() + make_interval(secs => v_service.garansi_value * 86400.0)
      end,
      completed_at = case
        when p_status = 'Batal' then null
        when p_status in ('Selesai', 'Sudah Diambil') and v_service.completed_at is null then now()
        else v_service.completed_at
      end
  where id = v_service.id;

  insert into public.cervise_service_logs (branch_id, servis_id, actor_id, action, from_value, to_value, payload)
  values (
    v_service.branch_id, v_service.id, auth.uid(), 'status_change', v_service.status, p_status,
    case when p_note is null or trim(p_note) = '' then null else jsonb_build_object('note', trim(p_note)) end
  );

  return p_status;
end;
$function$;