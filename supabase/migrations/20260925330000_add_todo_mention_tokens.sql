-- Posisi chip mention di dalam teks catatan, lewat token.
--
-- Mention sebelumnya disimpan terpisah dari teks: `cervise_todo_mentions` punya
-- customer_id/servis_id, tapi tidak ada yang memberi tahu POSISI mention itu
-- di dalam kalimat. Karena itu chip tidak bisa dirender sebaris -- hanya bisa
-- jadi baris di bawah judul.
--
-- Solusinya token di dalam teks: `Telp {{m:k3f9a}} soal IMEI`. Posisi chip
-- menyatu dengan teksnya sendiri, jadi mengubah kalimat di sekitar chip tidak
-- membuat chip meleset ke posisi salah. Menyimpan indeks karakter
-- (`anchor`) terlihat lebih bersih, tapi setiap edit teks menggeser semua
-- indeks setelah titik yang diedit -- dan catatan ini bisa diedit inline.
--
-- Token dibuat CLIENT dan disimpan, bukan diturunkan dari id baris. Kalau
-- token diambil dari `id` (uuid), satu mention memakan 44 karakter; tiga
-- mention sudah 132 karakter dari jatah 200. Token 6 karakter base36
-- memakan 12, dan tabrakan hanya mungkin di dalam satu catatan.

alter table public.cervise_todo_mentions
  add column if not exists token text;

-- Baris lama dibuat sebelum token ada. Token diisi dari id barisnya supaya
-- tidak ada baris yang tidak punya token -- kolomnya jadi not null di bawah.
update public.cervise_todo_mentions
set token = substr(replace(id::text, '-', ''), 1, 6)
where token is null;

alter table public.cervise_todo_mentions
  alter column token set not null;

-- Batas 6-10 karakter alfanumerik kecil. Base36 6 karakter = 2 miliar
-- kombinasi; tabrakan mustahil di antara maksimal 10 mention dalam satu
-- catatan, dan check ini tetap menolak token aneh yang masuk lewat jalur lain.
alter table public.cervise_todo_mentions
  drop constraint if exists cervise_todo_mentions_token_format;

alter table public.cervise_todo_mentions
  add constraint cervise_todo_mentions_token_format
  check (token ~ '^[0-9a-z]{6,10}$');

create unique index if not exists cervise_todo_mentions_todo_token_idx
  on public.cervise_todo_mentions(todo_id, token);

-- Batas panjang judul dihitung dari teks yang TERLIHAT, bukan dari string
-- yang sudah berisi token.
--
-- Check lama (`between 1 and 200`) menghitung seluruh string, termasuk
-- `{{m:k3f9a}}` yang tidak pernah dilihat pengguna. Tiga mention memakan 36
-- karakter tak terlihat, jadi catatan yang isinya 180 karakter terlihat akan
-- ditolak dengan pesan yang tidak bisa ditebak penyebabnya.
--
-- Yang dipindah ke sini hanya pembatas pengaman. Aturan 200 karakter terlihat
-- ditegakkan di `src/app/app/actions/todos.ts` (cleanTitle), satu-satunya
-- tempat yang menulis kolom ini. Angka 600 = 200 terlihat + 400 token, cukup
-- untuk 30 mention dan masih terlalu pendek untuk menyimpan catatan berisi
-- markup.
alter table public.cervise_staff_todos
  drop constraint if exists cervise_staff_todos_title_check;

alter table public.cervise_staff_todos
  add constraint cervise_staff_todos_title_check
  check (char_length(btrim(title)) between 1 and 600);
