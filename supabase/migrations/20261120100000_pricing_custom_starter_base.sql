-- Pay as You Grow dihitung dari kapasitas Starter, bukan Business.
-- Tarif add-on tidak diubah: 79rb/cabang, 12rb/karyawan, 199rb/100 tiket.
update public.packages
set monthly_price = 299000,
    branch_limit = 1,
    user_limit = 5,
    ticket_quota = 100,
    whatsapp_quota = 300
where code = 'custom';
