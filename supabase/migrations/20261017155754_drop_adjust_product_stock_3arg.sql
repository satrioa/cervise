-- Hapus overload 3-arg adjust_product_stock.
--
-- 20260925150000 sudah menghapusnya, tapi 20260925220000 (add_role_scoped_policies)
-- membuat ulang versi 3-arg di baris 172-232 lalu ME-GRANT-nya ke authenticated.
-- Versi itu menulis cervise_products.stock_qty inline tanpa apply_stock_delta:
-- tidak ada baris cervise_stock_movements, tidak ada validasi reason, dan bisa
-- dipanggil langsung lewat REST dengan kunci milik pengguna yang login.
--
-- Pemanggil di aplikasi sudah dipindah ke arity 6 (penjualan/actions.ts:340 dan
-- :376, dengan p_reason dan p_sale_id). Arity 6 memeriksa role lalu meneruskan
-- ke apply_stock_delta.

revoke all on function public.adjust_product_stock(uuid, integer, integer) from authenticated;
revoke all on function public.adjust_product_stock(uuid, integer, integer) from anon;
revoke all on function public.adjust_product_stock(uuid, integer, integer) from public;

drop function if exists public.adjust_product_stock(uuid, integer, integer);