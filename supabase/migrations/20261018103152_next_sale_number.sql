-- Nomor penjualan berurutan per cabang.
--
-- sale_number sekarang dibuat dari tanggal + empat angka acak
-- (penjualan/actions.ts) dan dari Date.now().toString(36).slice(-4) (cash.ts).
-- Keduanya bisa bentrok: empat angka acak punya 9000 kombinasi dan
-- sale_number punya UNIQUE global, sedangkan base36 empat karakter mengulang
-- setiap ~28 menit, jadi dua pembayaran 28 menit apart pada hari yang sama
-- menghasilkan nomor identik. Pemanggil lalu melihat error unik Postgres
-- mentah dan pembayaran hilang.
--
-- Polanya disalin dari next_service_number (20260925150000): baris branch
-- dikunci dengan FOR UPDATE, lalu nomor berikutnya dihitung dari max yang ada.
-- Format mengikuti data yang sudah tersimpan: SLV-2026-0001.
--
-- Catatan batasnya: FOR UPDATE hanya menahan selama transaksi. Panggilan
-- server action adalah transaksi sendiri yang selesai sebelum insert, jadi dua
-- kasir yang benar-benar bersamaan masih bisa menerima nomor yang sama dan
-- salah satunya berhenti di constraint UNIQUE. Memperbaiki itu berarti
-- nomor dibuat dan insert harus satu transaksi, yaitu RPC create_sale_with_stock.

create or replace function public.next_sale_number(p_branch_id uuid)
returns text
language plpgsql
security definer
set search_path = 'public'
as $function$
declare
  v_next integer;
  v_year text;
begin
  if not (
    public.is_platform_admin()
    or public.can_access_tenant_branch(p_branch_id)
  ) then
    raise exception 'branch tidak diizinkan';
  end if;

  perform 1 from public.branches where id = p_branch_id for update;

  v_year := to_char(current_date, 'YYYY');
  select coalesce(max(substring(sale_number from 10)::integer), 0) + 1
    into v_next
  from public.cervise_sales
  where branch_id = p_branch_id
    and sale_number like 'SLV-' || v_year || '-%';

  return 'SLV-' || v_year || '-' || lpad(v_next::text, 4, '0');
end;
$function$;

grant execute on function public.next_sale_number(uuid) to authenticated;
revoke all on function public.next_sale_number(uuid) from anon, public;