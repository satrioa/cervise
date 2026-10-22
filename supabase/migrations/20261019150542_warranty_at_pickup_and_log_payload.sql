-- Garansi mulai saat diambil, dan log status tidak gagal saat tanpa catatan.
--
-- Dua bug di set_service_status, keduanya ketahuan saat menguji fungsi ini
-- terhadap data produksi:
--
-- 1. `payload` di cervise_service_logs adalah `jsonb not null default '{}'`,
--    tapi fungsinya menulis `null` kalau tidak ada catatan. Setiap perubahan
--    status tanpa catatan - yaitu cara UI memanggilnya, lihat
--    updateServisStatus di sparepart-actions.ts - gagal dengan 23502. Bug ini
--    sudah ada sejak 20260925340000 dan tidak pernah ketahuan karena semua
--    test mengirim catatan.
--
-- 2. Arah garansi sempat terbalik. Yang benar: garansi dihitung saat status
--    jadi 'Sudah Diambil', dan status lain mempertahankan nilai yang ada.
--    Versi terbalik menghitung garansi di setiap status selain 'Sudah Diambil'
--    lalu membekukannya saat diambil - artinya garansi mulai dari 'Selesai',
--    bukan dari pelanggan membawa pulang perangkatnya.
--
-- completed_at tetap ada, termasuk dua perbaikannya: 'Sudah Diambil' juga
-- mengisi (servis yang melewati 'Selesai' tetap terhitung selesai), dan 'Batal'
-- mengosongkan (pekerjaan batal tidak boleh dihitung untuk insentif).

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
      -- Garansi mulai SAAT DIAMBIL. Di status lain nilainya dipertahankan apa
      -- adanya - perbaikan yang butuh seminggu tidak boleh memotong garansi
      -- pelanggan seminggu.
      garansi_until = case
        when p_status <> 'Sudah Diambil' then v_service.garansi_until
        when v_service.garansi_value is null or v_service.garansi_value <= 0 then null
        else now() + case coalesce(v_service.garansi_unit, 'hari')
          when 'tahun' then make_interval(secs => v_service.garansi_value * 365 * 86400.0)
          when 'bulan' then make_interval(secs => v_service.garansi_value * 30 * 86400.0)
          else make_interval(secs => v_service.garansi_value * 86400.0)
        end
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
    coalesce(
      case when p_note is null or trim(p_note) = '' then null else jsonb_build_object('note', trim(p_note)) end,
      '{}'::jsonb
    )
  );

  return p_status;
end;
$function$;
