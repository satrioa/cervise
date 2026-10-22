-- Satu transaksi untuk satu penjualan.
--
-- createSale sebelumnya melakukan delapan langkah lebih: nomor, cek customer,
-- update tag, insert header, lalu untuk tiap item satu insert dan satu rpc
-- stok, lalu insert finance_tx. Semuanya transaksi terpisah, jadi gagal di
-- tengah meninggalkan keadaan yang tidak bisa dipulihkan:
--
--   - header + item pertama tertulis, stok item pertama sudah turun, tapi
--     finance_tx belum. Laporan Shift menghitung penjualan ini karena baca
--     cervise_sales, sementara Arus Kas dan Laporan Keuangan tidak karena baca
--     finance_tx. Dua laporan beda, tanpa error.
--   - insert finance_tx gagal -> penjualan lengkap tercatat, uang Rp 0 masuk
--     laporan kas.
--
-- Di sini semuanya satu transaksi: gagal berarti tidak tertulis sama sekali.
--
-- Yang TIDAK dikirimi dari klien: subtotal, total, paid, dan hak ubah harga.
-- Semuanya dihitung ulang dari cervise_products dan dari peran pemanggil.
-- Kalau total diteruskan dari browser, klien tinggal mengirim total = 1.

create or replace function public.create_sale_with_stock(
  p_branch_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $function$
declare
  v_role text;
  v_can_override boolean;
  v_customer uuid;
  v_method text;
  v_kas_date date;
  v_notes text;
  v_promo text;
  v_discount numeric;
  v_paid numeric;
  v_subtotal integer := 0;
  v_total integer;
  v_paid_amount integer;
  v_status text;
  v_sale_id uuid;
  v_sale_number text;
  v_item jsonb;
  v_product public.cervise_products%rowtype;
  v_qty integer;
  v_unit_price integer;
  v_imei text;
begin
  -- Pemanggil harus karyawan aktif di cabang itu dengan tenant yang tidak
  -- diblokir. caller_branch_role mengembalikan string kosong kalau salah satu itu
  -- gagal, jadi satu pemeriksaan ini menutup akun nonaktif, tenant diblokir,
  -- dan langganan habis sekaligus.
  v_role := public.caller_branch_role(p_branch_id);
  if v_role not in ('MASTER_ADMIN', 'ADMIN', 'FRONTLINER') then
    raise exception 'role tidak diizinkan membuat penjualan' using errcode = '42501';
  end if;
  v_can_override := v_role in ('MASTER_ADMIN', 'ADMIN');

  if p_payload is null then
    raise exception 'payload wajib';
  end if;

  v_customer := nullif(p_payload ->> 'customer_id', '')::uuid;
  if v_customer is null then
    raise exception 'customer wajib';
  end if;
  if not exists (
    select 1 from public.cervise_customers c
    where c.id = v_customer and c.branch_id = p_branch_id
  ) then
    raise exception 'customer tidak ditemukan';
  end if;

  v_method := p_payload ->> 'payment_method';
  if v_method is null or v_method not in ('Tunai', 'Debit', 'Transfer', 'QRIS', 'E-Wallet') then
    raise exception 'metode pembayaran tidak valid';
  end if;

  -- Format dan rentang kas_date diperiksa di sini, bukan dipercaya dari klien.
  begin
    v_kas_date := (p_payload ->> 'kas_date')::date;
  exception when others then
    raise exception 'kas_date tidak valid';
  end;
  if v_kas_date > (now() at time zone 'Asia/Jakarta')::date then
    raise exception 'kas_date tidak boleh di masa depan';
  end if;

  v_notes := nullif(trim(coalesce(p_payload ->> 'notes', '')), '');
  v_promo := nullif(trim(coalesce(p_payload ->> 'promo_code', '')), '');
  v_discount := coalesce((p_payload ->> 'discount_total')::numeric, 0);
  if v_discount < 0 then
    raise exception 'diskon tidak boleh negatif';
  end if;
  v_paid := coalesce((p_payload ->> 'paid')::numeric, 0);
  if v_paid < 0 then
    raise exception 'pembayaran tidak valid';
  end if;

  if jsonb_typeof(p_payload -> 'items') <> 'array'
     or jsonb_array_length(p_payload -> 'items') = 0 then
    raise exception 'keranjang kosong';
  end if;

  -- Kunci produk lebih dulu, urut id supaya dua penjualan yang mengunci produk
  -- yang sama tidak saling menunggu (deadlock).
  perform 1
  from public.cervise_products p
  where p.branch_id = p_branch_id
    and p.id in (
      select (item ->> 'product_id')::uuid
      from jsonb_array_elements(p_payload -> 'items') item
    )
  order by p.id
  for update;

  for v_item in select * from jsonb_array_elements(p_payload -> 'items')
  loop
    v_qty := (v_item ->> 'qty')::integer;
    if v_qty is null or v_qty < 1 then
      raise exception 'qty harus > 0';
    end if;

    select * into v_product
    from public.cervise_products p
    where p.id = (v_item ->> 'product_id')::uuid and p.branch_id = p_branch_id;

    if not found then
      raise exception 'produk tidak ditemukan';
    end if;

    v_unit_price := (v_item ->> 'unit_price')::integer;
    if v_unit_price is null or v_unit_price < 0 then
      raise exception 'harga tidak valid';
    end if;

    -- Harga yang dikirim harus sama dengan harga produk, kecuali pemanggil
    -- punya hak harga_jual. Menimpanya diam-diam membuat layar menampilkan
    -- "Total Rp1" sementara server menyimpan total Rp 100.000.
    if not v_can_override and v_unit_price <> v_product.price then
      raise exception 'harga % tidak boleh diubah oleh role ini', v_product.name
        using errcode = '42501';
    end if;

    if v_product.is_serialized and v_qty <> 1 then
      raise exception '% wajib qty 1 (IMEI)', v_product.name;
    end if;

    if v_product.is_serialized then
      v_imei := nullif(trim(coalesce(v_item ->> 'imei1', '')), '');
      if v_imei is null then
        raise exception 'IMEI wajib untuk %', v_product.name;
      end if;
      -- IMEI harus milik unit itu sendiri. Hanya memeriksa "belum pernah dipakai
      -- di penjualan lain" tidak cukup: barang BEKAS bisa terjual dengan IMEI
      -- perangkat lain, dan catatan penjualan serta pencarian garansi lalu
      -- membawa IMEI yang keliru.
      if v_product.imei is not null and btrim(v_product.imei) <> '' and v_imei <> btrim(v_product.imei) then
        raise exception 'IMEI % harus %', v_product.name, btrim(v_product.imei);
      end if;
    end if;

    if v_qty > v_product.stock_qty then
      raise exception 'stok % tidak cukup (sisa %)', v_product.name, v_product.stock_qty;
    end if;

    v_subtotal := v_subtotal + (v_unit_price * v_qty);
  end loop;

  v_discount := least(v_discount, v_subtotal);
  v_total := v_subtotal - v_discount::integer;
  v_paid_amount := least(v_paid, v_total)::integer;
  v_status := case
    when v_paid_amount >= v_total then 'lunas'
    when v_paid_amount > 0 then 'dp'
    else 'belum_bayar'
  end;

  -- Dipanggil di dalam transaksi yang sama, jadi kuncinya pada baris branch
  -- masih aktif: dua kasir yang benar-benar bersamaan tidak menerima nomor
  -- yang sama.
  v_sale_number := public.next_sale_number(p_branch_id);

  insert into public.cervise_sales (
    branch_id, customer_id, sale_number, subtotal, discount_total, total, paid,
    payment_status, payment_method, status, kas_date, notes, created_by
  ) values (
    p_branch_id, v_customer, v_sale_number, v_subtotal, v_discount::integer,
    v_total, v_paid_amount, v_status, v_method, 'selesai', v_kas_date,
    (case when v_promo is not null then '[Promo ' || v_promo || '] ' else '' end)
      || coalesce(v_notes, ''),
    auth.uid()
  ) returning id into v_sale_id;

  for v_item in select * from jsonb_array_elements(p_payload -> 'items')
  loop
    v_qty := (v_item ->> 'qty')::integer;
    v_unit_price := (v_item ->> 'unit_price')::integer;

    select * into v_product
    from public.cervise_products p
    where p.id = (v_item ->> 'product_id')::uuid and p.branch_id = p_branch_id;

    insert into public.cervise_sales_items (
      sale_id, product_id, sku, name, category, qty, cost, unit_price,
      line_total, is_serialized, item_meta
    ) values (
      v_sale_id, v_product.id, v_product.sku, v_product.name, v_product.category,
      v_qty, v_product.cost, v_unit_price, v_unit_price * v_qty, v_product.is_serialized,
      jsonb_strip_nulls(jsonb_build_object(
        'imei1', nullif(trim(coalesce(v_item ->> 'imei1', '')), ''),
        'imei2', nullif(trim(coalesce(v_item ->> 'imei2', '')), ''),
        'warna', nullif(trim(coalesce(v_item ->> 'warna', '')), '')
      ))
    );

    -- apply_stock_delta, bukan adjust_product_stock: pemeriksaan role sudah
    -- dilakukan di atas, dan versi yang tidak menulis ledger harus tetap tidak
    -- dipakai di jalur penjualan.
    perform public.apply_stock_delta(
      v_product.id, -v_qty, v_product.stock_qty, 'sale', null, v_sale_id
    );
  end loop;

  if v_paid_amount > 0 then
    insert into public.finance_tx (
      branch_id, type, amount, description, kas_date, created_by
    ) values (
      p_branch_id, 'pemasukan', v_paid_amount,
      'Penjualan ' || v_sale_number, v_kas_date, auth.uid()
    );
  end if;

  return jsonb_build_object(
    'id', v_sale_id,
    'sale_number', v_sale_number,
    'subtotal', v_subtotal,
    'total', v_total,
    'paid', v_paid_amount,
    'payment_status', v_status
  );
end;
$function$;

grant execute on function public.create_sale_with_stock(uuid, jsonb) to authenticated;
revoke all on function public.create_sale_with_stock(uuid, jsonb) from anon, public;