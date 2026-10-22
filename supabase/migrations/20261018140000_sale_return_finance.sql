-- sale_return_finance(): retur barang mengembalikan uang.
--
-- Sampai sekarang retur hanya mengembalikan stok. Barang masuk lagi ke gudang
-- dan qty_returned bertambah, tapi tidak ada uang yang keluar dari laci dan
-- tidak ada angka di laporan yang berubah. Kasir bisa menerima barang kembali
-- tanpa menyerahkan uang, dan Laporan Penjualan tetap menghitung omzet penuh.
--
-- Kolom `returned_value` menyimpan NILAI BARANG yang sudah kembali, bukan uang
-- yang keluar. Dua angka itu tidak selalu sama, dan yang membedakannya adalah
-- penjualan DP:
--
--   total 300.000, dibayar 100.000, semua barang diretur.
--   Nilai barang kembali = 300.000, uang yang boleh keluar = 100.000 saja.
--
-- Kalau yang disimpan hanya uang keluar, laporan tidak bisa lagi tahu berapa
-- sisa utang pelanggan dan berapa omzet yang sebenarnya. Dengan menyimpan nilai
-- barang, uang keluar selalu bisa diturunkan darinya:
--
--   refund = least(returned_value, paid) - least(returned_value_lama, paid)
--
-- Hanya satu angka yang disimpan, jadi tidak ada dua sumber yang bisa berbeda
-- pendapat. Konsekuensinya juga rapi: utang pelanggan yang barangnya sudah
-- kembali seluruhnya otomatis batal, karena total - returned_value = 0.
--
-- Kenapa proporsional terhadap `total`, bukan qty x unit_price:
--   jual 2 unit @150.000 dengan diskon 100.000 berarti total 200.000.
--   Retur 1 unit tidak boleh me-refund 150.000 - itu 100.000 lebih besar dari
--   yang pernah dibayar pelanggan.
--
-- Kenapa `returned_value` dihitung ulang dari qty_returned, bukan ditambah
-- sedikit demi sedikit: pembulatan. Menjumlahkan hasil floor per permintaan
-- bisa menyisakan 1 rupiah yang tidak pernah kembali. Di sini nilainya selalu
-- dihitung dari keadaan terkini, dan saat semua item kembali nilainya diset
-- tepat sama dengan total.
--
-- Retur selalu berarti uang kembali, bukan tukar barang. Tukar barang tidak
-- didukung dan tidak boleh disamarkan sebagai retur.

alter table public.cervise_sales
  add column if not exists returned_value integer not null default 0;

-- Hak akses di tabel ini per-kolom. Tanpa grant ini, select("*") di PostgREST
-- diam-diam tidak mengembalikan kolomnya.
-- returned_value tetap bisa di-update langsung oleh authenticated karena tabel
-- ini memang sudah punya grant update penuh (sama seperti total dan paid).
-- Yang menjaga angkanya benar adalah fungsi di bawah, bukan grant.
grant select (returned_value) on public.cervise_sales to authenticated;

-- 'retur' dipisahkan dari 'penyesuaian' supaya refund bisa dibedakan dari
-- koreksi kas manual di laporan.
alter table public.finance_tx drop constraint if exists finance_tx_source_check;
alter table public.finance_tx add constraint finance_tx_source_check
  check (source = any (array['transaksi'::text, 'kas_manual'::text, 'penyesuaian'::text, 'retur'::text]));

-- create or replace tidak bisa mengubah daftar argumen. Tanpa drop, versi lama
-- (tanpa p_kas_date) tetap hidup dan masih bisa dipanggil.
drop function if exists public.return_sale_items_atomic(uuid, uuid, jsonb);

create or replace function public.return_sale_items_atomic(
  p_branch_id uuid,
  p_sale_id uuid,
  p_items jsonb,
  p_kas_date date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_sale public.cervise_sales%rowtype;
  v_item public.cervise_sales_items%rowtype;
  v_entry jsonb;
  v_item_id uuid;
  v_qty integer;
  v_available integer;
  v_count integer := 0;
  v_gross bigint;
  v_value integer;
  v_refund integer;
  v_all_returned boolean;
begin
  if p_branch_id is null or p_sale_id is null then
    raise exception 'penjualan tidak ditemukan';
  end if;

  if p_kas_date is null then
    raise exception 'tanggal retur wajib';
  end if;

  select b.organization_id into v_org
  from public.branches b
  where b.id = p_branch_id and b.is_active = true;

  if not found then
    raise exception 'cabang tidak ditemukan';
  end if;

  if not (
    public.is_platform_admin()
    or public.has_tenant_branch_role(
      v_org,
      p_branch_id,
      array['MASTER_ADMIN'::text, 'ADMIN'::text, 'FRONTLINER'::text]
    )
  ) then
    raise exception 'role tidak diizinkan memproses retur' using errcode = '42501';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'tidak ada item untuk diretur';
  end if;

  -- Kunci penjualan lebih dulu. Ini yang mencegah dua permintaan retur untuk
  -- penjualan yang sama berjalan bersamaan tanpa saling tahu.
  select * into v_sale
  from public.cervise_sales
  where id = p_sale_id and branch_id = p_branch_id
  for update;

  if not found then
    raise exception 'penjualan tidak ditemukan';
  end if;

  if v_sale.status = 'retur' then
    raise exception 'sudah retur';
  end if;

  for v_entry in select * from jsonb_array_elements(p_items) loop
    v_item_id := nullif(v_entry ->> 'item_id', '')::uuid;
    v_qty := (v_entry ->> 'qty')::integer;

    if v_item_id is null then
      raise exception 'item retur tidak valid';
    end if;

    select * into v_item
    from public.cervise_sales_items
    where id = v_item_id and sale_id = p_sale_id
    for update;

    if not found then
      raise exception 'item % tidak ditemukan di penjualan ini', v_item_id;
    end if;

    v_available := v_item.qty - v_item.qty_returned;

    if v_qty is null or v_qty <= 0 or v_qty > v_available then
      raise exception 'qty retur tidak valid';
    end if;

    -- Stok dulu, pencatatan menyusul. Keduanya dalam satu transaksi, jadi
    -- urutannya tidak lagi berarti: kalau yang kedua gagal, yang pertama batal
    -- bersama seluruh retur lain di permintaan yang sama.
    perform public.adjust_product_stock(
      v_item.product_id,
      v_qty,
      null,
      'sale_return',
      null,
      p_sale_id
    );

    update public.cervise_sales_items
    set qty_returned = v_item.qty_returned + v_qty
    where id = v_item_id;

    v_count := v_count + 1;
  end loop;

  -- Nilai barang yang sudah kembali, dihitung dari keadaan terkini (bukan
  -- ditambah per permintaan) supaya pembulatan tidak menumpuk.
  select
    coalesce(sum(i.qty_returned::bigint * i.unit_price), 0),
    coalesce(bool_and(i.qty = i.qty_returned), true)
  into v_gross, v_all_returned
  from public.cervise_sales_items i
  where i.sale_id = p_sale_id;

  if v_all_returned then
    -- Semua kembali: nilai barang yang kembali adalah seluruh nilai nota,
    -- tanpa sisa pembulatan.
    v_value := v_sale.total;
  elsif v_sale.subtotal > 0 then
    -- Proporsional terhadap total (setelah diskon), bukan harga sticker.
    -- Dihitung sebagai numeric: 600.000 x 600.000 = 3,6e11 melewati batas
    -- integer.
    v_value := floor((v_gross::numeric * v_sale.total) / v_sale.subtotal)::integer;
  else
    v_value := 0;
  end if;

  -- Uang yang keluar tidak pernah melebihi uang yang pernah masuk. Selisih
  -- terhadap nilai lama, jadi retur bertahap tidak membayar dua kali.
  v_refund := least(v_value, v_sale.paid) - least(v_sale.returned_value, v_sale.paid);
  if v_refund < 0 then
    v_refund := 0;
  end if;

  update public.cervise_sales
  set returned_value = v_value,
      status = case when v_all_returned then 'retur' else status end
  where id = p_sale_id;

  if v_refund > 0 then
    insert into public.finance_tx (
      branch_id, type, amount, description, kas_date, metode, source, created_by
    ) values (
      p_branch_id, 'pengeluaran', v_refund,
      'Retur ' || v_sale.sale_number,
      p_kas_date, v_sale.payment_method, 'retur', auth.uid()
    );
  end if;

  return jsonb_build_object(
    'items', v_count,
    'refund', v_refund,
    'returned_value', v_value
  );
end;
$$;

revoke all on function public.return_sale_items_atomic(uuid, uuid, jsonb, date) from public;
grant execute on function public.return_sale_items_atomic(uuid, uuid, jsonb, date) to authenticated;
revoke all on function public.return_sale_items_atomic(uuid, uuid, jsonb, date) from anon;
