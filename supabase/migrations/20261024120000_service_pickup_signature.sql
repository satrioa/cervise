-- Tanda tangan customer saat pengambilan device (pickup).
--
-- Signature dibuat di browser via kokonut signature-pad -> SVG string,
-- disimpan sebagai text (kolom besar memanggil untuk SVG). Setelah tanda
-- tangan valid, status servis dipindah ke 'Sudah Diambil' lewat wrapper
-- set_service_picked_up yang memanggil set_service_status (jadi garansi,
-- completed_at, dan log timeline tetap satu sumber di fungsi lama).
--
-- picked_up_at mengisi saat pemanggilan RPC: 'Sudah Diambil' yang pertama
-- mengisi, status lain mempertahankan nilai yang ada.

alter table public.cervise_services
  add column if not exists pickup_signature text,
  add column if not exists picked_up_at timestamptz;

create or replace function public.set_service_picked_up(
  p_servis_id uuid,
  p_signature text,
  p_note text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_service public.cervise_services%rowtype;
  v_role text;
begin
  if p_servis_id is null then
    raise exception 'servis wajib';
  end if;
  if p_signature is null or trim(p_signature) = '' then
    raise exception 'tanda tangan wajib';
  end if;
  if left(trim(p_signature), 5) <> '<svg ' then
    raise exception 'tanda tangan tidak valid';
  end if;
  if length(p_signature) > 200000 then
    raise exception 'tanda tangan terlalu besar';
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

  perform public.set_service_status(p_servis_id, 'Sudah Diambil', p_note);

  update public.cervise_services
  set pickup_signature = trim(p_signature),
      picked_up_at = coalesce(v_service.picked_up_at, now())
  where id = v_service.id;

  return 'Sudah Diambil';
end;
$$;

revoke all on function public.set_service_picked_up(uuid, text, text) from public;
grant execute on function public.set_service_picked_up(uuid, text, text) to authenticated;
revoke all on function public.set_service_picked_up(uuid, text, text) from anon;
