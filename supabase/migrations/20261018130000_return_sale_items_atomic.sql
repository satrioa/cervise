-- return_sale_items_atomic(): retur dalam satu transaksi, dengan lock.
--
-- Alasan migrasi ini ada - pola yang sama seperti create_sale_atomic, tapi
-- lebih berbahaya. `returnSaleItems` di src/app/app/penjualan/actions.ts
-- menulis per item, berurutan:
--
--   1. rpc adjust_product_stock(+qty)   <- stok sudah balik ke gudang
--   2. update cervise_sales_items       <- baru dicatat sebagai retur
--
-- Kalau langkah 2 gagal, stok sudah kembali tanpa tercatat. Kasir bisa
-- mengulang retur item yang sama sebanyak yang mau, dan setiap percobaan
-- menambah stok nyata. Ini bukan selisih pembukuan - ini sumber stok.
--
-- Ditambah `qty_returned` dibaca lalu ditulis tanpa penguncian, jadi dua
-- permintaan retur yang berjalan bersamaan bisa dua-duanya membaca 0,
-- dua-duanya mengembalikan stok, dan dua-duanya menulis 1. Sisa retur jadi
-- salah hitung padahal stok sudah dobel.
--
-- Fungsi ini mengunci baris penjualan lalu tiap baris item dengan FOR UPDATE
-- sebelum membaca `qty_returned`, jadi dua permintaan retur yang bersamaan
-- saling menunggu dan yang kedua melihat angka yang sudah diperbarui.
--
-- Catatan yang disengaja: TIDAK ada pengembalian uang di sini. Retur barang
-- mengembalikan stok, tapi tidak menyentuh finance_tx maupun total di
-- cervise_sales. Itu keputusan bisnis, bukan hole teknis - kalau refund
-- diperlukan, ia perlu RPC sendiri yang menulis ke finance_tx.

create or replace function public.return_sale_items_atomic(
  p_branch_id uuid,
  p_sale_id uuid,
  p_items jsonb
)
returns integer
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
  v_all_returned boolean;
begin
  if p_branch_id is null or p_sale_id is null then
    raise exception 'penjualan tidak ditemukan';
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

    -- Kunci baris item sebelum membaca sisa retur. Tanpa ini, dua permintaan
    -- bersamaan bisa membaca qty_returned yang sama dan dua-duanya mengembalikan
    -- stok.
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

  -- Penjualan baru ditandai retur kalau semua item sudah penuh dikembalikan.
  -- `every` di atas nol baris bernilai true, dan penjualan tanpa item tidak
  -- mungkin ada karena item dibuat bersama penjualan, jadi itu aman.
  select coalesce(bool_and(i.qty = i.qty_returned), true) into v_all_returned
  from public.cervise_sales_items i
  where i.sale_id = p_sale_id;

  if v_all_returned then
    update public.cervise_sales
    set status = 'retur'
    where id = p_sale_id;
  end if;

  return v_count;
end;
$$;

revoke all on function public.return_sale_items_atomic(uuid, uuid, jsonb) from public;
grant execute on function public.return_sale_items_atomic(uuid, uuid, jsonb) to authenticated;
revoke all on function public.return_sale_items_atomic(uuid, uuid, jsonb) from anon;