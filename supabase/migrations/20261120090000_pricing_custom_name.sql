-- Nama paket Custom disingkat di UI: harga ditampilkan sebagai "Custom",
-- bukan angka harga dasar. Source of truth tetap tabel packages.
update public.packages
set name = 'Pay as You Grow'
where code = 'custom';
