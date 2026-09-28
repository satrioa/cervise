-- Notifikasi saat teknisi diganti, bukan hanya saat servis dibuat.
--
-- Trigger di 20260925290000 hanya menyala pada AFTER INSERT dan AFTER UPDATE OF
-- status. Perubahan `teknisi_id` tidak menyalakan apa pun, jadi kalau servis
-- dibuat untuk teknisi A lalu dipindah ke B SETELAH notifikasi A dikirim, B
-- tidak pernah diberi tahu -- dan A sudah diberi tahu tentang pekerjaan yang
-- sekarang bukan miliknya.
--
-- Dua bagian, dan kalau hanya salah satu yang dikerjakan, perbaikannya terlihat
-- berhasil lalu tidak mengubah apa pun:
--
-- 1. Trigger-nya sendiri, dengan dua penjaga. `is distinct from` mencegah
--   trigger menyala saat kolom ditulis dengan nilai yang sama; tanpa itu,
--    setiap penyimpanan ulang service akan mengirim ulang pesan. `is not null`
--    mencegah pesan saat teknisi DILEPAS: perpindahan ke NULL berarti pekerjaan
--    dikembalikan ke antrean, bukan orangnya diganti, dan tidak ada yang perlu
--    diberi tahu.
--
-- 2. Kunci dedupe yang BARU. Kunci `servis:<id>:created:technician` sudah
--    terpakai saat insert dengan `on conflict (dedupe_key) do nothing`, jadi
--    trigger baru yang memakai kunci lama akan DILEWATI DIAM-DIAM dan tidak
--    pernah menyalakan apa pun. Bentuk baru memuat id teknisi, supaya
--    perpindahan A -> B -> A tetap dihitung sebagai dua peristiwa berbeda dan
--    tidak collapsed jadi satu.
--
-- Konsekuensi yang disengaja dari kunci per-teknisi: A -> B -> A -> B
-- menghasilkan tiga notifikasi, dan perpindahan kedua ke B tidak menambah apa
-- apa karena kunci `assigned:B` sudah terpakai. Notifikasi ulang ke teknisi
-- yang sama tentang pekerjaan yang sama dianggap derau, bukan informasi. Kalau
-- suatu saat dibutuhkan notifikasi setiap kali, kuncinya harus memuat stempel
-- waktu -- dan itu menghapus idempotensi yang jadi alasan trigger memakai
-- `on conflict do nothing` sama sekali, jadi itu keputusan produk, bukan
-- detail SQL.
--
-- `event` sengaja tetap `servis_created`, bukan nilai baru. Dispatcher menolak
-- technician dengan event selain itu secara terminal
-- (`dispatcher.ts`, resolveRow: "unsupported_technician_event"), dan isi
-- pesannya identik -- "pesanan masuk" ke teknisi yang sekarang memegang
-- pekerjaan itu tetap benar. Menambah nilai event berarti mengubah
-- CHECK, mengubah guard dispatcher, dan menambah cabang, untuk pesan yang teksnya
-- sama persis. Yang membuat pembeda perpindahan hidup ada di dedupe_key, dan itu
-- yang perlu dibaca saat menelusuri antrean.
--
-- Soleksi trigger function yang sama dari 20260925290000 dipakai ulang, supaya
-- saklar suppress_notifications berlaku untuk trigger ini juga. Fungsi itu
-- sekarang sudah tidak bisa dipakai lewat PostgREST (set_config menempel di
-- satu koneksi, permintaan berikutnya dapat memakai koneksi lain dari pool),
-- tapi suppression dalam satu transaksi -- seperti blok DO di bawah -- tetap
-- bekerja.

create or replace function public.cervise_enqueue_service_technician_assigned()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_technisi uuid;
begin
  if current_setting('cervise.suppress_notifications', true) = 'on' then
    return new;
  end if;

  -- Pelepasan teknisi, bukan penggantian: tidak ada yang perlu diberi tahu.
  if new.teknisi_id is null then
    return new;
  end if;

  v_technisi := new.teknisi_id;

  insert into public.cervise_notification_outbox (
    branch_id, servis_id, event, to_kind, dedupe_key
  ) values (
    new.branch_id, new.id, 'servis_created', 'technician',
    'servis:' || new.id::text || ':assigned:' || v_technisi::text || ':technician'
  )
  on conflict (dedupe_key) do nothing;

  return new;
end;
$$;

drop trigger if exists cervise_services_notify_assigned on public.cervise_services;
create trigger cervise_services_notify_assigned
  after update of teknisi_id on public.cervise_services
  for each row
  when (old.teknisi_id is distinct from new.teknisi_id and new.teknisi_id is not null)
  execute function public.cervise_enqueue_service_technician_assigned();

revoke all on function public.cervise_enqueue_service_technician_assigned() from public;
revoke all on function public.cervise_enqueue_service_technician_assigned() from anon;
revoke all on function public.cervise_enqueue_service_technician_assigned() from authenticated;
grant execute on function public.cervise_enqueue_service_technician_assigned() to service_role;
