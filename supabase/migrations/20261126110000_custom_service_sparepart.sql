-- Sparepart custom: barang yang dipakai saat servis tetapi tidak ada di stok
-- (misal belanja luar). Tidak masuk inventory, tidak bisa dikembalikan, dan
-- harganya dicatat sebagai pengeluaran di finance_tx.

alter table public.cervise_service_spareparts
  add column if not exists is_custom boolean not null default false;

-- Konsumsi sparepart custom. qty selalu 1:barang dibeli untuk 1 servis, bukan
-- stok yang diambil berulang.
create or replace function public.consume_custom_service_sparepart(
  p_servis_id uuid,
  p_name text,
  p_cost integer,
  p_set_status boolean default false
)
returns public.cervise_service_spareparts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_service public.cervise_services%rowtype;
  v_role text;
  v_name text := btrim(coalesce(p_name, ''));
  v_cost integer := coalesce(p_cost, 0);
  v_row public.cervise_service_spareparts%rowtype;
begin
  if p_servis_id is null then
    raise exception 'servis wajib';
  end if;
  if v_name = '' then
    raise exception 'Nama sparepart wajib';
  end if;
  if v_cost <= 0 then
    raise exception 'Harga modal harus lebih dari 0';
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
    raise exception 'role tidak diizinkan memakai sparepart';
  end if;
  if v_role = 'TECHNICIAN' and v_service.status <> 'Dikerjakan' then
    raise exception 'teknisi hanya bisa memakai sparepart saat status Dikerjakan';
  end if;
  if v_service.status in ('Batal', 'Sudah Diambil') then
    raise exception 'servis sudah selesai, tidak bisa menambah sparepart';
  end if;

  insert into public.cervise_service_spareparts (
    branch_id, servis_id, sparepart_id, sku, name, category,
    qty, unit_price, cost, line_total, created_by, is_custom
  ) values (
    v_service.branch_id, v_service.id, null, 'CUSTOM', v_name, 'Custom',
    1, v_cost, v_cost, v_cost, auth.uid(), true
  )
  returning * into v_row;

  -- Barang tidak pernah masuk inventory, jadi tidak ada stock_movement.
  -- Uang yang keluar untuk membeli barang ini tetap tercatat di finansial.
  insert into public.finance_tx (
    branch_id, servis_id, type, amount, kas_date, metode,
    keterangan, description, created_by, source
  ) values (
    v_service.branch_id, v_service.id, 'pengeluaran', v_cost,
    (now() at time zone 'Asia/Jakarta')::date, 'Tunai',
    v_name,
    'Sparepart custom ' || v_name || ' · ' || coalesce(v_service.service_number, v_service.id::text),
    auth.uid(), 'transaksi'
  );

  insert into public.cervise_service_logs (branch_id, servis_id, actor_id, action, to_value, payload)
  values (
    v_service.branch_id, v_service.id, auth.uid(), 'add_sparepart', v_name,
    jsonb_build_object('custom', true, 'cost', v_cost, 'line_total', v_cost)
  );

  if p_set_status and v_service.status = 'Menunggu Konfirmasi' then
    update public.cervise_services set status = 'Dikerjakan' where id = v_service.id;
    insert into public.cervise_service_logs (branch_id, servis_id, actor_id, action, from_value, to_value)
    values (v_service.branch_id, v_service.id, auth.uid(), 'status_change', v_service.status, 'Dikerjakan');
  end if;

  return v_row;
end;
$$;

-- Sparepart custom tidak punya stok untuk dikembalikan. Tandai selesai tanpa
-- menyentuh ledger stok maupun baris inventory.
create or replace function public.return_service_spareparts(p_servis_id uuid, p_reason text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_service public.cervise_services%rowtype;
  v_role text;
  v_row public.cervise_service_spareparts%rowtype;
  v_count integer := 0;
begin
  if p_servis_id is null then
    raise exception 'servis wajib';
  end if;
  if p_reason is null or length(trim(p_reason)) < 3 then
    raise exception 'alasan wajib diisi minimal 3 karakter';
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
    raise exception 'role tidak diizinkan membatalkan servis';
  end if;

  for v_row in
    select * from public.cervise_service_spareparts
    where servis_id = v_service.id and not is_returned
    order by created_at
    for update
  loop
    if v_row.is_custom then
      null; -- tidak ada stok yang dikembalikan; finansial sudah tercatat
    elsif v_row.sparepart_id is not null then
      perform public.apply_sparepart_stock_delta(
        v_row.sparepart_id, v_row.qty, null, 'service_return', v_service.id
      );
    else
      perform public.apply_stock_delta(
        v_row.product_id, v_row.qty, null, 'service_return', v_service.id, null
      );
    end if;

    update public.cervise_service_spareparts
    set is_returned = true, returned_at = now()
    where id = v_row.id;

    v_count := v_count + 1;
  end loop;

  insert into public.cervise_service_logs (branch_id, servis_id, actor_id, action, to_value, payload)
  values (
    v_service.branch_id, v_service.id, auth.uid(), 'return_sparepart', trim(p_reason),
    jsonb_build_object('lines', v_count, 'decision', 'return')
  );

  return v_count;
end;
$$;

revoke all on function public.consume_custom_service_sparepart(uuid, text, integer, boolean) from public, anon;
grant execute on function public.consume_custom_service_sparepart(uuid, text, integer, boolean) to authenticated;

-- Fungsi return sudah di-refresh dengan hak akses yang sama seperti sebelumnya.
revoke all on function public.return_service_spareparts(uuid, text) from public, anon;
grant execute on function public.return_service_spareparts(uuid, text) to authenticated;
