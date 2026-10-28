-- Hapus satu baris sparepart dari servis tanpa menghapus riwayatnya.
--
-- Stok sudah dipotong saat `consume_service_spareparts`, jadi klien tidak
-- boleh DELETE langsung: baris ditandai `is_returned` dan stok dikembalikan
-- dalam transaksi yang sama. Berlaku untuk satu baris saja; pembatalan
-- seluruh servis tetap memakai `return_service_spareparts`.

create or replace function public.return_service_sparepart(p_sparepart_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.cervise_service_spareparts%rowtype;
  v_service public.cervise_services%rowtype;
  v_role text;
begin
  if p_sparepart_id is null then
    raise exception 'sparepart wajib';
  end if;
  if p_reason is null or length(trim(p_reason)) < 3 then
    raise exception 'alasan wajib diisi minimal 3 karakter';
  end if;

  select * into v_row
  from public.cervise_service_spareparts
  where id = p_sparepart_id
  for update;

  if not found then
    raise exception 'sparepart tidak ditemukan';
  end if;
  if v_row.is_returned then
    raise exception 'sparepart sudah dikembalikan';
  end if;

  select * into v_service
  from public.cervise_services
  where id = v_row.servis_id
  for update;

  if not found then
    raise exception 'servis tidak ditemukan';
  end if;
  if v_service.status in ('Batal', 'Sudah Diambil') then
    raise exception 'sparepart tidak bisa dihapus saat servis %', v_service.status;
  end if;

  v_role := public.caller_branch_role(v_service.branch_id);
  if not (public.is_platform_admin() or v_role in ('MASTER_ADMIN', 'ADMIN', 'FRONTLINER')) then
    raise exception 'role tidak diizinkan menghapus sparepart';
  end if;

  perform public.apply_stock_delta(
    v_row.product_id, v_row.qty, null, 'service_return', v_service.id, null
  );

  update public.cervise_service_spareparts
  set is_returned = true, returned_at = now()
  where id = v_row.id;

  insert into public.cervise_service_logs (branch_id, servis_id, actor_id, action, to_value, payload)
  values (
    v_service.branch_id, v_service.id, auth.uid(), 'sparepart_return', v_row.name,
    jsonb_build_object('sparepart_id', v_row.id, 'product_id', v_row.product_id, 'qty', v_row.qty, 'reason', trim(p_reason))
  );
end;
$$;

revoke all on function public.return_service_sparepart(uuid, text) from public;
revoke all on function public.return_service_sparepart(uuid, text) from anon;
grant execute on function public.return_service_sparepart(uuid, text) to authenticated;
