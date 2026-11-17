-- Nomor pengirim WhatsApp Meta per tenant.
--
-- Satu WABA dipakai bersama, jadi template cukup dibuat sekali. Yang beda
-- hanya phone_number_id yang dipakai saat mengirim. Kolom ini nullable: baris
-- lama memakai env META_WA_PHONE_NUMBER_ID sebagai fallback, sehingga migrasi
-- tidak mengubah perilaku tenant yang belum dikonfigurasi.

alter table public.organizations
  add column if not exists meta_phone_number_id text;

comment on column public.organizations.meta_phone_number_id is
  'Meta WhatsApp phone number ID yang dipakai untuk mengirim notifikasi tenant ini. Kosong berarti pakai META_WA_PHONE_NUMBER_ID global.';
