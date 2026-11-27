-- Satu transaksi untuk seluruh daftar distribusi.
create or replace function public.distribute_central_items_batch(
  p_target_branch_id uuid, p_items jsonb
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_item jsonb;
  v_central_item_id uuid;
  v_qty integer;
  v_expected integer;
  v_sku text;
  v_is_serialized boolean;
  v_lines integer := 0;
  v_total integer := 0;
begin
  if not (
    public.is_platform_admin()
    or exists (
      select 1 from public.branches b
      where b.id = p_target_branch_id
        and public.has_tenant_role(b.organization_id, array['MASTER_ADMIN'::text])
    )
  ) then
    raise exception 'hanya master admin yang boleh mendistribusikan stok';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'pilih minimal satu item';
  end if;
  if jsonb_array_length(p_items) = 0 then
    raise exception 'pilih minimal satu item';
  end if;
  if not exists (select 1 from public.branches where id = p_target_branch_id) then
    raise exception 'cabang tujuan tidak ditemukan';
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    begin
      v_central_item_id := (v_item ->> 'central_item_id')::uuid;
      v_qty := (v_item ->> 'qty')::integer;
      v_expected := (v_item ->> 'expected_stock')::integer;
    exception when others then
      raise exception 'baris distribusi tidak valid: %', sqlerrm;
    end;
    if v_central_item_id is null or v_qty is null or v_qty <= 0 then
      raise exception 'baris distribusi tidak valid';
    end if;
    select sku, is_serialized into v_sku, v_is_serialized from public.cervise_central_items where id = v_central_item_id;
    if v_sku is null then raise exception 'item pusat tidak ditemukan'; end if;
    if v_is_serialized then raise exception '%: batch tidak mendukung item serialized', v_sku; end if;
    if v_qty > 1000 then raise exception '%: jumlah melebihi batas', v_sku; end if;
    if v_expected is null then raise exception '%: expected_stock wajib', v_sku; end if;
    begin
      perform public.distribute_central_stock(v_central_item_id, p_target_branch_id, v_qty, v_expected, null);
    exception when others then
      raise exception '%: %', v_sku, sqlerrm;
    end;
    v_lines := v_lines + 1;
    v_total := v_total + v_qty;
  end loop;

  return jsonb_build_object('lines', v_lines, 'total_qty', v_total);
end;
$$;
revoke all on function public.distribute_central_items_batch(uuid, jsonb) from public, anon;
grant execute on function public.distribute_central_items_batch(uuid, jsonb) to authenticated;
