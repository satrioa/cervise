-- create_sale_atomic(): satu transaksi untuk seluruh tulisan penjualan.
--
-- Alasan migrasi ini ada - ditemukan lewat test end-to-end penjualan POS.
-- `createSale` di src/app/app/penjualan/actions.ts menulis ke lima tempat
-- secara berurutan, masing-masing lewat panggilan terpisah:
--
--   1. cervise_customers      update tags
--   2. cervise_sales          insert header
--   3. cervise_sales_items    insert item   (loop, satu per item)
--   4. cervise_products       stok turun     (loop, lewat adjust_product_stock)
--   5. finance_tx             insert kas
--
-- Kalau salah satu gagal di tengah, hasil yang tertinggal bukan "tidak ada
-- penjualan", tapi penjualan setengah jadi. Kasus terburuk yang nyata: insert
-- di langkah 5 gagal. Barang sudah keluar dari stok dan invoice sudah terbit,
-- tapi uang masuk tidak pernah tercatat di kas - laporan penjualan dan
-- laporan kas tidak akan pernah balance.
--
-- Fungsi plpgsql adalah satu transaksi. Kalau satu INSERT gagal, semua
-- tulisan sebelum dan sesudahnya dibatalkan. Tidak ada compensate logic yang
-- harus benar - tidak ada sama sekali.
--
-- Batas tanggung jawabnya sengaja:
--
-- - Aturan bisnis TETAP di TypeScript. Role, harga jual yang boleh
--   di-override, batas diskon, validasi keranjang, dan cek IMEI ganda
--   semuanya tetap dihitung server action sebelum fungsi ini dipanggil.
--   Fungsi ini tidak memutuskan apa yang valid.
-- - Yang dipindahkan ke sini hanya TULISAN, supaya atomik.
-- - Uang (subtotal, total, paid, payment_status) DIHITUNG ULANG di sini dari
--   qty dan unit_price, bukan dipercaya dari pemanggil. Angka yang tidak
--   konsisten berarti error SQL, bukan angka yang diam-diam tersimpan.
-- - unit_price tetap diterima dari pemanggil karena harga jual boleh
--   di-override oleh admin. Itu kemampuan yang disengaja, bukan celah.
--
-- Stok tetap diturunkan lewat `adjust_product_stock`, supaya tidak ada jalur
-- kedua yang mengubah stok di luar fungsi itu. `p_expected_stock` sengaja
-- dikosongkan: di dalam satu transaksi baris produk sudah terkunci `for
-- update` di sana, jadi pengecekan stok optimistis justru akan menolak
-- penjualan yang sah tanpa menambah keamanan apa pun.
--
-- Otorisasi memakai `has_tenant_branch_role` seperti RPC lain di repo ini:
-- hanya MASTER_ADMIN, ADMIN, FRONTLINER. Technician tidak boleh membuat
-- penjualan dan sekarang tidak bisa menyelundupkan dirinya lewat fungsi ini.

create or replace function public.create_sale_atomic(
  p_branch_id uuid,
  p_customer_id uuid,
  p_sale_number text,
  p_kas_date date,
  p_payment_method text,
  p_paid integer,
  p_discount_total integer,
  p_notes text,
  p_items jsonb,
  p_created_by uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_subtotal integer := 0;
  v_discount integer;
  v_total integer;
  v_paid integer;
  v_status text;
  v_sale_id uuid;
  v_item jsonb;
  v_product public.cervise_products%rowtype;
  v_product_id uuid;
  v_qty integer;
  v_unit_price integer;
begin
  if p_branch_id is null then
    raise exception 'cabang tidak ditemukan';
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
    raise exception 'role tidak diizinkan membuat penjualan' using errcode = '42501';
  end if;

  if p_customer_id is null then
    raise exception 'customer wajib';
  end if;

  if not exists (
    select 1 from public.cervise_customers
    where id = p_customer_id and branch_id = p_branch_id
  ) then
    raise exception 'customer tidak ditemukan';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'keranjang kosong';
  end if;

  if p_sale_number is null or trim(p_sale_number) = '' then
    raise exception 'nomor nota wajib';
  end if;

  -- Subtotal dihitung ulang dari qty x unit_price. Nilai yang dikirim
  -- TypeScript tidak dipercaya untuk bagian uang.
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_product_id := nullif(v_item ->> 'product_id', '')::uuid;
    v_qty := (v_item ->> 'qty')::integer;
    v_unit_price := (v_item ->> 'unit_price')::integer;

    if v_product_id is null then
      raise exception 'produk tidak ditemukan di keranjang';
    end if;
    if v_qty is null or v_qty <= 0 then
      raise exception 'qty tidak valid';
    end if;
    if v_unit_price is null or v_unit_price < 0 then
      raise exception 'harga jual tidak valid';
    end if;

    if not exists (
      select 1 from public.cervise_products
      where id = v_product_id and branch_id = p_branch_id
    ) then
      raise exception 'produk % tidak ditemukan di cabang ini', v_product_id;
    end if;

    v_subtotal := v_subtotal + (v_qty * v_unit_price);
  end loop;

  v_discount := least(greatest(coalesce(p_discount_total, 0), 0), v_subtotal);
  v_total := greatest(0, v_subtotal - v_discount);
  v_paid := least(greatest(coalesce(p_paid, 0), 0), v_total);
  v_status := case
    when v_paid > 0 and v_paid >= v_total then 'lunas'
    when v_paid > 0 then 'dp'
    else 'belum_bayar'
  end;

  insert into public.cervise_sales (
    branch_id, customer_id, sale_number, subtotal, discount_total, total, paid,
    payment_status, payment_method, status, kas_date, notes, created_by
  ) values (
    p_branch_id, p_customer_id, p_sale_number, v_subtotal, v_discount, v_total,
    v_paid, v_status, p_payment_method, 'selesai', p_kas_date, p_notes, p_created_by
  )
  returning id into v_sale_id;

  -- Item dan pengurangan stok. adjust_product_stock memverifikasi ulang role
  -- dan menolak stok negatif, jadi loop ini tidak perlu memeriksanya sendiri.
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_product_id := (v_item ->> 'product_id')::uuid;
    v_qty := (v_item ->> 'qty')::integer;
    v_unit_price := (v_item ->> 'unit_price')::integer;

    select * into v_product
    from public.cervise_products
    where id = v_product_id and branch_id = p_branch_id;

    insert into public.cervise_sales_items (
      sale_id, product_id, sku, name, category, qty, cost, unit_price,
      line_total, is_serialized, item_meta
    ) values (
      v_sale_id, v_product.id, v_product.sku, v_product.name, v_product.category,
      v_qty, v_product.cost, v_unit_price, v_qty * v_unit_price,
      v_product.is_serialized,
      jsonb_build_object(
        'imei1', nullif(v_item ->> 'imei1', ''),
        'imei2', nullif(v_item ->> 'imei2', ''),
        'warna', nullif(v_item ->> 'warna', '')
      )
    );

    perform public.adjust_product_stock(
      v_product.id,
      -v_qty,
      null,
      'sale',
      null,
      v_sale_id
    );
  end loop;

  -- Uang masuk. Kalau insert ini gagal, seluruh penjualan dibatalkan - itu
  -- justru yang menutup kebocoran kas yang ditemukan lewat test.
  if v_paid > 0 then
    insert into public.finance_tx (
      branch_id, type, amount, description, kas_date, created_by
    ) values (
      p_branch_id, 'pemasukan', v_paid, 'Penjualan ' || p_sale_number,
      p_kas_date, p_created_by
    );
  end if;

  -- Tag "sales" ikut dalam transaksi supaya tidak ada customer yang tercatat
  -- pernah punya penjualan tapi tidak bertag.
  update public.cervise_customers
  set tags = (
    select coalesce(jsonb_agg(distinct t order by t), '[]'::jsonb)
    from jsonb_array_elements_text(
      coalesce(tags, '[]'::jsonb) || '"sales"'::jsonb
    ) as t
  )
  where id = p_customer_id and branch_id = p_branch_id;

  return v_sale_id;
end;
$$;

revoke all on function public.create_sale_atomic(
  uuid, uuid, text, date, text, integer, integer, text, jsonb, uuid
) from public;
grant execute on function public.create_sale_atomic(
  uuid, uuid, text, date, text, integer, integer, text, jsonb, uuid
) to authenticated;
revoke all on function public.create_sale_atomic(
  uuid, uuid, text, date, text, integer, integer, text, jsonb, uuid
) from anon;