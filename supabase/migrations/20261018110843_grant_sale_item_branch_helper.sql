-- Fungsi yang dipanggil policy RLS harus bisa dieksekusi oleh role yang
-- policy-nya berlaku.
--
-- public.cervise_sale_item_branch dipakai empat policy pada
-- cervise_sales_items, tapi tidak punya grant EXECUTE untuk authenticated.
-- Akibatnya setiap insert langsung ke cervise_sales_items oleh pengguna yang
-- login gagal dengan:
--
--   42501 permission denied for function cervise_sale_item_branch
--
-- createSale lama menabraknya setiap kali keranjang berisi barang, jadi
-- penjualan tidak pernah bisa menyimpan baris item. Ini tidak pernah terlihat
-- karena aplikasi di produksi selalu balas 404 lebih dulu.

grant execute on function public.cervise_sale_item_branch(uuid) to authenticated;
revoke all on function public.cervise_sale_item_branch(uuid) from anon;