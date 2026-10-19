-- Satu jalur pembayaran servis, satu transaksi.
--
-- Dulu ada dua jalur yang menulis ke tabel berbeda: dialog kasir menulis
-- cervise_sales, drawer detail servis menulis finance_tx. Akibatnya Laporan
-- Penjualan tidak pernah melihat pembayaran lewat drawer, dan Arus Kas tidak
-- pernah melihat yang lewat dialog. Di database: 3 baris finance_tx punya
-- servis_id, 0 baris cervise_sales punya servis_id.
--
-- Versi pertama perbaikan ini menulis tiga perintah terpisah dari TypeScript
-- (faktur, kas, lalu price), jadi gagal di tengah meninggalkan faktur bertanda
-- lunas tanpa baris kas. Di sini ketiganya satu transaksi.
--
-- Nomor nota diambil di dalam transaksi lewat next_sale_number, jadi dua kasir
-- bersamaan tidak menerima nomor yang sama.
--
-- Patokan lunas adalah price_estimasi, BUKAN price: price adalah kolom yang
-- ikut ditulis fungsi ini (total yang sudah dibayar), jadi memakainya akan
-- menolak pembayaran kedua.

create or replace function public.record_service_payment(
  p_branch_id uuid,
  p_servis_id uuid,
  p_amount integer,
  p_metode text,
  p_kas_date date,
  p_keterangan text,
  p_created_by uuid
)
returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $function$
declare
  v_service public.cervise_services%rowtype;
  v_role text;
  v_already integer;
  v_total integer;
  v_sale_id uuid;
  v_sale_number text;
begin
  if p_branch_id is null or p_servis_id is null then
    raise exception 'servis wajib';
  end if;
  if p_metode is null or p_metode not in ('Tunai','Debit','Transfer','QRIS','E-Wallet') then
    raise exception 'metode pembayaran tidak valid';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'nominal harus lebih dari nol';
  end if;

  v_role := public.caller_branch_role(p_branch_id);
  if not (public.is_platform_admin() or v_role in ('MASTER_ADMIN','ADMIN','FRONTLINER')) then
    raise exception 'role tidak diizinkan melakukan pembayaran' using errcode = '42501';
  end if;

  select * into v_service
  from public.cervise_services
  where id = p_servis_id and branch_id = p_branch_id
  for update;

  if not found then
    raise exception 'servis tidak ditemukan';
  end if;
  if v_service.status = 'Batal' then
    raise exception 'servis dibatalkan tidak bisa dibayar';
  end if;

  -- Sudah dibayar dihitung dari ledger kas, bukan dari kolom price. price ikut
  -- ditulis fungsi ini, jadi memakainya sebagai patokan akan menolak
  -- pembayaran kedua.
  select coalesce(sum(amount), 0) into v_already
  from public.finance_tx
  where servis_id = p_servis_id and branch_id = p_branch_id and type = 'pemasukan';

  -- Tanpa estimasi, nominal apa pun diterima (harga disepakati di tempat).
  -- Dengan estimasi, servis yang sudah lunas ditolak di sini supaya antrean
  -- kasir yang masih menampilkan servis lama tidak bisa menagih dua kali.
  if v_service.price_estimasi is not null
     and v_service.price_estimasi > 0
     and v_already >= v_service.price_estimasi then
    raise exception 'servis sudah lunas';
  end if;

  v_total := v_already + p_amount;
  v_sale_number := public.next_sale_number(p_branch_id);

  insert into public.cervise_sales (
    branch_id, customer_id, sale_number, subtotal, discount_total, total, paid,
    payment_status, payment_method, status, kas_date, notes, created_by, servis_id
  ) values (
    p_branch_id, v_service.customer_id, v_sale_number, p_amount, 0, p_amount, p_amount,
    'lunas', p_metode, 'selesai', coalesce(p_kas_date, current_date),
    nullif(trim(coalesce(p_keterangan, '')), ''),
    p_created_by, p_servis_id
  )
  returning id into v_sale_id;

  insert into public.finance_tx (
    branch_id, servis_id, type, amount, kas_date, metode, keterangan, description, created_by
  ) values (
    p_branch_id, p_servis_id, 'pemasukan', p_amount, coalesce(p_kas_date, current_date),
    p_metode, nullif(trim(coalesce(p_keterangan, '')), ''),
    'Pembayaran servis ' || coalesce(v_service.service_number, '') || ' - ' || p_metode,
    p_created_by
  );

  -- price tetap = total yang sudah dibayar, karena itu yang dibaca halaman
  -- detail dan laporan lama.
  update public.cervise_services
  set price = v_total
  where id = p_servis_id;

  return jsonb_build_object(
    'sale_id', v_sale_id,
    'sale_number', v_sale_number,
    'total', v_total,
    'amount', p_amount
  );
end;
$function$;

revoke all on function public.record_service_payment(uuid, uuid, integer, text, date, text, uuid) from public, anon;
grant execute on function public.record_service_payment(uuid, uuid, integer, text, date, text, uuid) to authenticated;
