-- Foto produk disimpan sebagai path objek di bucket `cervise-photos`.
-- Null berarti belum ada foto; UI memakai placeholder.
alter table public.cervise_products
  add column if not exists image_url text;
