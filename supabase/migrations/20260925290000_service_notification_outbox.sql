-- Antrean notifikasi WhatsApp untuk servis.
--
-- Trigger di sini hanya menulis metadata event, tidak menyusun pesan. Isi pesan
-- dirakit di aplikasi karena URL halaman lacak butuh origin aplikasi, yang
-- tidak diketahui database.
--
-- Trigger diperlukan karena ada empat jalur penulisan status, dan grants masih
-- mengizinkan PATCH langsung ke cervise_services: grant tabel
-- select, insert, update, delete ke authenticated di
-- 20260925130000_cervise_operational_schema.sql:240 tidak pernah di-revoke,
-- berbeda dengan cervise_products yang UPDATE-nya dicabut di
-- 20260925140000_lock_product_stock.sql:20 lalu diganti grant per kolom di
-- 20260925220000_add_role_scoped_policies.sql:236. Grant itulah yang membuat
-- trigger wajib ada, bukan sekadar lebih rapi. Jalur PATCH itu tidak menulis
-- baris cervise_service_logs sama sekali, dan tidak ada trigger status lain di
-- cervise_services, jadi dispatcher berbasis poll log akan miss dan pelanggan
-- tidak pernah diberi tahu.

create table if not exists public.cervise_notification_outbox (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  -- Sengaja tanpa foreign key ke cervise_services. Tabel log memakai
  -- on delete cascade, sehingga menghapus servis menghapus seluruh riwayatnya.
  -- Riwayat pengiriman tidak boleh ikut hilang, jadi servis_id disimpan polos
  -- dan tidak divalidasi database.
  servis_id uuid,
  event text not null check (event in ('servis_created', 'servis_status')),
  to_kind text not null check (to_kind in ('customer', 'technician')),
  to_status text,
  dedupe_key text not null unique,
  -- Tanpa spasi setelah koma di daftar ini: nilai persis yang di-assert
  -- src/lib/auth/notification-outbox-migration.test.ts:20, yang cocokkan
  -- string dan bukan regex. Merapikan spasi di sini menggagalkan tes tanpa
  -- mengubah perilaku sama sekali, jadi jangan.
  state text not null default 'pending'
    check (state in ('pending','sent','skipped','failed')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  provider_message_id text,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

-- Hanya baris yang masih due dan belum selesai. Indeks parsial supaya indeks
-- tetap kecil walau tabel berisi riwayat pengiriman yang sudah selesai.
create index if not exists cervise_notification_outbox_pending_idx
  on public.cervise_notification_outbox (next_attempt_at)
  where state = 'pending';

-- Dispatcher mengklaim baris yang sudah due dalam satu statement. Dua
-- jaminannya menutup dua kegagalan yang berbeda, dan keduanya dibutuhkan.
--
-- 1. FOR UPDATE SKIP LOCKED menutup bentrok antar-worker: dua worker yang jalan
--    bersamaan tidak pernah mengambil baris yang sama, tanpa koordinator
--    eksternal, dan tanpa jeda antara "baca baris" dengan "kunci baris" seperti
--    pada pola update().in().eq().select() di aplikasi. Yang dilindungi di sini
--    adalah kiriman ganda, bukan baris yang nyangkut.
--
-- 2. Sewa (lease) menutup baris yang nyangkut. Statement ini menggeser
--    next_attempt_at ke depan, jadi baris yang sudah diklaim lalu ditinggalkan --
--    worker mati, kontainer dibunuh di tengah kirim, throw yang tidak
--    tertangani, Fonnte yang menggantung -- tidak langsung diambil lagi oleh
--    tick cron berikutnya, karena next_attempt_at-nya sudah di masa depan.
--    Tanpa ini rantainya berputar sendiri: rute cron punya maxDuration = 60 dan
--    mengirim 25 pesan per run, jadi Fonnte yang lambat persis penyebab yang
--    melampaui anggaran itu. Lambat -> backoff tak pernah tertulis -> fungsi
--    dibunuh di 60s -> baris yang sudah diklaim tetap 'pending' dengan
--    next_attempt_at di masa lalu -> diambil lagi tanpa backoff -> lambat lagi.
--    Hasil akhirnya bukan spam, tapi pesan yang gagal permanen: pelanggan tidak
--    pernah diberi tahu servisnya selesai.
--
-- Pola ini sudah ada di repo: src/app/api/cron/subscription-renewals/route.ts
-- men-stamp whatsapp_sent_at saat klaim (77-82) dan menyediakan releaseClaim()
-- untuk membatalkannya (93-98). Stempel saat klaim itu justru disengaja,
-- supaya klaim tidak dipanggil ulang tiap jam (131-134). Bedanya di sini hanya
-- siapa yang melepas: di sana pemanggil yang melepas, di sini tidak ada yang
-- perlu melepas karena sewanya habis sendiri.
--
-- Sewa 2 menit, di bawah interval cron 5 menit, supaya baris yang ditinggalkan
-- dicoba lagi pada tick BERIKUTNYA, bukan satu tick lagi sesudahnya. Sewa 5
-- menit akan melompati satu siklus penuh.
--
-- attempts SENGAJA tidak dinaikkan di sini. Dispatcher yang menambah
-- row.attempts + 1 tepat sebelum mengirim, jadi kalau claim juga menaikkan,
-- penghitungnya bertambah dua kali per percobaan dan MAX_ATTEMPTS = 4 hanya
-- menghasilkan sekitar 2 kiriman nyata. Satu fakta, satu penulis: claim
-- memiliki sewa, dispatcher memiliki penghitung. attempts berarti "kiriman
-- nyata", dan itulah yang harus diartikan batasnya.
--
-- greatest + coalesce menjaga p_limit null atau <= 0 tidak membuat limit error
-- atau nol baris diam-diam.
create or replace function public.claim_service_notifications(p_limit integer)
returns setof public.cervise_notification_outbox
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.cervise_notification_outbox o
     set next_attempt_at = now() + interval '2 minutes'
   where o.id in (
     select id
       from public.cervise_notification_outbox
      where state = 'pending'
        and next_attempt_at <= now()
      order by next_attempt_at
      limit greatest(coalesce(p_limit, 1), 1)
      for update skip locked
   )
  returning o.*;
end;
$$;

revoke all on function public.claim_service_notifications(integer) from public;
revoke all on function public.claim_service_notifications(integer) from anon;
revoke all on function public.claim_service_notifications(integer) from authenticated;
grant execute on function public.claim_service_notifications(integer) to service_role;

-- Trigger WAJIB security definer. Aplikasi terhubung dengan token user yang
-- tidak punya hak apa pun pada outbox: grant di-revoke dari anon dan
-- authenticated, dan tidak ada satu pun policy RLS di tabel ini. Security
-- invoker akan membuat insert di dalam trigger gagal dengan error privilege.
-- Kesalahannya senyap: trigger tetap terpasang, tidak ada error saat compile,
-- dan semua tes tetap hijau karena tesnya statis, hanya fungsi tidak lagi
-- menaruh apa pun ke antrean. Jangan diubah tanpa menambah tes.
create or replace function public.cervise_enqueue_service_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Seed script menyalakan ini lewat cervise_set_notification_suppression
  -- supaya data demo tidak mengirim pesan ke nomor Fonnte asli. Argumen kedua
  -- true berarti pengaturan yang belum ada dibaca sebagai null, bukan error.
  if current_setting('cervise.suppress_notifications', true) = 'on' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    insert into public.cervise_notification_outbox (
      branch_id, servis_id, event, to_kind, dedupe_key
    ) values
      (new.branch_id, new.id, 'servis_created', 'customer',
       'servis:' || new.id::text || ':created:customer'),
      (new.branch_id, new.id, 'servis_created', 'technician',
       'servis:' || new.id::text || ':created:technician')
    on conflict (dedupe_key) do nothing;
    return new;
  end if;

  -- Hanya status kunci, dan hanya kalau benar-benar berubah. is distinct from
  -- membuat update yang menulis status sama (rework, atau UPDATE tanpa
  -- maksud) tidak menambah pesan baru.
  --
  -- Dua nilai ini sah karena CHECK status di
  -- 20260925130000_cervise_operational_schema.sql:24 yang menjadi satu-satunya
  -- penentu nilai legalnya. Di sini ditulis literal, bukan dibaca dari kode, jadi
  -- tidak ada coupling ke aplikasi: kalau CHECK-nya berubah, daftar ini yang
  -- harus ikut ditinjau, dan trigger akan diam-diam berhenti menyalakan.
  if new.status is distinct from old.status
     and new.status in ('Selesai', 'Sudah Diambil') then
    insert into public.cervise_notification_outbox (
      branch_id, servis_id, event, to_kind, to_status, dedupe_key
    ) values (
      new.branch_id, new.id, 'servis_status', 'customer', new.status,
      'servis:' || new.id::text || ':status:' || new.status || ':customer'
    )
    on conflict (dedupe_key) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists cervise_services_notify_created on public.cervise_services;
create trigger cervise_services_notify_created
  after insert on public.cervise_services
  for each row execute function public.cervise_enqueue_service_notification();

drop trigger if exists cervise_services_notify_status on public.cervise_services;
create trigger cervise_services_notify_status
  after update of status on public.cervise_services
  for each row execute function public.cervise_enqueue_service_notification();

-- Dipakai scripts/seed-demo-data.mjs.
--
-- set_config memakai is_local = false karena saklarnya harus bertahan sampai
-- statement seed berikutnya berjalan: trigger menyala pada statement INSERT
-- terpisah, di luar panggilan RPC ini, jadi saklar yang sifatnya local
-- (is_local = true, yang reverted di akhir transaksi) sudah kembali ke nilai
-- semula sebelum trigger melihatnya.
--
-- Konsekuensinya, level sesi bisa bertahan melewati pemanggilan: koneksi yang
-- dipinjol connection pool akan membawa saklarnya ke pemanggil berikutnya.
-- Karena itu pemanggil WAJIB memanggil fungsi ini lagi dengan p_on = false di
-- dalam finally, apa pun hasil akhirnya.
--
-- PENTING -- fungsi ini hanya berguna dari klien SQL yang menyambung persisten
-- (psql, session pooler, SQL editor). Melalui PostgREST -- yang dipakai klien
-- Supabase -- TIDAK bisa dipakai untuk menekan trigger di permintaan
-- berikutnya: set_config menempel di satu koneksi, sedangkan permintaan
-- berikutnya dilayani koneksi lain dari pool, jadi current_setting sudah NULL
-- lagi. Diuji terhadap database ini: diset di satu permintaan, dibaca di
-- permintaan berikutnya, hasilnya NULL.
--
-- Seed script karena itu menghapus baris outbox-nya sendiri setelah insert,
-- bukan memakai fungsi ini. Fungsi ini dipertahankan karena suppression di
-- dalam satu transaksi (misalnya blok DO untuk pengujian) tetap bekerja, tapi
-- jangan andalkan untuk apa pun yang lintas permintaan HTTP.
create or replace function public.cervise_set_notification_suppression(p_on boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config(
    'cervise.suppress_notifications',
    case when p_on then 'on' else 'off' end,
    false
  );
end;
$$;

revoke all on function public.cervise_set_notification_suppression(boolean) from public;
revoke all on function public.cervise_set_notification_suppression(boolean) from anon;
revoke all on function public.cervise_set_notification_suppression(boolean) from authenticated;
grant execute on function public.cervise_set_notification_suppression(boolean) to service_role;

-- RLS diaktifkan dan tidak ada policy sama sekali: satu-satunya jalan masuk
-- adalah service_role, lewat grant di bawah atau lewat trigger yang berjalan
-- sebagai pemilik fungsi.
alter table public.cervise_notification_outbox enable row level security;

revoke all on public.cervise_notification_outbox from anon;
revoke all on public.cervise_notification_outbox from authenticated;
grant select, insert, update, delete on public.cervise_notification_outbox to service_role;
