-- Posting opname boleh dilakukan oleh semua peran yang punya akses inventori.
-- Pemeriksaan ini mengikuti OPNAME_POSTER_ROLES di aplikasi.
create or replace function public.post_stock_opname(p_session_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.cervise_stock_opname_sessions%rowtype;
  v_line record;
  v_delta integer;
  v_count integer := 0;
begin
  select * into v_session
  from public.cervise_stock_opname_sessions
  where id = p_session_id
  for update;

  if not found then
    raise exception 'Sesi tidak ditemukan';
  end if;
  if not public.has_tenant_branch_role(
    v_session.organization_id,
    v_session.branch_id,
    array['MASTER_ADMIN'::text, 'ADMIN'::text, 'TECHNICIAN'::text, 'FRONTLINER'::text]
  ) then
    raise exception 'Role ini tidak boleh memposting opname';
  end if;
  if v_session.status <> 'DRAFT' then
    raise exception 'Sesi sudah diposting/dibatalkan';
  end if;

  for v_line in
    select * from public.cervise_stock_opname_lines where session_id = p_session_id
  loop
    v_delta := v_line.counted_qty - v_line.snapshot_qty;
    if v_delta <> 0 then
      if v_session.domain = 'product' then
        perform public.apply_stock_delta(
          v_line.ref_id, v_delta, v_line.snapshot_qty, 'stock_adjust',
          null, null, 'opname:' || p_session_id || ':' || v_line.id
        );
      else
        perform public.apply_sparepart_stock_delta(
          v_line.ref_id, v_delta, v_line.snapshot_qty, 'stock_adjust',
          null, 'opname:' || p_session_id || ':' || v_line.id
        );
      end if;
      v_count := v_count + 1;
    end if;
  end loop;

  update public.cervise_stock_opname_sessions
  set status = 'POSTED', posted_at = now(), posted_by = auth.uid()
  where id = p_session_id;

  return v_count;
end;
$$;

revoke all on function public.post_stock_opname(uuid) from public;
revoke all on function public.post_stock_opname(uuid) from anon;
grant execute on function public.post_stock_opname(uuid) to authenticated;
